# Obligation Runtime Acceptance Overlay

- `trace/runtime-acceptance.trace.json` 的 `runtime-upstream-coverage-map` 必须逐项覆盖每个 proposal direct `GA-####`、in-scope spec scenario、material design obligation、spec guard 和 verification/proof obligation。
- 每个 covered direct `GA-####` 必须映射到主体具体 runtime row，或有 source-backed not-applicable reason。
- Proposal direct `GA-####` 不得只出现在 `runtime-coverage-source-map` 或 checklist。
- Source Basis 中使用 exact `GA-####`、spec scenario name、design obligation name 或 verification/proof obligation name。
