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
    { artifact: "tasks", expected: "## AC-001 Trace task\n\nRuntime Facts:\n\n- RS-001\n" },
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
    if (item.artifact === "tasks") {
      assert.match(result.markdown, /      Work: 实现 trace task。/);
      assert.doesNotMatch(result.markdown, /Depends On:\n\n- None/);
      assert.doesNotMatch(result.markdown, /Outcome:/);
      assert.doesNotMatch(result.markdown, /Preserve:/);
      assert.doesNotMatch(result.markdown, /Proof:/);
      assert.doesNotMatch(result.markdown, /Acceptance:/);
      assert.doesNotMatch(result.markdown, /Resolved Runtime Contract/);
    }
  }
});

test("renderer 从 verification-slice-register 渲染 verification matrix", () => {
  const root = makeRenderChange("render-verification-change");
  const result = renderChangeArtifact({ root, change: "render-verification-change", artifact: "verification" });

  assert.match(result.markdown, /## Proof Slice Matrix/);
  assert.match(result.markdown, /\| PS-001 \| RS-001 \| RS-001 \| authorization \| actor resolution \|/);
  assert.match(result.markdown, /\| PS-001 \| RS-001 \| RS-001 \| authorization \| actor resolution \| 登录态解析到内部 actor。 \| actor 缺失。 \| security\/negative \| apps\/web \| authorization result \| session fixture \| durable-test \| apps\/web\/tests\/security\/\*\* \| N\/A \|/);
  assert.doesNotMatch(result.markdown, /## Planned Test Placement Matrix/);
  assert.match(result.markdown, /Trace file: `trace\/verification.trace.json`/);
});

test("renderer 拒绝 verification 缺少 verification-slice-register", () => {
  const change = "render-verification-missing-register-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "verification.trace.json");
  const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  delete trace["verification-slice-register"];
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);

  assert.throws(
    () => renderChangeArtifact({ root, change, artifact: "verification" }),
    /VAL-RENDER-002.*缺少 verification-slice-register/u,
  );
});

test("renderer 拒绝 verification-slice-register 为空", () => {
  const change = "render-verification-empty-register-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "verification.trace.json");
  const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  trace["verification-slice-register"] = [];
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);

  assert.throws(
    () => renderChangeArtifact({ root, change, artifact: "verification" }),
    /VAL-RENDER-002.*verification-slice-register 不能为空/u,
  );
});

test("renderer 拒绝 verification slice 缺少 planned-test-directory", () => {
  const change = "render-verification-missing-planned-directory-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "verification.trace.json");
  const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  delete trace["verification-slice-register"][0]["planned-test-directory"];
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);

  assert.throws(
    () => renderChangeArtifact({ root, change, artifact: "verification" }),
    /VAL-RENDER-002.*PS-001 缺少 planned-test-directory/u,
  );
});

