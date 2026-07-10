# Tasks Writer Contract

本文件只适用于 `tasks-writer` 和 `tasks-repair-writer`。Writer 的核心任务是先形成清晰、可执行的 production implementation AC / checkbox 草案，再客观填写 specs/design/runtime contribution links；trace links 和 gate 是完成后的客观投影与自查结果，不是生成策略。

## 写入前

- 读取 `trace/proposal.trace.json`、所有实际生成的 `trace/specs/*.trace.json` 或 `trace/specs/no-spec-delta/README.trace.json`、`trace/design.trace.json` 和 `trace/runtime-acceptance.trace.json`。
- 不读取 `proposal.md`、`specs/**/*.md`、`design.md`、`runtime-acceptance.md`、`verification.md`、`trace/verification.trace.json`、测试文件、测试命令、apply evidence 或 `openspec-results/**` 来派生 step、checkbox 或 proof。
- 从 specs trace 读取 in-scope added/modified scenario pointers；从 design trace 读取 `implementation-details[].detail-id`；从 runtime acceptance 读取 canonical required / preserve runtime facts。
- Writer 只写 `trace/tasks.trace.json`；`tasks.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 从同一 trace 写入。

## Writer 生成顺序

1. 读取 specs trace，建立可关联的 in-scope spec scenario set。No-delta specs 时该 set 为空。
2. 读取 design trace，建立可关联的 implementation detail set。`detail-type == "non-applicable"` 不要求 implementation closure。
3. 读取 runtime acceptance trace，建立可关联的 required / preserve runtime fact set。
4. 先按工程实现经验从 specs + design 生成最小有序 AC / checkbox 实现草案，而不是从 spec scenario、design detail、runtime fact 或 closure 缺口反推步骤。
5. 草案必须先回答“如何实现”：每个 AC / checkbox 必须有清晰的中文生产实现名称、`work-stage`、必要的 `depends-on-step-ids[]` 和具体 `work`；`work` 必须准确描述当前 checkbox 要完成的生产实现任务，该草案不应依赖三类 link arrays 才能被 implementation worker 理解。
6. 草案完成后，再为每个 AC / checkbox 如实填写 `spec-scenario-links[]`、`design-detail-links[]`、`runtime-fact-links[]`，表达它对需求、设计和运行态事实的真实贡献。
7. contribution 必须客观反映生产实现贡献；不得为了关闭 coverage 改写工程分组、拆出 coverage-only checkbox，或把不真实的贡献写成 `completes` / `enforces`。
8. 用 `depends-on-step-ids[]` 表达拓扑顺序；dependency 必须只指向前置 step。
9. 从同一 register 投影 `delivery-plane.step-sections[]`，该数组只保存渲染顺序，不重复 step 字段。
10. 生成 `task-gate`；gate 只记录 blocker、spec/design/runtime 闭合缺口、非法引用、依赖顺序问题、隐藏依赖问题、非生产任务问题和 delivery projection mismatch。`task-gate` 不是 writer 倒推 AC / checkbox 的 authoring checklist；最终缺口由 validator 和 reviewer -> repair-writer 机制发现并修复。
11. 写入严格 JSON `trace/tasks.trace.json`，再调用 renderer 生成 `tasks.md`、Trace Appendix 和 manifest registry entry。

## AC Creation Gate

- 只有当一个 step 代表 current-change production implementation work，或提供必须由本 change 交付的 preserve boundary，才允许创建该 step。
- 不得创建名称或 scope 仅为 proof closure、verification closure、evidence closure、coverage closure 或 acceptance proof closure 的 step。
- AC 应按工程阶段组织，例如数据/迁移、DTO/API contract、domain service、validator/state machine、frontend surface、integration/rollout；不得按 spec scenario、design detail、runtime fact 表格或 closure row 机械分组。
- 前置 AC 可以通过 `supports`、`contributes`、`uses` 或 `implements-part` 声明前置贡献，但不得用这些贡献关闭 spec/runtime coverage。
- 如果 closure 缺口不能客观映射到真实 production implementation work，不得新增 coverage-only AC；应由 reviewer 判定是否需要 repair-writer 重组真实任务、修正 links 或报告上游 trace drift。

## Checkbox Authoring

- checkbox 必须代表 production implementation work；`Work:` 是该 checkbox 的准确任务说明，描述要改变或保留的生产行为，不写 file-edit summary。
- checkbox 的 `title` 和 `Work:` 必须先构成清晰完整的实现说明；三类 links 只能补充 trace 关联，不得替代实现说明，也不得依赖 Markdown 展示才能理解任务。
- `Work:` 应说明可执行的生产行为边界，包括要建立或保留的模块/API/状态/交互、关键数据或运行态结果、主要失败/边界处理，以及明确不进入当前 scope 的行为；不得只写“实现某功能”“补齐接口”“接入前端”等简略 file-edit summary。
- step 级三类 links 必须等于其子 checkbox links 的聚合。
- 不得在 checkbox task 中写 `Acceptance:`、`Proof:`、`Preserve:` 或 `Mock / Default Path Policy:`；proof/oracle 语义只能由 runtime-acceptance 和 verification 承担。

## Writer 提交前结构检查

调用 renderer 前，writer 只做结构一致性检查：

- `trace/tasks.trace.json` 是严格 JSON，且只包含 `artifacts/tasks/trace-schema.md` 允许的顶层字段。
- `source-interface` 只引用实际 proposal/specs/design/runtime acceptance trace，不包含 Markdown artifact、verification trace、实现、测试、evidence 或 apply-stage 输入；`input-policy` 是边界声明文本，不得被当作额外输入列表。
- 每个 `step-id`、`task-id`、`work-stage`、三类 link、dependency 和 delivery-plane step ID 都能在同一 trace 或上游 trace 中解析，且无重复。
- AC / checkbox 的 `title` 与 `work` 不包含 proof、acceptance、测试矩阵、evidence/apply path 或 deposit 状态。具体测试文件或测试 runner 命令会触发 validator warning，并必须由 reviewer/preflight 判断是否构成 proof/test/evidence-only task。
- `delivery-plane` 只保存 renderer payload，不泄漏 coverage、gate、trace pointer、测试计划、proof slice、runtime fact 正文或 evidence 字段。
- 若结构检查或生成后的 gate 出现缺口，writer 必须返回 blocker 或修订上游/语义模型；不得为了清空 gate 创建 proof-only、acceptance-only、coverage-only 或 artifact-closure task。

## Repair Writer

Repair-writer 必须重新读取最新上游 trace JSON、当前 tasks trace、contract bundle、validator hard error 和 reviewer blocker。修复时应重建受影响的 implementation step / checkbox 语义模型，而不是局部补字段来关闭 validator 或 reviewer finding。
