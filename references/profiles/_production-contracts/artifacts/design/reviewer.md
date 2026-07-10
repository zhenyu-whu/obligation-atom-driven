# Design Reviewer Contract

本文件只适用于 `design-reviewer` 和 integration reviewer 中针对 design artifact 的审查。Reviewer 的任务是判断 design trace 是否真实达成 specs/design-input 的实现语义，并处理 validator warning；不得直接修改 artifact。

## Reviewer 输入

- 必须读取当前 artifact trace：`trace/design.trace.json`。
- 必须读取必要 upstream dependency traces：`trace/proposal.trace.json` 和实际 `trace/specs/*.trace.json` 或 no-delta marker。
- 必须读取 design contract bundle：common contracts、`artifacts/design/index.md`、`artifacts/design/trace-schema.md`、本文件和存在的 schema overlay。
- 必须读取 partial validator 报告并逐条处理 warning。
- 不得把当前或上游 Markdown Delivery Plane 当作语义输入；Markdown 只可作为 renderer projection 的人读结果，不得替代 trace 审查。
- 不得读取当前实现、测试文件、`openspec-results/**` apply evidence、`apply-result.md`、`proof-test-map.json`、evidence 或 apply 阶段产物来推导 oracle。

## 审查顺序

1. 确认 trace schema、source-interface、legacy fields、delivery-plane 和 design-gate 结构符合 `artifacts/design/trace-schema.md`。
2. 从 specs trace 读取所有 in-scope scenario anchors；no-delta marker 不产生 scenario input。
3. 从 proposal trace 读取所有 routed-to-design inputs。
4. 对每个 IDR 审查其是否是内聚实现决策主题，而不是 source/scenario/page/API/detail coverage row。
5. 对每个 IDR 审查 decision、boundary、contract、failure handling、verification handoff 和 no-scope-expansion 是否足以指导 implementer。
6. 对每个 implementation detail 审查 detail type 是否适用、subject 是否真实、content 是否足以实施、basis 是否客观。
7. 反查每个 specs scenario 的 implementation needs 是否被至少一个 IDR 真实设计覆盖。
8. 反查每个 design input 是否被至少一个 IDR 真实吸收，而不是只出现在 `design-inputs[]` link 中。
9. 审查 delivery-plane 是否只承载 renderer payload，没有 coverage、gate、trace pointer 或 source/scope matrix 泄漏。
10. 审查 validator warning；可修复项必须输出 blocker，确认为 false positive 时必须说明原因。

## 必须 Blocker 的情况

- Specs scenario 的实现需求没有被任何 IDR 真实覆盖，或只通过 link closure 被标记为覆盖。
- Routed-to-design input 被机械引用但没有影响 decision、boundary、contract、detail 或 no-scope-expansion。
- IDR 按 atom、scenario、页面、接口、字段、错误码或测试断言机械拆分，而不是内聚实现决策主题。
- IDR 是纯 layer coverage row、source coverage row 或 proof/verification closure row。
- Implementation detail 是为了 layer coverage、render order、gate closure 或模板完整性发明的 phantom detail。
- `data-model` 描述 Prisma datasource/generator、generated client、migration engine metadata、framework-owned internal table 或 `_prisma_migrations` 字段，而非应用拥有的数据模型。
- 当前 change 没有应用拥有的数据模型，但 trace 仍生成 `data-model` detail。
- `non-applicable` 被用来填补空 section、绕过真实设计缺失，或只写“无”而没有说明已检查边界和拒绝的 scope-expanding 行为。
- Detail content 包含 trace metadata、GA/SI ID、coverage rationale、placeholder，或不足以让 implementer 实施。
- 同一 `detail-type + owner + subject` 被拆到多个 IDR，导致割裂设计。
- Delivery Plane 泄漏 coverage、gate、register rows、trace pointer 或 source/scope closure。
- Validator warning 未处理，或 reviewer 仅以 validator pass / empty gate / coverage closure 作为语义通过依据。

## Pass 条件

Reviewer 只能在同时满足以下条件时输出 `Pass`：

- 已读取的 contract bundle 文件和 trace 输入完整。
- Validator warning 已处理或不存在。
- 每个 specs scenario 的 implementation needs 均有真实设计覆盖；no-delta specs 时该检查为空。
- 每个 routed-to-design input 均被真实吸收。
- 每个 IDR 都是内聚实现决策主题，且 implementation details 真实、适用、足以实施。
- 未发现 source/scope drift、phantom detail、scope expansion、delivery projection drift 或 artifact-local contract violation。

## 输出协议

Reviewer 输出必须遵守 `openspec/schemas/_production-contracts/common/reviewer-output-protocol.md`：只能输出 `Pass` 或 `Blocker`。Blocker 必须包含 artifact path、trace anchor、contract source path + section heading、问题描述和所需修复方向。
