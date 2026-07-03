---
name: obligation-atom-driven
description: Install or switch a repository to bundled production OpenSpec workflows. Use when Codex needs to sync the docs-driven production-obligation-atom-driven schema, or the post-greenfield production-default-acceptance-driven schema, with their trace-first JSONC authoring guides, deterministic Delivery Plane rendering, and matching OpenSpec agent-runtime constraint documents.
---

# Obligation Atom Driven

Use this skill to configure a repository so OpenSpec changes use one of the bundled production schemas and paired agent runtime constraints.

## Profiles

- `production-obligation-atom-driven`: docs-driven Greenfield implementation schema. It consumes stable source-aligned JSON handoff sidecars plus canonical change packet Markdown mirrors from `openspec/orchestrate`, preserves `GA-####` IDs, and uses JSON Trace Plane files as the canonical authoring source for deterministic Delivery Plane proposal/spec/design/runtime-acceptance/verification/tasks rendering with short terminal `Trace Appendix` pointer blocks. It does not execute upstream source-aligned skill scripts. `runtime-acceptance.trace.json` owns canonical runtime `RS-/OP-/ST-/CH-` rows, `verification.trace.json#/proof-slice-model` owns slice-only independent test intent and atomic Proof Slices, and `tasks.trace.json` owns task delivery projection.
- `production-default-acceptance-driven`: post-greenfield evolution schema. It follows the OpenSpec default proposal -> specs -> design -> runtime-acceptance -> verification -> tasks model, adds independent slice-only verification through `verification.trace.json#/proof-slice-model`, does not consume `openspec/orchestrate`, does not use the old GA-based terminology, and uses lightweight `SI-###` change-local scope coverage in `trace/proposal.trace.json` plus AC delivery sections in `trace/tasks.trace.json`.

The canonical Global Atom ID prefix for `production-obligation-atom-driven` is `GA-####`. Runtime constraints, trace templates, generated proposal/spec/design/tasks artifacts, and sync verification for that profile must preserve `GA-####` IDs from `obligation-atom-index.md`; do not rewrite them to another global prefix or local source atom ID.

The `production-default-acceptance-driven` profile uses change-local `SI-###` scope item IDs only inside a single change. These IDs are not global source IDs and must not be treated as a global registry.

## Runtime Schema Selection Contract

When OpenSpec artifact-generation skills run in a repository configured by this skill, they must select the schema from the user's actual propose input:

- If `openspec-propose` is triggered with no explicit change name and no substantive change description, use `production-obligation-atom-driven` and the orchestrate-backed final planned change auto-inference flow.
- If `openspec-propose` is triggered with any explicit change name, feature request, bug fix, modification, or other substantive input, use `production-default-acceptance-driven`.
- Runtime selection must be made before `openspec new change`. Use an explicit `--schema <schema_name>` whenever needed; do not rely on the top-level `openspec/config.yaml` default to infer the user's input mode.
- Because runtime selection can choose either profile, a configured repository should have both bundled production schemas installed under `openspec/schemas/`.

## Workflow

1. Inspect the target repository root. Default to the current working directory unless the user names another directory.
2. Select the repository default profile:
   - If the user asks for the current docs-driven, atom-driven, orchestrate-backed, or GA-based workflow, select `production-obligation-atom-driven`.
   - If the user asks for the default-style, post-greenfield, follow-up feature/modification, or acceptance-driven workflow, select `production-default-acceptance-driven`.
   - If the user does not specify a profile, default to `production-obligation-atom-driven` to preserve the existing behavior.
3. Read `references/profiles/<schema_name>/profile.yaml` for the selected repository default profile.
4. Confirm the selected profile metadata:
   - `schema_name` matches the selected profile.
   - `schema_dir` defaults to `schema` when omitted.
5. Sync bundled OpenSpec files into the target repository:
   - Copy every bundled production profile schema directory from `<skill-root>/references/profiles/<profile>/schema/` to `<repo-root>/openspec/schemas/<profile>/`, including both `production-obligation-atom-driven` and `production-default-acceptance-driven`.
   - Copy `<skill-root>/references/profiles/_production-contracts/` to `<repo-root>/openspec/schemas/_production-contracts/`; this directory intentionally contains no `schema.yaml` and is read as the shared writer/reviewer contract bundle, not as an OpenSpec schema.
   - Copy `<skill-root>/references/agent-runtime/*.md` to `<repo-root>/openspec/agent-runtime/`.
   - Copy `<skill-root>/references/agent-runtime/scripts/` to `<repo-root>/openspec/agent-runtime/scripts/` when present, preserving executable artifact validator scripts and their fixture tests.
   - Preserve the bundled propose runtime checkpoint commit policy: any propose-stage `<artifact-id>-writer` or `<artifact-id>-repair-writer` that modifies allowed artifact files must create a `git commit --no-verify` checkpoint before natural return; these commits are process audit records and must not be treated as validator pass, reviewer pass, apply-ready, or ready-to-archive signals.
   - Preserve the bundled apply runtime requirement that any apply-stage `implementation-worker`, `test-worker`, `fix-worker`, `change-stabilizer`, or `final-reviewer` subagent must run on `GPT-5.5` with `xhigh` reasoning and must not be downgraded.
   - Preserve the bundled checkpoint commit policy for write-stage apply agents: write-stage checkpoint commits are process audit records, use `git commit --no-verify`, and must not be treated as proof evidence or ready-to-archive signals.
   - Create or update `<repo-root>/openspec/config.yaml` so the top-level `schema:` value is `<schema_name>`.
   - Preserve unrelated project-specific config entries when updating an existing `openspec/config.yaml`.
   - If target schema or runtime files already exist and differ, inspect the differences and update them intentionally.
