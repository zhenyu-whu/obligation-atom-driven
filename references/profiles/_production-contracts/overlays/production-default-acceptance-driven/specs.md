# Default Specs Overlay

- Specs writer 只能读取 `trace/proposal.trace.json` 的 `change-scope-coverage` 作为 scope-reading interface。
- `trace/specs/**.trace.json` 中出现的所有 `SI-###` 都必须属于 `change-scope-coverage` exact set；default specs 不得出现 `GA-####`。

## 上游输入权威

- `change-scope-coverage` 是 specs writer 的唯一 SI coverage 权威。每个 normal specs trace row 必须可回溯到其中一条 scope row。
- `capability` 是 capability 分组 canonical 字段。
- `artifact-handling` 是 specs eligibility 权威。只有 `spec` 和 `guard` rows 能进入 `requirement-source-trace[]`。
- `source`、`source-fact`、`capability`、`artifact-handling` 和 `downstream-coverage-expectation` 必须从 proposal scope row 继承；writer 不得在 specs trace 中重写为不同 source fact。
- Default specs 可读取 existing spec、用户输入、代码 baseline、路由/API、数据表、配置、测试或外部输入来源，但这些只能作为 `existing-spec-read-set` 或 source clarification；不得扩展 `change-scope-coverage` 未登记的 SI scope。

## Trace 生成规则

- 每个 `spec` scope item 必须落到 requirement/scenario，或有 source-backed blocker；不得用 design/proof/context handoff 逃避 specs coverage。
- 每个 `guard` scope item 必须作为 guard、MUST NOT、non-goal 或 Production Alignment Gate，并在 trace row 中写 `spec-handling: "direct-spec-guard"` 与 `guard-handling`。
- `requirement-source-trace[]` 的每个 row 只能包含一个 exact `scope-item-id`；不得使用 ranges、`scope-item-ids[]`、逗号分隔多个 SI 或 capability 汇总行。
- `requirement-source-trace[]` 的每个 row 必须包含：`scope-item-id`、`capability`、`source`、`source-fact`、`artifact-handling`、`spec-handling`、`requirement`、`scenario`。guard row 还必须包含 `guard-handling`。
- `artifact-handling` 必须等于 proposal row 的 `artifact-handling`，且只能是 `spec` 或 `guard`。
- `spec` row 的 `spec-handling` 必须为 `direct-spec-requirement`；`guard` row 的 `spec-handling` 必须为 `direct-spec-guard`。
- 当 capability 没有 `spec` / `guard` scope item 时，不创建 `specs/<capability>/spec.md`。`design` / `proof` / `context` 不得派生成 requirement/guard。
- 当整个 proposal register 中没有任何 `spec` / `guard` scope item 时，必须创建 `trace/specs/no-spec-delta/README.trace.json` 作为 canonical no-delta specs completion，并由 renderer 生成 `specs/no-spec-delta/README.md` marker；不得与任何正常 `specs/<capability>/spec.md` 共存。
- no-delta trace 必须声明 `specs-completion-mode: "no-delta"`，`requirement-source-trace` 必须为空，`production-alignment-gate.blockers` 必须为空；marker Markdown 不得包含 OpenSpec delta headings、`### Requirement` 或 `#### Scenario`。
