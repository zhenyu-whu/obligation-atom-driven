# Obligation Proposal Reviewer Overlay

本文件只适用于 `production-obligation-atom-driven` 的 `proposal-reviewer` 和 integration reviewer 中针对 proposal artifact 的审查。

## Reviewer Focus

- Change 是否存在于 final packet index。
- Packet direct atoms 是否全部在 `change-ga-register` 中出现。
- Direct `GA-####` 是否都有 source fact、capability、projection、审定后的 routing 字段和 downstream expectation。
- `artifact-routes[]` 是否基于 `source-fact` 审定，而不是机械照抄 `projection`；若所有 route 都是一对一 projection 映射，且 rationale 使用通用模板或引用 final projection，必须输出 blocker。
- 双语义 source fact 是否正确双归属；纯 verification/proof source fact 是否没有进入 production specs/design。
- `non-direct-boundary-ref` 是否只表达边界引用，且没有传播 non-direct GA。
- 是否从非权威 orchestrate/review/report 产物扩展 scope。

## 必须 Blocker 的情况

- 当前 change 无法从 `final-packet-index.json $.packets[]` 唯一选出。
- `change-ga-register[].ga-id` 与当前 packet `direct-atom-ids[]` 不一致。
- Direct GA 的 source fields、capability 或 projection 未按 `obligation-atom-index.json` / `atom-plan-mapping.json` 派生。
- Routing 使用 final projection 机械映射，或 rationale 没有引用具体 source-fact 语义。
- Pure verification/proof source fact 被错误传播为 specs/design 生产语义。
- Non-direct boundary ref 传播 `GA-####`、包含 projection/downstream expectation，或与 direct GA 重叠。
- Delivery Plane 写入 exhaustive GA coverage、change-ga-register、non-direct-boundary-ref、proposal-gate、Direct atoms、Projection mix 或 Global Atoms。

## Pass 条件

Reviewer 只能在 base reviewer pass 条件之外，同时确认：final packet、atom mapping、global atom index 和 phase-5 handoff 状态一致；每个 direct GA 都已逐条审定 route；non-direct boundary 没有传播为下游 coverage。
