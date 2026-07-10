# Obligation Specs Trace Schema Overlay

本文件定义 `production-obligation-atom-driven` 的 specs trace schema 差异。它适用于 writer、repair-writer、reviewer、renderer 和 validator，但不定义 writer 的生成策略，也不替代 reviewer 的语义审查规则。

## Source Identity

- `trace/specs/**.trace.json` 中出现的所有 `GA-####` 都必须属于 `trace/proposal.trace.json#/change-ga-register` direct set。
- Specs trace 不得传播 `non-direct-boundary-ref` 的 `GA-####`。
- `spec-delta-register[]` 的每个 `source-ids[]` 只能包含 exact `GA-####`；不得使用 ranges、`atom-ids[]`、逗号分隔多个 GA 或 capability 汇总行。

## Proposal Interface

- `change-ga-register` 是 obligation specs 的唯一 GA coverage 权威。每个 normal specs trace row 必须可回溯到其中一条 direct row。
- `capability` 是 capability 分组 canonical 字段。
- `artifact-routes[]` 是 specs eligibility 权威。只有存在 `artifact == "specs"` 且 `role` 为 `spec-requirement` 或 `spec-guard` 的 rows 能进入 `spec-delta-register[]`。
- `projection` 只是上游原始/建议分类，不得作为 specs eligibility 判断依据。
- `non-direct-boundary-ref` 只能消费为 boundary label、summary 或 no-scope 语义；不得在 specs trace 中写入其中的 non-direct `GA-####`，也不得把它当作 specs projection。

## Guard Handling

- Routed `spec-guard` direct atom 是 guard source；必须保留 guard / MUST NOT / non-goal / preserve boundary 语义，并在对应 register row 中写 `guard-handling`。
- 未 routed-to-specs 的 `design-obligation` / `verification-obligation` 不得派生成 requirement/guard；如果 proposal 已将某 GA routed-to-specs，则按该 route role 消费，但不得传播纯验证义务。
