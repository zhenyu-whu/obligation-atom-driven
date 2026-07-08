# Tasks Artifact Contract

## 目的

`tasks.md` 是 production implementation Delivery Plane。AC sections 是 implementation worker 默认入口；`trace/tasks.trace.json` 是唯一机器语义输入。Markdown 只是 JSON trace 的 render 结果。

Tasks 的核心目标是：以 specs scenarios 作为需求真相、以 design implementation details 作为实现方案，先生成按工程施工顺序执行的 AC / checkbox tasks。AC / checkbox 的 `title`、`work-stage`、`depends-on-step-ids[]` 和 `work` 必须先独立说明“如何实现”；其中 `work` 是当前 checkbox task 的准确人读任务说明，不是从 links 派生的摘要。即使暂时忽略三类 link arrays，也应能作为 implementation worker 的清晰施工说明。

完成实现草案后，writer 再把每个 AC / checkbox 对 specs scenarios、design implementation details 和 runtime acceptance facts 的客观贡献写入 `spec-scenario-links[]`、`design-detail-links[]` 和 `runtime-fact-links[]`。这些 links 是 trace projection 和最终闭合门禁输入，不是 AC 分组、checkbox 拆分或任务发明的主轴。

Tasks 不维护 proposal source/scope coverage 的第二套真相，不把 spec scenario、design detail、runtime fact 或 closure row 当作工程分组主轴，也不把 verification/proof/evidence 语义带回 implementation plan。

## 写入前

- 读取 `trace/proposal.trace.json`、所有实际生成的 `trace/specs/*.trace.json` 或 `trace/specs/no-spec-delta/README.trace.json`、`trace/design.trace.json` 和 `trace/runtime-acceptance.trace.json`。
- 不读取 `proposal.md`、`specs/**/*.md`、`design.md`、`runtime-acceptance.md`、`verification.md`、`trace/verification.trace.json`、测试文件、测试命令、apply evidence 或 `openspec-results/**` 来派生 step、checkbox 或 proof。
- 从 specs trace 读取 in-scope added/modified scenario pointers；从 design trace 读取 `implementation-details[].detail-id`；从 runtime acceptance 读取 canonical required / preserve runtime facts。
- writer 只写 `trace/tasks.trace.json`；`tasks.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 从同一 trace 写入。

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

## AC Creation Gate

- 只有当一个 step 代表 current-change production implementation work，或提供必须由本 change 交付的 preserve boundary，才允许创建该 step。
- 不得创建名称或 scope 仅为 proof closure、verification closure、evidence closure、coverage closure 或 acceptance proof closure 的 step。
- AC 应按工程阶段组织，例如数据/迁移、DTO/API contract、domain service、validator/state machine、frontend surface、integration/rollout；不得按 spec scenario、design detail、runtime fact 表格或 closure row 机械分组。
- 前置 AC 可以通过 `supports`、`contributes`、`uses` 或 `implements-part` 声明前置贡献，但不得用这些贡献关闭 spec/runtime coverage。
- 如果 closure 缺口不能客观映射到真实 production implementation work，不得新增 coverage-only AC；应由 reviewer 判定是否需要 repair-writer 重组真实任务、修正 links 或报告上游 trace drift。

## AC Section

- 文件开头必须是 `## AC-### <中文生产实现步骤名称>`。
- 每个 AC section 只渲染 `Work Stage:`、非空 `Depends On:` 和 checkbox tasks；不得在 Markdown 中渲染 `Spec Scenarios:`、`Design Details:` 或 `Runtime Contributions:`。
- 每个 AC section 必须来自 `trace/tasks.trace.json#/implementation-step-register[]` 的 exact row；不得手写 Markdown 后再补 trace。
- AC 级 `spec-scenario-links[]`、`design-detail-links[]` 和 `runtime-fact-links[]` 只保留在 `trace/tasks.trace.json` 中，作为 validation、closure 和 reviewer 审计输入。
- 不再渲染 `Outcome`、AC 级 `Work`、`Preserve`、`Proof`、`Acceptance` 或 `Resolved Runtime Contract`。

