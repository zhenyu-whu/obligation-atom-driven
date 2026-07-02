import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { auditProofTestMapping } from "./audit-proof-test-mapping.mjs";

test("proof-test-map 每个 PS 一个 primary test 时通过", () => {
  const root = makeProofMappingChange("valid-map", {
    results: [proofResult("PS-001")],
    discoveredTests: [discovered("PS-001 actor denial")],
  });
  const result = auditProofTestMapping({
    root,
    change: "valid-map",
    discoveredTests: [discovered("PS-001 actor denial")],
  });
  assert.equal(result.errorCount, 0);
});

test("proof-test-map 缺少 required PS hard fail", () => {
  const root = makeProofMappingChange("missing-map", {
    results: [],
    discoveredTests: [],
  });
  const result = auditProofTestMapping({ root, change: "missing-map", discoveredTests: [] });
  assertRule(result, "MAP-TM-004");
});

test("non-persistent proof 缺少 evidence result hard fail", () => {
  const root = makeProofMappingChange("missing-evidence-map", {
    sliceOverrides: nonPersistentSliceOverrides(),
    results: [],
    discoveredTests: [],
  });
  const result = auditProofTestMapping({ root, change: "missing-evidence-map", discoveredTests: [] });
  assertRule(result, "MAP-EV-004");
});

test("non-persistent proof 使用 command evidence 时通过", () => {
  const root = makeProofMappingChange("valid-evidence-map", {
    sliceOverrides: nonPersistentSliceOverrides(),
    results: [],
    evidenceResults: [proofEvidenceResult("PS-001")],
    discoveredTests: [],
  });
  const result = auditProofTestMapping({ root, change: "valid-evidence-map", discoveredTests: [] });
  assert.equal(result.errorCount, 0);
});

test("proof-test-map 多 PS primary title hard fail", () => {
  const root = makeProofMappingChange("multi-title-map", {
    results: [proofResult("PS-001", { "test-title": "PS-001/PS-002 actor and owner denial" })],
    discoveredTests: [discovered("PS-001/PS-002 actor and owner denial")],
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
    discoveredTests: [],
  });
  const result = auditProofTestMapping({ root, change: "runner-missing-map", discoveredTests: [] });
  assertRule(result, "MAP-TM-009");
});

