import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { renderChangeArtifact } from "./render-production-artifacts.mjs";
import { validateChange } from "./validate-production-artifacts.mjs";
import { validateDesignArtifact } from "./validators/validate-design-artifact.mjs";
import { validateProposalArtifact } from "./validators/validate-proposal-artifact.mjs";
import { validateRuntimeAcceptanceArtifact } from "./validators/validate-runtime-acceptance-artifact.mjs";
import { validateSpecsArtifact } from "./validators/validate-specs-artifact.mjs";
import { validateTasksArtifact } from "./validators/validate-tasks-artifact.mjs";
import { validateVerificationArtifact } from "./validators/validate-verification-artifact.mjs";

test("proposal validator passes minimal obligation proposal contract", () => {
  const change = "validator-obligation-change";
  const root = makeObligationFixture(change);

  const result = validateChange({ root, change });

  assert.equal(result.ok, true, formatErrors(result));
});

test("standalone proposal validator passes minimal obligation proposal contract", () => {
  const change = "validator-standalone-obligation-change";
  const root = makeObligationFixture(change);

  const result = validateProposalArtifact({ root, change });

  assert.equal(result.ok, true, formatErrors(result));
});

test("proposal validator rejects missing direct atom register rows", () => {
  const change = "validator-obligation-missing-register-change";
  const root = makeObligationFixture(change);
  updateProposalTrace(root, change, (trace) => {
    trace["change-atom-coverage-register"] = [];
  });

  const result = validateChange({ root, change });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-OBLIGATION-REGISTER-002");
});

test("proposal validator passes minimal default proposal contract", () => {
  const change = "validator-default-change";
  const root = makeDefaultFixture(change);

  const result = validateChange({ root, change });

  assert.equal(result.ok, true, formatErrors(result));
});

test("proposal validator rejects default proposal obligation authority leaks", () => {
  const change = "validator-default-ga-leak-change";
  const root = makeDefaultFixture(change);
  updateProposalTrace(root, change, (trace) => {
    trace["delivery-plane"].why = ["- 错误泄漏 GA-0001。"];
  });

  const result = validateChange({ root, change });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DEFAULT-DELIVERY-001");
});

test("proposal validator rejects handwritten markdown drift", () => {
  const change = "validator-render-drift-change";
  const root = makeDefaultFixture(change);
  fs.appendFileSync(
    path.join(root, "openspec", "changes", change, "proposal.md"),
    "\n手写漂移。\n",
  );

  const result = validateChange({ root, change });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RENDER-003");
});

test("specs validator passes minimal obligation specs contract", () => {
  const change = "validator-obligation-specs-change";
  const root = makeObligationSpecsFixture(change);

  const result = validateChange({ root, change, artifact: "specs" });

  assert.equal(result.ok, true, formatErrors(result));
});

test("standalone specs validator passes minimal obligation specs contract", () => {
  const change = "validator-standalone-obligation-specs-change";
  const root = makeObligationSpecsFixture(change);

  const result = validateSpecsArtifact({ root, change });

  assert.equal(result.ok, true, formatErrors(result));
});

test("specs validator passes minimal default specs contract", () => {
  const change = "validator-default-specs-change";
  const root = makeDefaultSpecsFixture(change);

  const result = validateChange({ root, change, artifact: "specs" });

  assert.equal(result.ok, true, formatErrors(result));
});

test("specs validator rejects default specs GA leaks", () => {
  const change = "validator-default-specs-ga-leak-change";
  const root = makeDefaultSpecsFixture(change);
  updateSpecsTrace(root, change, "capability-a", (trace) => {
    trace["delivery-plane"]["added-requirements"][0].body = "系统 SHALL 完成最小闭环，但错误泄漏 GA-0001。";
  }, { render: true });

  const result = validateChange({ root, change, artifact: "specs" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-SPECS-DEFAULT-001");
});

test("specs validator passes default no-delta specs contract", () => {
  const change = "validator-default-no-delta-specs-change";
  const root = makeDefaultNoDeltaSpecsFixture(change);

  const result = validateChange({ root, change, artifact: "specs" });

  assert.equal(result.ok, true, formatErrors(result));
});

test("specs validator rejects no-delta when proposal has spec-relevant items", () => {
  const change = "validator-no-delta-with-spec-items-change";
  const root = makeDefaultFixture(change);
  writeDefaultNoDeltaSpecsTrace(root, change);
  renderChangeArtifact({ root, change, artifact: "specs", noDeltaSpecs: true, write: true });

  const result = validateChange({ root, change, artifact: "specs" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-SPECS-MODE-002");
});

test("specs validator rejects missing or extra requirement source trace IDs", () => {
  const change = "validator-specs-extra-source-id-change";
  const root = makeObligationSpecsFixture(change);
  updateSpecsTrace(root, change, "capability-a", (trace) => {
    trace["requirement-source-trace"][0]["global-atom-id"] = "GA-9999";
  });

  const result = validateChange({ root, change, artifact: "specs" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-SPECS-SOURCE-002");
  assertHasRule(result, "VAL-SPECS-SOURCE-008");
});

test("specs validator rejects non-direct boundary GA propagation", () => {
  const change = "validator-specs-boundary-ga-change";
  const root = makeObligationSpecsFixture(change);
  updateSpecsTrace(root, change, "capability-a", (trace) => {
    trace["requirement-source-trace"][0]["global-atom-id"] = "GA-0002";
  });

  const result = validateChange({ root, change, artifact: "specs" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-SPECS-SOURCE-002");
});

test("specs validator rejects missing guard handling", () => {
  const change = "validator-specs-missing-guard-handling-change";
  const root = makeObligationFixture(change);
  addObligationGuardProposalRow(root, change);
  writeObligationSpecsTrace(root, change, { includeGuard: true, omitGuardHandling: true });
  renderChangeArtifact({ root, change, artifact: "specs", capability: "capability-a", write: true });

  const result = validateChange({ root, change, artifact: "specs" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-SPECS-SOURCE-022");
});

test("specs validator rejects delivery-only scenario", () => {
  const change = "validator-specs-delivery-only-scenario-change";
  const root = makeObligationSpecsFixture(change);
  updateSpecsTrace(root, change, "capability-a", (trace) => {
    trace["delivery-plane"]["added-requirements"][0].scenarios.push({
      name: "未追踪场景",
      when: "用户触发未追踪操作",
      then: "系统返回未追踪结果",
    });
  }, { render: true });

  const result = validateChange({ root, change, artifact: "specs" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-SPECS-DELIVERY-001");
});

test("specs validator rejects handwritten specs markdown drift", () => {
  const change = "validator-specs-render-drift-change";
  const root = makeObligationSpecsFixture(change);
  fs.appendFileSync(
    path.join(root, "openspec", "changes", change, "specs", "capability-a", "spec.md"),
    "\n手写 specs 漂移。\n",
  );

  const result = validateChange({ root, change, artifact: "specs" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-SPECS-RENDER-003");
});

test("design validator passes minimal obligation design contract", () => {
  const change = "validator-obligation-design-change";
  const root = makeObligationDesignFixture(change);

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, true, formatErrors(result));
});

test("standalone design validator passes minimal obligation design contract", () => {
  const change = "validator-standalone-obligation-design-change";
  const root = makeObligationDesignFixture(change);

  const result = validateDesignArtifact({ root, change });

  assert.equal(result.ok, true, formatErrors(result));
});

test("design validator passes minimal default design contract", () => {
  const change = "validator-default-design-change";
  const root = makeDefaultDesignFixture(change);

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, true, formatErrors(result));
});

test("design validator passes default no-delta specs design contract", () => {
  const change = "validator-default-no-delta-design-change";
  const root = makeDefaultNoDeltaDesignFixture(change);

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, true, formatErrors(result));
});

test("design validator rejects missing production source map IDs", () => {
  const change = "validator-design-missing-source-map-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["production-source-map"] = [];
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-SOURCE-008");
});

test("design validator rejects unknown specs anchors", () => {
  const change = "validator-design-unknown-spec-anchor-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["spec-scenario-design-map"][0]["trace-pointer"] = "#/requirement-source-trace/99";
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-SPEC-002");
});

test("design validator rejects unknown decision references", () => {
  const change = "validator-design-unknown-decision-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["design-obligation-matrix"][0]["decision-ids"] = ["D-999"];
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-REF-002");
});

test("design validator rejects default design GA leaks", () => {
  const change = "validator-default-design-ga-leak-change";
  const root = makeDefaultDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["delivery-plane"].context = ["- 错误泄漏 GA-0001。"];
  }, { render: true });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-DEFAULT-001");
});

test("design validator rejects production alignment gate blockers", () => {
  const change = "validator-design-gate-blocker-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["production-alignment-gate"].blockers = ["unresolved design blocker"];
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-GATE-003");
});

test("design validator rejects handwritten design markdown drift", () => {
  const change = "validator-design-render-drift-change";
  const root = makeObligationDesignFixture(change);
  fs.appendFileSync(
    path.join(root, "openspec", "changes", change, "design.md"),
    "\n手写 design 漂移。\n",
  );

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-RENDER-003");
});

test("runtime validator skips when no runtime output exists", () => {
  const change = "validator-runtime-skip-change";
  const root = makeObligationDesignFixture(change);

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, true, formatErrors(result));
  assert.ok(result.warnings.some((warning) => warning.ruleId === "VAL-RUNTIME-000"));
});

test("runtime validator rejects artifact without trace", () => {
  const change = "validator-runtime-missing-trace-change";
  const root = makeObligationDesignFixture(change);
  writeText(root, `openspec/changes/${change}/runtime-acceptance.md`, "handwritten runtime acceptance\n");

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-001");
});

test("runtime validator passes minimal obligation runtime contract", () => {
  const change = "validator-obligation-runtime-change";
  const root = makeObligationRuntimeFixture(change);

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, true, formatErrors(result));
});

test("standalone runtime validator passes minimal obligation runtime contract", () => {
  const change = "validator-standalone-obligation-runtime-change";
  const root = makeObligationRuntimeFixture(change);

  const result = validateRuntimeAcceptanceArtifact({ root, change });

  assert.equal(result.ok, true, formatErrors(result));
});

test("runtime validator passes minimal default runtime contract", () => {
  const change = "validator-default-runtime-change";
  const root = makeDefaultRuntimeFixture(change);

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, true, formatErrors(result));
});

test("runtime validator rejects handwritten runtime markdown drift", () => {
  const change = "validator-runtime-render-drift-change";
  const root = makeObligationRuntimeFixture(change);
  fs.appendFileSync(
    path.join(root, "openspec", "changes", change, "runtime-acceptance.md"),
    "\n手写 runtime 漂移。\n",
  );

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-RENDER-003");
});

test("runtime validator rejects canonical required field missing through renderer", () => {
  const change = "validator-runtime-required-field-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    delete trace["delivery-plane"]["canonical-rows"][0]["default-path-policy"];
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-RENDER-002");
});

test("runtime validator rejects source-interface markdown input", () => {
  const change = "validator-runtime-source-interface-markdown-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["source-interface"]["proposal-artifact"] = "proposal.md";
    trace["source-interface"]["verification-trace"] = "trace/verification.trace.json";
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-SOURCE-INTERFACE-010");
  assertHasRule(result, "VAL-RUNTIME-SOURCE-INTERFACE-011");
});

test("runtime validator rejects source-interface specs mode and trace set drift", () => {
  const change = "validator-runtime-source-interface-specs-drift-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["source-interface"]["specs-completion-mode"] = "no-delta";
    trace["source-interface"]["spec-traces"] = [];
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-SOURCE-INTERFACE-003");
  assertHasRule(result, "VAL-RUNTIME-SOURCE-INTERFACE-005");
});

test("runtime validator rejects default runtime GA leak", () => {
  const change = "validator-default-runtime-ga-leak-change";
  const root = makeDefaultRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["delivery-plane"]["runtime-acceptance-intent"]["source-basis"] = "错误泄漏 GA-0001。";
  }, { render: true });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-PROFILE-002");
});

test("runtime validator rejects missing proposal upstream coverage", () => {
  const change = "validator-runtime-proposal-coverage-gap-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["runtime-upstream-coverage-map"] = trace["runtime-upstream-coverage-map"].filter(
      (row) => row["upstream-item-type"] !== "proposal-direct-atom",
    );
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-COVERAGE-003");
});

test("runtime validator rejects missing spec scenario upstream coverage", () => {
  const change = "validator-runtime-spec-coverage-gap-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["runtime-upstream-coverage-map"] = trace["runtime-upstream-coverage-map"].filter(
      (row) => row["upstream-item-type"] !== "spec-scenario",
    );
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-COVERAGE-003");
});

test("runtime validator rejects missing design decision upstream coverage", () => {
  const change = "validator-runtime-design-decision-coverage-gap-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["runtime-upstream-coverage-map"] = trace["runtime-upstream-coverage-map"].filter(
      (row) => row["upstream-item-type"] !== "design-decision",
    );
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-COVERAGE-003");
});

test("runtime validator rejects coverage map and inventory mismatch", () => {
  const change = "validator-runtime-coverage-inventory-mismatch-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["runtime-upstream-coverage-map"].push({
      "upstream-item-id": "D-999",
      "upstream-item-type": "design-decision",
      "projection-handling": "runtime-surface",
      "runtime-row-ids": ["RS-001"],
      "coverage-mode": "covered-by-runtime-rows",
      "not-applicable-reason": "N/A",
      "coverage-note": "extra row",
    });
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-COVERAGE-003");
});

