import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateChange } from "./validate-production-artifacts.mjs";

test("合法 atomic Proof Slice 通过 complete 校验", () => {
  const root = makeChange("valid-change", {
    runtimeAcceptance: runtimeAcceptance(),
    verification: verification({
      proofRows: [
        "| PS-001 | RS-001 | RS-001 | authorization | actor resolution | auth surface | 登录态解析到内部 actor。 | actor 缺失。 | security/negative | apps/web | authorization result | session fixture | high | None |",
      ],
      reconciliationRows: [
        "| RS-001 | surface | required behavior | PS-001 | None | covered | None |",
      ],
    }),
    tasks: tasks(),
  });

  const result = validateChange({
    root,
    change: "valid-change",
    complete: true,
  });
  assert.equal(result.errorCount, 0);
  assert.equal(result.warningCount, 0);
});

test("未定义 row、非法枚举、owner list 和 covered 假闭合 hard fail", () => {
  const root = makeChange("invalid-change", {
    runtimeAcceptance: runtimeAcceptance(),
    verification: verification({
      proofRows: [
        "| PS-001 | OP-999 | RS-001 | bogus | bad branch | API | 单一断言。 | 失败。 | runtime | apps/web, packages/domain | status | fixture | high | None |",
      ],
      reconciliationRows: [
        "| RS-001 | surface | required behavior | PS-002 | PS-002 | covered | None |",
      ],
    }),
    tasks: tasks(),
  });

  const result = validateChange({
    root,
    change: "invalid-change",
    complete: true,
  });
  assertRule(result, "VAL-PS-004");
  assertRule(result, "VAL-PS-005");
  assertRule(result, "VAL-PS-006");
  assertRule(result, "VAL-PS-007");
  assertRule(result, "VAL-PS-008");
  assertRule(result, "VAL-RC-003");
  assertRule(result, "VAL-RC-004");
});

test("疑似非原子 slice 输出 warning 供 reviewer 判定", () => {
  const root = makeChange("warning-change", {
    runtimeAcceptance: runtimeAcceptance({
      extraRows:
        "| RS-002 | log surface | apps/web | logs | 记录日志。 | log fact | real path | none | design | proof | proof-only | no expansion |\n",
    }),
    verification: verification({
      proofRows: [
        "| PS-001 | RS-001 | RS-001 | operation | edit/delete/add item | API | edit/delete/add 均可观察。 | 操作失败。 | route/API | apps/web | interactive assertions | DB fixture | high | None |",
        "| PS-002 | RS-002 | RS-002 | observability | log categories | logs | 创建、覆盖、提取、更新、重试日志类别可观察。 | 缺日志。 | contract | packages/domain | log category assertion | log sink | medium | None |",
        "| PS-003 | RS-002 | RS-002 | observability | redaction categories | logs | source_text、raw provider response、token、cookie、email 均脱敏。 | 泄露敏感字段。 | security/negative | packages/domain | forbidden fields absent | log sink | high | None |",
      ],
      reconciliationRows: [
        "| RS-001 | surface | required behavior | PS-001 | None | covered | None |",
        "| RS-002 | surface | proof-only | PS-002, PS-003 | None | covered | None |",
      ],
    }),
    tasks: tasks({ rows: ["RS-001", "RS-002"] }),
  });

  const result = validateChange({
    root,
    change: "warning-change",
    complete: true,
  });
  assert.equal(result.errorCount, 0);
  assertRule(result, "VAL-PS-401", "warning");
  assertRule(result, "VAL-PS-406", "warning");
  assertRule(result, "VAL-PS-407", "warning");
});

test("proof-only row 不得创建 proof-only AC/checkbox", () => {
  const root = makeChange("proof-only-change", {
    runtimeAcceptance: runtimeAcceptance({
      scopeRole: "proof-only",
    }),
    verification: verification({
      proofRows: [
        "| PS-001 | RS-001 | RS-001 | state | proof branch | API | 可观察证明。 | 缺 proof。 | route/API | apps/web | status | fixture | high | None |",
      ],
      reconciliationRows: [
        "| RS-001 | surface | proof-only | PS-001 | None | covered | None |",
      ],
    }),
    tasks: tasks({
      title: "验收证明收束",
      outcome: "完成 proof closure。",
      implementationScope: "proof closure。",
      taskTitle: "闭合证明",
    }),
  });

  const result = validateChange({
    root,
    change: "proof-only-change",
    complete: true,
  });
  assertRule(result, "VAL-AC-004");
});

test("partial 校验不因下游 artifact 缺失失败", () => {
  const root = makeChange("partial-change", {
    runtimeAcceptance: runtimeAcceptance(),
  });

  const result = validateChange({
    root,
    change: "partial-change",
    complete: false,
  });
  assert.equal(result.errorCount, 0);
});

function makeChange(change, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "openspec-validator-"));
  const changeDir = path.join(root, "openspec", "changes", change);
  fs.mkdirSync(changeDir, { recursive: true });
  if (files.runtimeAcceptance) {
    fs.writeFileSync(
      path.join(changeDir, "runtime-acceptance.md"),
      files.runtimeAcceptance,
    );
  }
  if (files.verification) {
    fs.writeFileSync(
      path.join(changeDir, "verification.md"),
      files.verification,
    );
  }
  if (files.tasks) {
    fs.writeFileSync(path.join(changeDir, "tasks.md"), files.tasks);
  }
  return root;
}

