# production-obligation-atom-driven Profile Contract

## 输入权威

- 当前 final change packet `openspec/orchestrate/change-capability-anchors/<change-slug>/<change-slug>.md` 是唯一 canonical change contract。
- 它独占定义本 change 的 direct scope、capability 归属、artifact projection、contextual/preserve/non-goal guard、upstream realized baseline、downstream constraints、evidence burden 和 blockers。
- `openspec/orchestrate/change-capability-anchors/obligation-atom-index.md` 只作为 `GA-####` lookup table，用于校验 atom 存在并补齐 source document、line range、projection、source fact 和 focused source-window read 信息。
- `obligation-atom-index.md` 不得覆盖 final packet 的 direct scope、artifact projection 或 capability 归属。
- `openspec/orchestrate/change-capability-anchors/index.md` 只用于 packet discovery。
- `openspec/orchestrate/change-plan.md` 只在自动推断 change slug 或核对 roadmap/dependency 顺序时读取，不得覆盖 final packet。
- 除 canonical change packet、global atom index 和必要 capability views 外，其它 orchestrate/review/report 产物都不是 proposal 内容权威或门禁。

## Global Atom 规则

- 直接使用 global atom registry 中的 `GA-####`，不得重新编号。
- Proposal register 中每个 packet direct atom 正好一行，不得使用 ranges。
- Direct atom 不得使用 `contextual-only` projection；非 direct context/boundary row 才可使用 contextual handling。
- Legacy packet 缺少 artifact projection 时，必须保守推断并记录 projection source。
- 用户/系统行为、API/data/auth/security contract 默认进入 spec requirement；preserve boundary、explicit non-goal 和 must-not scope 默认进入 guard；architecture/runtime/package/schema/provider/deployment shape 默认进入 design；test/fixture/visual/smoke/evidence 默认进入 verification/proof；非 direct context 默认只保留 context。

## Source Window

- Proposal 必须对每个 direct `GA-####` 按 global index 的 source path 和 line range 定点重读原始 source window。
- Non-direct atom 只在需要保留边界、避免误扩 scope 或确认 proof 语义时重读。
- Downstream artifacts 只能通过 proposal register 中的 exact `GA-####`、source document 和 line range 定点读取原始 docs。
- 不得重新做全量 source extraction。

## Reviewer Focus

- change 是否存在于 final packet index。
- packet direct atoms 是否全部在 proposal register 中出现。
- direct `GA-####` 是否都有 artifact projection、source window read 和 downstream expectation。
- 是否从非权威 orchestrate/review/report 产物扩展 scope。
