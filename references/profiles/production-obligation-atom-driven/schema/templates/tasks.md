## Acceptance-Driven Coverage

<!--
本节是 source/spec/design 到 AC/task/proof 的覆盖索引，不是 executable work。
每个 obligation atom、requirement scenario 或 material design obligation 使用一行；不要用 aggregate rows 替代底层 atoms、scenarios 或 obligations 的覆盖。
所有 Implementation Task IDs / Acceptance Proof Task IDs 必须解析到下方实际 checkbox task；不要只引用 AC heading。
本节只回答“哪些 source-backed obligation 由哪些 AC/task/proof 覆盖”，不承载测试实现、执行入口、产物目录或沉淀状态。
-->

### Obligation Atom Coverage

| Global Atom ID | Artifact Projection | Atom Summary | Acceptance Slice IDs | Implementation Task IDs | Acceptance Proof Task IDs | Acceptance Proof |
| --- | --- | --- | --- | --- | --- | --- |
| <!-- GA-0001；每行只能有一个 ID，不使用 GA-0001-GA-0010 这类 ranges，也不把多个 GA 放一格。 --> | <!-- spec-requirement / spec-guard / design-obligation / verification-obligation / contextual-only --> | <!-- 概述 source-backed obligation / preserve / forbidden-drift boundary。 --> | <!-- AC-001 --> | <!-- AC-001.1, AC-001.2；必须是实际 checkbox ID。 --> | <!-- AC-001.3；必须是实际 checkbox ID，表示验收 proof checkbox，不是测试编号。 --> | <!-- 用户交互、API/data、worker/realtime、security、rendered layout 等 runtime proof 摘要。 --> |

### Requirement / Scenario Coverage

| Capability | Requirement | Scenario | Global Atom IDs | Artifact Projection Handling | Acceptance Slice IDs | Implementation Task IDs | Acceptance Proof Task IDs | Acceptance Proof |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- capability name --> | <!-- exact requirement name --> | <!-- exact scenario name --> | <!-- GA-0001, GA-0002；逐个枚举 exact IDs，不使用 ranges。 --> | <!-- spec-requirement scenario；或说明 spec-guard/design/verification atom 不伪造 scenario。 --> | <!-- AC-001 --> | <!-- AC-001.1 --> | <!-- AC-001.3 --> | <!-- scenario-level observable proof summary。 --> |

### Design Obligation Coverage

| Design Section | Design Obligation | Global Atom IDs | Artifact Projection Handling | Acceptance Slice IDs | Implementation Task IDs | Acceptance Proof Task IDs | Acceptance Proof |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- exact design section / decision / gate item --> | <!-- material implementation、preservation 或 verification obligation。 --> | <!-- GA-0001, GA-0002, 或 Not applicable；逐个枚举 exact IDs，不使用 ranges。 --> | <!-- design-obligation / verification-obligation / spec-guard handling。 --> | <!-- AC-001 --> | <!-- AC-001.1 --> | <!-- AC-001.3 --> | <!-- design-obligation proof summary。 --> |

## Runtime Acceptance Index

<!--
本节是主 agent preflight 的轻量路由表，不是 executable work，也不是测试计划。
它只把 AC 路由到 runtime rows、provider/consumer dependency graph 和验收 proof checkbox。
如果 change 不触及 runtime behavior，写明 Not applicable 和 source-backed 理由。
-->

### AC Runtime Ownership Index

| AC ID | Source Basis | Runtime Surface Rows | Operation Rows | State / Branch Rows | Async / Realtime Rows | Provides Rows | Consumes Rows | Depends On AC IDs | Prerequisite Runtime Facts | Start Gate | Scope Role | No-Scope-Expansion Check | Detail Matrix Rows | Acceptance Proof Task IDs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- AC-001 --> | <!-- GA-0001, spec scenario, design obligation。 --> | <!-- RS-001 --> | <!-- OP-001 --> | <!-- ST-001, ST-002 --> | <!-- CH-001 或 Not applicable。 --> | <!-- 本 AC 完成后提供的 rows，例如 RS-001；没有则 None。 --> | <!-- 本 AC 消费的 baseline 或 earlier AC rows，例如 RS-003；没有则 None。 --> | <!-- AC-000 / AC-001 / None；只能引用前置 AC。 --> | <!-- baseline fact / earlier AC runtime fact / None。 --> | <!-- 可在 change 开始后执行 / 需 AC-000 完成后执行。 --> | <!-- required behavior / preserve boundary / proof-only / not applicable。 --> | <!-- 不引入 source 外 route/control/state/API/job/event/provider/storage/retry 等。 --> | <!-- RS-001, OP-001, ST-001, CH-001。 --> | <!-- AC-001.3；必须是实际 checkbox ID。 --> |

