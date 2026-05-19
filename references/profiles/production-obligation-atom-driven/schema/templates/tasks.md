## Acceptance-Driven Coverage

<!--
本节是 generation-quality gate，不是 executable work。不要在这里放 checkbox tasks。
每个 obligation atom、requirement scenario 或 material design obligation 使用一行；不要用 aggregate rows 替代底层 atoms、scenarios 或 obligations 的覆盖。
所有 Implementation Task IDs / Verification Task IDs 必须解析到下方实际 checkbox task；不要只引用 AC heading。
-->

### Obligation Atom Coverage

| Global Atom ID | Atom Summary | Acceptance Slice IDs | Implementation Task IDs | Verification Task IDs | Acceptance Proof |
| --- | --- | --- | --- | --- | --- |
| <!-- GA-0001；每行只能有一个 ID，不使用 GA-0001-GA-0010 这类 ranges，也不把多个 GA 放一格。 --> | <!-- 概述 source-backed obligation / preserve / forbidden-drift boundary。 --> | <!-- AC-001 --> | <!-- AC-001.1, AC-001.2；必须是实际 checkbox ID --> | <!-- AC-001.3；必须是实际 checkbox ID --> | <!-- user interaction、API test、data assertion、worker/realtime path、security check、rendered layout check 等。 --> |

### Requirement / Scenario Coverage

| Capability | Requirement | Scenario | Global Atom IDs | Acceptance Slice IDs | Implementation Task IDs | Verification Task IDs | Acceptance Proof |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- capability name --> | <!-- exact requirement name --> | <!-- exact scenario name --> | <!-- GA-0001, GA-0002；逐个枚举 exact IDs，不使用 ranges --> | <!-- AC-001 --> | <!-- AC-001.1 --> | <!-- AC-001.3 --> | <!-- scenario-level observable proof。 --> |

### Design Obligation Coverage

| Design Section | Design Obligation | Global Atom IDs | Acceptance Slice IDs | Implementation Task IDs | Verification Task IDs | Acceptance Proof |
| --- | --- | --- | --- | --- | --- | --- |
| <!-- exact design section / decision / gate item --> | <!-- material implementation、preservation 或 verification obligation。 --> | <!-- GA-0001, GA-0002, 或 Not applicable；逐个枚举 exact IDs，不使用 ranges --> | <!-- AC-001 --> | <!-- AC-001.1 --> | <!-- AC-001.3 --> | <!-- design-obligation proof。 --> |

<!-- 每个 checkbox task block（checkbox + Source Atoms/Spec/Design/Acceptance/Source/Preserve/Proof/Mock Policy trace fields）与下一个 checkbox task block 之间必须保留一个空行；不要在同一 task block 的 trace fields 之间插入空行。 -->

## AC-001 <!-- 中文验收切片名称 -->

Acceptance:
- <!-- 用户/系统可观察的验收行为。必须能从 proposal/spec/design/obligation atoms 推导，不从实现计划反推。 -->

Source Atoms:
- <!-- GA-0001, GA-0002；逐个枚举 exact IDs，不使用 ranges。 -->

Spec:
- <!-- Capability / Requirement / Scenario names。 -->

Design:
- <!-- Design sections / decisions / obligations。 -->

Primary Proof:
- <!-- 最强验收证据。用户可见行为优先 browser/E2E/rendered proof；后端行为优先 API/DB/job/storage/security facts。 -->

Required Evidence:
- Commands: <!-- exact commands or Not applicable with reason -->
- Browser / rendered evidence: <!-- screenshot / DOM / responsive / a11y / interaction evidence -->
- Data / API / job / storage evidence: <!-- DB rows / API response / queue status / asset facts / logs / audit facts -->
- Evidence ledger expectation: <!-- apply 时必须记录的证据条目：命令、截图/DOM、API/DB/job/storage/log/audit facts、default-path proof。 -->

Mock Policy:
- <!-- 哪些允许 sandbox/mock；哪些必须走 default production wiring。 -->

- [ ] AC-001.1 <!-- 用中文描述此 acceptance slice 下的具体实现或验证任务。 -->
  Source Atoms: <!-- exact GA IDs，逐个枚举，不使用 ranges。 -->
  Spec: <!-- Requirement / scenario names。 -->
  Design: <!-- Design section / decision / obligation。 -->
  Acceptance: <!-- 此任务贡献哪个可验收行为。 -->
  Source: <!-- 来自相关 GA register rows 的 source paths、line ranges 与 source rule。 -->
  Preserve: <!-- 必须保留的 module/data/API/auth/worker/UI/responsive/privacy/ops constraints。 -->
  Proof: <!-- 说明要执行的 source-equivalent proof。 -->
  Mock Policy: <!-- 说明 mock/sandbox/default path 规则。 -->

<!-- 每个 AC section 必须至少包含一个 final verification / acceptance checkbox，例如 AC-001.N。该 checkbox 必须出现在本节 Required Evidence、coverage tables 的 Verification Task IDs 和最终 apply evidence ledger 中。 -->
