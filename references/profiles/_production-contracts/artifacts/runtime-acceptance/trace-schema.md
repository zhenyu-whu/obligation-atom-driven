# Runtime Acceptance Trace Schema Contract

本文件定义 `trace/runtime-acceptance.trace.json` 的共享结构约束。它适用于 writer、repair-writer、reviewer、renderer 和 validator，但不定义 writer 的语义生成策略，也不替代 reviewer 的语义审查规则。

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
