## Acceptance-Driven Coverage

<!--
本节是 source/spec/design 到 AC/task 的覆盖索引，不是 executable work。
每个 obligation atom、requirement scenario 或 material design obligation 使用一行；不要用 aggregate rows 替代底层 atoms、scenarios 或 obligations 的覆盖。
所有 Implementation Task IDs / Verification Task IDs 必须解析到下方实际 checkbox task；不要只引用 AC heading。
本节只回答“哪些 source-backed obligation 由哪些 AC/task/proof 覆盖”，不承载 runtime row 详情、测试命令、证据目录或 fixture 明细。
-->

### Obligation Atom Coverage

| Global Atom ID | Artifact Projection | Atom Summary | Acceptance Slice IDs | Implementation Task IDs | Verification Task IDs | Acceptance Proof |
| --- | --- | --- | --- | --- | --- | --- |
| <!-- GA-0001；每行只能有一个 ID，不使用 GA-0001-GA-0010 这类 ranges，也不把多个 GA 放一格。 --> | <!-- spec-requirement / spec-guard / design-obligation / verification-obligation / contextual-only --> | <!-- 概述 source-backed obligation / preserve / forbidden-drift boundary。 --> | <!-- AC-001 --> | <!-- AC-001.1, AC-001.2；必须是实际 checkbox ID。 --> | <!-- AC-001.3；必须是实际 checkbox ID。 --> | <!-- user interaction、API test、data assertion、worker/realtime path、security check、rendered layout check 等 proof summary。 --> |

### Requirement / Scenario Coverage

| Capability | Requirement | Scenario | Global Atom IDs | Artifact Projection Handling | Acceptance Slice IDs | Implementation Task IDs | Verification Task IDs | Acceptance Proof |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- capability name --> | <!-- exact requirement name --> | <!-- exact scenario name --> | <!-- GA-0001, GA-0002；逐个枚举 exact IDs，不使用 ranges。 --> | <!-- spec-requirement scenario；或说明 spec-guard/design/verification atom 不伪造 scenario。 --> | <!-- AC-001 --> | <!-- AC-001.1 --> | <!-- AC-001.3 --> | <!-- scenario-level observable proof summary。 --> |

### Design Obligation Coverage

| Design Section | Design Obligation | Global Atom IDs | Artifact Projection Handling | Acceptance Slice IDs | Implementation Task IDs | Verification Task IDs | Acceptance Proof |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- exact design section / decision / gate item --> | <!-- material implementation、preservation 或 verification obligation。 --> | <!-- GA-0001, GA-0002, 或 Not applicable；逐个枚举 exact IDs，不使用 ranges。 --> | <!-- design-obligation / verification-obligation / spec-guard handling。 --> | <!-- AC-001 --> | <!-- AC-001.1 --> | <!-- AC-001.3 --> | <!-- design-obligation proof summary。 --> |

## Runtime Acceptance Index

<!--
本节是主 agent preflight 的轻量路由表，不是 executable work，也不是 runtime/test 详情来源。
它只把 AC 路由到 Appendix 中的 row IDs 和 Test IDs；不要在这里重复 fixed commands、证据目录、ledger、fixture 或 row 详情。
如果 change 不触及 web/runtime behavior，写明 Not applicable 和 source-backed 理由。
-->

### AC Runtime Ownership Index

| AC ID | Source Basis | Runtime Surface Rows | Operation Rows | State / Branch Rows | Async / Realtime Rows | Test IDs | Scope Role | No-Scope-Expansion Check | Detail Matrix Rows |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- AC-001 --> | <!-- GA-0001, spec scenario, design obligation。 --> | <!-- RS-001 --> | <!-- OP-001 --> | <!-- ST-001, ST-002 --> | <!-- CH-001 或 Not applicable。 --> | <!-- T-001, T-002 --> | <!-- required behavior / preserve boundary / proof-only / not applicable。 --> | <!-- 不引入 source 外 route/control/state/API/job/event/provider/storage/retry 等。 --> | <!-- RS-001, OP-001, ST-001, CH-001, T-001。 --> |

<!-- 每个 AC section 是人工审阅和 worker 执行的主要入口；Appendix 是 runtime/test 明细唯一来源。 -->
<!-- 每个 checkbox task block（checkbox + Trace/Runtime Rows/Test IDs/Acceptance/Proof/Overrides）与下一个 checkbox task block 之间必须保留一个空行；不要在同一 task block 的 trace fields 之间插入空行。 -->

