# Default Proposal Trace Schema Overlay

本文件定义 `production-default-acceptance-driven` 的 proposal trace schema 差异。它适用于 writer、repair-writer、reviewer、renderer 和 validator，但不定义 writer 的生成策略，也不替代 reviewer 的语义审查规则。

## Required Sections

`trace/proposal.trace.json` 必须包含：

- `baseline-input-read-set`
- `change-scope-coverage`
- `delivery-plane`
- `proposal-alignment-gate`

## baseline-input-read-set

- `baseline-input-read-set[]` 必须为每个 material input 写一行 `BI-###`，并包含 `input-id`、`input-type`、`source`、`read-purpose`、`interpretation-result`。
- `input-type` 只能是 `user-request`、`existing-spec`、`code-baseline`、`external-doc`、`issue` 或 `design`。

## change-scope-coverage

- `change-scope-coverage[]` 每行只能包含一个 exact change-local `SI-###`，不得使用 ranges、汇总行、多 ID 单元格、`global-atom-id` 或 `GA-####`。
- 每行必须包含 `scope-item-id`、`source`、`source-fact`、`artifact-handling`、`capability`、`propose-use`、`downstream-coverage-expectation`。
- `SI-###` 只在本 change 内有效，不是全局编号。
- `artifact-handling` 必须使用 `spec`、`guard`、`design`、`proof`、`context`。
- `spec` / `guard` 必须进入 specs delta 或 no-delta blocker；`design` 必须进入 design/runtimes handoff；`proof` 必须进入 runtime acceptance / verification / proof expectation；`context` 只保留边界，不新增 implementation scope。
- 每个 material scope item 必须有 downstream coverage expectation。

## proposal-alignment-gate

- `proposal-alignment-gate.scope-items` 必须是 `{ count, ids, id-list-source }` 对象，`ids[]` 必须等于 `change-scope-coverage[].scope-item-id` exact set，`count` 必须等于 `ids.length`。
- `proposal-alignment-gate.artifact-handling-coverage[]` 必须从 `change-scope-coverage[]` 按 `artifact-handling` 分组生成；每行 `count` 必须等于 `ids.length`，且 `ids[]` 必须全部属于 `change-scope-coverage`。
- `proposal-alignment-gate.baseline-inputs-read` 必须是 `{ count, ids, read-set-source }` 对象，`ids[]` 必须等于 `baseline-input-read-set[].input-id` exact set，`count` 必须等于 `ids.length`。
- `proposal-alignment-gate.orphan-scope-items` 必须为空；非空表示 scope item 未被 register、gate 或 downstream expectation 闭合，必须 blocker。
- `proposal-alignment-gate.capability-increment-coverage[]` 必须从 `change-scope-coverage[]` 按 `capability` 分组生成；每行 `scope-item-count` 必须等于该 capability 的 SI 数量。

## Delivery Plane Restrictions

- Delivery Plane 只能从 `change-scope-coverage[]` 与 `baseline-input-read-set[]` 的 interpretation 投影。
- Delivery Plane 不得出现 exhaustive `SI-###` coverage、`Scope Items:`、scope coverage suffix、alignment gate 或 `GA-####`。
- 若 trace 或 Delivery Plane 出现 `openspec/orchestrate`、`final-packet-index`、`obligation-atom-index`、`capability-anchors`、global atom index 或 `GA-####`，必须视为 default proposal scope authority violation。
