## Acceptance-Driven Coverage

<!--
本节是 generation-quality gate，不是 executable work。不要在这里放 checkbox tasks。
每个 obligation atom、requirement scenario 或 material design obligation 使用一行；不要用 aggregate rows 替代底层 atoms、scenarios 或 obligations 的覆盖。
所有 Implementation Task IDs / Verification Task IDs 必须解析到下方实际 checkbox task；不要只引用 AC heading。
-->

### Obligation Atom Coverage

| Global Atom ID | Artifact Projection | Atom Summary | Acceptance Slice IDs | Implementation Task IDs | Verification Task IDs | Acceptance Proof |
| --- | --- | --- | --- | --- | --- | --- |
| <!-- OGA-0001；每行只能有一个 ID，不使用 OGA-0001-OGA-0010 这类 ranges，也不把多个 OGA 放一格。 --> | <!-- spec-requirement / spec-guard / design-obligation / verification-obligation / contextual-only --> | <!-- 概述 source-backed obligation / preserve / forbidden-drift boundary。 --> | <!-- AC-001 --> | <!-- AC-001.1, AC-001.2；必须是实际 checkbox ID --> | <!-- AC-001.3；必须是实际 checkbox ID --> | <!-- user interaction、API test、data assertion、worker/realtime path、security check、rendered layout check 等。 --> |

### Requirement / Scenario Coverage

| Capability | Requirement | Scenario | Global Atom IDs | Artifact Projection Handling | Acceptance Slice IDs | Implementation Task IDs | Verification Task IDs | Acceptance Proof |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- capability name --> | <!-- exact requirement name --> | <!-- exact scenario name --> | <!-- OGA-0001, OGA-0002；逐个枚举 exact IDs，不使用 ranges --> | <!-- spec-requirement scenario；或说明 spec-guard/design/verification atom 不伪造 scenario --> | <!-- AC-001 --> | <!-- AC-001.1 --> | <!-- AC-001.3 --> | <!-- scenario-level observable proof。 --> |

### Design Obligation Coverage

| Design Section | Design Obligation | Global Atom IDs | Artifact Projection Handling | Acceptance Slice IDs | Implementation Task IDs | Verification Task IDs | Acceptance Proof |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- exact design section / decision / gate item --> | <!-- material implementation、preservation 或 verification obligation。 --> | <!-- OGA-0001, OGA-0002, 或 Not applicable；逐个枚举 exact IDs，不使用 ranges --> | <!-- design-obligation / verification-obligation / spec-guard handling --> | <!-- AC-001 --> | <!-- AC-001.1 --> | <!-- AC-001.3 --> | <!-- design-obligation proof。 --> |

## Runtime Acceptance Index

<!--
本节是主 agent preflight 的轻量路由表，不是 executable work，也不是 worker 的主要执行说明。
每个 AC 必须把本表中属于自己的 rows 编译到下方 AC-local execution contract。
如果 change 不触及 web/runtime behavior，写明 Not applicable 和 source-backed 理由。
-->

### AC Runtime Ownership Index

| AC ID | Source Basis | Runtime Surface Rows | Operation Rows | State / Branch Rows | Async / Realtime Rows | Test IDs | Scope Role | No-Scope-Expansion Check | Detail Matrix Rows |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- AC-001 --> | <!-- OGA-0001, spec scenario, design obligation --> | <!-- RS-001 --> | <!-- OP-001 --> | <!-- ST-001, ST-002 --> | <!-- CH-001 或 Not applicable --> | <!-- T-001, T-002 --> | <!-- required behavior / preserve boundary / proof-only / not applicable --> | <!-- 不引入 source 外 route/control/state/API/job/event/provider/storage/retry 等。 --> | <!-- RS-001, OP-001, ST-001, CH-001, T-001 --> |

<!-- 每个 checkbox task block（checkbox + Source Atoms/Spec/Design/Runtime Rows/Test IDs/Acceptance/Source/Preserve/Proof/Mock Policy trace fields）与下一个 checkbox task block 之间必须保留一个空行；不要在同一 task block 的 trace fields 之间插入空行。 -->

## AC-001 <!-- 中文验收切片名称 -->

Acceptance:
- <!-- 用户/系统可观察的验收行为。必须能从 proposal/spec/design/obligation atoms 推导，不从实现计划反推。 -->

Source Atoms:
- <!-- OGA-0001, OGA-0002；逐个枚举 exact IDs，不使用 ranges。 -->

