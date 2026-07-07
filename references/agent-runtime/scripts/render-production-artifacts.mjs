#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RENDER_CONTRACT_VERSION = "trace-render-v1";
export const TRACE_CONTRACT_VERSION = "verification-slice-register-v2";
export const TRACE_SCHEMA = "openspec-trace-v1";
export const PROOF_SLICES_TRACE_PATH = "trace/verification.proof-slices.json";
export const VERIFICATION_TRACE_PATH = "trace/verification.trace.json";
export const VERIFICATION_SLICE_REGISTER_PATH = `${VERIFICATION_TRACE_PATH}#/verification-slice-register`;
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
  const markdown = renderArtifactMarkdown({
    trace,
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
  const body = renderDeliveryBody(trace);
  return `${body.trimEnd()}\n\n## Trace Appendix\n\nTrace file: \`${tracePath}\`\nTrace schema: \`${TRACE_SCHEMA}\`\n`;
}

export function renderDeliveryBody(trace) {
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
    return renderDesignDelivery(trace);
  }
  if (artifactId === "runtime-acceptance") {
    return renderRuntimeDelivery(delivery, trace);
  }
  if (artifactId === "verification") {
    return renderVerificationDelivery(trace);
  }
  if (artifactId === "tasks") {
    return renderTasksDelivery(delivery, trace);
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

function renderDesignDelivery(trace) {
  const delivery = trace["delivery-plane"];
  return [
    renderSection("Context", requireText(delivery.context, "design.delivery-plane.context")),
    renderSection("Goals / Non-Goals", requireText(delivery["goals-non-goals"], "design.delivery-plane.goals-non-goals")),
    renderDesignDecisions(trace),
    renderSection("Risks / Trade-offs", requireText(delivery["risks-trade-offs"], "design.delivery-plane.risks-trade-offs")),
    renderSection("Open Questions", requireText(delivery["open-questions"], "design.delivery-plane.open-questions")),
    renderDesignImplementationDetails(trace),
  ].join("");
}

function renderDesignDecisions(trace) {
  const delivery = asObject(trace["delivery-plane"]);
  const rows = asArray(delivery.decisions);
  if (rows.length === 0) {
    throw new RenderContractError("VAL-RENDER-002", "design delivery-plane", "design decisions payload 不能为空。");
  }
  const registerById = new Map(
    asArray(trace["implementation-design-register"]).map((value) => {
      const row = asObject(value);
      const id = requireScalar(row["implementation-design-id"], "design.implementation-design-register[].implementation-design-id");
      return [id, row];
    }),
  );
  const body = rows
    .map((decision) => {
      const row = asObject(decision);
      const id = requireScalar(row["decision-id"], "design.decisions[].decision-id");
      const registerRow = registerById.get(id);
      if (!registerRow) {
        throw new RenderContractError("VAL-RENDER-002", `design.decisions[${id}]`, `delivery-plane decision 引用未知 IDR：${id}。`);
      }
      const title = requireScalar(registerRow.title, `design.implementation-design-register[${id}].title`);
      return [
        `### ${id} ${title}`,
        "",
        renderLabeledBlock("Decision", registerRow.decision, `design.implementation-design-register[${id}].decision`),
      ].join("\n");
    })
    .join("\n\n");
  return `## Decisions\n\n${body}\n\n`;
}

function renderDesignImplementationDetails(trace) {
  const delivery = asObject(trace["delivery-plane"]);
  const renderOrder = asArray(delivery["detail-render-order"]).map(strip).filter(Boolean);
  if (renderOrder.length === 0) {
    throw new RenderContractError("VAL-RENDER-002", "design delivery-plane.detail-render-order", "design detail-render-order 不能为空。");
  }

  const detailsByType = new Map();
  for (const idr of asArray(trace["implementation-design-register"])) {
    const row = asObject(idr);
    const parentId = requireScalar(row["implementation-design-id"], "design.implementation-design-register[].implementation-design-id");
    for (const detailValue of asArray(row["implementation-details"])) {
      const detail = asObject(detailValue);
      const detailType = requireScalar(detail["detail-type"], `design.${parentId}.implementation-details[].detail-type`);
      if (!detailsByType.has(detailType)) detailsByType.set(detailType, []);
      detailsByType.get(detailType).push({ parentId, detail });
    }
  }

  const sections = [];
  const renderedTypes = new Set();
  for (const detailType of renderOrder) {
    const details = detailsByType.get(detailType) ?? [];
    if (details.length === 0) continue;
    renderedTypes.add(detailType);
    sections.push(`### ${detailType}\n\n${details.map(renderDesignImplementationDetail).join("\n\n")}`);
  }

  const unrenderedTypes = [...detailsByType.keys()].filter((type) => !renderedTypes.has(type));
  if (unrenderedTypes.length > 0) {
    throw new RenderContractError(
      "VAL-RENDER-002",
      "design delivery-plane.detail-render-order",
      `detail-render-order 缺少 detail type：${unrenderedTypes.join(", ")}。`,
    );
  }

  if (sections.length === 0) {
    throw new RenderContractError("VAL-RENDER-002", "design implementation-details", "design implementation details 不能为空。");
  }

  return `## Implementation Details\n\n${sections.join("\n\n")}\n\n`;
}

function renderDesignImplementationDetail(entry) {
  const { parentId, detail } = entry;
  const detailId = requireScalar(detail["detail-id"], `design.${parentId}.implementation-details[].detail-id`);
  const content = renderBlockText(requireStringText(detail.content, `design.${detailId}.content`));
  return content;
}

const RUNTIME_TABLES = [
  {
    section: "surface-facts",
    heading: "Runtime Surface Facts",
    factType: "surface",
    idPattern: /^RS-\d{3}$/u,
  },
  {
    section: "operation-facts",
    heading: "Operation Facts",
    factType: "operation",
    idPattern: /^OP-\d{3}$/u,
  },
  {
    section: "state-facts",
    heading: "State / Branch Facts",
    factType: "state",
    idPattern: /^ST-\d{3}$/u,
  },
  {
    section: "chain-facts",
    heading: "Async / Realtime Chain Facts",
    factType: "chain",
    idPattern: /^CH-\d{3}$/u,
  },
];

const RUNTIME_FACT_COLUMNS = [
  ["Runtime Fact ID", "runtime-fact-id"],
  ["Fact Type", "fact-type"],
  ["Scope Role", "scope-role"],
  ["Source Basis", "source-basis"],
  ["Owner Candidate", "owner-candidate"],
  ["Runtime Fact", "runtime-fact"],
  ["Observable Fact", "observable-fact"],
  ["Default Path Policy", "default-path-policy"],
  ["External Boundary", "external-boundary"],
  ["No-Scope-Expansion Check", "no-scope-expansion-check"],
];

function renderRuntimeDelivery(delivery, trace) {
  const runtimeFacts = collectRuntimeFacts(trace["runtime-fact-register"]);
  const factSections = asObject(delivery["fact-sections"]);
  validateRuntimeDeliveryModel(runtimeFacts, factSections);
  let output = `## Runtime Acceptance Intent\n\n${renderIntentList(delivery["runtime-acceptance-intent"], [
    ["Scope", "scope"],
    ["Source basis", "source-basis"],
    ["Out of scope", "out-of-scope"],
  ])}\n\n`;
  for (const table of RUNTIME_TABLES) {
    const ids = asArray(factSections[table.section]).map(strip).filter(Boolean);
    const rows = ids.map((id) => {
      const row = asObject(runtimeFacts.byId[id]);
      if (strip(row["runtime-fact-id"]) !== id) {
        throw new RenderContractError("VAL-RENDER-002", "runtime delivery-plane", `${id} 缺少 runtime fact fields。`);
      }
      return {
        ...row,
        "source-basis": formatRuntimeSourceBasis(row["source-basis"]),
      };
    });
    output += renderMarkdownTable(table.heading, RUNTIME_FACT_COLUMNS, rows);
  }
  return output;
}

function collectRuntimeFacts(value) {
  const rows = new Map();
  const ids = [];
  const duplicates = [];
  if (Array.isArray(value)) {
    for (const rowValue of value) {
      const row = asObject(rowValue);
      const id = strip(row["runtime-fact-id"]);
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

function validateRuntimeDeliveryModel(runtimeFacts, factSections) {
  if (runtimeFacts.duplicates.length > 0) {
    throw new RenderContractError(
      "VAL-RENDER-002",
      "runtime-fact-register",
      `runtime fact 重复：${unique(runtimeFacts.duplicates).join(", ")}。`,
    );
  }

  const indexedIds = [];
  const seenIndexIds = new Set();
  const duplicateIndexIds = [];
  for (const table of RUNTIME_TABLES) {
    const sectionIds = asArray(factSections[table.section]).map(strip).filter(Boolean);
    if (!Array.isArray(factSections[table.section])) {
      throw new RenderContractError("VAL-RENDER-002", "runtime delivery-plane.fact-sections", `${table.section} 必须是数组。`);
    }
    for (const id of sectionIds) {
      indexedIds.push(id);
      if (seenIndexIds.has(id)) duplicateIndexIds.push(id);
      seenIndexIds.add(id);
      if (!table.idPattern.test(id)) {
        throw new RenderContractError("VAL-RENDER-002", "runtime delivery-plane.fact-sections", `${id} 不属于 ${table.section}。`);
      }
      const row = asObject(runtimeFacts.byId[id]);
      if (!Object.keys(row).length) {
        throw new RenderContractError("VAL-RENDER-002", "runtime delivery-plane.fact-sections", `${id} 缺少 runtime fact。`);
      }
      validateRuntimeFactFields(id, row, table);
    }
  }

  if (duplicateIndexIds.length > 0) {
    throw new RenderContractError(
      "VAL-RENDER-002",
      "runtime delivery-plane.fact-sections",
      `fact-sections 重复引用：${unique(duplicateIndexIds).join(", ")}。`,
    );
  }

  const canonicalIdSet = new Set(runtimeFacts.ids);
  const indexedIdSet = new Set(indexedIds);
  const missingFromIndex = [...canonicalIdSet].filter((id) => !indexedIdSet.has(id));
  const extraInIndex = [...indexedIdSet].filter((id) => !canonicalIdSet.has(id));
  if (missingFromIndex.length > 0 || extraInIndex.length > 0) {
    const parts = [];
    if (missingFromIndex.length > 0) parts.push(`未入 index：${missingFromIndex.join(", ")}`);
    if (extraInIndex.length > 0) parts.push(`index 未定义：${extraInIndex.join(", ")}`);
    throw new RenderContractError("VAL-RENDER-002", "runtime delivery-plane.fact-sections", `runtime facts 与 fact-sections 不一致；${parts.join("；")}。`);
  }
}

function validateRuntimeFactFields(id, row, table) {
  if (strip(row["runtime-fact-id"]) !== id) {
    throw new RenderContractError("VAL-RENDER-002", "runtime-fact-register", `${id} 缺少 runtime-fact-id。`);
  }
  for (const [, key] of RUNTIME_FACT_COLUMNS) {
    if (key === "source-basis") {
      if (!formatRuntimeSourceBasis(row[key])) {
        throw new RenderContractError("VAL-RENDER-002", "runtime-fact-register", `${id} 缺少 source-basis。`);
      }
      continue;
    }
    if (!strip(row[key])) {
      throw new RenderContractError("VAL-RENDER-002", "runtime-fact-register", `${id} 缺少 ${key}。`);
    }
  }
  if (strip(row["fact-type"]) !== table.factType) {
    throw new RenderContractError("VAL-RENDER-002", "runtime-fact-register", `${id} fact-type 必须是 ${table.factType}。`);
  }
  const owner = strip(row["owner-candidate"]);
  if (/[,，;+、]|(?:^|\s)(?:and|和|与)(?:\s|$)/iu.test(owner)) {
    throw new RenderContractError("VAL-RENDER-002", "runtime-fact-register", `${id} Owner Candidate 必须是单一 advisory owner。`);
  }
}

function formatRuntimeSourceBasis(value) {
  const basis = asObject(value);
  const parts = [];
  const specScenarios = asArray(basis["spec-scenarios"]).map(strip).filter(Boolean);
  const designDecisions = asArray(basis["design-decisions"]).map(strip).filter(Boolean);
  if (specScenarios.length > 0) parts.push(`spec-scenarios: ${specScenarios.join(", ")}`);
  if (designDecisions.length > 0) parts.push(`design-decisions: ${designDecisions.join(", ")}`);
  return parts.join("; ");
}

function renderVerificationDelivery(trace) {
  const delivery = trace["delivery-plane"];
  const slices = resolveVerificationSliceRegister(trace);
  validateVerificationSlicesForRender(slices);
  const proofRows = slices.map((slice) => {
    const runtimeFacts = asArray(slice["runtime-fact-ids"]).join(", ");
    return `| ${cell(slice["slice-id"])} | ${cell(runtimeFacts)} | ${cell(slice["primary-runtime-fact-id"])} | ${cell(slice["proof-type"])} | ${cell(slice.branch)} | ${cell(slice.oracle)} | ${cell(slice["failure-signal"])} | ${cell(slice["test-layer"])} | ${cell(slice["production-owner"])} | ${cell(slice["assertion-shape"])} | ${cell(slice["fixture-boundary"])} | ${cell(slice["proof-evidence-mode"])} | ${cell(slice["planned-test-directory"])} | ${cell(slice["non-persistent-reason"])} |`;
  });
  return `## Verification Intent

${renderIntentList(delivery["verification-intent"], [
    ["Scope", "scope"],
    ["Runtime source", "runtime-source"],
    ["Out of scope", "out-of-scope"],
  ])}

## Proof Slice Matrix

| Slice ID | Runtime Fact IDs | Primary Runtime Fact ID | Proof Type | Branch | Oracle | Failure Signal | Test Layer | Production Owner | Assertion Shape | Fixture Boundary | Proof Evidence Mode | Planned Test Directory | Non-Persistent Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${proofRows.join("\n")}
`;
}

function validateVerificationSlicesForRender(slices) {
  if (slices.length === 0) {
    throw new RenderContractError("VAL-RENDER-002", VERIFICATION_SLICE_REGISTER_PATH, "verification-slice-register 不能为空。");
  }
  for (const [index, slice] of slices.entries()) {
    const ref = `${VERIFICATION_SLICE_REGISTER_PATH}/${index}`;
    const sliceId = strip(slice?.["slice-id"]) || `(index ${index})`;
    for (const field of [
      "slice-id",
      "runtime-fact-ids",
      "primary-runtime-fact-id",
      "proof-type",
      "branch",
      "oracle",
      "failure-signal",
      "test-layer",
      "production-owner",
      "assertion-shape",
      "fixture-boundary",
      "proof-evidence-mode",
      "planned-test-directory",
      "non-persistent-reason",
    ]) {
      if (field === "runtime-fact-ids") {
        if (asArray(slice?.[field]).length === 0) {
          throw new RenderContractError("VAL-RENDER-002", ref, `${sliceId} 缺少 runtime-fact-ids。`);
        }
        continue;
      }
      if (!strip(slice?.[field])) {
        throw new RenderContractError("VAL-RENDER-002", ref, `${sliceId} 缺少 ${field}。`);
      }
    }
  }
}

export function resolveVerificationSliceRegister(trace) {
  if (!trace || typeof trace !== "object" || Array.isArray(trace)) {
    throw new RenderContractError("VAL-RENDER-002", "trace", "verification renderer 缺少 trace object。");
  }
  const slices = trace["verification-slice-register"];
  if (!Array.isArray(slices)) {
    throw new RenderContractError("VAL-RENDER-002", VERIFICATION_SLICE_REGISTER_PATH, "verification renderer 缺少 verification-slice-register。");
  }
  return slices;
}

function renderTasksDelivery(delivery, trace) {
  const steps = asArray(trace["implementation-step-register"]);
  if (steps.length === 0) {
    throw new RenderContractError("VAL-RENDER-002", "tasks implementation-step-register", "tasks 缺少 implementation-step-register payload。");
  }
  const stepById = new Map();
  for (const step of steps) {
    const row = asObject(step);
    const stepId = requireScalar(row["step-id"], "tasks.implementation-step-register[].step-id");
    stepById.set(stepId, row);
  }
  const stepSections = asArray(delivery["step-sections"]).map(strip).filter(Boolean);
  if (stepSections.length === 0) {
    throw new RenderContractError("VAL-RENDER-002", "tasks delivery-plane", "tasks 缺少 step-sections payload。");
  }
  return stepSections.map((stepId) => renderImplementationStep(stepId, stepById.get(stepId))).join("\n");
}

function renderImplementationStep(stepId, step) {
  const row = asObject(step);
  if (!step) {
    throw new RenderContractError("VAL-RENDER-002", "tasks delivery-plane", `step-sections 引用未知 step：${stepId}。`);
  }
  const title = requireScalar(row.title, `tasks.implementation-step-register[${stepId}].title`);
  const tasks = asArray(row.tasks);
  if (tasks.length === 0) {
    throw new RenderContractError("VAL-RENDER-002", "tasks implementation-step-register", `${stepId} 缺少 checkbox tasks。`);
  }
  const blocks = [
    `## ${stepId} ${title}`,
    "",
  ];
  const dependsOn = asArray(row["depends-on-step-ids"]).map(strip).filter(Boolean);
  if (dependsOn.length > 0) {
    blocks.push("Depends On:", "", `- ${dependsOn.join(", ")}`, "");
  }
  blocks.push(
    "Runtime Facts:",
    "",
    renderRuntimeRowsList(row["runtime-fact-ids"]),
    "",
    tasks.map((task) => renderTaskBlock(stepId, task)).join("\n"),
    "",
  );
  return blocks.join("\n");
}

function renderTaskBlock(acId, task) {
  const row = asObject(task);
  const taskId = requireScalar(row["task-id"], `tasks.implementation-step-register[${acId}].tasks[].task-id`);
  return [
    `- [ ] ${taskId} ${requireScalar(row.title, `tasks.implementation-step-register[${acId}].tasks[${taskId}].title`)}`,
    `      Runtime Facts: ${renderInlineList(row["runtime-fact-ids"])}`,
    `      Work: ${requireScalar(row.work, `tasks.implementation-step-register[${acId}].tasks[${taskId}].work`)}`,
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

function requireStringText(value, ref) {
  if (typeof value !== "string" || !value.trim()) {
    throw new RenderContractError("VAL-RENDER-002", ref, `${ref} 必须是非空字符串 render payload。`);
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
    throw new RenderContractError("VAL-RENDER-002", "tasks delivery-plane", "Runtime Facts 不能为空。");
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
  manifest["trace-contract-version"] = TRACE_CONTRACT_VERSION;
  manifest["render-contract-version"] = RENDER_CONTRACT_VERSION;
  manifest.artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
  upsertManifestEntry(manifest, {
    "artifact-id": artifactIdForArtifactPath(rendered.artifactPath),
    "artifact-path": rendered.artifactPath,
    "trace-path": rendered.tracePath,
    "trace-schema": TRACE_SCHEMA,
  });
  removeManifestTraceEntry(manifest, PROOF_SLICES_TRACE_PATH);
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
