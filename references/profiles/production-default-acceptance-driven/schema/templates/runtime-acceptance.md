## Runtime Acceptance Intent

<!--
本 artifact 是 canonical runtime coverage registry。
它只定义本 change 必须实现和验证的 RS-/OP-/ST-/CH- runtime rows，供 tasks.md 和 verification.md 投影引用。
它不是 implementation task list、测试计划、执行证据、AC checkbox、VID 状态或 regression deposit。
-->

- Scope: <!-- 本次 runtime acceptance 覆盖的产品/系统运行时边界。 -->
- Scope basis: <!-- proposal scope items、spec scenarios、design decisions。 -->
- Out of scope: <!-- 明确不进入本 change runtime coverage 的 route/control/state/API/job/event/provider/storage 等。 -->

## Runtime Coverage Source Map

| Scope Basis | Artifact Handling | Runtime Row IDs | Runtime Obligation Summary | Observable Fact Category | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- |
| <!-- SI-001 / spec scenario / design decision --> | <!-- spec / guard / design / proof / context --> | <!-- RS-001, OP-001, ST-001, CH-001 --> | <!-- scope-backed runtime obligation。 --> | <!-- rendered/API/DB/job/storage/security/log 等事实类别。 --> | <!-- 不引入 scope 外 runtime behavior。 --> |

## Runtime Surface Inventory

| Surface ID | Surface Type | Owner Candidate | Entry Point | Runtime Obligation | Observable Fact | Default Path Policy | External Boundary | Scope Basis | Artifact Handling | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- RS-001 --> | <!-- UI route / client component / API / DB / worker / queue / SSE / storage / auth / config 等。 --> | <!-- 单一 advisory primary owner candidate；多模块依赖写 External Boundary，不复制为 Proof Slice Production Owner list。 --> | <!-- route/action/job/stream entry。 --> | <!-- 该 surface 必须提供或保留的 runtime behavior。 --> | <!-- 可观察 rendered/API/DB/auth/log 等 fact。 --> | <!-- production/default path 是否必须真实及理由。 --> | <!-- provider/storage/network/env 等边界。 --> | <!-- SI-001 / spec scenario / design decision。 --> | <!-- handling。 --> | <!-- required behavior / preserve boundary / proof-only / not applicable。 --> | <!-- 不引入 scope 外 surface。 --> |

## Operation Coverage Matrix

| Operation ID | Trigger | Control / Route | Request / Action | Runtime Obligation | Expected Rendered UI Update | API/Data Assertion | Reload/Persistence Assertion | Disabled/Failure/Recovery Branches | Default Path Policy | External Boundary | Scope Basis | Artifact Handling | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- OP-001 --> | <!-- click/type/select/submit/system trigger。 --> | <!-- UI control or route。 --> | <!-- handler/action/API/job request。 --> | <!-- 该 operation 的 scope-backed runtime behavior。 --> | <!-- rendered result。 --> | <!-- response/data invariant。 --> | <!-- reload/readback persistence。 --> | <!-- disabled/failure/retry/recovery rows。 --> | <!-- production/default path 是否必须真实及理由。 --> | <!-- provider/storage/network/env 等边界。 --> | <!-- SI/spec/design。 --> | <!-- handling。 --> | <!-- required behavior / preserve boundary / proof-only / not applicable。 --> | <!-- 不引入 scope 外 operation。 --> |

## State / Branch Coverage Matrix

| State ID | State / Branch | Trigger Into | Runtime Obligation | Observable UI / API Outcome | Data/Event Facts | Allowed Next States | Terminal? | Default Path Policy | External Boundary | Scope Basis | Artifact Handling | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- ST-001 --> | <!-- loading / empty / disabled / success / failed / timeout / unauthorized 等。 --> | <!-- entry condition/event。 --> | <!-- 该 state/branch 的 scope-backed runtime behavior。 --> | <!-- visible/API outcome。 --> | <!-- DB/event/outbox/job facts。 --> | <!-- next states。 --> | <!-- yes/no。 --> | <!-- production/default path 是否必须真实及理由。 --> | <!-- provider/storage/network/env 等边界。 --> | <!-- SI/spec/design。 --> | <!-- handling。 --> | <!-- required behavior / preserve boundary / proof-only / not applicable。 --> | <!-- 不引入 scope 外 state。 --> |

## Async / Realtime Chain Matrix

| Chain ID | User/System Entry | Enqueue / Dispatch Fact | Worker / Consumer Fact | Domain Mutation | Event / Outbox Fact | Client Subscription / Readback | Rendered Terminal State | Failure Variant | Runtime Obligation | Default Path Policy | External Boundary | Scope Basis | Artifact Handling | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- CH-001 --> | <!-- user action/system job。 --> | <!-- queue/action dispatch；无异步时写 explicit no-enqueue fact。 --> | <!-- worker/consumer processing；无 worker 时写 explicit no-worker fact。 --> | <!-- domain/data change。 --> | <!-- event/outbox/log fact。 --> | <!-- SSE/poll/readback。 --> | <!-- success/failure terminal UI。 --> | <!-- failed/dispatch_failed/timeout 或 Not applicable。 --> | <!-- 该 chain 或 explicit no-async boundary 的 scope-backed runtime behavior。 --> | <!-- production/default path 是否必须真实及理由。 --> | <!-- provider/storage/network/env 等边界。 --> | <!-- SI/spec/design。 --> | <!-- handling。 --> | <!-- required behavior / preserve boundary / proof-only / not applicable。 --> | <!-- 不引入 scope 外 chain。 --> |

## Coverage Closure Checklist

- [ ] 每个 canonical runtime row 都有 scope basis、runtime obligation、observable fact、default path policy、external boundary、scope role 和 no-scope-expansion check。
- [ ] 每个 in-scope spec scenario、material design decision 和 proof handling item 都映射到至少一个 runtime row，或有 scope-backed not-applicable reason。
- [ ] 每个 runtime row ID 全局唯一，且只使用 `RS-###`、`OP-###`、`ST-###`、`CH-###` 格式。
- [ ] 本 artifact 不包含 AC checkbox、implementation task、VID 状态、Proof Slice 状态、测试文件、固定命令、evidence path 或 deposit status。
- [ ] 后续 `tasks.md` 必须只引用本 artifact 中已定义的 runtime rows 并分配 AC/proof ownership。
- [ ] 后续 `verification.md` 必须只引用本 artifact 中已定义的 runtime rows 并分配 VID/Proof Slice coverage。
