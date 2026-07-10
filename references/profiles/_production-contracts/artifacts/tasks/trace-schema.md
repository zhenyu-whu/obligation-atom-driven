# Tasks Trace Schema Contract

本文件定义 `trace/tasks.trace.json` 的共享结构约束。它适用于 writer、repair-writer、reviewer、renderer 和 validator，但不定义 writer 的工程生成策略，也不替代 reviewer 的语义审查规则。

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
- `runtime-fact-ids`
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
- `source-interface.input-policy` 必须明确 tasks 使用 draft-first/link-second authoring：先从 specs/design 生成生产实现草案，再把 specs/design/runtime acceptance facts 作为客观 contribution/closure links；Markdown、verification、tests、evidence 不是语义输入。该字段是声明文本，不作为路径输入扫描对象。
- 字段值只允许字符串或字符串数组，不得内联 source metadata object。
- `source-interface` 不得声明 Markdown artifact、verification trace、proof-slices sidecar、测试文件、apply evidence 或 `openspec-results/**` 输入。

### implementation-step-register

每行必须包含：

```json
{
  "step-id": "AC-001",
  "title": "<production implementation step title>",
  "work-stage": "behavior",
  "depends-on-step-ids": [],
  "spec-scenario-links": [
    {
      "spec-scenario": "trace/specs/<capability>.trace.json#/spec-delta-register/0/scenarios/0",
      "contribution": "completes"
    }
  ],
  "design-detail-links": [
    {
      "design-detail-id": "IDR-001-D001",
      "contribution": "completes"
    }
  ],
  "runtime-fact-links": [
    {
      "runtime-fact-id": "OP-001",
      "contribution": "completes"
    }
  ],
  "tasks": [
    {
      "task-id": "AC-001.1",
      "title": "<concrete production implementation work>",
      "work-stage": "behavior",
      "spec-scenario-links": [
        {
          "spec-scenario": "trace/specs/<capability>.trace.json#/spec-delta-register/0/scenarios/0",
          "contribution": "completes"
        }
      ],
      "design-detail-links": [
        {
          "design-detail-id": "IDR-001-D001",
          "contribution": "completes"
        }
      ],
      "runtime-fact-links": [
        {
          "runtime-fact-id": "OP-001",
          "contribution": "completes"
        }
      ],
      "work": "<production behavior to build or preserve, including boundary, runtime result, failure/boundary handling, and out-of-scope guard>"
    }
  ]
}
```

约束：

- `step-id` 使用 `AC-###`，全文件唯一。
- `task-id` 使用 `AC-###.<n>`，且必须属于同一 step。
- `work-stage` 只能是 `foundation`、`contract`、`behavior`、`surface`、`integration`、`preserve-boundary` 或 `rollout`。
- `depends-on-step-ids[]` 只能引用同文件前置 `step-id`。
- 每个 AC / checkbox 必须至少声明一个 spec/design/runtime link。
- links 必须在 AC / checkbox 草案完成后客观填写；不得为了满足 closure invariant 而创建非生产任务或伪造 contribution。Validator 只校验可判定的引用、枚举和 closure；是否伪造 contribution 由 reviewer/preflight 语义审查。
- 每个 in-scope spec scenario 必须至少被一个 checkbox task 以 `contribution == "completes"` 覆盖。
- 每个非 `non-applicable` implementation detail 必须至少被一个 checkbox task 以 `contribution == "completes"` 覆盖。
- 每个 required runtime fact 必须至少被一个 checkbox task 以 `contribution == "completes"` 覆盖。
- 每个 preserve runtime fact 必须至少被一个 checkbox task 以 `contribution == "enforces"` 覆盖。

### contribution enums

- `spec-scenario-links[].contribution` 只允许 `supports` 或 `completes`；只有 `completes` 关闭 spec scenario coverage。
- `design-detail-links[].contribution` 只允许 `uses`、`implements-part` 或 `completes`；只有 `completes` 关闭 implementation detail coverage。
- `runtime-fact-links[].contribution` 只允许 `supports`、`contributes`、`completes` 或 `enforces`；`required behavior` 必须由 `completes` 关闭，`preserve boundary` 必须由 `enforces` 关闭。

### task-gate

`task-gate` 必须包含且只用于最终最小闭合结果：

- `blockers`
- `uncovered-spec-scenarios`
- `incomplete-design-details`
- `incomplete-runtime-facts`
- `invalid-spec-refs`
- `invalid-design-detail-refs`
- `invalid-runtime-fact-refs`
- `dependency-order-violations`
- `hidden-dependency-violations`
- `non-production-task-violations`
- `delivery-projection-mismatch`

Validator pass 要求上述数组全部为空。该要求是最终 artifact invariant，不是 writer 按 coverage 矩阵生成 AC / checkbox 的策略；writer 不得为了清空 gate 创建 proof-only、acceptance-only、coverage-only 或 artifact-closure task。Validator warning 必须进入 reviewer/preflight 判断，不能因 hard error 为空而跳过。

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
- `delivery-plane` 不得重复定义 step、task、spec scenario、design detail、runtime fact、coverage 或 projection 字段。
- artifact 末尾只保留短 `## Trace Appendix` 指针块。

## Markdown Delivery Plane

- 文件开头必须是 `## AC-### <中文生产实现步骤名称>`。
- 每个 AC section 只渲染 `Work Stage:`、非空 `Depends On:` 和 checkbox tasks；不得在 Markdown 中渲染 `Spec Scenarios:`、`Design Details:` 或 `Runtime Contributions:`。
- 每个 AC section 必须来自 `trace/tasks.trace.json#/implementation-step-register[]` 的 exact row；不得手写 Markdown 后再补 trace。
- AC 级 `spec-scenario-links[]`、`design-detail-links[]` 和 `runtime-fact-links[]` 只保留在 `trace/tasks.trace.json` 中，作为 validation、closure 和 reviewer 审计输入。
- 不再渲染 `Outcome`、AC 级 `Work`、`Preserve`、`Proof`、`Acceptance` 或 `Resolved Runtime Contract`。
- 每个 checkbox task 只渲染 checkbox 标题、`Work Stage:` 和 `Work:`；不得在 Markdown 中渲染三类 links。

## Validator 边界

- Hard error 只覆盖确定性 trace/register 问题：结构、引用解析、closure、dependency、delivery projection、legacy 字段、schema source coverage 泄漏和 evidence/apply path 泄漏。
- AC/task `title` 或 `work` 中出现具体测试文件或测试 runner 命令时，validator 只输出 warning；reviewer/preflight 必须判断它是否构成 proof-only、test-only、evidence-only 或 coverage-only task。
