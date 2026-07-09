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
  const root = makeSimplifiedObligationProposalFixture(change);

  const result = validateChange({ root, change, artifact: "proposal" });

  assert.equal(result.ok, true, formatErrors(result));
});

test("standalone proposal validator passes minimal obligation proposal contract", () => {
  const change = "validator-standalone-obligation-change";
  const root = makeSimplifiedObligationProposalFixture(change);

  const result = validateProposalArtifact({ root, change });

  assert.equal(result.ok, true, formatErrors(result));
});

test("proposal validator rejects missing direct atom register rows", () => {
  const change = "validator-obligation-missing-register-change";
  const root = makeSimplifiedObligationProposalFixture(change);
  updateProposalTrace(root, change, (trace) => {
    trace["change-ga-register"] = [];
  });

  const result = validateChange({ root, change, artifact: "proposal" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-OBLIGATION-REGISTER-002");
});

test("proposal validator rejects invalid source-interface path", () => {
  const change = "validator-obligation-invalid-source-interface-change";
  const root = makeSimplifiedObligationProposalFixture(change);
  updateProposalTrace(root, change, (trace) => {
    trace["source-interface"]["global-atom-index-json"] = "openspec/orchestrate/missing-obligation-atom-index.json";
  });

  const result = validateProposalArtifact({ root, change });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-OBLIGATION-SOURCE-IFACE-004");
});

test("proposal validator rejects missing source-interface", () => {
  const change = "validator-obligation-missing-source-interface-change";
  const root = makeSimplifiedObligationProposalFixture(change);
  updateProposalTrace(root, change, (trace) => {
    delete trace["source-interface"];
  });

  const result = validateProposalArtifact({ root, change });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-OBLIGATION-PROPOSAL-001");
});

test("proposal validator rejects duplicate or extra direct GA register rows", () => {
  const change = "validator-obligation-duplicate-extra-ga-change";
  const root = makeSimplifiedObligationProposalFixture(change);
  updateProposalTrace(root, change, (trace) => {
    trace["change-ga-register"].push({ ...trace["change-ga-register"][0] });
    trace["change-ga-register"].push({
      ...trace["change-ga-register"][0],
      "ga-id": "GA-9999",
    });
  });

  const result = validateProposalArtifact({ root, change });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-OBLIGATION-REGISTER-001");
  assertHasRule(result, "VAL-OBLIGATION-REGISTER-002");
});

test("proposal validator rejects changed source fact in direct GA register", () => {
  const change = "validator-obligation-source-fact-drift-change";
  const root = makeSimplifiedObligationProposalFixture(change);
  updateProposalTrace(root, change, (trace) => {
    trace["change-ga-register"][0]["source-fact"] = "错误改写 source fact。";
  });

  const result = validateProposalArtifact({ root, change });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-OBLIGATION-REGISTER-009");
});

test("proposal validator rejects changed capability or projection in direct GA register", () => {
  const change = "validator-obligation-projection-drift-change";
  const root = makeSimplifiedObligationProposalFixture(change);
  updateProposalTrace(root, change, (trace) => {
    trace["change-ga-register"][0].capability = "wrong-capability";
    trace["change-ga-register"][0].projection = "design-obligation";
  });

  const result = validateProposalArtifact({ root, change });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-OBLIGATION-REGISTER-014");
  assertHasRule(result, "VAL-OBLIGATION-REGISTER-015");
});

test("proposal validator rejects propagated non-direct boundary ref", () => {
  const change = "validator-obligation-propagated-boundary-change";
  const root = makeSimplifiedObligationProposalFixture(change);
  updateProposalTrace(root, change, (trace) => {
    trace["non-direct-boundary-ref"][0].propagate = true;
  });

  const result = validateProposalArtifact({ root, change });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-OBLIGATION-BOUNDARY-005");
});

test("proposal validator rejects direct GA reused as non-direct boundary ref", () => {
  const change = "validator-obligation-boundary-direct-overlap-change";
  const root = makeSimplifiedObligationProposalFixture(change);
  updateProposalTrace(root, change, (trace) => {
    trace["non-direct-boundary-ref"][0]["ga-id"] = "GA-0001";
  });

  const result = validateProposalArtifact({ root, change });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-OBLIGATION-BOUNDARY-002");
  assertHasRule(result, "VAL-OBLIGATION-BOUNDARY-003");
});

test("proposal validator rejects non-empty proposal gate arrays", () => {
  const change = "validator-obligation-open-gate-change";
  const root = makeSimplifiedObligationProposalFixture(change);
  updateProposalTrace(root, change, (trace) => {
    trace["proposal-gate"]["orphan-ga"] = ["GA-9999"];
  });

  const result = validateProposalArtifact({ root, change });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-OBLIGATION-GATE-002");
});

test("proposal validator rejects missing artifact routing fields", () => {
  const change = "validator-obligation-missing-routing-change";
  const root = makeSimplifiedObligationProposalFixture(change);
  updateProposalTrace(root, change, (trace) => {
    delete trace["change-ga-register"][0]["routing-disposition"];
    delete trace["change-ga-register"][0]["artifact-routes"];
  });

  const result = validateProposalArtifact({ root, change });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-OBLIGATION-REGISTER-003");
  assertHasRule(result, "VAL-OBLIGATION-ROUTING-002");
});

test("proposal validator rejects invalid artifact routing target", () => {
  const change = "validator-obligation-invalid-routing-target-change";
  const root = makeSimplifiedObligationProposalFixture(change);
  updateProposalTrace(root, change, (trace) => {
    trace["change-ga-register"][0]["artifact-routes"][0].artifact = "runtime-acceptance";
  });

  const result = validateProposalArtifact({ root, change });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-OBLIGATION-ROUTING-008");
});

test("proposal validator rejects disposition and route shape mismatch", () => {
  const change = "validator-obligation-routing-disposition-mismatch-change";
  const root = makeSimplifiedObligationProposalFixture(change);
  updateProposalTrace(root, change, (trace) => {
    trace["change-ga-register"][0]["routing-disposition"] = "reference-only";
  });

  const result = validateProposalArtifact({ root, change });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-OBLIGATION-ROUTING-004");
});

test("proposal validator rejects routing rationale that uses final projection as route basis", () => {
  const change = "validator-obligation-routing-projection-echo-change";
  const root = makeSimplifiedObligationProposalFixture(change);
  updateProposalTrace(root, change, (trace) => {
    trace["change-ga-register"][0]["routing-rationale"] = "该行按 final projection 进入 specs。";
  });

  const result = validateProposalArtifact({ root, change });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-OBLIGATION-ROUTING-011");
});

test("proposal validator accepts dual specs and design artifact routes", () => {
  const change = "validator-obligation-dual-routing-change";
  const root = makeSimplifiedObligationProposalFixture(change);
  updateProposalTrace(root, change, (trace) => {
    trace["change-ga-register"][0]["artifact-routes"].push({
      artifact: "design",
      role: "design-input",
      use: "同一 GA 也约束最小实现边界。",
    });
  });

  const result = validateProposalArtifact({ root, change });

  assert.equal(result.ok, true, formatErrors(result));
});

test("proposal validator rejects obligation delivery plane register leaks", () => {
  const change = "validator-obligation-delivery-register-leak-change";
  const root = makeSimplifiedObligationProposalFixture(change);
  updateProposalTrace(root, change, (trace) => {
    trace["delivery-plane"].why = ["- 错误描述 change-ga-register。"];
  });

  const result = validateProposalArtifact({ root, change });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-OBLIGATION-DELIVERY-002");
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

test("proposal validator ignores handwritten markdown drift", () => {
  const change = "validator-render-drift-change";
  const root = makeDefaultFixture(change);
  fs.appendFileSync(
    path.join(root, "openspec", "changes", change, "proposal.md"),
    "\n手写漂移。\n",
  );

  const result = validateChange({ root, change });

  assert.equal(result.ok, true, formatErrors(result));
});

test("proposal validator ignores manifest render contract version", () => {
  const change = "validator-render-contract-version-change";
  const root = makeDefaultFixture(change);
  const manifestPath = path.join(root, "openspec", "changes", change, "trace", "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest["render-contract-version"] = "custom-render-version";
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const result = validateChange({ root, change });

  assert.equal(result.ok, true, formatErrors(result));
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
    trace["spec-delta-register"][0]["source-ids"] = ["GA-9999"];
    trace["spec-delta-register"][0].scenarios[0]["source-ids"] = ["GA-9999"];
  });

  const result = validateChange({ root, change, artifact: "specs" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-SPECS-SOURCE-002");
  assertHasRule(result, "VAL-SPECS-DELTA-040");
});

test("specs validator rejects non-direct boundary GA propagation", () => {
  const change = "validator-specs-boundary-ga-change";
  const root = makeObligationSpecsFixture(change);
  updateSpecsTrace(root, change, "capability-a", (trace) => {
    trace["spec-delta-register"][0]["source-ids"] = ["GA-0002"];
    trace["spec-delta-register"][0].scenarios[0]["source-ids"] = ["GA-0002"];
  });

  const result = validateChange({ root, change, artifact: "specs" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-SPECS-SOURCE-002");
});

test("specs validator rejects design-only routed GA propagation", () => {
  const change = "validator-specs-design-only-ga-change";
  const root = makeObligationSpecsFixture(change);
  addObligationDesignProposalRow(root, change);
  updateSpecsTrace(root, change, "capability-a", (trace) => {
    trace["spec-delta-register"][0]["source-ids"] = ["GA-0004"];
    trace["spec-delta-register"][0].scenarios[0]["source-ids"] = ["GA-0004"];
  });

  const result = validateChange({ root, change, artifact: "specs" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-SPECS-SOURCE-002");
});

test("specs validator rejects missing guard handling", () => {
  const change = "validator-specs-missing-guard-handling-change";
  const root = makeSimplifiedObligationProposalFixture(change);
  addObligationGuardProposalRow(root, change);
  writeObligationSpecsTrace(root, change, { includeGuard: true, omitGuardHandling: true });
  renderChangeArtifact({ root, change, artifact: "specs", capability: "capability-a", write: true });

  const result = validateChange({ root, change, artifact: "specs" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-SPECS-DELTA-007");
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

test("specs validator ignores handwritten specs markdown drift", () => {
  const change = "validator-specs-render-drift-change";
  const root = makeObligationSpecsFixture(change);
  fs.appendFileSync(
    path.join(root, "openspec", "changes", change, "specs", "capability-a", "spec.md"),
    "\n手写 specs 漂移。\n",
  );

  const result = validateChange({ root, change, artifact: "specs" });

  assert.equal(result.ok, true, formatErrors(result));
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

test("design validator passes structured technical implementation details", () => {
  const change = "validator-design-structured-details-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["implementation-design-register"][0]["implementation-details"].push(...structuredTechnicalDetails("IDR-001"));
  }, { render: true });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, true, formatErrors(result));
});

test("design validator passes obligation design input coverage", () => {
  const change = "validator-obligation-design-input-change";
  const root = makeObligationDesignFixture(change);
  addObligationDesignProposalRow(root, change);
  updateDesignTrace(root, change, (trace) => {
    trace["implementation-design-register"][0]["design-inputs"] = [
      {
        "source-item-id": "GA-0004",
        use: "约束最小闭环必须保留明确生产模块边界。",
      },
    ];
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, true, formatErrors(result));
});

test("design validator accepts dual-routed GA as design input", () => {
  const change = "validator-obligation-dual-routed-design-input-change";
  const root = makeObligationDesignFixture(change);
  updateProposalTrace(root, change, (trace) => {
    trace["change-ga-register"][0]["artifact-routes"].push({
      artifact: "design",
      role: "design-input",
      use: "同一 GA 也约束最小实现边界。",
    });
  });
  updateDesignTrace(root, change, (trace) => {
    trace["implementation-design-register"][0]["design-inputs"] = [
      {
        "source-item-id": "GA-0001",
        use: "约束最小闭环实现边界。",
      },
    ];
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, true, formatErrors(result));
});

test("design validator rejects spec-only routed GA as design input", () => {
  const change = "validator-design-spec-only-input-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["implementation-design-register"][0]["design-inputs"] = [
      {
        "source-item-id": "GA-0001",
        use: "错误把 specs-only GA 当作 design 输入。",
      },
    ];
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-INPUT-005");
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

test("design validator rejects missing implementation design register", () => {
  const change = "validator-design-missing-register-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    delete trace["implementation-design-register"];
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-TRACE-009");
});

test("design validator rejects legacy design fields", () => {
  const change = "validator-design-legacy-field-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["production-source-map"] = [];
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-LEGACY-001");
});

test("design validator rejects unknown specs anchors", () => {
  const change = "validator-design-unknown-spec-anchor-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["implementation-design-register"][0]["spec-anchors"] = [
      "trace/specs/capability-a.trace.json#/spec-delta-register/99/scenarios/0",
    ];
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-SPEC-ANCHOR-003");
});

test("design validator rejects uncovered specs scenario anchors", () => {
  const change = "validator-design-uncovered-spec-anchor-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["implementation-design-register"][0]["spec-anchors"] = [];
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-REGISTER-020");
});

test("design validator rejects uncovered design inputs", () => {
  const change = "validator-design-uncovered-input-change";
  const root = makeObligationDesignFixture(change);
  addObligationDesignProposalRow(root, change);

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-REGISTER-021");
});

test("design validator rejects non-design inputs", () => {
  const change = "validator-design-invalid-input-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["implementation-design-register"][0]["design-inputs"] = [
      {
        "source-item-id": "GA-0001",
        use: "错误地把 spec source 当作 design input。",
      },
    ];
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-INPUT-005");
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

test("design validator rejects design gate blockers", () => {
  const change = "validator-design-gate-blocker-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["design-gate"].blockers = ["unresolved design blocker"];
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-GATE-003");
});

test("design validator rejects delivery decisions outside register", () => {
  const change = "validator-design-delivery-mismatch-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["delivery-plane"].decisions[0]["decision-id"] = "IDR-999";
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-DELIVERY-021");
});

test("design validator rejects legacy delivery decision summary fields", () => {
  const change = "validator-design-delivery-summary-fields-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["delivery-plane"].decisions[0].title = "旧 summary 标题";
    trace["delivery-plane"].decisions[0].decision = "旧 summary decision";
    trace["delivery-plane"].decisions[0]["source-gap"] = "无。";
    trace["delivery-plane"].decisions[0]["minimal-shape"] = "使用最小模块边界。";
    trace["delivery-plane"].decisions[0]["rejected-expansion"] = "不新增额外能力。";
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-DELIVERY-022");
});

test("design validator ignores handwritten design markdown drift", () => {
  const change = "validator-design-render-drift-change";
  const root = makeObligationDesignFixture(change);
  fs.appendFileSync(
    path.join(root, "openspec", "changes", change, "design.md"),
    "\n手写 design 漂移。\n",
  );

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, true, formatErrors(result));
});

test("design validator rejects missing implementation details", () => {
  const change = "validator-design-missing-details-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    delete trace["implementation-design-register"][0]["implementation-details"];
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-DETAIL-001");
});

test("design validator rejects invalid implementation detail type", () => {
  const change = "validator-design-invalid-detail-type-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["implementation-design-register"][0]["implementation-details"][0]["detail-type"] = "database-contract";
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-DETAIL-007");
});

test("design validator rejects detail basis outside parent IDR", () => {
  const change = "validator-design-detail-basis-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["implementation-design-register"][0]["implementation-details"][0].basis = {
      "inherits-parent-spec-anchors": false,
      "spec-anchors": ["trace/specs/capability-a.trace.json#/spec-delta-register/99/scenarios/0"],
      "design-inputs": [],
    };
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-DETAIL-BASIS-005");
});

test("design validator rejects layer detail coverage gaps", () => {
  const change = "validator-design-layer-detail-gap-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["implementation-design-register"][0].layer = "api-auth-security";
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-DETAIL-040");
});

test("design validator rejects detail render order missing actual type", () => {
  const change = "validator-design-detail-render-order-missing-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["delivery-plane"]["detail-render-order"] = trace["delivery-plane"]["detail-render-order"].filter(
      (detailType) => detailType !== "module-boundary",
    );
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-DELIVERY-033");
});

test("design validator rejects duplicate detail render order types", () => {
  const change = "validator-design-detail-render-order-duplicate-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["delivery-plane"]["detail-render-order"].push("module-boundary");
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-DELIVERY-032");
});

test("design validator rejects fragmented design subjects across IDRs", () => {
  const change = "validator-design-fragmented-subject-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["implementation-design-register"].push({
      ...trace["implementation-design-register"][0],
      "implementation-design-id": "IDR-002",
      title: "重复主题设计",
      "implementation-details": [
        {
          ...trace["implementation-design-register"][0]["implementation-details"][0],
          "detail-id": "IDR-002-D001",
        },
      ],
    });
    trace["delivery-plane"].decisions.push({
      ...trace["delivery-plane"].decisions[0],
      "decision-id": "IDR-002",
    });
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-DETAIL-030");
});

test("design validator rejects placeholder detail content", () => {
  const change = "validator-design-placeholder-detail-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["implementation-design-register"][0]["implementation-details"][0].content = "- TODO 后续完善。";
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-DETAIL-021");
});

test("design validator rejects rendered detail trace leaks", () => {
  const change = "validator-design-rendered-detail-leak-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["implementation-design-register"][0]["implementation-details"][0].content = "- 错误泄漏 GA-0001。";
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-DETAIL-020");
});

test("design validator rejects detail content arrays", () => {
  const change = "validator-design-content-array-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["implementation-design-register"][0]["implementation-details"][0].content = [
      "- 错误地把 Markdown 正文拆成数组。",
    ];
  });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-DETAIL-011");
});

test("design validator rejects one-line data model content", () => {
  const change = "validator-design-one-line-data-model-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["implementation-design-register"][0]["implementation-details"].push({
      "detail-id": "IDR-001-D002",
      "detail-type": "data-model",
      owner: "DecisionFlowModule",
      subject: "draft aggregate",
      basis: {
        "inherits-parent-spec-anchors": true,
        "spec-anchors": [],
        "design-inputs": [],
      },
      content: "Draft 聚合保存 flowId、tenantId、payload 等字段。",
      "no-scope-expansion": "不新增执行日志。",
    });
  }, { render: true });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-DETAIL-050");
  assertHasRule(result, "VAL-DESIGN-DETAIL-051");
});

test("design validator rejects json shape without json code block", () => {
  const change = "validator-design-json-shape-without-code-change";
  const root = makeObligationDesignFixture(change);
  updateDesignTrace(root, change, (trace) => {
    trace["implementation-design-register"][0]["implementation-details"].push({
      "detail-id": "IDR-001-D002",
      "detail-type": "json-shape",
      owner: "DecisionFlowModule",
      subject: "draft payload",
      basis: {
        "inherits-parent-spec-anchors": true,
        "spec-anchors": [],
        "design-inputs": [],
      },
      content: detailContent([
        "- Draft payload 包含版本。",
        "- Draft payload 包含节点。",
        "- Draft payload 包含连线。",
        "- Draft payload 包含视图状态。",
      ]),
      "no-scope-expansion": "不新增执行日志。",
    });
  }, { render: true });

  const result = validateChange({ root, change, artifact: "design" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-DESIGN-DETAIL-052");
});

test("design validator rejects unstructured content for every detail type", () => {
  const cases = [
    ["module-boundary", "VAL-DESIGN-DETAIL-058"],
    ["data-model", "VAL-DESIGN-DETAIL-051"],
    ["json-shape", "VAL-DESIGN-DETAIL-052"],
    ["api-contract", "VAL-DESIGN-DETAIL-054"],
    ["dto-contract", "VAL-DESIGN-DETAIL-056"],
    ["frontend-contract", "VAL-DESIGN-DETAIL-059"],
    ["validation-error-contract", "VAL-DESIGN-DETAIL-060"],
    ["state-lifecycle", "VAL-DESIGN-DETAIL-061"],
    ["integration-boundary", "VAL-DESIGN-DETAIL-062"],
    ["migration-compatibility", "VAL-DESIGN-DETAIL-063"],
    ["observability-ops", "VAL-DESIGN-DETAIL-064"],
    ["rollout-compatibility", "VAL-DESIGN-DETAIL-065"],
    ["non-applicable", "VAL-DESIGN-DETAIL-066"],
  ];

  for (const [detailType, expectedRule] of cases) {
    const change = `validator-design-unstructured-${detailType}-change`;
    const root = makeObligationDesignFixture(change);
    updateDesignTrace(root, change, (trace) => {
      trace["implementation-design-register"][0]["implementation-details"].push({
        "detail-id": "IDR-001-D002",
        "detail-type": detailType,
        owner: "DecisionFlowModule",
        subject: `invalid-${detailType}`,
        basis: {
          "inherits-parent-spec-anchors": true,
          "spec-anchors": [],
          "design-inputs": [],
        },
        content: "一句话。",
        "no-scope-expansion": "不新增额外能力。",
      });
    }, { render: true });

    const result = validateChange({ root, change, artifact: "design" });

    assert.equal(result.ok, false, `${detailType} should reject unstructured content`);
    assertHasRule(result, "VAL-DESIGN-DETAIL-050");
    assertHasRule(result, expectedRule);
  }
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

test("runtime validator ignores handwritten runtime markdown drift", () => {
  const change = "validator-runtime-render-drift-change";
  const root = makeObligationRuntimeFixture(change);
  fs.appendFileSync(
    path.join(root, "openspec", "changes", change, "runtime-acceptance.md"),
    "\n手写 runtime 漂移。\n",
  );

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, true, formatErrors(result));
});

test("runtime validator rejects runtime fact required field missing", () => {
  const change = "validator-runtime-required-field-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    delete trace["runtime-fact-register"][0]["default-path-policy"];
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-FACT-013");
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

test("runtime validator rejects source-interface proposal trace input", () => {
  const change = "validator-runtime-source-interface-proposal-trace-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["source-interface"]["proposal-trace"] = "trace/proposal.trace.json";
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-SOURCE-INTERFACE-001");
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

test("runtime validator rejects proof proposal gate field", () => {
  const change = "validator-runtime-rejects-proof-gate-field-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["runtime-gate"]["uncovered-proof-proposal-items"] = [];
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-GATE-004");
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

test("runtime validator rejects proposal context source basis", () => {
  const change = "validator-runtime-proposal-context-source-basis-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["runtime-fact-register"][0]["source-basis"]["proposal-context"] = ["GA-0001"];
  }, { render: true });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-FACT-019");
});

test("runtime validator rejects missing spec scenario fact", () => {
  const change = "validator-runtime-spec-coverage-gap-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["runtime-fact-register"][0]["source-basis"]["spec-scenarios"] = [];
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-COVERAGE-SPEC-001");
});

test("runtime validator rejects missing design decision fact", () => {
  const change = "validator-runtime-design-decision-coverage-gap-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["runtime-fact-register"][0]["source-basis"]["design-decisions"] = [];
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-COVERAGE-DESIGN-001");
});

test("runtime validator rejects invalid source refs", () => {
  const change = "validator-runtime-coverage-inventory-mismatch-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["runtime-fact-register"].push({
      ...trace["runtime-fact-register"][0],
      "runtime-fact-id": "OP-001",
      "fact-type": "operation",
      "source-basis": {
        "spec-scenarios": ["trace/specs/capability-a.trace.json#/spec-delta-register/0/scenarios/0"],
        "design-decisions": ["IDR-999"],
        "proposal-context": ["GA-0001"],
      },
    });
    trace["delivery-plane"]["fact-sections"]["operation-facts"] = ["OP-001"];
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-FACT-021");
});

test("runtime validator rejects legacy RF fact shape", () => {
  const change = "validator-runtime-legacy-rf-shape-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["runtime-fact-register"].push({
      "fact-id": "RF-999",
      "source-anchor": "GA-0001",
      "source-type": "proposal-item",
      "source-handling": "spec-requirement",
      "fact-layer": "boundary",
      "fact-kind": "not-applicable",
      fact: "invalid legacy fact row",
      "runtime-fact-ids": ["RS-001"],
      "not-applicable-reason": "",
    });
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-LEGACY-003");
});

test("runtime validator rejects section reference without fact", () => {
  const change = "validator-runtime-section-only-fact-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["delivery-plane"]["fact-sections"]["surface-facts"].push("RS-002");
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-DELIVERY-005");
});

test("runtime validator rejects legacy runtime-row-ids field", () => {
  const change = "validator-runtime-legacy-runtime-row-ids-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["runtime-fact-register"][0]["runtime-row-ids"] = ["RS-999"];
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-LEGACY-003");
});

test("runtime validator rejects proposal-only runtime fact", () => {
  const change = "validator-runtime-proposal-only-non-proof-change";
  const root = makeObligationRuntimeFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["runtime-fact-register"][0]["source-basis"] = {
      "spec-scenarios": [],
      "design-decisions": [],
      "proposal-context": ["GA-0001"],
    };
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-RUNTIME-FACT-019");
  assertHasRule(result, "VAL-RUNTIME-FACT-023");
});

test("runtime validator ignores verification-obligation proposal item", () => {
  const change = "validator-runtime-ignores-verification-obligation-change";
  const root = makeObligationRuntimeFixture(change);
  updateProposalTrace(root, change, (trace) => {
    trace["change-ga-register"].push({
      ...trace["change-ga-register"][0],
      "ga-id": "GA-0099",
      "source-fact": "必须证明最小闭环 runtime 行为。",
      projection: "verification-obligation",
    });
  });

  const result = validateChange({ root, change, artifact: "runtime-acceptance" });

  assert.equal(result.ok, true, formatErrors(result));
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

test("verification validator ignores handwritten verification markdown drift", () => {
  const change = "validator-verification-render-drift-change";
  const root = makeObligationVerificationFixture(change);
  fs.appendFileSync(
    path.join(root, "openspec", "changes", change, "verification.md"),
    "\n手写 verification 漂移。\n",
  );

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, true, formatErrors(result));
});

test("verification validator rejects missing verification slice register", () => {
  const change = "validator-verification-missing-slice-register-change";
  const root = makeObligationVerificationFixture(change);
  updateVerificationTrace(root, change, (trace) => {
    delete trace["verification-slice-register"];
  });

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-SLICE-REGISTER-001");
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
  writeJson(root, `openspec/changes/${change}/trace/verification.proof-slices.json`, { legacy: true });

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-V2-LEGACY-001");
  assertHasRule(result, "VAL-VERIFICATION-V2-LEGACY-002");
  assertHasRule(result, "VAL-VERIFICATION-MANIFEST-003");
});

test("verification validator rejects unknown runtime fact", () => {
  const change = "validator-verification-unknown-runtime-row-change";
  const root = makeObligationVerificationFixture(change);
  updateVerificationTrace(root, change, (trace) => {
    trace["verification-slice-register"][0]["runtime-fact-ids"] = ["RS-999"];
  });

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-SLICE-007");
});

test("verification validator rejects source-interface proposal trace input", () => {
  const change = "validator-verification-source-interface-proposal-trace-change";
  const root = makeObligationVerificationFixture(change);
  updateVerificationTrace(root, change, (trace) => {
    trace["source-interface"]["proposal-trace"] = "trace/proposal.trace.json";
  });

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-SOURCE-002");
});

test("verification validator rejects proof-only runtime fact", () => {
  const change = "validator-verification-proof-only-runtime-fact-change";
  const root = makeObligationVerificationFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["runtime-fact-register"][0]["scope-role"] = "proof-only";
  });

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-RUNTIME-010");
});

test("verification validator rejects primary runtime fact outside slice rows", () => {
  const change = "validator-verification-primary-row-outside-slice-change";
  const root = makeObligationVerificationFixture(change);
  updateVerificationTrace(root, change, (trace) => {
    trace["verification-slice-register"][0]["primary-runtime-fact-id"] = "OP-001";
  });

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-SLICE-009");
});

test("verification validator rejects non-durable slice with durable placement", () => {
  const change = "validator-verification-non-durable-placement-mismatch-change";
  const root = makeObligationVerificationFixture(change);
  updateVerificationTrace(root, change, (trace) => {
    trace["verification-slice-register"][0]["proof-evidence-mode"] = "readiness-command";
  });

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-PLACEMENT-003");
});

test("verification validator rejects concrete test file placement", () => {
  const change = "validator-verification-concrete-test-file-change";
  const root = makeObligationVerificationFixture(change);
  updateVerificationTrace(root, change, (trace) => {
    trace["verification-slice-register"][0]["planned-test-directory"] = "apps/control-api/tests/api/minimal.test.ts";
  });

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-PLACEMENT-005");
  assertHasRule(result, "VAL-VERIFICATION-FORBIDDEN-001");
});

test("verification validator rejects non-empty verification gate", () => {
  const change = "validator-verification-gate-blocker-change";
  const root = makeObligationVerificationFixture(change);
  updateVerificationTrace(root, change, (trace) => {
    trace["verification-gate"].blockers = ["oracle 冲突。"];
  });

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-GATE-003");
});

test("verification validator rejects uncovered runtime fact", () => {
  const change = "validator-verification-coverage-gap-change";
  const root = makeObligationVerificationFixture(change);
  updateVerificationTrace(root, change, (trace) => {
    trace["verification-slice-register"] = [];
  });

  const result = validateChange({ root, change, artifact: "verification" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-VERIFICATION-COVERAGE-001");
});

test("verification validator rejects fixed command and result path leaks", () => {
  const change = "validator-verification-command-leak-change";
  const root = makeObligationVerificationFixture(change);
  updateVerificationTrace(root, change, (trace) => {
    trace["verification-slice-register"][0]["fixture-boundary"] =
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

test("tasks validator ignores handwritten tasks markdown drift", () => {
  const change = "validator-tasks-render-drift-change";
  const root = makeObligationTasksFixture(change);
  fs.appendFileSync(
    path.join(root, "openspec", "changes", change, "tasks.md"),
    "\n手写 tasks 漂移。\n",
  );

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, true, formatErrors(result));
});

test("tasks validator rejects missing writeback checkbox row", () => {
  const change = "validator-tasks-missing-checkbox-change";
  const root = makeObligationTasksFixture(change);
  const tasksPath = path.join(root, "openspec", "changes", change, "tasks.md");
  const current = fs.readFileSync(tasksPath, "utf8");
  fs.writeFileSync(tasksPath, current.replace("- [ ] AC-001.1", "- AC-001.1"));

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-CHECKBOX-002");
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

test("tasks validator rejects unknown runtime fact references", () => {
  const change = "validator-tasks-unknown-runtime-row-change";
  const root = makeObligationTasksFixture(change);
  updateTasksTrace(root, change, (trace) => {
    trace["implementation-step-register"][0]["runtime-fact-links"] = [{ "runtime-fact-id": "RS-999", contribution: "completes" }];
    trace["implementation-step-register"][0].tasks[0]["runtime-fact-links"] = [{ "runtime-fact-id": "RS-999", contribution: "completes" }];
  }, { render: true });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-RUNTIME-LINK-005");
});

test("tasks validator rejects task id drift outside owning AC", () => {
  const change = "validator-tasks-task-id-drift-change";
  const root = makeObligationTasksFixture(change);
  updateTasksTrace(root, change, (trace) => {
    trace["implementation-step-register"][0].tasks[0]["task-id"] = "AC-002.1";
  }, { render: true });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-TASK-004");
});

test("tasks validator rejects spec scenario without completes contribution", () => {
  const change = "validator-tasks-spec-supports-only-change";
  const root = makeObligationTasksFixture(change);
  updateTasksTrace(root, change, (trace) => {
    trace["implementation-step-register"][0]["spec-scenario-links"][0].contribution = "supports";
    trace["implementation-step-register"][0].tasks[0]["spec-scenario-links"][0].contribution = "supports";
  }, { render: true });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-SPEC-COVERAGE-001");
});

test("tasks validator rejects design detail without completes contribution", () => {
  const change = "validator-tasks-design-part-only-change";
  const root = makeObligationTasksFixture(change);
  updateTasksTrace(root, change, (trace) => {
    trace["implementation-step-register"][0]["design-detail-links"][0].contribution = "implements-part";
    trace["implementation-step-register"][0].tasks[0]["design-detail-links"][0].contribution = "implements-part";
  }, { render: true });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-DESIGN-COVERAGE-001");
});

test("tasks validator rejects required runtime fact with supports-only contribution", () => {
  const change = "validator-tasks-runtime-supports-only-change";
  const root = makeObligationTasksFixture(change);
  updateTasksTrace(root, change, (trace) => {
    trace["implementation-step-register"][0]["runtime-fact-links"][0].contribution = "supports";
    trace["implementation-step-register"][0].tasks[0]["runtime-fact-links"][0].contribution = "supports";
  }, { render: true });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-RUNTIME-CLOSURE-001");
});

test("tasks validator rejects preserve runtime fact without enforces contribution", () => {
  const change = "validator-tasks-preserve-runtime-without-enforces-change";
  const root = makeObligationTasksFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["runtime-fact-register"][0]["scope-role"] = "preserve boundary";
  });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-RUNTIME-CLOSURE-001");
});

test("tasks validator rejects step links that do not match checkbox aggregation", () => {
  const change = "validator-tasks-step-task-link-drift-change";
  const root = makeObligationTasksFixture(change);
  updateTasksTrace(root, change, (trace) => {
    trace["implementation-step-register"][0]["runtime-fact-links"][0].contribution = "supports";
  }, { render: true });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-LINKS-002");
});

test("tasks validator rejects required runtime fact missing closing task contribution", () => {
  const change = "validator-tasks-missing-runtime-target-coverage-change";
  const root = makeObligationTasksFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["runtime-fact-register"].push({
      ...trace["runtime-fact-register"][0],
      "runtime-fact-id": "OP-001",
      "fact-type": "operation",
      "runtime-fact": "系统执行最小闭环操作。",
    });
  });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-RUNTIME-CLOSURE-001");
});

test("tasks validator rejects proof-only runtime fact targets", () => {
  const change = "validator-tasks-proof-only-target-change";
  const root = makeObligationTasksFixture(change);
  updateRuntimeTrace(root, change, (trace) => {
    trace["runtime-fact-register"][0]["scope-role"] = "proof-only";
  });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-RUNTIME-LINK-006");
});

test("tasks validator rejects old top-level tasks trace fields", () => {
  const change = "validator-tasks-old-top-level-fields-change";
  const root = makeObligationTasksFixture(change);
  updateTasksTrace(root, change, (trace) => {
    trace["acceptance-driven-coverage"] = {};
    trace["runtime-acceptance-index"] = {};
    trace["runtime-acceptance-projection"] = {};
  });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-FORBIDDEN-001");
});

test("tasks validator rejects old step and task fields", () => {
  const change = "validator-tasks-old-step-task-fields-change";
  const root = makeObligationTasksFixture(change);
  updateTasksTrace(root, change, (trace) => {
    trace["implementation-step-register"][0].outcome = ["- 旧 Outcome。"];
    trace["implementation-step-register"][0].preserve = ["- 旧 Preserve。"];
    trace["implementation-step-register"][0]["runtime-fact-ids"] = ["RS-001"];
    trace["implementation-step-register"][0].tasks[0].acceptance = "旧 Acceptance。";
    trace["implementation-step-register"][0].tasks[0].proof = "旧 Proof。";
    trace["implementation-step-register"][0].tasks[0]["runtime-fact-ids"] = ["RS-001"];
  }, { render: true });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-FORBIDDEN-001");
  assertHasRule(result, "VAL-TASKS-STEP-000");
  assertHasRule(result, "VAL-TASKS-TASK-000");
});

test("tasks validator rejects AC dependency order violations", () => {
  const change = "validator-tasks-dependency-order-change";
  const root = makeObligationTasksFixture(change);
  updateTasksTrace(root, change, (trace) => {
    const secondStep = structuredClone(trace["implementation-step-register"][0]);
    secondStep["step-id"] = "AC-002";
    secondStep.title = "第二生产步骤";
    secondStep["depends-on-step-ids"] = [];
    secondStep.tasks[0]["task-id"] = "AC-002.1";
    trace["implementation-step-register"][0]["depends-on-step-ids"] = ["AC-002"];
    trace["implementation-step-register"].push(secondStep);
    trace["delivery-plane"]["step-sections"].push("AC-002");
  }, { render: true });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-DEPENDENCY-001");
});

test("tasks validator rejects fixed command and evidence leaks", () => {
  const change = "validator-tasks-command-evidence-leak-change";
  const root = makeObligationTasksFixture(change);
  updateTasksTrace(root, change, (trace) => {
    trace["implementation-step-register"][0].tasks[0].work =
      "运行 pnpm vitest apps/control-api/tests/api/minimal.test.ts 并写入 openspec-results/x/result.json。";
  }, { render: true });

  const result = validateChange({ root, change, artifact: "tasks" });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-TASKS-FORBIDDEN-002");
});

test("complete validator passes apply-required runtime verification and tasks reconciliation", () => {
  const change = "validator-complete-change";
  const root = makeObligationVerificationFixture(change);
  writeTasksTrace(root, change, tasksTrace({
    change,
    schemaName: "production-obligation-atom-driven",
    sourceItemId: "GA-0001",
    sourceItemField: "ga-id",
    projectionField: "projection",
    projectionValue: "spec-requirement",
    mainCoverageField: "obligation-atom-coverage",
    designCoverageField: "design-obligation-coverage",
  }));
  renderChangeArtifact({ root, change, artifact: "tasks", write: true });

  const result = validateChange({ root, change, artifact: "tasks", complete: true });

  assert.equal(result.ok, true, formatErrors(result));
});

test("complete validator rejects missing apply-required tasks trace", () => {
  const change = "validator-complete-missing-tasks-change";
  const root = makeObligationVerificationFixture(change);

  const result = validateChange({ root, change, complete: true });

  assert.equal(result.ok, false);
  assertHasRule(result, "VAL-COMPLETE-TRACE-001");
});

function makeSimplifiedObligationProposalFixture(change) {
  return makeObligationFixture(change, { traceFactory: simplifiedObligationTrace });
}

function makeObligationFixture(change, options = {}) {
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

  const traceFactory = options.traceFactory ?? obligationTrace;
  writeProposalTrace(root, change, traceFactory(change, paths));
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

function simplifiedObligationTrace(change, paths) {
  return {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "proposal",
    "artifact-path": "proposal.md",
    "change-name": change,
    "schema-name": "production-obligation-atom-driven",
    "agent-role": "proposal-writer",
    "delivery-plane": proposalDelivery(),
    "source-interface": {
      "input-mode": "final-change-packet",
      "orchestrate-manifest": "openspec/orchestrate/trace/manifest.json",
      "global-atom-index-json": "openspec/orchestrate/change-capability-anchors/obligation-atom-index.json",
      "atom-plan-mapping-json": "openspec/orchestrate/phase-works/phase-5/atom-plan-mapping.json",
      "final-packet-index-json": "openspec/orchestrate/phase-works/phase-5/final-packet-index.json",
      "canonical-change-packet": paths.packet,
      "capability-view-capability-a": paths.capabilityView,
    },
    "change-ga-register": [
      {
        "ga-id": "GA-0001",
        "source-document": "docs/source.md",
        lines: "L1-L2",
        "source-fact": "用户可以完成一个最小闭环。",
        normativity: "must",
        "atom-type": "primary-action",
        capability: "capability-a",
        projection: "spec-requirement",
        "routing-disposition": "projected",
        "artifact-routes": [
          {
            artifact: "specs",
            role: "spec-requirement",
            use: "作为 specs 正向 requirement/scenario 输入。",
          },
        ],
        "routing-rationale": "原始 GA 表达用户可观察的最小闭环行为，应进入 specs。",
        "routing-no-scope-expansion": "不扩展额外能力。",
        "proposal-use": "进入 proposal 范围。",
        "downstream-expectation": "进入 specs/design/runtime/tasks/verification。",
      },
    ],
    "non-direct-boundary-ref": [
      {
        "ga-id": "GA-0002",
        "source-document": "docs/source.md",
        lines: "L3-L4",
        "source-fact": "不交付额外能力。",
        "boundary-role": "explicit-non-goal",
        propagate: false,
        "proposal-use": "进入非目标边界。",
      },
    ],
    "proposal-gate": {
      blockers: [],
      "orphan-ga": [],
      "source-set-mismatch": [],
      "non-direct-propagation-violations": [],
      "routing-missing": [],
      "routing-invalid": [],
      "routing-route-violations": [],
      "routing-source-conflicts": [],
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
  const root = makeSimplifiedObligationProposalFixture(change);
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
    projectionField: "projection",
    projectionValue: "spec-requirement",
    sourceBasis: "GA-0001; specs `最小闭环 / 完成最小闭环`; IDR-001.",
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
    sourceBasis: "SI-001; specs `最小闭环 / 完成最小闭环`; IDR-001.",
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
    sourceItemField: "ga-id",
    projectionField: "projection",
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
  const specScenario = "trace/specs/capability-a.trace.json#/spec-delta-register/0/scenarios/0";
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
      "input-policy": "tasks uses specs/design as implementation inputs and runtime-acceptance facts as contribution/closure mapping; Markdown, verification, tests, and evidence are not semantic inputs.",
    },
    "implementation-step-register": [
      {
        "step-id": "AC-001",
        title: "最小闭环生产步骤",
        "work-stage": "behavior",
        "depends-on-step-ids": [],
        "spec-scenario-links": [
          {
            "spec-scenario": specScenario,
            contribution: "completes",
          },
        ],
        "design-detail-links": [
          {
            "design-detail-id": "IDR-001-D001",
            contribution: "completes",
          },
        ],
        "runtime-fact-links": [
          {
            "runtime-fact-id": "RS-001",
            contribution: "completes",
          },
        ],
        tasks: [
          {
            "task-id": "AC-001.1",
            title: "实现最小闭环生产行为",
            "work-stage": "behavior",
            "spec-scenario-links": [
              {
                "spec-scenario": specScenario,
                contribution: "completes",
              },
            ],
            "design-detail-links": [
              {
                "design-detail-id": "IDR-001-D001",
                contribution: "completes",
              },
            ],
            "runtime-fact-links": [
              {
                "runtime-fact-id": "RS-001",
                contribution: "completes",
              },
            ],
            work: "实现最小生产 API 或 UI 闭环。",
          },
        ],
      },
    ],
    "task-gate": {
      blockers: [],
      "uncovered-spec-scenarios": [],
      "incomplete-design-details": [],
      "incomplete-runtime-facts": [],
      "invalid-spec-refs": [],
      "invalid-design-detail-refs": [],
      "invalid-runtime-fact-refs": [],
      "dependency-order-violations": [],
      "hidden-dependency-violations": [],
      "non-production-task-violations": [],
      "delivery-projection-mismatch": [],
    },
    "delivery-plane": {
      "step-sections": ["AC-001"],
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
      "runtime-trace": "trace/runtime-acceptance.trace.json",
      "spec-traces": ["trace/specs/capability-a.trace.json"],
      "design-trace": "trace/design.trace.json",
      "input-policy": "verification derives oracle from runtime-acceptance only; proposal trace is not a semantic input.",
    },
    "verification-slice-register": [
      {
        "slice-id": "PS-001",
        "runtime-fact-ids": ["RS-001"],
        "primary-runtime-fact-id": "RS-001",
        "proof-type": "operation",
        branch: "minimal runtime success",
        oracle: "API 或 UI readback 显示最小闭环完成。",
        "failure-signal": "readback 未显示最小闭环完成。",
        "test-layer": "route/API",
        "production-owner": "apps/control-api",
        "assertion-shape": "route response/readback assertion",
        "fixture-boundary": "允许最小请求 fixture，默认 API 路径保持真实。",
        "proof-evidence-mode": "durable-test",
        "planned-test-directory": "apps/control-api/tests/api/**",
        "non-persistent-reason": "N/A",
      },
    ],
    "verification-gate": {
      blockers: [],
      "uncovered-runtime-facts": [],
      "invalid-runtime-refs": [],
      "non-atomic-slices": [],
      "invalid-proof-modes": [],
      "invalid-test-placement": [],
      "delivery-projection-mismatch": [],
    },
    "delivery-plane": {
      "verification-intent": {
        scope: "覆盖最小闭环 runtime fact 的成功分支。",
        "runtime-source": "trace/runtime-acceptance.trace.json#/runtime-fact-register",
        "out-of-scope": "不规划执行命令、具体测试文件或 evidence 路径。",
      },
    },
  };
}

function runtimeTrace(options) {
  const specScenarioId = "trace/specs/capability-a.trace.json#/spec-delta-register/0/scenarios/0";
  return {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "runtime-acceptance",
    "artifact-path": "runtime-acceptance.md",
    "change-name": options.change,
    "schema-name": options.schemaName,
    "agent-role": "runtime-acceptance-writer",
    "source-interface": {
      "specs-completion-mode": "delta",
      "spec-traces": ["trace/specs/capability-a.trace.json"],
      "design-trace": "trace/design.trace.json",
      "markdown-input-policy": "runtime acceptance consumes specs/design JSON traces only.",
    },
    "runtime-fact-register": [
      {
        "runtime-fact-id": "RS-001",
        "fact-type": "surface",
        "scope-role": "required behavior",
        "source-basis": {
          "spec-scenarios": [specScenarioId],
          "design-decisions": ["IDR-001"],
        },
        "owner-candidate": "apps/control-api",
        "runtime-fact": "用户可以完成一个最小闭环。",
        "observable-fact": "API 或 UI readback 显示最小闭环完成。",
        "default-path-policy": "默认路径使用真实 API，不使用静态 fixture。",
        "external-boundary": "不访问额外外部系统。",
        "no-scope-expansion-check": "只覆盖当前 source/scope item 和 IDR-001。",
      },
    ],
    "runtime-gate": {
      blockers: [],
      "uncovered-spec-scenarios": [],
      "uncovered-runtime-design-decisions": [],
      "orphan-runtime-facts": [],
      "invalid-source-refs": [],
      "delivery-projection-mismatch": [],
    },
    "delivery-plane": {
      "runtime-acceptance-intent": {
        scope: "覆盖最小闭环 runtime surface。",
        "source-basis": "spec/design trace。",
        "out-of-scope": "不扩展额外能力。",
      },
      "fact-sections": {
        "surface-facts": ["RS-001"],
        "operation-facts": [],
        "state-facts": [],
        "chain-facts": [],
      },
    },
  };
}

function writeObligationSpecsTrace(root, change, options = {}) {
  const register = [
    {
      "delta-id": "SD-001",
      "delta-op": "added",
      requirement: "最小闭环",
      body: "系统 SHALL 允许用户完成一个最小闭环。",
      scenarios: [
        {
          name: "完成最小闭环",
          when: "用户开始最小闭环",
          then: "系统完成该闭环",
          "source-ids": ["GA-0001"],
        },
      ],
      "source-ids": ["GA-0001"],
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
      "delta-id": "SD-002",
      "delta-op": "added",
      requirement: "额外副作用边界",
      body: "系统 MUST NOT 交付额外副作用。",
      scenarios: [
        {
          name: "阻止额外副作用",
          when: "用户尝试使用额外副作用能力",
          then: "系统拒绝该能力进入当前闭环",
          "source-ids": ["GA-0003"],
        },
      ],
      "source-ids": ["GA-0003"],
    };
    if (!options.omitGuardHandling) {
      guardRow["guard-handling"] = "must-not";
    }
    register.push(guardRow);
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
    "source-interface": {
      "proposal-trace": "trace/proposal.trace.json",
      "existing-spec": "openspec/specs/capability-a/spec.md",
      "existing-spec-read-mode": "absent",
      "input-policy": "specs consumes proposal change-ga-register and focused existing spec only.",
    },
    "existing-spec-state": {
      status: "absent",
      path: "openspec/specs/capability-a/spec.md",
      "requirement-anchors": [],
    },
    "spec-delta-register": register,
    "spec-gate": emptySpecGate(),
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
      "input-policy": "design consumes proposal/spec trace only.",
    },
    "implementation-design-register": [
      {
        "implementation-design-id": "IDR-001",
        layer: "architecture-module-boundary",
        title: "最小闭环设计",
        "spec-anchors": ["trace/specs/capability-a.trace.json#/spec-delta-register/0/scenarios/0"],
        "design-inputs": [],
        decision: "使用 control-api 与 console-web 的最小边界完成闭环。",
        "implementation-boundary": "apps/control-api/src/capability-a",
        "implementation-contract": "实现最小闭环 API 边界。",
        "guard-failure-handling": "N/A",
        "verification-handoff": "交给后续 runtime/verification 设计。",
        "no-scope-expansion": "不扩展额外能力。",
        blocker: "无",
        "implementation-details": minimalImplementationDetails("IDR-001"),
      },
    ],
    "design-gate": {
      blockers: [],
      "uncovered-spec-anchors": [],
      "uncovered-design-inputs": [],
      "invalid-design-inputs": [],
      "missing-implementation-details": [],
      "invalid-implementation-details": [],
      "detail-basis-violations": [],
      "layer-detail-coverage-gaps": [],
      "fragmented-design-subjects": [],
      "placeholder-detail-content": [],
      "delivery-projection-mismatch": [],
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
      "input-policy": "design consumes proposal/spec trace only.",
    },
    "implementation-design-register": [
      {
        "implementation-design-id": "IDR-001",
        layer: "architecture-module-boundary",
        title: "最小闭环设计",
        "spec-anchors": noDelta ? [] : ["trace/specs/capability-a.trace.json#/spec-delta-register/0/scenarios/0"],
        "design-inputs": noDelta
          ? [
              {
                "source-item-id": "SI-001",
                use: "作为 no-delta design 输入约束最小生产边界。",
              },
            ]
          : [],
        decision: "使用 default scope 的最小生产边界完成闭环。",
        "implementation-boundary": "apps/control-api/src/capability-a",
        "implementation-contract": "实现最小闭环 API 边界。",
        "guard-failure-handling": "N/A",
        "verification-handoff": "交给后续 runtime/verification 设计。",
        "no-scope-expansion": "不扩展额外能力。",
        blocker: "无",
        "implementation-details": minimalImplementationDetails("IDR-001"),
      },
    ],
    "design-gate": {
      blockers: [],
      "uncovered-spec-anchors": [],
      "uncovered-design-inputs": [],
      "invalid-design-inputs": [],
      "missing-implementation-details": [],
      "invalid-implementation-details": [],
      "detail-basis-violations": [],
      "layer-detail-coverage-gaps": [],
      "fragmented-design-subjects": [],
      "placeholder-detail-content": [],
      "delivery-projection-mismatch": [],
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
    "source-interface": {
      "proposal-trace": "trace/proposal.trace.json",
      "existing-spec": "openspec/specs/capability-a/spec.md",
      "existing-spec-read-mode": "absent",
      "input-policy": "specs consumes proposal change-scope-coverage and focused existing spec only.",
    },
    "existing-spec-state": {
      status: "absent",
      path: "openspec/specs/capability-a/spec.md",
      "requirement-anchors": [],
    },
    "spec-delta-register": [
      {
        "delta-id": "SD-001",
        "delta-op": "added",
        requirement: "最小闭环",
        body: "系统 SHALL 允许用户完成一个最小闭环。",
        scenarios: [
          {
            name: "完成最小闭环",
            when: "用户开始最小闭环",
            then: "系统完成该闭环",
            "source-ids": ["SI-001"],
          },
        ],
        "source-ids": ["SI-001"],
      },
    ],
    "spec-gate": emptySpecGate(),
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
    "source-proposal-trace-path": "trace/proposal.trace.json",
    "specs-completion-mode": "no-delta",
    "source-interface": {
      "proposal-trace": "trace/proposal.trace.json",
      "existing-spec": "openspec/specs/no-spec-delta/spec.md",
      "existing-spec-read-mode": "absent",
      "input-policy": "specs consumes proposal change-scope-coverage and emits no-delta marker when no spec/guard item exists.",
    },
    "existing-spec-state": {
      status: "absent",
      path: "openspec/specs/no-spec-delta/spec.md",
      "requirement-anchors": [],
    },
    "spec-delta-register": [],
    "spec-gate": emptySpecGate(),
    "delivery-plane": {
      "completion-mode": "no-delta",
      summary: ["- 本 change 无 OpenSpec requirement/guard delta。"],
      "projection-closure": ["- specs artifact 以 no-delta marker 完成。"],
    },
  });
}

function emptySpecGate() {
  return {
    blockers: [],
    "orphan-source-ids": [],
    "source-set-mismatch": [],
    "existing-spec-state-violations": [],
    "delivery-projection-mismatch": [],
  };
}

function addObligationGuardProposalRow(root, change) {
  updateProposalTrace(root, change, (trace) => {
    trace["change-ga-register"].push({
      "ga-id": "GA-0003",
      "source-document": "docs/source.md",
      lines: "L5-L6",
      "atom-type": "preserve-boundary",
      "source-fact": "系统不得交付额外副作用。",
      normativity: "must-not",
      capability: "capability-a",
      projection: "spec-guard",
      "routing-disposition": "projected",
      "artifact-routes": [
        {
          artifact: "specs",
          role: "spec-guard",
          use: "作为 specs guard / MUST NOT 边界输入。",
        },
      ],
      "routing-rationale": "该 GA 表达 preserve boundary，应进入 specs guard。",
      "routing-no-scope-expansion": "不把额外副作用实现进当前闭环。",
      "propose-use": "作为 specs guard。",
      "downstream-expectation": "进入 specs guard。",
    });
  });
}

function addObligationDesignProposalRow(root, change) {
  updateProposalTrace(root, change, (trace) => {
    trace["change-ga-register"].push({
      "ga-id": "GA-0004",
      "source-document": "docs/source.md",
      lines: "L7-L8",
      "atom-type": "architecture-runtime",
      "source-fact": "最小闭环必须保留明确生产模块边界。",
      normativity: "must",
      capability: "capability-a",
      projection: "design-obligation",
      "routing-disposition": "projected",
      "artifact-routes": [
        {
          artifact: "design",
          role: "design-input",
          use: "作为 design 实现边界输入。",
        },
      ],
      "routing-rationale": "该 GA 表达生产模块边界，应进入 design。",
      "routing-no-scope-expansion": "不新增额外模块或外部依赖。",
      "propose-use": "作为 design 输入。",
      "downstream-expectation": "进入 design input。",
    });
  });
}

function designDelivery(options = {}) {
  const delivery = {
    context: ["- design 来自 trace。"],
    "goals-non-goals": ["- goal 来自 trace；不扩展额外能力。"],
    decisions: [
      {
        "decision-id": "IDR-001",
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
    "detail-render-order": [
      "module-boundary",
      "data-model",
      "json-shape",
      "api-contract",
      "dto-contract",
      "frontend-contract",
      "validation-error-contract",
      "state-lifecycle",
      "integration-boundary",
      "migration-compatibility",
      "observability-ops",
      "rollout-compatibility",
      "non-applicable",
    ],
  };
  if (options.defaultFrontendAlias) {
    delivery["frontend-ux-design"] = delivery["frontend-ux-prototype-fidelity-design"];
    delete delivery["frontend-ux-prototype-fidelity-design"];
  }
  return delivery;
}

function minimalImplementationDetails(parentId) {
  return [
    {
      "detail-id": `${parentId}-D001`,
      "detail-type": "module-boundary",
      owner: "DecisionFlowModule",
      subject: "最小闭环模块边界",
      basis: {
        "inherits-parent-spec-anchors": true,
        "spec-anchors": [],
        "design-inputs": [],
      },
      content: detailContent([
        "- DecisionFlowModule 承载最小闭环的后端业务边界，并通过 control-api 暴露生产入口。",
        "- console-web 只通过 control-api 发起请求并展示后端返回状态，不直接访问持久化或执行面。",
      ]),
      "no-scope-expansion": "不新增额外业务域、外部 provider 或绕过 control-api 的访问路径。",
    },
  ];
}

function detailContent(lines) {
  return lines.join("\n");
}

function structuredTechnicalDetails(parentId) {
  const basis = {
    "inherits-parent-spec-anchors": true,
    "spec-anchors": [],
    "design-inputs": [],
  };
  return [
    {
      "detail-id": `${parentId}-D002`,
      "detail-type": "data-model",
      owner: "DecisionFlowModule",
      subject: "decision_flow_drafts",
      basis,
      content: detailContent([
        "Data model:",
        "",
        "| Field | Type | Nullable | Default | Index / Constraint | Notes |",
        "| --- | --- | --- | --- | --- | --- |",
        "| id | uuid | no | generated | primary key | Draft stable identifier. |",
        "| tenant_id | uuid | no | none | index | Tenant isolation boundary. |",
        "| graph | jsonb | no | '{}' | none | Versioned graph payload. |",
        "| updated_at | timestamptz | no | now() | index | Save ordering and optimistic readback. |",
      ]),
      "no-scope-expansion": "不保存执行日志或发布指针。",
    },
    {
      "detail-id": `${parentId}-D003`,
      "detail-type": "json-shape",
      owner: "DecisionFlowModule",
      subject: "draft graph payload",
      basis,
      content: detailContent([
        "JSON shape:",
        "",
        "```json",
        "{",
        "  \"version\": 1,",
        "  \"nodes\": [",
        "    {",
        "      \"id\": \"node-1\",",
        "      \"type\": \"response\",",
        "      \"position\": { \"x\": 120, \"y\": 160 }",
        "    }",
        "  ],",
        "  \"edges\": []",
        "}",
        "```",
      ]),
      "no-scope-expansion": "不引入跨 Draft 全局变量。",
    },
    {
      "detail-id": `${parentId}-D004`,
      "detail-type": "api-contract",
      owner: "DecisionFlowModule",
      subject: "POST /flows/:flowId/draft",
      basis,
      content: detailContent([
        "API contract:",
        "",
        "| Method | Path | Auth / Tenant Boundary | Success | Error |",
        "| --- | --- | --- | --- | --- |",
        "| POST | /flows/:flowId/draft | actor tenant must own flow | 200 DraftResponseDto | 400 ValidationErrorDto, 409 VersionConflictDto |",
        "",
        "Request body:",
        "",
        "```json",
        "{",
        "  \"expectedVersion\": 3,",
        "  \"graph\": { \"version\": 1, \"nodes\": [], \"edges\": [] }",
        "}",
        "```",
        "",
        "- Response includes the saved draft version and blocking issue summary.",
      ]),
      "no-scope-expansion": "不生成发布版本。",
    },
    {
      "detail-id": `${parentId}-D005`,
      "detail-type": "dto-contract",
      owner: "DecisionFlowModule",
      subject: "DraftResponseDto",
      basis,
      content: detailContent([
        "DTO contract:",
        "",
        "```ts",
        "interface DraftResponseDto {",
        "  flowId: string;",
        "  draftVersion: number;",
        "  graph: DraftGraphDto;",
        "  blockingIssues: BlockingIssueDto[];",
        "}",
        "```",
        "",
        "- Required fields: flowId, draftVersion, graph, blockingIssues.",
        "- Nullable fields: none; optional fields must be added backward-compatibly.",
      ]),
      "no-scope-expansion": "不返回审批状态。",
    },
    {
      "detail-id": `${parentId}-D006`,
      "detail-type": "frontend-contract",
      owner: "console-web",
      subject: "draft editor route",
      basis,
      content: detailContent([
        "Frontend contract:",
        "",
        "| Surface | Component / Route | State | Event | Data Fetching | Error Display |",
        "| --- | --- | --- | --- | --- | --- |",
        "| draft editor | DraftEditorRoute | loading, dirty, saving | save-click | POST draft request | inline error panel |",
        "",
        "- Loading and disabled states keep the save button disabled while saving.",
        "- Validation display focuses the first blocking field path when the response contains blocking issues.",
      ]),
      "no-scope-expansion": "不新增移动端编辑器。",
    },
    {
      "detail-id": `${parentId}-D007`,
      "detail-type": "validation-error-contract",
      owner: "DecisionFlowModule",
      subject: "draft blocking issues",
      basis,
      content: detailContent([
        "Validation error contract:",
        "",
        "| Error Code | Field / Path | Severity / Blocking | Message Key | UI Locator |",
        "| --- | --- | --- | --- | --- |",
        "| DRAFT_GRAPH_INVALID | graph.nodes[0].id | blocking | draft.graph.invalid | issue-panel |",
        "",
        "- Recovery clears the error after callers submit a valid graph payload.",
      ]),
      "no-scope-expansion": "不新增运行期错误码。",
    },
    {
      "detail-id": `${parentId}-D008`,
      "detail-type": "state-lifecycle",
      owner: "console-web",
      subject: "draft editor state",
      basis,
      content: detailContent([
        "State lifecycle:",
        "",
        "| State | Enter Condition | Transition | Persistence / Failure Behavior |",
        "| --- | --- | --- | --- |",
        "| editing | draft response loaded | editing -> saving on save-click | local state remains dirty until success |",
        "| saving | save request started | saving -> editing on response | failure restores editing and preserves form values |",
        "",
        "- Disabled state stops further transitions while saving is in flight.",
      ]),
      "no-scope-expansion": "不新增自动发布状态。",
    },
    {
      "detail-id": `${parentId}-D009`,
      "detail-type": "integration-boundary",
      owner: "DecisionFlowModule",
      subject: "control-api draft persistence adapter",
      basis,
      content: detailContent([
        "Integration boundary:",
        "",
        "- Boundary: DecisionFlowModule calls the persistence repository only through the draft repository adapter.",
        "- Inbound/outbound protocol: control-api request enters the service, repository output returns the saved DTO.",
        "- Failure handling: database timeout returns retryable service error without retrying inside the request.",
      ]),
      "no-scope-expansion": "不调用外部 provider。",
    },
    {
      "detail-id": `${parentId}-D010`,
      "detail-type": "migration-compatibility",
      owner: "DecisionFlowModule",
      subject: "decision_flow_drafts graph column",
      basis,
      content: detailContent([
        "Migration compatibility:",
        "",
        "| Step | Migration / Backfill | Compatibility Strategy | Rollback / Safety Boundary |",
        "| --- | --- | --- | --- |",
        "| add graph column | DDL adds jsonb graph with default empty object | legacy rows read default graph version | rollback leaves old columns readable |",
        "",
        "- Old data handling keeps rows readable before backfill completes.",
      ]),
      "no-scope-expansion": "不迁移执行日志。",
    },
    {
      "detail-id": `${parentId}-D011`,
      "detail-type": "observability-ops",
      owner: "DecisionFlowModule",
      subject: "draft save operations",
      basis,
      content: detailContent([
        "Observability and ops:",
        "",
        "| Signal | Production Owner | Trigger | Action |",
        "| --- | --- | --- | --- |",
        "| metric | DecisionFlowModule | save latency and error count | dashboard lookup |",
        "| log | DecisionFlowModule | validation failure or persistence failure | include flowId and tenant correlation fields |",
        "| alert | DecisionFlowModule | elevated error rate against SLO | runbook action for on-call |",
      ]),
      "no-scope-expansion": "不新增外部 APM provider。",
    },
    {
      "detail-id": `${parentId}-D012`,
      "detail-type": "rollout-compatibility",
      owner: "DecisionFlowModule",
      subject: "draft save rollout gate",
      basis,
      content: detailContent([
        "Rollout compatibility:",
        "",
        "| Gate | Rollout / Flag | Compatibility | Rollback / Monitor |",
        "| --- | --- | --- | --- |",
        "| draft-save | feature flag enables save endpoint | older clients keep read-only response shape | rollback disables writes and monitor tracks 4xx/5xx rates |",
        "",
        "- Disable behavior keeps existing drafts readable after rollback.",
      ]),
      "no-scope-expansion": "不启用发布审批流。",
    },
    {
      "detail-id": `${parentId}-D013`,
      "detail-type": "non-applicable",
      owner: "DecisionFlowModule",
      subject: "async worker",
      basis,
      content: detailContent([
        "Non-applicable reason: async worker is not applicable because this design covers synchronous draft save only.",
        "Rejected expansion: do not add queue processing or scope 外 background execution.",
      ]),
      "no-scope-expansion": "不新增异步 worker。",
    },
  ];
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
