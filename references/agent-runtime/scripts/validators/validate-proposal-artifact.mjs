#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RENDER_CONTRACT_VERSION,
  TRACE_CONTRACT_VERSION,
  TRACE_SCHEMA,
  renderChangeArtifact,
} from "../render-production-artifacts.mjs";

const SOURCE_ALIGNED_TRACE_VERSION = "source-aligned-trace-v1";

const OBLIGATION_SCHEMA = "production-obligation-atom-driven";
const DEFAULT_SCHEMA = "production-default-acceptance-driven";

const PROPOSAL_TRACE_PATH = "trace/proposal.trace.json";
const PROPOSAL_ARTIFACT_PATH = "proposal.md";

const GA_ID_RE = /^GA-\d{4}$/u;
const SI_ID_RE = /^SI-\d{3}$/u;
const BI_ID_RE = /^BI-\d{3}$/u;

const DEFAULT_INPUT_TYPES = new Set([
  "user-request",
  "existing-spec",
  "code-baseline",
  "external-doc",
  "issue",
  "design",
]);

const DEFAULT_ARTIFACT_HANDLINGS = new Set([
  "spec",
  "guard",
  "design",
  "proof",
  "context",
]);

export function validateProposalArtifact(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const change = strip(options.change);
  const ctx = {
    root,
    change,
    changeDir: path.join(root, "openspec", "changes", change),
    errors: [],
    warnings: [],
  };

  if (!change) {
    addError(ctx, "VAL-CLI-001", ".", "缺少 --change <slug>。");
    return resultFor(ctx);
  }

  if (!fs.existsSync(ctx.changeDir)) {
    addError(ctx, "VAL-CHANGE-001", rel(ctx, ctx.changeDir), `change 目录不存在：${ctx.changeDir}`);
    return resultFor(ctx);
  }

  validateProposalIfPresent(ctx);

  return resultFor(ctx);
}

function validateProposalIfPresent(ctx) {
  const traceFullPath = path.join(ctx.changeDir, PROPOSAL_TRACE_PATH);
  const artifactFullPath = path.join(ctx.changeDir, PROPOSAL_ARTIFACT_PATH);
  const manifestFullPath = path.join(ctx.changeDir, "trace", "manifest.json");

  if (!fs.existsSync(traceFullPath)) {
    const artifactExists = fs.existsSync(artifactFullPath);
    const manifestHasProposal = manifestEntryExists(ctx, manifestFullPath, PROPOSAL_TRACE_PATH);
    if (artifactExists || manifestHasProposal) {
      addError(ctx, "VAL-PROPOSAL-001", PROPOSAL_TRACE_PATH, "proposal artifact 或 manifest entry 已存在，但 trace/proposal.trace.json 缺失。");
    } else {
      addWarning(ctx, "VAL-PROPOSAL-000", PROPOSAL_TRACE_PATH, "未发现 proposal trace；partial validator 跳过 proposal。");
    }
    return;
  }

  const trace = readJson(ctx, traceFullPath);
  if (!trace) return;

  validateCommonProposal(ctx, trace);

  const schemaName = strip(trace["schema-name"]);
  if (schemaName === OBLIGATION_SCHEMA) {
    validateObligationProposal(ctx, trace);
  } else if (schemaName === DEFAULT_SCHEMA) {
    validateDefaultProposal(ctx, trace);
  } else {
    addError(ctx, "VAL-PROPOSAL-004", PROPOSAL_TRACE_PATH, `不支持的 proposal schema-name：${schemaName || "(empty)"}`);
  }
}

function validateCommonProposal(ctx, trace) {
  expectEqual(ctx, "VAL-PROPOSAL-010", PROPOSAL_TRACE_PATH, trace["trace-schema"], TRACE_SCHEMA, "trace-schema");
  expectEqual(ctx, "VAL-PROPOSAL-011", PROPOSAL_TRACE_PATH, trace["artifact-id"], "proposal", "artifact-id");
  expectEqual(ctx, "VAL-PROPOSAL-012", PROPOSAL_TRACE_PATH, trace["artifact-path"], PROPOSAL_ARTIFACT_PATH, "artifact-path");
  expectEqual(ctx, "VAL-PROPOSAL-013", PROPOSAL_TRACE_PATH, trace["change-name"], ctx.change, "change-name");
  requireObject(ctx, "VAL-PROPOSAL-014", PROPOSAL_TRACE_PATH, trace["delivery-plane"], "delivery-plane");
  requireObject(ctx, "VAL-PROPOSAL-015", PROPOSAL_TRACE_PATH, trace["proposal-alignment-gate"], "proposal-alignment-gate");

  validateProposalRender(ctx);
  validateManifest(ctx);
}

function validateProposalRender(ctx) {
  const artifactFullPath = path.join(ctx.changeDir, PROPOSAL_ARTIFACT_PATH);
  if (!fs.existsSync(artifactFullPath)) {
    addError(ctx, "VAL-RENDER-001", PROPOSAL_ARTIFACT_PATH, "proposal.md 缺失；writer 必须通过 renderer 生成 Markdown。");
    return;
  }

  let rendered;
  try {
    rendered = renderChangeArtifact({
      root: ctx.root,
      change: ctx.change,
      artifact: "proposal",
    }).markdown;
  } catch (error) {
    addError(ctx, "VAL-RENDER-002", PROPOSAL_TRACE_PATH, error.message);
    return;
  }

  const actual = fs.readFileSync(artifactFullPath, "utf8");
  if (actual !== rendered) {
    addError(ctx, "VAL-RENDER-003", PROPOSAL_ARTIFACT_PATH, "proposal.md 与 renderer 从 trace/proposal.trace.json 生成的结果不一致。");
  }
}

function validateManifest(ctx) {
  const manifestRelPath = "trace/manifest.json";
  const manifestFullPath = path.join(ctx.changeDir, manifestRelPath);
  const manifest = readJson(ctx, manifestFullPath);
  if (!manifest) return;

  expectEqual(ctx, "VAL-MANIFEST-001", manifestRelPath, manifest["trace-schema"], TRACE_SCHEMA, "trace-schema");
  expectEqual(ctx, "VAL-MANIFEST-002", manifestRelPath, manifest["render-contract-version"], RENDER_CONTRACT_VERSION, "render-contract-version");
  expectEqual(ctx, "VAL-MANIFEST-003", manifestRelPath, manifest["trace-contract-version"], TRACE_CONTRACT_VERSION, "trace-contract-version");

  const artifacts = requireArray(ctx, "VAL-MANIFEST-004", manifestRelPath, manifest.artifacts, "artifacts");
  const entries = artifacts.filter(
    (entry) =>
      entry?.["artifact-id"] === "proposal" &&
      entry?.["artifact-path"] === PROPOSAL_ARTIFACT_PATH &&
      entry?.["trace-path"] === PROPOSAL_TRACE_PATH,
  );
  if (entries.length !== 1) {
    addError(ctx, "VAL-MANIFEST-005", manifestRelPath, "manifest 必须有且仅有一个 proposal -> trace/proposal.trace.json registry entry。");
  } else {
    expectEqual(ctx, "VAL-MANIFEST-006", manifestRelPath, entries[0]["trace-schema"], TRACE_SCHEMA, "proposal entry trace-schema");
  }
}

