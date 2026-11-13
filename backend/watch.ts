// Operator-configured, opt-in email forecast watch. Not an emergency alert service.
import type { Classification } from "../shared/types";
import type { Snapshot } from "../shared/drift";
import { locations } from "../shared/locations";

const ORDER: Classification[] = ["unknown", "low", "moderate", "elevated", "high", "critical"];
export interface WatchEvent {
  location: string;
  name: string;
  before: Classification;
  after: Classification;
  capturedAt: string;
}

/** Only email if both classifications are known and the new level is strictly higher. */
export function watchChange(location: string, prior: Snapshot | undefined, next: Snapshot, selected: string): WatchEvent | null {
  if (!selected || selected !== location || !prior || prior.level === "unknown" || next.level === "unknown") return null;
  if (ORDER.indexOf(next.level) <= ORDER.indexOf(prior.level)) return null;
  return { location, name: locations.find(l => l.id === location)?.name ?? location, before: prior.level, after: next.level, capturedAt: next.capturedAt };
}

export function watchMessage(event: WatchEvent): string {
  return [
    `Storm Signal forecast update for ${event.name}`,
    `Risk level increased: ${event.before} -> ${event.after}.`,
    `Checked: ${event.capturedAt}.`,
    "Review the latest forecast, evidence and official NWS warnings:",
    `https://d3p9tcn7282g7r.cloudfront.net/#overview?loc=${encodeURIComponent(event.location)}`,
    "",
    "This is a forecast planning update, not an emergency warning. It may be delayed by up to 30 minutes or more.",
    "Always follow official NWS alerts and local authorities. Do not rely on this email for imminent danger.",
  ].join("\n");
}

export type WatchPublisher = (event: WatchEvent) => Promise<void>;

export function snsPublisher(topicArn: string): WatchPublisher {
  return async event => {
    const { SNSClient, PublishCommand } = await import("@aws-sdk/client-sns");
    const sns = new SNSClient({});
    await sns.send(new PublishCommand({
      TopicArn: topicArn,
      Subject: `Storm Signal: ${event.name} risk increased to ${event.after}`.slice(0, 100),
      Message: watchMessage(event),
    }));
  };
}