test("runtime validator rejects invalid not-applicable inventory row", () => {
  const change = "validator-runtime-not-applicable-shape-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["runtime-not-applicable-inventory"].push({
      "upstream-item-id": "GA-0001",
      "upstream-item-type": "proposal-direct-atom",
      "artifact-projection": "spec-requirement",
      "runtime-row-ids": ["RS-001"],
    });
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-NOT-APPLICABLE-004");
  assertHasRule(result, "VAL-RUNTIME-NOT-APPLICABLE-005");
});

test("runtime validator rejects canonical row covered only by source map", () => {
  const change = "validator-runtime-source-map-only-row-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["canonical-row-index"]["surface-rows"].push("RS-002");
    trace["delivery-plane"]["canonical-rows"].push(runtimeSurfaceRow("RS-002", "GA-0001; D-001."));
    trace["runtime-coverage-source-map"].push({
      "source-group": "source-map-only",
      "row-ids": ["RS-002"],
      "source-basis": ["GA-0001", "D-001"],
      "coverage-note": "summary only",
    });
  }, { render: true });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-CANONICAL-COVERAGE-001");
});

test("runtime validator rejects coverage row unknown runtime row", () => {
  const change = "validator-runtime-unknown-row-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["runtime-upstream-coverage-map"][0]["runtime-row-ids"] = ["RS-999"];
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-COVERAGE-007");
});

test("runtime validator rejects proposal projection drift", () => {
  const change = "validator-runtime-projection-drift-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["runtime-upstream-coverage-map"][0]["artifact-projection"] = "design-obligation";
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-PROJECTION-001");
});

test("runtime validator rejects forbidden proof slice fields", () => {
  const change = "validator-runtime-forbidden-proof-slice-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["proof-slice-model"] = {};
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-FORBIDDEN-001");
});

test("verification validator skips when no verification output exists", () => {
  const change = "validator-verification-skip-change";
  const root = makeObligationRuntimeFixture(change);

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, true, formatErrors(result));
  assert.ok(result.warnings.some((warning) => warning.ruleId === "VAL-VERIFICATION-000"));
});

test("verification validator rejects artifact without trace", () => {
  const change = "validator-verification-missing-trace-change";
  const root = makeObligationRuntimeFixture(change);
  writeText(root, `openspec/changes/${change}/verification.md`, "handwritten verification\n");

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-001");
});

test("verification validator passes minimal obligation verification contract", () => {
  const change = "validator-obligation-verification-change";
  const root = makeObligationVerificationFixture(change);

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, true, formatErrors(result));
});

test("standalone verification validator passes minimal obligation verification contract", () => {
  const change = "validator-standalone-obligation-verification-change";
  const root = makeObligationVerificationFixture(change);

  const result = validateVerificationArtifact({ root, change });

  assert.equal(result.ok, true, formatErrors(result));
});

test("verification validator passes minimal default verification contract", () => {
  const change = "validator-default-verification-change";
  const root = makeDefaultVerificationFixture(change);

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, true, formatErrors(result));
});

test("verification validator rejects handwritten verification markdown drift", () => {
  const change = "validator-verification-render-drift-change";
  const root = makeObligationVerificationFixture(change);
  fs.appendFileSync(
    path.join(root, "openspec", "changes", change, "verification.md"),
    "\n手写 verification 漂移。\n",
  );

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-RENDER-003");
});

test("verification validator rejects missing inline proof slice model", () => {
  const change = "validator-verification-missing-inline-model-change";
  const root = makeObligationVerificationFixture(change);
  updateVerificationTrace(root, change, (trace) => {
    delete trace["proof-slice-model"];
  });

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-MODEL-001");
});

