import { createApp } from "./app.js";
import { resolve } from "node:path";
import { createServer } from "node:http";

const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 0 || port > 65535)
  throw new Error("PORT geçerli bir port numarası olmalı.");
const host = process.env.HOST || "127.0.0.1";
const app = createApp({ staticDir: resolve("dist") });
const server = createServer(app);
server.once("error", (error) => {
  console.error(`Sunucu başlatılamadı (${error.code || error.name}). PORT ve HOST ayarlarını kontrol edin.`);
  app.locals.close();
  process.exitCode = 1;
});
server.listen(port, host, () =>
  console.log(
    `Komagene gelir-gider paneli hazır: http://${host}:${server.address().port}`,
  ),
);
server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 1000;
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(() => {
    app.locals.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
