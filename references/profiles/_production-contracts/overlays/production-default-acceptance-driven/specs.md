# Default Specs Overlay

- Specs writer 只能读取 `trace/proposal.trace.json` 的 `change-scope-coverage` 作为 scope-reading interface。
- `trace/specs/**.trace.json` 中出现的所有 `SI-###` 都必须属于 `change-scope-coverage` exact set；default specs 不得出现 `GA-####`。

## 上游输入权威

- `change-scope-coverage` 是 specs writer 的唯一 SI coverage 权威。每个 normal specs trace row 必须可回溯到其中一条 scope row。
- `capability` 是 capability 分组 canonical 字段。
- `artifact-handling` 是 specs eligibility 权威。只有 `spec` 和 `guard` rows 能进入 `spec-delta-register[]`。
- `source`、`source-fact`、`capability`、`artifact-handling` 和 `downstream-coverage-expectation` 必须从 proposal scope row 继承为语义依据；writer 不得在 specs trace 中重写为不同 source fact。
- Default specs 可读取 existing spec、用户输入、代码 baseline、路由/API、数据表、配置、测试或外部输入来源，但这些只能作为 `existing-spec-state` 或 source clarification；不得扩展 `change-scope-coverage` 未登记的 SI scope。

## Trace 生成规则

- `spec` scope item 是正向 requirement/scenario source；必须落到 `spec-delta-register[]`，或有 source-backed blocker。
- `guard` scope item 是 guard source；必须保留 guard / MUST NOT / non-goal / preserve boundary 语义，并在对应 register row 中写 `guard-handling`。
- `spec-delta-register[]` 的每个 `source-ids[]` 只能包含 exact `SI-###`；不得使用 ranges、`scope-item-ids[]`、逗号分隔多个 SI 或 capability 汇总行。
- 当 capability 没有 `spec` / `guard` scope item 时，不创建该 capability spec file。
- 当整个 proposal register 中没有任何 `spec` / `guard` scope item 时，执行 base contract 的 no-delta specs branch。
- `design` / `proof` / `context` 不得派生成 requirement/guard。
