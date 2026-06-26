import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { renderChangeArtifact, renderDeliveryBody } from "./render-production-artifacts.mjs";
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

test("trace-render-v1 proposal partial 缺少 trace-contract-version hard fail", () => {
  const files = standardFiles({ proposal: true });
  files.artifacts = { "proposal.md": files.artifacts["proposal.md"] };
  files.traces = { "proposal.trace.json": files.traces["proposal.trace.json"] };
  files.manifestTraceContractVersion = "";

  const root = makeChange("proposal-missing-trace-contract-change", files);
  const result = validateChange({ root, change: "proposal-missing-trace-contract-change", complete: false });

  assertRule(result, "VAL-TR-017");
});

test("renderer 从 trace delivery payload 生成 artifact 且输出稳定", () => {
  const root = makeChange("render-runtime-change", standardFiles({ renderContract: true }));

  const first = renderChangeArtifact({
    root,
    change: "render-runtime-change",
    artifact: "runtime-acceptance",
  });
  const second = renderChangeArtifact({
    root,
    change: "render-runtime-change",
    artifact: "runtime-acceptance",
  });

  assert.equal(first.markdown, second.markdown);
  assert.equal(first.markdown, fs.readFileSync(path.join(root, "openspec", "changes", "render-runtime-change", "runtime-acceptance.md"), "utf8"));
  assert.match(first.markdown, /Trace digest: `sha256-[a-f0-9]{64}`/);
});

test("renderer 缺少 delivery payload hard fail", () => {
  const files = standardFiles({ renderContract: true });
  delete files.traces["runtime-acceptance.trace.json"]["delivery-plane"];
  const root = makeChange("render-missing-delivery-change", files);

  assert.throws(
    () =>
      renderChangeArtifact({
        root,
        change: "render-missing-delivery-change",
        artifact: "runtime-acceptance",
      }),
    /VAL-RENDER-002/,
  );
});

test("validator 对 renderer 输出漂移 hard fail", () => {
  const files = standardFiles({ renderContract: true });
  files.artifacts["runtime-acceptance.md"] = files.artifacts["runtime-acceptance.md"].replace("登录态解析。", "手写漂移。");
  const root = makeChange("render-drift-change", files);
  const result = validateChange({ root, change: "render-drift-change", complete: true });

  assertRule(result, "VAL-RENDER-001");
});

test("proposal register 与 final packet direct atom 集合不一致 hard fail", () => {
  const files = standardFiles({ proposal: true });
  const root = makeChange("proposal-authority-set-change", files);
  const packetPath = path.join(
    root,
    "openspec",
    "orchestrate",
    "change-capability-anchors",
    "proposal-authority-set-change",
    "proposal-authority-set-change.md",
  );
  fs.writeFileSync(
    packetPath,
    fs
      .readFileSync(packetPath, "utf8")
      .replace(
        "| GA-0001 | docs/source.md | L1-L2 | requirement | 事实。 | must | spec-requirement | 测试 projection。 | capability | direct | direct-owner | 使用。 | unit |",
        "| GA-0001 | docs/source.md | L1-L2 | requirement | 事实。 | must | spec-requirement | 测试 projection。 | capability | direct | direct-owner | 使用。 | unit |\n| GA-0002 | docs/source.md | L3-L4 | requirement | 第二事实。 | must | spec-requirement | 测试 projection。 | capability | direct | direct-owner | 使用。 | unit |",
      ),
  );

  const result = validateChange({ root, change: "proposal-authority-set-change", complete: false });
  assertRule(result, "VAL-PR-005");
});

test("proposal register 与 final packet 字段漂移 hard fail", () => {
  const files = standardFiles({ proposal: true });
  const root = makeChange("proposal-authority-field-change", files);
  const packetPath = path.join(
    root,
    "openspec",
    "orchestrate",
    "change-capability-anchors",
    "proposal-authority-field-change",
    "proposal-authority-field-change.md",
  );
  fs.writeFileSync(packetPath, fs.readFileSync(packetPath, "utf8").replace("L1-L2", "L9-L9"));

  const result = validateChange({ root, change: "proposal-authority-field-change", complete: false });
  assertRule(result, "VAL-PR-006");
});

test("proposal source-window-read-set 未覆盖 direct atoms hard fail", () => {
  const files = standardFiles({ proposal: true });
  files.traces["proposal.trace.json"]["source-window-read-set"] = [];
  const root = makeChange("proposal-read-set-gap-change", files);
  const result = validateChange({ root, change: "proposal-read-set-gap-change", complete: false });
  assertRule(result, "VAL-PR-009");
});

test("source-aligned final-packet-index 缺少目标 change hard fail", () => {
  const files = standardFiles({ proposal: true });
  const root = makeChange("missing-packet-index-change", files);
  const packetIndexPath = path.join(root, "openspec", "orchestrate", "phase-works", "phase-5", "final-packet-index.json");
  const packetIndex = JSON.parse(fs.readFileSync(packetIndexPath, "utf8"));
  packetIndex.packets = [];
  fs.writeFileSync(packetIndexPath, `${JSON.stringify(packetIndex, null, 2)}\n`);

  const result = validateChange({ root, change: "missing-packet-index-change", complete: false });
  assertRule(result, "VAL-PR-014");
});

test("source-aligned atom-plan-mapping direct owner 与 packet index 不一致 hard fail", () => {
  const files = standardFiles({ proposal: true });
  const root = makeChange("mapping-owner-drift-change", files);
  const mappingPath = path.join(root, "openspec", "orchestrate", "phase-works", "phase-5", "atom-plan-mapping.json");
  const mapping = JSON.parse(fs.readFileSync(mappingPath, "utf8"));
  mapping.rows[0]["final-owner-change"] = "other-change";
  fs.writeFileSync(mappingPath, `${JSON.stringify(mapping, null, 2)}\n`);

  const result = validateChange({ root, change: "mapping-owner-drift-change", complete: false });
  assertRule(result, "VAL-PR-015");
});

test("source-aligned obligation-atom-index 缺少 direct atom hard fail", () => {
  const files = standardFiles({ proposal: true });
  const root = makeChange("global-index-gap-change", files);
  const globalIndexPath = path.join(root, "openspec", "orchestrate", "change-capability-anchors", "obligation-atom-index.json");
  const globalIndex = JSON.parse(fs.readFileSync(globalIndexPath, "utf8"));
  globalIndex["global-atoms"] = [];
  fs.writeFileSync(globalIndexPath, `${JSON.stringify(globalIndex, null, 2)}\n`);

  const result = validateChange({ root, change: "global-index-gap-change", complete: false });
  assertRule(result, "VAL-PR-016");
});

