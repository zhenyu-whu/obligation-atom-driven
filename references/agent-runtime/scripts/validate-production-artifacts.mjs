#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RUNTIME_ROW_RE = /\b(?:RS|OP|ST|CH)-\d{3}\b/g;
const PROOF_SLICE_RE = /\bPS-\d{3}\b/g;

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
  const files = readChangeFiles(changeDir);
  const issues = [];

  if (!fs.existsSync(changeDir)) {
    addIssue(
      issues,
      "error",
      "VAL-000",
      `openspec/changes/${change}`,
      "Change 目录不存在。",
    );
    return summarize(issues);
  }

  if (complete) {
    for (const artifact of [
      "runtime-acceptance.md",
      "verification.md",
      "tasks.md",
    ]) {
      if (!files[artifact]) {
        addIssue(
          issues,
          "error",
          "VAL-001",
          artifact,
          "complete 校验要求 apply-required artifact 已存在。",
        );
      }
    }
  }

  const runtimeRows = files["runtime-acceptance.md"]
    ? validateRuntimeAcceptance(files["runtime-acceptance.md"], issues)
    : new Map();

  const proofSlices = files["verification.md"]
    ? validateVerification(files["verification.md"], runtimeRows, issues)
    : new Map();

  if (files["tasks.md"]) {
    validateTasks(files["tasks.md"], runtimeRows, issues);
  }

  if (files["verification.md"]) {
    validateVerificationReconciliation(
      files["verification.md"],
      proofSlices,
      runtimeRows,
      issues,
    );
  }

  return summarize(issues);
}

function readChangeFiles(changeDir) {
  const result = {};
  for (const name of ["runtime-acceptance.md", "verification.md", "tasks.md"]) {
    const fullPath = path.join(changeDir, name);
    if (fs.existsSync(fullPath)) {
      result[name] = {
        name,
        fullPath,
        relPath: path.relative(process.cwd(), fullPath),
        text: fs.readFileSync(fullPath, "utf8"),
        lines: fs.readFileSync(fullPath, "utf8").split(/\r?\n/),
      };
    }
  }
  return result;
}

