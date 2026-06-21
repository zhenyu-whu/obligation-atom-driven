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
    results: [proofResult("PS-001", { file: "apps/web/tests/api/foo.test.ts" })],
    discoveredTests: [
      {
        runner: "vitest",
        file: "apps/web/tests/api/foo.test.ts",
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
        file: "apps/web/tests/api/foo.test.ts",
        title: "PS-001 actor denial",
      },
    ],
  });
  assertRule(result, "MAP-TM-008");
});

function makeProofMappingChange(change, options) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "openspec-proof-map-"));
  const changeDir = path.join(root, "openspec", "changes", change, "trace");
  const resultDir = path.join(root, "openspec-results", change);
  fs.mkdirSync(changeDir, { recursive: true });
  fs.mkdirSync(resultDir, { recursive: true });
  fs.writeFileSync(path.join(changeDir, "verification.proof-slices.json"), `${JSON.stringify(proofSlices(), null, 2)}\n`);
  fs.writeFileSync(
    path.join(resultDir, "proof-test-map.json"),
    `${JSON.stringify(
      {
        "trace-schema": "openspec-proof-test-map-v1",
        "change-name": change,
        "proof-test-results": options.results,
      },
      null,
      2,
    )}\n`,
  );
  return root;
}

function proofSlices() {
  return {
    "trace-schema": "openspec-proof-slices-v1",
    "artifact-id": "verification",
    "artifact-path": "verification.md",
    "change-name": "test",
    "schema-name": "production-obligation-atom-driven",
    "proof-slices": [
      {
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
        "primary-assertion-shape": "authorization denial",
        "fixture-mock-boundary": "actor fixture",
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

function discovered(title) {
  return {
    runner: "vitest",
    file: "packages/domain/tests/contract/generate-first-draft.contract.test.ts",
    title,
  };
}

function assertRule(result, ruleId) {
  assert.ok(
    result.issues.some((issue) => issue.ruleId === ruleId),
    `expected ${ruleId}, got ${JSON.stringify(result.issues, null, 2)}`,
  );
}
