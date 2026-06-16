## Acceptance-Driven Coverage

<!--
本节是 proposal/spec/design 到 AC/task/proof 的覆盖索引，不是 executable work。
每个 scope item、requirement scenario 或 material design decision 使用一行；不要用 aggregate rows 替代底层 scope items、scenarios 或 decisions 的覆盖。
所有 Implementation Task IDs / Acceptance Proof Task IDs 必须解析到下方实际 checkbox task；不要只引用 AC heading。
本节只回答“哪些 scope-backed obligation 由哪些 AC/task/proof 覆盖”，不承载测试实现、执行入口、产物目录或沉淀状态。
-->

### Scope Item Coverage

| Scope Item ID | Artifact Handling | Scope Summary | Acceptance Slice IDs | Implementation Task IDs | Acceptance Proof Task IDs | Acceptance Proof |
| --- | --- | --- | --- | --- | --- | --- |
| <!-- SI-001；每行只能有一个 ID，不使用 SI-001-SI-010 这类 ranges，也不把多个 SI 放一格。 --> | <!-- spec / guard / design / proof / context --> | <!-- scope item 摘要。 --> | <!-- AC-001 --> | <!-- AC-001.1, AC-001.2；必须是实际 checkbox ID。 --> | <!-- AC-001.3；必须是实际 checkbox ID，表示验收 proof checkbox，不是测试编号。 --> | <!-- 用户交互、API/data、worker/realtime、security、rendered layout 等 runtime proof 摘要。 --> |

### Requirement / Scenario Coverage

| Capability | Requirement | Scenario | Scope Item IDs | Artifact Handling | Acceptance Slice IDs | Implementation Task IDs | Acceptance Proof Task IDs | Acceptance Proof |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- capability name --> | <!-- exact requirement name --> | <!-- exact scenario name --> | <!-- SI-001, SI-002；逐个枚举 exact IDs，不使用 ranges。 --> | <!-- spec scenario / guard / design / proof handling。 --> | <!-- AC-001 --> | <!-- AC-001.1 --> | <!-- AC-001.3 --> | <!-- scenario-level observable proof summary。 --> |

### Design Decision Coverage

| Design Section | Design Decision | Scope Item IDs | Artifact Handling | Acceptance Slice IDs | Implementation Task IDs | Acceptance Proof Task IDs | Acceptance Proof |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- exact design section / decision / gate item --> | <!-- material implementation、preservation 或 proof-relevant decision。 --> | <!-- SI-001, SI-002, 或 Not applicable；逐个枚举 exact IDs，不使用 ranges。 --> | <!-- design / guard / proof / spec handling。 --> | <!-- AC-001 --> | <!-- AC-001.1 --> | <!-- AC-001.3 --> | <!-- design decision proof summary。 --> |

## Runtime Acceptance Index

<!--
本节是主 agent preflight 的轻量路由表，不是 executable work，也不是测试计划。
它只引用 runtime-acceptance.md 中已定义的 canonical runtime rows，并把 AC 路由到 provider/consumer dependency graph 和验收 proof checkbox。
如果 change 不触及 runtime behavior，写明 Not applicable 和 scope-backed 理由。
-->

### AC Runtime Ownership Index

| AC ID | Scope Basis | Runtime Surface Rows | Operation Rows | State / Branch Rows | Async / Realtime Rows | Provides Rows | Consumes Rows | Depends On AC IDs | Prerequisite Runtime Facts | Start Gate | Scope Role | No-Scope-Expansion Check | Detail Matrix Rows | Acceptance Proof Task IDs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- AC-001 --> | <!-- SI-001, spec scenario, design decision。 --> | <!-- RS-001；必须已在 runtime-acceptance.md 定义。 --> | <!-- OP-001；必须已在 runtime-acceptance.md 定义。 --> | <!-- ST-001, ST-002；必须已在 runtime-acceptance.md 定义。 --> | <!-- CH-001 或 Not applicable；必须已在 runtime-acceptance.md 定义。 --> | <!-- 本 AC 完成后提供的 rows，例如 RS-001；没有则 None。 --> | <!-- 本 AC 消费的 baseline 或 earlier AC rows，例如 RS-003；没有则 None。 --> | <!-- AC-000 / AC-001 / None；只能引用前置 AC。 --> | <!-- baseline fact / earlier AC runtime fact / None。 --> | <!-- 可在 change 开始后执行 / 需 AC-000 完成后执行。 --> | <!-- required behavior / preserve boundary / proof-only / not applicable。 --> | <!-- 不引入 scope 外 route/control/state/API/job/event/provider/storage/retry 等。 --> | <!-- RS-001, OP-001, ST-001, CH-001；必须均来自 runtime-acceptance.md。 --> | <!-- AC-001.3；必须是实际 checkbox ID。 --> |

<!-- 每个 AC section 是人工审阅和 worker 执行的主要入口；Appendix 是 runtime 明细来源。 -->
<!-- 每个 checkbox task block（checkbox + Scope Items/Artifact Handling/Spec/Design/Runtime Rows/Acceptance/Baseline/Preserve/Proof/Mock Policy trace fields）与下一个 checkbox task block 之间必须保留一个空行；不要在同一 task block 的 trace fields 之间插入空行。 -->

## AC-001 <!-- 中文验收切片名称 -->

Acceptance:
- <!-- 用户/系统可观察的验收行为。必须能从 proposal/spec/design/scope items 推导，不从实现计划反推。 -->

