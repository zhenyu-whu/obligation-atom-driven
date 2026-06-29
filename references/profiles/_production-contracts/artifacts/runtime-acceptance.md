# Runtime Acceptance Artifact Contract

## 目的

`runtime-acceptance.md` 是 tasks.md 和 verification.md 共同引用的 canonical runtime coverage registry。它只定义 `RS-/OP-/ST-/CH-` runtime rows、source/scope basis、runtime obligation、observable fact、owner candidate、default path policy、external boundary、scope role 和 no-scope-expansion check。

## 写入前

- 读取 proposal、所有实际生成的 delta specs 和 design。
- 建立 upstream runtime obligation inventory：每个 material source/scope item、in-scope spec scenario、material design decision/obligation、guard 和 proof handling item 都必须成为 inventory item；非 runtime item 必须记录 source/scope-backed not-applicable reason。
- 从上游 artifacts 抽取 runtime surfaces、operations、states/branches、async/realtime chains，以及 explicit no-async/no-worker/no-queue/no-side-effect preserve boundaries。
- 对每个 upstream item 分配一个或多个具体 runtime row IDs；不得只用主题汇总行、closure checklist 或聚合行表示覆盖。
- 当 `proposal-alignment-gate.change-kind` 为 `foundation` 时，只允许为当前 foundation change 的可观察工程运行事实分配 runtime row；允许 surface 包括 workspace/script、app skeleton 启动、health/readiness、config/env、Prisma/migration readback、OpenAPI/proto generation、package boundary、Compose/local smoke 和 CI conformance。纯架构原则、未来部署预留、云中立性、非目标、长期 preserve guard 必须写 not-applicable reason，不能生成 runtime row。
- 建立 trace-backed upstream runtime obligation inventory、not-applicable inventory、canonical runtime row model、row type/index、upstream-to-row coverage map、source map、closure checklist inputs 和 `delivery-plane` render payload。
- writer 只写 `trace/runtime-acceptance.trace.json`；`runtime-acceptance.md`、Trace Appendix 和 manifest digest 必须由 renderer 从同一 trace-backed runtime row ID 集写入。
- canonical runtime row ID 集必须同时渲染为 Markdown 表格和 trace `canonical-row-index`，不得手工维护两套 row truth。

## Canonical Rows

- Runtime row ID 必须唯一，只使用 `RS-###`、`OP-###`、`ST-###`、`CH-###`。
- 每个 row 必须包含 source/scope basis、runtime obligation、observable fact、owner candidate、default path policy、external boundary、scope role 和 no-scope-expansion check。
- `Owner Candidate` 是单一 advisory primary owner candidate；多模块依赖写 `External Boundary` 或 default path，不写 owner list。
- `Runtime Surface Inventory` 只定义 surface rows。
- `Operation Coverage Matrix` 只定义 operation rows。
- `State / Branch Coverage Matrix` 只定义 state/branch rows。
- `Async / Realtime Chain Matrix` 只定义 async/realtime 或 explicit no-async boundary rows。
- 如果 upstream item 包含多个独立 verb、state、failure class、fixture variant、viewport、安全分支或日志类别，row 的 runtime obligation、failure/branch/default/no-scope 字段必须保留这些可失败分支名称，不得泛化吞并。

## JSON Trace Plane

- `trace/runtime-acceptance.trace.json` 必须包含 `canonical-row-index`，其中 `surface-rows`、`operation-rows`、`state-rows`、`chain-rows` 四组 ID 必须分别完整镜像主体中的 RS-/OP-/ST-/CH- rows。
- `trace/runtime-acceptance.trace.json` 的 `runtime-upstream-coverage-map` 必须逐项列出 upstream item、type、projection/handling、runtime row IDs、coverage mode 和 not-applicable reason。
- Covered item 的 row IDs 必须全部存在于主体 canonical rows。
- `runtime-coverage-source-map` 可以保留主题汇总，但不得作为 upstream item 的唯一覆盖证明。
- `coverage-closure-checklist` 只是审计声明，不能替代逐项 map。
- artifact 末尾只保留短 `## Trace Appendix` 指针块。

## Reviewer Focus

- 是否存在 orphan source/scope item、scenario、design obligation 或 proof obligation。
- 是否有 upstream item 只通过聚合 closure、主题 source map 或 checklist 覆盖。
- 每个 row 是否可被 tasks 和 verification 投影引用。
- 是否混入 AC checkbox、implementation task、Proof Slice、测试文件、命令、evidence 或 deposit 字段。
