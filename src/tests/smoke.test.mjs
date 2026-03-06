import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const distCli = resolve(repoRoot, "dist", "index.js");
const distMcp = resolve(repoRoot, "dist", "mcp.js");

function runCli(args, envOverrides = {}) {
    return spawnSync("node", [distCli, ...args], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
            ...process.env,
            ...envOverrides,
        },
    });
}

test("CLI help exposes v6.0.2 and history command", () => {
    const result = runCli(["--help"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /v6\.0\.2/);
    assert.match(result.stdout, /history \[options\]/);
});

test("invalid token_id returns structured INVALID_INPUT", () => {
    const result = runCli(["balance", "-k", "abc", "-t", "BNB"]);
    assert.equal(result.status, 1);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.status, "error");
    assert.equal(payload.errorCode, "INVALID_INPUT");
});

test("invalid transfer address is rejected before policy validation", () => {
    const result = runCli(["transfer", "-k", "1", "-t", "BNB", "-d", "bad", "-a", "1"]);
    assert.equal(result.status, 1);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.errorCode, "INVALID_INPUT");
    assert.equal(payload.message, "Invalid to");
});

test("raw calldata invalid target returns structured INVALID_INPUT", () => {
    const result = runCli(["raw", "-k", "1", "-t", "bad", "-d", "0x1234", "-v", "0"]);
    assert.equal(result.status, 1);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.errorCode, "INVALID_INPUT");
    assert.equal(payload.message, "Invalid target");
});

test("generate-wallet explains operator-only role and dual-wallet safety", () => {
    const result = runCli(["generate-wallet"]);
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.walletRole, "operator");
    assert.equal(payload.securityModel, "dual_wallet");
    assert.ok(Array.isArray(payload.doNotUseFor));
    assert.ok(payload.doNotUseFor.some((item) => item.includes("mint")));
    assert.equal(payload.env.autoSetInOpenClaw, true);
});

test("setup-guide missing operator env tells AI to auto-set session env in OpenClaw", () => {
    const result = runCli(["setup-guide"], { RUNNER_PRIVATE_KEY: "" });
    assert.equal(result.status, 1);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.errorCode, "ACCESS_DENIED");
    assert.match(payload.message, /OpenClaw/i);
    assert.match(payload.message, /RUNNER_PRIVATE_KEY/);
});

test("MCP process starts without immediate crash", async () => {
    const child = spawn("node", [distMcp], {
        cwd: repoRoot,
        stdio: ["pipe", "pipe", "pipe"],
    });

    const stderrChunks = [];
    child.stderr.on("data", (chunk) => {
        stderrChunks.push(String(chunk));
    });

    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
    child.kill("SIGTERM");
    await once(child, "exit");

    assert.equal(stderrChunks.join(""), "");
});
