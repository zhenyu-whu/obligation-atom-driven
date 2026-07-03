# Obligation Runtime Acceptance Overlay

- `trace/runtime-acceptance.trace.json` 只来自当前 change 的 proposal/spec/design traces 中可观察运行行为。它不是实现细节或 proof-only handoff 的物化门禁。
- `source-interface` 只能列 `trace/proposal.trace.json`、实际 `trace/specs/**/*.trace.json` 或 no-delta marker trace、`trace/design.trace.json`；不得把 `proposal.md`、`specs/**/*.md` 或 `design.md` 作为 semantic input。
- `upstream-runtime-obligation-inventory[]` 必须使用 exact direct `GA-####`、spec scenario anchor、`D-###` design decision 或 design/proof handoff item；不得传播 non-direct boundary register 中的 GA 身份。
- `trace/runtime-acceptance.trace.json` 的 `runtime-upstream-coverage-map` 只覆盖当前 change 中会产生或约束可观察运行行为的 proposal direct `GA-####`、in-scope spec scenario 和 design decision/guard。
- 每个 covered direct `GA-####` 必须映射到主体具体 runtime row，或有当前 change source-backed not-applicable reason。
- Proposal direct `GA-####` 不得只出现在 `runtime-coverage-source-map` 或 checklist。
- `runtime-upstream-coverage-map` 中 proposal direct item 必须保留 proposal register 的 `artifact-projection`；允许值来自 proposal `change-atom-coverage-register[]`，不得改写为 default `artifact-handling`。
- `runtime-upstream-coverage-map` 每个 `not-applicable` direct `GA-####` 必须写 source-backed reason，且 `runtime-row-ids` 必须为空。
- Source Basis 中使用 exact `GA-####`、spec scenario name、design obligation name 或 verification/proof obligation name。
- Business mode 只覆盖当前业务 change 的可观察业务运行行为。
- Foundation mode 只覆盖当前 foundation change 的可观察工程运行事实；允许的 runtime surfaces 包括 `workspace-script`、`app-skeleton-startup`、`health-readiness`、`config-env`、`prisma-migration-readback`、`openapi-proto-generation`、`package-boundary`、`compose-local-smoke`、`ci-conformance`。
- Foundation mode 下，纯架构原则、未来部署预留、云中立性、非目标、长期 preserve guard 不得生成 runtime rows；只能在 `runtime-upstream-coverage-map` 写 source-backed not-applicable reason。