function validateObligationProposal(ctx, trace) {
  const preconditions = requireObject(
    ctx,
    "VAL-OBLIGATION-PROPOSAL-001",
    PROPOSAL_TRACE_PATH,
    trace["obligation-atom-preconditions"],
    "obligation-atom-preconditions",
  );
  const register = requireArray(
    ctx,
    "VAL-OBLIGATION-PROPOSAL-002",
    PROPOSAL_TRACE_PATH,
    trace["change-atom-coverage-register"],
    "change-atom-coverage-register",
  );
  const readSet = requireArray(
    ctx,
    "VAL-OBLIGATION-PROPOSAL-003",
    PROPOSAL_TRACE_PATH,
    trace["source-window-read-set"],
    "source-window-read-set",
  );
  const sourceCoverage = requireArray(
    ctx,
    "VAL-OBLIGATION-PROPOSAL-004",
    PROPOSAL_TRACE_PATH,
    trace["production-source-coverage"],
    "production-source-coverage",
  );
  const gate = requireObject(
    ctx,
    "VAL-OBLIGATION-PROPOSAL-005",
    PROPOSAL_TRACE_PATH,
    trace["proposal-alignment-gate"],
    "proposal-alignment-gate",
  );

  const handoff = loadObligationHandoff(ctx, preconditions);
  if (!handoff) return;

  validateObligationDeliveryPlane(ctx, trace["delivery-plane"]);
  validateObligationGateBasics(ctx, gate, preconditions, handoff);
  validateDirectAtomRegister(ctx, register, handoff);
  validateSourceWindowReadSet(ctx, readSet, register);
  validateProductionSourceCoverage(ctx, sourceCoverage, register);
  validateObligationGateCoverage(ctx, gate, register, readSet, handoff);
  validateOwnerScopedBoundary(ctx, trace, gate, handoff);
}

function loadObligationHandoff(ctx, preconditions) {
  const requiredPathFields = [
    "orchestrate-manifest",
    "global-atom-index-json",
    "atom-plan-mapping-json",
    "final-packet-index-json",
  ];
  for (const field of requiredPathFields) {
    requireString(ctx, "VAL-OBLIGATION-PRE-001", PROPOSAL_TRACE_PATH, preconditions[field], `obligation-atom-preconditions.${field}`);
  }

  for (const [field, value] of Object.entries(preconditions)) {
    if (value && typeof value === "object") {
      addError(ctx, "VAL-OBLIGATION-PRE-002", PROPOSAL_TRACE_PATH, `obligation-atom-preconditions.${field} 必须是字符串路径，不能内联 object metadata。`);
      continue;
    }
    if (typeof value === "string") {
      expectRepoFile(ctx, "VAL-OBLIGATION-PRE-003", value, `precondition ${field}`);
    }
  }

  const finalPacketIndexPath = strip(preconditions["final-packet-index-json"]);
  const atomPlanMappingPath = strip(preconditions["atom-plan-mapping-json"]);
  const globalAtomIndexPath = strip(preconditions["global-atom-index-json"]);
  const orchestrateManifestPath = strip(preconditions["orchestrate-manifest"]);

  const finalPacketIndex = readRepoJson(ctx, finalPacketIndexPath);
  const atomPlanMapping = readRepoJson(ctx, atomPlanMappingPath);
  const globalAtomIndex = readRepoJson(ctx, globalAtomIndexPath);
  const orchestrateManifest = readRepoJson(ctx, orchestrateManifestPath);
  if (!finalPacketIndex || !atomPlanMapping || !globalAtomIndex || !orchestrateManifest) {
    return null;
  }

  expectEqual(ctx, "VAL-OBLIGATION-HANDOFF-001", finalPacketIndexPath, finalPacketIndex["trace-contract-version"], SOURCE_ALIGNED_TRACE_VERSION, "trace-contract-version");
  expectEqual(ctx, "VAL-OBLIGATION-HANDOFF-002", atomPlanMappingPath, atomPlanMapping["trace-contract-version"], SOURCE_ALIGNED_TRACE_VERSION, "trace-contract-version");
  expectEqual(ctx, "VAL-OBLIGATION-HANDOFF-003", globalAtomIndexPath, globalAtomIndex["trace-contract-version"], SOURCE_ALIGNED_TRACE_VERSION, "trace-contract-version");
  expectEqual(ctx, "VAL-OBLIGATION-HANDOFF-004", orchestrateManifestPath, orchestrateManifest["trace-contract-version"], SOURCE_ALIGNED_TRACE_VERSION, "trace-contract-version");

  validatePhase5Status(ctx, orchestrateManifestPath, orchestrateManifest);

  const packets = requireArray(ctx, "VAL-OBLIGATION-HANDOFF-005", finalPacketIndexPath, finalPacketIndex.packets, "packets");
  const packet = packets.find((candidate) => strip(candidate.change ?? candidate["change-slug"] ?? candidate.slug) === ctx.change);
  if (!packet) {
    addError(ctx, "VAL-OBLIGATION-HANDOFF-006", finalPacketIndexPath, `final-packet-index.json 中找不到 change：${ctx.change}`);
    return null;
  }

  const changeKind = strip(packet["change-kind"]);
  if (changeKind !== "foundation" && changeKind !== "business") {
    addError(ctx, "VAL-OBLIGATION-HANDOFF-007", finalPacketIndexPath, `packet.change-kind 必须是 foundation 或 business，实际为：${changeKind || "(empty)"}`);
  }

  const directAtomIds = requireIdArray(ctx, "VAL-OBLIGATION-HANDOFF-008", finalPacketIndexPath, packet["direct-atom-ids"], "packet.direct-atom-ids", GA_ID_RE);
  const ownerScopedIds = requireIdArray(
    ctx,
    "VAL-OBLIGATION-HANDOFF-009",
    finalPacketIndexPath,
    packet["owner-scoped-non-direct-atom-ids"] ?? [],
    "packet.owner-scoped-non-direct-atom-ids",
    GA_ID_RE,
  );

  const atomRows = requireArray(ctx, "VAL-OBLIGATION-HANDOFF-010", globalAtomIndexPath, globalAtomIndex["global-atoms"], "global-atoms");
  const mappingRows = requireArray(ctx, "VAL-OBLIGATION-HANDOFF-011", atomPlanMappingPath, atomPlanMapping.rows, "rows");

  return {
    paths: {
      finalPacketIndex: finalPacketIndexPath,
      atomPlanMapping: atomPlanMappingPath,
      globalAtomIndex: globalAtomIndexPath,
      orchestrateManifest: orchestrateManifestPath,
    },
    packet,
    changeKind,
    directAtomIds,
    ownerScopedIds,
    atomById: indexRowsById(ctx, "VAL-OBLIGATION-HANDOFF-012", globalAtomIndexPath, atomRows, "global-atom-id"),
    mappingById: indexRowsById(ctx, "VAL-OBLIGATION-HANDOFF-013", atomPlanMappingPath, mappingRows, "global-atom-id"),
  };
}