## Checkbox Task

- 每个 checkbox task 只渲染 checkbox 标题、`Work Stage:` 和 `Work:`；不得在 Markdown 中渲染三类 links。
- checkbox 必须代表 production implementation work；`Work:` 是该 checkbox 的准确任务说明，描述要改变或保留的生产行为，不写 file-edit summary。
- checkbox 的 `title` 和 `Work:` 必须先构成清晰完整的实现说明；三类 links 只能补充 trace 关联，不得替代实现说明，也不得依赖 Markdown 展示才能理解任务。
- `Work:` 应说明可执行的生产行为边界，包括要建立或保留的模块/API/状态/交互、关键数据或运行态结果、主要失败/边界处理，以及明确不进入当前 scope 的行为；不得只写“实现某功能”“补齐接口”“接入前端”等简略 file-edit summary。
- step 级三类 links 必须等于其子 checkbox links 的聚合。
- `spec-scenario-links[].contribution` 只允许 `supports` 或 `completes`；只有 `completes` 关闭 spec scenario coverage。
- `design-detail-links[].contribution` 只允许 `uses`、`implements-part` 或 `completes`；只有 `completes` 关闭 implementation detail coverage。
- `runtime-fact-links[].contribution` 只允许 `supports`、`contributes`、`completes` 或 `enforces`；`required behavior` 必须由 `completes` 关闭，`preserve boundary` 必须由 `enforces` 关闭。
- 不得在 checkbox task 中写 `Acceptance:`、`Proof:`、`Preserve:` 或 `Mock / Default Path Policy:`；proof/oracle 语义只能由 runtime-acceptance 和 verification 承担。

## JSON Trace Plane

`trace/tasks.trace.json` 顶层只允许 tasks 语义字段：

- `trace-schema`
- `artifact-id`
- `artifact-path`
- `change-name`
- `schema-name`
- `agent-role`
- `source-interface`
- `implementation-step-register`
- `task-gate`
- `delivery-plane`

旧字段必须视为 hard error，防止双语义源：

- `acceptance-driven-coverage`
- `runtime-acceptance-index`
- `runtime-acceptance-projection`
- `acceptance-slices`
- `resolved-runtime-contract`
- `mock-default-path-policy`
- `runtime-facts`
- `runtime-fact-ids`
- `start-gate`
- `implementation-scope`
- `proof-contract`
- `outcome`
- `preserve`
- `proof`
- `acceptance`

### source-interface

- `source-interface.proposal-trace` 必须为 `trace/proposal.trace.json`。
- `source-interface.specs-completion-mode` 必须匹配实际 specs trace completion mode：`delta` 或 `no-delta`。
- `source-interface.spec-traces[]` 必须等于实际 specs trace 路径集合。
- `source-interface.design-trace` 必须为 `trace/design.trace.json`。
- `source-interface.runtime-acceptance-trace` 必须为 `trace/runtime-acceptance.trace.json`。
- `source-interface.input-policy` 必须明确 tasks 使用 draft-first/link-second authoring：先从 specs/design 生成生产实现草案，再把 specs/design/runtime acceptance facts 作为客观 contribution/closure links；Markdown、verification、tests、evidence 不是语义输入。
- 字段值只允许字符串或字符串数组，不得内联 source metadata object。

### implementation-step-register

每行必须包含：

