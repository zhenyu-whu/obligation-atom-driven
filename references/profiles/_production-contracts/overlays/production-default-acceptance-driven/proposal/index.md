# Default Proposal Overlay

本目录定义 `production-default-acceptance-driven` schema 的 proposal 角色化 overlay。Base proposal contract 定义通用角色边界；本 overlay 只定义 default schema 的用户请求 / baseline 输入、change-local `SI-###` scope coverage、proposal alignment gate 和 reviewer 审查差异。

## 角色化 Overlay 文件

- `overlays/production-default-acceptance-driven/proposal/trace-schema.md`：default proposal trace 的 `baseline-input-read-set`、`change-scope-coverage`、`proposal-alignment-gate` 和 delivery leak 规则。
- `overlays/production-default-acceptance-driven/proposal/writer.md`：proposal-writer / proposal-repair-writer 读取用户请求、existing specs/code baseline 和显式外部输入的规则。
- `overlays/production-default-acceptance-driven/proposal/reviewer.md`：proposal-reviewer / integration reviewer 针对 orchestrate 泄漏、change-local SI、baseline 可追溯性和 existing specs 破坏声明的审查规则。

## 角色隔离

- Proposal writer 只读取本目录的 `index.md`、`trace-schema.md` 和 `writer.md`；不得把 `reviewer.md` 当作生成 checklist。
- Proposal reviewer 只读取本目录的 `index.md`、`trace-schema.md` 和 `reviewer.md`；不得把 `writer.md` 当作语义通过标准。