test("verification validator rejects legacy proof slice sidecar", () => {
  const change = "validator-verification-legacy-sidecar-change";
  const root = makeObligationVerificationFixture(change);
  const manifestPath = path.join(root, "openspec", "changes", change, "trace", "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest["trace-contract-version"] = "proof-slices-v1";
  manifest.artifacts.push({
    "artifact-id": "verification",
    "artifact-path": "verification.md",
    "trace-path": "trace/verification.proof-slices.json",
    "trace-schema": "openspec-proof-slices-v1",
  });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeJson(root, `openspec/changes/${change}/trace/verification.proof-slices.json`, verificationProofSliceModel());

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-INLINE-001");
  assertHasRule(result, "VAL-VERIFICATION-INLINE-002");
  assertHasRule(result, "VAL-VERIFICATION-MANIFEST-003");
});

test("verification validator rejects unknown runtime row", () => {
  const change = "validator-verification-unknown-runtime-row-change";
  const root = makeObligationVerificationFixture(change);
  updateVerificationTrace(root, change, (trace) => {
    trace["proof-slice-model"]["proof-slices"][0]["runtime-row-ids"] = ["RS-999"];
  });

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-SLICE-005");
});

test("verification validator rejects primary runtime row outside slice rows", () => {
  const change = "validator-verification-primary-row-outside-slice-change";
  const root = makeObligationVerificationFixture(change);
  updateVerificationTrace(root, change, (trace) => {
    trace["proof-slice-model"]["proof-slices"][0]["primary-runtime-row-id"] = "OP-001";
  });

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-SLICE-007");
});

test("verification validator rejects persistent evidence mismatch", () => {
  const change = "validator-verification-persistent-mode-mismatch-change";
  const root = makeObligationVerificationFixture(change);
  updateVerificationTrace(root, change, (trace) => {
    trace["proof-slice-model"]["proof-slices"][0]["proof-evidence-mode"] = "readiness-command";
  });

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-PERSISTENCE-002");
});

test("verification validator rejects concrete test file placement", () => {
  const change = "validator-verification-concrete-test-file-change";
  const root = makeObligationVerificationFixture(change);
  updateVerificationTrace(root, change, (trace) => {
    trace["proof-slice-model"]["proof-slices"][0]["test-contract"].placement["planned-test-directory"] =
      "apps/control-api/tests/api/minimal.test.ts";
  });

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-PLACEMENT-004");
  assertHasRule(result, "VAL-VERIFICATION-FORBIDDEN-001");
});

test("verification validator rejects manual branch missing inventory row", () => {
  const change = "validator-verification-manual-branch-gap-change";
  const root = makeObligationVerificationFixture(change);
  updateVerificationTrace(root, change, (trace) => {
    trace["runtime-row-branch-inventory"][0].handling = "manual-environment";
    trace["runtime-row-branch-inventory"][0]["expected-proof-slice-ids"] = [];
    trace["manual-not-applicable-inventory"] = [];
  });

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-BRANCH-017");
});

test("verification validator rejects reconciliation missing runtime row", () => {
  const change = "validator-verification-reconciliation-gap-change";
  const root = makeObligationVerificationFixture(change);
  updateVerificationTrace(root, change, (trace) => {
    trace["runtime-coverage-reconciliation"] = [];
  });

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-RECONCILIATION-017");
});

test("verification validator rejects covered row with missing proof slice ids", () => {
  const change = "validator-verification-covered-missing-slices-change";
  const root = makeObligationVerificationFixture(change);
  updateVerificationTrace(root, change, (trace) => {
    trace["runtime-coverage-reconciliation"][0]["missing-proof-slice-ids"] = ["PS-999"];
  });

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-RECONCILIATION-011");
});

test("verification validator rejects fixed command and result path leaks", () => {
  const change = "validator-verification-command-leak-change";
  const root = makeObligationVerificationFixture(change);
  updateVerificationTrace(root, change, (trace) => {
    trace["proof-slice-model"]["proof-slices"][0]["fixture-mock-boundary"] =
      "运行 pnpm vitest apps/control-api/tests/api/minimal.test.ts 并写入 openspec-results/x/result.json。";
  });

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-FORBIDDEN-001");
});

test("tasks validator skips when no tasks output exists", () => {
  const change = "validator-tasks-skip-change";
  const root = makeObligationRuntimeFixture(change);

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, true, formatErrors(result));
  assert.ok(result.warnings.some((warning) => warning.ruleId === "VAL-TASKS-000"));
});

test("tasks validator rejects artifact without trace", () => {
  const change = "validator-tasks-missing-trace-change";
  const root = makeObligationRuntimeFixture(change);
  writeText(root, `openspec/changes/${change}/tasks.md`, "handwritten tasks\n");

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-001");
});

test("tasks validator passes minimal obligation tasks contract", () => {
  const change = "validator-obligation-tasks-change";
  const root = makeObligationTasksFixture(change);

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, true, formatErrors(result));
});

test("standalone tasks validator passes minimal obligation tasks contract", () => {
  const change = "validator-standalone-obligation-tasks-change";
  const root = makeObligationTasksFixture(change);

  const result = validateTasksArtifact({ root, change });

  assert.equal(result.ok, true, formatErrors(result));
});

test("tasks validator passes minimal default tasks contract", () => {
  const change = "validator-default-tasks-change";
  const root = makeDefaultTasksFixture(change);

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, true, formatErrors(result));
});

test("tasks validator rejects handwritten tasks markdown drift", () => {
  const change = "validator-tasks-render-drift-change";
  const root = makeObligationTasksFixture(change);
  fs.appendFileSync(
    path.join(root, "openspec", "changes", change, "tasks.md"),
    "\n手写 tasks 漂移。\n",
  );

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-RENDER-003");
});

test("tasks validator rejects source-interface markdown and verification trace inputs", () => {
  const change = "validator-tasks-source-interface-input-leak-change";
  const root = makeObligationTasksFixture(change);
  updateTasksTrace(root, change, (trace) => {
    trace["source-interface"]["proposal-artifact"] = "proposal.md";
    trace["source-interface"]["verification-trace"] = "trace/verification.trace.json";
  });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-SOURCE-010");
  assertHasRule(result, "VAL-TASKS-SOURCE-011");
});

test("tasks validator rejects unknown runtime row references", () => {
  const change = "validator-tasks-unknown-runtime-row-change";
  const root = makeObligationTasksFixture(change);
  updateTasksTrace(root, change, (trace) => {
    trace["delivery-plane"]["acceptance-slices"][0]["runtime-rows"] = ["RS-999"];
    trace["delivery-plane"]["acceptance-slices"][0]["resolved-runtime-contract"][0].row = "RS-999";
    trace["delivery-plane"]["acceptance-slices"][0].tasks[0]["runtime-rows"] = ["RS-999"];
  }, { render: true });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-RUNTIME-ROW-002");
});

test("tasks validator rejects task id drift outside owning AC", () => {
  const change = "validator-tasks-task-id-drift-change";
  const root = makeObligationTasksFixture(change);
  updateTasksTrace(root, change, (trace) => {
    trace["delivery-plane"]["acceptance-slices"][0].tasks[0]["task-id"] = "AC-002.1";
  }, { render: true });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-TASK-004");
});

test("tasks validator rejects required runtime row missing projection", () => {
  const change = "validator-tasks-missing-runtime-projection-change";
  const root = makeObligationTasksFixture(change);
  updateTasksTrace(root, change, (trace) => {
    trace["runtime-acceptance-projection"]["runtime-row-ownership-projection"] = [];
  });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-PROJECTION-020");
});

test("tasks validator rejects missing proposal source coverage row", () => {
  const change = "validator-tasks-missing-source-coverage-change";
  const root = makeObligationTasksFixture(change);
  updateTasksTrace(root, change, (trace) => {
    trace["acceptance-driven-coverage"]["obligation-atom-coverage"] = [];
  });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-COVERAGE-ID-004");
});

test("tasks validator rejects grouped GA coverage IDs", () => {
  const change = "validator-tasks-grouped-ga-change";
  const root = makeObligationTasksFixture(change);
  updateTasksTrace(root, change, (trace) => {
    trace["acceptance-driven-coverage"]["obligation-atom-coverage"][0]["global-atom-id"] = "GA-0001, GA-0002";
  });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-COVERAGE-ID-001");
});

test("tasks validator rejects AC dependency order violations", () => {
  const change = "validator-tasks-dependency-order-change";
  const root = makeObligationTasksFixture(change);
  updateTasksTrace(root, change, (trace) => {
    const secondSlice = structuredClone(trace["delivery-plane"]["acceptance-slices"][0]);
    secondSlice["ac-id"] = "AC-002";
    secondSlice.title = "第二生产切片";
    secondSlice.tasks[0]["task-id"] = "AC-002.1";
    trace["delivery-plane"]["acceptance-slices"].push(secondSlice);
    const secondIndex = structuredClone(trace["runtime-acceptance-index"]["ac-runtime-ownership-index"][0]);
    secondIndex["ac-id"] = "AC-002";
    secondIndex["depends-on-ac-ids"] = [];
    trace["runtime-acceptance-index"]["ac-runtime-ownership-index"][0]["depends-on-ac-ids"] = ["AC-002"];
    trace["runtime-acceptance-index"]["ac-runtime-ownership-index"].push(secondIndex);
  }, { render: true });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-INDEX-008");
});

test("tasks validator rejects fixed command and evidence leaks", () => {
  const change = "validator-tasks-command-evidence-leak-change";
  const root = makeObligationTasksFixture(change);
  updateTasksTrace(root, change, (trace) => {
    trace["delivery-plane"]["acceptance-slices"][0].tasks[0].proof =
      "运行 pnpm vitest apps/control-api/tests/api/minimal.test.ts 并写入 openspec-results/x/result.json。";
  }, { render: true });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-FORBIDDEN-002");
});

function makeObligationFixture(change) {
  const root = makeRoot(change);
  const paths = obligationPaths(change);
  writeJson(root, "openspec/orchestrate/trace/manifest.json", {
    "trace-schema": "source-aligned-trace-v1",
    "trace-contract-version": "source-aligned-trace-v1",
    "phase-statuses": {
      "phase-5": "accepted",
    },
  });
  writeJson(root, "openspec/orchestrate/trace/phase-5.trace.json", {
    "trace-schema": "source-aligned-trace-v1",
    "trace-contract-version": "source-aligned-trace-v1",
    status: "accepted",
  });
  writeJson(root, "openspec/orchestrate/phase-works/phase-5/final-packet-index.json", {
    "trace-schema": "source-aligned-trace-v1",
    "trace-contract-version": "source-aligned-trace-v1",
    packets: [
      {
        change,
        "change-kind": "business",
        "direct-atom-ids": ["GA-0001"],
        "owner-scoped-non-direct-atom-ids": ["GA-0002"],
        "packet-path": paths.packet,
        "capability-view-paths": [paths.capabilityView],
      },
    ],
  });
  writeJson(root, "openspec/orchestrate/phase-works/phase-5/atom-plan-mapping.json", {
    "trace-schema": "source-aligned-trace-v1",
    "trace-contract-version": "source-aligned-trace-v1",
    rows: [
      {
        "global-atom-id": "GA-0001",
        "final-owner-change": change,
        "final-owner-capability": "capability-a",
        "final-relation": "direct",
        "final-artifact-projection": "spec-requirement",
        "source-document": "docs/source.md",
        lines: "L1-L2",
      },
      {
        "global-atom-id": "GA-0002",
        "final-owner-change": change,
        "final-owner-capability": "capability-a",
        "final-relation": "explicit-non-goal",
        "final-artifact-projection": "spec-guard",
        "source-document": "docs/source.md",
        lines: "L3-L4",
      },
    ],
  });
  writeJson(root, "openspec/orchestrate/change-capability-anchors/obligation-atom-index.json", {
    "trace-schema": "source-aligned-trace-v1",
    "trace-contract-version": "source-aligned-trace-v1",
    "global-atoms": [
      {
        "global-atom-id": "GA-0001",
        "source-document": "docs/source.md",
        lines: "L1-L2",
        "atom-type": "primary-action",
        "source-fact": "用户可以完成一个最小闭环。",
        normativity: "must",
        "coverage-status": "direct",
        "artifact-projection": "spec-requirement",
        "owner-capability": "capability-a",
        "atom-relation": "direct",
        "evidence-need": "browser-e2e",
        "propose-use": "进入 proposal 范围。",
      },
      {
        "global-atom-id": "GA-0002",
        "source-document": "docs/source.md",
        lines: "L3-L4",
        "atom-type": "explicit-non-goal",
        "source-fact": "不交付额外能力。",
        normativity: "must-not",
        "coverage-status": "explicit-non-goal",
        "artifact-projection": "spec-guard",
        "owner-capability": "capability-a",
        "atom-relation": "explicit-non-goal",
        "evidence-need": "manual",
        "propose-use": "进入非目标边界。",
      },
    ],
  });
  writeText(root, paths.packet, "# Packet\n");
  writeText(root, paths.capabilityView, "# Capability\n");
  writeText(root, "docs/source.md", "line 1\nline 2\nline 3\nline 4\n");

  writeProposalTrace(root, change, obligationTrace(change, paths));
  renderChangeArtifact({ root, change, artifact: "proposal", write: true });
  return root;
}