test("proposal register 与 source-aligned JSON handoff 字段漂移 hard fail", () => {
  const files = standardFiles({ proposal: true });
  const root = makeChange("json-authority-field-drift-change", files);
  const globalIndexPath = path.join(root, "openspec", "orchestrate", "change-capability-anchors", "obligation-atom-index.json");
  const globalIndex = JSON.parse(fs.readFileSync(globalIndexPath, "utf8"));
  globalIndex["global-atoms"][0]["source-fact"] = "JSON 权威事实。";
  fs.writeFileSync(globalIndexPath, `${JSON.stringify(globalIndex, null, 2)}\n`);

  const result = validateChange({ root, change: "json-authority-field-drift-change", complete: false });
  assertRule(result, "VAL-PR-006");
});

test("final packet Markdown 缺少 JSON direct atom hard fail", () => {
  const files = standardFiles({ proposal: true });
  const root = makeChange("packet-mirror-missing-change", files);
  const packetPath = path.join(
    root,
    "openspec",
    "orchestrate",
    "change-capability-anchors",
    "packet-mirror-missing-change",
    "packet-mirror-missing-change.md",
  );
  fs.writeFileSync(packetPath, fs.readFileSync(packetPath, "utf8").replaceAll("GA-0001", "GA-9999"));

  const result = validateChange({ root, change: "packet-mirror-missing-change", complete: false });
  assertRule(result, "VAL-PR-017");
});

test("source-aligned manifest Phase 5 status 与 trace status 漂移 hard fail", () => {
  const files = standardFiles({ proposal: true });
  const root = makeChange("phase5-status-drift-change", files);
  const manifestPath = path.join(root, "openspec", "orchestrate", "trace", "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest["phase-statuses"]["phase-5"] = "adjusted";
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const result = validateChange({ root, change: "phase5-status-drift-change", complete: false });
  assertRule(result, "VAL-PR-013");
});

test("legacy Markdown-only proposal authority 仍可校验通过", () => {
  const files = standardFiles({ proposal: true, authorityMode: "legacy" });
  const root = makeChange("legacy-authority-change", files);
  const result = validateChange({ root, change: "legacy-authority-change", complete: false });

  assert.equal(result.errorCount, 0, JSON.stringify(result.issues, null, 2));
  assert.equal(result.warningCount, 0, JSON.stringify(result.issues, null, 2));
});

test("specs trace 与 proposal spec projection 一致时通过", () => {
  const files = standardFiles({ proposal: true, specs: true });
  const root = makeChange("specs-valid-change", files);
  const result = validateChange({ root, change: "specs-valid-change", complete: false });

  assert.equal(result.errorCount, 0, JSON.stringify(result.issues, null, 2));
  assert.equal(result.warningCount, 0, JSON.stringify(result.issues, null, 2));
});

test("specs trace 覆盖缺失 proposal spec projection hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true });
  files.traces["specs/capability.trace.json"]["requirement-source-trace"] = [];
  const root = makeChange("specs-projection-gap-change", files);
  const result = validateChange({ root, change: "specs-projection-gap-change", complete: false });

  assertRule(result, "VAL-SP-011");
});

test("specs trace source 字段漂移 hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true });
  files.traces["specs/capability.trace.json"]["requirement-source-trace"][0]["source-fact"] = "漂移事实。";
  const root = makeChange("specs-source-drift-change", files);
  const result = validateChange({ root, change: "specs-source-drift-change", complete: false });

  assertRule(result, "VAL-SP-012");
});

test("specs trace requirement/scenario 锚点不存在 hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true });
  files.traces["specs/capability.trace.json"]["requirement-source-trace"][0].scenario = "不存在的场景";
  const root = makeChange("specs-anchor-gap-change", files);
  const result = validateChange({ root, change: "specs-anchor-gap-change", complete: false });

  assertRule(result, "VAL-SP-013");
});

test("spec Markdown Requirement 缺少 Scenario hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true });
  files.artifacts["specs/capability/spec.md"] = `## ADDED Requirements

### Requirement: 登录态 actor 解析

系统 SHALL 解析登录态 actor。
`;
  const root = makeChange("specs-missing-scenario-change", files);
  const result = validateChange({ root, change: "specs-missing-scenario-change", complete: false });

  assertRule(result, "VAL-SP-014");
});

test("design trace 与 proposal/specs/Markdown/placement 一致时通过", () => {
  const files = standardFiles({ proposal: true, specs: true, design: true });
  const root = makeChange("design-valid-change", files);
  const result = validateChange({ root, change: "design-valid-change", complete: false });

  assert.equal(result.errorCount, 0, JSON.stringify(result.issues, null, 2));
  assert.equal(result.warningCount, 0, JSON.stringify(result.issues, null, 2));
});

test("design production-source-map 与 proposal atom 集合不一致 hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true, design: true });
  files.traces["design.trace.json"]["production-source-map"].push({
    ...files.traces["design.trace.json"]["production-source-map"][0],
    "source-map-row-id": "PSM-002",
    "global-atom-id": "GA-0002",
  });
  const root = makeChange("design-source-set-change", files);
  const result = validateChange({ root, change: "design-source-set-change", complete: false });

  assertRule(result, "VAL-DG-001");
});

test("design production-source-map source 字段漂移 hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true, design: true });
  files.traces["design.trace.json"]["production-source-map"][0]["source-fact"] = "漂移事实。";
  const root = makeChange("design-source-field-change", files);
  const result = validateChange({ root, change: "design-source-field-change", complete: false });

  assertRule(result, "VAL-DG-002");
});

test("design spec-trace-anchor 漂移 hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true, design: true });
  files.traces["design.trace.json"]["production-source-map"][0]["spec-trace-anchors"][0].scenario = "不存在的场景";
  const root = makeChange("design-spec-anchor-change", files);
  const result = validateChange({ root, change: "design-spec-anchor-change", complete: false });

  assertRule(result, "VAL-DG-003");
});

test("design D decision 未锚定 Markdown/index hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true, design: true });
  files.traces["design.trace.json"]["production-source-map"][0]["design-handling-ids"] = ["D-999"];
  const root = makeChange("design-decision-anchor-change", files);
  const result = validateChange({ root, change: "design-decision-anchor-change", complete: false });

  assertRule(result, "VAL-DG-004");
});

test("design-obligation-matrix 缺少 direct atom hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true, design: true });
  files.traces["design.trace.json"]["design-obligation-matrix"] = [];
  const root = makeChange("design-matrix-gap-change", files);
  const result = validateChange({ root, change: "design-matrix-gap-change", complete: false });

  assertRule(result, "VAL-DG-005");
});

test("design implementation-placement-ids 引用未定义 placement hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true, design: true });
  files.traces["design.trace.json"]["design-obligation-matrix"][0]["implementation-placement-ids"] = ["P-999"];
  const root = makeChange("design-placement-gap-change", files);
  const result = validateChange({ root, change: "design-placement-gap-change", complete: false });

  assertRule(result, "VAL-DG-006");
});

test("design production-alignment-gate count/check 与推导事实冲突 hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true, design: true });
  files.traces["design.trace.json"]["production-alignment-gate"]["direct-atom-count"] = 2;
  const root = makeChange("design-gate-drift-change", files);
  const result = validateChange({ root, change: "design-gate-drift-change", complete: false });

  assertRule(result, "VAL-DG-007");
});

