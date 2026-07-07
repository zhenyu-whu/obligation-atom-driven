# Tasks Artifact Contract

## 目的

`tasks.md` 是 production implementation Delivery Plane。AC sections 是 implementation worker 默认入口；`trace/tasks.trace.json` 是唯一机器语义输入。Markdown 只是 JSON trace 的 render 结果。

Tasks 的核心目标是：理解 proposal/specs/design 背景，以 `trace/runtime-acceptance.trace.json#/runtime-fact-register[]` 中的 required / preserve runtime facts 为实现目标，分解为按顺序执行的生产实现步骤。

Tasks 不维护 source/scope coverage、runtime acceptance index 或 runtime fact projection 的第二套真相。source/scope 覆盖只能通过 runtime fact 的 `source-basis` 反查。

## 写入前

- 读取 `trace/proposal.trace.json`、所有实际生成的 `trace/specs/*.trace.json` 或 `trace/specs/no-spec-delta/README.trace.json`、`trace/design.trace.json` 和 `trace/runtime-acceptance.trace.json`。
- 不读取 `proposal.md`、`specs/**/*.md`、`design.md`、`runtime-acceptance.md`、`verification.md`、`trace/verification.trace.json`、测试文件、测试命令、apply evidence 或 `openspec-results/**` 来派生 step、checkbox 或 runtime proof。
- 从 runtime acceptance 读取 canonical `runtime-fact-register[]`，并把 `scope-role` 为 `required behavior` 或 `preserve boundary` 的 rows 作为 tasks 实现目标。
- writer 只写 `trace/tasks.trace.json`；`tasks.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 从同一 trace 写入。

## Writer 生成顺序

1. 读取 proposal/specs/design traces 作为背景和边界输入；不得从这些 traces 重新生成 coverage table。
2. 从 runtime acceptance 建立目标 runtime fact set：`required behavior` 和 `preserve boundary` 必须被实现 task 覆盖。
3. 将目标 runtime facts 归并为最小有序 `implementation-step-register[]`。每个 step 必须代表 production runtime work，而不是 proof、coverage 或 artifact closure。
4. 为每个 step 生成 checkbox tasks；每个 checkbox 必须落到 production implementation work，并声明它负责的 runtime facts。
5. 用 `depends-on-step-ids[]` 表达拓扑顺序；dependency 必须只指向前置 step。
6. 从同一 register 投影 `delivery-plane.step-sections[]`，该数组只保存渲染顺序，不重复 step 字段。
7. 生成 `task-gate`；gate 只记录 blocker、未覆盖目标 runtime facts、非法 runtime fact refs、依赖顺序问题、非生产任务问题和 delivery projection mismatch。

## AC Creation Gate

- 只有当一个 step 提供或实质修改 current-change production runtime behavior，或提供必须由本 change 交付的 preserve boundary，才允许创建该 step。
- 不得创建名称或 scope 仅为 proof closure、verification closure、evidence closure、coverage closure 或 acceptance proof closure 的 step。
- Foundation mode 下，step 和 checkbox 必须是生产工程底座实现工作，例如 workspace、app skeleton、scripts、config、migration、health/readiness、生成链路、package boundary、Compose/local smoke 或 CI conformance。

## AC Section

- 文件开头必须是 `## AC-### <中文生产实现步骤名称>`。
- 每个 AC section 必须包含 `Runtime Facts:`，随后是 checkbox tasks；只有 `depends-on-step-ids[]` 非空时才渲染 `Depends On:`。
- 每个 AC section 必须来自 `trace/tasks.trace.json#/implementation-step-register[]` 的 exact row；不得手写 Markdown 后再补 trace。
- `Runtime Facts:` 只能列 runtime acceptance 中已定义的 runtime fact IDs。
- 不再渲染 `Outcome`、AC 级 `Work`、`Preserve`、`Proof` 或 `Resolved Runtime Contract`；worker 必须通过 runtime fact IDs 回读 `trace/runtime-acceptance.trace.json` 或 `runtime-acceptance.md`。

## Checkbox Task

- 每个 checkbox task 必须包含 `Runtime Facts:` 和 `Work:`。
- checkbox 必须代表 production implementation work。
- task-level `Runtime Facts:` 只能列该 task 实现、实质修改或保留的 facts；仅由 proof/readback 观察的 supporting facts 不得列入。
- `Work:` 描述要改变或保留的生产行为，不写 file-edit summary。
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
- `source-interface.input-policy` 必须明确 tasks 使用 proposal/spec/design 作为背景、runtime acceptance facts 作为实现目标，且 Markdown、verification、tests、evidence 不是语义输入。
- 字段值只允许字符串或字符串数组，不得内联 source metadata object。

### implementation-step-register

每行必须包含：

```json
{
  "step-id": "AC-001",
  "title": "<production implementation step title>",
  "depends-on-step-ids": [],
  "runtime-fact-ids": ["RS-001"],
  "tasks": [
    {
      "task-id": "AC-001.1",
      "title": "<concrete production implementation work>",
      "runtime-fact-ids": ["RS-001"],
      "work": "<production behavior to build or preserve>"
    }
  ]
}
```

约束：

- `step-id` 使用 `AC-###`，全文件唯一。
- `task-id` 使用 `AC-###.<n>`，且必须属于同一 step。
- `depends-on-step-ids[]` 只能引用同文件前置 `step-id`。
- `runtime-fact-ids[]` 只能引用 runtime acceptance 中存在的 required / preserve runtime facts。
- 每个 required / preserve runtime fact 必须至少被一个 checkbox task 覆盖。

### task-gate

`task-gate` 必须包含且只用于最小闭合结果：

- `blockers`
- `uncovered-target-runtime-facts`
- `invalid-runtime-fact-refs`
- `dependency-order-violations`
- `non-production-task-violations`
- `delivery-projection-mismatch`

Validator pass 要求上述数组全部为空。

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
- `delivery-plane` 不得重复定义 step、task、runtime fact、coverage 或 projection 字段。
- artifact 末尾只保留短 `## Trace Appendix` 指针块。

## Reviewer Focus

- 是否以 runtime acceptance required / preserve facts 为唯一实现目标。
- 每个 required / preserve runtime fact 是否被 production checkbox 覆盖。
- 是否存在只为 proof、verification 或 coverage closure 存在的任务。
- step 拓扑是否存在后置 dependency、循环依赖或 hidden runtime dependency。
- task-level runtime facts 是否误列 supporting facts。
- 是否混入测试矩阵、执行证据、固定命令、测试文件、evidence 或 deposit 字段。