function obligationPaths(change) {
  return {
    packet: `openspec/orchestrate/change-capability-anchors/${change}/${change}.md`,
    capabilityView: `openspec/orchestrate/change-capability-anchors/${change}/capability-anchors/capability-a.md`,
  };
}

function obligationTrace(change, paths) {
  return {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "proposal",
    "artifact-path": "proposal.md",
    "change-name": change,
    "schema-name": "production-obligation-atom-driven",
    "agent-role": "proposal-writer",
    "delivery-plane": proposalDelivery(),
    "obligation-atom-preconditions": {
      "orchestrate-manifest": "openspec/orchestrate/trace/manifest.json",
      "global-atom-index-json": "openspec/orchestrate/change-capability-anchors/obligation-atom-index.json",
      "atom-plan-mapping-json": "openspec/orchestrate/phase-works/phase-5/atom-plan-mapping.json",
      "final-packet-index-json": "openspec/orchestrate/phase-works/phase-5/final-packet-index.json",
      "canonical-change-packet": paths.packet,
      "capability-view-capability-a": paths.capabilityView,
    },
    "change-atom-coverage-register": [
      {
        "global-atom-id": "GA-0001",
        "source-document": "docs/source.md",
        lines: "L1-L2",
        "atom-type": "primary-action",
        "source-fact": "用户可以完成一个最小闭环。",
        normativity: "must",
        "coverage-status": "direct",
        "artifact-projection": "spec-requirement",
        "projection-source": "atom-plan-mapping.json",
        "owner-capability": "capability-a",
        "atom-relation": "direct",
        "propose-use": "进入 proposal 范围。",
        "evidence-need": "browser-e2e",
        "downstream-coverage-expectation": "进入 specs/design/runtime/tasks/verification。",
      },
    ],
    "owner-scoped-non-direct-boundary-register": [
      {
        "global-atom-id": "GA-0002",
        "source-document": "docs/source.md",
        lines: "L3-L4",
        "atom-type": "explicit-non-goal",
        "source-fact": "不交付额外能力。",
        normativity: "must-not",
        "coverage-status": "explicit-non-goal",
        "owner-capability": "capability-a",
        "atom-relation": "explicit-non-goal",
        "boundary-role": "extra-capability-non-goal",
        "reference-only": true,
        "downstream-trace-policy": "do-not-propagate-ga",
        "boundary-handling": "只作为非目标，不传播 GA。",
        "original-artifact-projection": "spec-guard",
        "propose-use": "进入非目标边界。",
        "evidence-need": "manual",
      },
    ],
    "production-source-coverage": [
      {
        "source-document": "docs/source.md",
        "global-atom-ids": ["GA-0001"],
        "line-ranges": ["L1-L2"],
        "atom-count": 1,
        "artifact-projections": ["spec-requirement"],
        "owner-capabilities": ["capability-a"],
        "proposal-use": "定义当前 proposal 范围。",
      },
    ],
    "source-window-read-set": [
      {
        "global-atom-id": "GA-0001",
        "source-document": "docs/source.md",
        "line-range": "L1-L2",
        "source-fact": "用户可以完成一个最小闭环。",
        "read-purpose": "确认最小闭环。",
        "interpretation-result": "当前 proposal 覆盖该闭环。",
      },
    ],
    "proposal-alignment-gate": {
      "proposal-input-mode": "final-change-packet",
      "change-slug": change,
      "change-kind": "business",
      "global-atom-index-json": "openspec/orchestrate/change-capability-anchors/obligation-atom-index.json",
      "change-packet": paths.packet,
      "final-packet-index-json": "openspec/orchestrate/phase-works/phase-5/final-packet-index.json",
      "atom-plan-mapping-json": "openspec/orchestrate/phase-works/phase-5/atom-plan-mapping.json",
      "capability-atom-view-files": [paths.capabilityView],
      "direct-atoms": {
        count: 1,
        ids: ["GA-0001"],
        "id-list-source": "final-packet-index",
      },
      "artifact-projection-coverage": [
        {
          "artifact-projection": "spec-requirement",
          count: 1,
          ids: ["GA-0001"],
          "downstream-expectation": "进入 specs/design/runtime/tasks/verification。",
        },
      ],
      "owner-scoped-non-direct-atoms": {
        count: 1,
        ids: ["GA-0002"],
        "relation-summary": {
          "explicit-non-goal": 1,
        },
        "downstream-trace-policy": "do-not-propagate-ga",
      },
      "source-windows-re-read": {
        count: 1,
        ids: ["GA-0001"],
        "read-set-source": "source-window-read-set",
      },
      "orphan-direct-atoms": [],
      "capability-increment-coverage": [
        {
          capability: "capability-a",
          "change-kind": "business",
          "direct-atom-count": 1,
          advancement: "new-capability",
          "spec-delta-expected": true,
          "coverage-note": "覆盖 capability-a。",
        },
      ],
      blockers: [],
    },
  };
}

function makeDefaultFixture(change) {
  const root = makeRoot(change);
  writeProposalTrace(root, change, defaultTrace(change));
  renderChangeArtifact({ root, change, artifact: "proposal", write: true });
  return root;
}

function defaultTrace(change) {
  return {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "proposal",
    "artifact-path": "proposal.md",
    "change-name": change,
    "schema-name": "production-default-acceptance-driven",
    "agent-role": "proposal-writer",
    "delivery-plane": proposalDelivery(),
    "baseline-input-read-set": [
      {
        "input-id": "BI-001",
        "input-type": "user-request",
        source: "用户请求",
        "read-purpose": "界定 change 范围。",
        "interpretation-result": "需要交付最小闭环。",
      },
    ],
    "change-scope-coverage": [
      {
        "scope-item-id": "SI-001",
        source: "用户请求",
        "source-fact": "交付最小闭环。",
        "artifact-handling": "spec",
        capability: "capability-a",
        "propose-use": "定义 proposal 范围。",
        "downstream-coverage-expectation": "进入 specs/design/runtime/tasks/verification。",
      },
    ],
    "proposal-alignment-gate": {
      "proposal-input-mode": "user-request",
      "change-slug": change,
      "scope-items": {
        count: 1,
        ids: ["SI-001"],
        "id-list-source": "change-scope-coverage",
      },
      "artifact-handling-coverage": [
        {
          "artifact-handling": "spec",
          count: 1,
          ids: ["SI-001"],
          "downstream-expectation": "进入 specs/design/runtime/tasks/verification。",
        },
      ],
      "baseline-inputs-read": {
        count: 1,
        ids: ["BI-001"],
        "read-set-source": "baseline-input-read-set",
      },
      "orphan-scope-items": [],
      "capability-increment-coverage": [
        {
          capability: "capability-a",
          advancement: "new-capability",
          "scope-item-count": 1,
          "spec-delta-expected": true,
          "coverage-note": "覆盖 capability-a。",
        },
      ],
      blockers: [],
    },
  };
}

function makeObligationSpecsFixture(change) {
  const root = makeObligationFixture(change);
  writeObligationSpecsTrace(root, change);
  renderChangeArtifact({ root, change, artifact: "specs", capability: "capability-a", write: true });
  return root;
}

function makeDefaultSpecsFixture(change) {
  const root = makeDefaultFixture(change);
  writeDefaultSpecsTrace(root, change);
  renderChangeArtifact({ root, change, artifact: "specs", capability: "capability-a", write: true });
  return root;
}

function makeDefaultNoDeltaSpecsFixture(change) {
  const root = makeDefaultFixture(change);
  updateProposalTrace(root, change, (trace) => {
    trace["change-scope-coverage"][0]["artifact-handling"] = "design";
  });
  writeDefaultNoDeltaSpecsTrace(root, change);
  renderChangeArtifact({ root, change, artifact: "specs", noDeltaSpecs: true, write: true });
  return root;
}

function makeObligationDesignFixture(change) {
  const root = makeObligationSpecsFixture(change);
  writeObligationDesignTrace(root, change);
  renderChangeArtifact({ root, change, artifact: "design", write: true });
  return root;
}

function makeDefaultDesignFixture(change) {
  const root = makeDefaultSpecsFixture(change);
  writeDefaultDesignTrace(root, change);
  renderChangeArtifact({ root, change, artifact: "design", write: true });
  return root;
}

