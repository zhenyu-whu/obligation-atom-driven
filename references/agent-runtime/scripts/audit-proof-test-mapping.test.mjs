import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { auditProofTestMapping } from "./audit-proof-test-mapping.mjs";

test("proof-test-map 每个 durable PS 一个 primary test 时通过", () => {
  const root = makeProofMappingChange("valid-map", {
    results: [proofResult("PS-001")],
  });

  const result = auditProofTestMapping({
    root,
    change: "valid-map",
    discoveredTests: [discovered("PS-001 actor denial")],
  });

  assert.equal(result.errorCount, 0, formatIssues(result));
});

test("durable proof 缺少 primary test hard fail", () => {
  const root = makeProofMappingChange("missing-map", {
    results: [],
  });

  const result = auditProofTestMapping({ root, change: "missing-map", discoveredTests: [] });

  assertRule(result, "MAP-TM-004");
});

test("non-durable proof 缺少 evidence result hard fail", () => {
  const root = makeProofMappingChange("missing-evidence-map", {
    sliceOverrides: nonDurableSliceOverrides(),
    results: [],
  });

  const result = auditProofTestMapping({ root, change: "missing-evidence-map", discoveredTests: [] });

  assertRule(result, "MAP-EV-004");
});

test("non-durable proof 使用 command evidence 时通过", () => {
  const root = makeProofMappingChange("valid-evidence-map", {
    sliceOverrides: nonDurableSliceOverrides(),
    results: [],
    evidenceResults: [proofEvidenceResult("PS-001")],
  });

  const result = auditProofTestMapping({ root, change: "valid-evidence-map", discoveredTests: [] });

  assert.equal(result.errorCount, 0, formatIssues(result));
});

test("proof-test-map 多 PS primary title hard fail", () => {
  const root = makeProofMappingChange("multi-title-map", {
    results: [proofResult("PS-001", { "test-title": "PS-001/PS-002 actor and owner denial" })],
  });

  const result = auditProofTestMapping({
    root,
    change: "multi-title-map",
    discoveredTests: [discovered("PS-001/PS-002 actor and owner denial")],
  });

  assertRule(result, "MAP-TM-007");
});

test("proof-test-map runner list 未发现 mapped test hard fail", () => {
  const root = makeProofMappingChange("runner-missing-map", {
    results: [proofResult("PS-001")],
  });

  const result = auditProofTestMapping({ root, change: "runner-missing-map", discoveredTests: [] });

  assertRule(result, "MAP-TM-009");
});

test("proof-test-map placement 错误 hard fail", () => {
  const root = makeProofMappingChange("bad-placement-map", {
    results: [proofResult("PS-001", { file: "packages/domain/src/foo.test.ts" })],
  });

  const result = auditProofTestMapping({
    root,
    change: "bad-placement-map",
    discoveredTests: [
      {
        runner: "vitest",
        file: "packages/domain/src/foo.test.ts",
        title: "PS-001 actor denial",
      },
    ],
  });

  assertRule(result, "MAP-TM-008");
});

test("component proof 实际文件落在 e2e 子树 hard fail", () => {
  const root = makeProofMappingChange("component-e2e-map", {
    sliceOverrides: {
      "test-layer": "component",
      "production-owner": "apps/web",
      "planned-test-directory": "apps/web/tests/component/**",
    },
    results: [proofResult("PS-001", { file: "apps/web/tests/e2e/foo.spec.ts" })],
  });

  const result = auditProofTestMapping({
    root,
    change: "component-e2e-map",
    discoveredTests: [
      {
        runner: "vitest",
        file: "apps/web/tests/e2e/foo.spec.ts",
        title: "PS-001 actor denial",
      },
    ],
  });

  assertRule(result, "MAP-TM-008");
});

test("route API proof 实际文件落在 owner 根 tests hard fail", () => {
  const root = makeProofMappingChange("api-root-tests-map", {
    sliceOverrides: {
      "test-layer": "route/API",
      "production-owner": "apps/control-api",
      "planned-test-directory": "apps/control-api/tests/api/**",
    },
    results: [proofResult("PS-001", { file: "apps/control-api/tests/foo.spec.ts" })],
  });

  const result = auditProofTestMapping({
    root,
    change: "api-root-tests-map",
    discoveredTests: [
      {
        runner: "vitest",
        file: "apps/control-api/tests/foo.spec.ts",
        title: "PS-001 actor denial",
      },
    ],
  });

  assertRule(result, "MAP-TM-008");
});

test("non-durable proof 不得进入 proof-test-results", () => {
  const root = makeProofMappingChange("nondurable-test-result-map", {
    sliceOverrides: nonDurableSliceOverrides(),
    results: [proofResult("PS-001")],
    evidenceResults: [proofEvidenceResult("PS-001")],
  });

  const result = auditProofTestMapping({
    root,
    change: "nondurable-test-result-map",
    discoveredTests: [discovered("PS-001 actor denial")],
  });

  assertRule(result, "MAP-TM-014");
});

test("durable proof 不得只写入 proof-evidence-results", () => {
  const root = makeProofMappingChange("durable-evidence-result-map", {
    results: [proofResult("PS-001")],
    evidenceResults: [proofEvidenceResult("PS-001")],
  });

  const result = auditProofTestMapping({
    root,
    change: "durable-evidence-result-map",
    discoveredTests: [discovered("PS-001 actor denial")],
  });

  assertRule(result, "MAP-EV-014");
});

test("browser proof 缺少稳定性复跑 hard fail", () => {
  const root = makeProofMappingChange("browser-no-validation-map", {
    sliceOverrides: browserSliceOverrides(),
    results: [playwrightResult({ "validation-runs": [] })],
  });

  const result = auditProofTestMapping({
    root,
    change: "browser-no-validation-map",
    discoveredTests: [
      {
        runner: "playwright",
        file: "apps/web/tests/e2e/foo.spec.ts",
        title: "PS-001 actor denial",
      },
    ],
  });

  assertRule(result, "MAP-TM-011");
});

