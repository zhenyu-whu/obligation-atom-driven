---
name: obligation-atom-driven
description: Install or switch a repository to bundled production OpenSpec workflows. Use when Codex needs to sync the docs-driven production-obligation-atom-driven schema, or the post-greenfield production-default-acceptance-driven schema, with their proposal/spec/design/tasks templates and matching OpenSpec agent-runtime constraint documents.
---

# Obligation Atom Driven

Use this skill to configure a repository so OpenSpec changes use one of the bundled production schemas and paired agent runtime constraints.

## Profiles

- `production-obligation-atom-driven`: docs-driven Greenfield implementation schema. It consumes canonical change packets and `obligation-atom-index.md` from `openspec/orchestrate`, preserves `GA-####` IDs, and uses projection-aware proposal/spec/design/tasks artifacts.
- `production-default-acceptance-driven`: post-greenfield evolution schema. It follows the OpenSpec default proposal -> specs -> design -> tasks model, does not consume `openspec/orchestrate`, does not use the old GA-based terminology, and adds lightweight `SI-###` change-local scope coverage, AC acceptance slices, fixed `T-###` tests, execution evidence, and regression test deposits.

The canonical Global Atom ID prefix for `production-obligation-atom-driven` is `GA-####`. Runtime constraints, templates, generated proposal/spec/design/tasks artifacts, and sync verification for that profile must preserve `GA-####` IDs from `obligation-atom-index.md`; do not rewrite them to another global prefix or local source atom ID.

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
   - Copy `<skill-root>/references/shared/*` to `<repo-root>/openspec/schemas/shared/`, including the bundled `verification-regression-gates.md` used by both production schemas.
   - Copy `<skill-root>/references/agent-runtime/*.md` to `<repo-root>/openspec/agent-runtime/`.
   - Preserve the bundled apply runtime requirement that any apply-stage `worker`, `change-stabilizer`, or `final-reviewer` subagent must run on `GPT-5.5` with `xhigh` reasoning and must not be downgraded.
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
   - `openspec/schemas/production-obligation-atom-driven/templates/` contains the bundled templates.
   - `openspec/schemas/production-default-acceptance-driven/schema.yaml` exists.
   - `openspec/schemas/production-default-acceptance-driven/templates/` contains the bundled templates.
   - `openspec/schemas/shared/verification-regression-gates.md` exists.
   - `openspec/agent-runtime/*.md` contains the installed runtime constraint files.
   - `AGENTS.md` includes the runtime section from `references/agent-runtime/agents-md-runtime-section.md`.
   - If the repository has OpenSpec CLI available, run `openspec list --json` to inspect active changes, then run `openspec status --change "<name>" --json` for the relevant change when useful.

## Bundled Resources

- `references/profiles/production-obligation-atom-driven/`: profile metadata and schema files for the production obligation atom driven OpenSpec workflow.
- `references/profiles/production-obligation-atom-driven/schema/schema.yaml`: projection-aware schema that consumes canonical final change packets and `obligation-atom-index.md` directly from `openspec/orchestrate`, creates proposal, specs, design, and acceptance-driven tasks, distinguishes `spec-requirement`, `spec-guard`, `design-obligation`, `verification-obligation`, and `contextual-only` atoms, and does not use `source-truth.md`, separate `acceptance.md`, legacy source coverage artifacts, `change-source-map.md`, or pre-proposal source artifacts.
- `references/profiles/production-obligation-atom-driven/schema/templates/`: templates paired with the schema artifacts.
- `references/profiles/production-default-acceptance-driven/`: profile metadata and schema files for post-greenfield production evolution.
- `references/profiles/production-default-acceptance-driven/schema/schema.yaml`: default-style schema that uses proposal, specs, design, and acceptance-driven tasks; it does not consume orchestrate packets or global indexes, and instead uses change-local `SI-###` scope items only for lightweight cross-artifact coverage.
- `references/profiles/production-default-acceptance-driven/schema/templates/`: templates paired with the default-style acceptance-driven schema.
- `references/agent-runtime/`: runtime constraints for OpenSpec propose/apply/archive workflows and the `AGENTS.md` runtime section reference. The apply runtime hard-requires apply-stage `worker`, `change-stabilizer`, and `final-reviewer` subagents to use `GPT-5.5` with `xhigh` reasoning and forbids downgrades. It also requires at most one automatic post-worker `change-stabilizer` repair pass before the read-only `final-reviewer`; any final-reviewer blocker after stabilization stops the apply flow for human review.
- `references/shared/verification-regression-gates.md`: shared testing gate required by both production schemas. It is synced to `openspec/schemas/shared/verification-regression-gates.md`.

## Profile Contract

The bundled profile directory contains:

- `profile.yaml` with `profile`, `schema_name`, and optional `schema_dir`.
- The schema directory named by `schema_dir`, containing `schema.yaml` and templates.

The skill synchronizes the selected schema directory to `openspec/schemas/<schema_name>/`, switches `openspec/config.yaml` to that schema, synchronizes runtime constraints, and updates `AGENTS.md`.