function validatePhase5Status(ctx, orchestrateManifestPath, orchestrateManifest) {
  const manifestStatus = strip(orchestrateManifest["phase-statuses"]?.["phase-5"]);
  if (manifestStatus && manifestStatus !== "accepted" && manifestStatus !== "adjusted") {
    addError(ctx, "VAL-OBLIGATION-HANDOFF-014", orchestrateManifestPath, `orchestrate manifest phase-5 status 必须为 accepted 或 adjusted，实际为：${manifestStatus}`);
  }

  const phase5RelPath = path.join(path.dirname(orchestrateManifestPath), "phase-5.trace.json");
  const phase5FullPath = path.join(ctx.root, phase5RelPath);
  if (!fs.existsSync(phase5FullPath)) return;

  const phase5 = readJson(ctx, phase5FullPath);
  if (!phase5) return;
  expectEqual(ctx, "VAL-OBLIGATION-HANDOFF-015", phase5RelPath, phase5["trace-contract-version"], SOURCE_ALIGNED_TRACE_VERSION, "trace-contract-version");
  const phase5Status = strip(phase5.status);
  if (phase5Status && phase5Status !== "accepted" && phase5Status !== "adjusted") {
    addError(ctx, "VAL-OBLIGATION-HANDOFF-016", phase5RelPath, `phase-5.trace.json status 必须为 accepted 或 adjusted，实际为：${phase5Status}`);
  }
  if (manifestStatus && phase5Status && manifestStatus !== phase5Status) {
    addError(ctx, "VAL-OBLIGATION-HANDOFF-017", phase5RelPath, `phase-5 status 与 orchestrate manifest 不一致：${phase5Status} !== ${manifestStatus}`);
  }
}

function validateObligationDeliveryPlane(ctx, deliveryPlane) {
  const text = JSON.stringify(deliveryPlane ?? {});
  if (/\bGA-\d{4}\b/u.test(text)) {
    addError(ctx, "VAL-OBLIGATION-DELIVERY-001", PROPOSAL_TRACE_PATH, "delivery-plane 不得包含 GA-#### coverage 或 direct atom 列表。");
  }
  for (const phrase of ["Direct atoms", "Direct Atoms", "Projection mix", "Projection Mix", "Global Atoms:"]) {
    if (text.includes(phrase)) {
      addError(ctx, "VAL-OBLIGATION-DELIVERY-002", PROPOSAL_TRACE_PATH, `delivery-plane 不得包含 coverage 泄漏短语：${phrase}`);
    }
  }
}

function validateObligationGateBasics(ctx, gate, preconditions, handoff) {
  expectEqual(ctx, "VAL-OBLIGATION-GATE-001", PROPOSAL_TRACE_PATH, gate["change-slug"], ctx.change, "proposal-alignment-gate.change-slug");
  expectEqual(ctx, "VAL-OBLIGATION-GATE-002", PROPOSAL_TRACE_PATH, gate["change-kind"], handoff.changeKind, "proposal-alignment-gate.change-kind");
  expectEqual(ctx, "VAL-OBLIGATION-GATE-003", PROPOSAL_TRACE_PATH, gate["global-atom-index-json"], preconditions["global-atom-index-json"], "proposal-alignment-gate.global-atom-index-json");
  expectEqual(ctx, "VAL-OBLIGATION-GATE-004", PROPOSAL_TRACE_PATH, gate["final-packet-index-json"], preconditions["final-packet-index-json"], "proposal-alignment-gate.final-packet-index-json");
  expectEqual(ctx, "VAL-OBLIGATION-GATE-005", PROPOSAL_TRACE_PATH, gate["atom-plan-mapping-json"], preconditions["atom-plan-mapping-json"], "proposal-alignment-gate.atom-plan-mapping-json");

  const packetPath = strip(handoff.packet["packet-path"]);
  if (packetPath) {
    expectEqual(ctx, "VAL-OBLIGATION-GATE-006", PROPOSAL_TRACE_PATH, gate["change-packet"], packetPath, "proposal-alignment-gate.change-packet");
  }

  const capabilityViewFiles = requireIdlessStringArray(
    ctx,
    "VAL-OBLIGATION-GATE-007",
    PROPOSAL_TRACE_PATH,
    gate["capability-atom-view-files"] ?? [],
    "proposal-alignment-gate.capability-atom-view-files",
  );
  const packetCapabilityViews = asArray(handoff.packet["capability-view-paths"]).map(strip).filter(Boolean);
  expectSameSet(ctx, "VAL-OBLIGATION-GATE-008", PROPOSAL_TRACE_PATH, capabilityViewFiles, packetCapabilityViews, "capability view files");

  const blockers = requireArray(ctx, "VAL-OBLIGATION-GATE-009", PROPOSAL_TRACE_PATH, gate.blockers ?? [], "proposal-alignment-gate.blockers");
  if (blockers.length !== 0) {
    addError(ctx, "VAL-OBLIGATION-GATE-010", PROPOSAL_TRACE_PATH, "proposal-alignment-gate.blockers 必须为空；非空 blocker 不能进入 validator pass。");
  }
}

function validateDirectAtomRegister(ctx, register, handoff) {
  const registerById = indexRowsById(ctx, "VAL-OBLIGATION-REGISTER-001", PROPOSAL_TRACE_PATH, register, "global-atom-id");
  expectSameSet(ctx, "VAL-OBLIGATION-REGISTER-002", PROPOSAL_TRACE_PATH, [...registerById.keys()], handoff.directAtomIds, "change-atom-coverage-register vs packet direct atoms");

  for (const id of handoff.directAtomIds) {
    const row = registerById.get(id);
    if (!row) continue;
    validateDirectAtomRow(ctx, row, id, handoff);
  }
}

