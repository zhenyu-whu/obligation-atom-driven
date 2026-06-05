# AGENTS.md production obligation atom driven runtime section

Add the following section to the target repository `AGENTS.md`. Preserve existing project-specific instructions and place this section where project-level runtime constraints are documented. If an equivalent section already exists, update it instead of adding a duplicate.

```markdown
## OpenSpec Production Obligation Atom Driven 运行约束

- 当执行或触发 `openspec-propose`、`openspec-new-change`、`openspec-continue-change`、`openspec-ff-change` 或任何会创建/继续生成 OpenSpec change artifacts 的技能时，必须先读取并遵守 `openspec/agent-runtime/openspec-propose-artifacts.md`。
- 当执行或触发 `openspec-apply-change` 技能实施某个 OpenSpec change 时，必须先读取并遵守 `openspec/agent-runtime/openspec-apply-change.md`。
- 当执行或触发 `openspec-archive-change` 技能归档 OpenSpec change 时，必须先读取并遵守 `openspec/agent-runtime/openspec-archive-change.md`。
- 上述运行文档中的规则是强制约束，优先级等同于本文件中直接书写的项目级指令。
```
