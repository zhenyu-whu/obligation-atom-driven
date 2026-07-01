# Obligation Specs Overlay

- Specs writer 可以读取完整 `proposal.md` 与 `trace/proposal.trace.json`，但 trace-backed `GA-####` source 只能来自 `change-atom-coverage-register` 中的 direct rows，并按这些 direct rows 的 `artifact-projection` 处理。
- 每个 `spec-requirement` direct atom 必须落到 requirement/scenario，或有 source-backed preserve/deferred/non-goal guard。
- 每个 `spec-guard` direct atom 必须作为 guard、MUST NOT、non-goal 或 Production Alignment Gate。
- 当 capability 没有 `spec-requirement` / `spec-guard` direct atom 时，不创建 `specs/<capability>/spec.md`。`design-obligation` / `verification-obligation` 不得派生成 requirement/guard。
- 当整个 proposal register 中没有任何 `spec-requirement` / `spec-guard` direct atom 时，必须创建 `specs/no-spec-delta/README.md` 和 `trace/specs/no-spec-delta/README.trace.json` 作为 no-delta specs completion。该 marker 只允许 `production-obligation-atom-driven` 使用，且不得与任何正常 `specs/<capability>/spec.md` 共存。
- no-delta trace 必须声明 `specs-completion-mode: "no-delta"`，`requirement-source-trace` 必须为空，`production-alignment-gate.blockers` 必须为空；marker Markdown 不得包含 OpenSpec delta headings、`### Requirement` 或 `#### Scenario`。
- `verification-obligation` 只能在 runtime-acceptance、verification 和 tasks 中闭环，或作为非 specs handoff notes 出现。
- 每个 requirement/scenario 的 JSON trace 必须列 exact direct `GA-####`；`requirement-source-trace`、`capability-source-map`、`production-alignment-gate`、handoff notes 以及任何 specs trace 字段中出现的 `GA-####` 都必须属于 `change-atom-coverage-register`。
- `owner-scoped-non-direct-boundary-register` 只能消费为 boundary label、summary 或 no-scope 语义；不得在 specs trace 中写入其中的 non-direct `GA-####`，也不得把其中的 original projection 当作 specs projection。