test("renderer 拒绝 verification slice 缺少 non-persistent-reason", () => {
  const change = "render-verification-missing-non-persistent-reason-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "verification.trace.json");
  const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  delete trace["verification-slice-register"][0]["non-persistent-reason"];
  fs.writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`);

  assert.throws(
    () => renderChangeArtifact({ root, change, artifact: "verification" }),
    /VAL-RENDER-002.*PS-001 缺少 non-persistent-reason/u,
  );
});

test("renderer 拒绝 runtime fact 必填字段缺失", () => {
  const change = "render-runtime-required-field-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "runtime-acceptance.trace.json");
  const runtime = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  delete runtime["runtime-fact-register"][0]["default-path-policy"];
  fs.writeFileSync(tracePath, `${JSON.stringify(runtime, null, 2)}\n`);

  assert.throws(
    () => renderChangeArtifact({ root, change, artifact: "runtime-acceptance" }),
    /VAL-RENDER-002.*RS-001 缺少 default-path-policy/u,
  );
});

test("renderer 拒绝 runtime fact 未进入 section", () => {
  const change = "render-runtime-fact-section-gap-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "runtime-acceptance.trace.json");
  const runtime = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  runtime["delivery-plane"]["fact-sections"]["surface-facts"] = [];
  fs.writeFileSync(tracePath, `${JSON.stringify(runtime, null, 2)}\n`);

  assert.throws(
    () => renderChangeArtifact({ root, change, artifact: "runtime-acceptance" }),
    /VAL-RENDER-002.*未入 index：RS-001/u,
  );
});

test("renderer 拒绝 runtime fact 类型放错 section 分组", () => {
  const change = "render-runtime-fact-type-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "runtime-acceptance.trace.json");
  const runtime = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  runtime["delivery-plane"]["fact-sections"]["surface-facts"] = [];
  runtime["delivery-plane"]["fact-sections"]["operation-facts"] = ["RS-001"];
  fs.writeFileSync(tracePath, `${JSON.stringify(runtime, null, 2)}\n`);

  assert.throws(
    () => renderChangeArtifact({ root, change, artifact: "runtime-acceptance" }),
    /VAL-RENDER-002.*RS-001 不属于 operation-facts/u,
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

test("renderer 从 implementation-design-register 渲染 design decision", () => {
  const change = "render-readable-design-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "design.trace.json");
  const design = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  design["delivery-plane"].decisions[0].title = "delivery title 不应渲染";
  design["delivery-plane"].decisions[0].decision = "delivery decision 不应渲染";
  design["delivery-plane"].decisions[0]["source-gap"] = "delivery source gap 不应渲染";
  design["delivery-plane"].decisions[0]["minimal-shape"] = "delivery minimal shape 不应渲染";
  design["delivery-plane"].decisions[0]["rejected-expansion"] = "delivery rejected expansion 不应渲染";
  design["implementation-design-register"][0].decision = [
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
  assert.doesNotMatch(result.markdown, /delivery decision 不应渲染/);
  assert.doesNotMatch(result.markdown, /Source Gap/);
  assert.doesNotMatch(result.markdown, /Minimal Shape/);
  assert.doesNotMatch(result.markdown, /Rejected Expansion/);
});

test("renderer 忽略 design 旧 frontend section payload", () => {
  const change = "render-default-design-frontend-alias-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "design.trace.json");
  const design = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  design["schema-name"] = "production-default-acceptance-driven";
  design["delivery-plane"]["frontend-ux-design"] = ["- default frontend UX 来自 alias。"];
  delete design["delivery-plane"]["frontend-ux-prototype-fidelity-design"];
  fs.writeFileSync(tracePath, `${JSON.stringify(design, null, 2)}\n`);

  const result = renderChangeArtifact({ root, change, artifact: "design" });

  assert.match(result.markdown, /## Implementation Details/);
  assert.doesNotMatch(result.markdown, /## Frontend \/ UX/);
  assert.doesNotMatch(result.markdown, /default frontend UX 来自 alias/);
});

test("renderer 按 detail-render-order 分组渲染 design implementation details", () => {
  const change = "render-design-details-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "design.trace.json");
  const design = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  design["implementation-design-register"][0]["implementation-details"].push({
    "detail-id": "IDR-001-D002",
    "detail-type": "api-contract",
    owner: "DecisionFlowModule",
    subject: "Readiness API",
    basis: {
      "inherits-parent-spec-anchors": true,
      "spec-anchors": [],
      "design-inputs": [],
    },
    content: "- control-api 暴露只读 readiness endpoint，并返回可展示状态。",
    "no-scope-expansion": "不新增写入 API。",
  });
  fs.writeFileSync(tracePath, `${JSON.stringify(design, null, 2)}\n`);

  const result = renderChangeArtifact({ root, change, artifact: "design" });

  assert.match(result.markdown, /## Implementation Details/);
  assert.match(result.markdown, /### module-boundary/);
  assert.match(result.markdown, /- renderer 从 IDR 子项渲染 implementation detail。/);
  assert.match(result.markdown, /### api-contract/);
  assert.match(result.markdown, /- control-api 暴露只读 readiness endpoint，并返回可展示状态。/);
  assert.doesNotMatch(result.markdown, /#### IDR-001-D001/);
  assert.doesNotMatch(result.markdown, /#### IDR-001-D002/);
  assert.doesNotMatch(result.markdown, /- Parent IDR: IDR-001/);
  assert.doesNotMatch(result.markdown, /- Detail Type: module-boundary/);
  assert.doesNotMatch(result.markdown, /- Owner: renderer-test/);
  assert.doesNotMatch(result.markdown, /- Subject: design renderer detail/);
  assert.doesNotMatch(result.markdown, /No Scope Expansion:/);
  assert.doesNotMatch(result.markdown, /inherits-parent-spec-anchors/);
  assert.doesNotMatch(result.markdown, /## Architecture \/ Module Boundary Design/);
  assert.match(result.markdown, /## Implementation Details[\s\S]*## Trace Appendix/);
});

test("renderer 拒绝 design detail content 数组", () => {
  const change = "render-design-detail-content-array-change";
  const root = makeRenderChange(change);
  const tracePath = path.join(root, "openspec", "changes", change, "trace", "design.trace.json");
  const design = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  design["implementation-design-register"][0]["implementation-details"][0].content = [
    "- 错误地把 content 写成数组。",
  ];
  fs.writeFileSync(tracePath, `${JSON.stringify(design, null, 2)}\n`);

  assert.throws(
    () => renderChangeArtifact({ root, change, artifact: "design" }),
    /design\.IDR-001-D001\.content 必须是非空字符串 render payload/u,
  );
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
  assert.equal(manifest["trace-contract-version"], "verification-slice-register-v2");
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
    "verification-slice-register": verificationSliceRegister(),
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
        scope: "verification 来自 trace。",
        "runtime-source": "trace/runtime-acceptance.trace.json#/runtime-fact-register",
        "out-of-scope": "None。",
      },
    },
  };
  writeTrace(traceDir, "verification.trace.json", verification);
  writeTrace(traceDir, "manifest.json", {
    "trace-schema": "openspec-trace-v1",
    "trace-contract-version": "verification-slice-register-v2",
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
    "spec-delta-register": [],
    "spec-gate": {
      blockers: [],
      "orphan-source-ids": [],
      "source-set-mismatch": [],
      "existing-spec-state-violations": [],
      "delivery-projection-mismatch": [],
    },
    "implementation-design-register": [],
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
    "runtime-fact-register": [],
    "runtime-gate": {
      blockers: [],
      "uncovered-spec-scenarios": [],
      "uncovered-runtime-design-decisions": [],
      "orphan-runtime-facts": [],
      "invalid-source-refs": [],
      "delivery-projection-mismatch": [],
    },
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
  return value;
}

function designTrace() {
  const value = trace("design", "design.md", {
    context: ["- design 来自 trace。"],
    "goals-non-goals": ["- goal 来自 trace。"],
    decisions: [
      {
        "decision-id": "IDR-001",
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
  });
  value["implementation-design-register"] = [
    {
      "implementation-design-id": "IDR-001",
      layer: "architecture-module-boundary",
      title: "Trace design",
      "spec-anchors": [],
      "design-inputs": [],
      decision: "从 trace 渲染 design。",
      "implementation-boundary": "renderer-test",
      "implementation-contract": "渲染 design delivery payload。",
      "guard-failure-handling": "N/A",
      "verification-handoff": "N/A",
      "no-scope-expansion": "不推导新需求。",
      blocker: "无",
      "implementation-details": [
        {
          "detail-id": "IDR-001-D001",
          "detail-type": "module-boundary",
          owner: "renderer-test",
          subject: "design renderer detail",
          basis: {
            "inherits-parent-spec-anchors": true,
            "spec-anchors": [],
            "design-inputs": [],
          },
          content: "- renderer 从 IDR 子项渲染 implementation detail。",
          "no-scope-expansion": "不推导新需求。",
        },
      ],
    },
  ];
  return value;
}

function runtimeTrace() {
  const runtime = trace("runtime-acceptance", "runtime-acceptance.md", {
    "runtime-acceptance-intent": {
      scope: "runtime 来自 trace。",
      "source-basis": "spec/design trace。",
      "out-of-scope": "None。",
    },
    "fact-sections": {
      "surface-facts": ["RS-001"],
      "operation-facts": [],
      "state-facts": [],
      "chain-facts": [],
    },
  });
  runtime["runtime-fact-register"] = [
    {
      "runtime-fact-id": "RS-001",
      "fact-type": "surface",
      "scope-role": "required behavior",
      "source-basis": {
        "spec-scenarios": ["trace/specs/capability.trace.json#/spec-delta-register/0/scenarios/0"],
        "design-decisions": ["IDR-001"],
      },
      "owner-candidate": "apps/web",
      "runtime-fact": "登录态解析。",
      "observable-fact": "auth fact",
      "default-path-policy": "real path",
      "external-boundary": "none",
      "no-scope-expansion-check": "no expansion",
    },
  ];
  return runtime;
}

function tasksTrace() {
  const value = trace("tasks", "tasks.md", {
    "step-sections": ["AC-001"],
  });
  value["implementation-step-register"] = [
    {
      "step-id": "AC-001",
      title: "Trace task",
      "depends-on-step-ids": [],
      "runtime-fact-ids": ["RS-001"],
      tasks: [
        {
          "task-id": "AC-001.1",
          title: "实现 trace task",
          "runtime-fact-ids": ["RS-001"],
          work: "实现 trace task。",
        },
      ],
    },
  ];
  value["task-gate"] = {
    blockers: [],
    "uncovered-target-runtime-facts": [],
    "invalid-runtime-fact-refs": [],
    "dependency-order-violations": [],
    "non-production-task-violations": [],
    "delivery-projection-mismatch": [],
  };
  return value;
}

function verificationSliceRegister() {
  return [
    {
      "slice-id": "PS-001",
      "runtime-fact-ids": ["RS-001"],
      "primary-runtime-fact-id": "RS-001",
      "proof-type": "authorization",
      branch: "actor resolution",
      oracle: "登录态解析到内部 actor。",
      "failure-signal": "actor 缺失。",
      "test-layer": "security/negative",
      "production-owner": "apps/web",
      "assertion-shape": "authorization result",
      "fixture-boundary": "session fixture",
      "proof-evidence-mode": "durable-test",
      "planned-test-directory": "apps/web/tests/security/**",
      "non-persistent-reason": "N/A",
    },
  ];
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