function validateRuntimeAcceptance(file, issues) {
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
      addIssue(
        issues,
        "error",
        "VAL-RA-001",
        file.relPath,
        `缺少章节 ${section}。`,
      );
    }
  }
  for (const forbidden of FORBIDDEN_ARTIFACT_FIELDS) {
    if (hasForbiddenField(file.lines, forbidden)) {
      addIssue(
        issues,
        "error",
        "VAL-RA-002",
        file.relPath,
        `runtime-acceptance.md 不得包含 ${forbidden}。`,
      );
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
      addIssue(
        issues,
        "error",
        "VAL-RA-003",
        file.relPath,
        `缺少 ${heading} 表格。`,
      );
      continue;
    }
    const scopeRoleIndex = table.headers.findIndex(
      (header) => normalizeHeader(header) === "scope role",
    );
    const ownerIndex = table.headers.findIndex(
      (header) => normalizeHeader(header) === "owner candidate",
    );
    for (const row of table.rows) {
      const id = strip(row.cells[0]);
      if (!/^(RS|OP|ST|CH)-\d{3}$/.test(id)) {
        continue;
      }
      if (rows.has(id)) {
        addIssue(
          issues,
          "error",
          "VAL-RA-004",
          `${file.relPath}:${row.line}`,
          `runtime row ${id} 重复。`,
        );
      }
      const owner = ownerIndex >= 0 ? strip(row.cells[ownerIndex]) : "";
      if (ownerIndex >= 0 && !owner) {
        addIssue(
          issues,
          "error",
          "VAL-RA-005",
          `${file.relPath}:${row.line}`,
          `runtime row ${id} 缺少 Owner Candidate。`,
        );
      }
      const scopeRole =
        scopeRoleIndex >= 0 ? strip(row.cells[scopeRoleIndex]) : "";
      if (!scopeRole) {
        addIssue(
          issues,
          "error",
          "VAL-RA-006",
          `${file.relPath}:${row.line}`,
          `runtime row ${id} 缺少 Scope Role。`,
        );
      }
      rows.set(id, {
        id,
        rowType: id.slice(0, 2),
        scopeRole,
        line: row.line,
      });
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
    "### Runtime Coverage Reconciliation",
    "### Slice Consistency Checklist",
  ];
  for (const section of requiredSections) {
    if (!file.text.includes(section)) {
      addIssue(
        issues,
        "error",
        "VAL-VF-001",
        file.relPath,
        `缺少章节 ${section}。`,
      );
    }
  }
  for (const forbidden of FORBIDDEN_ARTIFACT_FIELDS) {
    if (hasForbiddenField(file.lines, forbidden)) {
      addIssue(
        issues,
        "error",
        "VAL-VF-002",
        file.relPath,
        `verification.md 不得包含 ${forbidden}。`,
      );
    }
  }
  if (
    /(^|\s)(?:tests\/|test-results\/|openspec-results\/|\.test\.[cm]?[jt]sx?|\.spec\.[cm]?[jt]sx?)/iu.test(
      file.text,
    )
  ) {
    addIssue(
      issues,
      "error",
      "VAL-VF-003",
      file.relPath,
      "verification.md 不得写入具体测试路径、测试文件名或 evidence/apply 产物路径。",
    );
  }

  const table = getTableAfterHeading(file, "## Proof Slice Matrix");
  const slices = new Map();
  if (!table) {
    addIssue(
      issues,
      "error",
      "VAL-PS-001",
      file.relPath,
      "缺少 Proof Slice Matrix 表格。",
    );
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
  const indexes = requireColumns(
    table,
    requiredColumns,
    file.relPath,
    "VAL-PS-002",
    issues,
  );
  if (!indexes) {
    return slices;
  }

  for (const row of table.rows) {
    const sliceId = strip(row.cells[indexes["Slice ID"]]);
    if (!/^PS-\d{3}$/.test(sliceId)) {
      continue;
    }
    if (slices.has(sliceId)) {
      addIssue(
        issues,
        "error",
        "VAL-PS-003",
        `${file.relPath}:${row.line}`,
        `Proof Slice ${sliceId} 重复。`,
      );
    }

    const runtimeRowIds = idsFromCell(
      row.cells[indexes["Runtime Row IDs"]],
      RUNTIME_ROW_RE,
    );
    const primaryRowId = strip(row.cells[indexes["Primary Runtime Row ID"]]);
    const primitive = strip(row.cells[indexes["Primitive Type"]]);
    const layer = strip(row.cells[indexes["Primary Layer"]]);
    const owner = strip(row.cells[indexes["Production Owner"]]);
    const branch = strip(row.cells[indexes["Branch / Variant"]]);
    const oracle = strip(row.cells[indexes["Oracle Fragment"]]);
    const assertion = strip(row.cells[indexes["Primary Assertion Shape"]]);

    if (!runtimeRowIds.includes(primaryRowId)) {
      addIssue(
        issues,
        "error",
        "VAL-PS-004",
        `${file.relPath}:${row.line}`,
        `${sliceId} 的 Primary Runtime Row ID 不在 Runtime Row IDs 中。`,
      );
    }
    for (const runtimeRowId of runtimeRowIds) {
      if (runtimeRows.size > 0 && !runtimeRows.has(runtimeRowId)) {
        addIssue(
          issues,
          "error",
          "VAL-PS-005",
          `${file.relPath}:${row.line}`,
          `${sliceId} 引用未定义 runtime row ${runtimeRowId}。`,
        );
      }
    }
    if (!PRIMITIVE_TYPES.has(primitive)) {
      addIssue(
        issues,
        "error",
        "VAL-PS-006",
        `${file.relPath}:${row.line}`,
        `${sliceId} Primitive Type 非法：${primitive || "(empty)"}。`,
      );
    }
    if (!PRIMARY_LAYERS.has(layer)) {
      addIssue(
        issues,
        "error",
        "VAL-PS-007",
        `${file.relPath}:${row.line}`,
        `${sliceId} Primary Layer 非法：${layer || "(empty)"}。`,
      );
    }
    if (!owner || isOwnerListOrNonProduction(owner)) {
      addIssue(
        issues,
        "error",
        "VAL-PS-008",
        `${file.relPath}:${row.line}`,
        `${sliceId} Production Owner 必须是单一 production owner token，不能是 owner list、测试路径或 evidence 路径。`,
      );
    }

    const combined = [branch, oracle, assertion].join(" ");
    for (const pattern of NON_ATOMIC_PATTERNS) {
      if (pattern.regex.test(combined)) {
        addIssue(
          issues,
          "warning",
          pattern.id,
          `${file.relPath}:${row.line}`,
          `${sliceId} 疑似聚合多个独立可失败分支：${pattern.label}。`,
        );
      }
    }

    slices.set(sliceId, {
      id: sliceId,
      runtimeRowIds,
      primaryRowId,
      primitive,
      layer,
      owner,
      line: row.line,
    });
  }

  return slices;
}

function validateVerificationReconciliation(
  file,
  proofSlices,
  runtimeRows,
  issues,
) {
  const table = getTableAfterHeading(
    file,
    "### Runtime Coverage Reconciliation",
  );
  if (!table) {
    return;
  }
  const requiredColumns = [
    "Runtime Row ID",
    "Row Type",
    "Scope Role",
    "Expected Proof Slice IDs",
    "Missing Proof Slice IDs",
    "Coverage Status",
    "Gap / Not-Covered Reason",
  ];
  const indexes = requireColumns(
    table,
    requiredColumns,
    file.relPath,
    "VAL-RC-001",
    issues,
  );
  if (!indexes) {
    return;
  }

  for (const row of table.rows) {
    const runtimeRowId = strip(row.cells[indexes["Runtime Row ID"]]);
    if (!/^(RS|OP|ST|CH)-\d{3}$/.test(runtimeRowId)) {
      continue;
    }
    if (runtimeRows.size > 0 && !runtimeRows.has(runtimeRowId)) {
      addIssue(
        issues,
        "error",
        "VAL-RC-002",
        `${file.relPath}:${row.line}`,
        `Runtime Coverage Reconciliation 引用未定义 runtime row ${runtimeRowId}。`,
      );
    }
    const expected = idsFromCell(
      row.cells[indexes["Expected Proof Slice IDs"]],
      PROOF_SLICE_RE,
    );
    const missing = strip(row.cells[indexes["Missing Proof Slice IDs"]]);
    const status = strip(row.cells[indexes["Coverage Status"]]).toLowerCase();
    for (const sliceId of expected) {
      if (!proofSlices.has(sliceId)) {
        addIssue(
          issues,
          "error",
          "VAL-RC-003",
          `${file.relPath}:${row.line}`,
          `${runtimeRowId} expected slice ${sliceId} 不存在。`,
        );
      }
    }
    if (status === "covered" && missing !== "None") {
      addIssue(
        issues,
        "error",
        "VAL-RC-004",
        `${file.relPath}:${row.line}`,
        `${runtimeRowId} 标记 covered 时 Missing Proof Slice IDs 必须为 None。`,
      );
    }
    if (status === "covered" && expected.length === 0) {
      addIssue(
        issues,
        "error",
        "VAL-RC-005",
        `${file.relPath}:${row.line}`,
        `${runtimeRowId} 标记 covered 但没有 Expected Proof Slice IDs。`,
      );
    }
  }
}

function validateTasks(file, runtimeRows, issues) {
  for (const forbidden of FORBIDDEN_ARTIFACT_FIELDS) {
    if (hasForbiddenField(file.lines, forbidden)) {
      addIssue(
        issues,
        "error",
        "VAL-TS-001",
        file.relPath,
        `tasks.md 不得包含 ${forbidden}。`,
      );
    }
  }
  if (!/^## AC-\d{3}/m.test(file.text.trimStart())) {
    addIssue(
      issues,
      "error",
      "VAL-TS-002",
      file.relPath,
      "tasks.md Delivery Plane 必须以 AC section 开始。",
    );
  }
  if (!file.text.includes("## Trace Appendix")) {
    addIssue(
      issues,
      "error",
      "VAL-TS-003",
      file.relPath,
      "tasks.md 缺少 Trace Appendix。",
    );
  }

  for (const runtimeRowId of unique(file.text.match(RUNTIME_ROW_RE) ?? [])) {
    if (runtimeRows.size > 0 && !runtimeRows.has(runtimeRowId)) {
      addIssue(
        issues,
        "error",
        "VAL-TS-004",
        file.relPath,
        `tasks.md 引用未定义 runtime row ${runtimeRowId}。`,
      );
    }
  }

  const sections = splitAcSections(file);
  for (const section of sections) {
    validateAcSection(file, section, runtimeRows, issues);
  }
}

function validateAcSection(file, section, runtimeRows, issues) {
  const acRows = extractAcRuntimeRows(section.text);
  const contractTable = getTableAfterText(
    section.text,
    "Resolved Runtime Contract:",
    section.startLine,
  );
  if (!contractTable) {
    addIssue(
      issues,
      "error",
      "VAL-AC-001",
      `${file.relPath}:${section.startLine}`,
      `${section.id} 缺少 Resolved Runtime Contract 表。`,
    );
    return;
  }

  const contractRows = contractTable.rows
    .map((row) => strip(row.cells[0]))
    .filter((id) => /^(RS|OP|ST|CH)-\d{3}$/.test(id));
  const acRuntimeRows = acRows.filter((id) => /^(RS|OP|ST|CH)-\d{3}$/.test(id));
  if (!sameSet(contractRows, acRuntimeRows)) {
    addIssue(
      issues,
      "error",
      "VAL-AC-002",
      `${file.relPath}:${section.startLine}`,
      `${section.id} 的 Resolved Runtime Contract row IDs 必须与 AC Runtime Rows 一致。`,
    );
  }
  for (const runtimeRowId of acRuntimeRows) {
    if (runtimeRows.size > 0 && !runtimeRows.has(runtimeRowId)) {
      addIssue(
        issues,
        "error",
        "VAL-AC-003",
        `${file.relPath}:${section.startLine}`,
        `${section.id} 引用未定义 runtime row ${runtimeRowId}。`,
      );
    }
  }

  const proofOnlyRows = acRuntimeRows.filter((id) =>
    runtimeRows.get(id)?.scopeRole?.toLowerCase().includes("proof-only"),
  );
  if (
    acRuntimeRows.length > 0 &&
    proofOnlyRows.length === acRuntimeRows.length
  ) {
    const proofOnlySignal = getAcIntentText(section.text);
    if (
      PROOF_ONLY_AC_RE.test(proofOnlySignal) &&
      !PRODUCTION_WORDS_RE.test(proofOnlySignal)
    ) {
      addIssue(
        issues,
        "error",
        "VAL-AC-004",
        `${file.relPath}:${section.startLine}`,
        `${section.id} 只承载 proof-only rows，且看起来是 proof/coverage closure AC。proof-only row 不得创建 proof-only AC/checkbox。`,
      );
    }
  }
}

function getAcIntentText(text) {
  const heading = text.split(/\r?\n/, 1)[0] ?? "";
  const outcome = extractNamedBlock(text, "Outcome:");
  const implementationScope = extractNamedBlock(text, "Implementation Scope:");
  const checkboxTitles = [...text.matchAll(/^\s*-\s+\[[ xX]\]\s+(.+)$/gm)]
    .map((match) => match[1])
    .join("\n");
  return [heading, outcome, implementationScope, checkboxTitles].join("\n");
}

function extractNamedBlock(text, fieldName) {
  const start = text.indexOf(fieldName);
  if (start < 0) {
    return "";
  }
  const after = start + fieldName.length;
  const rest = text.slice(after);
  const nextField = rest.search(
    /\n(?:Start Gate|Runtime Rows|Resolved Runtime Contract|Implementation Scope|Preserve|Proof Contract):/,
  );
  return nextField >= 0 ? rest.slice(0, nextField) : rest;
}

function getTableAfterHeading(file, heading) {
  const headingIndex = file.lines.findIndex((line) => line.trim() === heading);
  if (headingIndex < 0) {
    return null;
  }
  return getFirstTable(file.lines, headingIndex + 1, 1);
}

function getTableAfterText(text, marker, startLine) {
  const lines = text.split(/\r?\n/);
  const markerIndex = lines.findIndex((line) => line.trim() === marker);
  if (markerIndex < 0) {
    return null;
  }
  return getFirstTable(lines, markerIndex + 1, startLine);
}

function getFirstTable(lines, fromIndex, baseLine) {
  for (let i = fromIndex; i < lines.length - 1; i += 1) {
    if (!isTableLine(lines[i]) || !isSeparatorLine(lines[i + 1])) {
      continue;
    }
    const headers = splitTableRow(lines[i]);
    const rows = [];
    let j = i + 2;
    while (j < lines.length && isTableLine(lines[j])) {
      const cells = splitTableRow(lines[j]);
      if (cells.length === headers.length) {
        rows.push({ cells, line: baseLine + j });
      }
      j += 1;
    }
    return { headers, rows, line: baseLine + i };
  }
  return null;
}

function splitAcSections(file) {
  const lines = file.lines;
  const sections = [];
  let current = null;
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^## (AC-\d{3})\b/);
    if (match) {
      if (current) {
        current.text = lines.slice(current.startIndex, i).join("\n");
        sections.push(current);
      }
      current = {
        id: match[1],
        startIndex: i,
        startLine: i + 1,
        text: "",
      };
      continue;
    }
    if (current && /^## Trace Appendix\b/.test(lines[i])) {
      current.text = lines.slice(current.startIndex, i).join("\n");
      sections.push(current);
      current = null;
      break;
    }
  }
  if (current) {
    current.text = lines.slice(current.startIndex).join("\n");
    sections.push(current);
  }
  return sections;
}

