#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RENDER_CONTRACT_VERSION = "trace-render-v1";
export const TRACE_CONTRACT_VERSION = "verification-inline-proof-slices-v1";
export const LEGACY_TRACE_CONTRACT_VERSION = "proof-slices-v1";
export const TRACE_SCHEMA = "openspec-trace-v1";
export const PROOF_SLICES_TRACE_SCHEMA = "openspec-proof-slices-v1";
export const PROOF_SLICES_TRACE_PATH = "trace/verification.proof-slices.json";
export const VERIFICATION_TRACE_PATH = "trace/verification.trace.json";
export const INLINE_PROOF_SLICES_MODEL_PATH = `${VERIFICATION_TRACE_PATH}#/proof-slice-model`;
export const NO_DELTA_SPECS_ARTIFACT_PATH = "specs/no-spec-delta/README.md";
export const NO_DELTA_SPECS_COMPLETION_MODE = "no-delta";

export class RenderContractError extends Error {
  constructor(ruleId, file, message) {
    super(`${ruleId}: ${message}`);
    this.name = "RenderContractError";
    this.ruleId = ruleId;
    this.file = file;
  }
}

export function renderChangeArtifact(options = {}) {
  const root = options.root ?? process.cwd();
  const change = options.change;
  const artifact = options.artifact;
  if (!change) {
    throw new Error("renderChangeArtifact requires a change slug");
  }
  if (!artifact) {
    throw new Error("renderChangeArtifact requires an artifact id");
  }

  const changeDir = path.join(root, "openspec", "changes", change);
  const artifactPath = artifactPathForRequest(artifact, options);
  const tracePath = tracePathForArtifactPath(artifactPath);
  const traceFullPath = path.join(changeDir, tracePath);
  const trace = readJson(traceFullPath);
  const manifestPath = path.join(changeDir, "trace", "manifest.json");
  const traceContractVersion = fs.existsSync(manifestPath)
    ? strip(readJson(manifestPath)["trace-contract-version"])
    : "";
  const proofSlicesTrace =
    artifact === "verification"
      ? resolveVerificationProofSliceModel({
          trace,
          changeDir,
          allowLegacySidecar: traceContractVersion === LEGACY_TRACE_CONTRACT_VERSION,
        })
      : null;
  const markdown = renderArtifactMarkdown({
    trace,
    proofSlicesTrace,
    tracePath,
  });

  if (options.write) {
    const artifactFullPath = path.join(changeDir, artifactPath);
    fs.mkdirSync(path.dirname(artifactFullPath), { recursive: true });
    fs.writeFileSync(artifactFullPath, markdown);
    updateManifest(changeDir, {
      artifactPath,
      tracePath,
      trace,
      proofSlicesTrace: artifact === "verification" ? proofSlicesTrace : null,
    });
  }

  return {
    artifactPath,
    tracePath,
    markdown,
  };
}

export function renderArtifactMarkdown(options = {}) {
  const trace = options.trace;
  if (!trace || typeof trace !== "object" || Array.isArray(trace)) {
    throw new RenderContractError("VAL-RENDER-002", "trace", "renderer 输入必须包含 trace object。");
  }
  const tracePath = options.tracePath ?? tracePathForArtifactPath(strip(trace["artifact-path"]));
  const body = renderDeliveryBody(trace, options.proofSlicesTrace);
  return `${body.trimEnd()}\n\n## Trace Appendix\n\nTrace file: \`${tracePath}\`\nTrace schema: \`${TRACE_SCHEMA}\`\n`;
}

export function renderDeliveryBody(trace, proofSlicesTrace = null) {
  const artifactId = strip(trace["artifact-id"]);
  const delivery = trace["delivery-plane"];
  if (!delivery || typeof delivery !== "object" || Array.isArray(delivery)) {
    throw new RenderContractError(
      "VAL-RENDER-002",
      tracePathForArtifactPath(strip(trace["artifact-path"])),
      `${artifactId || "artifact"} 缺少 delivery-plane render payload。`,
    );
  }
  if (artifactId === "proposal") {
    return renderProposalDelivery(delivery);
  }
  if (artifactId === "specs") {
    return renderSpecsDelivery(delivery);
  }
  if (artifactId === "design") {
    return renderDesignDelivery(delivery, trace);
  }
  if (artifactId === "runtime-acceptance") {
    return renderRuntimeDelivery(delivery, trace);
  }
  if (artifactId === "verification") {
    return renderVerificationDelivery(trace, proofSlicesTrace);
  }
  if (artifactId === "tasks") {
    return renderTasksDelivery(delivery);
  }
  throw new RenderContractError(
    "VAL-RENDER-002",
    tracePathForArtifactPath(strip(trace["artifact-path"])),
    `${artifactId || "artifact"} 的 delivery-plane render payload 不受支持。`,
  );
}

