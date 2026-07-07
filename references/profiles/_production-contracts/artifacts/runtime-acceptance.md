# Runtime Acceptance Artifact Contract

## 目的

`runtime-acceptance.md` 把 specs/design traces 综合成一组独立可验证的运行态事实，服务实现阶段避免遗漏典型 Web 项目的 surface、operation、state/branch、async/chain。

`runtime-fact-register[]` 是唯一 canonical semantic register。每条 fact 同时也是下游可引用的 typed runtime row，ID 直接使用 `RS-/OP-/ST-/CH-###`，字段名统一为 `runtime-fact-id`。不存在独立 `RF-###`、`runtime-row-id`、`canonical-row-index` 或 `delivery-plane.canonical-rows[]`。

Runtime acceptance 不是逐 proposal item 的 coverage matrix，也不是测试计划。proposal 中未进入 specs/design 的 item 在 runtime 阶段视为不存在；coverage gate 只反查 specs scenario 和 runtime-affecting design decision 是否被 runtime facts 覆盖。

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

## JSON Trace Plane

`trace/runtime-acceptance.trace.json` 顶层只允许 runtime acceptance 语义字段：

- `trace-schema`
- `artifact-id`
- `artifact-path`
- `change-name`
- `schema-name`
- `agent-role`
- `source-interface`
- `runtime-fact-register`
- `runtime-gate`
- `delivery-plane`

旧字段必须视为 hard error，防止多套 truth：

- `canonical-row-index`
- `delivery-plane.canonical-rows`
- `runtime-row-id`
- `runtime-row-ids`
- `source-anchor`
- `source-type`
- `source-handling`
- `fact-id`
- `fact-layer`
- `fact-kind`
- `not-applicable-reason`
- `upstream-runtime-obligation-inventory`
- `runtime-not-applicable-inventory`
- `runtime-upstream-coverage-map`
- `runtime-coverage-source-map`
- `coverage-closure-checklist`
- `design-decision-index`
- `design-obligation-matrix`
- `ui-control-contracts`
- `proof-expectation-handoff`

### source-interface

- `source-interface.specs-completion-mode` 必须匹配实际 specs trace completion mode：`delta` 或 `no-delta`。
- `source-interface.spec-traces[]` 必须等于实际 specs trace 路径集合。
- `source-interface.design-trace` 必须为 `trace/design.trace.json`。
- `source-interface.proposal-trace` 不得出现。
- 字段值只允许字符串或字符串数组，不得内联 source metadata object。

### runtime-fact-register

每行必须包含且只使用以下语义字段：

```json
{
  "runtime-fact-id": "OP-001",
  "fact-type": "operation",
  "scope-role": "required behavior",
  "source-basis": {
    "spec-scenarios": ["trace/specs/<capability>.trace.json#/spec-delta-register/0/scenarios/0"],
    "design-decisions": ["IDR-001"]
  },
  "owner-candidate": "<single advisory owner>",
  "runtime-fact": "<independent verifiable runtime fact>",
  "observable-fact": "<visible/API/data/log/readback observable>",
  "default-path-policy": "<production/default path policy and reason>",
  "external-boundary": "<provider/storage/network/env boundary or None>",
  "no-scope-expansion-check": "<why this fact stays inside source scope>"
}
```

约束：

- `runtime-fact-id` 全文件唯一，且 ID 前缀必须与 `fact-type` 一致：`RS`/`surface`、`OP`/`operation`、`ST`/`state`、`CH`/`chain`。
- `scope-role` 只允许 `required behavior`、`preserve boundary`。
- `source-basis.spec-scenarios[]` 必须引用实际 specs trace scenario pointer。
- `source-basis.design-decisions[]` 必须引用实际 `implementation-design-register[]` 的 `IDR-###`。
- `source-basis` 不得包含 `proposal-context[]` 或其它 proposal/source coverage 字段。
- 每个 fact 必须至少有一个 spec scenario 或 design decision。
- `owner-candidate` 必须是单一 advisory primary owner candidate；多模块依赖写入 `external-boundary` 或 `default-path-policy`，不得写 owner list。
- 不得混入 AC checkbox、implementation task、Proof Slice、测试文件、固定命令、evidence path、执行状态或 deposit 字段。
- 不得生成只描述测试覆盖、verification intent、proof closure 或 artifact closure 的 runtime fact。

### runtime-gate

`runtime-gate` 必须包含且只用于最小闭合结果：

- `blockers`
- `uncovered-spec-scenarios`
- `uncovered-runtime-design-decisions`
- `orphan-runtime-facts`
- `invalid-source-refs`
- `delivery-projection-mismatch`

Validator pass 要求上述数组全部为空。

Coverage 规则：

- 每个 in-scope added/modified spec scenario 必须被至少一个 runtime fact 覆盖。
- 每个 runtime-affecting `IDR-###` 必须被至少一个 runtime fact 覆盖。
- Proposal-only item 不参与 runtime coverage；若其生产语义未进入 specs/design，runtime 不得补救推导。

## Delivery Plane

`delivery-plane` 只作为 renderer payload，从 `runtime-fact-register[]` 投影：

```json
{
  "runtime-acceptance-intent": {
    "scope": "...",
    "source-basis": "...",
    "out-of-scope": "..."
  },
  "fact-sections": {
    "surface-facts": ["RS-001"],
    "operation-facts": ["OP-001"],
    "state-facts": ["ST-001"],
    "chain-facts": ["CH-001"]
  }
}
```

规则：

- Markdown 四张表必须按 `fact-sections` 顺序从 `runtime-fact-register[]` 渲染。
- `delivery-plane` 不得重复定义 runtime fact 字段，不得包含 `canonical-rows[]`。
- 每个 section ID 必须存在于 `runtime-fact-register[]`，且前缀、section 与 `fact-type` 一致。
- `fact-sections` 四个数组合并后的 ID 集必须与 `runtime-fact-register[].runtime-fact-id` 完全一致。
- artifact 末尾只保留短 `## Trace Appendix` 指针块，完整 fact register 和 gate 不写入 Markdown。

## Reviewer Focus

- 是否只读取 specs/design JSON traces。
- 是否综合上游输入生成独立可验证 runtime facts，而不是按 specs/design anchor 逐行生成 coverage fact。
- 每条 fact 是否足够细，且没有吞并独立 operation、state/branch、failure/security/layout/async boundary。
- `source-basis` 是否只引用实际存在的 specs scenario 和 runtime-affecting design decision。
- specs、runtime-affecting design 是否由 gate 反查闭合。
- 是否存在 `proof-only`、测试覆盖、verification intent 或 proof closure 被包装成 runtime fact。
- 是否存在旧字段、多套 coverage truth、Markdown semantic input、source/scope 外 runtime behavior，或任务/测试/evidence 字段泄漏。
