# Obligation Specs Reviewer Overlay

本文件只适用于 `production-obligation-atom-driven` 的 `specs-reviewer` 和 integration reviewer 中针对 specs artifact 的审查。

## Reviewer Focus

- Specs trace 是否只读取 `trace/proposal.trace.json#/change-ga-register` direct GA set。
- `spec-delta-register[]` 中出现的每个 `GA-####` 是否属于 direct set，且没有传播 `non-direct-boundary-ref`。
- Capability 分组是否使用 proposal row 的 canonical `capability`。
- Specs eligibility 是否只来自 `artifact-routes[]` 中 `artifact == "specs"` 且 `role` 为 `spec-requirement` 或 `spec-guard` 的 rows。
- Requirement/scenario 是否继承并保留 `source-fact`、对应 route `use`、`routing-rationale`、`routing-no-scope-expansion` 和 `downstream-expectation` 的 specs 语义。
- `spec-guard` 是否保持 guard / MUST NOT / non-goal / preserve boundary 语义。
- 未 routed-to-specs 的 `design-obligation` / `verification-obligation` 是否没有伪造成 requirement/guard；pure verification/proof source fact 是否没有传播为 production specs。

## 必须 Blocker 的情况

- Specs trace 中任一 `GA-####` 不属于 proposal `change-ga-register` direct set。
- Specs trace 传播 `non-direct-boundary-ref` 的 `GA-####` 或把 non-direct boundary 当作 specs projection。
- Specs eligibility 使用 `projection` 机械判断，而不是使用 `artifact-routes[]` 的 specs route。
- `spec-delta-register[].source-ids[]` 使用 ranges、`atom-ids[]`、逗号分隔多个 GA 或 capability 汇总行。
- Routed `spec-requirement` direct atom 未进入 `spec-delta-register[]`，且没有 source-backed blocker。
- Routed `spec-guard` direct atom 未保持 guard / MUST NOT / non-goal / preserve boundary 语义。
- 未 routed-to-specs 的 `design-obligation` / `verification-obligation` 被派生成 requirement/guard。
- Pure verification/proof source fact 被错误传播为 specs 生产语义。

## Pass 条件

Reviewer 只能在 base reviewer pass 条件之外，同时确认：所有 specs source ids 均来自 `change-ga-register` direct set；route eligibility 由 `artifact-routes[]` 审定；non-direct boundary 没有传播；每个 routed-to-specs GA 的 source-fact material semantics 均被 requirement/scenario 或 guard 真实保留。
