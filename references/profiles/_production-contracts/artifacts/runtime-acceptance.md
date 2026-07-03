# Runtime Acceptance Artifact Contract

## 目的

`runtime-acceptance.md` 是 tasks.md 和 verification.md 共同引用的 canonical runtime coverage registry。它只定义 `RS-/OP-/ST-/CH-` runtime rows、source/scope basis、runtime obligation、observable fact、owner candidate、default path policy、external boundary、scope role 和 no-scope-expansion check。

## 写入前

- 读取 `trace/proposal.trace.json`、所有实际生成的 `trace/specs/*.trace.json` 或 `trace/specs/no-spec-delta/README.trace.json`，以及 `trace/design.trace.json`。
- 建立 upstream runtime obligation inventory：每个 material source/scope item、in-scope spec scenario、material design decision/obligation、guard 和 proof handling item 都必须成为 inventory item；非 runtime item 必须记录 source/scope-backed not-applicable reason。
- 从上游 traces 抽取 runtime surfaces、operations、states/branches、async/realtime chains，以及 explicit no-async/no-worker/no-queue/no-side-effect preserve boundaries；不得从上游 Markdown Delivery Plane 推导 runtime row。
- 对每个 upstream item 分配一个或多个具体 runtime row IDs；不得只用主题汇总行、closure checklist 或聚合行表示覆盖。
- 当 `proposal-alignment-gate.change-kind` 为 `foundation` 时，只允许为当前 foundation change 的可观察工程运行事实分配 runtime row；允许 surface 包括 workspace/script、app skeleton 启动、health/readiness、config/env、Prisma/migration readback、OpenAPI/proto generation、package boundary、Compose/local smoke 和 CI conformance。纯架构原则、未来部署预留、云中立性、非目标、长期 preserve guard 必须写 not-applicable reason，不能生成 runtime row。
- 建立 trace-backed upstream runtime obligation inventory、not-applicable inventory、canonical runtime row model、row type/index、upstream-to-row coverage map、source map、closure checklist inputs 和 `delivery-plane` render payload。
- writer 只写 `trace/runtime-acceptance.trace.json`；`runtime-acceptance.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 从同一 trace-backed runtime row ID 集写入。
- canonical runtime row ID 集必须同时渲染为 Markdown 表格和 trace `canonical-row-index`，不得手工维护两套 row truth。

## Upstream Input Model

- Runtime acceptance writer 必须读取 `trace/proposal.trace.json`、实际存在的 `trace/specs/**/*.trace.json` 或 `trace/specs/no-spec-delta/README.trace.json`、以及 `trace/design.trace.json` 作为唯一语义输入。
- `proposal.md`、`specs/**/*.md`、`design.md` 是 renderer 投影后的 Delivery Plane，不得作为 source/scope register、requirement/scenario、design decision、runtime row、proof handoff 或 coverage oracle。
- Proposal trace direct register 是 runtime acceptance 必须吸收的完整 source/scope item 集；specs trace 只提供 requirement/scenario anchor；design trace 提供 design decision、placement、guard handling、UI control contract 和 proof expectation handoff。
- `runtime-coverage-source-map` 和 `coverage-closure-checklist` 只能作为审计汇总，不得替代逐项 `runtime-upstream-coverage-map`。
- 如果上游 trace 无法支持某个 runtime row、branch、failure path、default path 或 no-scope boundary，writer 必须修订上游 trace 或记录 blocker；不得只在 runtime Markdown prose 中补写。

## Trace Generation Algorithm

Writer 必须按以下顺序生成 runtime acceptance trace：

1. 读取 proposal trace direct source/scope register，建立 profile-specific source item index。
2. 读取实际 specs trace，建立 requirement/scenario anchor index；no-delta marker 不产生 scenario。
3. 读取 design trace，建立 `D-###` decision、`P-###` placement、design obligation matrix、UI control contract 和 proof handoff index。
4. 建立 `upstream-runtime-obligation-inventory[]`：每个 material proposal direct item、in-scope spec scenario、material design decision/obligation、guard 和 proof handoff item 必须正好一行。
5. 对每个 inventory item 判定 `coverage-mode`：`covered-by-runtime-rows` 或 `not-applicable`；not-applicable 必须给出 source/scope-backed reason，且不得带 runtime row IDs。
6. 从 covered inventory item 拆出 runtime surfaces、operations、states/branches、async/realtime chains 和 explicit no-async/no-worker/no-side-effect preserve boundary。
7. 生成 canonical row model；每个 row 使用唯一 `RS-###`、`OP-###`、`ST-###` 或 `CH-###`，并声明 owner、runtime obligation、observable fact、default path、external boundary、source basis、projection type、scope role 和 no-scope check。
8. 生成 `canonical-row-index`；四个数组必须与 canonical row model 按 row type 完全一致。
9. 生成 `runtime-upstream-coverage-map[]`；每个 upstream inventory item 必须在该 map 中逐项覆盖，不得只出现在 source map 或 checklist。
10. 生成 `runtime-coverage-source-map[]` 和 `coverage-closure-checklist`；它们只能从 canonical rows 与 upstream map 汇总，不得新增语义。
11. 从同一 canonical row model 投影 `delivery-plane.runtime-acceptance-intent` 和 `delivery-plane.canonical-rows`。
12. 写入严格 JSON `trace/runtime-acceptance.trace.json`，再调用 renderer 生成 `runtime-acceptance.md`、Trace Appendix 和 manifest registry entry。