## AC-001 <!-- 中文验收切片名称 -->

Acceptance:
- <!-- 用户/系统可观察的验收行为。必须能从 proposal/spec/design/obligation atoms 推导，不从实现计划反推。 -->

Source Atoms:
- <!-- GA-0001, GA-0002；逐个枚举 exact IDs，不使用 ranges。 -->

Projection:
- <!-- linked GA IDs 的 artifact projection；例如 GA-0001: spec-requirement。 -->

Spec:
- <!-- Capability / Requirement / Scenario names。 -->

Design:
- <!-- Design sections / decisions / obligations。 -->

Runtime Rows Owned:
- <!-- RS-001, OP-001, ST-001, CH-001；只列 row IDs，row 详情只在 Verification Appendix 中定义。 -->

Test IDs:
- <!-- T-001, T-002；只列本 AC 拥有的 Test IDs，固定命令、证据目录、ledger 和 fixture 明细只在 Test Evidence Matrix 中定义。 -->

No-Scope Boundary:
- <!-- 明确本 AC 不得引入的 source 外 route/control/state/API/job/event/provider/storage/retry/lifecycle 行为。 -->

Primary Proof:
- <!-- 人类可读的最高强度验收证明摘要。用户可见行为优先 browser/E2E/rendered proof；后端行为优先 API/DB/job/storage/security facts。具体 row 详情和 test 命令通过 Runtime Rows Owned / Test IDs 跳转到 Appendix。 -->

Required Evidence:
- Test evidence: <!-- T-001, T-002；fixed commands、evidence directories、ledger files 只在 Test Evidence Matrix 中维护。 -->
- Browser / rendered evidence: <!-- screenshot / DOM / responsive / a11y / interaction evidence 的类型和验收意图；具体 artifact path 由对应 Test ID 的 ledger 记录。 -->
- Data / API / job / storage evidence: <!-- DB rows / API response / queue status / asset facts / logs / audit facts 的类型和验收意图。 -->
- Evidence ledger: <!-- 由 Test Evidence Matrix 的 Ledger File 产出；本处只说明 ledger 必须覆盖哪些事实类别。 -->

Mock / Fixture Boundary:
- <!-- AC-level default path / mock 原则摘要；逐 Test ID 的 fixture boundary 只在 Test Evidence Matrix 中定义。 -->

Mock Policy:
- <!-- 哪些允许 sandbox/mock；哪些必须走 default production wiring。 -->

- [ ] AC-001.1 <!-- 用中文描述此 acceptance slice 下的具体实现或验证任务。 -->
  Trace: <!-- 默认写 inherits AC-001；只有当本 task 的 source atoms/spec/design/projection/no-scope/mock 边界比 AC 更窄或有例外时才展开 override；不要重复 AC-level 字段。 -->
  Runtime Rows: <!-- 本 task 负责或最终验证覆盖的 RS-/OP-/ST-/CH- row IDs；无 runtime 行为时写 Not applicable 并给出 source-backed 理由。 -->
  Test IDs: <!-- 本 task 建立、维护或由 final verification 执行的 T- row IDs；不得重复 fixed command/path/ledger。 -->
  Acceptance: <!-- 此任务贡献证明的具体可验收行为。 -->
  Proof: <!-- source-equivalent proof 摘要。用户可见操作必须证明 runtime interaction、API/data effect 和 reload/readback；static markup / data-testid / screenshot 只能补充。 -->
  Overrides: <!-- 若不继承 AC-level source/no-scope/mock boundary，在此列 exact override；否则写 None。 -->

<!-- 每个 AC section 必须至少包含一个 final verification / acceptance checkbox，例如 AC-001.N。该 checkbox 必须出现在本节 Required Evidence、coverage tables 的 Verification Task IDs 和最终 apply evidence ledger 中。 -->

## Verification Appendix

<!--
本节是 runtime/test 明细的唯一事实来源，不属于 executable work section。
Runtime detail rows 只在对应矩阵定义；AC section、Runtime Acceptance Index 和 checkbox tasks 只引用 row IDs。
Test Evidence Matrix 是 fixed command、test file/name、evidence directory、ledger file、fixture boundary 和 CI runnable 状态的唯一事实来源。
worker 的主要输入应是对应 AC section 加上它引用的 Appendix rows，而不是完整全局矩阵。
-->

### Runtime Surface Inventory