function renderProposalDelivery(delivery) {
  const capabilities = asObject(delivery.capabilities);
  return [
    renderSection("Why", requireText(delivery.why, "proposal.delivery-plane.why")),
    renderSection("Change Plan Boundary", requireText(delivery["change-plan-boundary"], "proposal.delivery-plane.change-plan-boundary")),
    renderSection("What Changes", requireText(delivery["what-changes"], "proposal.delivery-plane.what-changes")),
    [
      "## Capabilities",
      "",
      "### New Capabilities",
      "",
      renderCapabilityList(capabilities["new-capabilities"]),
      "",
      "### Modified Capabilities",
      "",
      renderCapabilityList(capabilities["modified-capabilities"]),
      "",
      "",
    ].join("\n"),
    renderSection("Non-Goals", requireText(delivery["non-goals"], "proposal.delivery-plane.non-goals")),
    renderSection("Impact", requireText(delivery.impact, "proposal.delivery-plane.impact")),
    renderSection("Rollout / Readiness", requireText(delivery["rollout-readiness"], "proposal.delivery-plane.rollout-readiness")),
  ].join("");
}

function renderSpecsDelivery(delivery) {
  if (strip(delivery["completion-mode"]) === NO_DELTA_SPECS_COMPLETION_MODE) {
    return renderNoDeltaSpecsDelivery(delivery);
  }
  const sections = [
    ["ADDED Requirements", delivery["added-requirements"], renderRequirement],
    ["MODIFIED Requirements", delivery["modified-requirements"], renderRequirement],
    ["REMOVED Requirements", delivery["removed-requirements"], renderRemovedRequirement],
    ["RENAMED Requirements", delivery["renamed-requirements"], renderRenamedRequirement],
  ];
  const populated = sections.filter(([, requirements]) => asArray(requirements).length > 0);
  if (populated.length === 0) {
    throw new RenderContractError("VAL-RENDER-002", "specs delivery-plane", "normal specs delta 至少需要一个非空 requirements section。");
  }
  let output = "";
  for (const [heading, requirements, renderer] of sections) {
    const rows = asArray(requirements);
    if (rows.length === 0) {
      continue;
    }
    output += `## ${heading}\n\n${rows.map(renderer).join("\n")}`;
  }
  return output;
}

function renderNoDeltaSpecsDelivery(delivery) {
  return [
    renderSection("No Spec Delta", requireText(delivery.summary, "specs.delivery-plane.summary")),
    renderSection("Projection Closure", requireText(delivery["projection-closure"], "specs.delivery-plane.projection-closure")),
  ].join("");
}

function renderRequirement(requirement) {
  const row = asObject(requirement);
  const name = requireScalar(row.name, "specs.requirements[].name");
  const body = renderBlockText(requireText(row.body, `specs.requirements[${name}].body`));
  const scenarios = asArray(row.scenarios);
  if (scenarios.length === 0) {
    throw new RenderContractError("VAL-RENDER-002", "specs delivery-plane", `${name} 缺少 scenarios payload。`);
  }
  return `### Requirement: ${name}\n\n${body}\n\n${scenarios.map((scenario) => renderScenario(name, scenario)).join("\n")}\n`;
}

function renderRemovedRequirement(requirement) {
  const row = asObject(requirement);
  const name = requireScalar(row.name, "specs.removed-requirements[].name");
  const reason = renderBlockText(requireText(row.reason, `specs.removed-requirements[${name}].reason`));
  const migration = renderBlockText(requireText(row.migration, `specs.removed-requirements[${name}].migration`));
  return `### Requirement: ${name}\n\nReason:\n\n${reason}\n\nMigration:\n\n${migration}\n`;
}

function renderRenamedRequirement(requirement) {
  const row = asObject(requirement);
  const from = requireScalar(row.from, "specs.renamed-requirements[].from");
  const to = requireScalar(row.to, "specs.renamed-requirements[].to");
  return `### Requirement Rename\n\nFROM: ${from}\nTO: ${to}\n`;
}

function renderScenario(requirementName, scenario) {
  const row = asObject(scenario);
  const name = requireScalar(row.name, `specs.requirements[${requirementName}].scenarios[].name`);
  if (row.body) {
    return `#### Scenario: ${name}\n\n${renderBlockText(row.body)}\n`;
  }
  const lines = [];
  if (row.given) lines.push(`- GIVEN ${strip(row.given)}`);
  if (row.when) lines.push(`- WHEN ${strip(row.when)}`);
  if (row.then) lines.push(`- THEN ${strip(row.then)}`);
  if (lines.length === 0) {
    throw new RenderContractError("VAL-RENDER-002", "specs delivery-plane", `${requirementName} / ${name} 缺少 scenario body。`);
  }
  return `#### Scenario: ${name}\n\n${lines.join("\n")}\n`;
}

function renderDesignDelivery(delivery, trace) {
  const designRows = asArray(trace["implementation-design-register"]).map((row) => asObject(row));
  const designRowsById = new Map(
    designRows
      .map((row) => [strip(row["implementation-design-id"]), row])
      .filter(([id]) => Boolean(id)),
  );
  return [
    renderSection("Context", requireText(delivery.context, "design.delivery-plane.context")),
    renderSection("Goals / Non-Goals", requireText(delivery["goals-non-goals"], "design.delivery-plane.goals-non-goals")),
    renderDesignDecisions(delivery.decisions, designRowsById),
    renderSection("Risks / Trade-offs", requireText(delivery["risks-trade-offs"], "design.delivery-plane.risks-trade-offs")),
    renderSection("Open Questions", requireText(delivery["open-questions"], "design.delivery-plane.open-questions")),
    renderImplementationDetails(delivery["detail-render-order"], designRows),
  ].join("");
}