function makeDefaultNoDeltaDesignFixture(change) {
  const root = makeDefaultNoDeltaSpecsFixture(change);
  writeDefaultDesignTrace(root, change, { noDelta: true });
  renderChangeArtifact({ root, change, artifact: "design", write: true });
  return root;
}

function makeObligationRuntimeFixture(change) {
  const root = makeObligationDesignFixture(change);
  writeRuntimeTrace(root, change, runtimeTrace({
    change,
    schemaName: "production-obligation-atom-driven",
    proposalUpstreamId: "GA-0001",
    proposalUpstreamType: "proposal-direct-atom",
    projectionField: "artifact-projection",
    projectionValue: "spec-requirement",
    sourceBasis: "GA-0001; specs `最小闭环 / 完成最小闭环`; D-001.",
  }));
  renderChangeArtifact({ root, change, artifact: "runtime-acceptance", write: true });
  return root;
}

function makeDefaultRuntimeFixture(change) {
  const root = makeDefaultDesignFixture(change);
  writeRuntimeTrace(root, change, runtimeTrace({
    change,
    schemaName: "production-default-acceptance-driven",
    proposalUpstreamId: "SI-001",
    proposalUpstreamType: "proposal-scope-item",
    projectionField: "artifact-handling",
    projectionValue: "spec",
    sourceBasis: "SI-001; specs `最小闭环 / 完成最小闭环`; D-001.",
  }));
  renderChangeArtifact({ root, change, artifact: "runtime-acceptance", write: true });
  return root;
}

function makeObligationVerificationFixture(change) {
  const root = makeObligationRuntimeFixture(change);
  writeVerificationTrace(root, change, verificationTrace({
    change,
    schemaName: "production-obligation-atom-driven",
  }));
  renderChangeArtifact({ root, change, artifact: "verification", write: true });
  return root;
}

function makeDefaultVerificationFixture(change) {
  const root = makeDefaultRuntimeFixture(change);
  writeVerificationTrace(root, change, verificationTrace({
    change,
    schemaName: "production-default-acceptance-driven",
  }));
  renderChangeArtifact({ root, change, artifact: "verification", write: true });
  return root;
}

function makeObligationTasksFixture(change) {
  const root = makeObligationRuntimeFixture(change);
  writeTasksTrace(root, change, tasksTrace({
    change,
    schemaName: "production-obligation-atom-driven",
    sourceItemId: "GA-0001",
    sourceItemField: "global-atom-id",
    projectionField: "artifact-projection",
    projectionValue: "spec-requirement",
    mainCoverageField: "obligation-atom-coverage",
    designCoverageField: "design-obligation-coverage",
  }));
  renderChangeArtifact({ root, change, artifact: "tasks", write: true });
  return root;
}

function makeDefaultTasksFixture(change) {
  const root = makeDefaultRuntimeFixture(change);
  writeTasksTrace(root, change, tasksTrace({
    change,
    schemaName: "production-default-acceptance-driven",
    sourceItemId: "SI-001",
    sourceItemField: "scope-item-id",
    projectionField: "artifact-handling",
    projectionValue: "spec",
    mainCoverageField: "scope-item-coverage",
    designCoverageField: "design-decision-coverage",
  }));
  renderChangeArtifact({ root, change, artifact: "tasks", write: true });
  return root;
}

function tasksTrace(options) {
  const proofSummary = "API 或 UI readback 显示最小闭环完成。";
  const mainCoverageRow = {
    [options.sourceItemField]: options.sourceItemId,
    [options.projectionField]: options.projectionValue,
    "owner-capability": "capability-a",
    "source-fact": "用户可以完成一个最小闭环。",
    "runtime-row-ids": ["RS-001"],
    "acceptance-slice-ids": ["AC-001"],
    "implementation-task-ids": ["AC-001.1"],
    "proof-only-handling": "not-proof-only",
    "runtime-proof-summary": proofSummary,
    "coverage-status": "projected-to-production-task",
    "blocker-not-applicable-reason": "无",
  };
  const designCoverageRow = {
    "decision-ids": ["D-001"],
    "source-item-ids": [options.sourceItemId],
    "runtime-row-ids": ["RS-001"],
    "acceptance-slice-ids": ["AC-001"],
    "implementation-task-ids": ["AC-001.1"],
    "runtime-proof-summary": proofSummary,
    "coverage-status": "projected-to-production-task",
    "blocker-not-applicable-reason": "无",
  };
  if (options.designCoverageField === "design-obligation-coverage") {
    designCoverageRow["design-obligation-id"] = "DOM-001";
  }

  return {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "tasks",
    "artifact-path": "tasks.md",
    "change-name": options.change,
    "schema-name": options.schemaName,
    "agent-role": "tasks-writer",
    "source-interface": {
      "proposal-trace": "trace/proposal.trace.json",
      "specs-completion-mode": "delta",
      "spec-traces": ["trace/specs/capability-a.trace.json"],
      "design-trace": "trace/design.trace.json",
      "runtime-acceptance-trace": "trace/runtime-acceptance.trace.json",
      "verification-input-policy": "tasks does not consume verification trace; verification and proof evidence are downstream or parallel proof models, not implementation scope sources.",
      "markdown-input-policy": "tasks consumes proposal/spec/design/runtime JSON traces only; Markdown artifacts are render outputs, not semantic inputs.",
    },
    "acceptance-driven-coverage": {
      [options.mainCoverageField]: [mainCoverageRow],
      "requirement-scenario-coverage": [
        {
          "trace-path": "trace/specs/capability-a.trace.json",
          requirement: "最小闭环",
          scenario: "完成最小闭环",
          "source-item-ids": [options.sourceItemId],
          "runtime-row-ids": ["RS-001"],
          "acceptance-slice-ids": ["AC-001"],
          "implementation-task-ids": ["AC-001.1"],
          "runtime-proof-summary": proofSummary,
          "coverage-status": "projected-to-production-task",
          "blocker-not-applicable-reason": "无",
        },
      ],
      [options.designCoverageField]: [designCoverageRow],
    },
    "runtime-acceptance-index": {
      "ac-runtime-ownership-index": [
        {
          "ac-id": "AC-001",
          "source-basis": `${options.sourceItemId}; specs \`最小闭环 / 完成最小闭环\`; D-001.`,
          "runtime-surface-rows": ["RS-001"],
          "operation-rows": [],
          "state-branch-rows": [],
          "async-realtime-rows": [],
          "provides-rows": ["RS-001"],
          "consumes-rows": [],
          "depends-on-ac-ids": [],
          "prerequisite-runtime-facts": "None",
          "start-gate": "None",
          "scope-role": "required behavior",
          "no-scope-expansion-check": "只覆盖当前 source/scope item 和 D-001。",
          "detail-matrix-rows": ["RS-001"],
          "runtime-proof-summary": proofSummary,
        },
      ],
    },
    "runtime-acceptance-projection": {
      "runtime-row-ownership-projection": [
        {
          "runtime-row-id": "RS-001",
          "row-type": "surface",
          "scope-role": "required behavior",
          "owner-ac-id": "AC-001",
          "implementation-task-ids": ["AC-001.1"],
          "provides-rows": ["RS-001"],
          "consumes-rows": [],
          "depends-on-ac-ids": [],
          "projection-status": "projected",
          "proof-only-handling": "not-proof-only",
          "runtime-proof-summary": proofSummary,
          "blocker-not-applicable-reason": "无",
        },
      ],
      "provider-consumer-projection": [],
    },
    "delivery-plane": {
      "acceptance-slices": [
        {
          "ac-id": "AC-001",
          title: "最小闭环生产切片",
          outcome: [
            "- 用户或系统可以通过 API 或 UI readback 观察最小闭环完成。",
          ],
          "start-gate": [
            "- 无。",
          ],
          "runtime-rows": ["RS-001"],
          "resolved-runtime-contract": [
            {
              row: "RS-001",
              "worker-facing-obligation": "用户可以完成一个最小闭环。",
              "observable-proof": "API 或 UI readback 显示最小闭环完成。",
              "default-no-scope-boundary": "默认路径使用真实 API，不使用静态 fixture；只覆盖当前 source/scope item 和 D-001。",
            },
          ],
          "implementation-scope": [
            "- 实现最小生产 API 或 UI 闭环。",
          ],
          preserve: [
            "- 不扩展额外能力。",
          ],
          "proof-contract": [
            "- 完成后能通过 runtime readback 观察最小闭环结果。",
          ],
          tasks: [
            {
              "task-id": "AC-001.1",
              title: "实现最小闭环生产行为",
              "runtime-rows": ["RS-001"],
              acceptance: "API 或 UI readback 能显示最小闭环完成。",
              preserve: "不扩展额外能力。",
              proof: "可观察 proof 是真实 API 或 UI readback 显示最小闭环完成。",
              "mock-default-path-policy": "默认路径使用真实 API；不得以静态 fixture 或说明文本替代。",
            },
          ],
        },
      ],
    },
  };
}

