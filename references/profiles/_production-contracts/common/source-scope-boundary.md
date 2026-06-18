# Source / Scope Boundary Contract

本文件定义两个 production schema 的共同 source/scope 边界。

## Source / Scope 权威

- 下游 artifacts 必须通过 proposal `Trace Appendix` 中的 registered source/scope rows、artifact projection/handling 和 read set 建立 coverage。
- 下游 artifacts 不得重新做全量 source discovery，不得从未登记的 source line range 直接发明新的 production behavior。
- 如果 artifact 需要 proposal/spec/design 无法到达的 source/scope detail，必须修订上游 artifact 或报告 blocker。
- 当前实现、测试文件、apply-result、evidence 和 `openspec-results/**` 不得作为 propose artifact 的 oracle 来源。

## Projection / Handling

- 每个 material source/scope item 必须有 downstream coverage expectation。
- `spec-requirement` / `spec` 必须落到 requirement/scenario，或有明确 source/scope-backed reason。
- `spec-guard` / `guard` 必须作为 non-goal、MUST NOT、preserve 或明确负向边界，不得膨胀成新的正向行为。
- `design-obligation` / `design` 必须落到 design decision、implementation boundary、guard handling 或 blocker。
- `verification-obligation` / `proof` 必须落到 runtime acceptance / verification / proof expectation，不得为了 proof 创建 production scope 外任务。
- `contextual-only` / `context` 不成为新增 implementation scope，只保留必要边界。

## No Scope Expansion

- 不得新增 source/scope 外 route、control、state、API、job、provider、storage、auth/security rule、observability category、deployment mode、persistent domain concept 或用户流程。
- 当 source/scope 只定义行为而未定义 implementation shape 时，design 必须选择最小 production-compatible shape，并说明拒绝的 scope-expanding alternative。
- explicit non-goal、preserve boundary、prototype-only-not-production、future-change handoff 必须在 proposal/design/tasks/verification 中保持边界。