function renderDesignDecisions(decisions, designRowsById) {
  const rows = asArray(decisions);
  if (rows.length === 0) {
    throw new RenderContractError("VAL-RENDER-002", "design delivery-plane", "design decisions payload 不能为空。");
  }
  const body = rows
    .map((decision) => {
      const row = asObject(decision);
      const id = requireScalar(row["decision-id"], "design.decisions[].decision-id");
      const designRow = designRowsById.get(id);
      if (!designRow) {
        throw new RenderContractError("VAL-RENDER-002", "design delivery-plane", `design.decisions[${id}] 缺少 implementation-design-register row。`);
      }
      const title = requireScalar(designRow.title, `implementation-design-register[${id}].title`);
      return [
        `### ${id} ${title}`,
        "",
        renderBlockText(requireText(designRow.decision, `implementation-design-register[${id}].decision`)),
      ].join("\n");
    })
    .join("\n\n");
  return `## Decisions\n\n${body}\n\n`;
}

function renderImplementationDetails(renderOrder, designRows) {
  const detailsByType = new Map();
  for (const designRow of designRows) {
    for (const detail of asArray(designRow["implementation-details"])) {
      const detailRow = asObject(detail);
      const detailType = strip(detailRow["detail-type"]);
      if (!detailType) continue;
      if (!detailsByType.has(detailType)) detailsByType.set(detailType, []);
      detailsByType.get(detailType).push(detailRow);
    }
  }

  const orderedTypes = asArray(renderOrder).map(strip).filter(Boolean);
  if (orderedTypes.length === 0) {
    throw new RenderContractError("VAL-RENDER-002", "design.delivery-plane.detail-render-order", "detail-render-order 不能为空。");
  }

  const sections = [];
  for (const detailType of orderedTypes) {
    const details = detailsByType.get(detailType) ?? [];
    if (details.length === 0) continue;
    const body = details
      .map((detail) => renderBlockText(requireText(detail.content, `implementation-details[${detailType}].content`)))
      .join("\n\n");
    sections.push(`### ${titleizeDetailType(detailType)}\n\n${body}`);
  }

  if (sections.length === 0) {
    throw new RenderContractError("VAL-RENDER-002", "implementation-design-register[].implementation-details", "implementation details 不能为空。");
  }
  return `## Implementation Details\n\n${sections.join("\n\n")}\n\n`;
}

