# Design Artifact Contract

## 目的

`design.md` 定义 HOW to implement the production change。它必须把 proposal/specs 中的 behavior、guard、design obligation 和 implementation placement 转成最小 production-compatible design。

## 写入前

- 读取 proposal 和所有实际生成的 delta specs。
- 使用 proposal/specs 的 JSON trace 作为 source/scope-reading interface。
- 当 design 需要 exact behavior、architecture/module boundary、data/API shape、auth/security、async/worker、UI/prototype fidelity、observability、deployment 或 verification detail 时，只读取已登记 source/scope window 或 baseline。
- 起草前建立 design coverage map：每个 in-scope scenario、material design obligation、guard 和需要 implementation placement 的 source/scope item 必须映射到 design decision、guard handling 或 explicit blocker。
- 建立 trace-backed design coverage map、decision index、implementation placement map、guard handling map、spec scenario design map、proof expectation handoff、production alignment gate inputs 和 `delivery-plane` render payload。
- writer 只写 `trace/design.trace.json`；`design.md`、Trace Appendix 和 manifest digest 必须由 renderer 从 trace 写入；Delivery Plane 不得另行维护 source/scope coverage 表。

## Delivery Plane

- Design 必须 source/scope-backed；无法追溯到 proposal/specs、profile 权威输入或 focused source/baseline 的设计选择必须删除或记录为 open question。
- 当 source/scope 定义行为但未定义 exact implementation shape 时，选择最小 production-compatible shape，并说明拒绝的 scope-expanding alternative。
- 不得把生产行为替换成 placeholder、diagnostic、mock-only、static-only、fixture-only、registry-only 或 sandbox-only 行为，除非 proposal 明确标记为 deferred、non-goal、context 或 proof-only。
- Design 必须覆盖 architecture/runtime/module boundaries、routing/navigation、data ownership、transactions、auth/security、async processing、realtime streams、storage、provider boundaries、rendering chain、deployment 和 verification strategy。
- 每个 mutating/selection/action UI control 必须定义 owner component、runtime/client-server boundary、event trigger、handler/action/API route、request payload、response merge 或 reload persistence、submitting/disabled/error/retry behavior。
- Design sections 和 decision 字段可以由字符串或字符串数组承载；renderer 只按既有类型渲染，不得把字符串按长度或分号拆分。

## Required Sections

- Context
- Goals / Non-Goals
- Decisions
- Architecture / Module Boundary Design
- Domain / Data / Migration Design
- API / Auth / Security Design
- Async / Realtime / AI / Worker Design
- Frontend / UX Design 或 Frontend / UX / Prototype Fidelity Design
- Observability / Ops / Deployment Design
- Verification Design
- Rollout / Compatibility
- Risks / Trade-offs
- Open Questions
- JSON Trace Plane pointer

## JSON Trace Plane

- 必须写入 `trace/design.trace.json`，包含 source/scope map 和 production alignment gate。
- `production-source-map[]` 的每个 direct source row 必须镜像 proposal register 的 `global-atom-id`、`source-document`、`lines`、`atom-type`、`source-fact`、`normativity`、`artifact-projection` 和 `owner-capability`；`owner-capability` 是 canonical 字段，不能用 legacy `capability` 替代。
- Gate 必须确认每个 scenario、design obligation、guard、implementation placement 和 proof expectation 都有 design handling 或 blocker。
- Exact source/scope mapping 只写 JSON trace，不写 Delivery Plane coverage column。
- artifact 末尾只保留短 `## Trace Appendix` 指针块。

## Reviewer Focus

- Design 是否新增 source/scope 外 behavior、provider、persistent concept 或 user workflow。
- 每个 spec scenario 是否有实现契约。
- 每个 data/API/auth/UI/worker/observability surface 是否有 owner、boundary、default path 和 no-scope handling。
- 是否仍有 implementer 需要从 design 外部猜测的行为。