function verificationTrace(options) {
  return {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "verification",
    "artifact-path": "verification.md",
    "change-name": options.change,
    "schema-name": options.schemaName,
    "agent-role": "verification-writer",
    "source-interface": {
      "runtime-source-artifact": "runtime-acceptance.md",
      "runtime-source-trace": "trace/runtime-acceptance.trace.json",
      "proof-slice-model": "trace/verification.trace.json#/proof-slice-model",
      "oracle-source-policy": "Proof Slice oracle only derives from runtime-acceptance canonical rows.",
      "upstream-consistency-read": [
        "trace/proposal.trace.json",
        "trace/specs/capability-a.trace.json",
        "trace/design.trace.json",
      ],
      "markdown-input-policy": "verification consumes JSON traces only.",
    },
    "proof-slice-model": verificationProofSliceModel(),
    "runtime-row-branch-inventory": [
      {
        "branch-id": "VRB-001",
        "runtime-row-id": "RS-001",
        "runtime-row-type": "surface",
        "scope-role": "required behavior",
        "branch-source-field": "runtime-obligation",
        "branch-variant": "minimal runtime success",
        handling: "proof-slice",
        "expected-proof-slice-ids": ["PS-001"],
        "handling-reason": "PS-001 覆盖最小 runtime success 分支。",
      },
    ],
    "manual-not-applicable-inventory": [],
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
    "slice-consistency-checklist": [
      "Every verification-relevant runtime row branch is mapped to a Proof Slice or manual/not-applicable reason.",
      "Every expected Proof Slice exists in proof-slice-model.proof-slices and includes the reconciled runtime row.",
      "Proof Slice canonical rows are stored only in proof-slice-model.",
    ],
    "delivery-plane": {
      "verification-intent": {
        scope: "覆盖最小闭环 runtime row 的成功分支。",
        "runtime-source": "runtime-acceptance.md canonical rows。",
        "out-of-scope": "不规划执行命令、具体测试文件或 evidence 路径。",
      },
      "layer-harness-fixture-notes": [
        {
          "slice-id-set": "PS-001",
          "layer-reason": "API layer 能证明最小闭环 runtime surface。",
          "harness-expectation": "需要能触达 route/API 边界的测试 harness。",
          "mock-fixture-boundary": "允许最小请求 fixture，默认 API 路径保持真实。",
          "omitted-stable-layers-reason": "UI 和 DB 层不属于该最小 proof slice。",
        },
      ],
      "do-not-test": [
        {
          item: "额外能力和实现过程细节。",
          reason: "这些内容不属于当前 runtime row 的 source/scope。",
          "runtime-row-ids": ["RS-001"],
        },
      ],
    },
  };
}

function verificationProofSliceModel() {
  return {
    "model-schema": "openspec-proof-slices-v1",
    "proof-slice-summary": {
      "proof-slice-count": 1,
      "persistent-test-required-count": 1,
      "non-persistent-proof-slice-count": 0,
      "runtime-row-count": 1,
      "slice-id-format": "PS-###",
    },
    "proof-slices": [
      {
        "slice-id": "PS-001",
        "runtime-row-ids": ["RS-001"],
        "primary-runtime-row-id": "RS-001",
        "primitive-type": "operation",
        "branch-variant": "minimal runtime success",
        "observable-surface": "control-api minimal route",
        "oracle-fragment": "API 或 UI readback 显示最小闭环完成。",
        "failure-signal": "readback 未显示最小闭环完成。",
        "primary-layer": "route/API",
        "production-owner": "apps/control-api",
        "persistent-test-required": true,
        "proof-evidence-mode": "durable-test",
        "primary-assertion-shape": "route response/readback assertion",
        "fixture-mock-boundary": "允许最小请求 fixture，默认 API 路径保持真实。",
        "regression-intent": "high：最小闭环是核心 runtime 行为。",
        "manual-environment-gate": "None",
        "test-contract": {
          "primary-test-cardinality": "exactly-one",
          "test-title-prefix": "PS-001",
          "allow-shared-setup": true,
          "allow-multi-slice-primary-test": false,
          "waiver-required-for-multi-slice": true,
          placement: {
            "planned-test-directory": "apps/control-api/tests/api/**",
            "placement-basis": "existing-tests-directory",
            "placement-reason": "route/API proof 放在 control-api API tests 目录级落点。",
          },
        },
      },
    ],
  };
}

function runtimeTrace(options) {
  const specScenarioId = "trace/specs/capability-a.trace.json#/requirement-source-trace/0";
  return {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "runtime-acceptance",
    "artifact-path": "runtime-acceptance.md",
    "change-name": options.change,
    "schema-name": options.schemaName,
    "agent-role": "runtime-acceptance-writer",
    "source-interface": {
      "proposal-trace": "trace/proposal.trace.json",
      "specs-completion-mode": "delta",
      "spec-traces": ["trace/specs/capability-a.trace.json"],
      "design-trace": "trace/design.trace.json",
      "markdown-input-policy": "runtime acceptance consumes proposal/spec/design JSON traces only.",
    },
    "upstream-runtime-obligation-inventory": [
      {
        "inventory-item-id": "ROI-001",
        "upstream-item-id": options.proposalUpstreamId,
        "upstream-item-type": options.proposalUpstreamType,
        [options.projectionField]: options.projectionValue,
        "source-fact": "用户可以完成一个最小闭环。",
        "runtime-relevance": "runtime-required",
        "expected-runtime-row-types": ["RS"],
        "not-applicable-reason": "N/A",
      },
      {
        "inventory-item-id": "ROI-002",
        "upstream-item-id": specScenarioId,
        "upstream-item-type": "spec-scenario",
        "source-fact": "最小闭环 scenario 需要 runtime row 覆盖。",
        "runtime-relevance": "runtime-required",
        "expected-runtime-row-types": ["RS"],
        "not-applicable-reason": "N/A",
      },
      {
        "inventory-item-id": "ROI-003",
        "upstream-item-id": "D-001",
        "upstream-item-type": "design-decision",
        "source-fact": "D-001 定义最小闭环设计。",
        "runtime-relevance": "runtime-required",
        "expected-runtime-row-types": ["RS"],
        "not-applicable-reason": "N/A",
      },
    ],
    "runtime-not-applicable-inventory": [],
    "canonical-row-index": {
      "surface-rows": ["RS-001"],
      "operation-rows": [],
      "state-rows": [],
      "chain-rows": [],
    },
    "runtime-upstream-coverage-map": [
      {
        "upstream-item-id": options.proposalUpstreamId,
        "upstream-item-type": options.proposalUpstreamType,
        [options.projectionField]: options.projectionValue,
        "projection-handling": "runtime-surface",
        "runtime-row-ids": ["RS-001"],
        "coverage-mode": "covered-by-runtime-rows",
        "not-applicable-reason": "N/A",
        "coverage-note": "proposal source item maps to the minimal runtime surface.",
      },
      {
        "upstream-item-id": specScenarioId,
        "upstream-item-type": "spec-scenario",
        "projection-handling": "runtime-surface",
        "runtime-row-ids": ["RS-001"],
        "coverage-mode": "covered-by-runtime-rows",
        "not-applicable-reason": "N/A",
        "coverage-note": "spec scenario maps to the minimal runtime surface.",
      },
      {
        "upstream-item-id": "D-001",
        "upstream-item-type": "design-decision",
        "projection-handling": "runtime-surface",
        "runtime-row-ids": ["RS-001"],
        "coverage-mode": "covered-by-runtime-rows",
        "not-applicable-reason": "N/A",
        "coverage-note": "design decision maps to the minimal runtime surface.",
      },
    ],
    "runtime-coverage-source-map": [
      {
        "source-group": "minimal-runtime",
        "row-ids": ["RS-001"],
        "source-basis": [options.proposalUpstreamId, "D-001"],
        "coverage-note": "summary only; runtime-upstream-coverage-map is authoritative.",
      },
    ],
    "coverage-closure-checklist": [
      "Every upstream item is covered or source-backed not-applicable.",
    ],
    "delivery-plane": {
      "runtime-acceptance-intent": {
        scope: "覆盖最小闭环 runtime surface。",
        "source-basis": "proposal/spec/design trace。",
        "out-of-scope": "不扩展额外能力。",
      },
      "canonical-rows": [
        runtimeSurfaceRow("RS-001", options.sourceBasis),
      ],
    },
  };
}

function runtimeSurfaceRow(id, sourceBasis) {
  return {
    "surface-id": id,
    "surface-type": "API / UI surface",
    "owner-candidate": "apps/control-api",
    "entry-point": "minimal route",
    "runtime-obligation": "用户可以完成一个最小闭环。",
    "observable-fact": "API 或 UI readback 显示最小闭环完成。",
    "default-path-policy": "默认路径使用真实 API，不使用静态 fixture。",
    "external-boundary": "不访问额外外部系统。",
    "source-basis": sourceBasis,
    "projection-type": "runtime-surface",
    "scope-role": "required behavior",
    "no-scope-expansion-check": "只覆盖当前 source/scope item 和 D-001。",
  };
}