function titleizeDetailType(value) {
  return strip(value)
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

const RUNTIME_TABLES = [
  {
    section: "surface-rows",
    heading: "Runtime Surface Inventory",
    idField: "surface-id",
    columns: [
      ["Surface ID", "surface-id"],
      ["Surface Type", "surface-type"],
      ["Owner Candidate", "owner-candidate"],
      ["Entry Point", "entry-point"],
      ["Runtime Obligation", "runtime-obligation"],
      ["Observable Fact", "observable-fact"],
      ["Default Path Policy", "default-path-policy"],
      ["External Boundary", "external-boundary"],
      ["Source Basis", "source-basis"],
      ["Projection Type", "projection-type"],
      ["Scope Role", "scope-role"],
      ["No-Scope-Expansion Check", "no-scope-expansion-check"],
    ],
  },
  {
    section: "operation-rows",
    heading: "Operation Coverage Matrix",
    idField: "operation-id",
    columns: [
      ["Operation ID", "operation-id"],
      ["Owner Candidate", "owner-candidate"],
      ["Trigger", "trigger"],
      ["Control / Route", "control-route"],
      ["Request / Action", "request-action"],
      ["Runtime Obligation", "runtime-obligation"],
      ["Expected Rendered UI Update", "expected-rendered-ui-update"],
      ["API/Data Assertion", "api-data-assertion"],
      ["Reload/Persistence Assertion", "reload-persistence-assertion"],
      ["Disabled/Failure/Recovery Branches", "disabled-failure-recovery-branches"],
      ["Default Path Policy", "default-path-policy"],
      ["External Boundary", "external-boundary"],
      ["Source Basis", "source-basis"],
      ["Projection Type", "projection-type"],
      ["Scope Role", "scope-role"],
      ["No-Scope-Expansion Check", "no-scope-expansion-check"],
    ],
  },
  {
    section: "state-rows",
    heading: "State / Branch Coverage Matrix",
    idField: "state-id",
    columns: [
      ["State ID", "state-id"],
      ["Owner Candidate", "owner-candidate"],
      ["State / Branch", "state-branch"],
      ["Trigger Into", "trigger-into"],
      ["Runtime Obligation", "runtime-obligation"],
      ["Observable UI / API Outcome", "observable-ui-api-outcome"],
      ["Data/Event Facts", "data-event-facts"],
      ["Allowed Next States", "allowed-next-states"],
      ["Terminal?", "terminal"],
      ["Default Path Policy", "default-path-policy"],
      ["External Boundary", "external-boundary"],
      ["Source Basis", "source-basis"],
      ["Projection Type", "projection-type"],
      ["Scope Role", "scope-role"],
      ["No-Scope-Expansion Check", "no-scope-expansion-check"],
    ],
  },
  {
    section: "chain-rows",
    heading: "Async / Realtime Chain Matrix",
    idField: "chain-id",
    columns: [
      ["Chain ID", "chain-id"],
      ["Owner Candidate", "owner-candidate"],
      ["User/System Entry", "user-system-entry"],
      ["Enqueue / Dispatch Fact", "enqueue-dispatch-fact"],
      ["Worker / Consumer Fact", "worker-consumer-fact"],
      ["Domain Mutation", "domain-mutation"],
      ["Event / Outbox Fact", "event-outbox-fact"],
      ["Client Subscription / Readback", "client-subscription-readback"],
      ["Rendered Terminal State", "rendered-terminal-state"],
      ["Failure Variant", "failure-variant"],
      ["Runtime Obligation", "runtime-obligation"],
      ["Default Path Policy", "default-path-policy"],
      ["External Boundary", "external-boundary"],
      ["Source Basis", "source-basis"],
      ["Projection Type", "projection-type"],
      ["Scope Role", "scope-role"],
      ["No-Scope-Expansion Check", "no-scope-expansion-check"],
    ],
  },
];

function renderRuntimeDelivery(delivery, trace) {
  const canonicalIndex = asObject(trace["canonical-row-index"]);
  const canonicalRows = collectCanonicalRuntimeRows(delivery["canonical-rows"]);
  validateRuntimeDeliveryModel(canonicalRows, canonicalIndex);
  let output = `## Runtime Acceptance Intent\n\n${renderIntentList(delivery["runtime-acceptance-intent"], [
    ["Scope", "scope"],
    ["Source basis", "source-basis"],
    ["Out of scope", "out-of-scope"],
  ])}\n\n`;
  for (const table of RUNTIME_TABLES) {
    const ids = asArray(canonicalIndex[table.section]).map(strip).filter(Boolean);
    const rows = ids.map((id) => {
      const row = asObject(canonicalRows.byId[id]);
      if (strip(row[table.idField]) !== id) {
        throw new RenderContractError("VAL-RENDER-002", "runtime delivery-plane", `${id} 缺少 canonical row fields。`);
      }
      return row;
    });
    output += renderMarkdownTable(table.heading, table.columns, rows);
  }
  return output;
}

function collectCanonicalRuntimeRows(value) {
  const rows = new Map();
  const ids = [];
  const duplicates = [];
  if (Array.isArray(value)) {
    for (const rowValue of value) {
      const row = asObject(rowValue);
      const id = strip(row.id ?? row["surface-id"] ?? row["operation-id"] ?? row["state-id"] ?? row["chain-id"]);
      if (!id) continue;
      if (rows.has(id)) duplicates.push(id);
      rows.set(id, row);
      ids.push(id);
    }
  } else {
    for (const [id, rowValue] of Object.entries(asObject(value))) {
      if (rows.has(id)) duplicates.push(id);
      rows.set(id, asObject(rowValue));
      ids.push(id);
    }
  }
  return { byId: Object.fromEntries(rows), ids, duplicates };
}

function validateRuntimeDeliveryModel(canonicalRows, canonicalIndex) {
  if (canonicalRows.duplicates.length > 0) {
    throw new RenderContractError(
      "VAL-RENDER-002",
      "runtime delivery-plane",
      `canonical runtime row 重复：${unique(canonicalRows.duplicates).join(", ")}。`,
    );
  }

  const indexedIds = [];
  const seenIndexIds = new Set();
  const duplicateIndexIds = [];
  for (const table of RUNTIME_TABLES) {
    const sectionIds = asArray(canonicalIndex[table.section]).map(strip).filter(Boolean);
    if (!Array.isArray(canonicalIndex[table.section])) {
      throw new RenderContractError("VAL-RENDER-002", "runtime canonical-row-index", `${table.section} 必须是数组。`);
    }
    for (const id of sectionIds) {
      indexedIds.push(id);
      if (seenIndexIds.has(id)) duplicateIndexIds.push(id);
      seenIndexIds.add(id);
      if (!runtimeIdBelongsToTable(id, table)) {
        throw new RenderContractError("VAL-RENDER-002", "runtime canonical-row-index", `${id} 不属于 ${table.section}。`);
      }
      const row = asObject(canonicalRows.byId[id]);
      if (!Object.keys(row).length) {
        throw new RenderContractError("VAL-RENDER-002", "runtime canonical-row-index", `${id} 缺少 canonical row。`);
      }
      validateRuntimeRowFields(id, row, table);
    }
  }

  if (duplicateIndexIds.length > 0) {
    throw new RenderContractError(
      "VAL-RENDER-002",
      "runtime canonical-row-index",
      `canonical-row-index 重复引用：${unique(duplicateIndexIds).join(", ")}。`,
    );
  }

  const canonicalIdSet = new Set(canonicalRows.ids);
  const indexedIdSet = new Set(indexedIds);
  const missingFromIndex = [...canonicalIdSet].filter((id) => !indexedIdSet.has(id));
  const extraInIndex = [...indexedIdSet].filter((id) => !canonicalIdSet.has(id));
  if (missingFromIndex.length > 0 || extraInIndex.length > 0) {
    const parts = [];
    if (missingFromIndex.length > 0) parts.push(`未入 index：${missingFromIndex.join(", ")}`);
    if (extraInIndex.length > 0) parts.push(`index 未定义：${extraInIndex.join(", ")}`);
    throw new RenderContractError("VAL-RENDER-002", "runtime canonical-row-index", `canonical rows 与 index 不一致；${parts.join("；")}。`);
  }
}

function validateRuntimeRowFields(id, row, table) {
  if (strip(row[table.idField]) !== id) {
    throw new RenderContractError("VAL-RENDER-002", "runtime delivery-plane", `${id} 缺少 ${table.idField}。`);
  }
  for (const [, key] of table.columns) {
    if (!strip(row[key])) {
      throw new RenderContractError("VAL-RENDER-002", "runtime delivery-plane", `${id} 缺少 ${key}。`);
    }
  }
  const owner = strip(row["owner-candidate"]);
  if (/[,，;+、]|(?:^|\s)(?:and|和|与)(?:\s|$)/iu.test(owner)) {
    throw new RenderContractError("VAL-RENDER-002", "runtime delivery-plane", `${id} Owner Candidate 必须是单一 advisory owner。`);
  }
}

function runtimeIdBelongsToTable(id, table) {
  if (table.section === "surface-rows") return /^RS-\d{3}$/u.test(id);
  if (table.section === "operation-rows") return /^OP-\d{3}$/u.test(id);
  if (table.section === "state-rows") return /^ST-\d{3}$/u.test(id);
  if (table.section === "chain-rows") return /^CH-\d{3}$/u.test(id);
  return false;
}

function renderVerificationDelivery(trace, proofSlicesTrace) {
  const delivery = trace["delivery-plane"];
  const proofModel = resolveVerificationProofSliceModel({ trace, proofSlicesTrace });
  validateVerificationProofSlicesForRender(proofModel);
  const proofRows = asArray(proofModel["proof-slices"]).map((slice) => {
      const runtimeRows = asArray(slice["runtime-row-ids"]).join(", ");
      return `| ${cell(slice["slice-id"])} | ${cell(runtimeRows)} | ${cell(slice["primary-runtime-row-id"])} | ${cell(slice["primitive-type"])} | ${cell(slice["branch-variant"])} | ${cell(slice["observable-surface"])} | ${cell(slice["oracle-fragment"])} | ${cell(slice["failure-signal"])} | ${cell(slice["primary-layer"])} | ${cell(slice["production-owner"])} | ${cell(slice["persistent-test-required"])} | ${cell(slice["proof-evidence-mode"])} | ${cell(slice["primary-assertion-shape"])} | ${cell(slice["fixture-mock-boundary"])} | ${cell(slice["regression-intent"])} | ${cell(slice["manual-environment-gate"])} |`;
  });
  const placementRows = asArray(proofModel["proof-slices"]).map((slice) => {
    const placement = asObject(asObject(slice["test-contract"]).placement);
    return `| ${cell(slice["slice-id"])} | ${cell(slice["persistent-test-required"])} | ${cell(slice["proof-evidence-mode"])} | ${cell(placement["planned-test-directory"])} | ${cell(placement["placement-basis"])} | ${cell(placement["placement-reason"])} |`;
  });
  return `## Verification Intent

${renderIntentList(delivery["verification-intent"], [
    ["Scope", "scope"],
    ["Runtime source", "runtime-source"],
    ["Out of scope", "out-of-scope"],
  ])}

## Proof Slice Matrix

| Slice ID | Runtime Row IDs | Primary Runtime Row ID | Primitive Type | Branch / Variant | Observable Surface | Oracle Fragment | Failure Signal | Primary Layer | Production Owner | Persistent Test Required | Proof Evidence Mode | Primary Assertion Shape | Fixture / Mock Boundary | Regression Intent | Manual / Environment Gate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${proofRows.join("\n")}

## Planned Test Placement Matrix

| Slice ID | Persistent Test Required | Proof Evidence Mode | Planned Test Directory | Placement Basis | Placement Reason |
| --- | --- | --- | --- | --- | --- |
${placementRows.join("\n")}

## Layer / Harness / Fixture Notes

${renderMarkdownTableLines([
    "Slice ID Set",
    "Layer Reason",
    "Harness Expectation",
    "Mock / Fixture Boundary",
    "Omitted Stable Layers / Reason",
  ], asArray(delivery["layer-harness-fixture-notes"]), [
    "slice-id-set",
    "layer-reason",
    "harness-expectation",
    "mock-fixture-boundary",
    "omitted-stable-layers-reason",
  ])}

## Do Not Test

${renderMarkdownTableLines([
    "Item",
    "Reason",
    "Runtime Row IDs",
  ], asArray(delivery["do-not-test"]), [
    "item",
    "reason",
    "runtime-row-ids",
  ])}
`;
}

function validateVerificationProofSlicesForRender(proofSlicesTrace) {
  if (proofSlicesTrace["trace-schema"] !== PROOF_SLICES_TRACE_SCHEMA) {
    throw new RenderContractError(
      "VAL-RENDER-002",
      proofSliceModelSource(proofSlicesTrace),
      `verification proof-slices trace-schema 必须为 ${PROOF_SLICES_TRACE_SCHEMA}。`,
    );
  }
  if (proofSlicesTrace["artifact-id"] !== "verification" || proofSlicesTrace["artifact-path"] !== "verification.md") {
    throw new RenderContractError(
      "VAL-RENDER-002",
      proofSliceModelSource(proofSlicesTrace),
      "verification proof-slices artifact-id/path 必须为 verification / verification.md。",
    );
  }
  const rows = asArray(proofSlicesTrace["proof-slices"]);
  if (rows.length === 0) {
    throw new RenderContractError("VAL-RENDER-002", proofSliceModelSource(proofSlicesTrace), "verification proof-slices 不能为空。");
  }
  for (const [index, slice] of rows.entries()) {
    const ref = `${proofSliceModelSource(proofSlicesTrace)}/proof-slices/${index}`;
    const sliceId = strip(slice?.["slice-id"]) || `(index ${index})`;
    const contract = asObject(slice?.["test-contract"]);
    const placement = contract.placement;
    if (!placement || typeof placement !== "object" || Array.isArray(placement)) {
      throw new RenderContractError("VAL-RENDER-002", ref, `${sliceId} 缺少 test-contract.placement。`);
    }
    for (const field of ["planned-test-directory", "placement-basis", "placement-reason"]) {
      if (!strip(placement[field])) {
        throw new RenderContractError("VAL-RENDER-002", ref, `${sliceId} test-contract.placement 缺少 ${field}。`);
      }
    }
  }
}

export function resolveVerificationProofSliceModel(options = {}) {
  const trace = options.trace;
  if (!trace || typeof trace !== "object" || Array.isArray(trace)) {
    throw new RenderContractError("VAL-RENDER-002", "trace", "verification renderer 缺少 trace object。");
  }
  const inlineModel = trace["proof-slice-model"];
  if (inlineModel && typeof inlineModel === "object" && !Array.isArray(inlineModel)) {
    return normalizeProofSliceModel(inlineModel, trace, INLINE_PROOF_SLICES_MODEL_PATH);
  }
  if (options.proofSlicesTrace) {
    return normalizeProofSliceModel(options.proofSlicesTrace, trace, PROOF_SLICES_TRACE_PATH);
  }
  if (options.allowLegacySidecar && options.changeDir) {
    const sidecarPath = path.join(options.changeDir, PROOF_SLICES_TRACE_PATH);
    if (fs.existsSync(sidecarPath)) {
      return normalizeProofSliceModel(readJson(sidecarPath), trace, PROOF_SLICES_TRACE_PATH);
    }
  }
  throw new RenderContractError(
    "VAL-RENDER-002",
    INLINE_PROOF_SLICES_MODEL_PATH,
    "verification renderer 缺少 proof-slice-model。",
  );
}

function normalizeProofSliceModel(model, trace, sourcePath) {
  const normalized = {
    "trace-schema": model["trace-schema"] ?? model["model-schema"],
    "artifact-id": model["artifact-id"] ?? trace["artifact-id"],
    "artifact-path": model["artifact-path"] ?? trace["artifact-path"],
    "change-name": model["change-name"] ?? trace["change-name"],
    "schema-name": model["schema-name"] ?? trace["schema-name"],
    "source-interface": model["source-interface"] ?? trace["source-interface"],
    "proof-slice-summary": model["proof-slice-summary"],
    "proof-slices": model["proof-slices"],
  };
  Object.defineProperty(normalized, "source-path", {
    value: sourcePath,
    enumerable: false,
  });
  return normalized;
}

function proofSliceModelSource(proofSlicesTrace) {
  return strip(proofSlicesTrace?.["source-path"]) || PROOF_SLICES_TRACE_PATH;
}

function renderTasksDelivery(delivery) {
  const slices = asArray(delivery["acceptance-slices"]);
  if (slices.length === 0) {
    throw new RenderContractError("VAL-RENDER-002", "tasks delivery-plane", "tasks 缺少 acceptance-slices payload。");
  }
  return slices.map(renderAcceptanceSlice).join("\n");
}

function renderAcceptanceSlice(slice) {
  const row = asObject(slice);
  const acId = requireScalar(row["ac-id"], "tasks.acceptance-slices[].ac-id");
  const title = requireScalar(row.title, `tasks.acceptance-slices[${acId}].title`);
  const contractRows = asArray(row["resolved-runtime-contract"]);
  const tasks = asArray(row.tasks);
  if (contractRows.length === 0) {
    throw new RenderContractError("VAL-RENDER-002", "tasks delivery-plane", `${acId} 缺少 resolved-runtime-contract。`);
  }
  if (tasks.length === 0) {
    throw new RenderContractError("VAL-RENDER-002", "tasks delivery-plane", `${acId} 缺少 checkbox tasks。`);
  }
  return [
    `## ${acId} ${title}`,
    "",
    "Outcome:",
    "",
    renderText(requireText(row.outcome, `tasks.acceptance-slices[${acId}].outcome`)),
    "",
    "Start Gate:",
    "",
    renderText(requireText(row["start-gate"], `tasks.acceptance-slices[${acId}].start-gate`)),
    "",
    "Runtime Rows:",
    "",
    renderRuntimeRowsList(row["runtime-rows"]),
    "",
    "Resolved Runtime Contract:",
    "",
    renderTableOnly(
      [
        ["Row", "row"],
        ["Worker-facing obligation", "worker-facing-obligation"],
        ["Observable proof", "observable-proof"],
        ["Default / no-scope boundary", "default-no-scope-boundary"],
      ],
      contractRows,
    ),
    "",
    "Implementation Scope:",
    "",
    renderText(requireText(row["implementation-scope"], `tasks.acceptance-slices[${acId}].implementation-scope`)),
    "",
    "Preserve:",
    "",
    renderText(requireText(row.preserve, `tasks.acceptance-slices[${acId}].preserve`)),
    "",
    "Proof Contract:",
    "",
    renderText(requireText(row["proof-contract"], `tasks.acceptance-slices[${acId}].proof-contract`)),
    "",
    tasks.map((task) => renderTaskBlock(acId, task)).join("\n"),
    "",
  ].join("\n");
}

function renderTaskBlock(acId, task) {
  const row = asObject(task);
  const taskId = requireScalar(row["task-id"], `tasks.acceptance-slices[${acId}].tasks[].task-id`);
  return [
    `- [ ] ${taskId} ${requireScalar(row.title, `tasks.acceptance-slices[${acId}].tasks[${taskId}].title`)}`,
    `      Runtime Rows: ${renderInlineList(row["runtime-rows"])}`,
    `      Acceptance: ${requireScalar(row.acceptance, `tasks.acceptance-slices[${acId}].tasks[${taskId}].acceptance`)}`,
    `      Preserve: ${requireScalar(row.preserve, `tasks.acceptance-slices[${acId}].tasks[${taskId}].preserve`)}`,
    `      Proof: ${requireScalar(row.proof, `tasks.acceptance-slices[${acId}].tasks[${taskId}].proof`)}`,
    `      Mock / Default Path Policy: ${requireScalar(row["mock-default-path-policy"], `tasks.acceptance-slices[${acId}].tasks[${taskId}].mock-default-path-policy`)}`,
  ].join("\n");
}

function renderSection(heading, body) {
  return `## ${heading}\n\n${renderBlockText(body)}\n\n`;
}

function renderText(value) {
  if (Array.isArray(value)) {
    return value.map((line) => String(line)).join("\n").trimEnd();
  }
  return String(value ?? "").trimEnd();
}

function renderBlockText(value) {
  return renderText(value);
}

function renderLabeledBlock(label, value, ref) {
  return `${label}:\n\n${renderBlockText(requireText(value, ref))}`;
}

function requireText(value, ref) {
  if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
    throw new RenderContractError("VAL-RENDER-002", ref, `${ref} 缺少 render payload。`);
  }
  const text = renderText(value);
  if (!text) {
    throw new RenderContractError("VAL-RENDER-002", ref, `${ref} 缺少 render payload。`);
  }
  return value;
}