<!-- 每个 AC section 是人工审阅和 worker 执行的主要入口；Appendix 是 runtime 明细来源。 -->
<!-- 每个 checkbox task block（checkbox + Source Atoms/Projection/Spec/Design/Runtime Rows/Acceptance/Source/Preserve/Proof/Mock Policy trace fields）与下一个 checkbox task block 之间必须保留一个空行；不要在同一 task block 的 trace fields 之间插入空行。 -->

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

Prerequisites:
- <!-- 本 AC 启动前必须完成的 AC IDs 或 baseline/runtime facts；无依赖时写 None 并说明只依赖 baseline。 -->

Provides:
- <!-- 本 AC 完成后为后续 AC 提供的 runtime surfaces / operations / states / contracts / proof facts；没有则写 None。 -->

Consumes:
- <!-- 本 AC proof 消费的 baseline 或 earlier AC rows / contracts / facts；消费 current-change row 时必须能回到 Prerequisites。 -->

Start Gate:
- <!-- 进入本 AC 的执行门禁，例如“AC-000.3 已完成，RS-003 已由 earlier AC 提供”。 -->

No-Scope Boundary:
- <!-- 明确本 AC 不得引入的 source 外 route/control/state/API/job/event/provider/storage/retry/lifecycle 行为。 -->

Primary Proof:
- <!-- 最强验收证据摘要。用户可见行为优先 rendered/readback proof；后端行为优先 API/DB/job/storage/security facts。若涉及新增/编辑/删除/选择/提交等操作，列出 operation matrix，不用控件存在替代交互 proof。 -->

Required Evidence:
- Browser / rendered fact: <!-- 用户可见行为需要的 rendered/readback/responsive/a11y/interaction fact；mutating controls 必须包含 click/type/select/blur/submit 等实际触发和 rendered result。 -->
- API / data / readback fact: <!-- API response、DTO、DB rows、reload/readback、authorization 等事实类别。 -->
- Job / storage / log / audit fact: <!-- worker、queue、storage、asset、log、audit 等事实类别。 -->
- Default path proof: <!-- 必须保留 production/default wiring 的 runtime boundary；仅说明事实类别，不写测试实现。 -->

External Boundary / Default Path Policy:
- <!-- production default path、外部依赖、sandbox/adapter 边界；不描述测试 fixture 实现。 -->

Mock Policy:
- <!-- 哪些允许 sandbox/mock；哪些必须走 default production wiring。 -->

- [ ] AC-001.1 <!-- 用中文描述此 acceptance slice 下的具体实现或验收 proof 任务。 -->
  Source Atoms: <!-- exact GA IDs，逐个枚举，不使用 ranges；无 source-backed 行为的 repository/setup task 写 Not applicable 并给出理由。 -->
  Projection: <!-- linked GA IDs 的 artifact projection；如有多个，逐个列出。 -->
  Spec: <!-- Requirement / scenario names。 -->
  Design: <!-- Design section / decision / obligation。 -->
  Runtime Rows: <!-- 本 task 负责或最终 proof 覆盖的 RS-/OP-/ST-/CH- row IDs；无 runtime 行为时写 Not applicable 并给出 source-backed 理由。 -->
  Acceptance: <!-- 此任务贡献证明的具体可验收行为，而不是 file-edit summary。 -->
  Source: <!-- 来自相关 GA register rows 的 source paths、line ranges 与 source rule。 -->
  Preserve: <!-- 必须保留的 module/data/API/auth/worker/UI/responsive/privacy/ops constraints。 -->
  Proof: <!-- 说明可观察 proof。用户可见操作必须证明 runtime interaction、API/data effect 和 reload/readback；static markup / data-testid / screenshot 只能补充。 -->
  Mock Policy: <!-- 说明 mock/sandbox/default path 规则；不得用 mock 替代 required runtime boundary。 -->