function writeObligationSpecsTrace(root, change, options = {}) {
  const rows = [
    {
      "global-atom-id": "GA-0001",
      "owner-capability": "capability-a",
      "source-document": "docs/source.md",
      lines: "L1-L2",
      "source-fact": "用户可以完成一个最小闭环。",
      "source-projection": "spec-requirement",
      "spec-handling": "direct-spec-requirement",
      requirement: "最小闭环",
      scenario: "完成最小闭环",
    },
  ];
  const addedRequirements = [
    {
      name: "最小闭环",
      body: "系统 SHALL 允许用户完成一个最小闭环。",
      scenarios: [
        {
          name: "完成最小闭环",
          when: "用户开始最小闭环",
          then: "系统完成该闭环",
        },
      ],
    },
  ];

  if (options.includeGuard) {
    const guardRow = {
      "global-atom-id": "GA-0003",
      "owner-capability": "capability-a",
      "source-document": "docs/source.md",
      lines: "L5-L6",
      "source-fact": "系统不得交付额外副作用。",
      "source-projection": "spec-guard",
      "spec-handling": "direct-spec-guard",
      requirement: "额外副作用边界",
      scenario: "阻止额外副作用",
    };
    if (!options.omitGuardHandling) {
      guardRow["guard-handling"] = "must-not";
    }
    rows.push(guardRow);
    addedRequirements.push({
      name: "额外副作用边界",
      body: "系统 MUST NOT 交付额外副作用。",
      scenarios: [
        {
          name: "阻止额外副作用",
          when: "用户尝试使用额外副作用能力",
          then: "系统拒绝该能力进入当前闭环",
        },
      ],
    });
  }

  const ids = rows.map((row) => row["global-atom-id"]);
  const guardIds = options.includeGuard ? ["GA-0003"] : [];
  writeJson(root, `openspec/changes/${change}/trace/specs/capability-a.trace.json`, {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "specs",
    "artifact-path": "specs/capability-a/spec.md",
    "change-name": change,
    "schema-name": "production-obligation-atom-driven",
    "agent-role": "specs-writer",
    "source-proposal-trace-path": "trace/proposal.trace.json",
    "specs-completion-mode": "delta",
    capability: "capability-a",
    "existing-spec-read-set": [
      {
        capability: "capability-a",
        path: "openspec/specs/capability-a/spec.md",
        "read-purpose": "not-applicable for new capability",
        "interpretation-result": "not-applicable",
      },
    ],
    "capability-source-map": [
      {
        "owner-capability": "capability-a",
        "spec-requirement-ids": ["GA-0001"],
        "spec-guard-ids": guardIds,
        "artifact-path": "specs/capability-a/spec.md",
        "trace-path": "trace/specs/capability-a.trace.json",
      },
    ],
    "requirement-source-trace": rows,
    "production-alignment-gate": {
      "spec-relevant-atoms": {
        count: ids.length,
        ids,
        "id-list-source": "trace/proposal.trace.json#/change-atom-coverage-register",
      },
      "orphan-spec-atoms": [],
      "delivery-only-scenarios": [],
      blockers: [],
    },
    "delivery-plane": {
      "added-requirements": addedRequirements,
      "modified-requirements": [],
      "removed-requirements": [],
      "renamed-requirements": [],
    },
  });
}

function writeObligationDesignTrace(root, change) {
  writeJson(root, `openspec/changes/${change}/trace/design.trace.json`, {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "design",
    "artifact-path": "design.md",
    "change-name": change,
    "schema-name": "production-obligation-atom-driven",
    "agent-role": "design-writer",
    "source-interface": {
      "proposal-trace": "trace/proposal.trace.json",
      "specs-completion-mode": "delta",
      "spec-traces": ["trace/specs/capability-a.trace.json"],
      "registered-source-window-policy": "design consumes proposal/spec trace only.",
    },
    "production-source-map": [
      {
        "source-map-row-id": "PSM-001",
        "global-atom-id": "GA-0001",
        "owner-capability": "capability-a",
        "source-document": "docs/source.md",
        lines: "L1-L2",
        "atom-type": "primary-action",
        "source-fact": "用户可以完成一个最小闭环。",
        normativity: "must",
        "artifact-projection": "spec-requirement",
        "proposal-trace-anchor": "trace/proposal.trace.json#/change-atom-coverage-register/0",
        "spec-trace-anchors": [
          {
            "trace-path": "trace/specs/capability-a.trace.json",
            "trace-pointer": "#/requirement-source-trace/0",
            "owner-capability": "capability-a",
            requirement: "最小闭环",
            scenario: "完成最小闭环",
            "spec-handling": "direct-spec-requirement",
            "source-projection": "spec-requirement",
          },
        ],
        "design-handling-ids": ["D-001"],
        "implementation-placement-ids": ["P-001"],
        "no-scope-expansion-check": "只覆盖 proposal direct atom。",
      },
    ],
    "spec-scenario-design-map": [
      {
        "trace-path": "trace/specs/capability-a.trace.json",
        "trace-pointer": "#/requirement-source-trace/0",
        "global-atom-id": "GA-0001",
        "owner-capability": "capability-a",
        requirement: "最小闭环",
        scenario: "完成最小闭环",
        "decision-ids": ["D-001"],
        "placement-ids": ["P-001"],
        "design-handling": "使用最小模块完成闭环。",
      },
    ],
    "design-decision-index": [
      {
        "decision-id": "D-001",
        title: "最小闭环设计",
        "design-handling": "使用 control-api 与 console-web 的最小边界完成闭环。",
        "source-item-ids": ["GA-0001"],
        "placement-ids": ["P-001"],
      },
    ],
    "design-obligation-matrix": [
      {
        "matrix-row-id": "DOM-001",
        "global-atom-id": "GA-0001",
        "owner-capability": "capability-a",
        "artifact-projection": "spec-requirement",
        "source-fact": "用户可以完成一个最小闭环。",
        "spec-scenario-anchors": ["capability-a::最小闭环::完成最小闭环"],
        "decision-ids": ["D-001"],
        "placement-ids": ["P-001"],
        "guard-handling": "N/A",
        "proof-expectation": "N/A",
        "no-scope-expansion": "不扩展额外能力。",
        "explicit-blocker": "无",
      },
    ],
    "source-scope-map": {
      "direct-source-item-handling": [
        {
          "global-atom-id": "GA-0001",
          handling: "进入最小 design handling。",
          "decision-ids": ["D-001"],
          "placement-ids": ["P-001"],
          "no-scope-expansion": "只处理当前 direct atom。",
        },
      ],
      "implementation-placement-map": [
        {
          "placement-id": "P-001",
          placement: "module",
          "path-boundary": "apps/control-api/src/capability-a",
          owner: "apps/control-api",
          "implementation-contract": "实现最小闭环 API 边界。",
        },
      ],
      "non-direct-boundary-handling": [],
    },
    "ui-control-contracts": [],
    "proof-expectation-handoff": [
      {
        "source-item-id": "GA-0001",
        "handoff-kind": "none",
        expectation: "N/A",
      },
    ],
    "production-alignment-gate": {
      "change-slug": change,
      "schema-name": "production-obligation-atom-driven",
      "direct-atom-count": 1,
      "direct-atom-ids": ["GA-0001"],
      "design-obligation-ids": ["GA-0001"],
      "production-source-map-check": "production-source-map mirrors proposal direct atoms.",
      "design-obligation-matrix-check": "Each proposal direct atom has exactly one matrix row.",
      blockers: [],
    },
    "delivery-plane": designDelivery(),
  });
}

function writeDefaultDesignTrace(root, change, options = {}) {
  const noDelta = Boolean(options.noDelta);
  writeJson(root, `openspec/changes/${change}/trace/design.trace.json`, {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "design",
    "artifact-path": "design.md",
    "change-name": change,
    "schema-name": "production-default-acceptance-driven",
    "agent-role": "design-writer",
    "source-interface": {
      "proposal-trace": "trace/proposal.trace.json",
      "specs-completion-mode": noDelta ? "no-delta" : "delta",
      "spec-traces": [noDelta ? "trace/specs/no-spec-delta/README.trace.json" : "trace/specs/capability-a.trace.json"],
      "registered-source-window-policy": "design consumes proposal/spec trace only.",
    },
    "production-source-map": [
      {
        "source-map-row-id": "PSM-001",
        "scope-item-id": "SI-001",
        capability: "capability-a",
        source: "用户请求",
        "source-fact": noDelta ? "交付最小闭环。" : "交付最小闭环。",
        "artifact-handling": noDelta ? "design" : "spec",
        "proposal-trace-anchor": "trace/proposal.trace.json#/change-scope-coverage/0",
        "spec-trace-anchors": noDelta
          ? []
          : [
              {
                "trace-path": "trace/specs/capability-a.trace.json",
                "trace-pointer": "#/requirement-source-trace/0",
                capability: "capability-a",
                requirement: "最小闭环",
                scenario: "完成最小闭环",
                "spec-handling": "direct-spec-requirement",
                "artifact-handling": "spec",
              },
            ],
        "design-handling-ids": ["D-001"],
        "implementation-placement-ids": ["P-001"],
        "no-scope-expansion-check": "只覆盖 proposal scope item。",
      },
    ],
    "spec-scenario-design-map": noDelta
      ? []
      : [
          {
            "trace-path": "trace/specs/capability-a.trace.json",
            "trace-pointer": "#/requirement-source-trace/0",
            "scope-item-id": "SI-001",
            capability: "capability-a",
            requirement: "最小闭环",
            scenario: "完成最小闭环",
            "decision-ids": ["D-001"],
            "placement-ids": ["P-001"],
            "design-handling": "使用最小模块完成闭环。",
          },
        ],
    "design-decision-index": [
      {
        "decision-id": "D-001",
        title: "最小闭环设计",
        "design-handling": "使用 default scope 的最小生产边界完成闭环。",
        "source-item-ids": ["SI-001"],
        "placement-ids": ["P-001"],
      },
    ],
    "design-obligation-matrix": [
      {
        "matrix-row-id": "DOM-001",
        "scope-item-id": "SI-001",
        capability: "capability-a",
        "artifact-handling": noDelta ? "design" : "spec",
        "source-fact": "交付最小闭环。",
        "spec-scenario-anchors": noDelta ? [] : ["capability-a::最小闭环::完成最小闭环"],
        "decision-ids": ["D-001"],
        "placement-ids": ["P-001"],
        "guard-handling": "N/A",
        "proof-expectation": "N/A",
        "no-scope-expansion": "不扩展额外能力。",
        "explicit-blocker": "无",
      },
    ],
    "source-scope-map": {
      "direct-source-item-handling": [
        {
          "scope-item-id": "SI-001",
          handling: "进入最小 design handling。",
          "decision-ids": ["D-001"],
          "placement-ids": ["P-001"],
          "no-scope-expansion": "只处理当前 scope item。",
        },
      ],
      "implementation-placement-map": [
        {
          "placement-id": "P-001",
          placement: "module",
          "path-boundary": "apps/control-api/src/capability-a",
          owner: "apps/control-api",
          "implementation-contract": "实现最小闭环 API 边界。",
        },
      ],
      "non-direct-boundary-handling": [],
    },
    "ui-control-contracts": [],
    "proof-expectation-handoff": [
      {
        "source-item-id": "SI-001",
        "handoff-kind": "none",
        expectation: "N/A",
      },
    ],
    "production-alignment-gate": {
      "change-slug": change,
      "schema-name": "production-default-acceptance-driven",
      "scope-item-count": 1,
      "scope-item-ids": ["SI-001"],
      "design-scope-item-ids": ["SI-001"],
      "production-source-map-check": "production-source-map mirrors proposal scope items.",
      "design-obligation-matrix-check": "Each proposal scope item has exactly one matrix row.",
      blockers: [],
    },
    "delivery-plane": designDelivery({ defaultFrontendAlias: true }),
  });
}

