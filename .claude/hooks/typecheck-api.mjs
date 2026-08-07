#!/usr/bin/env node
/**
 * PostToolUse hook: type-check apps/api after a backend TypeScript edit.
 *
 * Runs `npm run typecheck` (tsc --noEmit) in apps/api only when the edited
 * file is a .ts under apps/api, so it stays quiet for web/docs edits.
 *
 * Contract: exit 2 + stderr => Claude sees the type errors as feedback and can
 * fix them immediately. Exit 0 => clean (or not an api edit).
 *
 * The api dir is resolved relative to this file (mpl/.claude/hooks/) so it is
 * correct regardless of the session's working directory.
 */

import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(__dirname, "..", "..", "apps", "api");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  let data = {};
  try {
    data = JSON.parse(input || "{}");
  } catch {
    process.exit(0);
  }

  const fp = (data?.tool_input?.file_path || "").replace(/\\/g, "/");
  if (!/apps\/api\/.*\.(ts|tsx|mts|cts)$/.test(fp)) {
    process.exit(0); // not a backend TS edit — nothing to check
  }

  try {
    execSync("npm run typecheck", {
      cwd: apiDir,
      stdio: ["ignore", "pipe", "pipe"],
    });
    process.exit(0);
  } catch (err) {
    const out =
      (err.stdout ? err.stdout.toString() : "") +
      (err.stderr ? err.stderr.toString() : "");
    console.error(
      "apps/api typecheck failed after editing " +
        fp +
        ":\n" +
        out.trim()
    );
    process.exit(2);
  }
});
