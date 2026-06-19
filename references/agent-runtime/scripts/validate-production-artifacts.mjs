#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TRACE_SCHEMA = "openspec-trace-v1";
const RUNTIME_ROW_RE = /\b(?:RS|OP|ST|CH)-\d{3}\b/g;
const PROOF_SLICE_RE = /\bPS-\d{3}\b/g;
const AC_ID_RE = /\bAC-\d{3}\b/g;
const TASK_ID_RE = /\bAC-\d{3}\.\d+\b/g;
const GA_ID_RE = /\bGA-\d{4}\b/g;
const SI_ID_RE = /\bSI-\d{3}\b/g;
const KEBAB_KEY_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const PRIMITIVE_TYPES = new Set([
  "operation",
  "state",
  "failure",
  "negative-boundary",
  "layout",
  "observability",
  "fixture-variant",
  "authorization",
]);

const PRIMARY_LAYERS = new Set([
  "unit",
  "component",
  "route/API",
  "DB/integration",
  "contract",
  "worker/job",
  "realtime/SSE",
  "browser/e2e",
  "visual/responsive",
  "security/negative",
]);

const FORBIDDEN_ARTIFACT_FIELDS = [
  "Test Evidence Matrix",
  "Regression Test Deposit",
  "Test Layer Plan",
  "Fixed Command",
  "Test File / Name",
  "Evidence Directory",
  "Evidence Status",
  "Deposit Status",
  "Test IDs",
];

const TRACE_REQUIREMENTS = {
  proposal: {
    common: ["proposal-alignment-gate"],
    obligation: ["obligation-atom-preconditions", "change-atom-coverage-register", "source-window-read-set"],
    default: ["baseline-input-read-set", "change-scope-coverage"],
  },
  specs: {
    common: ["requirement-source-trace", "production-alignment-gate"],
  },
  design: {
    common: ["production-source-map", "design-obligation-matrix", "production-alignment-gate"],
  },
  "runtime-acceptance": {
    common: ["runtime-upstream-coverage-map", "runtime-coverage-source-map", "coverage-closure-checklist"],
  },
  verification: {
    common: ["runtime-coverage-reconciliation", "slice-consistency-checklist"],
  },
  tasks: {
    common: ["acceptance-driven-coverage", "runtime-acceptance-index", "runtime-acceptance-projection"],
  },
};

const PRODUCTION_WORDS_RE =
  /生产|实现|代码|schema|migration|API|domain|UI|auth|security|config|provider|observability|deployment|日志|脱敏|持久化|路由|组件|权限|配置|迁移/iu;
const PROOF_ONLY_AC_RE =
  /proof\s*closure|verification\s*closure|evidence\s*closure|coverage\s*closure|acceptance\s*closure|证明收束|验收证明|验证收束|证据收束|覆盖收束|闭合证明/iu;

const NON_ATOMIC_PATTERNS = [
  {
    id: "VAL-PS-401",
    label: "edit/add/delete",
    regex:
      /\bedit\b[\s\S]{0,60}\badd\b[\s\S]{0,60}\bdelete\b|\bedit\b[\s\S]{0,60}\bdelete\b[\s\S]{0,60}\badd\b|改名[\s\S]{0,40}补充[\s\S]{0,40}删除|改名[\s\S]{0,40}删除[\s\S]{0,40}补充|编辑[\s\S]{0,40}补充[\s\S]{0,40}删除|edit\/delete\/add|edit\/add\/delete/iu,
  },
  {
    id: "VAL-PS-402",
    label: "replay/mismatch",
    regex:
      /\breplay\b[\s\S]{0,50}\bmismatch\b|\bmismatch\b[\s\S]{0,50}\breplay\b|幂等[\s\S]{0,40}mismatch|replay\/mismatch/iu,
  },
  {
    id: "VAL-PS-403",
    label: "success/failure",
    regex:
      /\bsuccess\b[\s\S]{0,50}\bfailure\b|\bfailure\b[\s\S]{0,50}\bsuccess\b|成功[\s\S]{0,40}失败|success\/failure/iu,
  },
  {
    id: "VAL-PS-404",
    label: "provider failure variants",
    regex:
      /\bretryable\b[\s\S]{0,80}\bnon[-_ ]?retryable\b|\bnon[-_ ]?retryable\b[\s\S]{0,80}\bretryable\b|\bretryable\b[\s\S]{0,80}\bempty\b[\s\S]{0,80}\btimeout\b|可重试[\s\S]{0,50}不可重试|empty result[\s\S]{0,50}timeout/iu,
  },
  {
    id: "VAL-PS-405",
    label: "viewport variants",
    regex:
      /\bdesktop\b[\s\S]{0,80}\bmobile\b|\bnotebook\b[\s\S]{0,80}\bmobile\b|desktop\/notebook\/mobile|desktop\/mobile|mobile[\s\S]{0,40}notebook|多个 viewport|多档 viewport/iu,
  },
  {
    id: "VAL-PS-406",
    label: "log categories",
    regex:
      /日志类别|log categories|创建[\s\S]{0,80}覆盖[\s\S]{0,80}提取|extract\.success[\s\S]{0,80}extract\.failure|idempotency\.replay[\s\S]{0,80}idempotency\.mismatch/iu,
  },
  {
    id: "VAL-PS-407",
    label: "redaction categories",
    regex:
      /redaction 类别|脱敏类别|source_text[\s\S]{0,100}raw provider response|Brief item text[\s\S]{0,100}token|token[\s\S]{0,80}cookie[\s\S]{0,80}email|完整原文[\s\S]{0,80}raw response[\s\S]{0,80}token/iu,
  },
  {
    id: "VAL-PS-408",
    label: "auth/security branches",
    regex:
      /unauthenticated[\s\S]{0,80}foreign|foreign[\s\S]{0,80}deleted|匿名[\s\S]{0,40}跨用户|跨用户[\s\S]{0,40}软删除|多个 security branches|多个 auth\/security/iu,
  },
];

