## Acceptance-Driven Coverage

<!--
本节是 source/spec/design 到 AC/task/proof 的覆盖索引，不是 executable work。
每个 obligation atom、requirement scenario 或 material design obligation 使用一行；不要用 aggregate rows 替代底层 atoms、scenarios 或 obligations 的覆盖。
所有 Implementation Task IDs 必须解析到下方实际 checkbox task；不要只引用 AC heading。
本节只回答“哪些 source-backed obligation 由哪些 AC/task/proof 覆盖”，不承载测试实现、执行入口、产物目录或沉淀状态。
-->

### Obligation Atom Coverage

| Global Atom ID | Artifact Projection | Atom Summary | Acceptance Slice IDs | Implementation Task IDs | Acceptance Proof |
| --- | --- | --- | --- | --- | --- |
| <!-- GA-0001；每行只能有一个 ID，不使用 GA-0001-GA-0010 这类 ranges，也不把多个 GA 放一格。 --> | <!-- spec-requirement / spec-guard / design-obligation / verification-obligation / contextual-only --> | <!-- 概述 source-backed obligation / preserve / forbidden-drift boundary。 --> | <!-- AC-001 --> | <!-- AC-001.1, AC-001.2；必须是实际实现 checkbox ID。 --> | <!-- 用户交互、API/data、worker/realtime、security、rendered layout 等 runtime proof 摘要。 --> |

### Requirement / Scenario Coverage

| Capability | Requirement | Scenario | Global Atom IDs | Artifact Projection Handling | Acceptance Slice IDs | Implementation Task IDs | Acceptance Proof |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- capability name --> | <!-- exact requirement name --> | <!-- exact scenario name --> | <!-- GA-0001, GA-0002；逐个枚举 exact IDs，不使用 ranges。 --> | <!-- spec-requirement scenario；或说明 spec-guard/design/verification atom 不伪造 scenario。 --> | <!-- AC-001 --> | <!-- AC-001.1 --> | <!-- scenario-level observable proof summary。 --> |

### Design Obligation Coverage

| Design Section | Design Obligation | Global Atom IDs | Artifact Projection Handling | Acceptance Slice IDs | Implementation Task IDs | Acceptance Proof |
| --- | --- | --- | --- | --- | --- | --- |
| <!-- exact design section / decision / gate item --> | <!-- material implementation、preservation 或 verification obligation。 --> | <!-- GA-0001, GA-0002, 或 Not applicable；逐个枚举 exact IDs，不使用 ranges。 --> | <!-- design-obligation / verification-obligation / spec-guard handling。 --> | <!-- AC-001 --> | <!-- AC-001.1 --> | <!-- design-obligation proof summary。 --> |

## Runtime Acceptance Index

<!--
本节是主 agent preflight 的轻量路由表，不是 executable work，也不是测试计划。
它只引用 runtime-acceptance.md 中已定义的 canonical runtime rows，并把 AC 路由到 provider/consumer dependency graph 和 runtime proof 摘要。
如果 change 不触及 runtime behavior，写明 Not applicable 和 source-backed 理由。
-->

### AC Runtime Ownership Index

| AC ID | Source Basis | Runtime Surface Rows | Operation Rows | State / Branch Rows | Async / Realtime Rows | Provides Rows | Consumes Rows | Depends On AC IDs | Prerequisite Runtime Facts | Start Gate | Scope Role | No-Scope-Expansion Check | Detail Matrix Rows | Runtime Proof Summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- AC-001 --> | <!-- GA-0001, spec scenario, design obligation。 --> | <!-- RS-001；必须已在 runtime-acceptance.md 定义。 --> | <!-- OP-001；必须已在 runtime-acceptance.md 定义。 --> | <!-- ST-001, ST-002；必须已在 runtime-acceptance.md 定义。 --> | <!-- CH-001 或 Not applicable；必须已在 runtime-acceptance.md 定义。 --> | <!-- 本 AC 完成后提供的 rows，例如 RS-001；没有则 None。 --> | <!-- 本 AC 消费的 baseline 或 earlier AC rows，例如 RS-003；没有则 None。 --> | <!-- AC-000 / AC-001 / None；只能引用前置 AC。 --> | <!-- baseline fact / earlier AC runtime fact / None。 --> | <!-- 可在 change 开始后执行 / 需 AC-000 完成后执行。 --> | <!-- required behavior / preserve boundary / proof-only / not applicable。 --> | <!-- 不引入 source 外 route/control/state/API/job/event/provider/storage/retry 等。 --> | <!-- RS-001, OP-001, ST-001, CH-001；必须均来自 runtime-acceptance.md。 --> | <!-- 本 AC 完成后应能观察到的 runtime proof 摘要；作为说明字段，不对应单独 task ID。 --> |

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
  Runtime Rows: <!-- 本 task 负责或最终 proof 覆盖的 RS-/OP-/ST-/CH- row IDs；必须已在 runtime-acceptance.md 定义；无 runtime 行为时写 Not applicable 并给出 source-backed 理由。 -->
  Acceptance: <!-- 此任务贡献证明的具体可验收行为，而不是 file-edit summary。 -->
  Source: <!-- 来自相关 GA register rows 的 source paths、line ranges 与 source rule。 -->
  Preserve: <!-- 必须保留的 module/data/API/auth/worker/UI/responsive/privacy/ops constraints。 -->
  Proof: <!-- 说明可观察 proof。用户可见操作必须证明 runtime interaction、API/data effect 和 reload/readback；static markup / data-testid / screenshot 只能补充。 -->
  Mock Policy: <!-- 说明 mock/sandbox/default path 规则；不得用 mock 替代 required runtime boundary。 -->

## Runtime Acceptance Projection

<!--
本节是 runtime-acceptance.md 到 AC/implementation checkbox 的投影，不属于 executable work section，也不是测试计划。
canonical runtime row 详情只在 runtime-acceptance.md 定义；本节只记录 owner AC、provider/consumer graph 和 start gate。
worker 的主要输入应是对应 AC section 加上它引用的 runtime-acceptance rows 和本 projection rows。
-->

### Runtime Row Ownership Projection

| Runtime Row ID | Row Type | Owner AC ID | Implementation Task IDs | Provides Rows | Consumes Rows | Depends On AC IDs | Start Gate | Projection Status | Blocker / Not-Applicable Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <!-- RS-001 --> | <!-- surface / operation / state-branch / async-realtime-chain --> | <!-- AC-001 / baseline / explicit-negative-boundary --> | <!-- AC-001.1 --> | <!-- RS-001 --> | <!-- baseline 或 earlier rows；没有则 None。 --> | <!-- None / AC-001 --> | <!-- 可直接开始 / 需前置 proof。 --> | <!-- projected / not-applicable / blocker --> | <!-- projected 时写 None；否则写 source-backed 理由。 --> |

### Provider / Consumer Projection

| Runtime Row ID | Provider | Consumers | Prerequisite Runtime Facts | Default Path / Mock Policy Projection | No-Scope-Expansion Projection |
| --- | --- | --- | --- | --- | --- |
| <!-- OP-001 --> | <!-- baseline / AC-001 / explicit-negative-boundary --> | <!-- AC-002, AC-003 或 None。 --> | <!-- baseline fact / earlier AC runtime fact / None。 --> | <!-- 从 runtime-acceptance.md default path policy 投影到本 AC 的约束。 --> | <!-- 从 runtime-acceptance.md no-scope check 投影到本 AC 的约束。 --> |
