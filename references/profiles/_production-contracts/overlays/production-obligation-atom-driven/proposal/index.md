# Obligation Proposal Overlay

本目录定义 `production-obligation-atom-driven` schema 的 proposal 角色化 overlay。Base proposal contract 定义通用角色边界；本 overlay 只定义 obligation schema 的 source-aligned handoff、`GA-####` register、non-direct boundary ref、routing 和 reviewer 审查差异。

## 角色化 Overlay 文件

- `overlays/production-obligation-atom-driven/proposal/trace-schema.md`：obligation proposal trace 的 `source-interface`、`change-ga-register`、`non-direct-boundary-ref`、`proposal-gate` 和 delivery leak 规则。
- `overlays/production-obligation-atom-driven/proposal/writer.md`：proposal-writer / proposal-repair-writer 读取 source-aligned JSON handoff、final packet、global atom index 和 routing 审定的规则。
- `overlays/production-obligation-atom-driven/proposal/reviewer.md`：proposal-reviewer / integration reviewer 针对 final packet、direct GA、routing、non-direct boundary 和 source authority 的审查规则。

## 角色隔离

- Proposal writer 只读取本目录的 `index.md`、`trace-schema.md` 和 `writer.md`；不得把 `reviewer.md` 当作生成 checklist。
- Proposal reviewer 只读取本目录的 `index.md`、`trace-schema.md` 和 `reviewer.md`；不得把 `writer.md` 当作语义通过标准。
