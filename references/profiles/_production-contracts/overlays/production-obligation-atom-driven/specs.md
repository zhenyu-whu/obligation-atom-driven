# Obligation Specs Overlay

- Specs writer 只能读取 `trace/proposal.trace.json` 作为 proposal 语义输入；trace-backed `GA-####` source 只能来自 `change-atom-coverage-register` 中的 direct rows，并按这些 direct rows 的 `artifact-projection` 处理。
- `trace/specs/**.trace.json` 中出现的所有 `GA-####` 都必须属于 `change-atom-coverage-register` direct set；不得传播 `owner-scoped-non-direct-boundary-register` 的 `GA-####`。

## 上游输入权威

- `change-atom-coverage-register` 是 specs writer 的唯一 GA coverage 权威。每个 normal specs trace row 必须可回溯到其中一条 direct row。
- `owner-capability` 是 capability 分组 canonical 字段；`capability` 不能替代它。
- `artifact-projection` 是 specs eligibility 权威。只有 `spec-requirement` 和 `spec-guard` direct rows 能进入 `requirement-source-trace[]`。
- `source-document`、`lines`、`source-fact`、`normativity`、`atom-type` 和 `downstream-coverage-expectation` 必须从 proposal register row 继承；writer 不得在 specs trace 中重写为不同 source fact。
- `owner-scoped-non-direct-boundary-register` 只能消费为 boundary label、summary 或 no-scope 语义；不得在 specs trace 中写入其中的 non-direct `GA-####`，也不得把其中的 original projection 当作 specs projection。

## Trace 生成规则

- 每个 `spec-requirement` direct atom 必须落到 requirement/scenario，或有 source-backed blocker；不得用 preserve/deferred/non-goal 文案逃避正向 requirement coverage。
- 每个 `spec-guard` direct atom 必须作为 guard、MUST NOT、non-goal 或 Production Alignment Gate，并在 trace row 中写 `spec-handling: "direct-spec-guard"` 与 `guard-handling`。
- `requirement-source-trace[]` 的每个 row 只能包含一个 exact `global-atom-id`；不得使用 ranges、`atom-ids[]`、逗号分隔多个 GA 或 capability 汇总行。
- `requirement-source-trace[]` 的每个 row 必须包含：`global-atom-id`、`owner-capability`、`source-document`、`lines`、`source-fact`、`source-projection`、`spec-handling`、`requirement`、`scenario`。guard row 还必须包含 `guard-handling`。
- `source-projection` 必须等于 proposal row 的 `artifact-projection`，且只能是 `spec-requirement` 或 `spec-guard`。
- `spec-requirement` row 的 `spec-handling` 必须为 `direct-spec-requirement`；`spec-guard` row 的 `spec-handling` 必须为 `direct-spec-guard`。
- 当 capability 没有 `spec-requirement` / `spec-guard` direct atom 时，不创建 `specs/<capability>/spec.md`。`design-obligation` / `verification-obligation` 不得派生成 requirement/guard。
- 当整个 proposal register 中没有任何 `spec-requirement` / `spec-guard` direct atom 时，必须创建 `trace/specs/no-spec-delta/README.trace.json` 作为 canonical no-delta specs completion，并由 renderer 生成 `specs/no-spec-delta/README.md` marker；不得与任何正常 `specs/<capability>/spec.md` 共存。
- no-delta trace 必须声明 `specs-completion-mode: "no-delta"`，`requirement-source-trace` 必须为空，`production-alignment-gate.blockers` 必须为空；marker Markdown 不得包含 OpenSpec delta headings、`### Requirement` 或 `#### Scenario`。
- `verification-obligation` 只能在 runtime-acceptance、verification 和 tasks 中闭环，或作为非 specs handoff notes 出现。
