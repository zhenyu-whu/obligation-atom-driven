## Acceptance-Driven Coverage

<!--
本节是 source/spec/design 到 AC/task 的覆盖索引，不是 executable work。
每个 obligation atom、requirement scenario 或 material design obligation 使用一行。
本节只回答“哪些 source-backed obligation 由哪些 AC/task/proof 覆盖”；Implementation / Verification Task IDs 填写下方 checkbox task ID。
跨 AC handoff 只写 proof summary，测试明细在 Verification Appendix。
-->

### Obligation Atom Coverage

| Global Atom ID                                                                                  | Artifact Projection                                                                                    | Atom Summary                                                                   | Acceptance Slice IDs | Implementation Task IDs                               | Verification Task IDs                       | Acceptance Proof                                                                                                                    |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | -------------------- | ----------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| <!-- GA-0001；每行一个 atom。 --> | <!-- spec-requirement / spec-guard / design-obligation / verification-obligation / contextual-only --> | <!-- 概述 source-backed obligation / preserve / stable negative boundary。 --> | <!-- AC-001；跨 AC 时列相关 AC 并在 proof 写 handoff。 -->      | <!-- AC-001.1, AC-001.2。 --> | <!-- AC-003.5。 --> | <!-- user interaction、API/data assertion、worker/realtime path、security check、rendered layout check 等 proof summary。 --> |

### Requirement / Scenario Coverage

| Capability               | Requirement                     | Scenario                     | Global Atom IDs                                                | Artifact Projection Handling                                                                     | Acceptance Slice IDs | Implementation Task IDs | Verification Task IDs | Acceptance Proof                                   |
| ------------------------ | ------------------------------- | ---------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------- | ----------------------- | --------------------- | -------------------------------------------------- |
| <!-- capability name --> | <!-- exact requirement name --> | <!-- exact scenario name --> | <!-- GA-0001, GA-0002。 --> | <!-- spec-requirement scenario；或说明 spec-guard/design/verification atom handling。 --> | <!-- AC-001；跨 AC proof 时列相关 AC。 -->      | <!-- AC-001.1 -->       | <!-- AC-003.5。 -->     | <!-- scenario-level observable proof summary。 --> |

### Design Obligation Coverage

| Design Section                                       | Design Obligation                                                           | Global Atom IDs                                                                   | Artifact Projection Handling                                                 | Acceptance Slice IDs | Implementation Task IDs | Verification Task IDs | Acceptance Proof                           |
| ---------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------- | ----------------------- | --------------------- | ------------------------------------------ |
| <!-- exact design section / decision / gate item --> | <!-- material implementation、preservation 或 verification obligation。 --> | <!-- GA-0001, GA-0002, 或 Not applicable。 --> | <!-- design-obligation / verification-obligation / spec-guard handling。 --> | <!-- AC-001；跨 AC proof 时列相关 AC。 -->      | <!-- AC-001.1 -->       | <!-- AC-003.5。 -->     | <!-- design-obligation proof summary。 --> |

## Runtime Acceptance Index

<!--
本节是主 agent preflight 的轻量路由表，只把 AC 路由到 Appendix row IDs、Test IDs 和 AC dependency graph。
如果 change 不触及 web/runtime behavior，写明 Not applicable 和 source-backed 理由。
-->

### AC Runtime Ownership Index

| AC ID           | Source Basis                                         | Runtime Surface Rows | Operation Rows  | State / Branch Rows     | Async / Realtime Rows               | Test IDs              | Provides Rows                                                | Consumes Rows                                                                 | Depends On AC IDs                                  | Prerequisite Test IDs                                 | Start Gate                                               | Scope Role                                                                     | No-Scope-Expansion Check                                                                | Detail Matrix Rows                               |
| --------------- | ---------------------------------------------------- | -------------------- | --------------- | ----------------------- | ----------------------------------- | --------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------ |
| <!-- AC-001 --> | <!-- GA-0001, spec scenario, design obligation。 --> | <!-- RS-001 -->      | <!-- OP-001 --> | <!-- ST-001, ST-002 --> | <!-- CH-001 或 Not applicable。 --> | <!-- T-001, T-002 --> | <!-- 本 AC 完成后提供的 rows；没有则 None。 --> | <!-- 本 AC 消费的 baseline 或 earlier AC rows；没有则 None。 --> | <!-- AC-000 / AC-001 / None。 --> | <!-- T-000 / T-001 / None。 --> | <!-- 可在 change 开始后执行 / 需 AC-000 完成后执行。 --> | <!-- required behavior / preserve boundary / proof-only / not applicable。 --> | <!-- source boundary 摘要。 --> | <!-- RS-001, OP-001, ST-001, CH-001, T-001。 --> |

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