function extractAcRuntimeRows(text) {
  const marker = text.indexOf("Runtime Rows:");
  if (marker < 0) {
    return [];
  }
  const endMarkers = [
    text.indexOf("Resolved Runtime Contract:", marker),
    text.indexOf("Implementation Scope:", marker),
    text.indexOf("Preserve:", marker),
  ].filter((index) => index > marker);
  const end = endMarkers.length > 0 ? Math.min(...endMarkers) : marker + 500;
  return unique(text.slice(marker, end).match(RUNTIME_ROW_RE) ?? []);
}

function requireColumns(table, requiredColumns, fileRef, ruleId, issues) {
  const indexByHeader = {};
  for (const required of requiredColumns) {
    const found = table.headers.findIndex(
      (header) => normalizeHeader(header) === normalizeHeader(required),
    );
    if (found < 0) {
      addIssue(
        issues,
        "error",
        ruleId,
        `${fileRef}:${table.line}`,
        `表格缺少列 ${required}。`,
      );
      return null;
    }
    indexByHeader[required] = found;
  }
  return indexByHeader;
}

function isTableLine(line) {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isSeparatorLine(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function normalizeHeader(value) {
  return strip(value).toLowerCase().replace(/\s+/g, " ");
}

function idsFromCell(value, regex) {
  return unique(strip(value).match(regex) ?? []);
}

function strip(value) {
  return String(value ?? "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/`/g, "")
    .trim();
}

function unique(values) {
  return [...new Set(values)];
}

function sameSet(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size !== right.size) {
    return false;
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }
  return true;
}

function isOwnerListOrNonProduction(owner) {
  if (
    /tests?\/|openspec-results|test-results|evidence|runner|vitest|playwright|\.test\.|\.spec\./iu.test(
      owner,
    )
  ) {
    return true;
  }
  if (/[,，;+]|(?:^|\s)(?:and|和|与)(?:\s|$)/iu.test(owner)) {
    return true;
  }
  if ((owner.match(/`/g) ?? []).length > 2) {
    return true;
  }
  if (/\s{2,}/.test(owner)) {
    return true;
  }
  return false;
}

function hasForbiddenField(lines, fieldName) {
  const escaped = escapeRegExp(fieldName);
  const headingRe = new RegExp(`^#{1,6}\\s+${escaped}\\b`, "iu");
  const fieldRe = new RegExp(`^\\s*${escaped}\\s*:`, "iu");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (headingRe.test(line) || fieldRe.test(line)) {
      return true;
    }
    if (
      line.includes(fieldName) &&
      isTableLine(line) &&
      isSeparatorLine(lines[index + 1] ?? "")
    ) {
      return true;
    }
  }
  return false;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function addIssue(issues, severity, ruleId, file, message) {
  issues.push({ severity, ruleId, file, message });
}

function summarize(issues) {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return {
    ok: errors.length === 0,
    errorCount: errors.length,
    warningCount: warnings.length,
    issues,
  };
}

function parseCli(argv) {
  const options = {
    root: process.cwd(),
    complete: false,
    json: false,
    strictWarnings: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--change") {
      options.change = argv[++i];
    } else if (arg === "--root") {
      options.root = path.resolve(argv[++i]);
    } else if (arg === "--complete" || arg === "--final") {
      options.complete = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--strict-warnings") {
      options.strictWarnings = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`未知参数：${arg}`);
    }
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
  console.log(
    `OpenSpec artifact validation: ${status} (${result.errorCount} errors, ${result.warningCount} warnings)`,
  );
  for (const issue of result.issues) {
    console.log(
      `[${issue.severity}] ${issue.ruleId} ${issue.file}: ${issue.message}`,
    );
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parseCli(process.argv.slice(2));
    if (options.help || !options.change) {
      printHelp();
      process.exit(options.help ? 0 : 2);
    }
    const result = validateChange(options);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printTextResult(result);
    }
    process.exit(
      result.errorCount > 0 ||
        (options.strictWarnings && result.warningCount > 0)
        ? 1
        : 0,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}
