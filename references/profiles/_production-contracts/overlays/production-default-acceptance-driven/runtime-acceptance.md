# Default Runtime Acceptance Overlay

- `trace/runtime-acceptance.trace.json` 的 `runtime-upstream-coverage-map` 必须逐项覆盖每个非 context material `SI-###`、in-scope spec scenario、material design decision、guard 和 proof handling item。
- 每个 covered `SI-###` 必须映射到主体具体 runtime row，或有 scope-backed not-applicable reason。
- `SI-###` 不得只出现在 `runtime-coverage-source-map` 或 checklist。
- Scope Basis 中使用 exact `SI-###`、spec scenario name、design decision name 或 proof handling name。
