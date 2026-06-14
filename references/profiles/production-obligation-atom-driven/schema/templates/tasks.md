## Acceptance-Driven Coverage

<!--
本节是 source/spec/design 到 AC/task/proof 的覆盖索引，不是 executable work。
每个 obligation atom、requirement scenario 或 material design obligation 使用一行。
本节只回答“哪些 source-backed obligation 由哪些 AC/task/proof 覆盖”；测试意图在 verification.md 中维护。
-->

### Obligation Atom Coverage

| Global Atom ID | Artifact Projection | Atom Summary | Acceptance Slice IDs | Implementation Task IDs | Acceptance Proof Task IDs | Acceptance Proof |
| -------------- | ------------------- | ------------ | -------------------- | ----------------------- | ------------------------- | ---------------- |
| <!-- GA-0001 --> | <!-- spec-requirement / spec-guard / design-obligation / verification-obligation / contextual-only --> | <!-- obligation 摘要。 --> | <!-- AC-001 --> | <!-- AC-001.1 --> | <!-- AC-001.N --> | <!-- 用户交互、API/data、worker/realtime、security、rendered layout 等 runtime proof 摘要。 --> |

### Requirement / Scenario Coverage

| Capability | Requirement | Scenario | Global Atom IDs | Artifact Projection Handling | Acceptance Slice IDs | Implementation Task IDs | Acceptance Proof Task IDs | Acceptance Proof |
| ---------- | ----------- | -------- | --------------- | ---------------------------- | -------------------- | ----------------------- | ------------------------- | ---------------- |
| <!-- capability name --> | <!-- requirement name --> | <!-- scenario name --> | <!-- GA-0001, GA-0002 --> | <!-- spec-requirement / spec-guard / design handoff / verification proof handling。 --> | <!-- AC-001 --> | <!-- AC-001.1 --> | <!-- AC-001.N --> | <!-- scenario-level observable proof summary。 --> |

### Design Obligation Coverage

| Design Section | Design Obligation | Global Atom IDs | Artifact Projection Handling | Acceptance Slice IDs | Implementation Task IDs | Acceptance Proof Task IDs | Acceptance Proof |
| -------------- | ----------------- | --------------- | ---------------------------- | -------------------- | ----------------------- | ------------------------- | ---------------- |
| <!-- design section --> | <!-- implementation、preservation 或 verification obligation。 --> | <!-- GA-0001 --> | <!-- design-obligation / spec-guard / verification proof handling。 --> | <!-- AC-001 --> | <!-- AC-001.1 --> | <!-- AC-001.N --> | <!-- design obligation proof summary。 --> |

## Runtime Acceptance Index

<!--
本节是主 agent preflight 的轻量路由表，只把 AC 路由到 runtime row、proof row 和 dependency graph。
如果 change 不触及 runtime behavior，写明 Not applicable 和 source-backed 理由。
-->

### AC Runtime Ownership Index

| AC ID | Source Basis | Runtime Surface Rows | Operation Rows | State / Branch Rows | Async / Realtime Rows | Provides Rows | Consumes Rows | Depends On AC IDs | Prerequisite Runtime Facts | Start Gate | Scope Role | No-Scope-Expansion Check | Detail Matrix Rows | Acceptance Proof Rows |
| ----- | ------------ | -------------------- | -------------- | ------------------- | --------------------- | ------------- | ------------- | ----------------- | -------------------------- | ---------- | ---------- | ------------------------ | ------------------ | --------------------- |
| <!-- AC-001 --> | <!-- GA-0001, spec scenario, design obligation。 --> | <!-- RS-001 --> | <!-- OP-001 --> | <!-- ST-001 --> | <!-- CH-001 或 Not applicable。 --> | <!-- 本 AC 完成后提供的 runtime rows；没有则 None。 --> | <!-- 本 AC 消费的 baseline 或 earlier AC rows；没有则 None。 --> | <!-- AC-000 / None。 --> | <!-- baseline fact / earlier AC runtime fact / None。 --> | <!-- 可在 change 开始后执行 / 需 AC-000 完成后执行。 --> | <!-- required behavior / preserve boundary / proof-only / not applicable。 --> | <!-- source boundary 摘要。 --> | <!-- RS-001, OP-001, ST-001, CH-001。 --> | <!-- AP-001。 --> |

