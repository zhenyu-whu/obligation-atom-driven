# Obligation Runtime Acceptance Overlay

- `runtime-acceptance.md` 只来自当前 business change 的 proposal/spec/design 中可观察运行行为。它不是 foundation reference、实现细节或 proof-only handoff 的物化门禁。
- `trace/runtime-acceptance.trace.json` 的 `runtime-upstream-coverage-map` 只覆盖当前 change 中会产生或约束可观察运行行为的 proposal direct `GA-####`、in-scope spec scenario 和 design decision/guard。
- 每个 covered direct `GA-####` 必须映射到主体具体 runtime row，或有当前 change source-backed not-applicable reason。
- Proposal direct `GA-####` 不得只出现在 `runtime-coverage-source-map` 或 checklist。
- Source Basis 中使用 exact `GA-####`、spec scenario name、design obligation name 或 verification/proof obligation name。
- Foundation reference artifact/path 或 foundation `GA-####` 不得作为 runtime coverage source；如果底座实现确实属于当前业务 change，必须由当前 final packet direct atoms 表达。
