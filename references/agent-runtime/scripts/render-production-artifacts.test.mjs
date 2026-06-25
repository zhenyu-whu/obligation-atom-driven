import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { RENDER_CONTRACT_VERSION, renderChangeArtifact } from "./render-production-artifacts.mjs";

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
  }
});

test("renderer 从 proof-slices sidecar 渲染 verification matrix", () => {
  const root = makeRenderChange("render-verification-change");
  const result = renderChangeArtifact({ root, change: "render-verification-change", artifact: "verification" });

  assert.match(result.markdown, /## Proof Slice Matrix/);
  assert.match(result.markdown, /\| PS-001 \| RS-001 \| RS-001 \| authorization \| actor resolution \|/);
  assert.match(result.markdown, /Trace file: `trace\/verification.trace.json`/);
});

test("renderer --write 更新 artifact 和 manifest digest 且重复运行稳定", () => {
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
  assert.equal(manifest["trace-contract-version"], "proof-slices-v1");
  assert.equal(manifest["render-contract-version"], RENDER_CONTRACT_VERSION);
  assertManifestDigest(manifest, "trace/verification.trace.json", root);
  assertManifestDigest(manifest, "trace/verification.proof-slices.json", root);
});

function makeRenderChange(change) {
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
  writeTrace(traceDir, "verification.trace.json", {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "verification",
    "artifact-path": "verification.md",
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
  });
  writeTrace(traceDir, "verification.proof-slices.json", proofSlicesTrace());
  writeTrace(traceDir, "manifest.json", {
    "trace-schema": "openspec-trace-v1",
    "trace-contract-version": "proof-slices-v1",
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
        "primary-assertion-shape": "authorization result",
        "fixture-mock-boundary": "session fixture",
        "regression-intent": "high",
        "manual-environment-gate": "None",
      },
    ],
  };
}

function writeTrace(traceDir, relPath, value) {
  const fullPath = path.join(traceDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`);
}

function assertManifestDigest(manifest, tracePath, root) {
  const entry = manifest.artifacts.find((artifact) => artifact["trace-path"] === tracePath);
  assert.ok(entry, `missing manifest entry for ${tracePath}`);
  const fullPath = path.join(root, "openspec", "changes", "render-write-change", tracePath);
  const digest = `sha256-${crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex")}`;
  assert.equal(entry["trace-digest"], digest);
}