Scope Items:
- <!-- SI-001, SI-002；逐个枚举 exact IDs，不使用 ranges。 -->

Artifact Handling:
- <!-- linked SI IDs 的 artifact handling；例如 SI-001: spec。 -->

Spec:
- <!-- Capability / Requirement / Scenario names。 -->

Design:
- <!-- Design sections / decisions。 -->

Runtime Rows Owned:
- <!-- RS-001, OP-001, ST-001, CH-001；只列 runtime-acceptance.md 中已定义的 row IDs。 -->

Prerequisites:
- <!-- 本 AC 启动前必须完成的 AC IDs 或 baseline/runtime facts；无依赖时写 None 并说明只依赖 baseline。 -->

Provides:
- <!-- 本 AC 完成后为后续 AC 提供的 runtime surfaces / operations / states / contracts / proof facts；没有则写 None。 -->

Consumes:
- <!-- 本 AC proof 消费的 baseline 或 earlier AC rows / contracts / facts；消费 current-change row 时必须能回到 Prerequisites。 -->

Start Gate:
- <!-- 进入本 AC 的执行门禁，例如“AC-000.3 已完成，RS-003 已由 earlier AC 提供”。 -->

No-Scope Boundary:
- <!-- 明确本 AC 不得引入 scope 外 route/control/state/API/job/event/provider/storage/retry/lifecycle 行为。 -->

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
  Scope Items: <!-- exact SI IDs，逐个枚举，不使用 ranges；无 scope-backed 行为的 repository/setup task 写 Not applicable 并给出理由。 -->
  Artifact Handling: <!-- linked SI IDs 的 handling；如有多个，逐个列出。 -->
  Spec: <!-- Requirement / scenario names。 -->
  Design: <!-- Design section / decision。 -->
  Runtime Rows: <!-- 本 task 负责或最终 proof 覆盖的 RS-/OP-/ST-/CH- row IDs；必须已在 runtime-acceptance.md 定义；无 runtime 行为时写 Not applicable 并给出 scope-backed 理由。 -->
  Acceptance: <!-- 此任务贡献证明的具体可验收行为，而不是 file-edit summary。 -->
  Baseline: <!-- 来自 proposal baseline/input read set、spec/design 的既有行为或输入事实。 -->
  Preserve: <!-- 必须保留的 module/data/API/auth/worker/UI/responsive/privacy/ops constraints。 -->
  Proof: <!-- 说明可观察 proof。用户可见操作必须证明 runtime interaction、API/data effect 和 reload/readback；static markup / data-testid / screenshot 只能补充。 -->
  Mock Policy: <!-- 说明 mock/sandbox/default path 规则；不得用 mock 替代 required runtime boundary。 -->

<!-- 每个 AC section 必须至少包含一个 final acceptance/proof checkbox，例如 AC-001.N。该 checkbox 必须出现在本节 Required Evidence、coverage tables 的 Acceptance Proof Task IDs 和最终 apply result 中。 -->

## Runtime Acceptance Projection

<!--
本节是 runtime-acceptance.md 到 AC/checkbox 的投影，不属于 executable work section，也不是测试计划。
canonical runtime row 详情只在 runtime-acceptance.md 定义；本节只记录 owner AC、provider/consumer graph、start gate 和 proof checkbox。
worker 的主要输入应是对应 AC section 加上它引用的 runtime-acceptance rows 和本 projection rows。
-->

### Runtime Row Ownership Projection

| Runtime Row ID | Row Type | Owner AC ID | Implementation Task IDs | Acceptance Proof Task IDs | Provides Rows | Consumes Rows | Depends On AC IDs | Start Gate | Projection Status | Blocker / Not-Applicable Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- RS-001 --> | <!-- surface / operation / state-branch / async-realtime-chain --> | <!-- AC-001 / baseline / explicit-negative-boundary --> | <!-- AC-001.1 --> | <!-- AC-001.3 --> | <!-- RS-001 --> | <!-- baseline 或 earlier rows；没有则 None。 --> | <!-- None / AC-001 --> | <!-- 可直接开始 / 需前置 proof。 --> | <!-- projected / not-applicable / blocker --> | <!-- projected 时写 None；否则写 scope-backed 理由。 --> |

### Provider / Consumer Projection

| Runtime Row ID | Provider | Consumers | Prerequisite Runtime Facts | Default Path / Mock Policy Projection | No-Scope-Expansion Projection |
| --- | --- | --- | --- | --- | --- |
| <!-- OP-001 --> | <!-- baseline / AC-001 / explicit-negative-boundary --> | <!-- AC-002, AC-003 或 None。 --> | <!-- baseline fact / earlier AC runtime fact / None。 --> | <!-- 从 runtime-acceptance.md default path policy 投影到本 AC 的约束。 --> | <!-- 从 runtime-acceptance.md no-scope check 投影到本 AC 的约束。 --> |

### Projection Closure Checklist

- [ ] 每个 `runtime-acceptance.md` 中 required / preserve / proof-only runtime row 都有 owner AC 和 acceptance proof checkbox，或 explicit blocker/not-applicable reason。
- [ ] 本文件没有定义新的 RS-/OP-/ST-/CH- row；所有 row ID 都能在 `runtime-acceptance.md` 中找到。
- [ ] 每个 projected row 的 default path、mock policy 和 no-scope boundary 与 `runtime-acceptance.md` 一致。
- [ ] 本 projection 不包含测试文件、固定命令、VID 状态、Proof Slice 状态、evidence path 或 deposit status。