function validateDirectAtomRow(ctx, row, id, handoff) {
  const requiredFields = [
    "global-atom-id",
    "source-document",
    "lines",
    "atom-type",
    "source-fact",
    "normativity",
    "coverage-status",
    "artifact-projection",
    "projection-source",
    "owner-capability",
    "atom-relation",
    "propose-use",
    "evidence-need",
    "downstream-coverage-expectation",
  ];
  for (const field of requiredFields) {
    requireString(ctx, "VAL-OBLIGATION-REGISTER-003", PROPOSAL_TRACE_PATH, row[field], `change-atom-coverage-register[${id}].${field}`);
  }

  expectEqual(ctx, "VAL-OBLIGATION-REGISTER-004", PROPOSAL_TRACE_PATH, row["coverage-status"], "direct", `change-atom-coverage-register[${id}].coverage-status`);
  expectEqual(ctx, "VAL-OBLIGATION-REGISTER-005", PROPOSAL_TRACE_PATH, row["atom-relation"], "direct", `change-atom-coverage-register[${id}].atom-relation`);
  if (strip(row["artifact-projection"]) === "contextual-only") {
    addError(ctx, "VAL-OBLIGATION-REGISTER-006", PROPOSAL_TRACE_PATH, `${id} 是 direct atom，artifact-projection 不得为 contextual-only。`);
  }
  if (row.capability !== undefined && strip(row.capability) !== strip(row["owner-capability"])) {
    addError(ctx, "VAL-OBLIGATION-REGISTER-007", PROPOSAL_TRACE_PATH, `${id} 的辅助 capability 与 owner-capability 不一致。`);
  }

  const atom = handoff.atomById.get(id);
  const mapping = handoff.mappingById.get(id);
  if (!atom) {
    addError(ctx, "VAL-OBLIGATION-REGISTER-008", PROPOSAL_TRACE_PATH, `${id} 在 obligation-atom-index.json 中不存在。`);
  }
  if (!mapping) {
    addError(ctx, "VAL-OBLIGATION-REGISTER-009", PROPOSAL_TRACE_PATH, `${id} 在 atom-plan-mapping.json 中不存在。`);
  }
  if (atom) {
    expectEqual(ctx, "VAL-OBLIGATION-REGISTER-010", PROPOSAL_TRACE_PATH, row["source-document"], atom["source-document"], `${id}.source-document`);
    expectEqual(ctx, "VAL-OBLIGATION-REGISTER-011", PROPOSAL_TRACE_PATH, row.lines, atom.lines, `${id}.lines`);
    expectEqual(ctx, "VAL-OBLIGATION-REGISTER-012", PROPOSAL_TRACE_PATH, row["atom-type"], atom["atom-type"], `${id}.atom-type`);
    expectEqual(ctx, "VAL-OBLIGATION-REGISTER-013", PROPOSAL_TRACE_PATH, row["source-fact"], atom["source-fact"], `${id}.source-fact`);
    expectEqual(ctx, "VAL-OBLIGATION-REGISTER-014", PROPOSAL_TRACE_PATH, row.normativity, atom.normativity, `${id}.normativity`);
  }
  if (mapping) {
    expectEqual(ctx, "VAL-OBLIGATION-REGISTER-015", PROPOSAL_TRACE_PATH, mapping["final-owner-change"], ctx.change, `${id}.final-owner-change`);
    expectEqual(ctx, "VAL-OBLIGATION-REGISTER-016", PROPOSAL_TRACE_PATH, mapping["final-relation"], "direct", `${id}.final-relation`);
    expectEqual(ctx, "VAL-OBLIGATION-REGISTER-017", PROPOSAL_TRACE_PATH, row["artifact-projection"], mapping["final-artifact-projection"], `${id}.artifact-projection`);
    expectEqual(ctx, "VAL-OBLIGATION-REGISTER-018", PROPOSAL_TRACE_PATH, row["owner-capability"], mapping["final-owner-capability"], `${id}.owner-capability`);
    expectEqual(ctx, "VAL-OBLIGATION-REGISTER-019", PROPOSAL_TRACE_PATH, row["atom-relation"], mapping["final-relation"], `${id}.atom-relation`);
  }
  expectRepoFileIfPathLike(ctx, "VAL-OBLIGATION-REGISTER-020", row["source-document"], `${id}.source-document`);
}

function validateSourceWindowReadSet(ctx, readSet, register) {
  const registerById = indexRowsById(ctx, "VAL-OBLIGATION-READSET-001", PROPOSAL_TRACE_PATH, register, "global-atom-id");
  const readSetById = indexRowsById(ctx, "VAL-OBLIGATION-READSET-002", PROPOSAL_TRACE_PATH, readSet, "global-atom-id");
  expectSameSet(ctx, "VAL-OBLIGATION-READSET-003", PROPOSAL_TRACE_PATH, [...readSetById.keys()], [...registerById.keys()], "source-window-read-set vs direct register");

  for (const [id, row] of readSetById.entries()) {
    for (const field of ["global-atom-id", "source-document", "line-range", "source-fact", "read-purpose"]) {
      requireString(ctx, "VAL-OBLIGATION-READSET-004", PROPOSAL_TRACE_PATH, row[field], `source-window-read-set[${id}].${field}`);
    }
    const registerRow = registerById.get(id);
    if (!registerRow) continue;
    expectEqual(ctx, "VAL-OBLIGATION-READSET-005", PROPOSAL_TRACE_PATH, row["source-document"], registerRow["source-document"], `${id}.read-set.source-document`);
    expectEqual(ctx, "VAL-OBLIGATION-READSET-006", PROPOSAL_TRACE_PATH, row["line-range"], registerRow.lines, `${id}.read-set.line-range`);
    expectEqual(ctx, "VAL-OBLIGATION-READSET-007", PROPOSAL_TRACE_PATH, row["source-fact"], registerRow["source-fact"], `${id}.read-set.source-fact`);
  }
}

function validateProductionSourceCoverage(ctx, sourceCoverage, register) {
  const registerGroups = groupBy(register, (row) => strip(row["source-document"]));
  const coverageGroups = groupBy(sourceCoverage, (row) => strip(row["source-document"]));
  expectSameSet(ctx, "VAL-OBLIGATION-SOURCE-001", PROPOSAL_TRACE_PATH, [...coverageGroups.keys()], [...registerGroups.keys()], "production-source-coverage source-document groups");

  for (const [sourceDocument, rows] of coverageGroups.entries()) {
    if (rows.length !== 1) {
      addError(ctx, "VAL-OBLIGATION-SOURCE-002", PROPOSAL_TRACE_PATH, `production-source-coverage 对 ${sourceDocument} 必须只有一行。`);
      continue;
    }
    const row = rows[0];
    requireString(ctx, "VAL-OBLIGATION-SOURCE-003", PROPOSAL_TRACE_PATH, row["source-document"], `production-source-coverage[${sourceDocument}].source-document`);
    requireString(ctx, "VAL-OBLIGATION-SOURCE-004", PROPOSAL_TRACE_PATH, row["proposal-use"], `production-source-coverage[${sourceDocument}].proposal-use`);
    const ids = requireIdArray(ctx, "VAL-OBLIGATION-SOURCE-005", PROPOSAL_TRACE_PATH, row["global-atom-ids"], `${sourceDocument}.global-atom-ids`, GA_ID_RE);
    const expectedRows = registerGroups.get(sourceDocument) ?? [];
    const expectedIds = expectedRows.map((item) => strip(item["global-atom-id"]));
    expectSameSet(ctx, "VAL-OBLIGATION-SOURCE-006", PROPOSAL_TRACE_PATH, ids, expectedIds, `${sourceDocument}.global-atom-ids`);
    expectEqual(ctx, "VAL-OBLIGATION-SOURCE-007", PROPOSAL_TRACE_PATH, row["atom-count"], ids.length, `${sourceDocument}.atom-count`);
    expectSameSet(
      ctx,
      "VAL-OBLIGATION-SOURCE-008",
      PROPOSAL_TRACE_PATH,
      asArray(row["line-ranges"]).map(strip).filter(Boolean),
      expectedRows.map((item) => strip(item.lines)),
      `${sourceDocument}.line-ranges`,
    );
    expectSameSet(
      ctx,
      "VAL-OBLIGATION-SOURCE-009",
      PROPOSAL_TRACE_PATH,
      asArray(row["artifact-projections"]).map(strip).filter(Boolean),
      unique(expectedRows.map((item) => strip(item["artifact-projection"]))),
      `${sourceDocument}.artifact-projections`,
    );
    expectSameSet(
      ctx,
      "VAL-OBLIGATION-SOURCE-010",
      PROPOSAL_TRACE_PATH,
      asArray(row["owner-capabilities"]).map(strip).filter(Boolean),
      unique(expectedRows.map((item) => strip(item["owner-capability"]))),
      `${sourceDocument}.owner-capabilities`,
    );
  }
}

