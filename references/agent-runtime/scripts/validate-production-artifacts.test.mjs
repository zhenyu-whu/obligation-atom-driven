import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateChange } from "./validate-production-artifacts.mjs";

test("合法 JSON trace complete 校验通过", () => {
  const root = makeChange("valid-change", standardFiles());
  const result = validateChange({ root, change: "valid-change", complete: true });
  assert.equal(result.errorCount, 0);
  assert.equal(result.warningCount, 0);
});

test("proof-slices-v1 完整 change 校验通过", () => {
  const root = makeChange("proof-slices-change", standardFiles({ newContract: true }));
  const result = validateChange({ root, change: "proof-slices-change", complete: true });
  assert.equal(result.errorCount, 0);
  assert.equal(result.warningCount, 0);
});

test("proof-slices-v1 缺少 proof slice JSON hard fail", () => {
  const files = standardFiles({ newContract: true });
  delete files.traces["verification.proof-slices.json"];
  const root = makeChange("missing-proof-slices-change", files);
  const result = validateChange({ root, change: "missing-proof-slices-change", complete: true });
  assertRule(result, "VAL-PST-001");
});

test("proof-slices-v1 proposal partial 不要求 future verification proof slice JSON", () => {
  const files = standardFiles({ proposal: true });
  files.artifacts = { "proposal.md": files.artifacts["proposal.md"] };
  files.traces = { "proposal.trace.json": files.traces["proposal.trace.json"] };
  files.manifestTraceContractVersion = "proof-slices-v1";

  const root = makeChange("proposal-only-proof-slices-change", files);
  const result = validateChange({ root, change: "proposal-only-proof-slices-change", complete: false });

  assert.equal(result.errorCount, 0);
  assert.equal(result.warningCount, 0);
});

test("proof-slices-v1 Markdown matrix 与 JSON 漂移 hard fail", () => {
  const files = standardFiles({ newContract: true });
  files.artifacts["verification.md"] = verificationBody({
    proofRows: [
      "| PS-001 | RS-001 | RS-001 | authorization | actor drift | auth surface | 登录态解析到内部 actor。 | actor 缺失。 | security/negative | apps/web | authorization result | session fixture | high | None |",
    ],
  });
  const root = makeChange("proof-slices-drift-change", files);
  const result = validateChange({ root, change: "proof-slices-drift-change", complete: true });
  assertRule(result, "VAL-PST-030");
});

test("proof-slices-v1 reconciliation 引用不存在 JSON slice hard fail", () => {
  const files = standardFiles({ newContract: true });
  files.traces["verification.trace.json"]["runtime-coverage-reconciliation"][0]["expected-proof-slice-ids"] = ["PS-999"];
  const root = makeChange("proof-slices-missing-expected-change", files);
  const result = validateChange({ root, change: "proof-slices-missing-expected-change", complete: true });
  assertRule(result, "VAL-RC-003");
});

test("proof-slices-v1 JSON slice owner list hard fail", () => {
  const files = standardFiles({ newContract: true });
  files.traces["verification.proof-slices.json"]["proof-slices"][0]["production-owner"] = "apps/web, packages/domain";
  const root = makeChange("proof-slices-bad-owner-change", files);
  const result = validateChange({ root, change: "proof-slices-bad-owner-change", complete: true });
  assertRule(result, "VAL-PS-008");
  assertRule(result, "VAL-PST-030");
});

test("proof-slices-v1 自动化 slice 的 apps/web + DB/integration 无合法落点 hard fail", () => {
  const files = withSingleProofSlicePlacement(standardFiles({ newContract: true }), {
    owner: "apps/web",
    layer: "DB/integration",
  });
  const root = makeChange("proof-slices-web-db-placement-change", files);
  const result = validateChange({ root, change: "proof-slices-web-db-placement-change", complete: true });

  assertRule(result, "VAL-PS-009");
});