- <!-- T-001, T-002；本 AC 的测试计划索引。 -->
- <!-- 跨 AC proof handoff 写在 Required Evidence / coverage row。 -->

Prerequisites:

- <!-- 本 AC 启动前必须完成的 AC IDs、Test IDs 或 baseline facts；无依赖时写 None 并说明只依赖 baseline。 -->

Provides:

- <!-- 本 AC 完成后为后续 AC 提供的 runtime surfaces / operations / states / contracts / proof facts；没有则写 None。 -->

Consumes:

- <!-- 本 AC proof 消费的 baseline 或 earlier AC rows / contracts / facts；消费 current-change row 时必须能回到 Prerequisites。 -->

Start Gate:

- <!-- 进入本 AC 的执行门禁，例如“AC-000.3 与 T-000 已完成，RS-003 已由 earlier AC 提供”。 -->

No-Scope Boundary:

- <!-- 明确本 AC 不得引入的 source 外 route/control/state/API/job/event/provider/storage/retry/lifecycle 行为。 -->

Primary Proof:

- <!-- 人类可读的最高强度验收证明摘要。用户可见行为优先 browser/E2E/rendered proof；后端行为优先 API/DB/job/storage/security facts。具体 row 详情和 test 命令通过 Runtime Rows Owned / Test IDs 跳转到 Appendix。 -->

Required Evidence:

- Test evidence: <!-- T-001, T-002。 -->
- Browser / rendered evidence: <!-- screenshot / DOM / responsive / a11y / interaction evidence 摘要。 -->
- Data / API / job / storage evidence: <!-- DB rows / API response / queue status / asset facts / logs / audit facts 摘要。 -->

Mock / Fixture Boundary:

- <!-- AC-level default path / mock 原则摘要；逐 Test ID 的 fixture boundary 在 Test Evidence Matrix 中填写。 -->

Mock Policy:

- <!-- 允许 sandbox/mock 与 default production wiring 的摘要。 -->

- [ ] AC-001.1 <!-- 用中文描述此 acceptance slice 下的具体实现或验证任务。 -->
      Trace: <!-- 默认写 inherits AC-001；只有当本 task 的 source atoms/spec/design/projection/no-scope/mock 边界比 AC 更窄或有例外时才展开 override；不要重复 AC-level 字段。 -->
      Runtime Rows: <!-- 本 task 负责或最终验证覆盖的 RS-/OP-/ST-/CH- row IDs；无 runtime 行为时写 Not applicable 并给出 source-backed 理由。 -->
      Test IDs: <!-- 本 task 建立、维护或由 final verification 执行的 T-### row IDs。 -->
      Acceptance: <!-- 此任务贡献证明的具体可验收行为。 -->
      Proof: <!-- source-equivalent proof 摘要。 -->
      Overrides: <!-- 若不继承 AC-level source/no-scope/mock boundary，在此列 exact override；否则写 None。 -->

<!-- final verification / acceptance checkbox 示例：AC-001.N；跨 AC proof handoff 时引用对应 owner AC 的 verification checkbox。 -->

## Verification Appendix

<!--
本节是 runtime/test 明细的矩阵骨架；字段含义、门禁和 apply 阶段完成条件见 schema.yaml 与 shared verification gates。
tasks 阶段填写计划态 rows、Test IDs、fixed command/entry、期望 evidence 和 fixture 摘要；实际执行结果由 apply 阶段更新。
runtime detail matrices 可按需最小化；不适用时保留 Not applicable 行和 source-backed 理由。
worker 的主要输入应是对应 AC section 加上它引用的 Appendix rows。
-->

### Runtime Surface Inventory