export function validateChange(options = {}) {
  const root = options.root ?? process.cwd();
  const change = options.change;
  if (!change) {
    throw new Error("validateChange requires a change slug");
  }

  const complete = Boolean(options.complete);
  const changeDir = path.join(root, "openspec", "changes", change);
  const issues = [];
  if (!fs.existsSync(changeDir)) {
    addIssue(issues, "error", "VAL-000", `openspec/changes/${change}`, "Change 目录不存在。");
    return summarize(issues);
  }

  const schemaName = readSchemaName(changeDir);
  const schemaKind = schemaName === "production-default-acceptance-driven" ? "default" : "obligation";
  const files = readChangeFiles(root, changeDir);
  const trace = loadTracePlane(root, changeDir, files, schemaKind, issues);

  if (complete) {
    for (const artifact of ["runtime-acceptance.md", "verification.md", "tasks.md"]) {
      if (!files.byName[artifact]) {
        addIssue(issues, "error", "VAL-001", artifact, "complete 校验要求 apply-required artifact 已存在。");
      }
    }
  }

  const runtimeRows = files.byName["runtime-acceptance.md"]
    ? validateRuntimeAcceptance(files.byName["runtime-acceptance.md"], trace.get("runtime-acceptance"), issues)
    : new Map();

  const proofSlices = files.byName["verification.md"]
    ? validateVerification(files.byName["verification.md"], runtimeRows, issues)
    : new Map();

  const taskModel = files.byName["tasks.md"]
    ? validateTasks(files.byName["tasks.md"], trace.get("tasks"), runtimeRows, issues)
    : { acSections: [], taskIds: new Set() };

  validateVerificationReconciliation(trace.get("verification"), proofSlices, runtimeRows, issues);
  validateSourceScopeTrace(trace, schemaKind, issues);
  validateRuntimeCoverageTrace(trace.get("runtime-acceptance"), runtimeRows, schemaKind, issues);
  validateTasksTrace(trace.get("tasks"), runtimeRows, taskModel, issues);

  return summarize(issues);
}

function readSchemaName(changeDir) {
  const yamlPath = path.join(changeDir, ".openspec.yaml");
  if (!fs.existsSync(yamlPath)) {
    return "";
  }
  const text = fs.readFileSync(yamlPath, "utf8");
  return text.match(/^schema:\s*(\S+)/m)?.[1] ?? "";
}

function readChangeFiles(root, changeDir) {
  const byName = {};
  const byArtifact = new Map();
  const all = [];
  for (const fullPath of walkFiles(changeDir).filter((file) => file.endsWith(".md"))) {
    const relPath = path.relative(changeDir, fullPath);
    const repoRelPath = path.relative(root, fullPath);
    const text = fs.readFileSync(fullPath, "utf8");
    const file = {
      name: path.basename(fullPath),
      artifactId: artifactIdForPath(relPath),
      relPath,
      repoRelPath,
      fullPath,
      text,
      lines: text.split(/\r?\n/),
    };
    all.push(file);
    byName[relPath] = file;
    if (!relPath.includes(path.sep)) {
      byName[file.name] = file;
    }
    byArtifact.set(file.artifactId === "specs" ? `specs:${specTraceName(relPath)}` : file.artifactId, file);
  }
  return { all, byName, byArtifact };
}

function artifactIdForPath(relPath) {
  if (relPath === "proposal.md") return "proposal";
  if (relPath === "design.md") return "design";
  if (relPath === "runtime-acceptance.md") return "runtime-acceptance";
  if (relPath === "verification.md") return "verification";
  if (relPath === "tasks.md") return "tasks";
  if (relPath.startsWith(`specs${path.sep}`) && relPath.endsWith(".md")) return "specs";
  return "unknown";
}

function specTraceName(relPath) {
  return relPath.replace(/^specs[\\/]/, "").replace(/[\\/]spec\.md$/, "").replace(/\.md$/, "");
}