function renderCapabilityList(value) {
  const rows = asArray(value);
  if (rows.length === 0) {
    return "- 无";
  }
  return rows
    .map((item) => {
      if (typeof item === "string") {
        return item.trim().startsWith("- ") ? item.trim() : `- ${item}`;
      }
      const row = asObject(item);
      return `- ${requireScalar(row.name, "proposal.capabilities[].name")}: ${requireScalar(row.summary, "proposal.capabilities[].summary")}`;
    })
    .join("\n");
}

function renderIntentList(value, fields) {
  const row = asObject(value);
  return fields.map(([label, key]) => `- ${label}: ${requireScalar(row[key], `delivery-plane.${key}`)}`).join("\n");
}

function renderRuntimeRowsList(value) {
  const rows = asArray(value).map(strip).filter(Boolean);
  if (rows.length === 0) {
    throw new RenderContractError("VAL-RENDER-002", "tasks delivery-plane", "Runtime Rows 不能为空。");
  }
  return `- ${rows.join(", ")}`;
}

function renderInlineList(value) {
  const rows = asArray(value).map(strip).filter(Boolean);
  return rows.length > 0 ? rows.join(", ") : requireScalar(value, "inline-list");
}

function renderMarkdownTable(heading, columns, rows) {
  return `## ${heading}\n\n${renderTableOnly(columns, rows)}\n\n`;
}