| Surface ID      | Surface Type                                                                                          | Owner                               | Entry Point                              | Default Path Required      | External Boundary                              | Source Basis                                           | Projection Type                                                                        | Scope Role                                                                     | Provider AC ID                                            | Consumer AC IDs                   | AC IDs            | Test IDs         | No-Scope-Expansion Check            |
| --------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------- | -------------------------- | ---------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- | --------------------------------- | ----------------- | ---------------- | ----------------------------------- |
| <!-- RS-001 --> | <!-- UI route / client component / API / DB / worker / queue / SSE / storage / auth / config 等。 --> | <!-- module/component/service。 --> | <!-- route/action/job/stream entry。 --> | <!-- yes/no + reason。 --> | <!-- provider/storage/network/env 等边界。 --> | <!-- GA-0001 / spec scenario / design obligation。 --> | <!-- spec-requirement / design-obligation / verification-obligation / spec-guard。 --> | <!-- required behavior / preserve boundary / proof-only / not applicable。 --> | <!-- baseline / AC-001 / explicit-negative-boundary。 --> | <!-- AC-002, AC-003 或 None。 --> | <!-- AC-001。 --> | <!-- T-001。 --> | <!-- 不引入 source 外 surface。 --> |

### Operation Coverage Matrix

| Operation ID    | Trigger                                            | Control / Route                | Request / Action                          | Expected Rendered UI Update | API/Data Assertion                 | Reload/Persistence Assertion           | Disabled/Failure/Recovery Branches              | Source Basis              | Projection Type       | Scope Role      | Provider AC ID                                            | Consumer AC IDs           | AC IDs            | Test IDs         | No-Scope-Expansion Check              |
| --------------- | -------------------------------------------------- | ------------------------------ | ----------------------------------------- | --------------------------- | ---------------------------------- | -------------------------------------- | ----------------------------------------------- | ------------------------- | --------------------- | --------------- | --------------------------------------------------------- | ------------------------- | ----------------- | ---------------- | ------------------------------------- |
| <!-- OP-001 --> | <!-- click/type/select/submit/system trigger。 --> | <!-- UI control or route。 --> | <!-- handler/action/API/job request。 --> | <!-- rendered result。 -->  | <!-- response/data invariant。 --> | <!-- reload/readback persistence。 --> | <!-- disabled/failure/retry/recovery rows。 --> | <!-- GA/spec/design。 --> | <!-- projection。 --> | <!-- role。 --> | <!-- baseline / AC-001 / explicit-negative-boundary。 --> | <!-- AC-002 或 None。 --> | <!-- AC-001。 --> | <!-- T-001。 --> | <!-- 不引入 source 外 operation。 --> |

### State / Branch Coverage Matrix

| State ID        | State / Branch                                                                       | Trigger Into                     | Observable UI / API Outcome    | Data/Event Facts                     | Allowed Next States    | Terminal?         | Source Basis              | Projection Type       | Scope Role      | Provider AC ID                                            | Consumer AC IDs           | AC IDs            | Test IDs         | No-Scope-Expansion Check          |
| --------------- | ------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------ | ------------------------------------ | ---------------------- | ----------------- | ------------------------- | --------------------- | --------------- | --------------------------------------------------------- | ------------------------- | ----------------- | ---------------- | --------------------------------- |
| <!-- ST-001 --> | <!-- loading / empty / disabled / success / failed / timeout / unauthorized 等。 --> | <!-- entry condition/event。 --> | <!-- visible/API outcome。 --> | <!-- DB/event/outbox/job facts。 --> | <!-- next states。 --> | <!-- yes/no。 --> | <!-- GA/spec/design。 --> | <!-- projection。 --> | <!-- role。 --> | <!-- baseline / AC-001 / explicit-negative-boundary。 --> | <!-- AC-002 或 None。 --> | <!-- AC-001。 --> | <!-- T-001。 --> | <!-- 不引入 source 外 state。 --> |

### Async / Realtime Chain Matrix

| Chain ID        | User/System Entry                 | Enqueue / Dispatch Fact          | Worker / Consumer Fact                | Domain Mutation               | Event / Outbox Fact              | Client Subscription / Readback | Rendered Terminal State                | Failure Variant                                             | Source Basis              | Projection Type       | Scope Role      | Provider AC ID                                            | Consumer AC IDs           | AC IDs            | Test IDs         | No-Scope-Expansion Check          |
| --------------- | --------------------------------- | -------------------------------- | ------------------------------------- | ----------------------------- | -------------------------------- | ------------------------------ | -------------------------------------- | ----------------------------------------------------------- | ------------------------- | --------------------- | --------------- | --------------------------------------------------------- | ------------------------- | ----------------- | ---------------- | --------------------------------- |
| <!-- CH-001 --> | <!-- user action/system job。 --> | <!-- queue/action dispatch。 --> | <!-- worker/consumer processing。 --> | <!-- domain/data change。 --> | <!-- event/outbox/log fact。 --> | <!-- SSE/poll/readback。 -->   | <!-- success/failure terminal UI。 --> | <!-- failed/dispatch_failed/timeout 或 Not applicable。 --> | <!-- GA/spec/design。 --> | <!-- projection。 --> | <!-- role。 --> | <!-- baseline / AC-001 / explicit-negative-boundary。 --> | <!-- AC-002 或 None。 --> | <!-- AC-001。 --> | <!-- T-001。 --> | <!-- 不引入 source 外 chain。 --> |