test("runtime trace 与 proposal/specs/design/source basis 一致时通过", () => {
  const files = standardFiles({ proposal: true, specs: true, design: true });
  const root = makeChange("runtime-valid-change", files);
  const result = validateChange({ root, change: "runtime-valid-change", complete: false });

  assert.equal(result.errorCount, 0, JSON.stringify(result.issues, null, 2));
  assert.equal(result.warningCount, 0, JSON.stringify(result.issues, null, 2));
});

test("runtime trace 缺少 canonical-row-index hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true, design: true });
  delete files.traces["runtime-acceptance.trace.json"]["canonical-row-index"];
  const root = makeChange("runtime-missing-row-index-change", files);
  const result = validateChange({ root, change: "runtime-missing-row-index-change", complete: false });

  assertRule(result, "VAL-TR-014");
  assertRule(result, "VAL-RA-110");
});

test("runtime canonical-row-index 缺少 Markdown runtime row hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true, design: true, secondAc: true });
  files.traces["runtime-acceptance.trace.json"]["canonical-row-index"]["surface-rows"] = ["RS-001"];
  const root = makeChange("runtime-row-index-gap-change", files);
  const result = validateChange({ root, change: "runtime-row-index-gap-change", complete: false });

  assertRule(result, "VAL-RA-111");
});

test("runtime canonical-row-index 包含不存在 row hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true, design: true });
  files.traces["runtime-acceptance.trace.json"]["canonical-row-index"]["surface-rows"].push("RS-999");
  const root = makeChange("runtime-row-index-extra-change", files);
  const result = validateChange({ root, change: "runtime-row-index-extra-change", complete: false });

  assertRule(result, "VAL-RA-112");
});

test("runtime canonical-row-index row 类型放错数组 hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true, design: true });
  files.traces["runtime-acceptance.trace.json"]["canonical-row-index"]["operation-rows"] = ["RS-001"];
  const root = makeChange("runtime-row-index-type-change", files);
  const result = validateChange({ root, change: "runtime-row-index-type-change", complete: false });

  assertRule(result, "VAL-RA-113");
});

test("runtime upstream map 缺少 proposal direct atom hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true, design: true });
  files.traces["runtime-acceptance.trace.json"]["runtime-upstream-coverage-map"] =
    files.traces["runtime-acceptance.trace.json"]["runtime-upstream-coverage-map"].filter(
      (row) => row["upstream-item-id"] !== "GA-0001",
    );
  const root = makeChange("runtime-proposal-gap-change", files);
  const result = validateChange({ root, change: "runtime-proposal-gap-change", complete: false });

  assertRule(result, "VAL-RA-104");
});

test("runtime upstream map 缺少 authority id/type hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true, design: true });
  delete files.traces["runtime-acceptance.trace.json"]["runtime-upstream-coverage-map"][0]["upstream-item-type"];
  const root = makeChange("runtime-upstream-shape-change", files);
  const result = validateChange({ root, change: "runtime-upstream-shape-change", complete: false });

  assertRule(result, "VAL-RA-103");
});

test("runtime upstream map 缺少 specs scenario hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true, design: true });
  files.traces["runtime-acceptance.trace.json"]["runtime-upstream-coverage-map"] =
    files.traces["runtime-acceptance.trace.json"]["runtime-upstream-coverage-map"].filter(
      (row) => row["upstream-item-type"] !== "spec-scenario",
    );
  const root = makeChange("runtime-spec-scenario-gap-change", files);
  const result = validateChange({ root, change: "runtime-spec-scenario-gap-change", complete: false });

  assertRule(result, "VAL-RA-105");
});

test("runtime upstream map 缺少 design decision hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true, design: true });
  files.traces["runtime-acceptance.trace.json"]["runtime-upstream-coverage-map"] =
    files.traces["runtime-acceptance.trace.json"]["runtime-upstream-coverage-map"].filter(
      (row) => row["upstream-item-id"] !== "D-001",
    );
  const root = makeChange("runtime-design-decision-gap-change", files);
  const result = validateChange({ root, change: "runtime-design-decision-gap-change", complete: false });

  assertRule(result, "VAL-RA-106");
});

test("runtime Markdown Source Basis 与 JSON source IDs 漂移 hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true, design: true });
  files.artifacts["runtime-acceptance.md"] = files.artifacts["runtime-acceptance.md"].replace("D-001", "D-999");
  const root = makeChange("runtime-source-basis-drift-change", files);
  const result = validateChange({ root, change: "runtime-source-basis-drift-change", complete: false });

  assertRule(result, "VAL-RA-107");
});

test("runtime canonical row 未被 upstream/source-map 引用 hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true, design: true });
  files.traces["runtime-acceptance.trace.json"]["canonical-row-index"]["surface-rows"].push("RS-999");
  files.traces["runtime-acceptance.trace.json"]["delivery-plane"]["canonical-rows"].push(
    runtimeSurfaceRow("RS-999", "孤儿 runtime row。", "GA-0001、D-001"),
  );
  files.traces["runtime-acceptance.trace.json"]["runtime-upstream-coverage-map"][0]["runtime-row-ids"] = ["RS-001"];
  files.traces["runtime-acceptance.trace.json"]["runtime-coverage-source-map"][0]["row-ids"] = ["RS-001"];
  files.artifacts["runtime-acceptance.md"] = renderDeliveryBody(
    files.traces["runtime-acceptance.trace.json"],
    files.traces["verification.proof-slices.json"],
  );
  const root = makeChange("runtime-orphan-row-change", files);
  const result = validateChange({ root, change: "runtime-orphan-row-change", complete: false });

  assertRule(result, "VAL-RA-108");
});

