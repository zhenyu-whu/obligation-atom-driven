# production-obligation-atom-driven Profile Contract

## 输入权威

- 不得执行、复制或依赖 `source-aligned-change-plan-coverage` 的 Python validator 或其它上游技能脚本。此 profile 只消费 `openspec/orchestrate/**` 中稳定的 handoff 数据契约。
- 若存在 source-aligned JSON sidecar，proposal 入口必须优先读取 `openspec/orchestrate/trace/manifest.json`、`openspec/orchestrate/phase-works/phase-5/final-packet-index.json`、`openspec/orchestrate/phase-works/phase-5/atom-plan-mapping.json` 和 `openspec/orchestrate/change-capability-anchors/obligation-atom-index.json`。`trace-contract-version` 必须为 `source-aligned-trace-v1`；`trace/manifest.json` 的 `phase-statuses.phase-5` 和 `trace/phase-5.trace.json.status` 必须一致，且当 Phase 5 status 字段存在时必须为 `accepted` 或 `adjusted`。该 status 是 Phase 5 最终 handoff 决策，不是 validator/reviewer/repair 流程态。
- 当前 final change packet `openspec/orchestrate/change-capability-anchors/<change-slug>/<change-slug>.md` 仍是 proposal-facing canonical change contract 和人审镜像。
- 它独占表达本 change 的 direct scope、capability 归属、artifact projection、contextual/preserve/non-goal guard、upstream realized baseline、downstream constraints、evidence burden 和 blockers；JSON sidecar 是机器 handoff 数据源。
- `openspec/orchestrate/change-capability-anchors/obligation-atom-index.json` 优先作为 `GA-####` lookup table，用于校验 atom 存在并补齐 source document、line range、source fact、normativity 和 focused source-window read 信息。
- `openspec/orchestrate/phase-works/phase-5/atom-plan-mapping.json` 优先提供 final owner change/capability、final relation 和 final artifact projection。
- legacy `obligation-atom-index.md` 只在 JSON sidecar 缺失且 proposal preconditions 未显式指向 JSON handoff 时作为兼容 fallback；它不得覆盖 final packet 的 direct scope、artifact projection 或 capability 归属。
- `openspec/orchestrate/change-capability-anchors/index.md` 只用于 packet discovery。
- `openspec/orchestrate/change-plan.md` 只在自动推断 change slug 或核对 roadmap/dependency 顺序时读取，不得覆盖 final packet。
- 除 canonical change packet、global atom index 和必要 capability views 外，其它 orchestrate/review/report 产物都不是 proposal 内容权威或门禁。
- `trace/proposal.trace.json` / `obligation-atom-preconditions` 可记录 `orchestrate-manifest`、`global-atom-index-json`、`atom-plan-mapping-json`、`final-packet-index-json`。这些字段出现时，对应 JSON 缺失必须视为 blocker，不得静默回退到 Markdown。
- `trace/proposal.trace.json` 中的 source/scope item 必须使用 exact `GA-####`，并从 final packet、global atom index 和 proposal trace register 派生；不得在 trace 中重新编号、使用 ranges 或从非权威 orchestrate/report 产物扩展 scope。

## Global Atom 规则

- 直接使用 global atom registry 中的 `GA-####`，不得重新编号。
- Proposal `change-atom-coverage-register` 中每个 packet direct atom 正好一行，不得使用 ranges；它是下游 artifacts 唯一可传播的 trace-backed `GA-####` source set。
- Proposal `owner-scoped-non-direct-boundary-register` 只承载 reference-only boundary context。它必须继承上游 `final-relation` 或 final packet context type，并通过 `boundary-role`、`reference-only: true`、`downstream-trace-policy: "do-not-propagate-ga"`、`boundary-handling` 或等价字段明确表达边界分类、参考用途和不得传播 GA 身份。
- Non-direct boundary rows 不产生下游 coverage、projection、reconciliation 或 implementation obligation。若保留上游 artifact projection，只能作为 `original-artifact-projection` 或 source metadata；不得作为下游 `artifact-projection` 使用。
- 下游 artifacts 可以读取完整 `proposal.md` 与 `trace/proposal.trace.json`，但其 trace-backed `GA-####` 引用只能来自 `change-atom-coverage-register`。`owner-scoped-non-direct-boundary-register` 只能以 boundary label、summary 或 no-scope 语义被消费，不得传播其中的 `GA-####`。
- Direct atom 不得使用 `contextual-only` projection；非 direct context/boundary row 才可使用 contextual handling。
- Legacy packet 缺少 artifact projection 时，必须保守推断并记录 projection source；source-aligned JSON handoff 存在时，不得执行 legacy projection inference 覆盖 `atom-plan-mapping.json` 的 final projection。
- 用户/系统行为、API/data/auth/security contract 默认进入 spec requirement；preserve boundary、explicit non-goal 和 must-not scope 默认进入 guard；architecture/runtime/package/schema/provider/deployment shape 默认进入 design；test/fixture/visual/smoke/evidence 默认进入 verification/proof；非 direct context 默认只保留 context。

## Source Window

- Proposal 必须对每个 direct `GA-####` 按 JSON handoff 或 legacy global index 的 source path 和 line range 定点重读原始 source window。
- Non-direct atom 只在需要保留边界、避免误扩 scope 或确认 proof 语义时重读。
- Downstream artifacts 只能通过 proposal `change-atom-coverage-register` 中的 exact direct `GA-####`、source document 和 line range 定点读取原始 docs。
- 不得重新做全量 source extraction。

## Reviewer Focus

- change 是否存在于 final packet index。
- packet direct atoms 是否全部在 proposal register 中出现。
- direct `GA-####` 是否都有 artifact projection、source window read 和 downstream expectation。
- 是否从非权威 orchestrate/review/report 产物扩展 scope。