function renderTableOnly(columns, rows) {
  const headers = columns.map(([header]) => header);
  const keys = columns.map(([, key]) => key);
  return renderMarkdownTableLines(headers, rows, keys);
}

function renderMarkdownTableLines(headers, rows, keys) {
  const tableRows = asArray(rows).map((row) => asObject(row));
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...tableRows.map((row) => `| ${keys.map((key) => cell(row[key])).join(" | ")} |`),
  ].join("\n");
}

function artifactPathForRequest(artifact, options = {}) {
  if (artifact === "proposal") return "proposal.md";
  if (artifact === "design") return "design.md";
  if (artifact === "runtime-acceptance") return "runtime-acceptance.md";
  if (artifact === "verification") return "verification.md";
  if (artifact === "tasks") return "tasks.md";
  if (artifact === "specs") {
    if (options.noDeltaSpecs) {
      if (options.capability) {
        throw new Error("renderChangeArtifact does not accept --capability with --no-delta-specs");
      }
      return NO_DELTA_SPECS_ARTIFACT_PATH;
    }
    const capability = options.capability ?? "";
    if (!capability) {
      throw new Error("renderChangeArtifact requires --capability for specs");
    }
    return `specs/${capability}/spec.md`;
  }
  throw new Error(`Unsupported artifact id: ${artifact}`);
}