| Surface ID | Surface Type | Owner | Entry Point | Default Path Required | External Boundary | Source Basis | Projection Type | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- RS-001 --> | <!-- UI route / client component / API / DB / worker / queue / SSE / storage / auth / config 等。 --> | <!-- module/component/service。 --> | <!-- route/action/job/stream entry。 --> | <!-- yes/no + reason。 --> | <!-- provider/storage/network/env 等边界。 --> | <!-- GA-0001 / spec scenario / design obligation。 --> | <!-- spec-requirement / design-obligation / verification-obligation / spec-guard。 --> | <!-- required behavior / preserve boundary / proof-only / not applicable。 --> | <!-- AC-001。 --> | <!-- T-001。 --> | <!-- 不引入 source 外 surface。 --> |

### Operation Coverage Matrix

| Operation ID | Trigger | Control / Route | Request / Action | Expected Rendered UI Update | API/Data Assertion | Reload/Persistence Assertion | Disabled/Failure/Recovery Branches | Source Basis | Projection Type | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- OP-001 --> | <!-- click/type/select/submit/system trigger。 --> | <!-- UI control or route。 --> | <!-- handler/action/API/job request。 --> | <!-- rendered result。 --> | <!-- response/data invariant。 --> | <!-- reload/readback persistence。 --> | <!-- disabled/failure/retry/recovery rows。 --> | <!-- GA/spec/design。 --> | <!-- projection。 --> | <!-- role。 --> | <!-- AC-001。 --> | <!-- T-001。 --> | <!-- 不引入 source 外 operation。 --> |

### State / Branch Coverage Matrix

| State ID | State / Branch | Trigger Into | Observable UI / API Outcome | Data/Event Facts | Allowed Next States | Terminal? | Source Basis | Projection Type | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- ST-001 --> | <!-- loading / empty / disabled / success / failed / timeout / unauthorized 等。 --> | <!-- entry condition/event。 --> | <!-- visible/API outcome。 --> | <!-- DB/event/outbox/job facts。 --> | <!-- next states。 --> | <!-- yes/no。 --> | <!-- GA/spec/design。 --> | <!-- projection。 --> | <!-- role。 --> | <!-- AC-001。 --> | <!-- T-001。 --> | <!-- 不引入 source 外 state。 --> |

### Async / Realtime Chain Matrix

| Chain ID | User/System Entry | Enqueue / Dispatch Fact | Worker / Consumer Fact | Domain Mutation | Event / Outbox Fact | Client Subscription / Readback | Rendered Terminal State | Failure Variant | Source Basis | Projection Type | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- CH-001 --> | <!-- user action/system job。 --> | <!-- queue/action dispatch。 --> | <!-- worker/consumer processing。 --> | <!-- domain/data change。 --> | <!-- event/outbox/log fact。 --> | <!-- SSE/poll/readback。 --> | <!-- success/failure terminal UI。 --> | <!-- failed/dispatch_failed/timeout 或 Not applicable。 --> | <!-- GA/spec/design。 --> | <!-- projection。 --> | <!-- role。 --> | <!-- AC-001。 --> | <!-- T-001。 --> | <!-- 不引入 source 外 chain。 --> |

### Test Evidence Matrix

| Test ID | AC ID | Fixed Command | Test File / Name | Layer | Covers Rows | Default Path? | Fixture Boundary | Must Fail Before Implementation | Evidence Directory | Evidence Produced | Ledger File | CI Runnable? | Source Basis | Projection Type | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- T-001 --> | <!-- AC-001；只能有一个 AC ID，禁止多个 AC 或 shared。 --> | <!-- `pnpm test:e2e tests/e2e/example.spec.ts`；必须可本地/CI 重跑。 --> | <!-- test file / stable test name or filter。 --> | <!-- unit / component / route/API contract / DB integration / worker/job integration / realtime/SSE integration / browser E2E / visual/responsive / security/negative / config/ops/check。 --> | <!-- RS-001, OP-001, ST-001, CH-001。 --> | <!-- yes/no + reason。 --> | <!-- mocked/sandboxed segments and paired default-path proof。 --> | <!-- yes/no + expected failing gap。 --> | <!-- `test-results/<change-slug>/AC-001/T-001/`。 --> | <!-- command.log、ledger.json、DOM/screenshot、trace、API/DB/job/log facts、failure trace。 --> | <!-- `test-results/<change-slug>/AC-001/T-001/ledger.json`。 --> | <!-- yes/no + reason。 --> | <!-- GA/spec/design。 --> | <!-- projection。 --> | <!-- role。 --> | <!-- 不引入 source 外 behavior。 --> |