function loadTracePlane(root, changeDir, files, schemaKind, issues) {
  const traces = new Map();
  const manifestPath = path.join(changeDir, "trace", "manifest.json");
  let manifest = null;
  if (!fs.existsSync(manifestPath)) {
    addIssue(issues, "error", "VAL-TR-001", path.relative(root, manifestPath), "缺少 trace/manifest.json。");
  } else {
    manifest = readJson(manifestPath, root, issues);
    if (manifest) {
      validateKebabKeys(manifest, "trace/manifest.json", issues);
      if (manifest["trace-schema"] !== TRACE_SCHEMA) {
        addIssue(issues, "error", "VAL-TR-002", "trace/manifest.json", `trace-schema 必须为 ${TRACE_SCHEMA}。`);
      }
    }
  }

  for (const file of files.all.filter((candidate) => candidate.artifactId !== "unknown")) {
    const pointer = parseTracePointer(file, issues);
    if (!pointer) {
      continue;
    }
    const tracePath = path.join(changeDir, pointer.path);
    const traceRel = path.relative(root, tracePath);
    if (!fs.existsSync(tracePath)) {
      addIssue(issues, "error", "VAL-TR-003", `${file.repoRelPath}`, `Trace file 不存在：${pointer.path}。`);
      continue;
    }
    const digest = sha256File(tracePath);
    if (pointer.digest !== digest) {
      addIssue(issues, "error", "VAL-TR-004", `${file.repoRelPath}`, `Trace digest 不匹配，应为 ${digest}。`);
    }
    const manifestEntry = findManifestEntry(manifest, file.relPath);
    if (!manifestEntry) {
      addIssue(issues, "error", "VAL-TR-005", "trace/manifest.json", `manifest 缺少 artifact ${file.relPath}。`);
    } else {
      if (manifestEntry["trace-path"] !== pointer.path) {
        addIssue(issues, "error", "VAL-TR-006", "trace/manifest.json", `${file.relPath} 的 trace-path 与 artifact pointer 不一致。`);
      }
      if (manifestEntry["trace-digest"] !== digest) {
        addIssue(issues, "error", "VAL-TR-007", "trace/manifest.json", `${file.relPath} 的 trace-digest 与实际文件不一致。`);
      }
    }
    const data = readJson(tracePath, root, issues);
    if (!data) {
      continue;
    }
    validateKebabKeys(data, traceRel, issues);
    if (data["trace-schema"] !== TRACE_SCHEMA) {
      addIssue(issues, "error", "VAL-TR-008", traceRel, `trace-schema 必须为 ${TRACE_SCHEMA}。`);
    }
    if (data["artifact-path"] && data["artifact-path"] !== file.relPath) {
      addIssue(issues, "error", "VAL-TR-009", traceRel, "artifact-path 与 artifact 实际路径不一致。");
    }
    validateTraceSections(data, file, schemaKind, traceRel, issues);
    traces.set(file.artifactId === "specs" ? `specs:${specTraceName(file.relPath)}` : file.artifactId, data);
  }
  return traces;
}

function findManifestEntry(manifest, artifactPath) {
  const artifacts = Array.isArray(manifest?.artifacts) ? manifest.artifacts : [];
  return artifacts.find((entry) => entry?.["artifact-path"] === artifactPath);
}

