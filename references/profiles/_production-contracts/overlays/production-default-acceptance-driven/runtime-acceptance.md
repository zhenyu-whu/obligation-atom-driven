# Default Runtime Acceptance Overlay

- `source-interface` 只能列实际 `trace/specs/**/*.trace.json` 或 no-delta marker trace、`trace/design.trace.json`；不得把 `proposal.md`、`specs/**/*.md`、`design.md` 或 `trace/proposal.trace.json` 作为 runtime semantic input。
- `trace/runtime-acceptance.trace.json` 不得出现 `GA-####`、`global-atom-id`、`SI-###` source basis 或 proposal context；default runtime acceptance 只能使用 spec scenario trace pointer 和 `IDR-###` design decision。
- `runtime-fact-register[]` 是唯一 semantic register；每行 `runtime-fact-id` 必须使用 `RS-/OP-/ST-/CH-###`，且 `fact-type` 必须与 ID 前缀一致。
- `source-basis` 不得包含 `proposal-context[]`；不得从 `change-scope-coverage[]`、`openspec/orchestrate`、global atom index 或 capability anchor packet 派生 runtime facts。
- 普通 `SI-###` 和 `artifact-handling: "proof"` item 不要求逐项生成 runtime fact；只有已进入 specs/design 的生产语义才可进入 runtime。
- `source-basis.spec-scenarios[]` 必须是实际 specs trace scenario pointer，例如 `trace/specs/<capability>.trace.json#/spec-delta-register/0/scenarios/0`。
- `source-basis.design-decisions[]` 必须是 design `implementation-design-register[]` 中的 exact `IDR-###`。
- 每个 in-scope added/modified spec scenario 和 runtime-affecting `IDR-###` design row 必须至少被一条 runtime fact 覆盖。
- Scope Basis 只能使用 spec scenario pointer 和 `IDR-###`；不得出现 `SI-###`、obligation-only GA/global atom 身份或 proposal context。
