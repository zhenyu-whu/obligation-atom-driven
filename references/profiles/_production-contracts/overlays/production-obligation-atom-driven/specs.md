# Obligation Specs Overlay

- Specs 必须使用 `trace/proposal.trace.json` 的 `change-atom-coverage-register` 和 `artifact-projection`。
- 每个 `spec-requirement` direct atom 必须落到 requirement/scenario，或有 source-backed preserve/deferred/non-goal guard。
- 每个 `spec-guard` direct atom 必须作为 guard、MUST NOT、non-goal 或 Production Alignment Gate。
- 当 capability 没有 `spec-requirement` / `spec-guard` direct atom 时，可以从稳定、规范性、可观察、后续 change 必须消费的 `design-obligation` 派生最小 requirement/guard。派生必须使用 `spec-handling: derived-capability-contract-requirement` 或 `derived-capability-contract-guard`，并保留 `source-projection: design-obligation`。
- `verification-obligation` 不得直接派生成 requirement；只能在 runtime-acceptance、verification 和 tasks 中闭环，或在已有 spec trace 中作为 proof handoff notes 出现。
- 每个 requirement/scenario 的 JSON trace 必须列 exact `GA-####`。
