# Default Proposal Writer Overlay

本文件只适用于 `production-default-acceptance-driven` 的 `proposal-writer` 和 `proposal-repair-writer`。

## 上游输入权威

- 本 schema 用于 Greenfield 完成后的后续新增、修改和修复。
- Default proposal 允许的上游输入只有：用户请求或 change 描述、现有 `openspec/specs/<capability>/spec.md`、现有代码 baseline、当前产品行为，以及用户显式提供的 issue、设计稿、外部文档或调研结论。
- `trace/proposal.trace.json` 中的 scope item 必须使用 change-local `SI-###`，并从用户请求、现有 spec/code baseline 或显式外部输入派生；不得读取或依赖 `openspec/orchestrate`。
- 当用户请求足够明确时，优先由用户请求定义 change boundary；当请求不足以确定 production behavior、existing capability 或 impact 时，才按需读取 specs/code baseline。
- 修改 existing capability 时，必须读取对应 existing spec 或明确记录未读取原因；新增 capability 时，必须使用 change-local kebab-case capability name。
- 现有代码 baseline 只能用于确认当前行为、接口、route、schema、config、worker、UI surface、测试边界或影响面；不得通过无边界全仓库探索扩大 scope。
- 不得读取或依赖 `openspec/orchestrate/**`、change plan、final packet、global atom index、capability anchor packet、`GA-####` register 或 obligation schema 的 source-aligned handoff。
- 不得创建 `GA-####` register，不得把 orchestrate atom 当作本 change scope。

## Trace 生成规则

- `trace/proposal.trace.json` 必须包含 `baseline-input-read-set`、`change-scope-coverage` 和 `proposal-alignment-gate`。
- Baseline/input read set 必须只记录 material input，不得把无边界全仓库探索当作 scope authority。
- Scope coverage 必须逐 `SI-###` 表达 material scope fact，并为每个 item 写明 `artifact-handling`、`capability`、`propose-use` 和 `downstream-coverage-expectation`。
- Proposal alignment gate 必须从 `baseline-input-read-set[]` 和 `change-scope-coverage[]` 投影，不得复制未登记 source 或引入 global atom authority。
- Delivery Plane 只能从 `change-scope-coverage[]` 与 `baseline-input-read-set[]` 的 interpretation 投影。

## Baseline / Input Read

- 若用户请求足够明确，优先用它定义 change boundary。
- 若请求含糊，先读取现有 specs/code 建立 baseline；仍无法安全判断时才提出必要澄清。
- 若 change 修改 existing capability，读取对应 `openspec/specs/<capability>/spec.md`。
- 若新增 capability，使用 kebab-case capability name。
- 按需读取现有代码、测试、配置和路由确认 baseline 与影响面，但不得做无边界全仓库探索。
