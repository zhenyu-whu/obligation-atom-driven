# Obligation Proposal Writer Overlay

本文件只适用于 `production-obligation-atom-driven` 的 `proposal-writer` 和 `proposal-repair-writer`。

## 上游输入权威

- Proposal 必须优先读取 source-aligned JSON handoff（`final-packet-index.json`、`atom-plan-mapping.json`、`obligation-atom-index.json`），并读取当前 planned change 的 final packet Markdown mirror 与必要 capability view；不得执行、复制或依赖 `source-aligned-change-plan-coverage` 的 Python validator 或其它上游技能脚本。
- Foundation change 也必须来自 `final-packet-index.json` 中的 `change-kind: foundation` packet；不得另建只读 reference、额外 read-set 或第三套 schema。
- 若存在 source-aligned JSON sidecar，proposal 入口必须优先读取 `openspec/orchestrate/trace/manifest.json`、`openspec/orchestrate/phase-works/phase-5/final-packet-index.json`、`openspec/orchestrate/phase-works/phase-5/atom-plan-mapping.json` 和 `openspec/orchestrate/change-capability-anchors/obligation-atom-index.json`。
- 所有 planned changes 都来自 `final-packet-index.json` 和对应 final packet；`change-kind` 必须为 `foundation` 或 `business`。
- `trace-contract-version` 必须为 `source-aligned-trace-v1`；`trace/manifest.json` 的 `phase-statuses.phase-5` 和 `trace/phase-5.trace.json.status` 必须一致，且当 Phase 5 status 字段存在时必须为 `accepted` 或 `adjusted`。该 status 是 Phase 5 最终 handoff 决策，不是 validator/reviewer/repair 流程态。
- `final-packet-index.json` 是当前 planned change 是否存在、`change-kind`、direct atom set、packet order 和 dependency/boundary 的机器权威。`change-ga-register[].ga-id` 必须等于当前 packet direct atom set。
- `atom-plan-mapping.json` 是 direct atom final owner capability、final relation 和 final artifact projection 的机器权威。`change-ga-register[].capability` 和 `change-ga-register[].projection` 必须由它派生；该 `projection` 是上游原始/建议分类，不再是 specs/design 的直接消费权威。
- `obligation-atom-index.json` 是 `GA-####` lookup、source document、line range、source fact、normativity 和 atom type 的机器权威。`change-ga-register[]` 和 `non-direct-boundary-ref[]` 的 source fields 必须由它派生。
- Canonical final packet Markdown mirror 只作为 proposal-facing 人审镜像，用于 closed-loop outcome、in scope、out of scope、dependencies、non-direct boundary summary 和 blocker prose；它不得覆盖 JSON sidecar 的 direct atom set、projection、capability 或 `change-kind`。
- Capability view Markdown 只辅助 capability boundary 文案和 owner-scoped boundary 理解；不得新增 direct `GA-####` coverage、artifact projection、runtime obligation 或 task/proof obligation。
- Legacy `obligation-atom-index.md` 只在 JSON sidecar 缺失且 `source-interface` 未显式指向 JSON handoff 时作为兼容 fallback；它不得覆盖 final packet 的 direct scope、artifact projection 或 capability 归属。
- `openspec/orchestrate/change-capability-anchors/index.md` 只用于 packet discovery。
- `openspec/orchestrate/change-plan.md` 只在自动推断 change slug 或核对 roadmap/dependency 顺序时读取，不得覆盖 final packet。
- 除 canonical change packet、global atom index 和必要 capability views 外，其它 orchestrate/review/report 产物都不是 proposal 内容权威或门禁。

## JSON Handoff Schema

- Proposal writer 必须按本节 JSONPath 读取 source-aligned JSON handoff；不得猜测替代顶层 key、不得把缺失 key 解释为空集合、不得静默回退到 Markdown mirror。
- `final-packet-index.json` 的 planned change 列表位于 `$.packets[]`，不得读取 `$.changes[]`、`$.changePackets[]` 或其它推测路径。
- 当前 change packet 必须由 `$.packets[?(@.change == "<change-slug>")]` 唯一选出；匹配数量不是 `1` 时必须写入 blocker。
- 当前 packet 必须包含并使用这些字段：`change`、`change-kind`、`direct-atom-ids`、`owner-scoped-non-direct-atom-ids`、`packet-path`、`capability-view-paths`。缺少任一字段必须 blocker。
- `change-kind` 只能为 `foundation` 或 `business`；`direct-atom-ids[]` 与 `owner-scoped-non-direct-atom-ids[]` 必须是 exact `GA-####` 字符串数组，不得使用 range、count、summary 或 capability 聚合替代。
- `atom-plan-mapping.json` 的 mapping 列表位于 `$.rows[]`，每个 direct GA 必须按 `global-atom-id` 查找唯一 row，且该 row 的 `final-owner-change` 必须等于当前 change、`final-relation` 必须为 `direct`。
- `change-ga-register[].capability` 必须来自 `atom-plan-mapping.json $.rows[].final-owner-capability`；`change-ga-register[].projection` 必须来自 `$.rows[].final-artifact-projection`。
- `obligation-atom-index.json` 的 atom lookup 列表位于 `$["global-atoms"][]`，每个 direct GA 和允许的 non-direct boundary GA 都必须按 `global-atom-id` 查找唯一 row。
- `change-ga-register[]` 与 `non-direct-boundary-ref[]` 的 `source-document`、`lines`、`source-fact`、`normativity` 和 `atom-type` 必须来自 `obligation-atom-index.json $["global-atoms"][]` 的同名字段。
- `trace/manifest.json` 必须读取 `$.trace-contract-version` 与 `$.phase-statuses["phase-5"]`；`trace/phase-5.trace.json` 必须读取 `$.status`，并按上游输入权威规则校验一致性。
- 若上述 JSONPath 指向的顶层集合、字段或唯一性校验失败，proposal writer 必须报告 `Proposal Input Contract Blocker`，不得继续生成 `trace/proposal.trace.json`。

## Routing 生成规则

- Proposal writer 必须把 `projection` 当作上游建议分类逐 GA 复核，不得按 `spec-requirement -> specs`、`spec-guard -> specs`、`design-obligation -> design`、`verification-obligation -> verification/proof` 做机械映射。
- Route 审定必须以 `source-fact` 的语义为准：用户可观察能力边界、产品编辑语义、API/data/auth/security contract 或拒绝未知值的能力边界进入 specs；implementation shape、JSON/schema/model/provider/runtime/deployment/UI control/validation branching 进入 design；同一 fact 同时具备两面时使用 specs + design 双归属。
- `routing-rationale` 必须引用本 GA 的具体 source-fact 语义；不得写“按 final projection 进入 …”或等价模板句。若 writer 无法判断 route，应写入 `proposal-gate.routing-invalid` 并阻断，而不是退回 projection 映射。
- `verification-obligation` 默认应为 `reference-only` 或 `not-projected`；只有 source fact 中确有生产行为或实现约束时，才可把对应语义路由到 specs/design，且 `routing-rationale` 必须说明没有传播纯验证义务。
- 如果用户请求扩展到 planned change boundary 之外，必须报告超出 canonical change contract，不得在 proposal 中扩 scope。