function runtimeAcceptance(options = {}) {
  const scopeRole = options.scopeRole ?? "required behavior";
  const extraRows = options.extraRows ?? "";
  return `## Runtime Acceptance Intent

- Scope: 测试。

## Runtime Surface Inventory

| Surface ID | Surface Type | Owner Candidate | Entry Point | Runtime Obligation | Observable Fact | Default Path Policy | External Boundary | Source Basis | Projection Type | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RS-001 | auth surface | apps/web | route | 登录态解析。 | auth fact | real path | none | design | spec | ${scopeRole} | no expansion |
${extraRows}## Operation Coverage Matrix

| Operation ID | Trigger | Control / Route | Request / Action | Runtime Obligation | Expected Rendered UI Update | API/Data Assertion | Reload/Persistence Assertion | Disabled/Failure/Recovery Branches | Default Path Policy | External Boundary | Source Basis | Projection Type | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## State / Branch Coverage Matrix

| State ID | State / Branch | Trigger Into | Runtime Obligation | Observable UI / API Outcome | Data/Event Facts | Allowed Next States | Terminal? | Default Path Policy | External Boundary | Source Basis | Projection Type | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Async / Realtime Chain Matrix

| Chain ID | User/System Entry | Enqueue / Dispatch Fact | Worker / Consumer Fact | Domain Mutation | Event / Outbox Fact | Client Subscription / Readback | Rendered Terminal State | Failure Variant | Runtime Obligation | Default Path Policy | External Boundary | Source Basis | Projection Type | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Trace Appendix

### Runtime Upstream Coverage Map

| Upstream Item | Upstream Type | Artifact Projection | Upstream Runtime Obligation | Runtime Row IDs | Coverage Mode | Not-Applicable Reason |
| --- | --- | --- | --- | --- | --- | --- |

### Runtime Coverage Source Map

| Source / Scope Basis | Artifact Projection | Runtime Row IDs | Runtime Obligation Summary | Observable Fact Category | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- |

### Coverage Closure Checklist

- [x] 测试。
`;
}

function verification(options) {
  return `## Verification Intent

- Scope: 测试。
- Runtime source: runtime-acceptance.md。
- Out of scope: None。

## Proof Slice Matrix

| Slice ID | Runtime Row IDs | Primary Runtime Row ID | Primitive Type | Branch / Variant | Observable Surface | Oracle Fragment | Failure Signal | Primary Layer | Production Owner | Primary Assertion Shape | Fixture / Mock Boundary | Regression Intent | Manual / Environment Gate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${options.proofRows.join("\n")}

## Layer / Harness / Fixture Notes

| Slice ID Set | Layer Reason | Harness Expectation | Mock / Fixture Boundary | Omitted Stable Layers / Reason |
| --- | --- | --- | --- | --- |

## Do Not Test

| Item | Reason | Runtime Row IDs |
| --- | --- | --- |

## Trace Appendix

### Runtime Coverage Reconciliation

| Runtime Row ID | Row Type | Scope Role | Expected Proof Slice IDs | Missing Proof Slice IDs | Coverage Status | Gap / Not-Covered Reason |
| --- | --- | --- | --- | --- | --- | --- |
${options.reconciliationRows.join("\n")}

### Slice Consistency Checklist

- [x] 每个 Proof Slice 只引用 runtime-acceptance.md 中已定义的 Runtime Row IDs。
`;
}

function tasks(options = {}) {
  const rows = options.rows ?? ["RS-001"];
  const rowList = rows.map((row) => `- ${row}`).join("\n");
  const contractRows = rows
    .map((row) => `| ${row} | 生产义务。 | 可观察 proof。 | 默认边界。 |`)
    .join("\n");
  const title = options.title ?? "登录态 actor 解析";
  const outcome = options.outcome ?? "登录态 actor 可解析。";
  const implementationScope =
    options.implementationScope ?? "实现 actor 解析。";
  const taskTitle = options.taskTitle ?? "实现 actor 解析";
  return `## AC-001 ${title}

Outcome:

- ${outcome}

Start Gate:

- None

Runtime Rows:

${rowList}

Resolved Runtime Contract:

| Row | Worker-facing obligation | Observable proof | Default / no-scope boundary |
| --- | --- | --- | --- |
${contractRows}

Implementation Scope:

- ${implementationScope}

Preserve:

- 不扩展 scope。

Proof Contract:

- 可观察。

- [ ] AC-001.1 ${taskTitle}
      Runtime Rows: ${rows.join(", ")}
      Acceptance: 可观察。
      Preserve: 不扩展。
      Proof: 可观察。
      Mock / Default Path Policy: 默认真实路径。

## Trace Appendix

### Acceptance-Driven Coverage

#### Obligation Atom Coverage

| Global Atom ID | Artifact Projection | Atom Summary | Acceptance Slice IDs | Implementation Task IDs | Acceptance Proof |
| --- | --- | --- | --- | --- | --- |

### Runtime Acceptance Index

#### AC Runtime Ownership Index

| AC ID | Source Basis | Runtime Surface Rows | Operation Rows | State / Branch Rows | Async / Realtime Rows | Provides Rows | Consumes Rows | Depends On AC IDs | Prerequisite Runtime Facts | Start Gate | Scope Role | No-Scope-Expansion Check | Detail Matrix Rows | Runtime Proof Summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

### Runtime Acceptance Projection

#### Runtime Row Ownership Projection

| Runtime Row ID | Row Type | Owner AC ID | Implementation Task IDs | Provides Rows | Consumes Rows | Depends On AC IDs | Start Gate | Projection Status | Blocker / Not-Applicable Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
`;
}

function assertRule(result, ruleId, severity = "error") {
  assert.ok(
    result.issues.some(
      (issue) => issue.ruleId === ruleId && issue.severity === severity,
    ),
    `expected ${severity} ${ruleId}, got ${JSON.stringify(result.issues, null, 2)}`,
  );
}