<!-- 每个 AC section 是人工审阅和 worker 执行的主要入口；Appendix 是 runtime 明细来源。 -->
<!-- 每个 checkbox task block 与下一个 checkbox task block 之间必须保留一个空行；不要在同一 task block 的 trace fields 之间插入空行。 -->

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

- <!-- 本 AC 启动前必须完成的 AC IDs 或 baseline/runtime facts；无依赖时写 None。 -->

Provides:

- <!-- 本 AC 完成后为后续 AC 提供的 runtime surfaces / operations / states / contracts / proof facts；没有则写 None。 -->

Consumes:

- <!-- 本 AC proof 消费的 baseline 或 earlier AC rows / contracts / facts；消费 current-change row 时必须能回到 Prerequisites。 -->

Start Gate:

- <!-- 进入本 AC 的执行门禁。 -->

No-Scope Boundary:

- <!-- 明确本 AC 不得引入的 source 外 route/control/state/API/job/event/provider/storage/retry/lifecycle 行为。 -->

Primary Proof:

- <!-- 人类可读的最高强度验收证明摘要。 -->

Required Evidence:

- Browser / rendered fact: <!-- 用户可见行为需要的 rendered/readback 事实类别，非测试命令。 -->
- API / data fact: <!-- API response、DB/readback、DTO、authorization 等事实类别。 -->
- Job / storage / log fact: <!-- worker、storage、audit/log 等事实类别。 -->

External Boundary / Default Path Policy:

- <!-- production default path、外部依赖、sandbox/adapter 边界；不描述测试 fixture 实现。 -->

Mock Policy:

- <!-- 允许 sandbox/mock 与 default production wiring 的摘要。 -->

- [ ] AC-001.1 <!-- 用中文描述此 acceptance slice 下的具体实现任务。 -->
      Trace: <!-- 默认写 inherits AC-001；只有本 task 的 source/spec/design/no-scope/mock 边界更窄或有例外时才展开 override。 -->
      Runtime Rows: <!-- 本 task 负责或最终 proof 覆盖的 RS-/OP-/ST-/CH- row IDs；无 runtime 行为时写 Not applicable 和 source-backed 理由。 -->
      Acceptance: <!-- 此任务贡献证明的具体可验收行为。 -->
      Proof: <!-- source-equivalent proof 摘要。 -->
      Overrides: <!-- 若不继承 AC-level source/no-scope/mock boundary，在此列 exact override；否则写 None。 -->

<!-- final acceptance/proof checkbox 示例：AC-001.N。 -->

## Verification Appendix

<!--
本节是 runtime 明细矩阵；测试意图和测试 oracle 在 verification.md 中维护。
runtime detail matrices 可按需最小化；不适用时保留 Not applicable 行和 source-backed 理由。
worker 的主要输入应是对应 AC section 加上它引用的 Appendix rows。
-->

### Runtime Surface Inventory

| Surface ID | Surface Type | Owner | Entry Point | Default Path Required | External Boundary | Source Basis | Projection Type | Scope Role | Provider AC ID | Consumer AC IDs | AC IDs | No-Scope-Expansion Check |
| ---------- | ------------ | ----- | ----------- | --------------------- | ----------------- | ------------ | --------------- | ---------- | -------------- | --------------- | ------ | ------------------------ |
| <!-- RS-001 --> | <!-- UI route / client component / API / DB / worker / queue / SSE / storage / auth / config 等。 --> | <!-- module/component/service。 --> | <!-- route/action/job/stream entry。 --> | <!-- yes/no + reason。 --> | <!-- provider/storage/network/env 等边界。 --> | <!-- GA-0001 / spec scenario / design obligation。 --> | <!-- spec-requirement / design-obligation / verification-obligation / spec-guard。 --> | <!-- required behavior / preserve boundary / proof-only / not applicable。 --> | <!-- baseline / AC-001 / explicit-negative-boundary。 --> | <!-- AC-002, AC-003 或 None。 --> | <!-- AC-001。 --> | <!-- 不引入 source 外 surface。 --> |

