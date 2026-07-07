# Obligation Runtime Acceptance Overlay

- `trace/runtime-acceptance.trace.json` 只来自当前 change 的 specs/design traces 中可观察运行事实和 preserve boundary。它不是实现细节、proof handoff 或逐 GA coverage matrix。
- `source-interface` 只能列实际 `trace/specs/**/*.trace.json` 或 no-delta marker trace、`trace/design.trace.json`；不得把 `proposal.md`、`specs/**/*.md`、`design.md` 或 `trace/proposal.trace.json` 作为 runtime semantic input。
- `runtime-fact-register[]` 是唯一 semantic register；每行 `runtime-fact-id` 必须使用 `RS-/OP-/ST-/CH-###`，且 `fact-type` 必须与 ID 前缀一致。
- `source-interface` 不得列 `trace/proposal.trace.json`；`source-basis` 不得包含 `proposal-context[]`、`GA-####` 或 `non-direct-boundary-ref[]` 身份。
- 普通 direct `GA-####` 和 `projection: "verification-obligation"` item 不要求逐项生成 runtime fact；只有已进入 specs/design 的生产语义才可进入 runtime。
- `source-basis.spec-scenarios[]` 必须是实际 specs trace scenario pointer，例如 `trace/specs/<capability>.trace.json#/spec-delta-register/0/scenarios/0`。
- `source-basis.design-decisions[]` 必须是 design `implementation-design-register[]` 中的 exact `IDR-###`。
- 每个 in-scope added/modified spec scenario 和 runtime-affecting `IDR-###` design row 必须至少被一条 runtime fact 覆盖。
- Business mode 只覆盖当前业务 change 的可观察业务运行行为。
- Foundation mode 只覆盖当前 foundation change 的可观察工程运行事实；允许的 fact surfaces 包括 `workspace-script`、`app-skeleton-startup`、`health-readiness`、`config-env`、`prisma-migration-readback`、`openapi-proto-generation`、`package-boundary`、`compose-local-smoke`、`ci-conformance`。
- Foundation mode 下，纯架构原则、未来部署预留、云中立性、非目标、长期 preserve guard 不得生成 runtime fact；只有形成可观察运行事实时才进入 `runtime-fact-register[]`。
