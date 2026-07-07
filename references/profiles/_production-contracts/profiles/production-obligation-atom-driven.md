# production-obligation-atom-driven Profile Contract

## 输入权威

- 不得执行、复制或依赖 `source-aligned-change-plan-coverage` 的 Python validator 或其它上游技能脚本。此 profile 只消费 `openspec/orchestrate/**` 中稳定的 handoff 数据契约。
- 若存在 source-aligned JSON sidecar，proposal 入口必须优先读取 `openspec/orchestrate/trace/manifest.json`、`openspec/orchestrate/phase-works/phase-5/final-packet-index.json`、`openspec/orchestrate/phase-works/phase-5/atom-plan-mapping.json` 和 `openspec/orchestrate/change-capability-anchors/obligation-atom-index.json`。所有 planned changes（包括 foundation）都来自 `final-packet-index.json` 和对应 final packet；`change-kind` 必须为 `foundation` 或 `business`。`trace-contract-version` 必须为 `source-aligned-trace-v1`；`trace/manifest.json` 的 `phase-statuses.phase-5` 和 `trace/phase-5.trace.json.status` 必须一致，且当 Phase 5 status 字段存在时必须为 `accepted` 或 `adjusted`。该 status 是 Phase 5 最终 handoff 决策，不是 validator/reviewer/repair 流程态。
- 当前 final change packet `openspec/orchestrate/change-capability-anchors/<change-slug>/<change-slug>.md` 仍是 proposal-facing canonical change contract 和人审镜像；这是 proposal 阶段读取外部权威输入的例外，不向下游 artifact 传播 Markdown 语义输入。
- `openspec/orchestrate/change-capability-anchors/obligation-atom-index.json` 优先作为 `GA-####` lookup table，用于校验 atom 存在并补齐 source document、line range、source fact、normativity 和 atom type。
- `openspec/orchestrate/phase-works/phase-5/atom-plan-mapping.json` 优先提供 final owner change/capability、final relation 和 final artifact projection。
- `final-packet-index.json`、`atom-plan-mapping.json` 和 `obligation-atom-index.json` 是 source-aligned machine handoff。Proposal trace 必须对当前 packet direct atoms 做字段级镜像：每个 direct `GA-####` 在 `change-ga-register[]` 中都必须可独立解析。不得用 source-window 聚合行、主题 summary、atom count、projection mix 或 capability 汇总替代逐 GA rows。
- legacy `obligation-atom-index.md` 只在 JSON sidecar 缺失且 `source-interface` 未显式指向 JSON handoff 时作为兼容 fallback；它不得覆盖 final packet 的 direct scope、artifact projection 或 capability 归属。
- `openspec/orchestrate/change-capability-anchors/index.md` 只用于 packet discovery。
- `openspec/orchestrate/change-plan.md` 只在自动推断 change slug 或核对 roadmap/dependency 顺序时读取，不得覆盖 final packet。
- 除 canonical change packet、global atom index 和必要 capability views 外，其它 orchestrate/review/report 产物都不是 proposal 内容权威或门禁。

## Source Interface

- `trace/proposal.trace.json` / `source-interface` 记录 proposal 使用的上游权威输入路径和 `input-mode`。
- `source-interface.input-mode` 必须为 `final-change-packet`。
- `source-interface` 可记录 `orchestrate-manifest`、`global-atom-index-json`、`atom-plan-mapping-json`、`final-packet-index-json`、`canonical-change-packet` 和 `capability-view-*`；这些字段出现时，对应文件缺失必须视为 blocker，不得静默回退到 Markdown。
- `source-interface` 中 handoff 字段值必须是字符串路径，不得是 object，不得内联 `path`、`sha256`、`trace-schema`、`phase-5-status` 或其它上游 metadata。合法形状示例：

