import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  NO_DELTA_SPECS_ARTIFACT_PATH,
  NO_DELTA_SPECS_COMPLETION_MODE,
  RENDER_CONTRACT_VERSION,
  renderChangeArtifact,
} from "./render-production-artifacts.mjs";

test("renderer 从 trace fixture 渲染 proposal/spec/design/runtime/tasks", () => {
  const root = makeRenderChange("render-all-change");
  const cases = [
    { artifact: "proposal", expected: "## Why\n\n- proposal 来自 trace。\n" },
    { artifact: "specs", capability: "capability", expected: "## ADDED Requirements\n\n### Requirement: Trace spec\n" },
    { artifact: "design", expected: "## Context\n\n- design 来自 trace。\n" },
    { artifact: "runtime-acceptance", expected: "## Runtime Acceptance Intent\n\n- Scope: runtime 来自 trace。\n" },
    { artifact: "tasks", expected: "## AC-001 Trace task\n\nOutcome:\n\n- tasks 来自 trace。\n" },
  ];

  for (const item of cases) {
    const result = renderChangeArtifact({ root, change: "render-all-change", ...item });
    assert.ok(result.markdown.startsWith(item.expected), `${item.artifact} should render from trace payload`);
    assert.match(result.markdown, /## Trace Appendix\n\nTrace file: `trace\//);
    if (item.artifact === "proposal") {
      assert.match(result.markdown, /## Change Plan Boundary\n\n- boundary 来自 trace。/);
      assert.match(result.markdown, /## Impact\n\n- 无/);
      assert.match(result.markdown, /## Rollout \/ Readiness\n\n- 无/);
    }
  }
});

test("renderer 从 inline proof-slice-model 渲染 verification matrix", () => {
  const root = makeRenderChange("render-verification-change");
  const result = renderChangeArtifact({ root, change: "render-verification-change", artifact: "verification" });

  assert.match(result.markdown, /## Proof Slice Matrix/);
  assert.match(result.markdown, /\| PS-001 \| RS-001 \| RS-001 \| authorization \| actor resolution \|/);
  assert.match(result.markdown, /## Planned Test Placement Matrix/);
  assert.match(result.markdown, /\| PS-001 \| true \| durable-test \| apps\/web\/tests\/security\/\*\* \| existing-tests-directory \|/);
  assert.match(result.markdown, /Trace file: `trace\/verification.trace.json`/);
});

test("renderer 兼容 legacy proof-slices sidecar 渲染 verification matrix", () => {
  const change = "render-verification-legacy-sidecar-change";
  const root = makeRenderChange(change, { legacyProofSlices: true });
  const result = renderChangeArtifact({ root, change, artifact: "verification" });

  assert.match(result.markdown, /## Proof Slice Matrix/);
  assert.match(result.markdown, /\| PS-001 \| RS-001 \| RS-001 \| authorization \| actor resolution \|/);
  assert.match(result.markdown, /Trace file: `trace\/verification.trace.json`/);
});

test("renderer 拒绝 verification 缺少 inline proof-slice-model", () => {
  const change = "render-verification-missing-inline-model-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "verification.trace.json");
  const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  delete trace["proof-slice-model"];
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);

  assert.throws(
    () => renderChangeArtifact({ root, change, artifact: "verification" }),
    /VAL-RENDER-002.*缺少 proof-slice-model/u,
  );
});

test("renderer 拒绝 verification proof-slice-model schema 错误", () => {
  const change = "render-verification-bad-inline-schema-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "verification.trace.json");
  const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  trace["proof-slice-model"]["model-schema"] = "openspec-trace-v1";
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);

  assert.throws(
    () => renderChangeArtifact({ root, change, artifact: "verification" }),
    /VAL-RENDER-002.*openspec-proof-slices-v1/u,
  );
});

test("renderer 拒绝 verification proof-slice-model 为空", () => {
  const change = "render-verification-empty-inline-model-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "verification.trace.json");
  const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  trace["proof-slice-model"]["proof-slices"] = [];
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);

  assert.throws(
    () => renderChangeArtifact({ root, change, artifact: "verification" }),
    /VAL-RENDER-002.*proof-slices 不能为空/u,
  );
});

test("renderer 拒绝 verification proof slice 缺少 placement", () => {
  const change = "render-verification-missing-placement-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "verification.trace.json");
  const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  delete trace["proof-slice-model"]["proof-slices"][0]["test-contract"].placement;
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);

  assert.throws(
    () => renderChangeArtifact({ root, change, artifact: "verification" }),
    /VAL-RENDER-002.*PS-001 缺少 test-contract\.placement/u,
  );
});

test("renderer 拒绝 verification proof slice placement 字段缺失", () => {
  const change = "render-verification-missing-placement-field-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "verification.trace.json");
  const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  delete trace["proof-slice-model"]["proof-slices"][0]["test-contract"].placement["placement-reason"];
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);

  assert.throws(
    () => renderChangeArtifact({ root, change, artifact: "verification" }),
    /VAL-RENDER-002.*placement 缺少 placement-reason/u,
  );
});

test("renderer 拒绝 runtime canonical row 必填字段缺失", () => {
  const change = "render-runtime-required-field-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "runtime-acceptance.trace.json");
  const runtime = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  delete runtime["delivery-plane"]["canonical-rows"][0]["default-path-policy"];
  fs.writeFileSync(tracePath, `${JSON.stringify(runtime, null, 2)}\n`);

  assert.throws(
    () => renderChangeArtifact({ root, change, artifact: "runtime-acceptance" }),
    /VAL-RENDER-002.*RS-001 缺少 default-path-policy/u,
  );
});

test("renderer 拒绝 runtime canonical row 未进入 index", () => {
  const change = "render-runtime-row-index-gap-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "runtime-acceptance.trace.json");
  const runtime = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  runtime["canonical-row-index"]["surface-rows"] = [];
  fs.writeFileSync(tracePath, `${JSON.stringify(runtime, null, 2)}\n`);

  assert.throws(
    () => renderChangeArtifact({ root, change, artifact: "runtime-acceptance" }),
    /VAL-RENDER-002.*未入 index：RS-001/u,
  );
});

test("renderer 拒绝 runtime row 类型放错 index 分组", () => {
  const change = "render-runtime-row-type-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "runtime-acceptance.trace.json");
  const runtime = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  runtime["canonical-row-index"]["surface-rows"] = [];
  runtime["canonical-row-index"]["operation-rows"] = ["RS-001"];
  fs.writeFileSync(tracePath, `${JSON.stringify(runtime, null, 2)}\n`);

  assert.throws(
    () => renderChangeArtifact({ root, change, artifact: "runtime-acceptance" }),
    /VAL-RENDER-002.*RS-001 不属于 operation-rows/u,
  );
});

test("renderer 保留 proposal what-changes 数组换行", () => {
  const change = "render-readable-proposal-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "proposal.trace.json");
  const proposal = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  proposal["delivery-plane"]["what-changes"] = [
    "- 建立仓库和运行时骨架：根 workspace 使用 pnpm monorepo 管理 TypeScript 包。",
    "- `apps/console-web` 提供 React、Vite、React Router 与 Ant Design 基础控制台壳。",
    "- `apps/control-api` 提供 NestJS 模块化单体边界和基础健康面。",
    "- 生产部署形状保留 Kubernetes 多副本和托管依赖的云中立配置。",
  ];
  fs.writeFileSync(tracePath, `${JSON.stringify(proposal, null, 2)}\n`);

  const result = renderChangeArtifact({ root, change, artifact: "proposal" });

  assert.match(result.markdown, /## What Changes\n\n- 建立仓库和运行时骨架/);
  assert.match(result.markdown, /\n- `apps\/console-web` 提供 React/);
  assert.match(result.markdown, /\n- `apps\/control-api` 提供 NestJS/);
  assert.match(result.markdown, /\n- 生产部署形状保留 Kubernetes/);
  assert.match(result.markdown, /### Modified Capabilities\n\n- 无\n\n## Non-Goals/);
});

test("renderer 不猜测拆分分号字符串", () => {
  const change = "render-literal-string-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "proposal.trace.json");
  const proposal = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  proposal["delivery-plane"]["what-changes"] =
    "保留原始字符串：第一项；第二项；第三项。";
  fs.writeFileSync(tracePath, `${JSON.stringify(proposal, null, 2)}\n`);

  const result = renderChangeArtifact({ root, change, artifact: "proposal" });

  assert.match(result.markdown, /## What Changes\n\n保留原始字符串：第一项；第二项；第三项。\n\n## Capabilities/);
  assert.doesNotMatch(result.markdown, /## What Changes\n\n- 保留原始字符串/);
});

test("renderer 保留 specs requirement body 数组换行", () => {
  const change = "render-readable-specs-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "specs", "capability.trace.json");
  const specs = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  specs["delivery-plane"]["added-requirements"][0].body = [
    "系统 SHALL 从 trace 渲染 requirement 正文。",
    "正文数组 MUST 保留 Markdown 换行，不得被 JavaScript 隐式逗号拼接。",
  ];
  fs.writeFileSync(tracePath, `${JSON.stringify(specs, null, 2)}\n`);

  const result = renderChangeArtifact({ root, change, artifact: "specs", capability: "capability" });

  assert.match(result.markdown, /系统 SHALL 从 trace 渲染 requirement 正文。\n正文数组 MUST 保留 Markdown 换行/);
  assert.doesNotMatch(result.markdown, /正文。,正文数组/);
});

test("renderer 支持 specs modified-only delta", () => {
  const change = "render-modified-only-specs-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "specs", "capability.trace.json");
  const specs = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  specs["delivery-plane"] = {
    "modified-requirements": [
      {
        name: "Trace spec",
        body: "系统 SHALL 渲染 modified requirement。",
        scenarios: [
          {
            name: "Render modified spec",
            when: "renderer 读取 modified specs trace",
            then: "系统 MUST 输出 modified spec Markdown。",
          },
        ],
      },
    ],
  };
  fs.writeFileSync(tracePath, `${JSON.stringify(specs, null, 2)}\n`);

  const result = renderChangeArtifact({ root, change, artifact: "specs", capability: "capability" });

  assert.match(result.markdown, /^## MODIFIED Requirements\n\n### Requirement: Trace spec/mu);
  assert.doesNotMatch(result.markdown, /## ADDED Requirements/);
});

test("renderer 支持 specs removed 和 renamed delta", () => {
  const change = "render-removed-renamed-specs-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "specs", "capability.trace.json");
  const specs = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  specs["delivery-plane"] = {
    "removed-requirements": [
      {
        name: "Old requirement",
        reason: "旧 requirement 已被 source-backed scope 移除。",
        migration: "迁移到新的 capability 边界。",
      },
    ],
    "renamed-requirements": [
      {
        from: "Old name",
        to: "New name",
      },
    ],
  };
  fs.writeFileSync(tracePath, `${JSON.stringify(specs, null, 2)}\n`);

  const result = renderChangeArtifact({ root, change, artifact: "specs", capability: "capability" });

  assert.match(result.markdown, /## REMOVED Requirements\n\n### Requirement: Old requirement\n\nReason:/);
  assert.match(result.markdown, /Migration:\n\n迁移到新的 capability 边界。/);
  assert.match(result.markdown, /## RENAMED Requirements\n\n### Requirement Rename\n\nFROM: Old name\nTO: New name/);
});

test("renderer 拒绝空 normal specs delta", () => {
  const change = "render-empty-specs-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "specs", "capability.trace.json");
  const specs = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  specs["delivery-plane"] = {
    "added-requirements": [],
    "modified-requirements": [],
    "removed-requirements": [],
    "renamed-requirements": [],
  };
  fs.writeFileSync(tracePath, `${JSON.stringify(specs, null, 2)}\n`);

  assert.throws(
    () => renderChangeArtifact({ root, change, artifact: "specs", capability: "capability" }),
    /VAL-RENDER-002/,
  );
});

test("renderer 将 design decision 数组字段渲染为块级可读内容", () => {
  const change = "render-readable-design-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "design.trace.json");
  const design = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  design["delivery-plane"].decisions[0].decision = [
    "- 采用一个最小生产边界：前端只读 foundation 状态。",
    "- 后端只暴露 health/readiness。",
    "- worker 只启动独立进程。",
    "- executor 只保留 adapter seam。",
  ];
  fs.writeFileSync(tracePath, `${JSON.stringify(design, null, 2)}\n`);

  const result = renderChangeArtifact({ root, change, artifact: "design" });

  assert.match(result.markdown, /Decision:\n\n- 采用一个最小生产边界/);
  assert.match(result.markdown, /\n- 后端只暴露 health\/readiness/);
  assert.match(result.markdown, /\n- executor 只保留 adapter seam。/);
});

test("renderer 兼容 default profile frontend-ux-design key", () => {
  const change = "render-default-design-frontend-alias-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "design.trace.json");
  const design = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  design["schema-name"] = "production-default-acceptance-driven";
  design["delivery-plane"]["frontend-ux-design"] = ["- default frontend UX 来自 alias。"];
  delete design["delivery-plane"]["frontend-ux-prototype-fidelity-design"];
  fs.writeFileSync(tracePath, `${JSON.stringify(design, null, 2)}\n`);

  const result = renderChangeArtifact({ root, change, artifact: "design" });

  assert.match(result.markdown, /## Frontend \/ UX \/ Prototype Fidelity Design\n\n- default frontend UX 来自 alias。/);
});

test("renderer --write 更新 artifact 和 manifest registry 且重复运行稳定", () => {
  const root = makeRenderChange("render-write-change");
  const artifactPath = path.join(root, "openspec", "changes", "render-write-change", "verification.md");
  const manifestPath = path.join(root, "openspec", "changes", "render-write-change", "trace", "manifest.json");
  fs.rmSync(manifestPath);

  const first = renderChangeArtifact({ root, change: "render-write-change", artifact: "verification", write: true });
  const firstManifest = fs.readFileSync(manifestPath, "utf8");

  const second = renderChangeArtifact({ root, change: "render-write-change", artifact: "verification", write: true });
  const secondManifest = fs.readFileSync(manifestPath, "utf8");

  assert.equal(first.markdown, second.markdown);
  assert.equal(fs.readFileSync(artifactPath, "utf8"), first.markdown);
  assert.equal(firstManifest, secondManifest);

  const manifest = JSON.parse(secondManifest);
  assert.equal(manifest["trace-contract-version"], "verification-inline-proof-slices-v1");
  assert.equal(manifest["render-contract-version"], RENDER_CONTRACT_VERSION);
  assertManifestEntry(manifest, "trace/verification.trace.json");
  assertNoManifestEntry(manifest, "trace/verification.proof-slices.json");
});

test("renderer --no-delta-specs --write 生成 no-delta marker 与 manifest entry", () => {
  const change = "render-no-delta-specs-change";
  const root = makeRenderChange(change);
  const changeDir = path.join(root, "openspec", "changes", change);
  const traceDir = path.join(changeDir, "trace");
  writeTrace(traceDir, "specs/no-spec-delta/README.trace.json", noDeltaSpecsTrace());

  const result = renderChangeArtifact({ root, change, artifact: "specs", noDeltaSpecs: true, write: true });

  assert.equal(result.artifactPath, NO_DELTA_SPECS_ARTIFACT_PATH);
  assert.equal(result.tracePath, "trace/specs/no-spec-delta/README.trace.json");
  const markdown = fs.readFileSync(path.join(changeDir, NO_DELTA_SPECS_ARTIFACT_PATH), "utf8");
  assert.match(markdown, /## No Spec Delta\n\n- 本 change 无 OpenSpec delta spec。/);
  assert.match(markdown, /## Projection Closure\n\n- projection closure 进入 design\/runtime-acceptance\/verification\/tasks。/);
  assert.doesNotMatch(markdown, /## (?:ADDED|MODIFIED|REMOVED|RENAMED) Requirements/);
  assert.doesNotMatch(markdown, /#{3,4} (?:Requirement|Scenario):/);

  const manifest = JSON.parse(fs.readFileSync(path.join(changeDir, "trace", "manifest.json"), "utf8"));
  const entry = manifest.artifacts.find((artifact) => artifact["artifact-path"] === NO_DELTA_SPECS_ARTIFACT_PATH);
  assert.ok(entry);
  assert.equal(entry["artifact-id"], "specs");
  assert.equal(entry["trace-path"], "trace/specs/no-spec-delta/README.trace.json");
  assertManifestEntry(manifest, "trace/specs/no-spec-delta/README.trace.json");
});

test("renderer --write 非 verification artifact 保留 legacy sidecar manifest", () => {
  const change = "render-legacy-sidecar-preserve-change";
  const root = makeRenderChange(change, { legacyProofSlices: true });
  const changeDir = path.join(root, "openspec", "changes", change);

  renderChangeArtifact({ root, change, artifact: "proposal", write: true });

  const manifest = JSON.parse(fs.readFileSync(path.join(changeDir, "trace", "manifest.json"), "utf8"));
  assert.equal(manifest["trace-contract-version"], "proof-slices-v1");
  assertManifestEntry(manifest, "trace/proposal.trace.json");
  assertManifestEntry(manifest, "trace/verification.proof-slices.json");
});

function makeRenderChange(change, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "openspec-renderer-"));
  const changeDir = path.join(root, "openspec", "changes", change);
  const traceDir = path.join(changeDir, "trace");
  fs.mkdirSync(path.join(traceDir, "specs"), { recursive: true });
  fs.writeFileSync(path.join(changeDir, ".openspec.yaml"), "schema: production-obligation-atom-driven\n");

  writeTrace(traceDir, "proposal.trace.json", proposalTrace());
  writeTrace(traceDir, "specs/capability.trace.json", specsTrace());
  writeTrace(traceDir, "design.trace.json", designTrace());
  writeTrace(traceDir, "runtime-acceptance.trace.json", runtimeTrace());
  writeTrace(traceDir, "tasks.trace.json", tasksTrace());
  const verification = {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "verification",
    "artifact-path": "verification.md",
    "runtime-row-branch-inventory": [
      {
        "branch-id": "VRB-001",
        "runtime-row-id": "RS-001",
        "runtime-row-type": "surface",
        "scope-role": "required behavior",
        "branch-source-field": "runtime-obligation",
        "branch-variant": "actor resolution",
        "handling": "proof-slice",
        "expected-proof-slice-ids": ["PS-001"],
        "handling-reason": "PS-001 覆盖 actor resolution 分支。",
      },
    ],
    "manual-not-applicable-inventory": [],
    "delivery-plane": {
      "verification-intent": {
        scope: "verification 来自 trace。",
        "runtime-source": "runtime-acceptance.md canonical rows。",
        "out-of-scope": "None。",
      },
      "layer-harness-fixture-notes": [],
      "do-not-test": [],
    },
    "runtime-coverage-reconciliation": [],
    "slice-consistency-checklist": [],
  };
  if (!options.legacyProofSlices) {
    verification["proof-slice-model"] = proofSliceModel();
  }
  writeTrace(traceDir, "verification.trace.json", verification);
  if (options.legacyProofSlices) {
    writeTrace(traceDir, "verification.proof-slices.json", proofSlicesTrace());
  }
  writeTrace(traceDir, "manifest.json", {
    "trace-schema": "openspec-trace-v1",
    "trace-contract-version": options.legacyProofSlices ? "proof-slices-v1" : "verification-inline-proof-slices-v1",
    "render-contract-version": "trace-render-v1",
    change,
    "schema-name": "production-obligation-atom-driven",
    artifacts: [],
  });
  return root;
}

function trace(artifactId, artifactPath, delivery) {
  return {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": artifactId,
    "artifact-path": artifactPath,
    "delivery-plane": delivery,
    "proposal-alignment-gate": {},
    "requirement-source-trace": [],
    "production-alignment-gate": {},
    "production-source-map": [],
    "design-obligation-matrix": [],
    "canonical-row-index": { "surface-rows": [], "operation-rows": [], "state-rows": [], "chain-rows": [] },
    "runtime-upstream-coverage-map": [],
    "runtime-coverage-source-map": [],
    "coverage-closure-checklist": [],
    "acceptance-driven-coverage": {},
    "runtime-acceptance-index": {},
    "runtime-acceptance-projection": {},
  };
}

function proposalTrace() {
  return trace("proposal", "proposal.md", {
    why: ["- proposal 来自 trace。"],
    "change-plan-boundary": ["- boundary 来自 trace。"],
    "what-changes": ["- what changes 来自 trace。"],
    capabilities: {
      "new-capabilities": [{ name: "capability", summary: "新增 capability。" }],
      "modified-capabilities": [],
    },
    "non-goals": ["- 无"],
    impact: ["- 无"],
    "rollout-readiness": ["- 无"],
  });
}

function specsTrace() {
  return trace("specs", "specs/capability/spec.md", {
    "added-requirements": [
      {
        name: "Trace spec",
        body: "系统 SHALL 从 trace 渲染 spec。",
        scenarios: [
          {
            name: "Render spec",
            when: "renderer 读取 specs trace",
            then: "系统 MUST 输出 spec Markdown。",
          },
        ],
      },
    ],
  });
}

function noDeltaSpecsTrace() {
  const value = trace("specs", NO_DELTA_SPECS_ARTIFACT_PATH, {
    "completion-mode": NO_DELTA_SPECS_COMPLETION_MODE,
    summary: ["- 本 change 无 OpenSpec delta spec。"],
    "projection-closure": ["- projection closure 进入 design/runtime-acceptance/verification/tasks。"],
  });
  value["schema-name"] = "production-obligation-atom-driven";
  value["specs-completion-mode"] = NO_DELTA_SPECS_COMPLETION_MODE;
  value["production-alignment-gate"] = { blockers: [] };
  return value;
}

function designTrace() {
  return trace("design", "design.md", {
    context: ["- design 来自 trace。"],
    "goals-non-goals": ["- goal 来自 trace。"],
    decisions: [
      {
        "decision-id": "D-001",
        title: "Trace design",
        decision: "从 trace 渲染 design。",
        "source-gap": "无。",
        "minimal-shape": "结构化 delivery payload。",
        "rejected-expansion": "不推导新需求。",
      },
    ],
    "architecture-module-boundary-design": ["- 无"],
    "domain-data-migration-design": ["- 无"],
    "api-auth-security-design": ["- 无"],
    "async-realtime-ai-worker-design": ["- 无"],
    "frontend-ux-prototype-fidelity-design": ["- 无"],
    "observability-ops-deployment-design": ["- 无"],
    "verification-design": ["- 无"],
    "rollout-compatibility": ["- 无"],
    "risks-trade-offs": ["- 无"],
    "open-questions": ["无"],
  });
}

function runtimeTrace() {
  const runtime = trace("runtime-acceptance", "runtime-acceptance.md", {
    "runtime-acceptance-intent": {
      scope: "runtime 来自 trace。",
      "source-basis": "proposal/spec/design trace。",
      "out-of-scope": "None。",
    },
    "canonical-rows": [
      {
        "surface-id": "RS-001",
        "surface-type": "auth surface",
        "owner-candidate": "apps/web",
        "entry-point": "route",
        "runtime-obligation": "登录态解析。",
        "observable-fact": "auth fact",
        "default-path-policy": "real path",
        "external-boundary": "none",
        "source-basis": "GA-0001、D-001",
        "projection-type": "spec-requirement / design",
        "scope-role": "required behavior",
        "no-scope-expansion-check": "no expansion",
      },
    ],
  });
  runtime["canonical-row-index"]["surface-rows"] = ["RS-001"];
  return runtime;
}

function tasksTrace() {
  return trace("tasks", "tasks.md", {
    "acceptance-slices": [
      {
        "ac-id": "AC-001",
        title: "Trace task",
        outcome: ["- tasks 来自 trace。"],
        "start-gate": ["- None"],
        "runtime-rows": ["RS-001"],
        "resolved-runtime-contract": [
          {
            row: "RS-001",
            "worker-facing-obligation": "生产义务。",
            "observable-proof": "可观察 proof。",
            "default-no-scope-boundary": "默认边界。",
          },
        ],
        "implementation-scope": ["- 实现 trace task。"],
        preserve: ["- 不扩展。"],
        "proof-contract": ["- 可观察。"],
        tasks: [
          {
            "task-id": "AC-001.1",
            title: "实现 trace task",
            "runtime-rows": ["RS-001"],
            acceptance: "可观察。",
            preserve: "不扩展。",
            proof: "可观察。",
            "mock-default-path-policy": "默认真实路径。",
          },
        ],
      },
    ],
  });
}

function proofSlicesTrace() {
  return {
    "trace-schema": "openspec-proof-slices-v1",
    "artifact-id": "verification",
    "artifact-path": "verification.md",
    "source-interface": {},
    "proof-slice-summary": { "proof-slice-count": 1 },
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
        "persistent-test-required": true,
        "proof-evidence-mode": "durable-test",
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
          placement: {
            "planned-test-directory": "apps/web/tests/security/**",
            "placement-basis": "existing-tests-directory",
            "placement-reason": "security proof 使用 apps/web security tests。",
          },
        },
      },
    ],
  };
}

function proofSliceModel() {
  const { "trace-schema": _traceSchema, "artifact-id": _artifactId, "artifact-path": _artifactPath, ...model } = proofSlicesTrace();
  return {
    "model-schema": "openspec-proof-slices-v1",
    "proof-slice-summary": model["proof-slice-summary"],
    "proof-slices": model["proof-slices"],
  };
}

function writeTrace(traceDir, relPath, value) {
  const fullPath = path.join(traceDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`);
}

function assertManifestEntry(manifest, tracePath) {
  const entry = manifest.artifacts.find((artifact) => artifact["trace-path"] === tracePath);
  assert.ok(entry, `missing manifest entry for ${tracePath}`);
  assert.equal(entry["trace-digest"], undefined);
}

function assertNoManifestEntry(manifest, tracePath) {
  const entry = manifest.artifacts.find((artifact) => artifact["trace-path"] === tracePath);
  assert.equal(entry, undefined, `unexpected manifest entry for ${tracePath}`);
}
