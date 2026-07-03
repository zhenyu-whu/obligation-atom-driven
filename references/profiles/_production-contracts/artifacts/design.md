# Design Artifact Contract

## 目的

`design.md` 定义 HOW to implement the production change。它必须把 proposal/specs 中的 behavior、guard、design obligation 和 implementation placement 转成最小 production-compatible design。

## 写入前

- 读取 `trace/proposal.trace.json` 和所有实际生成的 `trace/specs/*.trace.json`；若 specs artifact 是 no-delta marker，则只读取 `trace/specs/no-spec-delta/README.trace.json` 判定 specs completion，不从中派生 spec scenario。
- 使用 proposal trace 和实际 specs 完成态 trace 作为 source/scope-reading interface；不得从 `proposal.md`、`specs/**/*.md` 或旧 `design.md` 推导 design obligation。
- Proposal trace direct register 是 design 必须吸收的完整 source/scope item 集；specs trace 只提供 spec/guard item 的 requirement/scenario anchor。
- obligation profile 使用 `GA-####`、`artifact-projection` 和 `owner-capability`；default profile 使用 `SI-###`、`artifact-handling` 和 `capability`。
- 当 design 需要 exact behavior、architecture/module boundary、data/API shape、auth/security、async/worker、UI/prototype fidelity、observability、deployment 或 verification detail 时，只读取已登记 source/scope window 或 baseline。
- 起草前建立 design coverage map：每个 in-scope scenario、material design obligation、guard 和需要 implementation placement 的 source/scope item 必须映射到 design decision、guard handling 或 explicit blocker。
- 建立 trace-backed design coverage map、decision index、implementation placement map、guard handling map、spec scenario design map、proof expectation handoff、production alignment gate inputs 和 `delivery-plane` render payload。
- writer 只写 `trace/design.trace.json`；`design.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 从 trace 写入；Delivery Plane 不得另行维护 source/scope coverage 表。

## Upstream Input Model

- Design writer 必须按当前 schema profile 解析 proposal trace direct register；`instructions.template` 只提供 JSON shape 和字段示例，不提供 source/scope 语义权威。
- Downstream design 不能只消费 specs：proposal 中的 `design-obligation` / `design` item 是 design 初始约定和实现约束，即使没有 specs trace anchor，也必须进入 `design-obligation-matrix`。
- `spec-requirement` / `spec` 和 `spec-guard` / `guard` item 必须通过实际 specs `requirement-source-trace[]` anchor 进入 design；design 不得重写 requirement 或从 Markdown scenario 反推。
- `design-obligation` / `design` item 不要求 specs trace anchor，但必须锚定到至少一个 `D-###` Decision 或 `P-###` Placement；多个 design obligation 可以共享同一个 decision/placement。
- `verification-obligation` / `proof` item 只能进入 proof expectation handoff 或 production-support boundary；不得伪造成 specs requirement、production-only behavior 或 evidence-only implementation work。
- `contextual-only` / `context` item 只能作为 no-scope、preserve 或解释性边界；不得产生新增实现义务。
- 如果 design item 实际要求新增用户行为、API 行为或规范约束，而 proposal/specs trace 未表达该行为，writer 必须报告 blocker 或修订上游 artifact，不得只在 design prose 中补写。

## Trace Generation Algorithm

Writer 必须按以下顺序生成 design trace：

1. 读取 `trace/proposal.trace.json`，建立 profile-specific direct source/scope item register。
2. 读取实际 specs trace：delta specs 读取所有 `trace/specs/*.trace.json`；no-delta specs 只读取 `trace/specs/no-spec-delta/README.trace.json` 并确认不派生 scenario。
3. 建立 spec scenario anchor index；每个 anchor 必须指向 `requirement-source-trace[]` 的 exact row。
4. 为每个 proposal direct item 分类：spec/guard item 必须找到 specs anchor；design item 直接进入 design matrix；proof item 进入 proof handoff；context item 进入 boundary/no-scope handling。
5. 生成 `production-source-map[]`，逐行镜像 proposal direct register 字段，不得新增、删除或漂移 source/scope ID。
6. 生成 `spec-scenario-design-map[]`，只引用 specs trace rows，不从 specs Markdown 推导。
7. 生成 `design-decision-index[]` 和 `source-scope-map.implementation-placement-map[]`；`D-###` 和 `P-###` 可以覆盖多个 source/scope item。
8. 生成 `design-obligation-matrix[]`；每个 proposal direct item 正好一行。design-obligation/design row 必须至少包含一个已定义 `D-###` 或 `P-###` anchor。
9. 如存在 UI action、selection 或 mutating control，生成 `ui-control-contracts[]`，记录 owner component、event、handler/API、payload、response merge/reload persistence、submitting/disabled/error/retry。
10. 生成 `proof-expectation-handoff[]`，只承接 runtime-acceptance/verification 语义，不写测试文件、固定命令或 evidence path。
11. 生成 `production-alignment-gate`；所有 count 必须从 direct register、spec anchor、decision/placement 和 blocker set 机械派生。
12. 从同一 trace-backed model 投影 `delivery-plane`；Delivery Plane 不得包含 exhaustive source/scope map、alignment gate、coverage matrix 或 register rows。
13. 写入严格 JSON `trace/design.trace.json`，再调用 renderer 生成 `design.md`、Trace Appendix 和 manifest registry entry。

## Delivery Plane

- Design 必须 source/scope-backed；无法追溯到 proposal/specs traces、profile 权威输入或 focused source/baseline 的设计选择必须删除或记录为 open question。
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
- default profile 的 `production-source-map[]` 每个 direct source row 必须镜像 proposal register 的 `scope-item-id`、`source`、`source-fact`、`artifact-handling` 和 `capability`；不得写入或传播 `GA-####`。
- Gate 必须确认每个 scenario、design obligation、guard、implementation placement 和 proof expectation 都有 design handling 或 blocker。
- Exact source/scope mapping 只写 JSON trace，不写 Delivery Plane coverage column。
- artifact 末尾只保留短 `## Trace Appendix` 指针块。

## Reviewer Focus

- Design 是否新增 source/scope 外 behavior、provider、persistent concept 或 user workflow。
- 每个 spec scenario 是否有实现契约。
- 每个 data/API/auth/UI/worker/observability surface 是否有 owner、boundary、default path 和 no-scope handling。
- 是否仍有 implementer 需要从 design 外部猜测的行为。
