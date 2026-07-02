# Default Proposal Overlay

## 上游输入权威

- Default proposal 允许的上游输入只有：用户请求或 change 描述、现有 `openspec/specs/<capability>/spec.md`、现有代码 baseline、当前产品行为，以及用户显式提供的 issue、设计稿、外部文档或调研结论。
- 当用户请求足够明确时，优先由用户请求定义 change boundary；当请求不足以确定 production behavior、existing capability 或 impact 时，才按需读取 specs/code baseline。
- 修改 existing capability 时，必须读取对应 existing spec 或明确记录未读取原因；新增 capability 时，必须使用 change-local kebab-case capability name。
- 现有代码 baseline 只能用于确认当前行为、接口、route、schema、config、worker、UI surface、测试边界或影响面；不得通过无边界全仓库探索扩大 scope。
- 不得读取或依赖 `openspec/orchestrate/**`、final packet、global atom index、capability anchor packet、`GA-####` register 或 obligation profile 的 source-aligned handoff。

## Trace 生成规则

- `trace/proposal.trace.json` 必须包含 `baseline-input-read-set`、`change-scope-coverage` 和 `proposal-alignment-gate`。
- `baseline-input-read-set[]` 必须为每个 material input 写一行 `BI-###`，并包含 `input-id`、`input-type`、`source`、`read-purpose`、`interpretation-result`。`input-type` 只能是 `user-request`、`existing-spec`、`code-baseline`、`external-doc`、`issue` 或 `design`。
- `change-scope-coverage[]` 每行只能包含一个 exact change-local `SI-###`，不得使用 ranges、汇总行、多 ID 单元格、`global-atom-id` 或 `GA-####`。每行必须包含 `scope-item-id`、`source`、`source-fact`、`artifact-handling`、`capability`、`propose-use`、`downstream-coverage-expectation`。
- `artifact-handling` 必须使用 `spec`、`guard`、`design`、`proof`、`context`。`spec` / `guard` 必须进入 specs delta 或 no-delta blocker；`design` 必须进入 design/runtimes handoff；`proof` 必须进入 runtime acceptance / verification / proof expectation；`context` 只保留边界，不新增 implementation scope。
- `proposal-alignment-gate.scope-items` 必须是 `{ count, ids, id-list-source }` 对象，`ids[]` 必须等于 `change-scope-coverage[].scope-item-id` exact set，`count` 必须等于 `ids.length`。
- `proposal-alignment-gate.artifact-handling-coverage[]` 必须从 `change-scope-coverage[]` 按 `artifact-handling` 分组生成；每行 `count` 必须等于 `ids.length`，且 `ids[]` 必须全部属于 `change-scope-coverage`。
- `proposal-alignment-gate.baseline-inputs-read` 必须是 `{ count, ids, read-set-source }` 对象，`ids[]` 必须等于 `baseline-input-read-set[].input-id` exact set，`count` 必须等于 `ids.length`。
- `proposal-alignment-gate.orphan-scope-items` 必须为空；非空表示 scope item 未被 register、gate 或 downstream expectation 闭合，必须 blocker。
- `proposal-alignment-gate.capability-increment-coverage[]` 必须从 `change-scope-coverage[]` 按 `capability` 分组生成；每行 `scope-item-count` 必须等于该 capability 的 SI 数量。
- Delivery Plane 只能从 `change-scope-coverage[]` 与 `baseline-input-read-set[]` 的 interpretation 投影；不得出现 exhaustive `SI-###` coverage、`Scope Items:`、scope coverage suffix、alignment gate 或 `GA-####`。
- 若 trace 或 Delivery Plane 出现 `openspec/orchestrate`、`final-packet-index`、`obligation-atom-index`、`capability-anchors`、global atom index 或 `GA-####`，必须视为 default proposal scope authority violation。