test("proof-slices-v1 自动化 slice 的 apps/web + contract 无合法落点 hard fail", () => {
  const files = withSingleProofSlicePlacement(standardFiles({ newContract: true }), {
    owner: "apps/web",
    layer: "contract",
  });
  const root = makeChange("proof-slices-web-contract-placement-change", files);
  const result = validateChange({ root, change: "proof-slices-web-contract-placement-change", complete: true });

  assertRule(result, "VAL-PS-009");
});

test("proof-slices-v1 合法 owner/layer placement 组合通过", () => {
  const cases = [
    { change: "proof-slices-web-route-placement-change", owner: "apps/web", layer: "route/API" },
    { change: "proof-slices-db-integration-placement-change", owner: "packages/db", layer: "DB/integration" },
    { change: "proof-slices-domain-contract-placement-change", owner: "packages/domain", layer: "contract" },
  ];

  for (const item of cases) {
    const files = withSingleProofSlicePlacement(standardFiles({ newContract: true }), item);
    const root = makeChange(item.change, files);
    const result = validateChange({ root, change: item.change, complete: true });

    assert.equal(result.errorCount, 0, `${item.owner} + ${item.layer}: ${JSON.stringify(result.issues, null, 2)}`);
  }
});

test("proof-slices-v1 manual slice 的非法 owner/layer placement 不触发自动化落点 hard fail", () => {
  const files = withSingleProofSlicePlacement(standardFiles({ newContract: true }), {
    owner: "apps/web",
    layer: "DB/integration",
    manual: "需要人工环境验证。",
  });
  const root = makeChange("proof-slices-manual-placement-change", files);
  const result = validateChange({ root, change: "proof-slices-manual-placement-change", complete: true });

  assert.ok(
    !result.issues.some((issue) => issue.ruleId === "VAL-PS-009"),
    `did not expect VAL-PS-009, got ${JSON.stringify(result.issues, null, 2)}`,
  );
});

test("非 kebab-case key hard fail", () => {
  const files = standardFiles();
  files.traces["tasks.trace.json"].badKey = true;
  const root = makeChange("bad-key-change", files);
  const result = validateChange({ root, change: "bad-key-change", complete: true });
  assertRule(result, "VAL-TR-016");
});

test("缺 manifest、缺 trace file、digest mismatch hard fail", () => {
  const root = makeChange("trace-pointer-change", standardFiles());
  fs.rmSync(path.join(root, "openspec", "changes", "trace-pointer-change", "trace", "manifest.json"));
  fs.rmSync(path.join(root, "openspec", "changes", "trace-pointer-change", "trace", "runtime-acceptance.trace.json"));
  const tasksPath = path.join(root, "openspec", "changes", "trace-pointer-change", "tasks.md");
  fs.writeFileSync(tasksPath, fs.readFileSync(tasksPath, "utf8").replace(/sha256-[a-f0-9]+/, "sha256-deadbeef"));
  const result = validateChange({ root, change: "trace-pointer-change", complete: true });
  assertRule(result, "VAL-TR-001");
  assertRule(result, "VAL-TR-003");
  assertRule(result, "VAL-TR-004");
});

test("artifact 保留完整 Markdown trace table hard fail", () => {
  const files = standardFiles();
  files.artifacts["tasks.md"] = `${tasksBody()}

## Trace Appendix

### Acceptance-Driven Coverage

| A | B |
| --- | --- |
| x | y |
`;
  const root = makeChange("old-trace-change", files);
  const result = validateChange({ root, change: "old-trace-change", complete: true });
  assertRule(result, "VAL-TR-011");
  assertRule(result, "VAL-TR-012");
});

test("proposal/spec/design trace orphan GA hard fail", () => {
  const files = standardFiles({
    proposal: true,
    design: true,
    designGa: "GA-9999",
  });
  const root = makeChange("orphan-ga-change", files);
  const result = validateChange({ root, change: "orphan-ga-change", complete: false });
  assertRule(result, "VAL-SRC-002");
});