6. Update project instructions:
   - Read `<skill-root>/references/agent-runtime/agents-md-runtime-section.md`.
   - Add its runtime section to the target repository `AGENTS.md`, preserving existing project-specific instructions.
   - If an equivalent OpenSpec runtime section already exists, update it instead of adding a duplicate.
7. Verify the result:
   - `openspec/config.yaml` has `schema: <schema_name>`.
   - `openspec/schemas/production-obligation-atom-driven/schema.yaml` exists.
   - `openspec/schemas/production-obligation-atom-driven/templates/` contains the bundled trace JSONC authoring guide templates.
   - `openspec/schemas/production-default-acceptance-driven/schema.yaml` exists.
   - `openspec/schemas/production-default-acceptance-driven/templates/` contains the bundled trace JSONC authoring guide templates.
   - `openspec/schemas/_production-contracts/` exists and `find openspec/schemas/_production-contracts -name schema.yaml -print` returns no files.
   - `openspec/agent-runtime/*.md` contains the installed runtime constraint files.
   - `openspec/agent-runtime/scripts/validate-production-artifacts.mjs` exists when bundled by the skill.
   - `openspec/agent-runtime/scripts/render-production-artifacts.mjs` exists when bundled by the skill.
   - `openspec/agent-runtime/scripts/validators/` contains the bundled per-artifact validators when bundled by the skill.
   - `AGENTS.md` includes the runtime section from `references/agent-runtime/agents-md-runtime-section.md`.
   - If the repository has OpenSpec CLI available, run `openspec list --json` to inspect active changes, then run `openspec status --change "<name>" --json` for the relevant change when useful.

## Bundled Resources

- `references/profiles/production-obligation-atom-driven/`: profile metadata and schema files for the production obligation atom driven OpenSpec workflow.
- `references/profiles/production-obligation-atom-driven/schema/schema.yaml`: projection-aware schema that consumes source-aligned JSON handoff sidecars and canonical final change packet Markdown mirrors directly from `openspec/orchestrate`, keeps proposal, specs, design, runtime-acceptance, verification, and tasks as the OpenSpec CLI entrypoints, and delegates repeated writer/reviewer requirements to the shared contract bundle.
- `references/profiles/production-obligation-atom-driven/schema/templates/`: JSONC trace/proof-slice authoring guide templates paired with the schema artifacts; they are not Markdown artifact templates.
- `references/profiles/production-default-acceptance-driven/`: profile metadata and schema files for post-greenfield production evolution.
- `references/profiles/production-default-acceptance-driven/schema/schema.yaml`: default-style schema that keeps proposal, specs, design, runtime-acceptance, verification, and tasks as the OpenSpec CLI entrypoints, does not consume orchestrate packets or global indexes, uses change-local `SI-###` scope items, and delegates repeated writer/reviewer requirements to the shared contract bundle.
- `references/profiles/production-default-acceptance-driven/schema/templates/`: JSONC trace/proof-slice authoring guide templates paired with the default-style acceptance-driven schema; they are not Markdown artifact templates.
- `references/profiles/_production-contracts/`: shared contract bundle read by both production schemas and by per-artifact writer/reviewer agents. It contains common rules, artifact-specific contracts, profile input contracts, and schema-specific overlays; it intentionally contains no `schema.yaml`.
- `references/agent-runtime/`: runtime constraints for OpenSpec propose/apply/archive workflows, the `AGENTS.md` runtime section reference, `scripts/render-production-artifacts.mjs`, `scripts/validate-production-artifacts.mjs`, modular validators under `scripts/validators/`, and fixture tests. The propose runtime requires writers to write JSON trace first, keep the current verification Proof Slice model inline at `trace/verification.trace.json#/proof-slice-model`, invoke the deterministic renderer for Markdown artifacts, create `git commit --no-verify` checkpoint commits for propose-stage writer/repair-writer file changes, then run partial validator, read-only reviewer, main-agent repair, and hard validator gates, followed by a read-only artifact integration reviewer after the full hard pass. The apply runtime hard-requires Phase 0 static artifact validation and apply-stage `implementation-worker`, `test-worker`, `fix-worker`, `change-stabilizer`, and `final-reviewer` subagents to use `GPT-5.5` with `xhigh` reasoning and forbids downgrades. It also requires write-stage checkpoint commits as process audit records after read/write apply agents, requires test agents to consume atomic Proof Slices through Test Placement Routing instead of writing mixed broad tests, and requires at most one automatic post-worker `change-stabilizer` repair pass before the read-only `final-reviewer`; any final-reviewer blocker after stabilization stops the apply flow for human review.

## Profile Contract

The bundled profile directory contains:

- `profile.yaml` with `profile`, `schema_name`, and optional `schema_dir`.
- The schema directory named by `schema_dir`, containing `schema.yaml` and JSONC trace authoring-guide templates.

The skill synchronizes the selected schema directory to `openspec/schemas/<schema_name>/`, synchronizes shared contracts to `openspec/schemas/_production-contracts/`, switches `openspec/config.yaml` to that schema, synchronizes runtime constraints, and updates `AGENTS.md`.