test("browser proof 带稳定性复跑时通过", () => {
  const root = makeProofMappingChange("browser-valid-map", {
    sliceOverrides: browserSliceOverrides(),
    results: [
      playwrightResult({
        "execution-scope": "containing-file",
        "validation-runs": [
          {
            command: "pnpm exec playwright test apps/web/tests/e2e/foo.spec.ts --reporter=line",
            "exit-code": 0,
            "execution-scope": "containing-file",
            "repeat-each": 3,
            workers: 1,
          },
        ],
        "flake-status": "stable",
      }),
    ],
  });

  const result = auditProofTestMapping({
    root,
    change: "browser-valid-map",
    discoveredTests: [
      {
        runner: "playwright",
        file: "apps/web/tests/e2e/foo.spec.ts",
        title: "PS-001 actor denial",
      },
    ],
  });

  assert.equal(result.errorCount, 0, formatIssues(result));
});

function makeProofMappingChange(change, options) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "openspec-proof-map-"));
  const changeDir = path.join(root, "openspec", "changes", change, "trace");
  const resultDir = path.join(root, "openspec-results", change);
  fs.mkdirSync(changeDir, { recursive: true });
  fs.mkdirSync(resultDir, { recursive: true });

  fs.writeFileSync(
    path.join(changeDir, "verification.trace.json"),
    `${JSON.stringify(verificationTrace(proofSlices(options.sliceOverrides)), null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(changeDir, "manifest.json"),
    `${JSON.stringify(
      {
        "trace-schema": "openspec-trace-v1",
        "trace-contract-version": "verification-slice-register-v2",
        artifacts: [
          {
            "artifact-id": "verification",
            "artifact-path": "verification.md",
            "trace-path": "trace/verification.trace.json",
            "trace-schema": "openspec-trace-v1",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(
    path.join(resultDir, "proof-test-map.json"),
    `${JSON.stringify(
      {
        "trace-schema": "openspec-proof-test-map-v1",
        "change-name": change,
        "proof-test-results": options.results,
        "proof-evidence-results": options.evidenceResults ?? [],
      },
      null,
      2,
    )}\n`,
  );
  return root;
}

function verificationTrace(slices) {
  return {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "verification",
    "artifact-path": "verification.md",
    "change-name": "test",
    "schema-name": "production-obligation-atom-driven",
    "source-interface": {},
    "verification-slice-register": slices,
  };
}

function proofSlices(sliceOverrides = {}) {
  return [
    {
      "slice-id": "PS-001",
      "runtime-fact-ids": ["RS-001"],
      "primary-runtime-fact-id": "RS-001",
      "proof-type": "authorization",
      branch: "actor denial",
      oracle: "拒绝无效 actor。",
      "failure-signal": "无效 actor 被接受。",
      "test-layer": "contract",
      "production-owner": "packages/domain",
      "assertion-shape": "authorization denial",
      "fixture-boundary": "actor fixture",
      "proof-evidence-mode": "durable-test",
      "planned-test-directory": "packages/domain/tests/contract/**",
      "non-persistent-reason": "N/A",
      ...sliceOverrides,
    },
  ];
}

function nonDurableSliceOverrides() {
  return {
    "proof-evidence-mode": "readiness-command",
    "planned-test-directory": "N/A",
    "non-persistent-reason": "readiness command proof 不适合沉淀为持久测试。",
  };
}

function proofResult(sliceId, overrides = {}) {
  return {
    "slice-id": sliceId,
    status: "passed",
    runner: "vitest",
    file: "packages/domain/tests/contract/generate-first-draft.contract.test.ts",
    "test-title": `${sliceId} actor denial`,
    filter: `${sliceId} actor denial`,
    command: `pnpm vitest --run packages/domain/tests/contract/generate-first-draft.contract.test.ts -t "${sliceId}"`,
    ...overrides,
  };
}

function proofEvidenceResult(sliceId, overrides = {}) {
  return {
    "slice-id": sliceId,
    "proof-evidence-mode": "readiness-command",
    status: "passed",
    command: "pnpm build",
    "exit-code": 0,
    ...overrides,
  };
}

function discovered(title) {
  return {
    runner: "vitest",
    file: "packages/domain/tests/contract/generate-first-draft.contract.test.ts",
    title,
  };
}

function browserSliceOverrides() {
  return {
    "proof-type": "layout",
    branch: "mobile canvas interaction",
    oracle: "移动端画布可交互。",
    "failure-signal": "移动端画布无法插入标记。",
    "test-layer": "browser/e2e",
    "production-owner": "apps/web",
    "assertion-shape": "browser readback",
    "planned-test-directory": "apps/web/tests/e2e/**",
  };
}

function playwrightResult(overrides = {}) {
  return proofResult("PS-001", {
    runner: "playwright",
    file: "apps/web/tests/e2e/foo.spec.ts",
    "test-title": "PS-001 actor denial",
    filter: "PS-001 actor denial",
    command: "pnpm exec playwright test apps/web/tests/e2e/foo.spec.ts --grep \"PS-001\" --reporter=line",
    "execution-scope": "focused-test",
    "validation-runs": [],
    ...overrides,
  });
}

function assertRule(result, ruleId) {
  assert.ok(
    result.issues.some((issue) => issue.ruleId === ruleId),
    `expected ${ruleId}; got:\n${formatIssues(result)}`,
  );
}

function formatIssues(result) {
  return result.issues.map((issue) => `${issue.ruleId}: ${issue.message}`).join("\n");
}
