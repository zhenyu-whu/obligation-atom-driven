#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateProposalArtifact } from "./validators/validate-proposal-artifact.mjs";
import { validateSpecsArtifact } from "./validators/validate-specs-artifact.mjs";
import { validateDesignArtifact } from "./validators/validate-design-artifact.mjs";
import { validateRuntimeAcceptanceArtifact } from "./validators/validate-runtime-acceptance-artifact.mjs";
import { validateVerificationArtifact } from "./validators/validate-verification-artifact.mjs";
import { validateTasksArtifact } from "./validators/validate-tasks-artifact.mjs";

const ARTIFACT_VALIDATORS = [
  {
    artifactId: "proposal",
    validate: validateProposalArtifact,
  },
  {
    artifactId: "specs",
    validate: validateSpecsArtifact,
  },
  {
    artifactId: "design",
    validate: validateDesignArtifact,
  },
  {
    artifactId: "runtime-acceptance",
    validate: validateRuntimeAcceptanceArtifact,
  },
  {
    artifactId: "verification",
    validate: validateVerificationArtifact,
  },
  {
    artifactId: "tasks",
    validate: validateTasksArtifact,
  },
];

const COMPLETE_REQUIRED_ARTIFACTS = [
  {
    artifactId: "runtime-acceptance",
    tracePath: "trace/runtime-acceptance.trace.json",
  },
  {
    artifactId: "verification",
    tracePath: "trace/verification.trace.json",
  },
  {
    artifactId: "tasks",
    tracePath: "trace/tasks.trace.json",
  },
];

export function validateChange(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const change = strip(options.change);
  const complete = Boolean(options.complete);
  const artifactFilter = strip(options.artifact);
  const ctx = {
    root,
    change,
    changeDir: path.join(root, "openspec", "changes", change),
    errors: [],
    warnings: [],
  };

  if (!change) {
    addError(ctx, "VAL-CLI-001", ".", "缺少 --change <slug>。");
    return resultFor(ctx);
  }

  if (!fs.existsSync(ctx.changeDir)) {
    addError(ctx, "VAL-CHANGE-001", rel(ctx, ctx.changeDir), `change 目录不存在：${ctx.changeDir}`);
    return resultFor(ctx);
  }

  const validators = artifactFilter
    ? ARTIFACT_VALIDATORS.filter((item) => item.artifactId === artifactFilter)
    : ARTIFACT_VALIDATORS;

  if (artifactFilter && validators.length === 0) {
    addError(ctx, "VAL-CLI-002", ".", `尚未注册 artifact validator：${artifactFilter}`);
    return resultFor(ctx);
  }

  for (const validator of validators) {
    mergeResult(ctx, validator.validate({ root, change }));
  }

  if (complete) {
    validateCompleteChange(ctx);
  }

  return resultFor(ctx);
}

function validateCompleteChange(ctx) {
  for (const artifact of COMPLETE_REQUIRED_ARTIFACTS) {
    const traceFullPath = path.join(ctx.changeDir, artifact.tracePath);

    if (!fs.existsSync(traceFullPath)) {
      addError(ctx, "VAL-COMPLETE-TRACE-001", artifact.tracePath, `complete validation 要求 apply-required trace 存在：${artifact.artifactId}`);
    }
  }

  const runtimeTrace = readJson(ctx, path.join(ctx.changeDir, "trace", "runtime-acceptance.trace.json"));
  const verificationTrace = readJson(ctx, path.join(ctx.changeDir, "trace", "verification.trace.json"));
  const tasksTrace = readJson(ctx, path.join(ctx.changeDir, "trace", "tasks.trace.json"));

  if (!runtimeTrace || !verificationTrace || !tasksTrace) return;

  const runtimeRowIds = collectRuntimeRowIds(runtimeTrace);
  const targetRuntimeRowIds = collectRuntimeRowIds(runtimeTrace, { targetOnly: true });
  if (runtimeRowIds.length === 0) {
    addError(ctx, "VAL-COMPLETE-RUNTIME-001", "trace/runtime-acceptance.trace.json", "complete validation 要求 runtime-acceptance 定义 runtime facts。");
  }

  const verificationSlices = verificationTrace["verification-slice-register"];
  if (!Array.isArray(verificationSlices) || verificationSlices.length === 0) {
    addError(ctx, "VAL-COMPLETE-VERIFICATION-001", "trace/verification.trace.json", "complete validation 要求 verification-slice-register[]。");
  }

  const verificationRowIds = new Set(
    asArray(verificationSlices)
      .flatMap((row) => asArray(row?.["runtime-fact-ids"]).map(strip).filter(Boolean)),
  );
  const taskRuntimeRowIds = collectTaskRuntimeClosureIds(tasksTrace, runtimeTrace);

  validateSameIdSet(ctx, {
    rulePrefix: "VAL-COMPLETE-VERIFICATION-ROWS",
    file: "trace/verification.trace.json",
    expectedIds: runtimeRowIds,
    actualIds: verificationRowIds,
    description: "verification-slice-register runtime-fact coverage",
  });
  validateSameIdSet(ctx, {
    rulePrefix: "VAL-COMPLETE-TASKS-ROWS",
    file: "trace/tasks.trace.json",
    expectedIds: targetRuntimeRowIds,
    actualIds: taskRuntimeRowIds,
    description: "tasks checkbox runtime-fact closure",
  });
}

