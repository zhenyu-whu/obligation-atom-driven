# Runtime Acceptance Reviewer Contract

本文件只适用于 `runtime-acceptance-reviewer` 和 integration reviewer 中针对 runtime-acceptance artifact 的审查。Reviewer 的任务是判断 runtime acceptance trace 是否真实达成 specs/design 输入的可观察运行语义，并处理 validator warning；不得直接修改 artifact。

## Reviewer 输入

- 必须读取当前 artifact trace：`trace/runtime-acceptance.trace.json`。
- 必须读取必要 upstream dependency traces：实际 `trace/specs/*.trace.json` 或 no-delta marker，以及 `trace/design.trace.json`。
- 必须读取 runtime-acceptance contract bundle：common contracts、`artifacts/runtime-acceptance/index.md`、`artifacts/runtime-acceptance/trace-schema.md` 和本文件。
- 必须读取 partial validator 报告并逐条处理 warning。
- 不得把当前或上游 Markdown Delivery Plane 当作语义输入；Markdown 只可作为 renderer projection 的人读结果，不得替代 trace 审查。
- 不得读取 proposal trace、当前实现、测试文件、`openspec-results/**` apply evidence、`apply-result.md`、`proof-test-map.json`、evidence 或 apply 阶段产物来推导 oracle。

## 审查顺序

1. 确认 trace schema、source-interface、legacy fields、runtime-fact-register、runtime-gate 和 delivery-plane 结构符合 `artifacts/runtime-acceptance/trace-schema.md`。
2. 从 specs trace 读取所有 in-scope added/modified scenario anchors；no-delta marker 不产生 scenario input。
3. 从 design trace 读取所有 runtime-affecting `implementation-design-register[]` rows。
4. 审查每条 runtime fact 是否是独立可验证运行事实，而不是 specs scenario、design decision、coverage row、proof expectation 或 task checkbox 的机械投影。
5. 审查每条 runtime fact 的粒度是否足够细，没有吞并独立 operation、state/branch、failure/security/layout/async boundary。
6. 审查 `source-basis` 是否只引用实际存在的 specs scenario 和 runtime-affecting design decision。
7. 反查每个 in-scope specs scenario 是否被至少一个 runtime fact 真实覆盖，而不是只出现在 gate 或 source-basis closure 中。
8. 反查每个 runtime-affecting design decision 是否被至少一个 runtime fact 真实吸收，而不是只出现在 `source-basis.design-decisions[]` link 中。
9. 审查 delivery-plane 是否只承载 renderer payload，没有 coverage、gate、trace pointer、proof、task、test 或 evidence 字段泄漏。
10. 审查 validator warning；可修复项必须输出 blocker，确认为 false positive 时必须说明原因。

## 必须 Blocker 的情况

- Reviewer 输入缺少 required contract bundle、runtime trace、必要 specs trace、design trace 或 partial validator 报告。
- Runtime trace 从 proposal trace、Markdown artifact、实现、测试、apply result 或 evidence 推导 runtime fact。
- Runtime fact 按 specs/design anchor 逐行生成 coverage fact，而不是独立可验证的运行态事实。
- Runtime fact 粒度过粗，吞并独立 operation、state/branch、failure/security/layout/async boundary。
- `source-basis` 引用不存在的 specs scenario、非 runtime-affecting design decision、proposal context、GA/SI source coverage、task、proof、test 或 evidence。
- Specs scenario 或 runtime-affecting design decision 没有被 runtime facts 真实覆盖，或只通过 gate/link closure 被标记为覆盖。
- 存在 `proof-only`、测试覆盖、verification intent、proof closure、task checkbox 或 artifact closure 被包装成 runtime fact。
- 存在旧字段、多套 coverage truth、source/scope 外 runtime behavior，或任务/测试/evidence 字段泄漏。
- Delivery Plane 泄漏 coverage、gate、register rows、trace pointer、proof、task、test 或 evidence 字段。
- Validator warning 未处理，或 reviewer 仅以 validator pass / empty gate / source-basis closure / rendered Markdown 作为语义通过依据。

## Pass 条件

Reviewer 只能在同时满足以下条件时输出 `Pass`：

- 已读取的 contract bundle 文件和 trace 输入完整。
- Validator warning 已处理或不存在。
- Runtime trace 只读取 specs/design JSON traces；未从 proposal、Markdown、实现、测试或 evidence 推导 oracle。
- 每个 in-scope specs scenario 和 runtime-affecting design decision 均有真实 runtime fact 覆盖。
- 每条 runtime fact 都独立可验证，粒度足够细，source-basis 真实，且不包含 proof/test/task/evidence 或 scope 外行为。
- Delivery Plane 是同一 `runtime-fact-register[]` 的人读投影，没有 coverage 泄漏或 scope expansion。

## 输出协议

Reviewer 输出必须遵守 `openspec/schemas/_production-contracts/common/reviewer-output-protocol.md`：只能输出 `Pass` 或 `Blocker`。Blocker 必须包含 artifact path、trace anchor、contract source path + section heading、问题描述和所需修复方向。