### Operation Coverage Matrix

| Operation ID | Trigger | Control / Route | Request / Action | Expected Rendered UI Update | API/Data Assertion | Reload/Persistence Assertion | Disabled/Failure/Recovery Branches | Source Basis | Projection Type | Scope Role | Provider AC ID | Consumer AC IDs | AC IDs | No-Scope-Expansion Check |
| ------------ | ------- | --------------- | ---------------- | --------------------------- | ------------------ | ---------------------------- | ---------------------------------- | ------------ | --------------- | ---------- | -------------- | --------------- | ------ | ------------------------ |
| <!-- OP-001 --> | <!-- click/type/select/submit/system trigger。 --> | <!-- UI control or route。 --> | <!-- handler/action/API/job request。 --> | <!-- rendered result。 --> | <!-- response/data invariant。 --> | <!-- reload/readback persistence。 --> | <!-- disabled/failure/retry/recovery rows。 --> | <!-- GA/spec/design。 --> | <!-- projection。 --> | <!-- role。 --> | <!-- baseline / AC-001 / explicit-negative-boundary。 --> | <!-- AC-002 或 None。 --> | <!-- AC-001。 --> | <!-- 不引入 source 外 operation。 --> |

### State / Branch Coverage Matrix

| State ID | State / Branch | Trigger Into | Observable UI / API Outcome | Data/Event Facts | Allowed Next States | Terminal? | Source Basis | Projection Type | Scope Role | Provider AC ID | Consumer AC IDs | AC IDs | No-Scope-Expansion Check |
| -------- | -------------- | ------------ | --------------------------- | ---------------- | ------------------- | --------- | ------------ | --------------- | ---------- | -------------- | --------------- | ------ | ------------------------ |
| <!-- ST-001 --> | <!-- loading / empty / disabled / success / failed / timeout / unauthorized 等。 --> | <!-- entry condition/event。 --> | <!-- visible/API outcome。 --> | <!-- DB/event/outbox/job facts。 --> | <!-- next states。 --> | <!-- yes/no。 --> | <!-- GA/spec/design。 --> | <!-- projection。 --> | <!-- role。 --> | <!-- baseline / AC-001 / explicit-negative-boundary。 --> | <!-- AC-002 或 None。 --> | <!-- AC-001。 --> | <!-- 不引入 source 外 state。 --> |

### Async / Realtime Chain Matrix

| Chain ID | User/System Entry | Enqueue / Dispatch Fact | Worker / Consumer Fact | Domain Mutation | Event / Outbox Fact | Client Subscription / Readback | Rendered Terminal State | Failure Variant | Source Basis | Projection Type | Scope Role | Provider AC ID | Consumer AC IDs | AC IDs | No-Scope-Expansion Check |
| -------- | ----------------- | ----------------------- | ---------------------- | --------------- | ------------------- | ------------------------------ | ----------------------- | --------------- | ------------ | --------------- | ---------- | -------------- | --------------- | ------ | ------------------------ |
| <!-- CH-001 --> | <!-- user action/system job。 --> | <!-- queue/action dispatch。 --> | <!-- worker/consumer processing。 --> | <!-- domain/data change。 --> | <!-- event/outbox/log fact。 --> | <!-- SSE/poll/readback。 --> | <!-- success/failure terminal UI。 --> | <!-- failed/dispatch_failed/timeout 或 Not applicable。 --> | <!-- GA/spec/design。 --> | <!-- projection。 --> | <!-- role。 --> | <!-- baseline / AC-001 / explicit-negative-boundary。 --> | <!-- AC-002 或 None。 --> | <!-- AC-001。 --> | <!-- 不引入 source 外 chain。 --> |
