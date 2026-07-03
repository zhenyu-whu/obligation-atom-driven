# Tasks Artifact Contract

## 目的

`tasks.md` 是 production implementation Delivery Plane。AC sections 是 implementation worker 默认入口；`trace/tasks.trace.json` 是唯一机器语义输入，供主 Agent、archive、stabilizer 和 reviewer 审计。Markdown 只是 JSON trace 的 render 结果。

## 写入前

- 读取 `trace/proposal.trace.json`、所有实际生成的 `trace/specs/*.trace.json` 或 `trace/specs/no-spec-delta/README.trace.json`、`trace/design.trace.json` 和 `trace/runtime-acceptance.trace.json`。
- 不读取 `verification.md`、`trace/verification.trace.json`、测试文件、测试命令、apply evidence 或 `openspec-results/**` 来派生 AC、checkbox、runtime proof 或 acceptance coverage。
- 索引 source/scope rows、artifact projection/handling、spec scenarios、design obligations、canonical runtime rows、AC sections、checkbox task IDs 和 coverage table references；不得从上游 Markdown Delivery Plane 推导 AC 或 task 语义。
- 建立 runtime provision graph：每个 runtime row 由 baseline、current-change AC、future change 或 explicit negative boundary 提供；AC sections 必须按 graph 拓扑排序。
- 建立 trace-backed runtime provision graph、AC section model、checkbox task model、acceptance-driven coverage model、runtime acceptance index、runtime acceptance projection 和 `delivery-plane.acceptance-slices[]` render payload。
- writer 只写 `trace/tasks.trace.json`；`tasks.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 从同一 trace-backed AC/task/runtime row projection 集写入。
- 写入前必须基于 trace 对 runtime row 全量集合做 projection set-diff，确认 required/preserve/proof-only rows 均有正确 owner AC、task projection 或 source/scope-backed not-applicable reason。该 set-diff 不写入 Markdown，只作为 writer 自检或 blocker。

## Writer 生成顺序

1. 从 proposal trace 建立 source/scope item universe，并记录每个 direct item 的 artifact projection / handling。
2. 从 specs trace 建立 requirement/scenario universe；如果 specs 为 no-delta marker，记录 no-delta completion mode 且不发明 requirement scenario。
3. 从 design trace 建立 design obligation / decision / placement universe。
4. 从 runtime-acceptance trace 读取 canonical row index 与 `delivery-plane.canonical-rows[]`，按 `scope-role` 将 rows 分类为 required、preserve、proof-only、not-applicable / contextual。
5. 将 required / preserve rows 归并为最小 production AC slices：同一 AC 必须代表可执行的 production runtime work，而不是 proof、coverage 或 artifact closure。
6. 为每个 AC 生成 checkbox tasks；每个 checkbox task 必须落到 production implementation work，并声明它负责的 runtime rows。
7. 从同一 AC/task model 投影三块 JSON：`delivery-plane.acceptance-slices[]`、`runtime-acceptance-index.ac-runtime-ownership-index[]`、`runtime-acceptance-projection.runtime-row-ownership-projection[]`。
8. 最后投影 `acceptance-driven-coverage`，把 source/scope item、spec scenario 和 design obligation/decision 映射到 AC、checkbox task 和 runtime proof summary。不得用 coverage 表反推或新增 AC/checkbox。

## AC Creation Gate

- 只有当一个 AC 提供或实质修改 current-change production runtime behavior，或提供必须由本 change 交付的 preserve boundary，才允许创建该 AC。
- 当 `proposal-alignment-gate.change-kind` 为 `foundation` 时，AC 必须提供或实质修改生产工程底座 runtime behavior，例如 workspace、app skeleton、scripts、config、migration、health/readiness、生成链路、package boundary、Compose/local smoke 或 CI conformance。
- 不得创建名称或 scope 仅为 proof closure、verification closure、evidence closure、coverage closure 或 acceptance proof closure 的 AC。
- 如果 proof-only row 需要生产 runtime work，AC 名称必须描述该生产工作，而不是“验收证明收束”。

## AC Section

- 文件开头必须是 `## AC-### <中文验收切片名称>`。
- 每个 AC section 必须按顺序包含 `Outcome:`、`Start Gate:`、`Runtime Rows:`、`Resolved Runtime Contract:`、`Implementation Scope:`、`Preserve:`、`Proof Contract:`，随后是 checkbox tasks。
- 每个 AC section 必须来自 `trace/tasks.trace.json#/delivery-plane/acceptance-slices[]` 的 exact row；不得手写 Markdown 后再补 trace。
- `Resolved Runtime Contract` 固定 columns 为 `Row`、`Worker-facing obligation`、`Observable proof`、`Default / no-scope boundary`。
- `Resolved Runtime Contract` 只能摘录 runtime-acceptance canonical row 的 worker-facing 语义，不得新增 canonical runtime row，不得包含 source/scope trace、projection、Proof Slice、测试路径、固定命令或 evidence path。
- `Resolved Runtime Contract` row IDs 必须与 AC `Runtime Rows:` 一致，并且全部存在于 runtime-acceptance。

## Checkbox Task

- 每个 checkbox task 必须包含 `Runtime Rows:`、`Acceptance:`、`Preserve:`、`Proof:`、`Mock / Default Path Policy:`。
- checkbox 必须代表 production implementation work。
- Foundation mode 下 checkbox 必须代表生产工程底座实现工作；不得为 not-applicable foundation atom、proof-only、coverage-only 或 artifact closure 创建 checkbox。
- task-level `Runtime Rows:` 只能列该 task 实现、实质修改或保留的 rows；仅由 proof/readback 观察的 supporting rows 不得列入。
- `Acceptance:` 描述 task 贡献证明的具体行为，不写 file-edit summary。
- `Proof:` 说明可观察 proof；用户可见操作必须证明 runtime interaction、API/data effect 和 reload/readback。

## JSON Trace Plane

- `trace/tasks.trace.json` 必须包含 `source-interface`、`delivery-plane`、`acceptance-driven-coverage`、`runtime-acceptance-index` 和 `runtime-acceptance-projection`。
- `source-interface` 必须列出 consumed JSON traces，并明确 Markdown artifacts 是 render outputs；不得声明 tasks 消费 verification trace、Proof Slice、测试文件或 apply evidence。
- `delivery-plane.acceptance-slices[]` 是 renderer 的唯一输入；每个 slice 必须包含 `ac-id`、`title`、`outcome`、`start-gate`、`runtime-rows`、`resolved-runtime-contract[]`、`implementation-scope`、`preserve`、`proof-contract` 和 `tasks[]`。
- `delivery-plane.acceptance-slices[].runtime-rows`、`resolved-runtime-contract[].row`、`runtime-acceptance-index.ac-runtime-ownership-index[].detail-matrix-rows` 和 `runtime-acceptance-projection.runtime-row-ownership-projection[].runtime-row-id` 必须使用同一 canonical runtime row set。
- `delivery-plane.acceptance-slices[].tasks[].task-id` 必须能解析到同一 AC 下的 checkbox，且被 `runtime-acceptance-projection` 和 projected coverage rows 引用时不得漂移。
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
