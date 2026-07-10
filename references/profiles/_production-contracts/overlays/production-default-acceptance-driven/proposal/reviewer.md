# Default Proposal Reviewer Overlay

本文件只适用于 `production-default-acceptance-driven` 的 `proposal-reviewer` 和 integration reviewer 中针对 proposal artifact 的审查。

## Reviewer Focus

- 是否误读或依赖 `openspec/orchestrate`。
- 每个 `SI-###` 是否只在本 change 内使用，且有 handling 与 downstream expectation。
- Proposal/spec/design/runtime/tasks 是否从用户请求、现有 spec/code baseline 或显式外部输入可追溯。
- 是否破坏已归档或现有 specs 的明确 MUST/MUST NOT 而未在 scope 中声明。

## 必须 Blocker 的情况

- Proposal trace、Delivery Plane 或 reviewer 语义依赖 `openspec/orchestrate`、final packet、global atom index、capability anchor packet、`GA-####` register 或 obligation source-aligned handoff。
- `change-scope-coverage[]` 使用非 change-local `SI-###`、range、汇总行、多 ID 单元格、`global-atom-id` 或 `GA-####`。
- 任一 material scope item 缺少 handling、capability、propose-use 或 downstream coverage expectation。
- Change 修改 existing capability，但未读取对应 existing spec，也未记录可接受的未读取原因。
- Proposal/spec/design/runtime/tasks 行为无法从用户请求、现有 spec/code baseline 或显式外部输入追溯。
- Existing specs 的明确 MUST/MUST NOT 被破坏，但当前 change scope 未声明该修改。

## Pass 条件

Reviewer 只能在 base reviewer pass 条件之外，同时确认：default proposal 没有 obligation authority 泄漏；所有 `SI-###` 都是 change-local；baseline/read set 足以支撑当前 change boundary；未破坏未声明的 existing spec contract。