function validateObligationGateCoverage(ctx, gate, register, readSet, handoff) {
  const direct = requireObject(ctx, "VAL-OBLIGATION-GATE-020", PROPOSAL_TRACE_PATH, gate["direct-atoms"], "proposal-alignment-gate.direct-atoms");
  const directIds = requireIdArray(ctx, "VAL-OBLIGATION-GATE-021", PROPOSAL_TRACE_PATH, direct.ids, "proposal-alignment-gate.direct-atoms.ids", GA_ID_RE);
  expectEqual(ctx, "VAL-OBLIGATION-GATE-022", PROPOSAL_TRACE_PATH, direct.count, directIds.length, "proposal-alignment-gate.direct-atoms.count");
  expectSameSet(ctx, "VAL-OBLIGATION-GATE-023", PROPOSAL_TRACE_PATH, directIds, handoff.directAtomIds, "gate direct atoms vs packet direct atoms");

  const registerByProjection = groupIdsBy(register, "artifact-projection", "global-atom-id");
  validateGroupedGateRows(ctx, {
    rulePrefix: "VAL-OBLIGATION-GATE-PROJECTION",
    rows: requireArray(ctx, "VAL-OBLIGATION-GATE-024", PROPOSAL_TRACE_PATH, gate["artifact-projection-coverage"], "proposal-alignment-gate.artifact-projection-coverage"),
    expectedGroups: registerByProjection,
    groupField: "artifact-projection",
    idField: "ids",
    countField: "count",
    requiredTextField: "downstream-expectation",
    idRegex: GA_ID_RE,
  });

  const readSetIds = readSet.map((row) => strip(row["global-atom-id"])).filter(Boolean);
  const reread = requireObject(ctx, "VAL-OBLIGATION-GATE-025", PROPOSAL_TRACE_PATH, gate["source-windows-re-read"], "proposal-alignment-gate.source-windows-re-read");
  const rereadIds = requireIdArray(ctx, "VAL-OBLIGATION-GATE-026", PROPOSAL_TRACE_PATH, reread.ids, "proposal-alignment-gate.source-windows-re-read.ids", GA_ID_RE);
  expectEqual(ctx, "VAL-OBLIGATION-GATE-027", PROPOSAL_TRACE_PATH, reread.count, rereadIds.length, "proposal-alignment-gate.source-windows-re-read.count");
  expectSameSet(ctx, "VAL-OBLIGATION-GATE-028", PROPOSAL_TRACE_PATH, rereadIds, readSetIds, "gate source-windows-re-read vs read set");

  const capabilityGroups = groupIdsBy(register, "owner-capability", "global-atom-id");
  const capabilityRows = requireArray(ctx, "VAL-OBLIGATION-GATE-029", PROPOSAL_TRACE_PATH, gate["capability-increment-coverage"], "proposal-alignment-gate.capability-increment-coverage");
  validateCapabilityRows(ctx, capabilityRows, capabilityGroups, "direct-atom-count", "VAL-OBLIGATION-GATE-CAPABILITY", handoff.changeKind);

  const orphan = requireArray(ctx, "VAL-OBLIGATION-GATE-030", PROPOSAL_TRACE_PATH, gate["orphan-direct-atoms"] ?? [], "proposal-alignment-gate.orphan-direct-atoms");
  if (orphan.length !== 0) {
    addError(ctx, "VAL-OBLIGATION-GATE-031", PROPOSAL_TRACE_PATH, "proposal-alignment-gate.orphan-direct-atoms 必须为空。");
  }
}

function validateOwnerScopedBoundary(ctx, trace, gate, handoff) {
  const rows = asArray(trace["owner-scoped-non-direct-boundary-register"]);
  if (handoff.ownerScopedIds.length > 0 && !Array.isArray(trace["owner-scoped-non-direct-boundary-register"])) {
    addError(ctx, "VAL-OBLIGATION-BOUNDARY-001", PROPOSAL_TRACE_PATH, "final packet 有 owner-scoped non-direct atoms，trace 必须包含 owner-scoped-non-direct-boundary-register。");
  }

  const boundaryById = indexRowsById(ctx, "VAL-OBLIGATION-BOUNDARY-002", PROPOSAL_TRACE_PATH, rows, "global-atom-id");
  expectSameSet(ctx, "VAL-OBLIGATION-BOUNDARY-003", PROPOSAL_TRACE_PATH, [...boundaryById.keys()], handoff.ownerScopedIds, "owner-scoped boundary rows vs packet owner-scoped ids");

  const gateOwner = requireObject(ctx, "VAL-OBLIGATION-BOUNDARY-004", PROPOSAL_TRACE_PATH, gate["owner-scoped-non-direct-atoms"], "proposal-alignment-gate.owner-scoped-non-direct-atoms");
  const gateOwnerIds = requireIdArray(ctx, "VAL-OBLIGATION-BOUNDARY-005", PROPOSAL_TRACE_PATH, gateOwner.ids ?? [], "proposal-alignment-gate.owner-scoped-non-direct-atoms.ids", GA_ID_RE);
  expectEqual(ctx, "VAL-OBLIGATION-BOUNDARY-006", PROPOSAL_TRACE_PATH, gateOwner.count, gateOwnerIds.length, "proposal-alignment-gate.owner-scoped-non-direct-atoms.count");
  expectSameSet(ctx, "VAL-OBLIGATION-BOUNDARY-007", PROPOSAL_TRACE_PATH, gateOwnerIds, [...boundaryById.keys()], "gate owner-scoped ids vs boundary rows");
  expectEqual(ctx, "VAL-OBLIGATION-BOUNDARY-008", PROPOSAL_TRACE_PATH, gateOwner["downstream-trace-policy"], "do-not-propagate-ga", "owner-scoped-non-direct-atoms.downstream-trace-policy");

  const directSet = new Set(handoff.directAtomIds);
  for (const [id, row] of boundaryById.entries()) {
    if (directSet.has(id)) {
      addError(ctx, "VAL-OBLIGATION-BOUNDARY-009", PROPOSAL_TRACE_PATH, `${id} 同时出现在 direct register 和 owner-scoped boundary。`);
    }
    validateOwnerScopedBoundaryRow(ctx, row, id, handoff);
  }
}

