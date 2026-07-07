# Source / Scope Boundary Contract

本文件定义两个 production schema 的共同 source/scope 边界。

## Source / Scope 权威

- 下游 artifacts 必须通过上游 JSON traces 中的 registered source/scope rows、proposal 审定后的 artifact routes/handling、runtime projection 和 read set 建立 coverage；proposal 阶段的根 source/scope 权威是 `trace/proposal.trace.json`。
- 下游 artifacts 不得重新做全量 source discovery，不得从上游 Markdown Delivery Plane 或未登记的 source line range 直接发明新的 production behavior。
- 如果 artifact 需要 proposal/spec/design traces 无法到达的 source/scope detail，必须修订上游 trace/artifact 或报告 blocker。
- 当前实现、测试文件、apply-result、evidence 和 `openspec-results/**` 不得作为 propose artifact 的 oracle 来源。

## Projection / Handling

- 每个 material source/scope item 必须有 downstream coverage expectation。
- `spec-requirement` / `spec` 必须落到 requirement/scenario，或有明确 source/scope-backed reason。
- `spec-guard` / `guard` 必须作为 non-goal、MUST NOT、preserve 或明确负向边界，不得膨胀成新的正向行为。
- `design-obligation` / `design` 必须落到 design decision、implementation boundary、guard handling 或 blocker；若 source fact 同时包含用户可观察行为或产品编辑语义，proposal 必须双归属到 specs/design。
- 当某个 capability 没有 routed-to-specs direct item 时，不创建该 capability 的 spec file。若整个 change 没有 specs route，必须用 `trace/specs/no-spec-delta/README.trace.json` 作为 canonical no-delta completion，renderer 再生成 `specs/no-spec-delta/README.md` marker。`design-obligation` 不得仅因原 projection 被派生成 specs，但可以在 proposal 审定为 routed-to-specs 后进入 specs。
- `verification-obligation` / `proof` 只作为 specs/design writer 的参考输入；若其中含有生产行为或边界，必须先被 specs/design 吸收，未被吸收时下游 runtime、verification 和 tasks 直接忽略，不得为了 proof 创建 production scope 外任务、runtime fact 或 Proof Slice。
- `contextual-only` / `context` 不成为新增 implementation scope，只保留必要边界。

## No Scope Expansion

- 不得新增 source/scope 外 route、control、state、API、job、provider、storage、auth/security rule、observability category、deployment mode、persistent domain concept 或用户流程。
- 当 source/scope 只定义行为而未定义 implementation shape 时，design 必须选择最小 production-compatible shape，并说明拒绝的 scope-expanding alternative。
- explicit non-goal、preserve boundary、prototype-only-not-production、future-change handoff 必须在 proposal/design/tasks/verification 中保持边界。
