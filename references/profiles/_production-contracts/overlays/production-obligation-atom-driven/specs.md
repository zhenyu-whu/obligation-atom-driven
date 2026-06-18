# Obligation Specs Overlay

- Specs 必须使用 proposal `Change Atom Coverage Register` 和 `Artifact Projection`。
- 每个 `spec-requirement` direct atom 必须落到 requirement/scenario，或有 source-backed preserve/deferred/non-goal guard。
- 每个 `spec-guard` direct atom 必须作为 guard、MUST NOT、non-goal 或 Production Alignment Gate。
- `design-obligation` 和 `verification-obligation` 不得伪造成 requirement；只在已有 delta spec 的 appendix 中做 handoff，或交给 design/verification/tasks 闭环。
- 每个 requirement/scenario 的 trace 必须列 exact `GA-####`。