function validateOwnerScopedBoundaryRow(ctx, row, id, handoff) {
  const requiredFields = [
    "global-atom-id",
    "source-document",
    "lines",
    "atom-type",
    "source-fact",
    "normativity",
    "coverage-status",
    "owner-capability",
    "atom-relation",
    "boundary-role",
    "downstream-trace-policy",
    "boundary-handling",
    "original-artifact-projection",
    "propose-use",
    "evidence-need",
  ];
  for (const field of requiredFields) {
    requireString(ctx, "VAL-OBLIGATION-BOUNDARY-010", PROPOSAL_TRACE_PATH, row[field], `owner-scoped-non-direct-boundary-register[${id}].${field}`);
  }
  if (row["reference-only"] !== true) {
    addError(ctx, "VAL-OBLIGATION-BOUNDARY-011", PROPOSAL_TRACE_PATH, `${id}.reference-only 必须为 true。`);
  }
  expectEqual(ctx, "VAL-OBLIGATION-BOUNDARY-012", PROPOSAL_TRACE_PATH, row["downstream-trace-policy"], "do-not-propagate-ga", `${id}.downstream-trace-policy`);
  if (Object.hasOwn(row, "artifact-projection")) {
    addError(ctx, "VAL-OBLIGATION-BOUNDARY-013", PROPOSAL_TRACE_PATH, `${id} 是 owner-scoped non-direct boundary，不得写 downstream artifact-projection；只能使用 original-artifact-projection。`);
  }

  const atom = handoff.atomById.get(id);
  const mapping = handoff.mappingById.get(id);
  if (!atom) {
    addError(ctx, "VAL-OBLIGATION-BOUNDARY-014", PROPOSAL_TRACE_PATH, `${id} 在 obligation-atom-index.json 中不存在。`);
  }
  if (!mapping) {
    addError(ctx, "VAL-OBLIGATION-BOUNDARY-015", PROPOSAL_TRACE_PATH, `${id} 在 atom-plan-mapping.json 中不存在。`);
  }
  if (atom) {
    expectEqual(ctx, "VAL-OBLIGATION-BOUNDARY-016", PROPOSAL_TRACE_PATH, row["source-document"], atom["source-document"], `${id}.source-document`);
    expectEqual(ctx, "VAL-OBLIGATION-BOUNDARY-017", PROPOSAL_TRACE_PATH, row.lines, atom.lines, `${id}.lines`);
    expectEqual(ctx, "VAL-OBLIGATION-BOUNDARY-018", PROPOSAL_TRACE_PATH, row["atom-type"], atom["atom-type"], `${id}.atom-type`);
    expectEqual(ctx, "VAL-OBLIGATION-BOUNDARY-019", PROPOSAL_TRACE_PATH, row["source-fact"], atom["source-fact"], `${id}.source-fact`);
    expectEqual(ctx, "VAL-OBLIGATION-BOUNDARY-020", PROPOSAL_TRACE_PATH, row.normativity, atom.normativity, `${id}.normativity`);
  }
  if (mapping) {
    expectEqual(ctx, "VAL-OBLIGATION-BOUNDARY-021", PROPOSAL_TRACE_PATH, mapping["final-owner-change"], ctx.change, `${id}.final-owner-change`);
    if (strip(mapping["final-relation"]) === "direct") {
      addError(ctx, "VAL-OBLIGATION-BOUNDARY-022", PROPOSAL_TRACE_PATH, `${id} 的 mapping final-relation 是 direct，不能进入 owner-scoped boundary。`);
    }
    expectEqual(ctx, "VAL-OBLIGATION-BOUNDARY-023", PROPOSAL_TRACE_PATH, row["owner-capability"], mapping["final-owner-capability"], `${id}.owner-capability`);
    expectEqual(ctx, "VAL-OBLIGATION-BOUNDARY-024", PROPOSAL_TRACE_PATH, row["atom-relation"], mapping["final-relation"], `${id}.atom-relation`);
    expectEqual(ctx, "VAL-OBLIGATION-BOUNDARY-025", PROPOSAL_TRACE_PATH, row["original-artifact-projection"], mapping["final-artifact-projection"], `${id}.original-artifact-projection`);
  }
}

function validateDefaultProposal(ctx, trace) {
  validateDefaultNoObligationLeak(ctx, trace);

  const readSet = requireArray(ctx, "VAL-DEFAULT-PROPOSAL-001", PROPOSAL_TRACE_PATH, trace["baseline-input-read-set"], "baseline-input-read-set");
  const scopeCoverage = requireArray(ctx, "VAL-DEFAULT-PROPOSAL-002", PROPOSAL_TRACE_PATH, trace["change-scope-coverage"], "change-scope-coverage");
  const gate = requireObject(ctx, "VAL-DEFAULT-PROPOSAL-003", PROPOSAL_TRACE_PATH, trace["proposal-alignment-gate"], "proposal-alignment-gate");

  validateDefaultDeliveryPlane(ctx, trace["delivery-plane"]);
  validateBaselineInputReadSet(ctx, readSet);
  validateChangeScopeCoverage(ctx, scopeCoverage);
  validateDefaultGate(ctx, gate, readSet, scopeCoverage);
}

function validateDefaultNoObligationLeak(ctx, trace) {
  const text = JSON.stringify(trace ?? {});
  const forbidden = [
    [/\bGA-\d{4}\b/u, "GA-####"],
    [/openspec\/orchestrate/u, "openspec/orchestrate"],
    [/final-packet-index/u, "final-packet-index"],
    [/obligation-atom-index/u, "obligation-atom-index"],
    [/capability-anchors/u, "capability-anchors"],
    [/global-atom-id/u, "global-atom-id"],
    [/global atom index/iu, "global atom index"],
  ];
  for (const [pattern, label] of forbidden) {
    if (pattern.test(text)) {
      addError(ctx, "VAL-DEFAULT-SCOPE-001", PROPOSAL_TRACE_PATH, `default proposal 不得包含 obligation authority：${label}`);
    }
  }
}

function validateDefaultDeliveryPlane(ctx, deliveryPlane) {
  const text = JSON.stringify(deliveryPlane ?? {});
  if (/\bGA-\d{4}\b/u.test(text)) {
    addError(ctx, "VAL-DEFAULT-DELIVERY-001", PROPOSAL_TRACE_PATH, "delivery-plane 不得包含 GA-#### obligation coverage。");
  }
  if (/\bSI-\d{3}\b/u.test(text)) {
    addError(ctx, "VAL-DEFAULT-DELIVERY-002", PROPOSAL_TRACE_PATH, "delivery-plane 不得包含 SI-### scope coverage 列表。");
  }
  for (const phrase of ["Scope Items:", "scope coverage", "alignment gate"]) {
    if (text.includes(phrase)) {
      addError(ctx, "VAL-DEFAULT-DELIVERY-003", PROPOSAL_TRACE_PATH, `delivery-plane 不得包含 trace/gate 泄漏短语：${phrase}`);
    }
  }
}

function validateBaselineInputReadSet(ctx, readSet) {
  const readSetById = indexRowsById(ctx, "VAL-DEFAULT-READSET-001", PROPOSAL_TRACE_PATH, readSet, "input-id");
  for (const [id, row] of readSetById.entries()) {
    if (!BI_ID_RE.test(id)) {
      addError(ctx, "VAL-DEFAULT-READSET-002", PROPOSAL_TRACE_PATH, `${id} 不是合法 BI-###。`);
    }
    for (const field of ["input-id", "input-type", "source", "read-purpose", "interpretation-result"]) {
      requireString(ctx, "VAL-DEFAULT-READSET-003", PROPOSAL_TRACE_PATH, row[field], `baseline-input-read-set[${id}].${field}`);
    }
    if (!DEFAULT_INPUT_TYPES.has(strip(row["input-type"]))) {
      addError(ctx, "VAL-DEFAULT-READSET-004", PROPOSAL_TRACE_PATH, `${id}.input-type 不在允许集合：${strip(row["input-type"])}`);
    }
  }
}

function validateChangeScopeCoverage(ctx, scopeCoverage) {
  const scopeById = indexRowsById(ctx, "VAL-DEFAULT-SCOPE-010", PROPOSAL_TRACE_PATH, scopeCoverage, "scope-item-id");
  for (const [id, row] of scopeById.entries()) {
    if (!SI_ID_RE.test(id)) {
      addError(ctx, "VAL-DEFAULT-SCOPE-011", PROPOSAL_TRACE_PATH, `${id} 不是合法 SI-###。`);
    }
    if (Object.hasOwn(row, "global-atom-id")) {
      addError(ctx, "VAL-DEFAULT-SCOPE-012", PROPOSAL_TRACE_PATH, `${id} 不得包含 global-atom-id。`);
    }
    for (const field of ["scope-item-id", "source", "source-fact", "artifact-handling", "capability", "propose-use", "downstream-coverage-expectation"]) {
      requireString(ctx, "VAL-DEFAULT-SCOPE-013", PROPOSAL_TRACE_PATH, row[field], `change-scope-coverage[${id}].${field}`);
    }
    if (!DEFAULT_ARTIFACT_HANDLINGS.has(strip(row["artifact-handling"]))) {
      addError(ctx, "VAL-DEFAULT-SCOPE-014", PROPOSAL_TRACE_PATH, `${id}.artifact-handling 不在允许集合：${strip(row["artifact-handling"])}`);
    }
  }
}