Projection:
- <!-- linked OGA IDs 的 artifact projection；例如 OGA-0001: spec-requirement。 -->

Spec:
- <!-- Capability / Requirement / Scenario names。 -->

Design:
- <!-- Design sections / decisions / obligations。 -->

Runtime Rows Owned:
- <!-- RS-001, OP-001, ST-001, CH-001；必须与 Runtime Acceptance Index 和 Verification Appendix 对齐。 -->

Test IDs:
- <!-- T-001, T-002；必须与 Test Evidence Matrix 对齐，且每个 Test ID 只能归属本 AC。 -->

Test Items:
- <!-- T-001：固定命令 `pnpm test:e2e tests/e2e/example.spec.ts`；evidence directory `test-results/<change-slug>/AC-001/T-001/`；ledger `test-results/<change-slug>/AC-001/T-001/ledger.json`；local/CI runnable: yes。 -->

No-Scope Boundary:
- <!-- 明确本 AC 不得引入的 source 外 route/control/state/API/job/event/provider/storage/retry/lifecycle 行为。 -->

Primary Proof:
- <!-- 最强验收证据。用户可见行为优先 browser/E2E/rendered proof；后端行为优先 API/DB/job/storage/security facts。若涉及新增/编辑/删除/选择/提交等操作，列出 operation matrix，不用控件存在替代交互 proof。 -->

Required Evidence:
- Commands: <!-- 每个 Test ID 的固定可重跑命令；不得只写 broad workspace command。 -->
- Evidence root: <!-- `test-results/<change-slug>/AC-001/`。所有测试相关 evidence 必须保存或复制到该 AC 目录。 -->
- Browser / rendered evidence: <!-- screenshot / DOM / responsive / a11y / interaction evidence。mutating controls 必须包含 click/type/select/blur/submit 等实际触发和 rendered result。 -->
- Data / API / job / storage evidence: <!-- DB rows / API response / queue status / asset facts / logs / audit facts -->
- Evidence ledger expectation: <!-- apply 时必须在 `test-results/<change-slug>/<AC-ID>/<Test-ID>/ledger.json` 记录的证据条目：命令、截图/DOM、API/DB/job/storage/log/audit facts、default-path proof、artifact paths。 -->

Mock / Fixture Boundary:
- <!-- 允许 mock/sandbox 的段、不能 mock 的 default path、以及哪个 Test ID 覆盖被 fixture 替换的 production boundary。 -->

Mock Policy:
- <!-- 哪些允许 sandbox/mock；哪些必须走 default production wiring。 -->

- [ ] AC-001.1 <!-- 用中文描述此 acceptance slice 下的具体实现或验证任务。 -->
  Source Atoms: <!-- exact OGA IDs，逐个枚举，不使用 ranges。 -->
  Projection: <!-- linked OGA IDs 的 artifact projection；如有多个，逐个列出。 -->
  Spec: <!-- Requirement / scenario names。 -->
  Design: <!-- Design section / decision / obligation。 -->
  Runtime Rows: <!-- RS-/OP-/ST-/CH- row IDs；无 runtime 行为时写 Not applicable 并给出 source-backed 理由。 -->
  Test IDs: <!-- T- row IDs；implementation-only task 也要引用 final verification task 会执行的 Test IDs。 -->
  Acceptance: <!-- 此任务贡献哪个可验收行为。 -->
  Source: <!-- 来自相关 OGA register rows 的 source paths、line ranges 与 source rule。 -->
  Preserve: <!-- 必须保留的 module/data/API/auth/worker/UI/responsive/privacy/ops constraints。 -->
  Proof: <!-- 说明要执行的 source-equivalent proof。用户可见操作必须证明 runtime interaction、API/data effect 和 reload/readback；static markup / data-testid / screenshot 只能补充。 -->
  Mock Policy: <!-- 说明 mock/sandbox/default path 规则。 -->

<!-- 每个 AC section 必须至少包含一个 final verification / acceptance checkbox，例如 AC-001.N。该 checkbox 必须出现在本节 Required Evidence、coverage tables 的 Verification Task IDs 和最终 apply evidence ledger 中。 -->

## Verification Appendix

<!--
本节是主 agent preflight 和最终 audit 的详细 runtime/test 模型，不属于 executable work section。
worker 的主要输入应是对应 AC section 中的 AC-local execution contract，而不是完整全局矩阵。
-->

