# openspec-archive-change 运行约束

## 默认行为

- 当执行或触发 `openspec-archive-change` 技能归档已完成 change，且未指定 change 名称时，先运行 `openspec list --json`。如果活跃 change 只有一个，则默认选择该 change 继续归档流程，不再额外要求用户确认选择；如果存在多个活跃 change、无活跃 change，或上下文与列表结果冲突，必须停下向用户确认。
- 归档前仍需读取 `openspec status --change "<name>" --json`、检查 `tasks.md` 完成度，并评估 `openspec/changes/<name>/specs/` 下的 delta specs 是否需要同步。检查结果中的非阻断性警告应在最终汇总中说明，但默认不要求二次确认。
- 对 `production-obligation-atom-driven` schema，归档前必须额外检查 `tasks.md` 的 `Acceptance-Driven Coverage`：`Obligation Atom Coverage` 每行只能有一个 exact `OGA-####` 且 `Artifact Projection` 与 proposal register 一致，三张 coverage 表的 task ID 均能解析到已完成 checkbox，每个 AC 的 final verification / acceptance task 已完成，并且 evidence ledger 覆盖相关 `OGA-####` 的 projection/proof 义务。
- 如果归档目标是旧 schema，按该 change 自身 schema instructions 兼容处理；不得把 `source-truth.md`、独立 `acceptance.md`、旧版 source coverage artifact、`change-source-map.md` 或任何 proposal 前置 source artifact 要求带入 `production-obligation-atom-driven` change。
- 如果 delta specs 存在且同步评估显示主 specs 需要新增或修改，默认执行“同步并归档”：优先使用 `openspec archive "<name>" -y` 完成 spec 更新与归档；如果 CLI 不可用或自动同步失败，再按 `openspec-sync-specs` 技能手动同步后归档。
- 只有遇到冲突或高风险状态时才向用户确认，包括但不限于：多个候选 change、归档目标目录已存在、delta spec 与主 spec 无法明确合并、存在未完成任务、coverage 表存在 orphan direct atom、proof/evidence ledger 不足、命令失败、校验失败，或归档会覆盖/删除非目标文件。
- 归档完成后必须运行 `openspec validate --specs --strict --json`，并汇总 change 名称、schema、归档路径、spec 同步结果、任务完成情况、obligation atom coverage audit、遗留警告和校验结果。
