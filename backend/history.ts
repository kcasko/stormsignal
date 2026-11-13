// Forecast history storage. DynamoDB in AWS (TABLE_NAME set), a JSON file locally, memory in tests.
// Only catalog cities are snapshotted; no user data is stored.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { locations } from "../shared/locations";
import { assess } from "../shared/riskEngine";
import { toSnapshot, type Snapshot } from "../shared/drift";
import { getWeather } from "./weather";

export interface HistoryStore {
  put(location: string, snap: Snapshot): Promise<void>;
  list(location: string, sinceMs: number): Promise<Snapshot[]>;
}

export const RETENTION_HOURS = 72;

export class MemoryStore implements HistoryStore {
  data = new Map<string, Snapshot[]>();
  async put(location: string, snap: Snapshot) {
    this.data.set(location, [...(this.data.get(location) ?? []), snap]);
  }
  async list(location: string, sinceMs: number) {
    return (this.data.get(location) ?? []).filter((s) => Date.parse(s.capturedAt) >= sinceMs);
  }
}

/** Local development only: .data/history/<location>.json (gitignored). */
export class FileStore implements HistoryStore {
  constructor(private dir = ".data/history") {}
  private file(location: string) {
    return join(this.dir, location.replace(/[^a-z0-9-]/g, "_") + ".json");
  }
  private read(location: string): Snapshot[] {
    try {
      return JSON.parse(readFileSync(this.file(location), "utf8"));
    } catch {
      return [];
    }
  }
  async put(location: string, snap: Snapshot) {
    mkdirSync(this.dir, { recursive: true });
    const keep = Date.now() - RETENTION_HOURS * 3600000;
    const all = [...this.read(location), snap].filter((s) => Date.parse(s.capturedAt) >= keep);
    writeFileSync(this.file(location), JSON.stringify(all));
  }
  async list(location: string, sinceMs: number) {
    return this.read(location).filter((s) => Date.parse(s.capturedAt) >= sinceMs);
  }
}

export class DynamoStore implements HistoryStore {
  // Imported lazily so the local server and tests don't need AWS credentials.
  private client: Promise<typeof import("@aws-sdk/client-dynamodb")> = import("@aws-sdk/client-dynamodb");
  private ddb: unknown;
  constructor(private table: string) {}
  private async c() {
    const mod = await this.client;
    this.ddb ??= new mod.DynamoDBClient({});
    return { mod, ddb: this.ddb as InstanceType<typeof mod.DynamoDBClient> };
  }
  async put(location: string, snap: Snapshot) {
    const { mod, ddb } = await this.c();
    await ddb.send(
      new mod.PutItemCommand({
        TableName: this.table,
        Item: {
          pk: { S: location },
          sk: { S: snap.capturedAt },
          data: { S: JSON.stringify(snap) },
          ttl: { N: String(Math.floor(Date.parse(snap.capturedAt) / 1000) + RETENTION_HOURS * 3600) },
        },
      }),
    );
  }
  async list(location: string, sinceMs: number) {
    const { mod, ddb } = await this.c();
    const out = await ddb.send(
      new mod.QueryCommand({
        TableName: this.table,
        KeyConditionExpression: "pk = :p AND sk >= :s",
        ExpressionAttributeValues: { ":p": { S: location }, ":s": { S: new Date(sinceMs).toISOString() } },
        Limit: 200,
      }),
    );
    return (out.Items ?? []).flatMap((i) => {
      try {
        return [JSON.parse(i.data?.S ?? "") as Snapshot];
      } catch {
        return [];
      }
    });
  }
}

let store: HistoryStore | null = null;
export function historyStore(): HistoryStore {
  store ??= process.env.TABLE_NAME ? new DynamoStore(process.env.TABLE_NAME) : new FileStore();
  return store;
}

/**
 * Saves a snapshot per catalog city when NWS issued a new forecast, or at least every 3 hours.
 * Failures for one city never stop the others.
 */
export async function takeSnapshots(s: HistoryStore = historyStore(), fetcher: typeof fetch = fetch, now = Date.now()) {
  const results: Record<string, string> = {};
  for (const l of locations) {
    try {
      const weather = await getWeather(l.id, fetcher, now);
      if (!weather.availability.forecast) {
        results[l.id] = "skipped: forecast unavailable";
        continue;
      }
      const prior = (await s.list(l.id, now - 3 * 3600000)).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
      if (prior && prior.issuedAt === weather.forecastUpdatedAt) {
        results[l.id] = "skipped: no new NWS issuance";
        continue;
      }
      await s.put(l.id, toSnapshot(weather, assess(weather, now).level, now));
      results[l.id] = "saved";
    } catch {
      results[l.id] = "error";
    }
  }
  return results;
}