test("runtime source-map 引用不存在 canonical row hard fail", () => {
  const files = standardFiles({ proposal: true, specs: true, design: true });
  files.traces["runtime-acceptance.trace.json"]["runtime-coverage-source-map"][0]["row-ids"] = ["RS-999"];
  const root = makeChange("runtime-source-map-row-gap-change", files);
  const result = validateChange({ root, change: "runtime-source-map-row-gap-change", complete: false });

  assertRule(result, "VAL-RA-109");
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

test("proof-slices-v1 propose 阶段不校验 owner/layer tests 目录落点", () => {
  const cases = [
    { change: "proof-slices-web-db-placement-change", owner: "apps/web", layer: "DB/integration" },
    { change: "proof-slices-web-contract-placement-change", owner: "apps/web", layer: "contract" },
    { change: "proof-slices-control-api-placement-change", owner: "apps/control-api", layer: "route/API" },
    { change: "proof-slices-k8s-placement-change", owner: "infra/k8s", layer: "contract" },
  ];

  for (const item of cases) {
    const files = withSingleProofSlicePlacement(standardFiles({ newContract: true }), item);
    const root = makeChange(item.change, files);
    const result = validateChange({ root, change: item.change, complete: true });

    assert.ok(
      !result.issues.some((issue) => issue.ruleId === "VAL-PS-009"),
      `did not expect VAL-PS-009 for ${item.owner} + ${item.layer}, got ${JSON.stringify(result.issues, null, 2)}`,
    );
    assert.equal(result.errorCount, 0, `${item.owner} + ${item.layer}: ${JSON.stringify(result.issues, null, 2)}`);
  }
});

test("proof-slices-v1 非法 Primary Layer 仍 hard fail", () => {
  const files = withSingleProofSlicePlacement(standardFiles({ newContract: true }), {
    owner: "apps/control-api",
    layer: "unsupported/layer",
  });
  const root = makeChange("proof-slices-invalid-layer-change", files);
  const result = validateChange({ root, change: "proof-slices-invalid-layer-change", complete: true });

  assertRule(result, "VAL-PS-007");
});

test("proof-slices-v1 manual slice 同样不触发 propose 目录落点 hard fail", () => {
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

test("tasks runtime-row-ownership-projection 未覆盖 runtime rows hard fail", () => {
  const files = standardFiles({ secondAc: true });
  files.traces["tasks.trace.json"]["runtime-acceptance-projection"]["runtime-row-ownership-projection"].pop();
  const root = makeChange("task-projection-gap-change", files);
  const result = validateChange({ root, change: "task-projection-gap-change", complete: true });
  assertRule(result, "VAL-TS-110");
});

test("tasks projection owner-ac-id 不存在 hard fail", () => {
  const files = standardFiles();
  files.traces["tasks.trace.json"]["runtime-acceptance-projection"]["runtime-row-ownership-projection"][0]["owner-ac-id"] = "AC-999";
  const root = makeChange("task-projection-bad-owner-change", files);
  const result = validateChange({ root, change: "task-projection-bad-owner-change", complete: true });
  assertRule(result, "VAL-TS-111");
});

test("tasks projection owner AC 与 runtime row 不匹配 hard fail", () => {
  const files = standardFiles({ secondAc: true });
  files.traces["tasks.trace.json"]["runtime-acceptance-projection"]["runtime-row-ownership-projection"][1]["owner-ac-id"] = "AC-001";
  const root = makeChange("task-projection-owner-mismatch-change", files);
  const result = validateChange({ root, change: "task-projection-owner-mismatch-change", complete: true });
  assertRule(result, "VAL-TS-112");
});

test("tasks projected runtime row 缺少 task projection hard fail", () => {
  const files = standardFiles();
  files.traces["tasks.trace.json"]["runtime-acceptance-projection"]["runtime-row-ownership-projection"][0]["implementation-task-ids"] = [];
  const root = makeChange("task-projection-missing-task-change", files);
  const result = validateChange({ root, change: "task-projection-missing-task-change", complete: true });
  assertRule(result, "VAL-TS-113");
});

test("tasks acceptance-driven-coverage 引用不存在节点 hard fail", () => {
  const files = standardFiles();
  files.traces["tasks.trace.json"]["acceptance-driven-coverage"]["obligation-atom-coverage"][0]["implementation-task-ids"] = ["AC-001.9"];
  const root = makeChange("task-coverage-bad-ref-change", files);
  const result = validateChange({ root, change: "task-coverage-bad-ref-change", complete: true });
  assertRule(result, "VAL-TS-114");
});

test("tasks acceptance-driven-coverage owner AC 未列入 acceptance slice hard fail", () => {
  const files = standardFiles({ secondAc: true });
  const coverageRow = files.traces["tasks.trace.json"]["acceptance-driven-coverage"]["obligation-atom-coverage"][1];
  coverageRow["acceptance-slice-ids"] = ["AC-001"];
  coverageRow["implementation-task-ids"] = ["AC-001.1"];
  const root = makeChange("task-coverage-owner-mismatch-change", files);
  const result = validateChange({ root, change: "task-coverage-owner-mismatch-change", complete: true });
  assertRule(result, "VAL-TS-115");
});

test("tasks acceptance-driven-coverage 未覆盖 runtime rows hard fail", () => {
  const files = standardFiles({ secondAc: true });
  files.traces["tasks.trace.json"]["acceptance-driven-coverage"]["obligation-atom-coverage"].pop();
  const root = makeChange("task-coverage-gap-change", files);
  const result = validateChange({ root, change: "task-coverage-gap-change", complete: true });
  assertRule(result, "VAL-TS-116");
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

test("verification reconciliation 未覆盖 runtime row hard fail", () => {
  const files = standardFiles();
  files.traces["verification.trace.json"]["runtime-coverage-reconciliation"] = [];
  const root = makeChange("missing-reconciled-runtime-row-change", files);
  const result = validateChange({ root, change: "missing-reconciled-runtime-row-change", complete: true });

  assertRule(result, "VAL-RC-006");
});

test("verification proof slice 未被 reconciliation 引用 hard fail", () => {
  const files = standardFiles();
  files.traces["verification.proof-slices.json"]["proof-slices"].push({
    ...files.traces["verification.proof-slices.json"]["proof-slices"][0],
    "slice-id": "PS-002",
    "primitive-type": "state",
    "branch-variant": "actor readback",
    "oracle-fragment": "actor 可从 readback 读取。",
    "failure-signal": "actor readback 缺失。",
    "primary-layer": "component",
    "primary-assertion-shape": "rendered assertion",
    "regression-intent": "medium",
    "test-contract": {
      "primary-test-cardinality": "exactly-one",
      "test-title-prefix": "PS-002",
      "allow-shared-setup": true,
      "allow-multi-slice-primary-test": false,
      "waiver-required-for-multi-slice": true,
    },
  });
  files.traces["verification.proof-slices.json"]["proof-slice-summary"]["proof-slice-count"] = 2;
  files.traces["verification.proof-slices.json"]["proof-slice-summary"]["primitive-types-used"] = ["authorization", "state"];
  files.traces["verification.proof-slices.json"]["proof-slice-summary"]["primary-layers-used"] = ["security/negative", "component"];
  files.artifacts["verification.md"] = renderDeliveryBody(
    files.traces["verification.trace.json"],
    files.traces["verification.proof-slices.json"],
  );
  const root = makeChange("unreferenced-proof-slice-change", files);
  const result = validateChange({ root, change: "unreferenced-proof-slice-change", complete: true });

  assertRule(result, "VAL-RC-007");
});

test("疑似非原子 slice 继续输出 warning", () => {
  const files = standardFiles();
  const proofSlice = files.traces["verification.proof-slices.json"]["proof-slices"][0];
  proofSlice["primitive-type"] = "operation";
  proofSlice["branch-variant"] = "edit/delete/add item";
  proofSlice["observable-surface"] = "API";
  proofSlice["oracle-fragment"] = "edit/delete/add 均可观察。";
  proofSlice["failure-signal"] = "操作失败。";
  proofSlice["primary-layer"] = "route/API";
  proofSlice["primary-assertion-shape"] = "interactive assertions";
  proofSlice["fixture-mock-boundary"] = "DB fixture";
  files.traces["verification.proof-slices.json"]["proof-slice-summary"]["primitive-types-used"] = ["operation"];
  files.traces["verification.proof-slices.json"]["proof-slice-summary"]["primary-layers-used"] = ["route/API"];
  files.traces["verification.trace.json"]["delivery-plane"] = verificationDelivery();
  files.artifacts["verification.md"] = renderDeliveryBody(
    files.traces["verification.trace.json"],
    files.traces["verification.proof-slices.json"],
  );
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

  const preparedTraces = {};
  const traceEntries = [];
  for (const [traceName, trace] of Object.entries(files.traces)) {
    preparedTraces[traceName] = replaceChangePlaceholder(trace, change);
    const fullPath = path.join(traceDir, traceName);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, `${JSON.stringify(preparedTraces[traceName], null, 2)}\n`);
  }
  writeProposalAuthoritySources(root, change, preparedTraces, files.writeAuthority !== false, files.authorityMode ?? "json");
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
          ...(files.manifestRenderContractVersion
            ? { "render-contract-version": files.manifestRenderContractVersion }
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
    "runtime-acceptance.trace.json": runtimeTrace(options),
    "verification.trace.json": verificationTrace(),
    "tasks.trace.json": tasksTrace(options),
  };
  const usesRenderContract = options.renderContract !== false;
  if (options.newContract || usesRenderContract) {
    traces["verification.proof-slices.json"] = proofSlicesTrace();
  }
  if (options.proposal) {
    artifacts["proposal.md"] = "## Why\n\n- 测试。\n";
    traces["proposal.trace.json"] = proposalTrace(options);
  }
  if (options.specs) {
    artifacts["specs/capability/spec.md"] = specsBody();
    traces["specs/capability.trace.json"] = specsTrace();
  }
  if (options.design) {
    artifacts["design.md"] = designBody();
    traces["design.trace.json"] = designTrace(options.designGa ?? "GA-0001");
  }
  if (usesRenderContract) {
    addRenderDeliveryPayload(artifacts, traces, options);
  }
  return {
    artifacts,
    traces,
    ...(options.authorityMode ? { authorityMode: options.authorityMode } : {}),
    ...(options.newContract || usesRenderContract ? { manifestTraceContractVersion: "proof-slices-v1" } : {}),
    ...(usesRenderContract ? { manifestRenderContractVersion: "trace-render-v1" } : {}),
  };
}

function addRenderDeliveryPayload(artifacts, traces, options = {}) {
  for (const [artifactPath, body] of Object.entries(artifacts)) {
    const trace = traces[traceNameForArtifact(artifactPath)];
    if (trace) {
      trace["delivery-plane"] = deliveryPayloadForArtifact(artifactPath, options);
      artifacts[artifactPath] = renderDeliveryBody(trace, traces["verification.proof-slices.json"]);
    }
  }
}

function withSingleProofSlicePlacement(files, options) {
  const manual = options.manual ?? "None";
  const proofSlice = files.traces["verification.proof-slices.json"]?.["proof-slices"]?.[0];
  if (proofSlice) {
    proofSlice["primary-layer"] = options.layer;
    proofSlice["production-owner"] = options.owner;
    proofSlice["manual-environment-gate"] = manual;
    files.traces["verification.proof-slices.json"]["proof-slice-summary"]["primary-layers-used"] = [
      options.layer,
    ];
  }
  files.traces["verification.trace.json"]["delivery-plane"] = verificationDelivery();
  files.artifacts["verification.md"] = renderDeliveryBody(
    files.traces["verification.trace.json"],
    files.traces["verification.proof-slices.json"],
  );

  return files;
}

function deliveryPayloadForArtifact(artifactPath, options = {}) {
  if (artifactPath === "proposal.md") return proposalDelivery();
  if (artifactPath.startsWith("specs/")) return specsDelivery();
  if (artifactPath === "design.md") return designDelivery();
  if (artifactPath === "runtime-acceptance.md") return runtimeDelivery(options);
  if (artifactPath === "verification.md") return verificationDelivery();
  if (artifactPath === "tasks.md") return tasksDelivery(options);
  throw new Error(`Unsupported test artifact: ${artifactPath}`);
}

function proposalDelivery() {
  return {
    why: ["- 测试。"],
    "change-plan-boundary": ["- 以 fixture final packet 为边界。"],
    "what-changes": ["- 登录态 actor 解析行为进入 change。"],
    capabilities: {
      "new-capabilities": [{ name: "capability", summary: "登录态 actor 解析。" }],
      "modified-capabilities": [],
    },
    "non-goals": ["- 无。"],
    impact: ["- apps/web auth surface。"],
    "rollout-readiness": ["- 无。"],
  };
}

function specsDelivery() {
  return {
    "added-requirements": [
      {
        name: "登录态 actor 解析",
        body: "系统 SHALL 解析登录态 actor，并 MUST NOT 伪造 actor。",
        scenarios: [
          {
            name: "解析登录态 actor",
            when: "请求进入 auth surface",
            then: "系统 MUST 解析内部 actor。",
          },
        ],
      },
    ],
  };
}

function designDelivery() {
  return {
    context: ["- 测试。"],
    "goals-non-goals": ["- 保持 source-backed scope。"],
    decisions: [
      {
        "decision-id": "D-001",
        title: "登录态 actor 解析设计",
        decision: "通过 command 和 placement 承接 source-backed requirement。",
        "source-gap": "无。",
        "minimal-shape": "使用 P-001 承接生产落点。",
        "rejected-expansion": "不扩展 scope。",
      },
    ],
    "architecture-module-boundary-design": ["- P-001 承接生产落点。"],
    "domain-data-migration-design": ["- 无。"],
    "api-auth-security-design": ["- auth surface 解析 actor。"],
    "async-realtime-ai-worker-design": ["- 无。"],
    "frontend-ux-prototype-fidelity-design": ["- 无。"],
    "observability-ops-deployment-design": ["- 无。"],
    "verification-design": ["- 后续 runtime/verification 覆盖。"],
    "rollout-compatibility": ["- 无。"],
    "risks-trade-offs": ["- 无。"],
    "open-questions": ["无"],
  };
}

function runtimeDelivery(options = {}) {
  const canonicalRows = [
    runtimeSurfaceRow("RS-001", "登录态解析。", "GA-0001、scenario: 解析登录态 actor、D-001"),
  ];
  if (options.secondAc) {
    canonicalRows.push(runtimeSurfaceRow("RS-002", "第二行为。", "GA-0001、D-001"));
  }
  return {
    "runtime-acceptance-intent": {
      scope: "测试。",
      "source-basis": "proposal register、spec scenario、design decision。",
      "out-of-scope": "None。",
    },
    "canonical-rows": canonicalRows,
  };
}

function runtimeSurfaceRow(id, obligation, sourceBasis) {
  return {
    "surface-id": id,
    "surface-type": id === "RS-001" ? "auth surface" : "route surface",
    "owner-candidate": "apps/web",
    "entry-point": "route",
    "runtime-obligation": obligation,
    "observable-fact": id === "RS-001" ? "auth fact" : "route fact",
    "default-path-policy": "real path",
    "external-boundary": "none",
    "source-basis": sourceBasis,
    "projection-type": "spec-requirement / design",
    "scope-role": "required behavior",
    "no-scope-expansion-check": "no expansion",
  };
}

function verificationDelivery() {
  return {
    "verification-intent": {
      scope: "测试。",
      "runtime-source": "runtime-acceptance.md。",
      "out-of-scope": "None。",
    },
    "layer-harness-fixture-notes": [],
    "do-not-test": [],
  };
}

function tasksDelivery(options = {}) {
  const slices = [taskSlice("AC-001", "登录态 actor 解析", ["RS-001"], "实现 actor 解析", "可直接开始")];
  if (options.secondAc) {
    slices.push(taskSlice("AC-002", "第二行为", ["RS-002"], "实现第二行为", "需 AC-001"));
  }
  return { "acceptance-slices": slices };
}

function taskSlice(acId, title, runtimeRows, taskTitle, startGate) {
  return {
    "ac-id": acId,
    title,
    outcome: [acId === "AC-001" ? "- 登录态 actor 可解析。" : "- 第二行为可用。"],
    "start-gate": [acId === "AC-001" ? "- None" : "- AC-001。"],
    "runtime-rows": runtimeRows,
    "resolved-runtime-contract": runtimeRows.map((row) => ({
      row,
      "worker-facing-obligation": "生产义务。",
      "observable-proof": "可观察 proof。",
      "default-no-scope-boundary": "默认边界。",
    })),
    "implementation-scope": [`- ${taskTitle}。`],
    preserve: ["- 不扩展 scope。"],
    "proof-contract": ["- 可观察。"],
    tasks: [
      {
        "task-id": `${acId}.1`,
        title: taskTitle,
        "runtime-rows": runtimeRows,
        acceptance: "可观察。",
        preserve: "不扩展。",
        proof: "可观察。",
        "mock-default-path-policy": "默认真实路径。",
      },
    ],
  };
}

function runtimeAcceptanceBody(options = {}) {
  const extraRow = options.secondAc
    ? "| RS-002 | route surface | apps/web | route | 第二行为。 | route fact | real path | none | GA-0001、D-001 | spec-requirement / design | required behavior | no expansion |\n"
    : "";
  return `## Runtime Acceptance Intent

- Scope: 测试。

## Runtime Surface Inventory

| Surface ID | Surface Type | Owner Candidate | Entry Point | Runtime Obligation | Observable Fact | Default Path Policy | External Boundary | Source Basis | Projection Type | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RS-001 | auth surface | apps/web | route | 登录态解析。 | auth fact | real path | none | GA-0001、scenario: 解析登录态 actor、D-001 | spec-requirement / design | required behavior | no expansion |
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

function proposalTrace(options = {}) {
  const jsonPreconditions =
    options.authorityMode === "legacy"
      ? {}
      : {
          "orchestrate-manifest": "openspec/orchestrate/trace/manifest.json",
          "global-atom-index-json": "openspec/orchestrate/change-capability-anchors/obligation-atom-index.json",
          "atom-plan-mapping-json": "openspec/orchestrate/phase-works/phase-5/atom-plan-mapping.json",
          "final-packet-index-json": "openspec/orchestrate/phase-works/phase-5/final-packet-index.json",
        };
  return {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "proposal",
    "artifact-path": "proposal.md",
    "change-name": "%CHANGE%",
    "schema-name": "production-obligation-atom-driven",
    "obligation-atom-preconditions": {
      "proposal-input-mode": "final-change-packet",
      "canonical-change-packet": "openspec/orchestrate/change-capability-anchors/%CHANGE%/%CHANGE%.md",
      "global-atom-index": "openspec/orchestrate/change-capability-anchors/obligation-atom-index.md",
      ...jsonPreconditions,
      blockers: [],
    },
    "change-atom-coverage-register": [
      {
        "global-atom-id": "GA-0001",
        "source-document": "docs/source.md",
        lines: "L1-L2",
        "atom-type": "requirement",
        "source-fact": "事实。",
        normativity: "must",
        "coverage-status": "direct",
        "artifact-projection": "spec-requirement",
        "projection-source": "final-packet",
        "owner-capability": "capability",
        "atom-relation": "direct",
        roles: "direct-owner",
        "propose-use": "使用。",
        "evidence-need": "unit",
        "downstream-coverage-expectation": "下游 specs/runtime/tasks/verification 需要覆盖。",
      },
    ],
    "production-source-coverage": [
      {
        "source-document": "docs/source.md",
        "global-atom-ids": ["GA-0001"],
        "line-ranges": ["L1-L2"],
        "atom-count": 1,
        "artifact-projections": ["spec-requirement"],
        capabilities: ["capability"],
        "proposal-use": "作为 source-backed 输入。",
      },
    ],
    "source-window-read-set": [
      {
        "global-atom-id": "GA-0001",
        "source-document": "docs/source.md",
        "line-range": "L1-L2",
        "read-purpose": "确认 source-backed 边界。",
        "interpretation-result": "事实。",
      },
    ],
    "proposal-alignment-gate": {
      "direct-atoms": {
        count: 1,
        ids: ["GA-0001"],
        "id-list-source": "final-change-packet-order",
      },
      "orphan-direct-atoms": [],
      blockers: [],
    },
  };
}

function designBody() {
  return `## Context

- 测试。

## Decisions

### D-001 登录态 actor 解析设计

Decision: 通过 command 和 placement 承接 source-backed requirement。

Source Gap: 无。

Minimal Shape: 使用 P-001 承接生产落点。

Rejected Expansion: 不扩展 scope。
`;
}

function designTrace(gaId) {
  return {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "design",
    "artifact-path": "design.md",
    "change-name": "%CHANGE%",
    "schema-name": "production-obligation-atom-driven",
    "source-interface": {
      "proposal-artifact": "proposal.md",
      "proposal-trace": "trace/proposal.trace.json",
      "spec-artifacts": ["specs/capability/spec.md"],
      "spec-traces": ["trace/specs/capability.trace.json"],
      "registered-source-window-policy": "design 只消费 proposal/spec trace 已登记 source。",
    },
    "production-source-map": [
      {
        "source-map-row-id": "PSM-001",
        "global-atom-id": gaId,
        capability: "capability",
        "source-document": "docs/source.md",
        lines: "L1-L2",
        "atom-type": "requirement",
        "source-fact": "事实。",
        normativity: "must",
        "artifact-projection": "spec-requirement",
        "proposal-trace-anchor": "trace/proposal.trace.json#/change-atom-coverage-register/0",
        "spec-trace-anchors": [
          {
            "trace-path": "trace/specs/capability.trace.json",
            "trace-pointer": "#/requirement-source-trace/0",
            capability: "capability",
            requirement: "登录态 actor 解析",
            scenario: "解析登录态 actor",
            "spec-handling": "direct-spec-requirement",
            "source-projection": "spec-requirement",
          },
        ],
        "design-handling-type": "implementation-placement",
        "design-handling-ids": ["D-001"],
        "design-handling": "D-001 登录态 actor 解析设计",
        "implementation-placement": ["apply-text-edit command"],
        "no-scope-expansion-check": "不扩展 source scope。",
      },
    ],
    "design-decision-index": [
      {
        "decision-id": "D-001",
        title: "登录态 actor 解析设计",
        "design-handling": "通过 command 和 placement 承接 source-backed requirement。",
      },
    ],
    "design-obligation-matrix": [
      {
        "matrix-row-id": "DOM-001",
        item: gaId,
        "obligation-kind": "spec-requirement-design-placement",
        "global-atom-id": gaId,
        capability: "capability",
        "artifact-projection": "spec-requirement",
        "source-fact": "事实。",
        "spec-scenario-anchors": ["capability::登录态 actor 解析::解析登录态 actor"],
        "design-anchor": ["D-001"],
        "design-handling": "D-001 登录态 actor 解析设计。",
        "guard-boundary": "无。",
        "implementation-placement": ["apply-text-edit command"],
        "implementation-placement-ids": ["P-001"],
        "proof-expectation": "后续 runtime/verification 覆盖。",
        "explicit-blocker": "无",
      },
    ],
    "source-scope-map": {
      "direct-atom-handling": [
        {
          "global-atom-id": gaId,
          capability: "capability",
          "source-document": "docs/source.md",
          lines: "L1-L2",
          "artifact-projection": "spec-requirement",
          "handling-type": "implementation-placement",
          "design-handling-ids": ["D-001"],
          "implementation-placement": ["apply-text-edit command"],
        },
      ],
      "spec-scenario-handling": [
        {
          capability: "capability",
          requirement: "登录态 actor 解析",
          scenario: "解析登录态 actor",
          handling: "D-001 登录态 actor 解析设计。",
        },
      ],
      "implementation-placement-map": [
        {
          "placement-id": "P-001",
          surface: "domain-command",
          owner: "apply-text-edit command",
          boundary: "承接 source-backed requirement。",
          "design-handling-ids": ["D-001"],
        },
      ],
    },
    "ui-control-contracts": [],
    "production-alignment-gate": {
      "change-slug": "%CHANGE%",
      "schema-name": "production-obligation-atom-driven",
      "direct-atom-count": 1,
      "direct-atom-handling-check": "1 个 direct GA 已覆盖。",
      "production-source-map-check": "1 行 production-source-map 来自 proposal register。",
      "design-obligation-matrix-check": "覆盖 1 个 direct atom obligation 和 1 个 in-scope scenario。",
      blockers: [],
    },
  };
}

function specsBody() {
  return `## ADDED Requirements

### Requirement: 登录态 actor 解析

系统 SHALL 解析登录态 actor，并 MUST NOT 伪造 actor。

#### Scenario: 解析登录态 actor

- WHEN 请求进入 auth surface
- THEN 系统 MUST 解析内部 actor。
`;
}

function specsTrace() {
  return {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "specs",
    "artifact-path": "specs/capability/spec.md",
    "change-name": "%CHANGE%",
    "schema-name": "production-obligation-atom-driven",
    "requirement-source-trace": [
      {
        requirement: "登录态 actor 解析",
        scenario: "解析登录态 actor",
        "global-atom-id": "GA-0001",
        "source-document": "docs/source.md",
        lines: "L1-L2",
        "source-projection": "spec-requirement",
        "spec-handling": "direct-spec-requirement",
        "source-fact": "事实。",
      },
    ],
    "production-alignment-gate": { blockers: [] },
  };
}

function runtimeTrace(options = {}) {
  const runtimeRowIds = options.secondAc ? ["RS-001", "RS-002"] : ["RS-001"];
  return {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "runtime-acceptance",
    "artifact-path": "runtime-acceptance.md",
    "canonical-row-index": {
      "surface-rows": runtimeRowIds,
      "operation-rows": [],
      "state-rows": [],
      "chain-rows": [],
    },
    "runtime-upstream-coverage-map": [
      {
        "upstream-item-id": "GA-0001",
        "upstream-item-type": "proposal-direct-atom",
        "source-name": "登录态 actor 解析",
        "projection-handling": "spec-requirement",
        "runtime-row-ids": runtimeRowIds,
        "coverage-mode": "covered-by-runtime-rows",
        "not-applicable-reason": "不适用；direct atom 已映射。",
        "coverage-note": "登录态 actor 解析由 runtime surface 覆盖。",
      },
      {
        "upstream-item-id": "scenario-login-actor",
        "upstream-item-type": "spec-scenario",
        "source-name": "capability::登录态 actor 解析::解析登录态 actor",
        "projection-handling": "direct-spec-requirement",
        "runtime-row-ids": ["RS-001"],
        "coverage-mode": "covered-by-runtime-rows",
        "not-applicable-reason": "不适用；spec scenario 已映射。",
        "coverage-note": "Requirement/Scenario 已落到 RS-001。",
      },
      {
        "upstream-item-id": "D-001",
        "upstream-item-type": "material-design-decision",
        "source-name": "登录态 actor 解析设计",
        "projection-handling": "design-decision",
        "runtime-row-ids": ["RS-001"],
        "coverage-mode": "covered-by-runtime-rows",
        "not-applicable-reason": "不适用；design decision 已映射。",
        "coverage-note": "D-001 已落到 RS-001。",
      },
    ],
    "runtime-coverage-source-map": [
      {
        "source-group": "auth-surface",
        "row-ids": runtimeRowIds,
        "source-basis": ["GA-0001", "D-001"],
        "coverage-note": "测试 fixture 的 runtime source group。",
      },
    ],
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
  const coverageRows = projection.map((row) => ({
    "global-atom-id": "GA-0001",
    "artifact-projection": "spec-requirement",
    "owner-capability": "capability",
    "proof-only-handling": "not-proof-only",
    "source-name": "事实。",
    "runtime-row-ids": [row["runtime-row-id"]],
    "acceptance-slice-ids": [row["owner-ac-id"]],
    "implementation-task-ids": row["implementation-task-ids"],
    "runtime-proof-summary": "可观察。",
    "coverage-status": "projected-to-production-task",
    "blocker-not-applicable-reason": "无",
  }));
  return {
    "trace-schema": "openspec-trace-v1",
    "artifact-id": "tasks",
    "artifact-path": "tasks.md",
    "acceptance-driven-coverage": {
      "obligation-atom-coverage": coverageRows,
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

function replaceChangePlaceholder(value, change) {
  if (Array.isArray(value)) return value.map((item) => replaceChangePlaceholder(item, change));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, replaceChangePlaceholder(child, change)]),
    );
  }
  return typeof value === "string" ? value.replaceAll("%CHANGE%", change) : value;
}

function writeProposalAuthoritySources(root, change, traces, enabled, authorityMode = "json") {
  const proposal = traces["proposal.trace.json"];
  if (!enabled || !proposal) return;
  const rows = proposal["change-atom-coverage-register"] ?? [];
  const packetDir = path.join(root, "openspec", "orchestrate", "change-capability-anchors", change);
  fs.mkdirSync(packetDir, { recursive: true });
  const packetPath = path.join(packetDir, `${change}.md`);
  fs.writeFileSync(packetPath, finalPacketFromRows(change, rows));

  const indexDir = path.join(root, "openspec", "orchestrate", "change-capability-anchors");
  fs.mkdirSync(indexDir, { recursive: true });
  fs.writeFileSync(path.join(indexDir, "obligation-atom-index.md"), atomIndexFromRows(change, rows));
  if (authorityMode === "legacy") {
    return;
  }

  const workDir = path.join(root, "openspec", "orchestrate", "phase-works", "phase-5");
  const traceDir = path.join(root, "openspec", "orchestrate", "trace");
  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(traceDir, { recursive: true });

  const globalIndexPath = path.join(indexDir, "obligation-atom-index.json");
  const mappingPath = path.join(workDir, "atom-plan-mapping.json");
  const packetIndexPath = path.join(workDir, "final-packet-index.json");
  const phase5TracePath = path.join(traceDir, "phase-5.trace.json");
  writeJson(globalIndexPath, globalAtomIndexJson(change, rows));
  writeJson(mappingPath, atomPlanMappingJson(change, rows));
  writeJson(packetIndexPath, finalPacketIndexJson(root, change, rows, packetPath));
  writeJson(phase5TracePath, phase5TraceJson());
  writeJson(
    path.join(traceDir, "manifest.json"),
    sourceAlignedManifest(root, [globalIndexPath, mappingPath, packetIndexPath, phase5TracePath]),
  );
}

function writeJson(fullPath, value) {
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`);
}

function globalAtomIndexJson(change, rows) {
  return {
    "trace-schema": "source-aligned-global-atom-index-v1",
    "trace-contract-version": "source-aligned-trace-v1",
    "global-atoms": rows.map((row) => ({
      "global-atom-id": row["global-atom-id"],
      "source-document": row["source-document"],
      lines: row.lines,
      "line-ranges": [{ start: 1, end: 2 }],
      "atom-type": row["atom-type"],
      "source-fact": row["source-fact"],
      normativity: row.normativity,
      "coverage-status": "direct",
      "artifact-projection": row["artifact-projection"],
      "owner-change": change,
      "owner-capability": row["owner-capability"],
      "atom-relation": row["atom-relation"],
      "propose-use": row["propose-use"],
      "evidence-need": row["evidence-need"],
      origins: ["source.origin"],
    })),
  };
}

function atomPlanMappingJson(change, rows) {
  return {
    "trace-schema": "source-aligned-atom-plan-mapping-v1",
    "trace-contract-version": "source-aligned-trace-v1",
    rows: rows.map((row) => ({
      "global-atom-id": row["global-atom-id"],
      "source-document": row["source-document"],
      lines: row.lines,
      "line-ranges": [{ start: 1, end: 2 }],
      "final-owner-change": change,
      "final-owner-capability": row["owner-capability"],
      "final-artifact-projection": row["artifact-projection"],
      "final-relation": "direct",
      "plan-decision": "keep",
      reason: "测试映射。",
    })),
  };
}

function finalPacketIndexJson(root, change, rows, packetPath) {
  return {
    "trace-schema": "source-aligned-final-packet-index-v1",
    "trace-contract-version": "source-aligned-trace-v1",
    packets: [
      {
        change,
        "packet-path": path.relative(root, packetPath).split(path.sep).join("/"),
        "packet-digest": sha256File(packetPath),
        "direct-atom-ids": rows.map((row) => row["global-atom-id"]),
        "owner-scoped-non-direct-atom-ids": [],
        "capability-view-paths": [],
      },
    ],
  };
}

function phase5TraceJson() {
  return {
    "trace-schema": "source-aligned-phase-5-trace-v1",
    "trace-contract-version": "source-aligned-trace-v1",
    status: "accepted",
  };
}

function sourceAlignedManifest(root, tracePaths) {
  return {
    "trace-schema": "source-aligned-orchestrate-manifest-v1",
    "trace-contract-version": "source-aligned-trace-v1",
    "orchestrate-dir": "openspec/orchestrate",
    "phase-statuses": {
      "phase-5": "accepted",
    },
    artifacts: tracePaths.map((fullPath) => ({
      "artifact-path": path.relative(root, fullPath).split(path.sep).join("/"),
      "trace-path": path.relative(root, fullPath).split(path.sep).join("/"),
      "trace-schema": JSON.parse(fs.readFileSync(fullPath, "utf8"))["trace-schema"],
      sha256: sha256File(fullPath),
      phase: "phase-5",
      role: "test",
    })),
  };
}

function finalPacketFromRows(change, rows) {
  return `# Final Change Packet: \`${change}\`

## Final Direct Owner Atoms

| Global Atom ID | Source Document | Lines | Atom Type | Source Fact | Normativity | Artifact Projection | Projection Rationale | Owner Capability | Atom Relation | Roles | Propose Use | Evidence Need |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| ${cell(row["global-atom-id"])} | ${cell(row["source-document"])} | ${cell(row.lines)} | ${cell(row["atom-type"])} | ${cell(row["source-fact"])} | ${cell(row.normativity)} | ${cell(row["artifact-projection"])} | 测试 projection。 | ${cell(row["owner-capability"])} | ${cell(row["atom-relation"])} | ${cell(row.roles)} | ${cell(row["propose-use"])} | ${cell(row["evidence-need"])} |`).join("\n")}

## Contextual Atoms And Future Constraints

| Global Atom ID / Relation | Source Document | Lines | Context Type | Final Capability | Affects Current Design Because | Handling |
| --- | --- | --- | --- | --- | --- | --- |
`;
}

function atomIndexFromRows(change, rows) {
  return `# Phase 3 Normalized Global Obligation Atom Index

| Global Atom ID | Source Document | Lines | Atom Type | Source Fact | Normativity | Coverage Status | Artifact Projection | Owner Change | Owner Capability | Source Atom Origins | Atom Relation | Propose Use | Evidence Need | Review Judgment |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| ${cell(row["global-atom-id"])} | ${cell(row["source-document"])} | ${cell(row.lines)} | ${cell(row["atom-type"])} | ${cell(row["source-fact"])} | ${cell(row.normativity)} | direct | ${cell(row["artifact-projection"])} | ${change} | ${cell(row["owner-capability"])} | source.origin | ${cell(row["atom-relation"])} | ${cell(row["propose-use"])} | ${cell(row["evidence-need"])} | 测试 judgment。 |`).join("\n")}
`;
}

function cell(value) {
  return String(value ?? "").replaceAll("|", "\\|");
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