## Canonical Rows

- Runtime row ID 必须唯一，只使用 `RS-###`、`OP-###`、`ST-###`、`CH-###`。
- 每个 row 必须包含 source/scope basis、runtime obligation、observable fact、owner candidate、default path policy、external boundary、scope role 和 no-scope-expansion check。
- `Owner Candidate` 是单一 advisory primary owner candidate；多模块依赖写 `External Boundary` 或 default path，不写 owner list。
- `Runtime Surface Inventory` 只定义 surface rows。
- `Operation Coverage Matrix` 只定义 operation rows。
- `State / Branch Coverage Matrix` 只定义 state/branch rows。
- `Async / Realtime Chain Matrix` 只定义 async/realtime 或 explicit no-async boundary rows。
- 如果 upstream item 包含多个独立 verb、state、failure class、fixture variant、viewport、安全分支或日志类别，row 的 runtime obligation、failure/branch/default/no-scope 字段必须保留这些可失败分支名称，不得泛化吞并。

## Delivery Plane Projection Rules

- `delivery-plane.runtime-acceptance-intent` 和 `delivery-plane.canonical-rows` 必须全部由同一个 trace-backed runtime row model 投影。
- Delivery Plane 不得直接从 template 注释、proposal/spec/design Markdown、旧 runtime Markdown、当前实现、测试文件或 apply 结果推导 runtime behavior。
- 每个 rendered runtime row 必须存在于 `delivery-plane.canonical-rows` 和 `canonical-row-index`；每个 indexed canonical row 也必须渲染到对应 Markdown 表格。
- Delivery Plane 可以使用人类可读文本总结 source basis 和 no-scope boundary，但不得改变 upstream item 的 source/scope ID、projection/handling、coverage mode、default path 或 scope role。
- artifact 末尾只保留短 `## Trace Appendix` 指针块，完整 coverage map、inventory 和 checklist 不写入 Markdown。

## JSON Trace Plane

- `trace/runtime-acceptance.trace.json` 必须包含 `canonical-row-index`，其中 `surface-rows`、`operation-rows`、`state-rows`、`chain-rows` 四组 ID 必须分别完整镜像主体中的 RS-/OP-/ST-/CH- rows。
- `trace/runtime-acceptance.trace.json` 必须包含 `source-interface`、`upstream-runtime-obligation-inventory`、`runtime-not-applicable-inventory`、`runtime-upstream-coverage-map`、`runtime-coverage-source-map`、`coverage-closure-checklist` 和 `delivery-plane`。
- `source-interface` 只能列 JSON trace/sidecar 输入；不得把 proposal/spec/design Markdown 写成 semantic input。
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