### Test Layer Plan

| AC ID           | Behavior / Boundary                                        | Source Basis              | Projection Type                                                                        | Required Layers                                                                                                        | Test IDs By Layer                                                                                                                                                                                                           | Omitted Layers / Reason                                                                            | Primary Proof Layer                                                                                            | Regression Entry                                                    | No-Scope-Expansion Check                           |
| --------------- | ---------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| <!-- AC-001 --> | <!-- 外部行为、preserve boundary 或 proof-only guard。 --> | <!-- GA/spec/design。 --> | <!-- spec-requirement / design-obligation / verification-obligation / spec-guard。 --> | <!-- unit / component / route/API contract / DB integration / browser E2E / security/negative / config/ops/check。 --> | <!-- unit: T-001；component: T-002；browser E2E: T-003。 --> | <!-- omitted layers and reason。 --> | <!-- primary proof layer。 --> | <!-- regression entry。 --> | <!-- source guard summary。 --> |

### Test Evidence Matrix

| Test ID                                                                         | AC ID                                                      | Fixed Command                                                                    | Test File / Name                                                                                                                                                                                                                                                                                                                                                                                                               | Layer                                                                                                                                                                                                                                              | Covers Rows                               | Default Path Level              | Fixture Boundary                                                   | Verification Expectation                                                       | Evidence Status                                                                                                    | Requires Tests Passed                                   | Evidence Directory                                                                         | Evidence Produced                                                                                         | CI Runnable?                                                   | Source Basis              | Projection Type       | Scope Role      | No-Scope-Expansion Check             |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------- | --------------------- | --------------- | ------------------------------------ |
| <!-- T-001 --> | <!-- AC-001 --> | <!-- root/package/CI command or dedicated runner command。 --> | <!-- test file + stable name/filter。 --> | <!-- unit / component / route/API contract / DB integration / worker/job integration / realtime/SSE integration / browser E2E / visual/responsive / security/negative / config/ops/check。 --> | <!-- RS-001, OP-001, ST-001, CH-001。 --> | <!-- default path label。 --> | <!-- planned fixture/mock boundary。 --> | <!-- expected behavior/evidence。 --> | <!-- planned / passed / not-applicable / blocked。 --> | <!-- None / T-000。 --> | <!-- openspec-results/<change-slug>/AC-001/T-001/。 --> | <!-- expected or actual artifacts。 --> | <!-- yes/no + entry or blocker。 --> | <!-- GA/spec/design。 --> | <!-- projection。 --> | <!-- role。 --> | <!-- source guard summary。 --> |

### Regression Test Deposit

<!--
本表登记可长期维护的回归沉淀计划；字段含义、完成状态和 apply 阶段门禁见 schema.yaml 与 shared verification gates。
tasks 阶段填写 target、command、oracle、fixture、CI tier 和 not-testing boundary；实际 deposited 状态由 apply evidence 支撑。
-->

| AC ID           | Test IDs                                                                                   | Permanent Test File                                                                                                                                                                                                                    | Regression Command                                                                                                                 | Behavior Contract                             | Assertion Oracle                                                                    | Fixture Boundary                                              | CI Tier                                                                            | Not Testing                                                                         | Deposit Status                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| <!-- AC-001 --> | <!-- T-001, T-002。 --> | <!-- planned permanent test file or N/A + reason。 --> | <!-- planned regression command or entry。 --> | <!-- 来自 GA/spec/design 的外部行为契约。 --> | <!-- assertion oracle。 --> | <!-- fixture/mock boundary summary。 --> | <!-- PR-fast / PR-integration / nightly / release / manual-staging + entry。 --> | <!-- implementation details intentionally out of scope。 --> | <!-- required / deposited / not-applicable / blocked。 --> |
