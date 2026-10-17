import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { once } from "node:events";

test("occupied port fails clearly without a startup callback crash", async () => {
  const blocker = createServer();
  blocker.listen(0, "127.0.0.1");
  await once(blocker, "listening");
  const directory = await mkdtemp(join(tmpdir(), "komagene-port-test-"));
  try {
    const child = spawn(process.execPath, ["server/index.js"], {
      cwd: new URL("..", import.meta.url),
      env: { ...process.env, HOST: "127.0.0.1", PORT: String(blocker.address().port), DATA_DIR: directory },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10000,
    });
    let output = "";
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { output += chunk; });
    const [exitCode] = await once(child, "close");
    assert.equal(exitCode, 1);
    assert.match(output, /Sunucu başlatılamadı \(EADDRINUSE\)/);
    assert.doesNotMatch(output, /TypeError|Cannot read properties/);
  } finally {
    await new Promise(resolve => blocker.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
