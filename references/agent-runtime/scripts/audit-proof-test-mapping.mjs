#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isAutomatedProofSliceRequired,
  isPlacementAllowed,
} from "./proof-slice-placement-policy.mjs";

const PROOF_SLICES_TRACE_SCHEMA = "openspec-proof-slices-v1";
const PROOF_TEST_MAP_SCHEMA = "openspec-proof-test-map-v1";
const PROOF_SLICE_RE = /\bPS-\d{3}\b/g;

export function auditProofTestMapping(options = {}) {
  const root = options.root ?? process.cwd();
  const change = options.change;
  if (!change) {
    throw new Error("auditProofTestMapping requires a change slug");
  }

  const issues = [];
  const proofSlicesPath = path.join(
    root,
    "openspec",
    "changes",
    change,
    "trace",
    "verification.proof-slices.json",
  );
  const proofMapPath =
    options.proofTestMapPath ??
    path.join(root, "openspec-results", change, "proof-test-map.json");

  const proofSlicesTrace = readJson(proofSlicesPath, root, issues, "MAP-READ-001");
  const proofTestMap = readJson(proofMapPath, root, issues, "MAP-READ-002");
  if (!proofSlicesTrace || !proofTestMap) {
    return summarize(issues);
  }

  if (proofSlicesTrace["trace-schema"] !== PROOF_SLICES_TRACE_SCHEMA) {
    addIssue(issues, "error", "MAP-PS-001", path.relative(root, proofSlicesPath), `trace-schema 必须为 ${PROOF_SLICES_TRACE_SCHEMA}。`);
  }
  if (proofTestMap["trace-schema"] !== PROOF_TEST_MAP_SCHEMA) {
    addIssue(issues, "error", "MAP-TM-001", path.relative(root, proofMapPath), `trace-schema 必须为 ${PROOF_TEST_MAP_SCHEMA}。`);
  }

  const proofSlices = new Map();
  for (const [index, row] of asArray(proofSlicesTrace["proof-slices"]).entries()) {
    const sliceId = strip(row["slice-id"]);
    if (!/^PS-\d{3}$/.test(sliceId)) {
      addIssue(issues, "error", "MAP-PS-002", `proof-slices/${index}`, `slice-id 非法：${sliceId || "(empty)"}。`);
      continue;
    }
    proofSlices.set(sliceId, row);
  }

  const requiredSliceIds = [...proofSlices.values()]
    .filter((row) => isAutomatedProofSliceRequired(row))
    .map((row) => strip(row["slice-id"]));
  const requiredSliceSet = new Set(requiredSliceIds);

  const mapRows = asArray(proofTestMap["proof-test-results"]);
  const rowsBySlice = new Map();
  for (const [index, row] of mapRows.entries()) {
    const sliceId = strip(row["slice-id"]);
    if (!/^PS-\d{3}$/.test(sliceId)) {
      addIssue(issues, "error", "MAP-TM-002", `proof-test-results/${index}`, `slice-id 非法：${sliceId || "(empty)"}。`);
      continue;
    }
    if (!proofSlices.has(sliceId)) {
      addIssue(issues, "error", "MAP-TM-003", `proof-test-results/${index}`, `${sliceId} 不存在于 proof-slices JSON。`);
    }
    if (!rowsBySlice.has(sliceId)) rowsBySlice.set(sliceId, []);
    rowsBySlice.get(sliceId).push({ row, index });
  }

  for (const sliceId of requiredSliceIds) {
    const rows = rowsBySlice.get(sliceId) ?? [];
    if (rows.length === 0) {
      addIssue(issues, "error", "MAP-TM-004", sliceId, "required Proof Slice 缺少 primary test mapping。");
    } else if (rows.length > 1) {
      addIssue(issues, "error", "MAP-TM-005", sliceId, "required Proof Slice 只能有一个 primary test mapping。");
    }
  }

  const discoveredTests =
    options.discoveredTests ??
    discoverRunnerTests(root, issues, options.runnerOutputs);
  for (const { row, index } of mapRowsWithIndex(mapRows)) {
    const sliceId = strip(row["slice-id"]);
    const slice = proofSlices.get(sliceId);
    const ref = `proof-test-results/${index}`;
    if (!slice) continue;

    if (requiredSliceSet.has(sliceId) && strip(row.status).toLowerCase() !== "passed") {
      addIssue(issues, "error", "MAP-TM-006", ref, `${sliceId} status 必须为 passed。`);
    }
    const title = strip(row["test-title"]);
    if (!isValidSingleSliceTitle(title, sliceId, row, slice)) {
      addIssue(issues, "error", "MAP-TM-007", ref, `${sliceId} test-title 必须以 exact ${sliceId} 开头且只包含一个 PS。`);
    }
    const file = strip(row.file);
    if (!isPlacementAllowed(file, slice)) {
      addIssue(issues, "error", "MAP-TM-008", ref, `${sliceId} 测试文件落位不符合 Production Owner + Primary Layer：${file || "(empty)"}。`);
    }
    if (!isDiscovered(discoveredTests, row)) {
      addIssue(issues, "error", "MAP-TM-009", ref, `${sliceId} 映射的 test-title 未被 runner list 发现。`);
    }
  }

  return summarize(issues);
}