test("proof-test-map placement 错误 hard fail", () => {
  const root = makeProofMappingChange("bad-placement-map", {
    results: [proofResult("PS-001", { file: "packages/domain/src/foo.test.ts" })],
    discoveredTests: [
      {
        runner: "vitest",
        file: "packages/domain/src/foo.test.ts",
        title: "PS-001 actor denial",
      },
    ],
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
      "primary-layer": "component",
      "production-owner": "apps/web",
      "test-contract": {
        placement: {
          "planned-test-directory": "apps/web/tests/component/**",
          "placement-basis": "planned-layer-subdirectory",
          "placement-reason": "component proof 使用 apps/web component tests。",
        },
      },
    },
    results: [proofResult("PS-001", { file: "apps/web/tests/e2e/foo.spec.ts" })],
    discoveredTests: [
      {
        runner: "vitest",
        file: "apps/web/tests/e2e/foo.spec.ts",
        title: "PS-001 actor denial",
      },
    ],
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
      "primary-layer": "route/API",
      "production-owner": "apps/control-api",
      "test-contract": {
        placement: {
          "planned-test-directory": "apps/control-api/tests/api/**",
          "placement-basis": "existing-tests-directory",
          "placement-reason": "route/API proof 使用 apps/control-api api tests。",
        },
      },
    },
    results: [proofResult("PS-001", { file: "apps/control-api/tests/foo.spec.ts" })],
    discoveredTests: [
      {
        runner: "vitest",
        file: "apps/control-api/tests/foo.spec.ts",
        title: "PS-001 actor denial",
      },
    ],
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

test("non-persistent proof 不得进入 proof-test-results", () => {
  const root = makeProofMappingChange("nonpersistent-test-result-map", {
    sliceOverrides: nonPersistentSliceOverrides(),
    results: [proofResult("PS-001")],
    evidenceResults: [proofEvidenceResult("PS-001")],
    discoveredTests: [discovered("PS-001 actor denial")],
  });
  const result = auditProofTestMapping({
    root,
    change: "nonpersistent-test-result-map",
    discoveredTests: [discovered("PS-001 actor denial")],
  });
  assertRule(result, "MAP-TM-014");
});

test("browser proof 缺少 containing-file validation hard fail", () => {
  const root = makeProofMappingChange("browser-missing-validation-map", {
    sliceOverrides: browserSliceOverrides(),
    results: [
      playwrightResult({
        "validation-runs": [],
      }),
    ],
  });
  const result = auditProofTestMapping({
    root,
    change: "browser-missing-validation-map",
    discoveredTests: [discoveredPlaywright()],
  });
  assertRule(result, "MAP-TM-011");
});

test("browser proof 缺少 stable flake evidence hard fail", () => {
  const root = makeProofMappingChange("browser-unstable-map", {
    sliceOverrides: browserSliceOverrides(),
    results: [
      playwrightResult({
        "flake-status": "unknown",
      }),
    ],
  });
  const result = auditProofTestMapping({
    root,
    change: "browser-unstable-map",
    discoveredTests: [discoveredPlaywright()],
  });
  assertRule(result, "MAP-TM-012");
});

test("browser proof validation-runs 含失败记录 hard fail", () => {
  const root = makeProofMappingChange("browser-failed-validation-map", {
    sliceOverrides: browserSliceOverrides(),
    results: [
      playwrightResult({
        "validation-runs": [
          passingPlaywrightValidationRun({ command: "pnpm exec playwright test apps/web/tests/e2e/foo.spec.ts --reporter=line # first" }),
          passingPlaywrightValidationRun({ command: "pnpm exec playwright test apps/web/tests/e2e/foo.spec.ts --reporter=line # second" }),
          {
            command: "pnpm exec playwright test apps/web/tests/e2e/foo.spec.ts --reporter=line",
            "execution-scope": "containing-file",
            status: "failed",
            "exit-status": 1,
          },
        ],
      }),
    ],
  });
  const result = auditProofTestMapping({
    root,
    change: "browser-failed-validation-map",
    discoveredTests: [discoveredPlaywright()],
  });
  assertRule(result, "MAP-TM-013");
});

test("browser proof 两次 containing-file pass 且 stable 时通过", () => {
  const root = makeProofMappingChange("browser-stable-map", {
    sliceOverrides: browserSliceOverrides(),
    results: [playwrightResult()],
  });
  const result = auditProofTestMapping({
    root,
    change: "browser-stable-map",
    discoveredTests: [discoveredPlaywright()],
  });
  assert.equal(result.errorCount, 0);
});

function makeProofMappingChange(change, options) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "openspec-proof-map-"));
  const changeDir = path.join(root, "openspec", "changes", change, "trace");
  const resultDir = path.join(root, "openspec-results", change);
  fs.mkdirSync(changeDir, { recursive: true });
  fs.mkdirSync(resultDir, { recursive: true });
  fs.writeFileSync(
    path.join(changeDir, "verification.proof-slices.json"),
    `${JSON.stringify(proofSlices(options.sliceOverrides), null, 2)}\n`,
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

function proofSlices(sliceOverrides = {}) {
  const baseContract = {
    "primary-test-cardinality": "exactly-one",
    "test-title-prefix": "PS-001",
    "allow-shared-setup": true,
    "allow-multi-slice-primary-test": false,
    "waiver-required-for-multi-slice": true,
    placement: {
      "planned-test-directory": "packages/domain/tests/contract/**",
      "placement-basis": "existing-tests-directory",
      "placement-reason": "contract proof 使用 packages/domain contract tests。",
    },
  };
  const baseSlice = {
    "slice-id": "PS-001",
    "runtime-row-ids": ["RS-001"],
    "primary-runtime-row-id": "RS-001",
    "primitive-type": "authorization",
    "branch-variant": "actor denial",
    "observable-surface": "domain command",
    "oracle-fragment": "拒绝无效 actor。",
    "failure-signal": "无效 actor 被接受。",
    "primary-layer": "contract",
    "production-owner": "packages/domain",
    "persistent-test-required": true,
    "proof-evidence-mode": "durable-test",
    "primary-assertion-shape": "authorization denial",
    "fixture-mock-boundary": "actor fixture",
    "regression-intent": "high",
    "manual-environment-gate": "None",
    "test-contract": baseContract,
  };
  const testContractOverrides = sliceOverrides["test-contract"] ?? {};
  const slice = {
    ...baseSlice,
    ...sliceOverrides,
    "test-contract": {
      ...baseContract,
      ...testContractOverrides,
    },
  };
  return {
    "trace-schema": "openspec-proof-slices-v1",
    "artifact-id": "verification",
    "artifact-path": "verification.md",
    "change-name": "test",
    "schema-name": "production-obligation-atom-driven",
    "proof-slices": [slice],
  };
}

function nonPersistentSliceOverrides() {
  return {
    "persistent-test-required": false,
    "proof-evidence-mode": "readiness-command",
    "test-contract": {
      "primary-test-cardinality": "none",
      placement: {
        "planned-test-directory": "N/A",
        "placement-basis": "nonpersistent-evidence",
        "placement-reason": "非持久 readiness evidence。",
      },
    },
  };
}

function proofResult(sliceId, overrides = {}) {
  return {
    "slice-id": sliceId,
    status: "passed",
    runner: "vitest",
    file: "packages/domain/tests/contract/generate-first-draft.contract.test.ts",
    "test-title": `${sliceId} actor denial`,
    filter: `^${sliceId}\\b`,
    command: `pnpm exec vitest run packages/domain/tests/contract/generate-first-draft.contract.test.ts -t '^${sliceId}\\b'`,
    ...overrides,
  };
}

function proofEvidenceResult(sliceId, overrides = {}) {
  return {
    "slice-id": sliceId,
    status: "passed",
    "proof-evidence-mode": "readiness-command",
    command: "pnpm readiness:workspace",
    "exit-status": 0,
    "runtime-row-ids": ["RS-001"],
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
    "primitive-type": "layout",
    "observable-surface": "editor canvas",
    "oracle-fragment": "移动端画布可交互。",
    "failure-signal": "移动端画布无法插入标记。",
    "primary-layer": "browser/e2e",
    "production-owner": "apps/web",
    "primary-assertion-shape": "browser readback",
    "test-contract": {
      placement: {
        "planned-test-directory": "apps/web/tests/e2e/**",
        "placement-basis": "existing-tests-directory",
        "placement-reason": "browser proof 使用 apps/web e2e tests。",
      },
    },
  };
}

function playwrightResult(overrides = {}) {
  return proofResult("PS-001", {
    runner: "playwright",
    file: "apps/web/tests/e2e/foo.spec.ts",
    "test-title": "PS-001 actor denial",
    filter: "PS-001 actor denial",
    command: "pnpm exec playwright test apps/web/tests/e2e/foo.spec.ts --grep \"PS-001\" --reporter=line",
    "command-exit-status": 0,
    "execution-scope": "focused-test",
    "flake-status": "stable",
    "validation-runs": [
      passingPlaywrightValidationRun({ command: "pnpm exec playwright test apps/web/tests/e2e/foo.spec.ts --reporter=line # first" }),
      passingPlaywrightValidationRun({ command: "pnpm exec playwright test apps/web/tests/e2e/foo.spec.ts --reporter=line # second" }),
    ],
    ...overrides,
  });
}

function passingPlaywrightValidationRun(overrides = {}) {
  return {
    command: "pnpm exec playwright test apps/web/tests/e2e/foo.spec.ts --reporter=line",
    "execution-scope": "containing-file",
    status: "passed",
    "exit-status": 0,
    ...overrides,
  };
}

function discoveredPlaywright(title = "PS-001 actor denial") {
  return {
    runner: "playwright",
    file: "apps/web/tests/e2e/foo.spec.ts",
    title,
  };
}

function assertRule(result, ruleId) {
  assert.ok(
    result.issues.some((issue) => issue.ruleId === ruleId),
    `expected ${ruleId}, got ${JSON.stringify(result.issues, null, 2)}`,
  );
}