test("runtime upstream coverage 未映射 canonical row hard fail", () => {
  const files = standardFiles();
  files.traces["runtime-acceptance.trace.json"]["runtime-upstream-coverage-map"] = [
    {
      "upstream-item": "GA-0001",
      "upstream-type": "direct atom",
      "artifact-projection": "spec-requirement",
      "upstream-runtime-obligation": "必须覆盖。",
      "runtime-row-ids": [],
      "coverage-mode": "direct-row-source",
      "not-applicable-reason": "None",
    },
  ];
  const root = makeChange("runtime-gap-change", files);
  const result = validateChange({ root, change: "runtime-gap-change", complete: true });
  assertRule(result, "VAL-RA-101");
});

test("tasks projection task ID 无法解析 hard fail", () => {
  const files = standardFiles();
  files.traces["tasks.trace.json"]["runtime-acceptance-projection"]["runtime-row-ownership-projection"][0]["implementation-task-ids"] = ["AC-001.9"];
  const root = makeChange("bad-task-id-change", files);
  const result = validateChange({ root, change: "bad-task-id-change", complete: true });
  assertRule(result, "VAL-TS-107");
});

test("AC graph cycle 或后置 dependency hard fail", () => {
  const files = standardFiles({ secondAc: true });
  const ownership = files.traces["tasks.trace.json"]["runtime-acceptance-index"]["ac-runtime-ownership-index"];
  ownership[0]["depends-on-ac-ids"] = ["AC-002"];
  ownership[1]["depends-on-ac-ids"] = ["AC-001"];
  const root = makeChange("bad-graph-change", files);
  const result = validateChange({ root, change: "bad-graph-change", complete: true });
  assertRule(result, "VAL-TS-105");
  assertRule(result, "VAL-TS-109");
});

test("verification reconciliation expected slice 不存在、missing 非空、covered 假闭合 hard fail", () => {
  const files = standardFiles();
  files.traces["verification.trace.json"]["runtime-coverage-reconciliation"] = [
    {
      "runtime-row-id": "RS-001",
      "row-type": "surface",
      "scope-role": "required behavior",
      "expected-proof-slice-ids": ["PS-999"],
      "missing-proof-slice-ids": ["PS-999"],
      "coverage-status": "covered",
      "gap-not-covered-reason": "None",
    },
  ];
  const root = makeChange("bad-reconciliation-change", files);
  const result = validateChange({ root, change: "bad-reconciliation-change", complete: true });
  assertRule(result, "VAL-RC-003");
  assertRule(result, "VAL-RC-004");
});

test("疑似非原子 slice 继续输出 warning", () => {
  const files = standardFiles();
  files.artifacts["verification.md"] = verificationBody({
    proofRows: [
      "| PS-001 | RS-001 | RS-001 | operation | edit/delete/add item | API | edit/delete/add 均可观察。 | 操作失败。 | route/API | apps/web | interactive assertions | DB fixture | high | None |",
    ],
  });
  const root = makeChange("warning-change", files);
  const result = validateChange({ root, change: "warning-change", complete: true });
  assert.equal(result.errorCount, 0);
  assertRule(result, "VAL-PS-401", "warning");
});

