# Tasks Reviewer Contract

本文件只适用于 `tasks-reviewer` 和 integration reviewer 中针对 tasks artifact 的审查。Reviewer 的任务是判断 tasks trace 是否真实达成 specs/design/runtime 输入的 production implementation plan 语义，并处理 validator warning；不得直接修改 artifact。

## Reviewer 输入

- 必须读取当前 artifact trace：`trace/tasks.trace.json`。
- 必须读取必要 upstream dependency traces：`trace/proposal.trace.json`、实际 `trace/specs/*.trace.json` 或 no-delta marker、`trace/design.trace.json` 和 `trace/runtime-acceptance.trace.json`。
- 必须读取 tasks contract bundle：common contracts、`artifacts/tasks/index.md`、`artifacts/tasks/trace-schema.md` 和本文件。
- 必须读取 partial validator 报告并逐条处理 warning；warning 不等于 pass，必须判断是否升级为 blocker。
- 不得把当前或上游 Markdown Delivery Plane 当作语义输入；Markdown 只可作为 renderer projection 的人读结果，不得替代 trace 审查。
- 不得读取 `trace/verification.trace.json`、当前实现、测试文件、测试命令、`openspec-results/**` apply evidence、`apply-result.md`、`proof-test-map.json`、evidence 或 apply 阶段产物来推导 task、oracle 或 proof。

## 审查顺序

1. 确认 trace schema、source-interface、legacy fields、implementation-step-register、task-gate 和 delivery-plane 结构符合 `artifacts/tasks/trace-schema.md`。
2. 从 specs trace 读取所有 in-scope added/modified scenario anchors；no-delta marker 不产生 scenario input。
3. 从 design trace 读取所有非 `non-applicable` implementation detail IDs。
4. 从 runtime acceptance trace 读取所有 required / preserve runtime facts。
5. 审查 AC 是否按工程实现阶段组织，而不是按 runtime fact、spec scenario、design detail 或 closure row 机械分组。
6. 审查 AC / checkbox 是否先构成清晰完整的生产实现计划，再客观填写 specs/design/runtime links；links 不得替代实现说明。
7. 审查每个 checkbox 是否代表真实 production implementation work，而不是 proof、verification、acceptance、evidence 或 coverage closure。
8. 审查每个 in-scope specs scenario 是否被真实 production checkbox 以 `completes` 覆盖。
9. 审查每个 runtime-affecting implementation detail 是否被真实 production checkbox 以 `completes` 覆盖。
10. 审查每个 required runtime fact 是否被真实 production checkbox 以 `completes` 覆盖，每个 preserve runtime fact 是否被 `enforces` 覆盖。
11. 审查前置 AC 是否只声明 `supports/contributes/uses/implements-part`，没有误关完整 coverage。
12. 审查 step 拓扑是否存在后置 dependency、循环依赖或 hidden runtime/design dependency。
13. 审查 delivery-plane 是否只承载 renderer payload，没有 coverage、gate、trace pointer、proof、test 或 evidence 字段泄漏。
14. 审查 validator warning；可修复项必须输出 blocker，确认为 false positive 时必须说明原因。

## 必须 Blocker 的情况

- Reviewer 输入缺少 required contract bundle、tasks trace、必要 upstream trace 或 partial validator 报告。
- Tasks trace 从 Markdown artifact、verification trace、实现、测试、apply result 或 evidence 推导 step、checkbox、link 或 proof。
- AC 按 runtime fact、spec scenario、design detail、Proof Slice、coverage matrix 或 closure gap 机械生成，而不是按真实工程施工阶段组织。
- AC / checkbox 只有 link closure，没有独立说明要实施的生产行为、边界、运行态结果、失败/边界处理或 out-of-scope guard。
- checkbox 是 proof-only、verification-only、acceptance-only、evidence-only、coverage-only 或 artifact-closure task。
- Specs scenario、implementation detail 或 runtime fact 被 link 标记为 closed，但没有对应真实 production checkbox contribution。
- 前置 AC 使用 `completes` / `enforces` 过早关闭完整 spec/runtime coverage，或隐藏依赖没有体现在 `depends-on-step-ids[]`。
- step 拓扑存在后置 dependency、循环依赖或未声明的 runtime/design dependency。
- Tasks trace 或 delivery-plane 泄漏测试矩阵、执行证据、Proof Slice、evidence/apply path、deposit 状态、schema source coverage 身份或旧字段。
- Validator warning 指出 AC/task 文本包含具体测试文件或测试 runner 命令，且 reviewer 判定该 checkbox 是 proof-only、test-only、evidence-only、coverage-only 或以测试过程替代生产实现说明。
- Delivery Plane 泄漏 coverage、gate、register rows、trace pointer、proof、test 或 evidence 字段。
- Validator warning 未处理，或 reviewer 仅以 validator pass / empty gate / link closure / rendered Markdown 作为语义通过依据。

## Pass 条件

Reviewer 只能在同时满足以下条件时输出 `Pass`：

- 已读取的 contract bundle 文件和 trace 输入完整。
- Validator warning 已处理或不存在；若 warning 涉及测试文件/runner 命令，已确认它不是 proof/test/evidence-only task。
- Tasks trace 只读取 proposal/specs/design/runtime acceptance JSON traces；未从 Markdown、verification、实现、测试或 evidence 推导 oracle。
- 每个 AC / checkbox 都是真实 production implementation work，且按工程施工顺序组织。
- 每个 in-scope specs scenario、非 `non-applicable` implementation detail、required runtime fact 和 preserve runtime fact 均由真实 checkbox contribution 关闭。
- `depends-on-step-ids[]` 拓扑顺序真实，没有循环、后置引用或 hidden dependency。
- Delivery Plane 是同一 `implementation-step-register[]` 的人读投影，没有 coverage 泄漏、proof/test/evidence 泄漏或 scope expansion。

## 输出协议

Reviewer 输出必须遵守 `openspec/schemas/_production-contracts/common/reviewer-output-protocol.md`：只能输出 `Pass` 或 `Blocker`。Blocker 必须包含 artifact path、trace anchor、contract source path + section heading、问题描述和所需修复方向。
