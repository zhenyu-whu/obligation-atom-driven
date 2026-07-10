# Default Specs Trace Schema Overlay

本文件定义 `production-default-acceptance-driven` 的 specs trace schema 差异。它适用于 writer、repair-writer、reviewer、renderer 和 validator，但不定义 writer 的生成策略，也不替代 reviewer 的语义审查规则。

## Source Identity

- Specs writer 只能读取 `trace/proposal.trace.json` 的 `change-scope-coverage` 作为 scope-reading interface。
- `trace/specs/**.trace.json` 中出现的所有 `SI-###` 都必须属于 `change-scope-coverage` exact set。
- Default specs 不得出现 `GA-####`。
- `spec-delta-register[]` 的每个 `source-ids[]` 只能包含 exact `SI-###`；不得使用 ranges、`scope-item-ids[]`、逗号分隔多个 SI 或 capability 汇总行。

## Proposal Interface

- `change-scope-coverage` 是 default specs 的唯一 SI coverage 权威。每个 normal specs trace row 必须可回溯到其中一条 scope row。
- `capability` 是 capability 分组 canonical 字段。
- `artifact-handling` 是 specs eligibility 权威。只有 `spec` 和 `guard` rows 能进入 `spec-delta-register[]`。

## Guard Handling

- `guard` scope item 是 guard source；必须保留 guard / MUST NOT / non-goal / preserve boundary 语义，并在对应 register row 中写 `guard-handling`。
- `design` / `proof` / `context` 不得派生成 requirement/guard。
