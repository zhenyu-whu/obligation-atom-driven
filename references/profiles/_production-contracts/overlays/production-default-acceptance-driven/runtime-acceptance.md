# Default Runtime Acceptance Overlay

- `source-interface` 只能列 `trace/proposal.trace.json`、实际 `trace/specs/**/*.trace.json` 或 no-delta marker trace、`trace/design.trace.json`；不得把 `proposal.md`、`specs/**/*.md` 或 `design.md` 作为 semantic input。
- `trace/runtime-acceptance.trace.json` 不得出现 `GA-####` 或 `global-atom-id`；default runtime acceptance 只能使用 change-local `SI-###`、spec scenario anchor、`D-###` design decision 或 design/proof handoff item。
- `upstream-runtime-obligation-inventory[]` 必须使用 exact `SI-###`、spec scenario anchor、`D-###` design decision 或 design/proof handoff item；不得从 `openspec/orchestrate`、global atom index 或 capability anchor packet 派生 runtime coverage。
- `trace/runtime-acceptance.trace.json` 的 `runtime-upstream-coverage-map` 必须逐项覆盖每个非 context material `SI-###`、in-scope spec scenario、material design decision、guard 和 proof handling item。
- 每个 covered `SI-###` 必须映射到主体具体 runtime row，或有 scope-backed not-applicable reason。
- `SI-###` 不得只出现在 `runtime-coverage-source-map` 或 checklist。
- `runtime-upstream-coverage-map` 中 scope item 必须保留 proposal `change-scope-coverage[]` 的 `artifact-handling`；不得改写为 obligation `artifact-projection`。
- `runtime-upstream-coverage-map` 每个 `not-applicable` `SI-###` 必须写 scope-backed reason，且 `runtime-row-ids` 必须为空。
- Scope Basis 中使用 exact `SI-###`、spec scenario name、design decision name 或 proof handling name。