function parseTracePointer(file, issues) {
  const index = file.lines.findIndex((line) => line.trim() === "## Trace Appendix");
  if (index < 0) {
    addIssue(issues, "error", "VAL-TR-010", file.repoRelPath, "artifact 缺少 Trace Appendix 指针块。");
    return null;
  }
  const tail = file.lines.slice(index + 1).filter((line) => line.trim() !== "");
  if (tail.some((line) => /^#{3,6}\s+/.test(line.trim()) || isTableLine(line))) {
    addIssue(issues, "error", "VAL-TR-011", file.repoRelPath, "Trace Appendix 只能包含 JSON trace 指针，不得保留完整 Markdown trace 表格。");
  }
  const traceFile = tail.map((line) => line.match(/^Trace file:\s+`([^`]+)`\s*$/)?.[1]).find(Boolean);
  const traceSchema = tail.map((line) => line.match(/^Trace schema:\s+`([^`]+)`\s*$/)?.[1]).find(Boolean);
  const traceDigest = tail.map((line) => line.match(/^Trace digest:\s+`([^`]+)`\s*$/)?.[1]).find(Boolean);
  if (!traceFile || !traceSchema || !traceDigest) {
    addIssue(issues, "error", "VAL-TR-012", file.repoRelPath, "Trace Appendix 指针必须包含 Trace file/schema/digest。");
    return null;
  }
  if (traceSchema !== TRACE_SCHEMA) {
    addIssue(issues, "error", "VAL-TR-013", file.repoRelPath, `Trace schema 必须为 ${TRACE_SCHEMA}。`);
  }
  return { path: traceFile, schema: traceSchema, digest: traceDigest };
}

function validateTraceSections(data, file, schemaKind, traceRel, issues) {
  const requirements = TRACE_REQUIREMENTS[file.artifactId];
  if (!requirements) {
    return;
  }
  for (const key of requirements.common ?? []) {
    if (!(key in data)) {
      addIssue(issues, "error", "VAL-TR-014", traceRel, `缺少 trace section ${key}。`);
    }
  }
  const profileKeys = schemaKind === "default" ? requirements.default : requirements.obligation;
  for (const key of profileKeys ?? []) {
    if (!(key in data)) {
      addIssue(issues, "error", "VAL-TR-014", traceRel, `缺少 trace section ${key}。`);
    }
  }
}

function validateRuntimeAcceptance(file, trace, issues) {
  const requiredSections = [
    "## Runtime Acceptance Intent",
    "## Runtime Surface Inventory",
    "## Operation Coverage Matrix",
    "## State / Branch Coverage Matrix",
    "## Async / Realtime Chain Matrix",
    "## Trace Appendix",
  ];
  for (const section of requiredSections) {
    if (!file.text.includes(section)) {
      addIssue(issues, "error", "VAL-RA-001", file.repoRelPath, `缺少章节 ${section}。`);
    }
  }
  for (const forbidden of FORBIDDEN_ARTIFACT_FIELDS) {
    if (hasForbiddenField(file.lines, forbidden)) {
      addIssue(issues, "error", "VAL-RA-002", file.repoRelPath, `runtime-acceptance.md 不得包含 ${forbidden}。`);
    }
  }

  const rows = new Map();
  const tableHeadings = [
    "## Runtime Surface Inventory",
    "## Operation Coverage Matrix",
    "## State / Branch Coverage Matrix",
    "## Async / Realtime Chain Matrix",
  ];
  for (const heading of tableHeadings) {
    const table = getTableAfterHeading(file, heading);
    if (!table) {
      addIssue(issues, "error", "VAL-RA-003", file.repoRelPath, `缺少 ${heading} 表格。`);
      continue;
    }
    const scopeRoleIndex = table.headers.findIndex((header) => normalizeHeader(header) === "scope role");
    const ownerIndex = table.headers.findIndex((header) => normalizeHeader(header) === "owner candidate");
    for (const row of table.rows) {
      const id = strip(row.cells[0]);
      if (!/^(RS|OP|ST|CH)-\d{3}$/.test(id)) {
        continue;
      }
      if (rows.has(id)) {
        addIssue(issues, "error", "VAL-RA-004", `${file.repoRelPath}:${row.line}`, `runtime row ${id} 重复。`);
      }
      const owner = ownerIndex >= 0 ? strip(row.cells[ownerIndex]) : "";
      if (ownerIndex >= 0 && !owner) {
        addIssue(issues, "error", "VAL-RA-005", `${file.repoRelPath}:${row.line}`, `runtime row ${id} 缺少 Owner Candidate。`);
      }
      const scopeRole = scopeRoleIndex >= 0 ? strip(row.cells[scopeRoleIndex]) : "";
      if (!scopeRole) {
        addIssue(issues, "error", "VAL-RA-006", `${file.repoRelPath}:${row.line}`, `runtime row ${id} 缺少 Scope Role。`);
      }
      rows.set(id, { id, rowType: id.slice(0, 2), scopeRole, line: row.line });
    }
  }
  return rows;
}

function validateVerification(file, runtimeRows, issues) {
  const requiredSections = [
    "## Verification Intent",
    "## Proof Slice Matrix",
    "## Layer / Harness / Fixture Notes",
    "## Do Not Test",
    "## Trace Appendix",
  ];
  for (const section of requiredSections) {
    if (!file.text.includes(section)) {
      addIssue(issues, "error", "VAL-VF-001", file.repoRelPath, `缺少章节 ${section}。`);
    }
  }
  for (const forbidden of FORBIDDEN_ARTIFACT_FIELDS) {
    if (hasForbiddenField(file.lines, forbidden)) {
      addIssue(issues, "error", "VAL-VF-002", file.repoRelPath, `verification.md 不得包含 ${forbidden}。`);
    }
  }
  if (/(^|\s)(?:tests\/|test-results\/|openspec-results\/|\.test\.[cm]?[jt]sx?|\.spec\.[cm]?[jt]sx?)/iu.test(file.text)) {
    addIssue(issues, "error", "VAL-VF-003", file.repoRelPath, "verification.md 不得写入具体测试路径、测试文件名或 evidence/apply 产物路径。");
  }

  const table = getTableAfterHeading(file, "## Proof Slice Matrix");
  const slices = new Map();
  if (!table) {
    addIssue(issues, "error", "VAL-PS-001", file.repoRelPath, "缺少 Proof Slice Matrix 表格。");
    return slices;
  }

  const requiredColumns = [
    "Slice ID",
    "Runtime Row IDs",
    "Primary Runtime Row ID",
    "Primitive Type",
    "Branch / Variant",
    "Observable Surface",
    "Oracle Fragment",
    "Failure Signal",
    "Primary Layer",
    "Production Owner",
    "Primary Assertion Shape",
    "Fixture / Mock Boundary",
    "Regression Intent",
    "Manual / Environment Gate",
  ];
  const indexes = requireColumns(table, requiredColumns, file.repoRelPath, "VAL-PS-002", issues);
  if (!indexes) {
    return slices;
  }

  for (const row of table.rows) {
    const sliceId = strip(row.cells[indexes["Slice ID"]]);
    if (!/^PS-\d{3}$/.test(sliceId)) {
      continue;
    }
    if (slices.has(sliceId)) {
      addIssue(issues, "error", "VAL-PS-003", `${file.repoRelPath}:${row.line}`, `Proof Slice ${sliceId} 重复。`);
    }

    const runtimeRowIds = idsFromValue(row.cells[indexes["Runtime Row IDs"]], RUNTIME_ROW_RE);
    const primaryRowId = strip(row.cells[indexes["Primary Runtime Row ID"]]);
    const primitive = strip(row.cells[indexes["Primitive Type"]]);
    const layer = strip(row.cells[indexes["Primary Layer"]]);
    const owner = strip(row.cells[indexes["Production Owner"]]);
    const branch = strip(row.cells[indexes["Branch / Variant"]]);
    const oracle = strip(row.cells[indexes["Oracle Fragment"]]);
    const assertion = strip(row.cells[indexes["Primary Assertion Shape"]]);

    if (!runtimeRowIds.includes(primaryRowId)) {
      addIssue(issues, "error", "VAL-PS-004", `${file.repoRelPath}:${row.line}`, `${sliceId} 的 Primary Runtime Row ID 不在 Runtime Row IDs 中。`);
    }
    for (const runtimeRowId of runtimeRowIds) {
      if (runtimeRows.size > 0 && !runtimeRows.has(runtimeRowId)) {
        addIssue(issues, "error", "VAL-PS-005", `${file.repoRelPath}:${row.line}`, `${sliceId} 引用未定义 runtime row ${runtimeRowId}。`);
      }
    }
    if (!PRIMITIVE_TYPES.has(primitive)) {
      addIssue(issues, "error", "VAL-PS-006", `${file.repoRelPath}:${row.line}`, `${sliceId} Primitive Type 非法：${primitive || "(empty)"}。`);
    }
    if (!PRIMARY_LAYERS.has(layer)) {
      addIssue(issues, "error", "VAL-PS-007", `${file.repoRelPath}:${row.line}`, `${sliceId} Primary Layer 非法：${layer || "(empty)"}。`);
    }
    if (!owner || isOwnerListOrNonProduction(owner)) {
      addIssue(issues, "error", "VAL-PS-008", `${file.repoRelPath}:${row.line}`, `${sliceId} Production Owner 必须是单一 production owner token，不能是 owner list、测试路径或 evidence 路径。`);
    }

    const combined = [branch, oracle, assertion].join(" ");
    for (const pattern of NON_ATOMIC_PATTERNS) {
      if (pattern.regex.test(combined)) {
        addIssue(issues, "warning", pattern.id, `${file.repoRelPath}:${row.line}`, `${sliceId} 疑似聚合多个独立可失败分支：${pattern.label}。`);
      }
    }

    slices.set(sliceId, { id: sliceId, runtimeRowIds, primaryRowId, primitive, layer, owner, line: row.line });
  }
  return slices;
}

function validateVerificationReconciliation(trace, proofSlices, runtimeRows, issues) {
  if (!trace) {
    return;
  }
  const rows = asArray(trace["runtime-coverage-reconciliation"]);
  for (const [index, row] of rows.entries()) {
    const ref = traceRef("verification", "runtime-coverage-reconciliation", index);
    const runtimeRowId = strip(row["runtime-row-id"]);
    if (!/^(RS|OP|ST|CH)-\d{3}$/.test(runtimeRowId)) {
      addIssue(issues, "error", "VAL-RC-001", ref, "runtime-coverage-reconciliation row 缺少合法 runtime-row-id。");
      continue;
    }
    if (runtimeRows.size > 0 && !runtimeRows.has(runtimeRowId)) {
      addIssue(issues, "error", "VAL-RC-002", ref, `runtime-coverage-reconciliation 引用未定义 runtime row ${runtimeRowId}。`);
    }
    const expected = idsFromValue(row["expected-proof-slice-ids"], PROOF_SLICE_RE);
    const missing = idsFromValue(row["missing-proof-slice-ids"], PROOF_SLICE_RE);
    const status = strip(row["coverage-status"]).toLowerCase();
    for (const sliceId of expected) {
      if (!proofSlices.has(sliceId)) {
        addIssue(issues, "error", "VAL-RC-003", ref, `${runtimeRowId} expected slice ${sliceId} 不存在。`);
      }
    }
    if (status === "covered" && missing.length > 0) {
      addIssue(issues, "error", "VAL-RC-004", ref, `${runtimeRowId} 标记 covered 时 missing-proof-slice-ids 必须为空。`);
    }
    if (status === "covered" && expected.length === 0) {
      addIssue(issues, "error", "VAL-RC-005", ref, `${runtimeRowId} 标记 covered 但没有 expected-proof-slice-ids。`);
    }
  }
}

function validateTasks(file, trace, runtimeRows, issues) {
  for (const forbidden of FORBIDDEN_ARTIFACT_FIELDS) {
    if (hasForbiddenField(file.lines, forbidden)) {
      addIssue(issues, "error", "VAL-TS-001", file.repoRelPath, `tasks.md 不得包含 ${forbidden}。`);
    }
  }
  if (!/^## AC-\d{3}/m.test(file.text.trimStart())) {
    addIssue(issues, "error", "VAL-TS-002", file.repoRelPath, "tasks.md Delivery Plane 必须以 AC section 开始。");
  }
  if (!file.text.includes("## Trace Appendix")) {
    addIssue(issues, "error", "VAL-TS-003", file.repoRelPath, "tasks.md 缺少 Trace Appendix 指针块。");
  }
  for (const runtimeRowId of unique(file.text.match(RUNTIME_ROW_RE) ?? [])) {
    if (runtimeRows.size > 0 && !runtimeRows.has(runtimeRowId)) {
      addIssue(issues, "error", "VAL-TS-004", file.repoRelPath, `tasks.md 引用未定义 runtime row ${runtimeRowId}。`);
    }
  }

  const sections = splitAcSections(file);
  const taskIds = extractTaskIds(file.text);
  for (const section of sections) {
    validateAcSection(file, section, runtimeRows, issues);
  }
  return { acSections: sections, taskIds };
}

function validateAcSection(file, section, runtimeRows, issues) {
  const acRows = extractAcRuntimeRows(section.text);
  const contractTable = getTableAfterText(section.text, "Resolved Runtime Contract:", section.startLine);
  if (!contractTable) {
    addIssue(issues, "error", "VAL-AC-001", `${file.repoRelPath}:${section.startLine}`, `${section.id} 缺少 Resolved Runtime Contract 表。`);
    return;
  }

  const contractRows = contractTable.rows.map((row) => strip(row.cells[0])).filter((id) => /^(RS|OP|ST|CH)-\d{3}$/.test(id));
  const acRuntimeRows = acRows.filter((id) => /^(RS|OP|ST|CH)-\d{3}$/.test(id));
  if (!sameSet(contractRows, acRuntimeRows)) {
    addIssue(issues, "error", "VAL-AC-002", `${file.repoRelPath}:${section.startLine}`, `${section.id} 的 Resolved Runtime Contract row IDs 必须与 AC Runtime Rows 一致。`);
  }
  for (const runtimeRowId of acRuntimeRows) {
    if (runtimeRows.size > 0 && !runtimeRows.has(runtimeRowId)) {
      addIssue(issues, "error", "VAL-AC-003", `${file.repoRelPath}:${section.startLine}`, `${section.id} 引用未定义 runtime row ${runtimeRowId}。`);
    }
  }

  const proofOnlyRows = acRuntimeRows.filter((id) => runtimeRows.get(id)?.scopeRole?.toLowerCase().includes("proof-only"));
  if (acRuntimeRows.length > 0 && proofOnlyRows.length === acRuntimeRows.length) {
    const proofOnlySignal = getAcIntentText(section.text);
    if (PROOF_ONLY_AC_RE.test(proofOnlySignal) && !PRODUCTION_WORDS_RE.test(proofOnlySignal)) {
      addIssue(issues, "error", "VAL-AC-004", `${file.repoRelPath}:${section.startLine}`, `${section.id} 只承载 proof-only rows，且看起来是 proof/coverage closure AC。proof-only row 不得创建 proof-only AC/checkbox。`);
    }
  }
}

function validateSourceScopeTrace(trace, schemaKind, issues) {
  const proposal = trace.get("proposal");
  if (!proposal) {
    return;
  }
  const idRegex = schemaKind === "default" ? SI_ID_RE : GA_ID_RE;
  const idLabel = schemaKind === "default" ? "SI" : "GA";
  const registerKey = schemaKind === "default" ? "change-scope-coverage" : "change-atom-coverage-register";
  const registered = new Set();
  for (const [index, row] of asArray(proposal[registerKey]).entries()) {
    const ids = idsFromValue(schemaKind === "default" ? row["scope-item-id"] ?? row["global-atom-id"] : row["global-atom-id"], idRegex);
    if (ids.length !== 1) {
      addIssue(issues, "error", "VAL-SRC-001", traceRef("proposal", registerKey, index), `${registerKey} 每行必须包含一个 exact ${idLabel} ID。`);
      continue;
    }
    registered.add(ids[0]);
  }

  for (const [key, data] of trace.entries()) {
    if (key === "proposal") {
      continue;
    }
    const refs = collectIds(data, idRegex);
    for (const ref of refs) {
      if (!registered.has(ref.id)) {
        addIssue(issues, "error", "VAL-SRC-002", `${key}${ref.pointer}`, `${ref.id} 未在 proposal trace register 中登记。`);
      }
    }
  }
}

function validateRuntimeCoverageTrace(trace, runtimeRows, schemaKind, issues) {
  if (!trace) {
    return;
  }
  for (const [index, row] of asArray(trace["runtime-upstream-coverage-map"]).entries()) {
    const ref = traceRef("runtime-acceptance", "runtime-upstream-coverage-map", index);
    const mode = strip(row["coverage-mode"]).toLowerCase();
    const rowIds = idsFromValue(row["runtime-row-ids"], RUNTIME_ROW_RE);
    if (!mode.includes("not-applicable") && rowIds.length === 0) {
      addIssue(issues, "error", "VAL-RA-101", ref, "covered upstream item 必须映射到至少一个 runtime row。");
    }
    for (const rowId of rowIds) {
      if (runtimeRows.size > 0 && !runtimeRows.has(rowId)) {
        addIssue(issues, "error", "VAL-RA-102", ref, `runtime-upstream-coverage-map 引用未定义 runtime row ${rowId}。`);
      }
    }
  }
}

function validateTasksTrace(trace, runtimeRows, taskModel, issues) {
  if (!trace) {
    return;
  }
  const acById = new Map(taskModel.acSections.map((section) => [section.id, section]));
  const ownershipRows = asArray(trace["runtime-acceptance-index"]?.["ac-runtime-ownership-index"]);
  const graph = new Map();
  for (const [index, row] of ownershipRows.entries()) {
    const ref = traceRef("tasks", "runtime-acceptance-index/ac-runtime-ownership-index", index);
    const acId = strip(row["ac-id"]);
    if (!/^AC-\d{3}$/.test(acId) || !acById.has(acId)) {
      addIssue(issues, "error", "VAL-TS-101", ref, `AC Runtime Ownership Index 引用不存在的 AC：${acId || "(empty)"}。`);
      continue;
    }
    const detailRows = idsFromValue(row["detail-matrix-rows"], RUNTIME_ROW_RE);
    const acRows = extractAcRuntimeRows(acById.get(acId).text);
    if (!sameSet(detailRows, acRows)) {
      addIssue(issues, "error", "VAL-TS-102", ref, `${acId} trace detail-matrix-rows 必须与 Delivery Plane Runtime Rows 一致。`);
    }
    for (const rowId of detailRows) {
      if (runtimeRows.size > 0 && !runtimeRows.has(rowId)) {
        addIssue(issues, "error", "VAL-TS-103", ref, `${acId} trace 引用未定义 runtime row ${rowId}。`);
      }
    }
    const depends = idsFromValue(row["depends-on-ac-ids"], AC_ID_RE);
    graph.set(acId, depends);
    for (const dep of depends) {
      if (!acById.has(dep)) {
        addIssue(issues, "error", "VAL-TS-104", ref, `${acId} depends-on-ac-ids 引用不存在的 ${dep}。`);
      } else if (acById.get(dep).startLine > acById.get(acId).startLine) {
        addIssue(issues, "error", "VAL-TS-105", ref, `${acId} 依赖后置 AC ${dep}。`);
      }
    }
  }
  validateAcyclicGraph(graph, issues);

  const projectionRows = asArray(trace["runtime-acceptance-projection"]?.["runtime-row-ownership-projection"]);
  for (const [index, row] of projectionRows.entries()) {
    const ref = traceRef("tasks", "runtime-acceptance-projection/runtime-row-ownership-projection", index);
    const runtimeRowId = strip(row["runtime-row-id"]);
    if (/^(RS|OP|ST|CH)-\d{3}$/.test(runtimeRowId) && runtimeRows.size > 0 && !runtimeRows.has(runtimeRowId)) {
      addIssue(issues, "error", "VAL-TS-106", ref, `Runtime Row Ownership Projection 引用未定义 runtime row ${runtimeRowId}。`);
    }
    for (const taskId of idsFromValue(row["implementation-task-ids"], TASK_ID_RE)) {
      if (!taskModel.taskIds.has(taskId)) {
        addIssue(issues, "error", "VAL-TS-107", ref, `Implementation Task ID ${taskId} 无法解析到 checkbox。`);
      }
    }
    for (const dep of idsFromValue(row["depends-on-ac-ids"], AC_ID_RE)) {
      if (!acById.has(dep)) {
        addIssue(issues, "error", "VAL-TS-108", ref, `Runtime Row Ownership Projection depends-on-ac-ids 引用不存在的 ${dep}。`);
      }
    }
  }
}

function validateAcyclicGraph(graph, issues) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  function visit(node) {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      const cycle = [...stack.slice(stack.indexOf(node)), node].join(" -> ");
      addIssue(issues, "error", "VAL-TS-109", "trace/tasks.trace.json", `AC dependency graph 存在循环：${cycle}。`);
      return;
    }
    visiting.add(node);
    stack.push(node);
    for (const dep of graph.get(node) ?? []) {
      if (graph.has(dep)) visit(dep);
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }
  for (const node of graph.keys()) visit(node);
}

function getAcIntentText(text) {
  const heading = text.split(/\r?\n/, 1)[0] ?? "";
  const outcome = extractNamedBlock(text, "Outcome:");
  const implementationScope = extractNamedBlock(text, "Implementation Scope:");
  const checkboxTitles = [...text.matchAll(/^\s*-\s+\[[ xX]\]\s+(.+)$/gm)].map((match) => match[1]).join("\n");
  return [heading, outcome, implementationScope, checkboxTitles].join("\n");
}

function extractNamedBlock(text, fieldName) {
  const start = text.indexOf(fieldName);
  if (start < 0) return "";
  const after = start + fieldName.length;
  const rest = text.slice(after);
  const nextField = rest.search(/\n(?:Start Gate|Runtime Rows|Resolved Runtime Contract|Implementation Scope|Preserve|Proof Contract):/);
  return nextField >= 0 ? rest.slice(0, nextField) : rest;
}

function getTableAfterHeading(file, heading) {
  const headingIndex = file.lines.findIndex((line) => line.trim() === heading);
  if (headingIndex < 0) return null;
  return getFirstTable(file.lines, headingIndex + 1, 1);
}

function getTableAfterText(text, marker, startLine) {
  const lines = text.split(/\r?\n/);
  const markerIndex = lines.findIndex((line) => line.trim() === marker);
  if (markerIndex < 0) return null;
  return getFirstTable(lines, markerIndex + 1, startLine);
}

function getFirstTable(lines, fromIndex, baseLine) {
  for (let i = fromIndex; i < lines.length - 1; i += 1) {
    if (!isTableLine(lines[i]) || !isSeparatorLine(lines[i + 1])) continue;
    const headers = splitTableRow(lines[i]);
    const rows = [];
    let j = i + 2;
    while (j < lines.length && isTableLine(lines[j])) {
      const cells = splitTableRow(lines[j]);
      if (cells.length === headers.length) rows.push({ cells, line: baseLine + j });
      j += 1;
    }
    return { headers, rows, line: baseLine + i };
  }
  return null;
}

function splitAcSections(file) {
  const sections = [];
  let current = null;
  for (let i = 0; i < file.lines.length; i += 1) {
    const match = file.lines[i].match(/^## (AC-\d{3})\b/);
    if (match) {
      if (current) {
        current.text = file.lines.slice(current.startIndex, i).join("\n");
        sections.push(current);
      }
      current = { id: match[1], startIndex: i, startLine: i + 1, text: "" };
      continue;
    }
    if (current && /^## Trace Appendix\b/.test(file.lines[i])) {
      current.text = file.lines.slice(current.startIndex, i).join("\n");
      sections.push(current);
      current = null;
      break;
    }
  }
  if (current) {
    current.text = file.lines.slice(current.startIndex).join("\n");
    sections.push(current);
  }
  return sections;
}

function extractAcRuntimeRows(text) {
  const marker = text.indexOf("Runtime Rows:");
  if (marker < 0) return [];
  const endMarkers = [
    text.indexOf("Resolved Runtime Contract:", marker),
    text.indexOf("Implementation Scope:", marker),
    text.indexOf("Preserve:", marker),
  ].filter((index) => index > marker);
  const end = endMarkers.length > 0 ? Math.min(...endMarkers) : marker + 500;
  return unique(text.slice(marker, end).match(RUNTIME_ROW_RE) ?? []);
}

function extractTaskIds(text) {
  return new Set([...text.matchAll(/^\s*-\s+\[[ xX]\]\s+(AC-\d{3}\.\d+)\b/gm)].map((match) => match[1]));
}

function requireColumns(table, requiredColumns, fileRef, ruleId, issues) {
  const indexByHeader = {};
  for (const required of requiredColumns) {
    const found = table.headers.findIndex((header) => normalizeHeader(header) === normalizeHeader(required));
    if (found < 0) {
      addIssue(issues, "error", ruleId, `${fileRef}:${table.line}`, `表格缺少列 ${required}。`);
      return null;
    }
    indexByHeader[required] = found;
  }
  return indexByHeader;
}

function readJson(fullPath, root, issues) {
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    addIssue(issues, "error", "VAL-TR-015", path.relative(root, fullPath), `JSON 无法解析：${error.message}`);
    return null;
  }
}

function validateKebabKeys(value, location, issues, pointer = "") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateKebabKeys(item, location, issues, `${pointer}/${index}`));
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (!KEBAB_KEY_RE.test(key)) {
      addIssue(issues, "error", "VAL-TR-016", `${location}${pointer}/${key}`, "JSON trace key 必须使用 kebab-case。");
    }
    validateKebabKeys(child, location, issues, `${pointer}/${key}`);
  }
}

function collectIds(value, regex, pointer = "") {
  const result = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => result.push(...collectIds(item, regex, `${pointer}/${index}`)));
    return result;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      result.push(...collectIds(child, regex, `${pointer}/${key}`));
    }
    return result;
  }
  for (const id of idsFromValue(value, regex)) {
    result.push({ id, pointer });
  }
  return result;
}

function sha256File(fullPath) {
  const hash = crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex");
  return `sha256-${hash}`;
}

function walkFiles(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walkFiles(fullPath));
    else result.push(fullPath);
  }
  return result;
}

function isTableLine(line) {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isSeparatorLine(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function normalizeHeader(value) {
  return strip(value).toLowerCase().replace(/\s+/g, " ");
}

function idsFromValue(value, regex) {
  if (Array.isArray(value)) return unique(value.flatMap((item) => idsFromValue(item, regex)));
  return unique(strip(value).match(regex) ?? []);
}

function strip(value) {
  return String(value ?? "").replace(/<!--[\s\S]*?-->/g, "").replace(/`/g, "").trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(values)];
}