export function tracePathForArtifactPath(artifactPath) {
  if (artifactPath === "proposal.md") return "trace/proposal.trace.json";
  if (artifactPath === "design.md") return "trace/design.trace.json";
  if (artifactPath === "runtime-acceptance.md") return "trace/runtime-acceptance.trace.json";
  if (artifactPath === "verification.md") return "trace/verification.trace.json";
  if (artifactPath === "tasks.md") return "trace/tasks.trace.json";
  if (artifactPath.startsWith("specs/")) {
    const traceRelPath = artifactPath.endsWith("/spec.md")
      ? artifactPath.replace(/\/spec\.md$/u, ".trace.json")
      : artifactPath.replace(/\.md$/u, ".trace.json");
    return `trace/${traceRelPath}`;
  }
  throw new RenderContractError("VAL-RENDER-002", artifactPath, `无法解析 artifact trace path：${artifactPath}`);
}

function updateManifest(changeDir, rendered) {
  const manifestPath = path.join(changeDir, "trace", "manifest.json");
  const manifest = fs.existsSync(manifestPath)
    ? readJson(manifestPath)
    : { "trace-schema": TRACE_SCHEMA, artifacts: [] };
  const existingTraceContractVersion = strip(manifest["trace-contract-version"]);
  const existingLegacyProofSlices =
    rendered.artifactPath !== "verification.md" &&
    existingTraceContractVersion === LEGACY_TRACE_CONTRACT_VERSION &&
    fs.existsSync(path.join(changeDir, PROOF_SLICES_TRACE_PATH));
  const renderedLegacyProofSlices =
    rendered.artifactPath === "verification.md" &&
    rendered.proofSlicesTrace &&
    proofSliceModelSource(rendered.proofSlicesTrace) === PROOF_SLICES_TRACE_PATH &&
    !hasInlineProofSliceModel(rendered.trace);
  const legacyProofSlices = existingLegacyProofSlices || renderedLegacyProofSlices;
  manifest["trace-contract-version"] = legacyProofSlices ? LEGACY_TRACE_CONTRACT_VERSION : TRACE_CONTRACT_VERSION;
  manifest["render-contract-version"] = RENDER_CONTRACT_VERSION;
  manifest.artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
  upsertManifestEntry(manifest, {
    "artifact-id": artifactIdForArtifactPath(rendered.artifactPath),
    "artifact-path": rendered.artifactPath,
    "trace-path": rendered.tracePath,
    "trace-schema": TRACE_SCHEMA,
  });
  if (legacyProofSlices) {
    upsertManifestEntry(manifest, {
      "artifact-id": "verification",
      "artifact-path": "verification.md",
      "trace-path": PROOF_SLICES_TRACE_PATH,
      "trace-schema": PROOF_SLICES_TRACE_SCHEMA,
    });
  } else {
    removeManifestTraceEntry(manifest, PROOF_SLICES_TRACE_PATH);
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function upsertManifestEntry(manifest, entry) {
  const index = manifest.artifacts.findIndex(
    (candidate) =>
      candidate?.["artifact-path"] === entry["artifact-path"] &&
      candidate?.["trace-path"] === entry["trace-path"],
  );
  if (index >= 0) {
    manifest.artifacts[index] = { ...manifest.artifacts[index], ...entry };
  } else {
    manifest.artifacts.push(entry);
  }
}

function removeManifestTraceEntry(manifest, tracePath) {
  manifest.artifacts = asArray(manifest.artifacts).filter((entry) => entry?.["trace-path"] !== tracePath);
}

function hasInlineProofSliceModel(trace) {
  const model = trace?.["proof-slice-model"];
  return Boolean(model && typeof model === "object" && !Array.isArray(model));
}

function artifactIdForArtifactPath(artifactPath) {
  if (artifactPath.startsWith("specs/")) return "specs";
  return artifactPath.replace(/\.md$/u, "");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function unique(values) {
  return [...new Set(values)];
}

function requireScalar(value, ref) {
  const text = Array.isArray(value) ? value.map(strip).filter(Boolean).join(", ") : strip(value);
  if (!text) {
    throw new RenderContractError("VAL-RENDER-002", ref, `${ref} 缺少 render payload。`);
  }
  return text;
}

function readJson(fullPath) {
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function strip(value) {
  return String(value ?? "").trim();
}

function cell(value) {
  if (Array.isArray(value)) {
    return value.map(strip).filter(Boolean).join(", ").replaceAll("|", "\\|");
  }
  return String(value ?? "").replaceAll("\n", "<br>").replaceAll("|", "\\|");
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--change") options.change = argv[++index];
    else if (arg === "--artifact") options.artifact = argv[++index];
    else if (arg === "--capability") options.capability = argv[++index];
    else if (arg === "--no-delta-specs") options.noDeltaSpecs = true;
    else if (arg === "--write") options.write = true;
    else if (arg === "--root") options.root = argv[++index];
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function usage() {
  return `Usage:
  node openspec/agent-runtime/scripts/render-production-artifacts.mjs --change <slug> --artifact <id> [--capability <name>] [--no-delta-specs] [--write] [--root <path>]
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      process.exit(0);
    }
    const result = renderChangeArtifact(options);
    if (!options.write) {
      process.stdout.write(result.markdown);
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