function discoverRunnerTests(root, issues, runnerOutputs = null) {
  if (runnerOutputs) {
    return [
      ...parseVitestList(runnerOutputs.vitest ?? ""),
      ...parsePlaywrightList(runnerOutputs.playwright ?? ""),
    ];
  }
  const discovered = [];
  try {
    discovered.push(...parseVitestList(execFileSync("pnpm", ["exec", "vitest", "list"], { cwd: root, encoding: "utf8" })));
  } catch (error) {
    addIssue(issues, "error", "MAP-RUN-001", "vitest", `vitest list 执行失败：${error.message}`);
  }
  try {
    discovered.push(
      ...parsePlaywrightList(
        execFileSync("pnpm", ["exec", "playwright", "test", "--list"], { cwd: root, encoding: "utf8" }),
      ),
    );
  } catch (error) {
    addIssue(issues, "error", "MAP-RUN-002", "playwright", `playwright test --list 执行失败：${error.message}`);
  }
  return discovered;
}

export function parseVitestList(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes(" > "))
    .map((line) => {
      const parts = line.split(" > ");
      return { runner: "vitest", file: parts[0], title: parts.at(-1) };
    });
}

export function parsePlaywrightList(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("›"))
    .map((line) => {
      const parts = line.split("›").map((part) => part.trim());
      const file = parts[0]
        .replace(/^\[[^\]]+\]\s+/, "")
        .replace(/:\d+:\d+$/, "")
        .replace(/:\d+$/, "");
      return { runner: "playwright", file, title: parts.at(-1) };
    });
}

function isValidSingleSliceTitle(title, sliceId, row, slice) {
  const ids = unique(title.match(PROOF_SLICE_RE) ?? []);
  if (ids.length === 1 && ids[0] === sliceId && (title === sliceId || title.startsWith(`${sliceId} `) || title.startsWith(`${sliceId}:`))) {
    return true;
  }
  return hasMultiSliceWaiver(row, slice, ids, sliceId);
}

function hasMultiSliceWaiver(row, slice, titleSliceIds, sliceId) {
  const mapWaiver = row["multi-slice-waiver"];
  const contract = slice["test-contract"];
  const sliceWaiver = contract?.["multi-slice-waiver"];
  if (contract?.["allow-multi-slice-primary-test"] !== true) return false;
  if (!mapWaiver || typeof mapWaiver !== "object") return false;
  if (!sliceWaiver || typeof sliceWaiver !== "object") return false;
  const mapIds = idsFromArray(mapWaiver["slice-ids"]);
  const sliceIds = idsFromArray(sliceWaiver["slice-ids"]);
  return (
    mapIds.includes(sliceId) &&
    sliceIds.includes(sliceId) &&
    titleSliceIds.every((id) => mapIds.includes(id) && sliceIds.includes(id)) &&
    strip(mapWaiver.reason) &&
    strip(sliceWaiver.reason)
  );
}

function isDiscovered(discoveredTests, row) {
  const title = strip(row["test-title"]);
  const file = strip(row.file).replace(/\\/g, "/");
  const runner = strip(row.runner).toLowerCase();
  return discoveredTests.some((test) => {
    const discoveredFile = strip(test.file).replace(/\\/g, "/");
    const fileMatches =
      discoveredFile === file ||
      file.endsWith(discoveredFile) ||
      path.basename(file) === path.basename(discoveredFile);
    const runnerMatches = !runner || strip(test.runner).toLowerCase() === runner;
    return runnerMatches && fileMatches && strip(test.title) === title;
  });
}

function mapRowsWithIndex(rows) {
  return rows.map((row, index) => ({ row, index }));
}

function readJson(fullPath, root, issues, ruleId) {
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    addIssue(issues, "error", ruleId, path.relative(root, fullPath), `JSON 无法读取或解析：${error.message}`);
    return null;
  }
}

function idsFromArray(value) {
  return Array.isArray(value) ? value.map(strip).filter((id) => /^PS-\d{3}$/.test(id)) : [];
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function strip(value) {
  return String(value ?? "").replace(/`/g, "").trim();
}

function unique(values) {
  return [...new Set(values)];
}

function addIssue(issues, severity, ruleId, file, message) {
  issues.push({ severity, ruleId, file, message });
}

function summarize(issues) {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return { ok: errors.length === 0, errorCount: errors.length, warningCount: warnings.length, issues };
}

function parseCli(argv) {
  const options = { root: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--change") options.change = argv[++i];
    else if (arg === "--root") options.root = path.resolve(argv[++i]);
    else if (arg === "--json") options.json = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`未知参数：${arg}`);
  }
  return options;
}

function printHelp() {
  console.log(`Usage:
  node openspec/agent-runtime/scripts/audit-proof-test-mapping.mjs --change <slug> [--json]

Options:
  --change <slug>  OpenSpec change slug.
  --root <path>    Repository root.
  --json           Print machine-readable result.
`);
}

function printTextResult(result) {
  const status = result.ok ? "PASS" : "FAIL";
  console.log(`OpenSpec proof test mapping audit: ${status} (${result.errorCount} errors, ${result.warningCount} warnings)`);
  for (const issue of result.issues) {
    console.log(`[${issue.severity}] ${issue.ruleId} ${issue.file}: ${issue.message}`);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parseCli(process.argv.slice(2));
    if (options.help || !options.change) {
      printHelp();
      process.exit(options.help ? 0 : 2);
    }
    const result = auditProofTestMapping(options);
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else printTextResult(result);
    process.exit(result.errorCount > 0 ? 1 : 0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}