function makeChange(change, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "openspec-validator-"));
  const changeDir = path.join(root, "openspec", "changes", change);
  const traceDir = path.join(changeDir, "trace");
  fs.mkdirSync(traceDir, { recursive: true });
  fs.writeFileSync(path.join(changeDir, ".openspec.yaml"), "schema: production-obligation-atom-driven\n");

  const traceEntries = [];
  for (const [traceName, trace] of Object.entries(files.traces)) {
    const fullPath = path.join(traceDir, traceName);
    fs.writeFileSync(fullPath, `${JSON.stringify(trace, null, 2)}\n`);
  }
  for (const [artifactPath, body] of Object.entries(files.artifacts)) {
    const traceName = traceNameForArtifact(artifactPath);
    const tracePath = path.join(traceDir, traceName);
    const digest = fs.existsSync(tracePath) ? sha256File(tracePath) : "sha256-missing";
    const fullPath = path.join(changeDir, artifactPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    const content = body.includes("## Trace Appendix")
      ? body
      : `${body.trimEnd()}\n\n## Trace Appendix\n\nTrace file: \`trace/${traceName}\`\nTrace schema: \`openspec-trace-v1\`\nTrace digest: \`${digest}\`\n`;
    fs.writeFileSync(fullPath, content);
    traceEntries.push({
      "artifact-id": artifactIdForArtifact(artifactPath),
      "artifact-path": artifactPath,
      "trace-path": `trace/${traceName}`,
      "trace-digest": digest,
    });
  }
  if (files.manifestTraceContractVersion === "proof-slices-v1") {
    const proofSlicesPath = path.join(traceDir, "verification.proof-slices.json");
    const digest = fs.existsSync(proofSlicesPath) ? sha256File(proofSlicesPath) : "sha256-missing";
    traceEntries.push({
      "artifact-id": "verification",
      "artifact-path": "verification.md",
      "trace-path": "trace/verification.proof-slices.json",
      "trace-schema": "openspec-proof-slices-v1",
      "trace-digest": digest,
    });
  }
  if (files.writeManifest !== false) {
    fs.writeFileSync(
      path.join(traceDir, "manifest.json"),
      `${JSON.stringify(
        {
          "trace-schema": "openspec-trace-v1",
          ...(files.manifestTraceContractVersion
            ? { "trace-contract-version": files.manifestTraceContractVersion }
            : {}),
          change,
          "schema-name": "production-obligation-atom-driven",
          artifacts: traceEntries,
        },
        null,
        2,
      )}\n`,
    );
  }
  return root;
}

function standardFiles(options = {}) {
  const artifacts = {
    "runtime-acceptance.md": runtimeAcceptanceBody(options),
    "verification.md": verificationBody(),
    "tasks.md": tasksBody(options),
  };
  const traces = {
    "runtime-acceptance.trace.json": runtimeTrace(),
    "verification.trace.json": verificationTrace(),
    "tasks.trace.json": tasksTrace(options),
  };
  if (options.newContract) {
    traces["verification.proof-slices.json"] = proofSlicesTrace();
  }
  if (options.proposal) {
    artifacts["proposal.md"] = "## Why\n\n- 测试。\n";
    traces["proposal.trace.json"] = proposalTrace();
  }
  if (options.design) {
    artifacts["design.md"] = "## Context\n\n- 测试。\n";
    traces["design.trace.json"] = designTrace(options.designGa ?? "GA-0001");
  }
  return {
    artifacts,
    traces,
    ...(options.newContract ? { manifestTraceContractVersion: "proof-slices-v1" } : {}),
  };
}

function withSingleProofSlicePlacement(files, options) {
  const manual = options.manual ?? "None";
  files.artifacts["verification.md"] = verificationBody({
    proofRows: [
      `| PS-001 | RS-001 | RS-001 | authorization | actor resolution | auth surface | 登录态解析到内部 actor。 | actor 缺失。 | ${options.layer} | ${options.owner} | authorization result | session fixture | high | ${manual} |`,
    ],
  });

  const proofSlice = files.traces["verification.proof-slices.json"]?.["proof-slices"]?.[0];
  if (proofSlice) {
    proofSlice["primary-layer"] = options.layer;
    proofSlice["production-owner"] = options.owner;
    proofSlice["manual-environment-gate"] = manual;
    files.traces["verification.proof-slices.json"]["proof-slice-summary"]["primary-layers-used"] = [
      options.layer,
    ];
  }

  return files;
}