```json
{
  "step-id": "AC-001",
  "title": "<production implementation step title>",
  "work-stage": "behavior",
  "depends-on-step-ids": [],
  "spec-scenario-links": [
    {
      "spec-scenario": "trace/specs/<capability>.trace.json#/spec-delta-register/0/scenarios/0",
      "contribution": "completes"
    }
  ],
  "design-detail-links": [
    {
      "design-detail-id": "IDR-001-D001",
      "contribution": "completes"
    }
  ],
  "runtime-fact-links": [
    {
      "runtime-fact-id": "OP-001",
      "contribution": "completes"
    }
  ],
  "tasks": [
    {
      "task-id": "AC-001.1",
      "title": "<concrete production implementation work>",
      "work-stage": "behavior",
      "spec-scenario-links": [
        {
          "spec-scenario": "trace/specs/<capability>.trace.json#/spec-delta-register/0/scenarios/0",
          "contribution": "completes"
        }
      ],
      "design-detail-links": [
        {
          "design-detail-id": "IDR-001-D001",
          "contribution": "completes"
        }
      ],
      "runtime-fact-links": [
        {
          "runtime-fact-id": "OP-001",
          "contribution": "completes"
        }
      ],
      "work": "<production behavior to build or preserve, including boundary, runtime result, failure/boundary handling, and out-of-scope guard>"
    }
  ]
}
```

约束：

- `step-id` 使用 `AC-###`，全文件唯一。
- `task-id` 使用 `AC-###.<n>`，且必须属于同一 step。
- `work-stage` 只能是允许的工程阶段枚举。
- `depends-on-step-ids[]` 只能引用同文件前置 `step-id`。
- 每个 AC / checkbox 必须至少声明一个 spec/design/runtime link。
- links 必须在 AC / checkbox 草案完成后客观填写；不得为了满足以下 closure invariant 而创建非生产任务或伪造 contribution。
- 每个 in-scope spec scenario 必须至少被一个 checkbox task 以 `contribution == "completes"` 覆盖。
- 每个非 `non-applicable` implementation detail 必须至少被一个 checkbox task 以 `contribution == "completes"` 覆盖。
- 每个 required runtime fact 必须至少被一个 checkbox task 以 `contribution == "completes"` 覆盖。
- 每个 preserve runtime fact 必须至少被一个 checkbox task 以 `contribution == "enforces"` 覆盖。

### task-gate

`task-gate` 必须包含且只用于最终最小闭合结果：

- `blockers`
- `uncovered-spec-scenarios`
- `incomplete-design-details`
- `incomplete-runtime-facts`
- `invalid-spec-refs`
- `invalid-design-detail-refs`
- `invalid-runtime-fact-refs`
- `dependency-order-violations`
- `hidden-dependency-violations`
- `non-production-task-violations`
- `delivery-projection-mismatch`

Validator pass 要求上述数组全部为空。该要求是最终 artifact invariant，不是 writer 按 coverage 矩阵生成 AC / checkbox 的策略；writer 不得为了清空 gate 创建 proof-only、acceptance-only、coverage-only 或 artifact-closure task。

### delivery-plane

`delivery-plane` 只作为 renderer payload：

```json
{
  "step-sections": ["AC-001"]
}
```

规则：

- `step-sections[]` 的 ID 集必须与 `implementation-step-register[].step-id` 完全一致。
- Markdown 按 `step-sections[]` 顺序从 `implementation-step-register[]` 渲染。
- `delivery-plane` 不得重复定义 step、task、spec scenario、design detail、runtime fact、coverage 或 projection 字段。
- artifact 末尾只保留短 `## Trace Appendix` 指针块。

## Reviewer Focus

- AC 是否按工程实现阶段组织，而不是按 runtime fact 行机械分组。
- AC / checkbox 是否先构成清晰完整的生产实现计划，再客观填写 specs/design/runtime links；links 是否被用来替代实现说明。
- 每个 in-scope specs scenario 是否被 production checkbox `completes`。
- 每个 runtime-affecting implementation detail 是否被 production checkbox `completes`。
- 每个 required runtime fact 是否被 production checkbox `completes`，每个 preserve runtime fact 是否被 `enforces`。
- closure 缺口是否应通过修正真实 production checkbox links 或重组真实 production task 修复，而不是新增 coverage-only checkbox。
- 前置 AC 是否只声明 `supports/contributes/uses/implements-part`，没有误关完整 coverage。
- step 拓扑是否存在后置 dependency、循环依赖或 hidden runtime/design dependency。
- 是否存在只为 proof、verification 或 coverage closure 存在的任务。
- 是否混入测试矩阵、执行证据、固定命令、测试文件、evidence 或 deposit 字段。
