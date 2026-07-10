# Verification Reviewer Contract

本文件只适用于 `verification-reviewer` 和 integration reviewer 中针对 verification artifact 的审查。Reviewer 的任务是判断 verification trace 是否真实达成 runtime acceptance 输入的 Proof Slice 语义，并处理 validator warning；不得直接修改 artifact。

## Reviewer 输入

- 必须读取当前 artifact trace：`trace/verification.trace.json`。
- 必须读取必要 upstream dependency trace：`trace/runtime-acceptance.trace.json`。
- 可读取 `source-interface.spec-traces[]` 和 `source-interface.design-trace` 指向的 trace 路径，只用于确认 source-interface 元数据与实际 dependency traces 一致；不得从 specs/design 重新发明 oracle。
- 必须读取 verification contract bundle：common contracts、`artifacts/verification/index.md`、`artifacts/verification/trace-schema.md` 和本文件。
- 必须读取 partial validator 报告并逐条处理 warning。
- 不得把当前或上游 Markdown Delivery Plane 当作语义输入；Markdown 只可作为 renderer projection 的人读结果，不得替代 trace 审查。
- 不得读取 proposal trace、当前实现、测试文件、`openspec-results/**` apply evidence、`apply-result.md`、`proof-test-map.json`、evidence 或 apply 阶段产物来推导 oracle。

## 审查顺序

1. 确认 trace schema、source-interface、legacy fields、verification-slice-register、verification-gate 和 delivery-plane 结构符合 `artifacts/verification/trace-schema.md`。
2. 从 runtime trace 读取所有 `scope-role` 为 `required behavior` 或 `preserve boundary` 的 runtime facts。
3. 审查每个 Proof Slice 是否只从 runtime fact 派生 oracle，而不是从 specs/design/proposal、Markdown、实现、测试或 evidence 派生。
4. 审查每个 Proof Slice 是否原子，且没有合并独立 operation、state、failure/retry、auth/security、layout、observability、fixture variant、viewport 或 redaction branch。
5. 审查每个 slice 的 `runtime-fact-ids[]` 和 `primary-runtime-fact-id` 是否引用已定义 runtime facts，且合并引用的 facts 共享同一个原子 branch 和 oracle。
6. 审查 `proof-evidence-mode` 是否正确决定持久测试或非持久 proof。
7. 审查 durable slice 的 `planned-test-directory` 是否是合法目录级 glob，并匹配 `test-layer`。
8. 审查 non-durable slice 是否使用 `N/A` 和明确 source/scope-backed `non-persistent-reason`。
9. 反查每个 required / preserve runtime fact 是否被至少一个 Proof Slice 真实覆盖，而不是只出现在 gate 或 link closure 中。
10. 审查 delivery-plane 是否只承载 renderer payload，没有 Proof Slice register、coverage、gate、trace pointer、测试计划或 evidence 字段泄漏。
11. 审查 validator warning；可修复项必须输出 blocker，确认为 false positive 时必须说明原因。

## 必须 Blocker 的情况

- Reviewer 输入缺少 required contract bundle、verification trace、runtime trace 或 partial validator 报告。
- Verification trace 从 proposal/specs/design trace、Markdown artifact、实现、测试、apply result 或 evidence 推导 oracle。
- Required / preserve runtime fact 没有被任何 Proof Slice 真实覆盖，或只通过 gate/link closure 被标记为覆盖。
- Proof Slice 粒度过粗，吞并独立 operation、state、failure/retry、auth/security、layout、observability、fixture variant、viewport 或 redaction branch。
- `runtime-fact-ids[]` 引用不存在的 runtime fact、非 runtime source、task、proof、test 或 evidence。
- `proof-evidence-mode` 与实际 proof 形态不匹配，或 durable/non-durable placement 与 `test-layer`、`planned-test-directory`、`non-persistent-reason` 不一致。
- 存在具体测试文件、固定命令、runner selector、`openspec-results/**`、`test-results/**`、evidence path、执行状态或 regression deposit 字段。
- 存在旧字段、多套 coverage truth、source/scope 外 oracle、测试执行计划或 evidence 字段泄漏。
- Delivery Plane 泄漏 Proof Slice register、coverage、gate、trace pointer、测试计划或 evidence 字段。
- Validator warning 未处理，或 reviewer 仅以 validator pass / empty gate / runtime fact link closure / rendered Markdown 作为语义通过依据。

## Pass 条件

Reviewer 只能在同时满足以下条件时输出 `Pass`：

- 已读取的 contract bundle 文件和 trace 输入完整。
- Validator warning 已处理或不存在。
- Verification trace 只从 runtime acceptance canonical facts 派生 oracle；未从 proposal/specs/design、Markdown、实现、测试或 evidence 推导 oracle。
- 每个 required / preserve runtime fact 均有真实 Proof Slice 覆盖。
- 每个 Proof Slice 都原子、runtime refs 真实、proof mode 合理、placement 合法，且不包含测试执行计划、evidence 或 source/scope 外行为。
- Delivery Plane 是同一 `verification-slice-register[]` 的人读投影，没有 coverage 泄漏或 scope expansion。

## 输出协议

Reviewer 输出必须遵守 `openspec/schemas/_production-contracts/common/reviewer-output-protocol.md`：只能输出 `Pass` 或 `Blocker`。Blocker 必须包含 artifact path、trace anchor、contract source path + section heading、问题描述和所需修复方向。
