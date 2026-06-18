# Artifact 中文约束

本文件适用于两个 production schema 的 propose artifacts、writer subagent、reviewer subagent 和 integration reviewer。

## 写作语言

- 创建或修改 `openspec/changes/**`、`openspec/specs/**` 以及 schema template 生成内容时，必须面向中文 reviewer。
- 固定模板结构可以保持英文或原文，包括标题、表头、字段名、OpenSpec 关键字、ID、路径、命令、代码/API/DB/package 标识、模块名、函数名、类型名和 enum 值。
- Agent 自己填写的解释性内容必须使用简体中文，包括句子、表格说明、trace block 字段值、proof、preserve、risk、verification、acceptance、design rationale、task description、Requirement 正文、Scenario 的 WHEN/THEN 条件和结果正文。
- 技术英文术语可以作为标识或名词短语保留，但承载语义的句子必须中文化。
- 表格中由 agent 填写的说明类单元格按正文处理，必须中文；只有单元格完全由 ID、路径、代码标识、任务编号、capability 名称或源文档精确术语组成时才可保持英文或原文。
- `tasks.md` 的固定字段名可保持英文；字段值必须中文，除非字段值只是 ID、路径、代码标识、projection/handling enum 或精确 requirement/scenario 名称。
- specs artifact 中 OpenSpec 固定关键词和 heading 可保持 template 要求；Requirement 正文和 Scenario 条件/结果说明必须中文。

## 内部门禁

- 写入前必须做语言检查：忽略反引号中的代码、路径、命令和 ID 后，每个自然语言句子仍应主要是简体中文。
- 语言检查是内部流程，不得写入 artifact。
- 若固定 schema/template 标题为英文，不得为了中文约束改写固定标题；只需用中文填充正文。
