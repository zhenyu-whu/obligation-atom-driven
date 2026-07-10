# Default Specs Reviewer Overlay

本文件只适用于 `production-default-acceptance-driven` 的 `specs-reviewer` 和 integration reviewer 中针对 specs artifact 的审查。

## Reviewer Focus

- Specs trace 是否只读取 `trace/proposal.trace.json#/change-scope-coverage` exact SI set。
- `spec-delta-register[]` 中出现的每个 `SI-###` 是否属于 change-local scope set，且没有出现 `GA-####`。
- Capability 分组是否使用 proposal scope row 的 canonical `capability`。
- Specs eligibility 是否只来自 `artifact-handling` 为 `spec` 或 `guard` 的 rows。
- Requirement/scenario 是否继承并保留 `source`、`source-fact`、`artifact-handling` 和 `downstream-coverage-expectation` 的 specs 语义。
- Default specs 读取 existing spec、用户输入、代码 baseline、路由/API、数据表、配置、测试或外部输入时，是否只用于 `existing-spec-state` 或 source clarification，没有扩展未登记 SI scope。
- `guard` 是否保持 guard / MUST NOT / non-goal / preserve boundary 语义。
- `design` / `proof` / `context` 是否没有伪造成 requirement/guard。

## 必须 Blocker 的情况

- Specs trace 中任一 `SI-###` 不属于 proposal `change-scope-coverage` exact set。
- Default specs trace、Delivery Plane 或 reviewer 语义出现 `GA-####`。
- Specs eligibility 使用非 `artifact-handling` 的推断，或把 `design` / `proof` / `context` 派生成 requirement/guard。
- `spec-delta-register[].source-ids[]` 使用 ranges、`scope-item-ids[]`、逗号分隔多个 SI 或 capability 汇总行。
- `spec` scope item 未进入 `spec-delta-register[]`，且没有 source-backed blocker。
- `guard` scope item 未保持 guard / MUST NOT / non-goal / preserve boundary 语义。
- Existing spec、用户输入、代码 baseline、路由/API、数据表、配置、测试或外部输入被用来扩展 `change-scope-coverage` 未登记的 SI scope。

## Pass 条件

Reviewer 只能在 base reviewer pass 条件之外，同时确认：所有 specs source ids 均来自 change-local `change-scope-coverage` exact set；default specs 没有 GA authority 泄漏；eligibility 由 `artifact-handling` 审定；每个 `spec` / `guard` SI 的 source-fact material semantics 均被 requirement/scenario 或 guard 真实保留。
