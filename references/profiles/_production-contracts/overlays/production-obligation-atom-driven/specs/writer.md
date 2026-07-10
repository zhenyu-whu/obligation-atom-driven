# Obligation Specs Writer Overlay

本文件只适用于 `production-obligation-atom-driven` 的 `specs-writer` 和 `specs-repair-writer`。

## 上游输入权威

- Specs writer 只能读取 `trace/proposal.trace.json` 作为 proposal 语义输入；trace-backed `GA-####` source 只能来自 `change-ga-register` rows，并按这些 rows 的 `artifact-routes[]` 处理。
- `change-ga-register` 是 specs writer 的唯一 GA coverage 权威。每个 normal specs trace row 必须可回溯到其中一条 direct row。
- `capability` 是 capability 分组 canonical 字段。
- `artifact-routes[]` 是 specs eligibility 权威。只有存在 `artifact == "specs"` 且 `role` 为 `spec-requirement` 或 `spec-guard` 的 rows 能进入 `spec-delta-register[]`。
- `projection` 只是上游原始/建议分类，不得作为 specs eligibility 判断依据。
- `source-document`、`lines`、`source-fact`、`normativity`、`atom-type`、`capability`、`projection`、对应 specs route 的 `role/use`、`routing-rationale`、`routing-no-scope-expansion` 和 `downstream-expectation` 必须从 proposal register row 继承为语义依据；writer 不得在 specs trace 中重写为不同 source fact。
- 原始 `source-fact` 是唯一 source truth；`artifact-routes[].use` 只解释 specs 应消费该 GA 的哪一面，不得新增或替代 source fact。
- `non-direct-boundary-ref` 只能消费为 boundary label、summary 或 no-scope 语义；不得在 specs trace 中写入其中的 non-direct `GA-####`，也不得把它当作 specs projection。

## Trace 生成规则

- Routed `spec-requirement` direct atom 是正向 requirement/scenario source；必须落到 `spec-delta-register[]`，或有 source-backed blocker。
- Routed `spec-guard` direct atom 是 guard source；必须保留 guard / MUST NOT / non-goal / preserve boundary 语义，并在对应 register row 中写 `guard-handling`。
- `spec-delta-register[]` 的每个 `source-ids[]` 只能包含 exact `GA-####`；不得使用 ranges、`atom-ids[]`、逗号分隔多个 GA 或 capability 汇总行。
- 当 capability 没有 routed-to-specs direct atom 时，不创建该 capability spec file。
- 当整个 proposal register 中没有任何 routed-to-specs direct atom 时，执行 base contract 的 no-delta specs branch。
- 未 routed-to-specs 的 `design-obligation` / `verification-obligation` 不得派生成 requirement/guard；如果 proposal 已将某 GA routed-to-specs，则按该 route role 消费，但不得传播纯验证义务。
