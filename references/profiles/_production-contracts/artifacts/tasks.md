# Tasks Artifact Contract

## 目的

`tasks.md` 是 production implementation Delivery Plane and runtime acceptance audit model。AC sections 是 implementation worker 默认入口；`trace/tasks.trace.json` 供主 Agent、archive、stabilizer 和 reviewer 审计。

## 写入前

- 读取 proposal、所有实际生成的 delta specs、design 和 runtime-acceptance。
- 索引 source/scope rows、artifact projection/handling、spec scenarios、design obligations、canonical runtime rows、AC sections、checkbox task IDs 和 coverage table references。
- 建立 runtime provision graph：每个 runtime row 由 baseline、current-change AC、future change 或 explicit negative boundary 提供；AC sections 必须按 graph 拓扑排序。

## AC Creation Gate

- 只有当一个 AC 提供或实质修改 current-change production runtime behavior，或提供必须由本 change 交付的 preserve boundary，才允许创建该 AC。
- 不得创建名称或 scope 仅为 proof closure、verification closure、evidence closure、coverage closure 或 acceptance proof closure 的 AC。
- 如果 proof-only row 需要生产 runtime work，AC 名称必须描述该生产工作，而不是“验收证明收束”。

## AC Section

- 文件开头必须是 `## AC-### <中文验收切片名称>`。
- 每个 AC section 必须按顺序包含 `Outcome:`、`Start Gate:`、`Runtime Rows:`、`Resolved Runtime Contract:`、`Implementation Scope:`、`Preserve:`、`Proof Contract:`，随后是 checkbox tasks。
- `Resolved Runtime Contract` 固定 columns 为 `Row`、`Worker-facing obligation`、`Observable proof`、`Default / no-scope boundary`。
- `Resolved Runtime Contract` 只能摘录 runtime-acceptance canonical row 的 worker-facing 语义，不得新增 canonical runtime row，不得包含 source/scope trace、projection、Proof Slice、测试路径、固定命令或 evidence path。
- `Resolved Runtime Contract` row IDs 必须与 AC `Runtime Rows:` 一致，并且全部存在于 runtime-acceptance。

## Checkbox Task

- 每个 checkbox task 必须包含 `Runtime Rows:`、`Acceptance:`、`Preserve:`、`Proof:`、`Mock / Default Path Policy:`。
- checkbox 必须代表 production implementation work。
- task-level `Runtime Rows:` 只能列该 task 实现、实质修改或保留的 rows；仅由 proof/readback 观察的 supporting rows 不得列入。
- `Acceptance:` 描述 task 贡献证明的具体行为，不写 file-edit summary。
- `Proof:` 说明可观察 proof；用户可见操作必须证明 runtime interaction、API/data effect 和 reload/readback。

## JSON Trace Plane

- `trace/tasks.trace.json` 必须包含 `acceptance-driven-coverage`、`runtime-acceptance-index` 和 `runtime-acceptance-projection`。
- Coverage 表必须包含 acceptance slice IDs、implementation task IDs 和 acceptance proof；proof 摘要不是 checkbox、测试编号或执行状态。
- `runtime-acceptance-index` 只作为 preflight 路由表，不是测试计划来源。
- `runtime-acceptance-projection` 只保留 runtime-acceptance rows 到 AC/implementation checkbox 的 projection，不重新定义 canonical runtime row。
- Required / preserve rows 必须有 owner AC、provider/consumer relationship、implementation task projection 和 runtime proof summary，或 explicit blocker/not-applicable reason。
- Proof-only rows 必须分类为 `production-work-required` 或 `proof-projection-only`；后者不得创建 proof-only AC/checkbox，只能映射到已有生产 task IDs 和 proof summary。
- artifact 末尾只保留短 `## Trace Appendix` 指针块。

## Reviewer Focus

- AC topology 是否存在后置 provider dependency、循环依赖或 hidden runtime dependency。
- task-level runtime rows 是否误列 supporting rows。
- 是否存在 proof-only AC/checkbox 或只为 coverage closure 存在的任务。
- Coverage tables 中 implementation task IDs 是否能解析到 production checkbox。
- 是否混入测试矩阵、执行证据、固定命令、测试文件、evidence 或 deposit 字段。
