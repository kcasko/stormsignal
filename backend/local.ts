import { createServer } from "node:http";
import { handler } from "./handler";
createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const result = await handler({
      rawPath: url.pathname,
      queryStringParameters: Object.fromEntries(url.searchParams),
      requestContext: { http: { method: req.method } },
    });
    res.writeHead(result.statusCode, result.headers);
    res.end(result.body);
  } catch {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Local service unavailable" }));
  }
}).listen(8787, "127.0.0.1", () =>
  console.log("StormSignal local API: http://127.0.0.1:8787"),
);