function runtimeAcceptanceBody(options = {}) {
  const extraRow = options.secondAc
    ? "| RS-002 | route surface | apps/web | route | 第二行为。 | route fact | real path | none | design | spec | required behavior | no expansion |\n"
    : "";
  return `## Runtime Acceptance Intent

- Scope: 测试。

## Runtime Surface Inventory

| Surface ID | Surface Type | Owner Candidate | Entry Point | Runtime Obligation | Observable Fact | Default Path Policy | External Boundary | Source Basis | Projection Type | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RS-001 | auth surface | apps/web | route | 登录态解析。 | auth fact | real path | none | design | spec | required behavior | no expansion |
${extraRow}## Operation Coverage Matrix

| Operation ID | Trigger | Control / Route | Request / Action | Runtime Obligation | Expected Rendered UI Update | API/Data Assertion | Reload/Persistence Assertion | Disabled/Failure/Recovery Branches | Default Path Policy | External Boundary | Source Basis | Projection Type | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## State / Branch Coverage Matrix

| State ID | State / Branch | Trigger Into | Runtime Obligation | Observable UI / API Outcome | Data/Event Facts | Allowed Next States | Terminal? | Default Path Policy | External Boundary | Source Basis | Projection Type | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Async / Realtime Chain Matrix

| Chain ID | User/System Entry | Enqueue / Dispatch Fact | Worker / Consumer Fact | Domain Mutation | Event / Outbox Fact | Client Subscription / Readback | Rendered Terminal State | Failure Variant | Runtime Obligation | Default Path Policy | External Boundary | Source Basis | Projection Type | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
`;
}

function verificationBody(options = {}) {
  const proofRows =
    options.proofRows ??
    ["| PS-001 | RS-001 | RS-001 | authorization | actor resolution | auth surface | 登录态解析到内部 actor。 | actor 缺失。 | security/negative | apps/web | authorization result | session fixture | high | None |"];
  return `## Verification Intent

- Scope: 测试。
- Runtime source: runtime-acceptance.md。
- Out of scope: None。

## Proof Slice Matrix

| Slice ID | Runtime Row IDs | Primary Runtime Row ID | Primitive Type | Branch / Variant | Observable Surface | Oracle Fragment | Failure Signal | Primary Layer | Production Owner | Primary Assertion Shape | Fixture / Mock Boundary | Regression Intent | Manual / Environment Gate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${proofRows.join("\n")}

## Layer / Harness / Fixture Notes

| Slice ID Set | Layer Reason | Harness Expectation | Mock / Fixture Boundary | Omitted Stable Layers / Reason |
| --- | --- | --- | --- | --- |

## Do Not Test

| Item | Reason | Runtime Row IDs |
| --- | --- | --- |
`;
}

function tasksBody(options = {}) {
  const second = options.secondAc
    ? `
## AC-002 第二行为

Outcome:

- 第二行为可用。

Start Gate:

- AC-001。

Runtime Rows:

- RS-002

Resolved Runtime Contract:

| Row | Worker-facing obligation | Observable proof | Default / no-scope boundary |
| --- | --- | --- | --- |
| RS-002 | 生产义务。 | 可观察 proof。 | 默认边界。 |

Implementation Scope:

- 实现第二行为。

Preserve:

- 不扩展 scope。

Proof Contract:

- 可观察。

- [ ] AC-002.1 实现第二行为
      Runtime Rows: RS-002
      Acceptance: 可观察。
      Preserve: 不扩展。
      Proof: 可观察。
      Mock / Default Path Policy: 默认真实路径。
`
    : "";
  return `## AC-001 登录态 actor 解析

Outcome:

- 登录态 actor 可解析。

Start Gate:

- None

Runtime Rows:

- RS-001

Resolved Runtime Contract:

| Row | Worker-facing obligation | Observable proof | Default / no-scope boundary |
| --- | --- | --- | --- |
| RS-001 | 生产义务。 | 可观察 proof。 | 默认边界。 |

Implementation Scope:

- 实现 actor 解析。

Preserve:

- 不扩展 scope。

Proof Contract:

- 可观察。

- [ ] AC-001.1 实现 actor 解析
      Runtime Rows: RS-001
      Acceptance: 可观察。
      Preserve: 不扩展。
      Proof: 可观察。
      Mock / Default Path Policy: 默认真实路径。
${second}`;
}

