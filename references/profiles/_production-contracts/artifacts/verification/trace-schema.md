# Verification Trace Schema Contract

本文件定义 `trace/verification.trace.json` 的共享结构约束。它适用于 writer、repair-writer、reviewer、renderer 和 validator，但不定义 writer 的 Proof Slice 生成策略，也不替代 reviewer 的语义审查规则。

## JSON Trace Plane

`trace/verification.trace.json` 顶层只允许 verification 语义字段：

- `trace-schema`
- `artifact-id`
- `artifact-path`
- `change-name`
- `schema-name`
- `agent-role`
- `source-interface`
- `verification-slice-register`
- `verification-gate`
- `delivery-plane`

旧字段必须视为 hard error，防止多套 truth：

- `proof-slice-model`
- `proof-slice-summary`
- `runtime-fact-branch-inventory`
- `manual-not-applicable-inventory`
- `runtime-coverage-reconciliation`
- `slice-consistency-checklist`
- `persistent-test-required`
- `test-contract`

### source-interface

- `source-interface.runtime-trace` 必须为 `trace/runtime-acceptance.trace.json`。
- `source-interface.spec-traces[]` 必须列出实际 specs trace 路径；no-delta 时列出 no-delta marker trace。
- `source-interface.design-trace` 必须为 `trace/design.trace.json`。
- `source-interface.proposal-trace` 不得出现。
- 字段值只允许字符串或字符串数组，不得内联 source metadata object。

### verification-slice-register

每行必须包含且只使用以下语义字段：

```json
{
  "slice-id": "PS-001",
  "runtime-fact-ids": ["OP-001"],
  "primary-runtime-fact-id": "OP-001",
  "proof-type": "operation",
  "branch": "<single independently failing branch>",
  "oracle": "<single atomic assertion derived from runtime fact>",
  "failure-signal": "<observable failure signal>",
  "test-layer": "route/API",
  "production-owner": "<single production owner token>",
  "assertion-shape": "<primary assertion shape>",
  "fixture-boundary": "<mock/fixture/default-path boundary>",
  "proof-evidence-mode": "durable-test",
  "planned-test-directory": "tests/api/**",
  "non-persistent-reason": "N/A"
}
```

约束：

- `slice-id` 使用 `PS-###`，全文件唯一。
- `runtime-fact-ids[]` 只能引用 `runtime-acceptance` 中已定义的 `RS-/OP-/ST-/CH-###` fact。
- `primary-runtime-fact-id` 必须存在于同一 row 的 `runtime-fact-ids[]` 中。
- `proof-type` 只能是 `operation`、`state`、`failure`、`negative-boundary`、`layout`、`observability`、`fixture-variant`、`authorization`。
- `test-layer` 只能是 `unit`、`component`、`route/API`、`DB/integration`、`contract`、`worker/job`、`realtime/SSE`、`browser/e2e`、`visual/responsive`、`security/negative`。
- `branch`、`oracle`、`failure-signal` 和 `assertion-shape` 必须表达单一原子断言维度。
- `production-owner` 必须是单一 production code boundary token，不得包含 owner list、测试路径、runner、命令或 evidence path。
- `proof-evidence-mode` 只能是 `durable-test`、`readiness-command`、`build-command`、`codegen-command`、`compose-config-readback`、`static-boundary-readback`、`manual-environment`。
- `proof-evidence-mode: "durable-test"` 表示必须生成或确认持久测试；`planned-test-directory` 必须是外置 `tests/` 子树目录 glob，以 `/**` 结尾，并匹配 `test-layer` 默认子树。
- 非 `durable-test` 表示不生成持久测试；`planned-test-directory` 必须为 `N/A`，且 `non-persistent-reason` 必须给出 source/scope-backed reason。
- 持久测试 primary title 默认必须以 exact `slice-id` 开头；该规则不写入 trace。
- 不得写具体 test/spec 文件、固定测试命令、runner selector、`openspec-results/**`、`test-results/**` 或 evidence path。

Layer 默认目录子树：

- `unit -> tests/unit/**`
- `component -> tests/component/**`
- `route/API -> tests/api/**` 或 `tests/contract/**`
- `DB/integration -> tests/integration/**`
- `contract -> tests/contract/**`
- `worker/job -> tests/worker/**`
- `realtime/SSE -> tests/integration/**`
- `browser/e2e` / `visual/responsive -> tests/e2e/**`
- `security/negative -> tests/security/**` 或能真实触达边界的 layer 子树

### verification-gate

`verification-gate` 必须包含且只用于最小闭合结果：

- `blockers`
- `uncovered-runtime-facts`
- `invalid-runtime-refs`
- `non-atomic-slices`
- `invalid-proof-modes`
- `invalid-test-placement`
- `delivery-projection-mismatch`

Validator pass 要求上述数组全部为空。Coverage 由 validator 从 `runtime-fact-register[]` 中 `required behavior` / `preserve boundary` rows 与 `verification-slice-register[].runtime-fact-ids` 机械派生；writer 不再维护 runtime coverage reconciliation 表。

## Delivery Plane

- `delivery-plane.verification-intent` 是 renderer payload，包含 `scope`、`runtime-source` 和 `out-of-scope`。
- Markdown 主体只渲染 `Verification Intent` 和一张 `Proof Slice Matrix`。
- `Proof Slice Matrix` 必须是 `verification-slice-register[]` 的完整镜像。
- artifact 末尾只保留短 `## Trace Appendix` 指针块。
