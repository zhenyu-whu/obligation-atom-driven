# Specs Trace Schema Contract

本文件定义 `trace/specs/**.trace.json` 的共享结构约束。它适用于 writer、repair-writer、reviewer、renderer 和 validator，但不定义 writer 的语义转换策略，也不替代 reviewer 的语义审查规则。

## JSON Trace Plane

Normal delta spec 必须写入 `trace/specs/<capability>.trace.json`，包含：

- `trace-schema`
- `artifact-id: "specs"`
- `artifact-path: "specs/<capability>/spec.md"`
- `change-name`
- `schema-name`
- `agent-role`
- `source-proposal-trace-path`
- `specs-completion-mode: "delta"`
- `capability`
- `delivery-plane`
- `source-interface`
- `existing-spec-state`
- `spec-delta-register`
- `spec-gate`

No-delta marker 必须写入 `trace/specs/no-spec-delta/README.trace.json`，包含：

- `artifact-id: "specs"`
- `artifact-path: "specs/no-spec-delta/README.md"`
- `specs-completion-mode: "no-delta"`
- `spec-delta-register: []`
- 空 `spec-gate`
- no-delta `delivery-plane`

`trace-schema` 必须为 `openspec-trace-v1`，`artifact-id` 必须为 `specs`。Artifact 末尾只保留短 `## Trace Appendix` 指针块，完整 trace 不写入 Markdown。

## source-interface

- `source-interface` 只记录语义输入路径和模式，字段值保持字符串或字符串数组，不得内联 source metadata object。
- Normal delta 的 `source-interface` 必须能表达 proposal trace 和 focused existing spec read。
- No-delta marker 的 `source-interface` 必须能表达 proposal trace 和 no-delta 判定模式。

## existing-spec-state

- Normal delta 必须包含 `existing-spec-state`。
- `existing-spec-state.status` 只能是 `absent`、`parsed` 或 `parse-blocked`。
- `absent`：base spec 不存在，只允许生成 `added` delta。
- `parsed`：base spec 可解析，允许按语义差异生成 `added`、`modified`、`removed` 或 `renamed`。
- `parse-blocked`：base spec 存在但无法可靠解析；若需要非 `added` delta，必须写入 `spec-gate.blockers`。

## spec-delta-register

`spec-delta-register[]` 是 specs 的 canonical semantic model。

- 每行必须包含 `delta-id`、`delta-op`、`requirement` 和 `source-ids[]`。
- `delta-id` 使用 `SD-###`。
- `delta-op` 允许值仅为 `added`、`modified`、`removed`、`renamed`。
- `added` / `modified` row 必须包含 `body` 和至少一个 `scenarios[]` row。
- Scenario row 必须包含 `name`，并包含 `body` 或 `given` / `when` / `then`。
- `removed` row 必须包含 `existing-anchor`、`reason` 和 `migration`，不得包含 `scenarios[]`。
- `renamed` row 必须包含 `existing-anchor`、`from` 和 `to`，不得包含行为变化字段。
- Guard row 必须写 `guard-handling`，允许值仅为 `must-not`、`preserve-boundary`、`non-goal`。

## spec-gate

`spec-gate` 必须包含且只用于最小闭合结果：

- `blockers`
- `orphan-source-ids`
- `source-set-mismatch`
- `existing-spec-state-violations`
- `delivery-projection-mismatch`

Validator pass 要求上述数组全部为空。

## Delivery Plane

- `delivery-plane.added-requirements`、`modified-requirements`、`removed-requirements` 和 `renamed-requirements` 必须全部由同一个 `spec-delta-register[]` 投影。
- No-delta marker 不是 delta spec，不能包含 `## ADDED/MODIFIED/REMOVED/RENAMED Requirements`、`### Requirement` 或 `#### Scenario`。
- 新行为使用 `## ADDED Requirements`。
- 变化行为使用 `## MODIFIED Requirements`，修改前必须读取 existing spec 并确认 semantic delta。
- 删除行为只在有 source-backed Reason 和 Migration 时使用 `## REMOVED Requirements`。
- 重命名只在语义不变且有 `FROM:` / `TO:` 时使用 `## RENAMED Requirements`；行为变化必须使用 `modified`。
- 每个 requirement 使用 `### Requirement: <name>`。
- Requirement 正文使用 SHALL / MUST / MUST NOT 表达规范行为。
- Requirement 正文和 freeform Scenario body 可以写字符串或字符串数组；renderer 必须保留数组换行，不得隐式逗号拼接，也不得猜测拆分字符串。
- 每个 added/modified requirement 至少有一个 `#### Scenario: <name>`。
- 每个 rendered added/modified scenario 必须能解析到 `spec-delta-register[]` 中的 requirement/scenario；每个 register row 也必须能投影到 Delivery Plane。
- Delivery Plane 不得包含 source/scope coverage、alignment gate、projection mix、trace rows、source ids、register rows 或 gate。

## JSON Trace / Markdown Boundary

- Downstream artifact writer/reviewer 只能把 specs trace 作为 specs 语义输入；`specs/**/*.md` 是 renderer 投影后的 Delivery Plane，不得反向作为 source/scope register、coverage oracle、runtime row 或 proof oracle。
- Delivery Plane 不得直接从 template 注释、proposal Markdown、旧 specs Markdown、当前实现、测试文件或 apply 结果推导新行为。
- 若 Delivery Plane 需要表达的 requirement、scenario、guard、remove reason 或 rename target 无法追溯到 `spec-delta-register[]`、`existing-spec-state` 或 blocker，writer 必须修订 trace 或报告 blocker，不得只在 Markdown prose 中补写。
- Delivery Plane 中可以使用人类可读总结，但总结不得改变 trace 中 item 的 source projection、guard handling、owner capability 或 downstream expectation。