function proposalTrace() {
  return {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "proposal",
    "artifact-path": "proposal.md",
    "obligation-atom-preconditions": [{ item: "change slug", value: "valid-change" }],
    "change-atom-coverage-register": [
      {
        "global-atom-id": "GA-0001",
        "source-document": "docs/source.md",
        lines: "L1-L2",
        "atom-type": "requirement",
        "artifact-projection": "spec-requirement",
        "projection-source": "final-packet",
        normativity: "must",
        "coverage-status": "direct",
        "packet-capability": "capability",
        "source-fact": "事实。",
        "propose-use": "使用。",
        "evidence-need": "unit",
        "downstream-coverage": "spec",
      },
    ],
    "source-window-read-set": [],
    "proposal-alignment-gate": { blockers: "无" },
  };
}

function designTrace(gaId) {
  return {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "design",
    "artifact-path": "design.md",
    "production-source-map": [{ "global-atom-id": gaId, "artifact-projection": "spec-requirement" }],
    "design-obligation-matrix": [{ item: "Decision", "design-handling": "处理。", "guard-boundary": "无" }],
    "production-alignment-gate": { blockers: "无" },
  };
}

function runtimeTrace() {
  return {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "runtime-acceptance",
    "artifact-path": "runtime-acceptance.md",
    "runtime-upstream-coverage-map": [
      {
        "upstream-item": "GA-0001",
        "upstream-type": "direct atom",
        "artifact-projection": "spec-requirement",
        "upstream-runtime-obligation": "登录态解析。",
        "runtime-row-ids": ["RS-001"],
        "coverage-mode": "direct-row-source",
        "not-applicable-reason": "None",
      },
    ],
    "runtime-coverage-source-map": [],
    "coverage-closure-checklist": ["已闭合。"],
  };
}

function verificationTrace() {
  return {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "verification",
    "artifact-path": "verification.md",
    "runtime-coverage-reconciliation": [
      {
        "runtime-row-id": "RS-001",
        "row-type": "surface",
        "scope-role": "required behavior",
        "expected-proof-slice-ids": ["PS-001"],
        "missing-proof-slice-ids": [],
        "coverage-status": "covered",
        "gap-not-covered-reason": "None",
      },
    ],
    "slice-consistency-checklist": ["已闭合。"],
  };
}

function proofSlicesTrace() {
  return {
    "trace-schema": "openspec-proof-slices-v1",
    "artifact-id": "verification",
    "artifact-path": "verification.md",
    "change-name": "test-change",
    "schema-name": "production-obligation-atom-driven",
    "source-interface": {
      "runtime-acceptance-artifact": "runtime-acceptance.md",
      "runtime-acceptance-trace": "trace/runtime-acceptance.trace.json",
      "oracle-source-policy": "Proof Slice oracle 仅来自 runtime-acceptance.md canonical rows。",
    },
    "proof-slice-summary": {
      "proof-slice-count": 1,
      "slice-id-format": "PS-###",
      "primitive-types-used": ["authorization"],
      "primary-layers-used": ["security/negative"],
    },
    "proof-slices": [
      {
        "slice-id": "PS-001",
        "runtime-row-ids": ["RS-001"],
        "primary-runtime-row-id": "RS-001",
        "primitive-type": "authorization",
        "branch-variant": "actor resolution",
        "observable-surface": "auth surface",
        "oracle-fragment": "登录态解析到内部 actor。",
        "failure-signal": "actor 缺失。",
        "primary-layer": "security/negative",
        "production-owner": "apps/web",
        "primary-assertion-shape": "authorization result",
        "fixture-mock-boundary": "session fixture",
        "regression-intent": "high",
        "manual-environment-gate": "None",
        "test-contract": {
          "primary-test-cardinality": "exactly-one",
          "test-title-prefix": "PS-001",
          "allow-shared-setup": true,
          "allow-multi-slice-primary-test": false,
          "waiver-required-for-multi-slice": true,
        },
      },
    ],
  };
}

