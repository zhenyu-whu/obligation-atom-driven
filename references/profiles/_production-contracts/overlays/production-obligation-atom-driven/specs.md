# Obligation Specs Overlay

- Specs writer 可以读取完整 `proposal.md` 与 `trace/proposal.trace.json`，但 trace-backed `GA-####` source 只能来自 `change-atom-coverage-register` 中的 direct rows，并按这些 direct rows 的 `artifact-projection` 处理。
- 每个 `spec-requirement` direct atom 必须落到 requirement/scenario，或有 source-backed preserve/deferred/non-goal guard。
- 每个 `spec-guard` direct atom 必须作为 guard、MUST NOT、non-goal 或 Production Alignment Gate。
- 当 capability 没有 `spec-requirement` / `spec-guard` direct atom 时，可以从稳定、规范性、可观察、后续 change 必须消费的 `design-obligation` 派生最小 requirement/guard。派生必须使用 `spec-handling: derived-capability-contract-requirement` 或 `derived-capability-contract-guard`，并保留 `source-projection: design-obligation`。
- `verification-obligation` 不得直接派生成 requirement；只能在 runtime-acceptance、verification 和 tasks 中闭环，或在已有 spec trace 中作为 proof handoff notes 出现。
- 每个 requirement/scenario 的 JSON trace 必须列 exact direct `GA-####`；`requirement-source-trace`、`capability-source-map`、`production-alignment-gate`、handoff notes 以及任何 specs trace 字段中出现的 `GA-####` 都必须属于 `change-atom-coverage-register`。
- `owner-scoped-non-direct-boundary-register` 只能消费为 boundary label、summary 或 no-scope 语义；不得在 specs trace 中写入其中的 non-direct `GA-####`，也不得把其中的 original projection 当作 specs projection。
