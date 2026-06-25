# production-default-acceptance-driven Profile Contract

## 输入权威

- 本 schema 用于 Greenfield 完成后的后续新增、修改和修复。
- Proposal 的主要输入是用户请求、现有 `openspec/specs/`、现有代码、当前产品行为，以及用户显式提供的 issue、设计稿、外部文档或调研结论。
- 本 schema 不消费 `openspec/orchestrate`、change plan、final change packet、global atom index 或 capability anchor packet。
- 不得创建 `GA-####` register，不得把 orchestrate atom 当作本 change scope。
- `trace/proposal.trace.json` 中的 scope item 必须使用 change-local `SI-###`，并从用户请求、现有 spec/code baseline 或显式外部输入派生；不得读取或依赖 `openspec/orchestrate`。

## Scope Item 规则

- `trace/proposal.trace.json` 必须包含 `change-scope-coverage`，用 change-local `SI-###` 标识 material scope item。
- `SI-###` 只在本 change 内有效，不是全局编号。
- `Artifact Handling` 允许值为 `spec`、`guard`、`design`、`proof`、`context`。
- 每个 material scope item 必须有 downstream coverage expectation。
- 不得使用 ranges。

## Baseline / Input Read

- 若用户请求足够明确，优先用它定义 change boundary。
- 若请求含糊，先读取现有 specs/code 建立 baseline；仍无法安全判断时才提出必要澄清。
- 若 change 修改 existing capability，读取对应 `openspec/specs/<capability>/spec.md`。
- 若新增 capability，使用 kebab-case capability name。
- 按需读取现有代码、测试、配置和路由确认 baseline 与影响面，但不得做无边界全仓库探索。

## Reviewer Focus

- 是否误读或依赖 `openspec/orchestrate`。
- 每个 `SI-###` 是否只在本 change 内使用，且有 handling 与 downstream expectation。
- Proposal/spec/design/runtime/tasks 是否从用户请求、现有 spec/code baseline 或显式外部输入可追溯。
- 是否破坏已归档或现有 specs 的明确 MUST/MUST NOT 而未在 scope 中声明。