function tasksTrace(options = {}) {
  const ownership = [
    {
      "ac-id": "AC-001",
      "source-basis": "GA-0001",
      "runtime-surface-rows": ["RS-001"],
      "operation-rows": [],
      "state-branch-rows": [],
      "async-realtime-rows": [],
      "provides-rows": ["RS-001"],
      "consumes-rows": [],
      "depends-on-ac-ids": [],
      "prerequisite-runtime-facts": "None",
      "start-gate": "可直接开始",
      "scope-role": "required behavior",
      "no-scope-expansion-check": "不扩展。",
      "detail-matrix-rows": ["RS-001"],
      "runtime-proof-summary": "可观察。",
    },
  ];
  const projection = [
    {
      "runtime-row-id": "RS-001",
      "row-type": "surface",
      "owner-ac-id": "AC-001",
      "implementation-task-ids": ["AC-001.1"],
      "provides-rows": ["RS-001"],
      "consumes-rows": [],
      "depends-on-ac-ids": [],
      "start-gate": "可直接开始",
      "projection-status": "projected",
      "blocker-not-applicable-reason": "无",
    },
  ];
  if (options.secondAc) {
    ownership.push({
      "ac-id": "AC-002",
      "source-basis": "GA-0001",
      "runtime-surface-rows": ["RS-002"],
      "operation-rows": [],
      "state-branch-rows": [],
      "async-realtime-rows": [],
      "provides-rows": ["RS-002"],
      "consumes-rows": ["RS-001"],
      "depends-on-ac-ids": ["AC-001"],
      "prerequisite-runtime-facts": "RS-001",
      "start-gate": "需 AC-001",
      "scope-role": "required behavior",
      "no-scope-expansion-check": "不扩展。",
      "detail-matrix-rows": ["RS-002"],
      "runtime-proof-summary": "可观察。",
    });
    projection.push({
      "runtime-row-id": "RS-002",
      "row-type": "surface",
      "owner-ac-id": "AC-002",
      "implementation-task-ids": ["AC-002.1"],
      "provides-rows": ["RS-002"],
      "consumes-rows": ["RS-001"],
      "depends-on-ac-ids": ["AC-001"],
      "start-gate": "需 AC-001",
      "projection-status": "projected",
      "blocker-not-applicable-reason": "无",
    });
  }
  return {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "tasks",
    "artifact-path": "tasks.md",
    "acceptance-driven-coverage": {
      "obligation-atom-coverage": [],
      "requirement-scenario-coverage": [],
      "design-obligation-coverage": [],
    },
    "runtime-acceptance-index": {
      "ac-runtime-ownership-index": ownership,
    },
    "runtime-acceptance-projection": {
      "runtime-row-ownership-projection": projection,
      "provider-consumer-projection": [],
    },
  };
}

function traceNameForArtifact(artifactPath) {
  if (artifactPath === "proposal.md") return "proposal.trace.json";
  if (artifactPath === "design.md") return "design.trace.json";
  if (artifactPath === "runtime-acceptance.md") return "runtime-acceptance.trace.json";
  if (artifactPath === "verification.md") return "verification.trace.json";
  if (artifactPath === "tasks.md") return "tasks.trace.json";
  return `${artifactPath.replace(/^specs\//, "specs/").replace(/\/spec\.md$/, "").replace(/\.md$/, "")}.trace.json`;
}

function artifactIdForArtifact(artifactPath) {
  if (artifactPath.startsWith("specs/")) return "specs";
  return artifactPath.replace(/\.md$/, "");
}

function sha256File(fullPath) {
  return `sha256-${crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex")}`;
}

function assertRule(result, ruleId, severity = "error") {
  assert.ok(
    result.issues.some((issue) => issue.ruleId === ruleId && issue.severity === severity),
    `expected ${severity} ${ruleId}, got ${JSON.stringify(result.issues, null, 2)}`,
  );
}