### Runtime Surface Inventory

| Surface ID | Surface Type | Owner | Entry Point | Default Path Required | External Boundary | Source Basis | Projection Type | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- RS-001 --> | <!-- UI route / client component / API / DB / worker / queue / SSE / storage / auth / config 等 --> | <!-- module/component/service --> | <!-- route/action/job/stream entry --> | <!-- yes/no + reason --> | <!-- provider/storage/network/env 等边界 --> | <!-- OGA-0001 / spec scenario / design obligation --> | <!-- spec-requirement / design-obligation / verification-obligation / spec-guard --> | <!-- required behavior / preserve boundary / proof-only / not applicable --> | <!-- AC-001 --> | <!-- T-001 --> | <!-- 不引入 source 外 surface。 --> |

### Operation Coverage Matrix

| Operation ID | Trigger | Control / Route | Request / Action | Expected Rendered UI Update | API/Data Assertion | Reload/Persistence Assertion | Disabled/Failure/Recovery Branches | Source Basis | Projection Type | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- OP-001 --> | <!-- click/type/select/submit/system trigger --> | <!-- UI control or route --> | <!-- handler/action/API/job request --> | <!-- rendered result --> | <!-- response/data invariant --> | <!-- reload/readback persistence --> | <!-- disabled/failure/retry/recovery rows --> | <!-- OGA/spec/design --> | <!-- projection --> | <!-- role --> | <!-- AC-001 --> | <!-- T-001 --> | <!-- 不引入 source 外 operation。 --> |

### State / Branch Coverage Matrix

| State ID | State / Branch | Trigger Into | Observable UI / API Outcome | Data/Event Facts | Allowed Next States | Terminal? | Source Basis | Projection Type | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- ST-001 --> | <!-- loading / empty / disabled / success / failed / timeout / unauthorized 等 --> | <!-- entry condition/event --> | <!-- visible/API outcome --> | <!-- DB/event/outbox/job facts --> | <!-- next states --> | <!-- yes/no --> | <!-- OGA/spec/design --> | <!-- projection --> | <!-- role --> | <!-- AC-001 --> | <!-- T-001 --> | <!-- 不引入 source 外 state。 --> |

### Async / Realtime Chain Matrix

| Chain ID | User/System Entry | Enqueue / Dispatch Fact | Worker / Consumer Fact | Domain Mutation | Event / Outbox Fact | Client Subscription / Readback | Rendered Terminal State | Failure Variant | Source Basis | Projection Type | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- CH-001 --> | <!-- user action/system job --> | <!-- queue/action dispatch --> | <!-- worker/consumer processing --> | <!-- domain/data change --> | <!-- event/outbox/log fact --> | <!-- SSE/poll/readback --> | <!-- success/failure terminal UI --> | <!-- failed/dispatch_failed/timeout 或 Not applicable --> | <!-- OGA/spec/design --> | <!-- projection --> | <!-- role --> | <!-- AC-001 --> | <!-- T-001 --> | <!-- 不引入 source 外 chain。 --> |

### Test Evidence Matrix

| Test ID | AC ID | Fixed Command | Test File / Name | Layer | Covers Rows | Default Path? | Fixture Boundary | Must Fail Before Implementation | Evidence Directory | Evidence Produced | Ledger File | CI Runnable? | Source Basis | Projection Type | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- T-001 --> | <!-- AC-001；只能有一个 AC ID，禁止多个 AC 或 shared --> | <!-- `pnpm test:e2e tests/e2e/example.spec.ts`；必须可本地/CI 重跑 --> | <!-- test file / stable test name or filter --> | <!-- unit / component / route/API contract / DB integration / worker/job integration / realtime/SSE integration / browser E2E / visual/responsive / security/negative / config/ops/check --> | <!-- RS-001, OP-001, ST-001, CH-001 --> | <!-- yes/no + reason --> | <!-- mocked/sandboxed segments and paired default-path proof --> | <!-- yes/no + expected failing gap --> | <!-- `test-results/<change-slug>/AC-001/T-001/` --> | <!-- command.log、ledger.json、DOM/screenshot、trace、API/DB/job/log facts、failure trace --> | <!-- `test-results/<change-slug>/AC-001/T-001/ledger.json` --> | <!-- yes/no + reason --> | <!-- OGA/spec/design --> | <!-- projection --> | <!-- role --> | <!-- 不引入 source 外 behavior。 --> |
