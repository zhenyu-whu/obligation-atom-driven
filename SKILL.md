---
name: obligation-atom-driven
description: Install or switch a repository to the bundled production-obligation-atom-driven OpenSpec implementation workflow. Use when Codex needs to sync the current projection-aware obligation atom driven schema, proposal/spec/design/tasks templates, and matching OpenSpec agent-runtime constraint documents into a repository, or when older anchor/source-artifact profiles should be replaced by the current GA obligation atom contract.
---

# Obligation Atom Driven

Use this skill to configure a repository so OpenSpec changes use the bundled projection-aware `production-obligation-atom-driven` schema and its paired agent runtime constraints.

## Workflow

1. Inspect the target repository root. Default to the current working directory unless the user names another directory.
2. Read `references/profiles/production-obligation-atom-driven/profile.yaml`.
3. Confirm the profile metadata:
   - `schema_name` is `production-obligation-atom-driven`.
   - `schema_dir` defaults to `schema` when omitted.
4. Sync bundled OpenSpec files into the target repository:
   - Copy `<skill-root>/references/profiles/production-obligation-atom-driven/<schema_dir>/` to `<repo-root>/openspec/schemas/<schema_name>/`.
   - Copy `<skill-root>/references/agent-runtime/*.md` to `<repo-root>/openspec/agent-runtime/`.
   - Create or update `<repo-root>/openspec/config.yaml` so the top-level `schema:` value is `<schema_name>`.
   - Preserve unrelated project-specific config entries when updating an existing `openspec/config.yaml`.
   - If target schema or runtime files already exist and differ, inspect the differences and update them intentionally.
5. Update project instructions:
   - Read `<skill-root>/references/agent-runtime/agents-md-runtime-section.md`.
   - Add its runtime section to the target repository `AGENTS.md`, preserving existing project-specific instructions.
   - If an equivalent OpenSpec runtime section already exists, update it instead of adding a duplicate.
6. Verify the result:
   - `openspec/config.yaml` has `schema: production-obligation-atom-driven`.
   - `openspec/schemas/production-obligation-atom-driven/schema.yaml` exists.
   - `openspec/schemas/production-obligation-atom-driven/templates/` contains the bundled templates.
   - `openspec/agent-runtime/*.md` contains the installed runtime constraint files.
   - `AGENTS.md` includes the runtime section from `references/agent-runtime/agents-md-runtime-section.md`.
   - If the repository has OpenSpec CLI available, run `openspec list --json` to inspect active changes, then run `openspec status --change "<name>" --json` for the relevant change when useful.

## Bundled Resources

- `references/profiles/production-obligation-atom-driven/`: profile metadata and schema files for the production obligation atom driven OpenSpec workflow.
- `references/profiles/production-obligation-atom-driven/schema/schema.yaml`: projection-aware schema that consumes canonical final change packets and `obligation-atom-index.md` directly from `openspec/orchestrate`, creates proposal, specs, design, and acceptance-driven tasks, distinguishes `spec-requirement`, `spec-guard`, `design-obligation`, `verification-obligation`, and `contextual-only` atoms, and does not use `source-truth.md`, separate `acceptance.md`, legacy source coverage artifacts, `change-source-map.md`, or pre-proposal source artifacts.
- `references/profiles/production-obligation-atom-driven/schema/templates/`: templates paired with the schema artifacts.
- `references/agent-runtime/`: runtime constraints for OpenSpec propose/apply/archive workflows and the `AGENTS.md` runtime section reference.

## Profile Contract

The bundled profile directory contains:

- `profile.yaml` with `profile`, `schema_name`, and optional `schema_dir`.
- The schema directory named by `schema_dir`, containing `schema.yaml` and templates.

The skill synchronizes this schema directory to `openspec/schemas/production-obligation-atom-driven/`, switches `openspec/config.yaml` to that schema, synchronizes runtime constraints, and updates `AGENTS.md`.