function validateDefaultGate(ctx, gate, readSet, scopeCoverage) {
  expectEqual(ctx, "VAL-DEFAULT-GATE-001", PROPOSAL_TRACE_PATH, gate["change-slug"], ctx.change, "proposal-alignment-gate.change-slug");
  const scopeItems = requireObject(ctx, "VAL-DEFAULT-GATE-002", PROPOSAL_TRACE_PATH, gate["scope-items"], "proposal-alignment-gate.scope-items");
  const gateScopeIds = requireIdArray(ctx, "VAL-DEFAULT-GATE-003", PROPOSAL_TRACE_PATH, scopeItems.ids, "proposal-alignment-gate.scope-items.ids", SI_ID_RE);
  const scopeIds = scopeCoverage.map((row) => strip(row["scope-item-id"])).filter(Boolean);
  expectEqual(ctx, "VAL-DEFAULT-GATE-004", PROPOSAL_TRACE_PATH, scopeItems.count, gateScopeIds.length, "proposal-alignment-gate.scope-items.count");
  expectSameSet(ctx, "VAL-DEFAULT-GATE-005", PROPOSAL_TRACE_PATH, gateScopeIds, scopeIds, "gate scope-items vs change-scope-coverage");

  const readInputs = requireObject(ctx, "VAL-DEFAULT-GATE-006", PROPOSAL_TRACE_PATH, gate["baseline-inputs-read"], "proposal-alignment-gate.baseline-inputs-read");
  const gateInputIds = requireIdArray(ctx, "VAL-DEFAULT-GATE-007", PROPOSAL_TRACE_PATH, readInputs.ids, "proposal-alignment-gate.baseline-inputs-read.ids", BI_ID_RE);
  const readSetIds = readSet.map((row) => strip(row["input-id"])).filter(Boolean);
  expectEqual(ctx, "VAL-DEFAULT-GATE-008", PROPOSAL_TRACE_PATH, readInputs.count, gateInputIds.length, "proposal-alignment-gate.baseline-inputs-read.count");
  expectSameSet(ctx, "VAL-DEFAULT-GATE-009", PROPOSAL_TRACE_PATH, gateInputIds, readSetIds, "gate baseline-inputs-read vs baseline-input-read-set");

  const handlingGroups = groupIdsBy(scopeCoverage, "artifact-handling", "scope-item-id");
  validateGroupedGateRows(ctx, {
    rulePrefix: "VAL-DEFAULT-GATE-HANDLING",
    rows: requireArray(ctx, "VAL-DEFAULT-GATE-010", PROPOSAL_TRACE_PATH, gate["artifact-handling-coverage"], "proposal-alignment-gate.artifact-handling-coverage"),
    expectedGroups: handlingGroups,
    groupField: "artifact-handling",
    idField: "ids",
    countField: "count",
    requiredTextField: "downstream-expectation",
    idRegex: SI_ID_RE,
  });

  const capabilityGroups = groupIdsBy(scopeCoverage, "capability", "scope-item-id");
  const capabilityRows = requireArray(ctx, "VAL-DEFAULT-GATE-011", PROPOSAL_TRACE_PATH, gate["capability-increment-coverage"], "proposal-alignment-gate.capability-increment-coverage");
  validateCapabilityRows(ctx, capabilityRows, capabilityGroups, "scope-item-count", "VAL-DEFAULT-GATE-CAPABILITY");

  const orphan = requireArray(ctx, "VAL-DEFAULT-GATE-012", PROPOSAL_TRACE_PATH, gate["orphan-scope-items"] ?? [], "proposal-alignment-gate.orphan-scope-items");
  if (orphan.length !== 0) {
    addError(ctx, "VAL-DEFAULT-GATE-013", PROPOSAL_TRACE_PATH, "proposal-alignment-gate.orphan-scope-items 必须为空。");
  }

  const blockers = requireArray(ctx, "VAL-DEFAULT-GATE-014", PROPOSAL_TRACE_PATH, gate.blockers ?? [], "proposal-alignment-gate.blockers");
  if (blockers.length !== 0) {
    addError(ctx, "VAL-DEFAULT-GATE-015", PROPOSAL_TRACE_PATH, "proposal-alignment-gate.blockers 必须为空；非空 blocker 不能进入 validator pass。");
  }
}

function validateGroupedGateRows(ctx, options) {
  const {
    rulePrefix,
    rows,
    expectedGroups,
    groupField,
    idField,
    countField,
    requiredTextField,
    idRegex,
  } = options;
  const actualGroups = new Map();
  for (const row of rows) {
    const group = strip(row?.[groupField]);
    if (!group) {
      addError(ctx, `${rulePrefix}-001`, PROPOSAL_TRACE_PATH, `${groupField} coverage row 缺少 ${groupField}。`);
      continue;
    }
    if (actualGroups.has(group)) {
      addError(ctx, `${rulePrefix}-002`, PROPOSAL_TRACE_PATH, `${groupField} coverage 重复分组：${group}`);
    }
    actualGroups.set(group, row);
    const ids = requireIdArray(ctx, `${rulePrefix}-003`, PROPOSAL_TRACE_PATH, row[idField], `${group}.${idField}`, idRegex);
    expectEqual(ctx, `${rulePrefix}-004`, PROPOSAL_TRACE_PATH, row[countField], ids.length, `${group}.${countField}`);
    requireString(ctx, `${rulePrefix}-005`, PROPOSAL_TRACE_PATH, row[requiredTextField], `${group}.${requiredTextField}`);
  }

  expectSameSet(ctx, `${rulePrefix}-006`, PROPOSAL_TRACE_PATH, [...actualGroups.keys()], [...expectedGroups.keys()], `${groupField} coverage groups`);
  for (const [group, expectedIds] of expectedGroups.entries()) {
    const row = actualGroups.get(group);
    if (!row) continue;
    const ids = asArray(row[idField]).map(strip).filter(Boolean);
    expectSameSet(ctx, `${rulePrefix}-007`, PROPOSAL_TRACE_PATH, ids, expectedIds, `${group}.${idField}`);
  }
}