function sameSet(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

function isOwnerListOrNonProduction(owner) {
  if (/tests?\/|openspec-results|test-results|evidence|runner|vitest|playwright|\.test\.|\.spec\./iu.test(owner)) return true;
  if (/[,，;+]|(?:^|\s)(?:and|和|与)(?:\s|$)/iu.test(owner)) return true;
  if ((owner.match(/`/g) ?? []).length > 2) return true;
  if (/\s{2,}/.test(owner)) return true;
  return false;
}

function hasForbiddenField(lines, fieldName) {
  const escaped = escapeRegExp(fieldName);
  const headingRe = new RegExp(`^#{1,6}\\s+${escaped}\\b`, "iu");
  const fieldRe = new RegExp(`^\\s*${escaped}\\s*:`, "iu");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (headingRe.test(line) || fieldRe.test(line)) return true;
    if (line.includes(fieldName) && isTableLine(line) && isSeparatorLine(lines[index + 1] ?? "")) return true;
  }
  return false;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function traceRef(artifact, section, index) {
  return `trace/${artifact}.trace.json#/${section}/${index}`;
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
  const options = { root: process.cwd(), complete: false, json: false, strictWarnings: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--change") options.change = argv[++i];
    else if (arg === "--root") options.root = path.resolve(argv[++i]);
    else if (arg === "--complete" || arg === "--final") options.complete = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--strict-warnings") options.strictWarnings = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`未知参数：${arg}`);
  }
  return options;
}

function printHelp() {
  console.log(`Usage:
  node openspec/agent-runtime/scripts/validate-production-artifacts.mjs --change <slug> [--complete] [--json] [--strict-warnings]

Options:
  --change <slug>     OpenSpec change slug under openspec/changes.
  --complete          Require apply-required artifacts: runtime-acceptance.md, verification.md, tasks.md.
  --json              Print machine-readable result.
  --strict-warnings   Exit non-zero when warnings are present.
`);
}

function printTextResult(result) {
  const status = result.ok ? "PASS" : "FAIL";
  console.log(`OpenSpec artifact validation: ${status} (${result.errorCount} errors, ${result.warningCount} warnings)`);
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
    const result = validateChange(options);
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else printTextResult(result);
    process.exit(result.errorCount > 0 || (options.strictWarnings && result.warningCount > 0) ? 1 : 0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}
