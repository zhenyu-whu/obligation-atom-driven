# Specs Reviewer Contract

本文件只适用于 `specs-reviewer` 和 integration reviewer 中针对 specs artifact 的审查。Reviewer 的任务是判断 specs trace 是否真实表达 routed source/scope fact 的 production 行为语义，并处理 validator warning；不得直接修改 artifact。

## Reviewer 输入

- 必须读取当前 artifact trace：实际 `trace/specs/*.trace.json` 或 `trace/specs/no-spec-delta/README.trace.json` marker。
- 必须读取必要 upstream dependency trace：`trace/proposal.trace.json`。
- 必须读取 specs contract bundle：common contracts、`artifacts/specs/index.md`、`artifacts/specs/trace-schema.md`、本文件和当前 schema 的 specs reviewer overlay。
- 必须读取 partial validator 报告并逐条处理 warning。
- 不得把当前或上游 Markdown Delivery Plane 当作语义输入；Markdown 只可作为 renderer projection 的人读结果，不得替代 trace 审查。
- 不得读取当前实现、测试文件、`openspec-results/**` apply evidence、`apply-result.md`、`proof-test-map.json`、evidence 或 apply 阶段产物来推导 oracle。

## 审查顺序

1. 确认 trace schema、artifact identity、normal/no-delta mode、`source-interface`、`existing-spec-state`、`spec-delta-register`、`delivery-plane` 和 `spec-gate` 结构符合 `artifacts/specs/trace-schema.md` 与 schema-specific trace-schema overlay。
2. 从 proposal trace 按 schema-specific reviewer overlay 读取 spec-relevant item set，并确认只创建必要 spec file。
3. 审查 no-delta marker 是否只在 proposal register 没有任何 spec-relevant item 时出现；若存在 spec-relevant item，必须 blocker。
4. 对每个 normal specs trace 审查 capability grouping、existing spec state 和 delta op 是否成立。
5. 对每个 requirement/scenario 审查其是否与 routed source/scope fact 语义等价；`source-ids[]` 出现只能证明数学 coverage，不能作为语义通过证明。
6. 审查 requirement/scenario 是否保留所有 source/scope-backed material semantic units，包括 operation、对象/资源/配置项、edge case、failure state、disabled/recovery 行为、data/API/auth/security rule 和 guard。
7. 审查聚合后的 requirement/scenario 是否发生语义压缩：多个 source items 或复合 source fact 可以合并表达，但不得丢失、弱化或用泛化摘要替代任一 production-meaningful unit。
8. 审查 guard item 是否保持 MUST NOT、preserve、non-goal 或负向边界语义，没有膨胀为正向行为。
9. 审查 design/proof/context-only item 是否没有伪造成 requirement/guard。
10. 审查 Delivery Plane 是否没有 coverage 泄漏，且每个 rendered scenario 都能回到 `spec-delta-register[]`；该可追溯性不得替代 source-fact 到 spec-delta 的语义等价审查。
11. 审查 validator warning；可修复项必须输出 blocker，确认为 false positive 时必须说明原因。

## 必须 Blocker 的情况

- Specs trace 未按 proposal trace 和 schema-specific specs reviewer overlay 建立 spec-relevant item set，或创建了不必要 spec file。
- Proposal 存在 spec-relevant item 但生成 no-delta marker，或 proposal 没有 spec-relevant item 却生成 normal specs delta。
- Requirement/scenario 与 routed source/scope fact 不语义等价，或只通过 `source-ids[]` closure 声称覆盖。
- Requirement/scenario 丢失、弱化、泛化或替换了 source/scope-backed material semantic units。
- Existing spec state 不足以支持 `added` / `modified` / `removed` / `renamed` 判定。
- Guard 被膨胀为正向行为，或未保持 MUST NOT、preserve、non-goal、负向边界语义。
- Design/proof/context-only item 被伪造成 requirement/guard。
- Normal spec 是空 spec、projection notes、只写“无”或没有 requirement。
- Delivery Plane 泄漏 coverage、gate、register rows、projection mix、source ids 或 trace rows。
- Validator warning 未处理，或 reviewer 仅以 validator pass / empty gate / source-id closure / rendered Markdown 作为语义通过依据。

## Pass 条件

Reviewer 只能在同时满足以下条件时输出 `Pass`：

- 已读取的 contract bundle 文件和 trace 输入完整。
- Validator warning 已处理或不存在。
- Specs completion mode 与 proposal trace 的 spec-relevant item set 一致。
- 只创建必要 spec file；没有 capability drift、orphan source、range source 或 scope 外 requirement。
- 每个 routed spec-relevant item 均被语义等价地表达为 requirement/scenario 或 guard；source-id closure 没有替代语义审查。
- Existing spec state 足以支撑每个 delta op。
- Delivery Plane 是同一 `spec-delta-register[]` 的人读投影，没有 coverage 泄漏或 scope expansion。

## 输出协议

Reviewer 输出必须遵守 `openspec/schemas/_production-contracts/common/reviewer-output-protocol.md`：只能输出 `Pass` 或 `Blocker`。Blocker 必须包含 artifact path、trace anchor、contract source path + section heading、问题描述和所需修复方向。
