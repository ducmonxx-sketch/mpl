#!/usr/bin/env node
/**
 * PreToolUse guard hook.
 *
 * Blocks two classes of action the project explicitly forbids:
 *   1. Editing/writing real .env files (secrets). `.env.example` / `.env.sample`
 *      / `.env.template` stay allowed.
 *   2. Force-pushing `main` (CLAUDE.md: "Never force-push main").
 *
 * Contract: exit 2 + message on stderr => the tool call is blocked and the
 * message is fed back to Claude. Exit 0 => allow.
 */

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  let data = {};
  try {
    data = JSON.parse(input || "{}");
  } catch {
    process.exit(0); // never block on a parse failure
  }

  const tool = data.tool_name || "";
  const ti = data.tool_input || {};

  // --- 1. Protect .env secrets -------------------------------------------
  if (tool === "Edit" || tool === "Write") {
    const fp = (ti.file_path || "").replace(/\\/g, "/");
    const base = fp.split("/").pop() || "";
    const isEnv = /^\.env(\..+)?$/.test(base);
    const isSample = /\.(example|sample|template)$/.test(base);
    if (isEnv && !isSample) {
      console.error(
        `Blocked: refusing to modify secret file "${base}". ` +
          `Edit .env.example instead, or have the human update the real .env by hand.`
      );
      process.exit(2);
    }
  }

  // --- 2. Never force-push main ------------------------------------------
  if (tool === "Bash") {
    const cmd = ti.command || "";
    const isPush = /\bgit\b[\s\S]*\bpush\b/.test(cmd);
    const isForce = /(--force\b|--force-with-lease|\s-f(\s|$))/.test(cmd);
    const touchesMain = /\bmain\b/.test(cmd) || /\+[^\s:]*:?[^\s]*main/.test(cmd);
    if (isPush && isForce && touchesMain) {
      console.error(
        "Blocked: force-pushing main is forbidden (CLAUDE.md). " +
          "Push a feature branch and open a PR, or force-push a non-main branch."
      );
      process.exit(2);
    }
  }

  process.exit(0);
});