function validateCapabilityRows(ctx, rows, expectedGroups, countField, rulePrefix, expectedChangeKind = null) {
  const actualGroups = new Map();
  for (const row of rows) {
    const capability = strip(row?.capability);
    if (!capability) {
      addError(ctx, `${rulePrefix}-001`, PROPOSAL_TRACE_PATH, "capability-increment-coverage row 缺少 capability。");
      continue;
    }
    if (actualGroups.has(capability)) {
      addError(ctx, `${rulePrefix}-002`, PROPOSAL_TRACE_PATH, `capability-increment-coverage 重复 capability：${capability}`);
    }
    actualGroups.set(capability, row);
    requireString(ctx, `${rulePrefix}-003`, PROPOSAL_TRACE_PATH, row.advancement, `${capability}.advancement`);
    requireString(ctx, `${rulePrefix}-004`, PROPOSAL_TRACE_PATH, row["coverage-note"], `${capability}.coverage-note`);
    if (expectedChangeKind !== null) {
      expectEqual(ctx, `${rulePrefix}-005`, PROPOSAL_TRACE_PATH, row["change-kind"], expectedChangeKind, `${capability}.change-kind`);
    }
  }

  expectSameSet(ctx, `${rulePrefix}-006`, PROPOSAL_TRACE_PATH, [...actualGroups.keys()], [...expectedGroups.keys()], "capability-increment-coverage groups");
  for (const [capability, expectedIds] of expectedGroups.entries()) {
    const row = actualGroups.get(capability);
    if (!row) continue;
    expectEqual(ctx, `${rulePrefix}-007`, PROPOSAL_TRACE_PATH, row[countField], expectedIds.length, `${capability}.${countField}`);
  }
}

function readRepoJson(ctx, repoRelPath) {
  if (!repoRelPath) return null;
  return readJson(ctx, path.join(ctx.root, repoRelPath));
}

function readJson(ctx, fullPath) {
  if (!fs.existsSync(fullPath)) {
    addError(ctx, "VAL-JSON-001", rel(ctx, fullPath), "JSON 文件不存在。");
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    addError(ctx, "VAL-JSON-002", rel(ctx, fullPath), `严格 JSON 解析失败：${error.message}`);
    return null;
  }
}

function manifestEntryExists(ctx, manifestFullPath, tracePath) {
  if (!fs.existsSync(manifestFullPath)) return false;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestFullPath, "utf8"));
    return asArray(manifest.artifacts).some((entry) => entry?.["trace-path"] === tracePath);
  } catch {
    return true;
  }
}

function indexRowsById(ctx, ruleId, file, rows, idField) {
  const indexed = new Map();
  for (const [index, row] of asArray(rows).entries()) {
    const id = strip(row?.[idField]);
    if (!id) {
      addError(ctx, ruleId, file, `第 ${index + 1} 行缺少 ${idField}。`);
      continue;
    }
    if (indexed.has(id)) {
      addError(ctx, ruleId, file, `${idField} 重复：${id}`);
      continue;
    }
    indexed.set(id, row);
  }
  return indexed;
}

function groupBy(rows, getKey) {
  const groups = new Map();
  for (const row of asArray(rows)) {
    const key = getKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function groupIdsBy(rows, groupField, idField) {
  const groups = new Map();
  for (const row of asArray(rows)) {
    const group = strip(row?.[groupField]);
    const id = strip(row?.[idField]);
    if (!group || !id) continue;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(id);
  }
  for (const [group, ids] of groups.entries()) {
    groups.set(group, unique(ids));
  }
  return groups;
}

function requireObject(ctx, ruleId, file, value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    addError(ctx, ruleId, file, `${label} 必须是 object。`);
    return {};
  }
  return value;
}

function requireArray(ctx, ruleId, file, value, label) {
  if (!Array.isArray(value)) {
    addError(ctx, ruleId, file, `${label} 必须是 array。`);
    return [];
  }
  return value;
}

function requireString(ctx, ruleId, file, value, label) {
  if (!strip(value)) {
    addError(ctx, ruleId, file, `${label} 必须是非空字符串。`);
    return "";
  }
  return strip(value);
}

function requireIdArray(ctx, ruleId, file, value, label, regex) {
  const values = requireArray(ctx, ruleId, file, value, label).map(strip).filter(Boolean);
  const seen = new Set();
  for (const id of values) {
    if (!regex.test(id)) {
      addError(ctx, ruleId, file, `${label} 包含非法 ID：${id}`);
    }
    if (seen.has(id)) {
      addError(ctx, ruleId, file, `${label} 包含重复 ID：${id}`);
    }
    seen.add(id);
  }
  return values;
}

function requireIdlessStringArray(ctx, ruleId, file, value, label) {
  const values = requireArray(ctx, ruleId, file, value, label).map(strip).filter(Boolean);
  if (values.length !== asArray(value).length) {
    addError(ctx, ruleId, file, `${label} 必须全部为非空字符串。`);
  }
  return values;
}

function expectEqual(ctx, ruleId, file, actual, expected, label) {
  if (actual !== expected) {
    addError(ctx, ruleId, file, `${label} 不一致：实际 ${formatValue(actual)}，期望 ${formatValue(expected)}。`);
  }
}

function expectSameSet(ctx, ruleId, file, actualValues, expectedValues, label) {
  const actual = unique(actualValues.map(strip).filter(Boolean));
  const expected = unique(expectedValues.map(strip).filter(Boolean));
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((value) => !actualSet.has(value));
  const extra = actual.filter((value) => !expectedSet.has(value));
  if (missing.length > 0 || extra.length > 0) {
    const parts = [];
    if (missing.length > 0) parts.push(`缺失 ${missing.join(", ")}`);
    if (extra.length > 0) parts.push(`多出 ${extra.join(", ")}`);
    addError(ctx, ruleId, file, `${label} 集合不一致：${parts.join("；")}。`);
  }
}

function expectRepoFile(ctx, ruleId, repoRelPath, label) {
  const fullPath = path.join(ctx.root, repoRelPath);
  if (!fs.existsSync(fullPath)) {
    addError(ctx, ruleId, repoRelPath, `${label} 指向的文件不存在。`);
  }
}

function expectRepoFileIfPathLike(ctx, ruleId, value, label) {
  const repoRelPath = strip(value);
  if (!repoRelPath || !isPathLike(repoRelPath)) return;
  expectRepoFile(ctx, ruleId, repoRelPath, label);
}

function isPathLike(value) {
  return /^(?:docs|openspec|apps|packages|tests|src)\//u.test(value);
}

function addError(ctx, ruleId, file, message) {
  ctx.errors.push({ level: "error", ruleId, file, message });
}

function addWarning(ctx, ruleId, file, message) {
  ctx.warnings.push({ level: "warning", ruleId, file, message });
}

function resultFor(ctx) {
  return {
    ok: ctx.errors.length === 0,
    errors: ctx.errors,
    warnings: ctx.warnings,
  };
}

function formatResult(result, options = {}) {
  const lines = [];
  lines.push(`${result.ok ? "PASS" : "FAIL"} validate-proposal-artifact${options.change ? ` --change ${options.change}` : ""}`);
  if (result.errors.length > 0) {
    lines.push("");
    lines.push("Errors:");
    for (const item of result.errors) {
      lines.push(`- ${item.ruleId} ${item.file}: ${item.message}`);
    }
  }
  if (result.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const item of result.warnings) {
      lines.push(`- ${item.ruleId} ${item.file}: ${item.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--change") options.change = argv[++index];
    else if (arg === "--root") options.root = argv[++index];
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function usage() {
  return `Usage:
  node openspec/agent-runtime/scripts/validators/validate-proposal-artifact.mjs --change <slug> [--root <path>]
`;
}

function rel(ctx, fullPath) {
  return path.relative(ctx.root, fullPath) || ".";
}

function strip(value) {
  return String(value ?? "").trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(values)];
}

function formatValue(value) {
  if (typeof value === "string") return `"${value}"`;
  return JSON.stringify(value);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      process.exit(0);
    }
    const result = validateProposalArtifact(options);
    process.stdout.write(formatResult(result, options));
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