```json
"source-interface": {
  "input-mode": "final-change-packet",
  "orchestrate-manifest": "openspec/orchestrate/trace/manifest.json",
  "global-atom-index-json": "openspec/orchestrate/change-capability-anchors/obligation-atom-index.json",
  "atom-plan-mapping-json": "openspec/orchestrate/phase-works/phase-5/atom-plan-mapping.json",
  "final-packet-index-json": "openspec/orchestrate/phase-works/phase-5/final-packet-index.json"
}
```

- 不合法形状示例：`"orchestrate-manifest": {"path": "...", "sha256": "..."}`。proposal trace 只保存 handoff path；schema、status、digest 一致性由 validator 通过这些路径读取上游 JSON 后校验。

## Global Atom 规则

- 直接使用 global atom registry 中的 `GA-####`，不得重新编号。
- Proposal `change-ga-register` 中每个 packet direct atom 正好一行，不得使用 ranges；它是下游 artifacts 唯一可传播的 trace-backed `GA-####` source set。
- `change-ga-register[]` 的每个 row 必须包含 `ga-id`、`source-document`、`lines`、`source-fact`、`normativity`、`atom-type`、`capability`、`projection`、`proposal-use` 和 `downstream-expectation`。
- `ga-id`、`source-document`、`lines`、`source-fact`、`normativity` 和 `atom-type` 必须从 `obligation-atom-index.json` 派生。
- `capability` 和 `projection` 必须从 `atom-plan-mapping.json` 的 final owner capability 与 final artifact projection 派生。
- Direct atom 不得使用 `contextual-only` projection；非 direct context/boundary row 才可使用 contextual handling。
- Legacy packet 缺少 artifact projection 时，必须保守推断并记录 projection 来源；source-aligned JSON handoff 存在时，不得执行 legacy projection inference 覆盖 `atom-plan-mapping.json` 的 final projection。
- 用户/系统行为、API/data/auth/security contract 默认进入 spec requirement；preserve boundary、explicit non-goal 和 must-not scope 默认进入 guard；architecture/runtime/package/schema/provider/deployment shape 默认进入 design；test/fixture/visual/smoke/proof 默认进入 verification/proof；非 direct context 默认只保留 context。

## Non-Direct Boundary Ref

- Proposal `non-direct-boundary-ref` 只承载 reference-only boundary context。它不是 register，不是 coverage 表，也不产生下游 implementation obligation。
- `non-direct-boundary-ref[]` 只能来自 final packet 明确允许的 owner-scoped non-direct rows、out-of-scope summary 或 dependency/boundary row。
- 每行必须包含 `ga-id`、`source-document`、`lines`、`source-fact`、`boundary-role`、`propagate: false` 和 `proposal-use`。
- `non-direct-boundary-ref[].ga-id` 不得出现在 `change-ga-register[]`。
- `propagate` 必须为 `false`；下游 artifacts 只能消费 boundary label、summary 或 no-scope 语义，不得传播其中的 `GA-####`。
- 若需要保留上游 projection 或 relation，只能作为 reviewer prose 或 validator 反查来源，不得在 `non-direct-boundary-ref` 中写成可传播 projection。

## Proposal Gate

- `proposal-gate` 只记录最小闭合问题，不复制完整 direct atom set、source 分组、projection 分组或 capability 分组。
- `proposal-gate.blockers`、`proposal-gate.orphan-ga`、`proposal-gate.source-set-mismatch` 和 `proposal-gate.non-direct-propagation-violations` 必须存在。
- 上述四个数组必须为空才能 validator pass；非空表示 proposal trace 未闭合。

## Reviewer Focus

- change 是否存在于 final packet index。
- packet direct atoms 是否全部在 `change-ga-register` 中出现。
- direct `GA-####` 是否都有 source fact、capability、projection 和 downstream expectation。
- `non-direct-boundary-ref` 是否只表达边界引用，且没有传播 non-direct GA。
- 是否从非权威 orchestrate/review/report 产物扩展 scope。