function writeDefaultSpecsTrace(root, change) {
  writeJson(root, `openspec/changes/${change}/trace/specs/capability-a.trace.json`, {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "specs",
    "artifact-path": "specs/capability-a/spec.md",
    "change-name": change,
    "schema-name": "production-default-acceptance-driven",
    "agent-role": "specs-writer",
    "source-proposal-trace-path": "trace/proposal.trace.json",
    "specs-completion-mode": "delta",
    capability: "capability-a",
    "existing-spec-read-set": [
      {
        capability: "capability-a",
        path: "openspec/specs/capability-a/spec.md",
        "read-purpose": "not-applicable for new capability",
        "interpretation-result": "not-applicable",
      },
    ],
    "capability-source-map": [
      {
        capability: "capability-a",
        "spec-scope-item-ids": ["SI-001"],
        "guard-scope-item-ids": [],
        "artifact-path": "specs/capability-a/spec.md",
        "trace-path": "trace/specs/capability-a.trace.json",
      },
    ],
    "requirement-source-trace": [
      {
        "scope-item-id": "SI-001",
        capability: "capability-a",
        source: "用户请求",
        "source-fact": "交付最小闭环。",
        "artifact-handling": "spec",
        "spec-handling": "direct-spec-requirement",
        requirement: "最小闭环",
        scenario: "完成最小闭环",
      },
    ],
    "production-alignment-gate": {
      "spec-relevant-scope-items": {
        count: 1,
        ids: ["SI-001"],
        "id-list-source": "trace/proposal.trace.json#/change-scope-coverage",
      },
      "orphan-spec-scope-items": [],
      "delivery-only-scenarios": [],
      blockers: [],
    },
    "delivery-plane": {
      "added-requirements": [
        {
          name: "最小闭环",
          body: "系统 SHALL 允许用户完成一个最小闭环。",
          scenarios: [
            {
              name: "完成最小闭环",
              when: "用户开始最小闭环",
              then: "系统完成该闭环",
            },
          ],
        },
      ],
      "modified-requirements": [],
      "removed-requirements": [],
      "renamed-requirements": [],
    },
  });
}

function writeDefaultNoDeltaSpecsTrace(root, change) {
  writeJson(root, `openspec/changes/${change}/trace/specs/no-spec-delta/README.trace.json`, {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "specs",
    "artifact-path": "specs/no-spec-delta/README.md",
    "change-name": change,
    "schema-name": "production-default-acceptance-driven",
    "agent-role": "specs-writer",
    "specs-completion-mode": "no-delta",
    "delivery-plane": {
      "completion-mode": "no-delta",
      summary: ["- 本 change 无 OpenSpec requirement/guard delta。"],
      "projection-closure": ["- specs artifact 以 no-delta marker 完成。"],
    },
    "requirement-source-trace": [],
    "production-alignment-gate": {
      "spec-relevant-scope-items": {
        count: 0,
        ids: [],
        "id-list-source": "trace/proposal.trace.json#/change-scope-coverage",
      },
      "orphan-spec-scope-items": [],
      "delivery-only-scenarios": [],
      blockers: [],
    },
  });
}

function addObligationGuardProposalRow(root, change) {
  updateProposalTrace(root, change, (trace) => {
    trace["change-atom-coverage-register"].push({
      "global-atom-id": "GA-0003",
      "source-document": "docs/source.md",
      lines: "L5-L6",
      "atom-type": "preserve-boundary",
      "source-fact": "系统不得交付额外副作用。",
      normativity: "must-not",
      "coverage-status": "direct",
      "artifact-projection": "spec-guard",
      "projection-source": "atom-plan-mapping.json",
      "owner-capability": "capability-a",
      "atom-relation": "direct",
      "propose-use": "作为 specs guard。",
      "evidence-need": "manual",
      "downstream-coverage-expectation": "进入 specs guard。",
    });
  });
}

function designDelivery(options = {}) {
  const delivery = {
    context: ["- design 来自 trace。"],
    "goals-non-goals": ["- goal 来自 trace；不扩展额外能力。"],
    decisions: [
      {
        "decision-id": "D-001",
        title: "最小闭环设计",
        decision: "从 trace 约束最小生产设计。",
        "source-gap": "无。",
        "minimal-shape": "使用最小模块边界。",
        "rejected-expansion": "不新增额外能力。",
      },
    ],
    "architecture-module-boundary-design": ["- 使用最小模块边界。"],
    "domain-data-migration-design": ["- 无数据迁移。"],
    "api-auth-security-design": ["- 使用最小 API 边界。"],
    "async-realtime-ai-worker-design": ["- 无异步 worker。"],
    "frontend-ux-prototype-fidelity-design": ["- 无额外前端能力。"],
    "observability-ops-deployment-design": ["- 使用最小可观察边界。"],
    "verification-design": ["- 只交给后续 runtime/verification 设计。"],
    "rollout-compatibility": ["- 无兼容迁移。"],
    "risks-trade-offs": ["- 风险较低。"],
    "open-questions": "无",
  };
  if (options.defaultFrontendAlias) {
    delivery["frontend-ux-design"] = delivery["frontend-ux-prototype-fidelity-design"];
    delete delivery["frontend-ux-prototype-fidelity-design"];
  }
  return delivery;
}

function proposalDelivery() {
  return {
    why: ["- 交付一个最小闭环。"],
    "change-plan-boundary": [
      "- Closed-loop outcome：用户可以完成最小闭环。",
      "- In scope：最小闭环。",
      "- Out of scope：额外能力。",
      "- Dependencies：无。",
    ],
    "what-changes": ["- 新增最小行为边界。"],
    capabilities: {
      "new-capabilities": [
        {
          name: "capability-a",
          summary: "交付最小闭环。",
        },
      ],
      "modified-capabilities": [],
    },
    "non-goals": ["- 不交付额外能力。"],
    impact: ["- 影响最小模块。"],
    "rollout-readiness": ["- 无。"],
  };
}

function makeRoot(change) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "openspec-validator-"));
  const changeDir = path.join(root, "openspec", "changes", change, "trace");
  fs.mkdirSync(changeDir, { recursive: true });
  fs.writeFileSync(path.join(root, "openspec", "changes", change, ".openspec.yaml"), "schema: test\n");
  return root;
}

function writeProposalTrace(root, change, trace) {
  writeJson(root, `openspec/changes/${change}/trace/proposal.trace.json`, trace);
}

function updateProposalTrace(root, change, update) {
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "proposal.trace.json");
  const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  update(trace);
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);
  renderChangeArtifact({ root, change, artifact: "proposal", write: true });
}

function updateSpecsTrace(root, change, capability, update, options = {}) {
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "specs", `${capability}.trace.json`);
  const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  update(trace);
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);
  if (options.render) {
    renderChangeArtifact({ root, change, artifact: "specs", capability, write: true });
  }
}

function updateDesignTrace(root, change, update, options = {}) {
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "design.trace.json");
  const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  update(trace);
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);
  if (options.render) {
    renderChangeArtifact({ root, change, artifact: "design", write: true });
  }
}

function writeRuntimeTrace(root, change, trace) {
  writeJson(root, `openspec/changes/${change}/trace/runtime-acceptance.trace.json`, trace);
}

function updateRuntimeTrace(root, change, update, options = {}) {
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "runtime-acceptance.trace.json");
  const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  update(trace);
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);
  if (options.render) {
    renderChangeArtifact({ root, change, artifact: "runtime-acceptance", write: true });
  }
}

function writeVerificationTrace(root, change, trace) {
  writeJson(root, `openspec/changes/${change}/trace/verification.trace.json`, trace);
}

function updateVerificationTrace(root, change, update, options = {}) {
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "verification.trace.json");
  const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  update(trace);
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);
  if (options.render) {
    renderChangeArtifact({ root, change, artifact: "verification", write: true });
  }
}

function writeTasksTrace(root, change, trace) {
  writeJson(root, `openspec/changes/${change}/trace/tasks.trace.json`, trace);
}

function updateTasksTrace(root, change, update, options = {}) {
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "tasks.trace.json");
  const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  update(trace);
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);
  if (options.render) {
    renderChangeArtifact({ root, change, artifact: "tasks", write: true });
  }
}

function writeJson(root, relPath, value) {
  writeText(root, relPath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(root, relPath, value) {
  const fullPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, value);
}

function assertHasRule(result, ruleId) {
  assert.ok(
    result.errors.some((error) => error.ruleId === ruleId),
    `expected ${ruleId}, got:\n${formatErrors(result)}`,
  );
}

function formatErrors(result) {
  return result.errors.map((error) => `${error.ruleId} ${error.file}: ${error.message}`).join("\n");
}