function collectRuntimeRowIds(runtimeTrace, options = {}) {
  return asArray(runtimeTrace["runtime-fact-register"])
    .filter((row) => {
      if (!options.targetOnly) return true;
      const scopeRole = strip(row?.["scope-role"]);
      return scopeRole === "required behavior" || scopeRole === "preserve boundary";
    })
    .map((row) => strip(row?.["runtime-fact-id"]))
    .filter(Boolean);
}

function collectTaskRuntimeClosureIds(tasksTrace, runtimeTrace) {
  const targetRows = collectTargetRuntimeRowsById(runtimeTrace);
  const ids = [];
  for (const step of asArray(tasksTrace["implementation-step-register"])) {
    for (const task of asArray(step?.tasks)) {
      for (const link of asArray(task?.["runtime-fact-links"])) {
        const contribution = strip(link?.contribution);
        const id = strip(link?.["runtime-fact-id"]);
        if (!id || (contribution !== "completes" && contribution !== "enforces")) continue;
        const scopeRole = targetRows.get(id);
        if (!scopeRole) {
          ids.push(id);
        } else if (scopeRole === "required behavior" && contribution === "completes") {
          ids.push(id);
        } else if (scopeRole === "preserve boundary" && contribution === "enforces") {
          ids.push(id);
        }
      }
    }
  }
  return new Set(ids.filter(Boolean));
}

function collectTargetRuntimeRowsById(runtimeTrace) {
  const rows = new Map();
  for (const row of asArray(runtimeTrace["runtime-fact-register"])) {
    const id = strip(row?.["runtime-fact-id"]);
    const scopeRole = strip(row?.["scope-role"]);
    if (id && (scopeRole === "required behavior" || scopeRole === "preserve boundary")) {
      rows.set(id, scopeRole);
    }
  }
  return rows;
}

function validateSameIdSet(ctx, config) {
  const expected = new Set(config.expectedIds);
  const missing = [...expected].filter((id) => !config.actualIds.has(id));
  const extra = [...config.actualIds].filter((id) => !expected.has(id));

  if (missing.length > 0) {
    addError(ctx, `${config.rulePrefix}-001`, config.file, `${config.description} 缺少 runtime facts：${missing.join(", ")}`);
  }
  if (extra.length > 0) {
    addError(ctx, `${config.rulePrefix}-002`, config.file, `${config.description} 引用了未定义 runtime facts：${extra.join(", ")}`);
  }
}

function readJson(ctx, fullPath) {
  if (!fs.existsSync(fullPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    addError(ctx, "VAL-COMPLETE-JSON-001", rel(ctx, fullPath), `无法解析 JSON：${error.message}`);
    return null;
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function mergeResult(ctx, result) {
  ctx.errors.push(...result.errors);
  ctx.warnings.push(...result.warnings);
}

function addError(ctx, ruleId, file, message) {
  ctx.errors.push({ level: "error", ruleId, file, message });
}

function resultFor(ctx) {
  return {
    ok: ctx.errors.length === 0,
    errors: ctx.errors,
    warnings: ctx.warnings,
  };
}

function formatResult(result, options = {}) {
  const target = options.artifact ? ` --artifact ${options.artifact}` : "";
  const lines = [];
  lines.push(`${result.ok ? "PASS" : "FAIL"} validate-production-artifacts${options.change ? ` --change ${options.change}` : ""}${target}`);
  if (result.errors.length > 0) {
    lines.push("");
    lines.push("Errors:");
    for (const item of result.errors) {
      lines.push(`- ${item.ruleId} ${item.file}: ${item.message}`);
    }
  }
  if (result.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const item of result.warnings) {
      lines.push(`- ${item.ruleId} ${item.file}: ${item.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--change") options.change = argv[++index];
    else if (arg === "--root") options.root = argv[++index];
    else if (arg === "--artifact") options.artifact = argv[++index];
    else if (arg === "--complete") options.complete = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function usage() {
  return `Usage:
  node openspec/agent-runtime/scripts/validate-production-artifacts.mjs --change <slug> [--artifact <id>] [--complete] [--root <path>]

Registered artifact validators:
  proposal
  specs
  design
  runtime-acceptance
  verification
  tasks
`;
}

function rel(ctx, fullPath) {
  return path.relative(ctx.root, fullPath) || ".";
}

function strip(value) {
  return String(value ?? "").trim();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      process.exit(0);
    }
    const result = validateChange(options);
    process.stdout.write(formatResult(result, options));
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
