# Runtime Acceptance Writer Contract

本文件只适用于 `runtime-acceptance-writer` 和 `runtime-acceptance-repair-writer`。Writer 的核心任务是把 specs scenarios 与 design decisions 综合成独立可验证的运行态事实；trace links 和 gate 是完成后的客观投影与自查结果，不是生成策略。

## 写入前

- 读取所有实际生成的 `trace/specs/*.trace.json` 或 no-delta marker trace，以及 `trace/design.trace.json`。
- 不得从 `proposal.md`、`specs/**/*.md`、`design.md`、旧 `runtime-acceptance.md`、当前实现、测试文件、apply result 或 evidence 推导 runtime fact。
- 使用 specs trace 的 in-scope added/modified scenario pointer 作为 requirement/scenario 输入；no-delta marker 不产生 scenario input。
- 使用 design trace 的 `implementation-design-register[]` 作为 design 输入；runtime-affecting design decision 必须覆盖，纯 verification/rollout/implementation organization 且无可观察运行事实的 design row 不生成 fact。
- 不读取 proposal trace 作为 runtime 语义输入；`verification-obligation` / `proof` 只在 specs/design 阶段作为参考，未被 specs/design 吸收时 runtime 直接忽略。
- Writer 只写严格 JSON `trace/runtime-acceptance.trace.json`；`runtime-acceptance.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 从 trace 写入。

## Runtime Fact Synthesis Algorithm

Writer 必须按以下顺序生成 runtime acceptance trace：

1. 从 specs scenario 抽取可观察 surface、trigger/action/query/mutation、expected result、readback、state branch、failure branch、async dependency。
2. 从 design decision 补齐 owner candidate、模块边界、API/data/storage/default path、guard/failure handling、external boundary。
3. 先形成候选 runtime facts，再按 split/merge rules canonicalize。
4. 最后用 `runtime-gate` 反查 specs/design coverage、orphan facts、invalid refs 和 delivery projection mismatch。

### Fact 类型

- `surface`：用户、API consumer、worker/operator 可进入或观察到的运行面，ID 前缀必须为 `RS-###`。
- `operation`：一次 trigger/action/query/mutation 及其直接成功、失败、readback 结果，ID 前缀必须为 `OP-###`。
- `state`：运行中或持久化后的状态、分支、约束态，ID 前缀必须为 `ST-###`。
- `chain`：跨步骤、跨请求、异步、外部 provider 或顺序依赖链，ID 前缀必须为 `CH-###`。

### Split / Merge

- 不同 owner、可观察面、失败分支、持久化/readback、async timing 或 runtime oracle 的事实必须拆分。
- 多个 source inputs 指向同一个可观察运行事实，且 owner、runtime oracle、default path 一致时可以合并。
- preserve boundary 不单独建类型，按禁止对象归入 `surface`、`operation`、`state` 或 `chain`。
- 不生成 `not-applicable`、`proof-only` 或 coverage-only fact；不适用的 design row 由 validator 根据 design row 内容判定。

## Writer 提交前结构检查

调用 renderer 前，writer 只做结构一致性检查：

- `trace/runtime-acceptance.trace.json` 是严格 JSON，且只包含 `artifacts/runtime-acceptance/trace-schema.md` 允许的顶层字段。
- `source-interface` 只引用实际 specs/design trace，不包含 proposal trace、Markdown artifact、实现、测试、evidence 或 apply-stage 输入。
- 每个 runtime fact ID、fact type、source basis、owner candidate、default path policy、external boundary 和 no-scope-expansion check 都符合 shared trace schema。
- `runtime-fact-register[]` 是独立可验证 runtime fact register，不是 specs scenario、design decision、coverage row、proof expectation 或 task checkbox 的逐行镜像。
- `delivery-plane` 只保存 renderer payload，不泄漏 coverage、gate、trace pointer、测试计划、proof slice、task 或 evidence 字段。
- 若结构检查或生成后的 gate 出现缺口，writer 必须返回 blocker 或修订上游/语义模型；不得为了清空 gate 创建 proof-only、coverage-only、not-applicable 或 source/scope 外 runtime fact。

## Repair Writer

Repair-writer 必须重新读取最新 specs trace、design trace、当前 runtime trace、contract bundle、validator hard error 和 reviewer blocker。修复时应重建受影响的 runtime fact semantic model，而不是局部补字段来关闭 validator 或 reviewer finding。