<!-- 每个 AC section 必须至少包含一个 final acceptance/proof checkbox，例如 AC-001.N。该 checkbox 必须出现在本节 Required Evidence、coverage tables 的 Acceptance Proof Task IDs 和最终 apply result 中。 -->

## Verification Appendix

<!--
本节是 runtime 明细矩阵，不属于 executable work section，也不是测试计划。
Runtime detail rows 只在对应矩阵定义；AC section、Runtime Acceptance Index 和 checkbox tasks 只引用 row IDs。
worker 的主要输入应是对应 AC section 加上它引用的 Appendix rows，而不是完整全局矩阵。
-->

### Runtime Surface Inventory

| Surface ID | Surface Type | Owner | Entry Point | Default Path Required | External Boundary | Source Basis | Projection Type | Scope Role | Provider AC ID | Consumer AC IDs | AC IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- RS-001 --> | <!-- UI route / client component / API / DB / worker / queue / SSE / storage / auth / config 等。 --> | <!-- module/component/service。 --> | <!-- route/action/job/stream entry。 --> | <!-- yes/no + reason。 --> | <!-- provider/storage/network/env 等边界。 --> | <!-- GA-0001 / spec scenario / design obligation。 --> | <!-- spec-requirement / design-obligation / verification-obligation / spec-guard。 --> | <!-- required behavior / preserve boundary / proof-only / not applicable。 --> | <!-- baseline / AC-001 / explicit-negative-boundary。 --> | <!-- AC-002, AC-003 或 None。 --> | <!-- AC-001。 --> | <!-- 不引入 source 外 surface。 --> |

### Operation Coverage Matrix

| Operation ID | Trigger | Control / Route | Request / Action | Expected Rendered UI Update | API/Data Assertion | Reload/Persistence Assertion | Disabled/Failure/Recovery Branches | Source Basis | Projection Type | Scope Role | Provider AC ID | Consumer AC IDs | AC IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- OP-001 --> | <!-- click/type/select/submit/system trigger。 --> | <!-- UI control or route。 --> | <!-- handler/action/API/job request。 --> | <!-- rendered result。 --> | <!-- response/data invariant。 --> | <!-- reload/readback persistence。 --> | <!-- disabled/failure/retry/recovery rows。 --> | <!-- GA/spec/design。 --> | <!-- projection。 --> | <!-- role。 --> | <!-- baseline / AC-001 / explicit-negative-boundary。 --> | <!-- AC-002 或 None。 --> | <!-- AC-001。 --> | <!-- 不引入 source 外 operation。 --> |

### State / Branch Coverage Matrix

| State ID | State / Branch | Trigger Into | Observable UI / API Outcome | Data/Event Facts | Allowed Next States | Terminal? | Source Basis | Projection Type | Scope Role | Provider AC ID | Consumer AC IDs | AC IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- ST-001 --> | <!-- loading / empty / disabled / success / failed / timeout / unauthorized 等。 --> | <!-- entry condition/event。 --> | <!-- visible/API outcome。 --> | <!-- DB/event/outbox/job facts。 --> | <!-- next states。 --> | <!-- yes/no。 --> | <!-- GA/spec/design。 --> | <!-- projection。 --> | <!-- role。 --> | <!-- baseline / AC-001 / explicit-negative-boundary。 --> | <!-- AC-002 或 None。 --> | <!-- AC-001。 --> | <!-- 不引入 source 外 state。 --> |

### Async / Realtime Chain Matrix

| Chain ID | User/System Entry | Enqueue / Dispatch Fact | Worker / Consumer Fact | Domain Mutation | Event / Outbox Fact | Client Subscription / Readback | Rendered Terminal State | Failure Variant | Source Basis | Projection Type | Scope Role | Provider AC ID | Consumer AC IDs | AC IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- CH-001 --> | <!-- user action/system job。 --> | <!-- queue/action dispatch。 --> | <!-- worker/consumer processing。 --> | <!-- domain/data change。 --> | <!-- event/outbox/log fact。 --> | <!-- SSE/poll/readback。 --> | <!-- success/failure terminal UI。 --> | <!-- failed/dispatch_failed/timeout 或 Not applicable。 --> | <!-- GA/spec/design。 --> | <!-- projection。 --> | <!-- role。 --> | <!-- baseline / AC-001 / explicit-negative-boundary。 --> | <!-- AC-002 或 None。 --> | <!-- AC-001。 --> | <!-- 不引入 source 外 chain。 --> |
