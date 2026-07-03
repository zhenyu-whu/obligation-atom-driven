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
    addError(
      ctx,
      "VAL-COMPLETE-001",
      rel(ctx, ctx.changeDir),
      "complete validator 尚未实现；当前已拆分 artifact validators，现阶段只注册 proposal/specs/design/runtime-acceptance/verification/tasks partial validators。",
    );
  }

  return resultFor(ctx);
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
