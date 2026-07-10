# Tasks Artifact Contract

## 目的

`tasks.md` 是 production implementation Delivery Plane。AC sections 是 implementation worker 默认入口；`trace/tasks.trace.json` 是唯一机器语义输入。Markdown 只是 JSON trace 的 render 结果。

Tasks 的核心目标是：以 specs scenarios 作为需求真相、以 design implementation details 作为实现方案，先生成按工程施工顺序执行的 AC / checkbox tasks。AC / checkbox 的 `title`、`work-stage`、`depends-on-step-ids[]` 和 `work` 必须先独立说明“如何实现”。完成实现草案后，再把 specs scenarios、design implementation details 和 runtime acceptance facts 的客观贡献写入 trace links。

Tasks 不维护 proposal source/scope coverage 的第二套真相，不把 spec scenario、design detail、runtime fact 或 closure row 当作工程分组主轴，也不把 verification/proof/evidence 语义带回 implementation plan。

## 角色化 Contract 文件

- `artifacts/tasks/trace-schema.md`：共享 trace/schema 结构权威，定义 `trace/tasks.trace.json` 字段、AC/checkbox links、task-gate、delivery-plane、Markdown 投影和 renderer/validator 不变量。
- `artifacts/tasks/writer.md`：writer / repair-writer 的生成规则，说明如何从 specs/design 形成 draft-first implementation plan，再客观填写 specs/design/runtime contribution links。
- `artifacts/tasks/reviewer.md`：artifact reviewer / integration reviewer 的审查规则，说明如何审查工程分组真实性、link contribution 客观性、closure 真实性、依赖顺序和 proof/test/evidence 泄漏。

## 角色隔离

- Writer 和 repair-writer 不得把 reviewer contract、validator gate 或 coverage closure 当作 authoring checklist；writer 的主目标是生成清晰、真实、可执行的 production implementation plan。
- Reviewer 不得修改 artifact，也不得把 validator pass、空 gate、link closure 或 rendered Markdown 当作语义通过证明；reviewer 的主目标是判断 tasks trace 是否真实达成 specs/design/runtime 输入的施工语义。
- `artifacts/tasks/trace-schema.md` 是双方共享的结构约束；它不替代 writer 的工程综合规则，也不替代 reviewer 的语义审查规则。

## 兼容入口

旧版流程若只按 `artifacts/<artifact-id>.md` 查找 tasks contract，必须改为读取 `artifacts/tasks/index.md`，并把本文件视为索引，不得据此直接生成完整 tasks trace。完整 tasks contract bundle 必须按 `openspec/agent-runtime/openspec-propose-artifacts.md` 的 Contract Bundle Resolution 读取角色化文件。

旧的 `artifacts/tasks.md` 不再是有效 tasks contract 入口。

## Required Sections

Renderer 生成的 `tasks.md` 仍必须包含：

- `## AC-### <中文生产实现步骤名称>` sections
- AC-level `Work Stage:` 和非空 `Depends On:`
- checkbox task 行
- checkbox-level `Work Stage:` 和 `Work:`
- JSON Trace Plane pointer
