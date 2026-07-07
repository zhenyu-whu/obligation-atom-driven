# Verification Artifact Contract

## 目的

`verification.md` 是 independent test intent and oracle artifact。它的唯一语义源是 `trace/verification.trace.json#/verification-slice-register`。每个 `verification-slice-register[]` row 是一个原子 Proof Slice，描述一个可验证 runtime 分支、oracle、证明层级和持久/非持久 proof 方式。

`runtime-acceptance` 是唯一 oracle 来源。Verification 不读取 proposal/specs/design 重新建立 source/scope mapping，也不得从这些上游 artifact 发明 runtime acceptance 之外的 oracle。`verification.md` 只是 renderer 从 register 投影的人类可读镜像，不定义测试执行计划、具体测试文件、固定命令、runner selector 或 evidence path。

## 写入前

- 读取 `trace/runtime-acceptance.trace.json` 的 `runtime-fact-register[]` 和 `runtime-gate`。
- 对每个 `required behavior`、`preserve boundary` runtime fact，拆出所有独立可失败分支。
- 每个可验证分支生成一个 `PS-###` row；无法验证或存在冲突时写入 `verification-gate.blockers`，不得伪造 slice。
- Writer 只写严格 JSON `trace/verification.trace.json`；`verification.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 生成。

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

旧字段必须视为 hard error：

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

## Reviewer Focus

- 是否只从 `trace/runtime-acceptance.trace.json#/runtime-fact-register` 派生 oracle。
- 每个 required / preserve runtime fact 是否至少被一个 Proof Slice 覆盖。
- 每个 slice 是否原子，且未合并 operation、state、failure/retry、auth/security、layout、observability、fixture variant、viewport 或 redaction branch。
- `proof-evidence-mode` 是否正确决定持久测试或非持久 proof。
- durable slice 的 `planned-test-directory` 是否是合法目录级 glob，并匹配 `test-layer`。
- non-durable slice 是否使用 `N/A` 和明确 `non-persistent-reason`。
- 是否存在旧字段、多套 coverage truth、Markdown semantic input、source/scope 外 oracle、测试执行计划或 evidence 字段泄漏。
