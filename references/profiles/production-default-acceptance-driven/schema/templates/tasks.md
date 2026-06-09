## Acceptance-Driven Coverage

<!--
本节是 proposal/spec/design 到 AC/task 的覆盖索引，不是 executable work。
每个 material scope item、requirement scenario 或 material design decision 使用一行；不要用 aggregate rows 替代底层 scope items、scenarios 或 decisions。
所有 Implementation Task IDs / Verification Task IDs 必须解析到下方实际 checkbox task；不要只引用 AC heading。
-->

### Scope Item Coverage

| Scope Item ID                                                          | Artifact Handling                                | Scope Summary                                             | Acceptance Slice IDs | Implementation Task IDs                               | Verification Task IDs                       | Acceptance Proof                                                                                                                    |
| ---------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------- | -------------------- | ----------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| <!-- SI-001；每行只能有一个 ID，不使用 SI-001-SI-010 这类 ranges。 --> | <!-- spec / guard / design / proof / context --> | <!-- 概述行为、preserve 或 stable negative boundary。 --> | <!-- AC-001 -->      | <!-- AC-001.1, AC-001.2；必须是实际 checkbox ID。 --> | <!-- AC-001.3；必须是实际 checkbox ID。 --> | <!-- user interaction、API test、data assertion、worker/realtime path、security check、rendered layout check 等 proof summary。 --> |

### Requirement / Scenario Coverage

| Capability               | Requirement                     | Scenario                     | Scope Item IDs                                               | Artifact Handling                       | Acceptance Slice IDs | Implementation Task IDs | Verification Task IDs | Acceptance Proof                                   |
| ------------------------ | ------------------------------- | ---------------------------- | ------------------------------------------------------------ | --------------------------------------- | -------------------- | ----------------------- | --------------------- | -------------------------------------------------- |
| <!-- capability name --> | <!-- exact requirement name --> | <!-- exact scenario name --> | <!-- SI-001, SI-002；逐个枚举 exact IDs，不使用 ranges。 --> | <!-- spec scenario / guard handling --> | <!-- AC-001 -->      | <!-- AC-001.1 -->       | <!-- AC-001.3 -->     | <!-- scenario-level observable proof summary。 --> |

### Design Decision Coverage

| Design Section                                       | Design Decision                                                           | Scope Item IDs                                                                  | Artifact Handling                      | Acceptance Slice IDs | Implementation Task IDs | Verification Task IDs | Acceptance Proof                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------- | -------------------- | ----------------------- | --------------------- | ---------------------------------------- |
| <!-- exact design section / decision / gate item --> | <!-- material implementation、preservation 或 verification decision。 --> | <!-- SI-001, SI-002, 或 Not applicable；逐个枚举 exact IDs，不使用 ranges。 --> | <!-- design / proof / guard / spec --> | <!-- AC-001 -->      | <!-- AC-001.1 -->       | <!-- AC-001.3 -->     | <!-- design decision proof summary。 --> |

## Runtime Acceptance Index

<!--
本节是主 agent preflight 的轻量路由表，不是 executable work，也不是 runtime/test 详情来源。
它只把 AC 路由到 Appendix 中的 row IDs、Test IDs 和 AC dependency graph；不要在这里重复 fixed commands、证据目录、ledger、fixture 或 row 详情。
如果 change 不触及 web/runtime behavior，写明 Not applicable 和理由。
Test IDs 必须使用 exact `T-###`，不得带 AC 编号、测试名称、slug 或字母后缀。
-->

### AC Runtime Ownership Index

| AC ID           | Scope Basis                                       | Runtime Surface Rows | Operation Rows  | State / Branch Rows     | Async / Realtime Rows               | Test IDs              | Provides Rows                                                | Consumes Rows                                                                 | Depends On AC IDs                                  | Prerequisite Test IDs                                 | Start Gate                                               | Scope Role                                                                     | No-Scope-Expansion Check                                                               | Detail Matrix Rows                               |
| --------------- | ------------------------------------------------- | -------------------- | --------------- | ----------------------- | ----------------------------------- | --------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------ |
| <!-- AC-001 --> | <!-- SI-001, spec scenario, design decision。 --> | <!-- RS-001 -->      | <!-- OP-001 --> | <!-- ST-001, ST-002 --> | <!-- CH-001 或 Not applicable。 --> | <!-- T-001, T-002 --> | <!-- 本 AC 完成后提供的 rows，例如 RS-001；没有则 None。 --> | <!-- 本 AC 消费的 baseline 或 earlier AC rows，例如 RS-003；没有则 None。 --> | <!-- AC-000 / AC-001 / None；只能引用前置 AC。 --> | <!-- T-000 / T-001 / None；只能引用前置 Test ID。 --> | <!-- 可在 change 开始后执行 / 需 AC-000 完成后执行。 --> | <!-- required behavior / preserve boundary / proof-only / not applicable。 --> | <!-- 不引入 scope 外 route/control/state/API/job/event/provider/storage/retry 等。 --> | <!-- RS-001, OP-001, ST-001, CH-001, T-001。 --> |

## AC-001 <!-- 中文验收切片名称 -->

Acceptance:

- <!-- 用户/系统可观察的验收行为。必须能从 proposal/spec/design 推导，不从实现计划反推。 -->

Scope Items:

- <!-- SI-001, SI-002；逐个枚举 exact IDs，不使用 ranges。 -->

Artifact Handling:

- <!-- linked SI IDs 的 handling；例如 SI-001: spec。 -->

Spec:

- <!-- Capability / Requirement / Scenario names。 -->

Design:

- <!-- Design sections / decisions。 -->

Runtime Rows Owned:

- <!-- RS-001, OP-001, ST-001, CH-001；只列 row IDs，row 详情只在 Verification Appendix 中定义。 -->

Test IDs:

- <!-- T-001, T-002；只列本 AC 拥有的 Test IDs，必须匹配 exact T-###。 -->

Prerequisites:

- <!-- 本 AC 启动前必须完成的 AC IDs、Test IDs 或 baseline facts；无依赖时写 None 并说明只依赖 baseline。 -->

Provides:

- <!-- 本 AC 完成后为后续 AC 提供的 runtime surfaces / operations / states / contracts / proof facts；没有则写 None。 -->

Consumes:

- <!-- 本 AC proof 消费的 baseline 或 earlier AC rows / contracts / facts；消费 current-change row 时必须能回到 Prerequisites。 -->

Start Gate:

- <!-- 进入本 AC 的执行门禁，例如“AC-000.3 与 T-000 已完成，RS-003 已由 earlier AC 提供”。 -->

No-Scope Boundary:

- <!-- 明确本 AC 不得引入的 scope 外 route/control/state/API/job/event/provider/storage/retry/lifecycle 行为。 -->

Primary Proof:

- <!-- 人类可读的最高强度验收证明摘要。用户可见行为优先 browser/E2E/rendered proof；后端行为优先 API/DB/job/storage/security facts。 -->

Required Evidence:

- Test evidence: <!-- T-001, T-002；fixed commands、evidence directories、execution artifacts 和 optional ledger files 只在 Test Evidence Matrix 中维护。 -->
- Browser / rendered evidence: <!-- screenshot / DOM / responsive / a11y / interaction evidence 的类型和验收意图。 -->
- Data / API / job / storage evidence: <!-- DB rows / API response / queue status / asset facts / logs / audit facts 的类型和验收意图。 -->
- Optional audit ledger: <!-- 如生成 ledger.json，仅作为 apply/reviewer/archive 审计收据；本处只说明可选 ledger 汇总哪些事实类别，不能替代执行证据。 -->

Mock / Fixture Boundary:

- <!-- AC-level default path / mock 原则摘要；逐 Test ID 的 fixture boundary 只在 Test Evidence Matrix 中定义。 -->

Mock Policy:

- <!-- 哪些允许 sandbox/mock；哪些必须走 default production wiring。 -->

- [ ] AC-001.1 <!-- 用中文描述此 acceptance slice 下的具体实现或验证任务。 -->
      Trace: <!-- 默认写 inherits AC-001；只有当本 task 的 scope/spec/design/no-scope/mock 边界比 AC 更窄或有例外时才展开 override。 -->
      Runtime Rows: <!-- 本 task 负责或最终验证覆盖的 RS-/OP-/ST-/CH- row IDs；无 runtime 行为时写 Not applicable 并给出理由。 -->
      Test IDs: <!-- 本 task 建立、维护或由 final verification 执行的 T-### row IDs；不得带名称后缀。 -->
      Acceptance: <!-- 此任务贡献证明的具体可验收行为。 -->
      Proof: <!-- proof 摘要。用户可见操作必须证明 runtime interaction、API/data effect 和 reload/readback；static markup / data-testid / screenshot 只能补充。 -->
      Overrides: <!-- 若不继承 AC-level source/no-scope/mock boundary，在此列 exact override；否则写 None。 -->

## Verification Appendix

<!--
本节是 runtime/test 明细的唯一事实来源，不属于 executable work section。
Runtime detail rows 只在对应矩阵定义；AC section、Runtime Acceptance Index 和 checkbox tasks 只引用 row IDs。
Test Evidence Matrix 是 fixed command、test file/name、evidence directory、execution artifacts、optional ledger file、fixture boundary 和 CI runnable 状态的唯一事实来源。
Test Layer Plan 是分层测试体系的唯一事实来源；不要只用一个 smoke/browser proof 覆盖可低层稳定断言的规则、表单状态、API contract、DB invariant 或安全边界。
TDD red/green gate 依据 `openspec/schemas/shared/tdd-regression-gates.md`；required behavior 测试必须证明 red failure reason 正确，再用 green command 证明实现成功。
Testing Quality Core 不可选：Test Layer Plan、Test Evidence Matrix、TDD red/green fields 和 Regression Test Deposit 必须始终存在。
runtime detail matrices 可按需最小化；只有在 proposal/spec/design/tasks 均不触及对应 runtime 行为时，Runtime Surface / Operation / State / Async 矩阵才可保留最小 Not applicable 行并说明 scope-backed 理由。
最终完成不是表格声明：每个完成的 Test ID 必须有当前 worktree 的 fixed/green/regression command 证据、canonical `command.log` 或 runner/CI result/report、AC evidence gate `validate_tasks_quality.py --ac <AC-###> --evidence` 通过，以及 final `validate_tasks_quality.py --final` 通过或明确 blocker；optional `ledger.json` 存在时必须满足 `openspec/schemas/shared/evidence-ledger.schema.json` 且与执行证据一致。
-->

### Runtime Surface Inventory

| Surface ID      | Surface Type                                                                                          | Owner                               | Entry Point                              | Default Path Required      | External Boundary                              | Scope Basis                                         | Artifact Handling                                  | Scope Role                                                                     | Provider AC ID                                            | Consumer AC IDs                   | AC IDs            | Test IDs         | No-Scope-Expansion Check           |
| --------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------- | -------------------------- | ---------------------------------------------- | --------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- | --------------------------------- | ----------------- | ---------------- | ---------------------------------- |
| <!-- RS-001 --> | <!-- UI route / client component / API / DB / worker / queue / SSE / storage / auth / config 等。 --> | <!-- module/component/service。 --> | <!-- route/action/job/stream entry。 --> | <!-- yes/no + reason。 --> | <!-- provider/storage/network/env 等边界。 --> | <!-- SI-001 / spec scenario / design decision。 --> | <!-- spec / guard / design / proof / context。 --> | <!-- required behavior / preserve boundary / proof-only / not applicable。 --> | <!-- baseline / AC-001 / explicit-negative-boundary。 --> | <!-- AC-002, AC-003 或 None。 --> | <!-- AC-001。 --> | <!-- T-001。 --> | <!-- 不引入 scope 外 surface。 --> |

### Operation Coverage Matrix

| Operation ID    | Trigger                                            | Control / Route                | Request / Action                          | Expected Rendered UI Update | API/Data Assertion                 | Reload/Persistence Assertion           | Disabled/Failure/Recovery Branches              | Scope Basis               | Artifact Handling   | Scope Role      | Provider AC ID                                            | Consumer AC IDs           | AC IDs            | Test IDs         | No-Scope-Expansion Check             |
| --------------- | -------------------------------------------------- | ------------------------------ | ----------------------------------------- | --------------------------- | ---------------------------------- | -------------------------------------- | ----------------------------------------------- | ------------------------- | ------------------- | --------------- | --------------------------------------------------------- | ------------------------- | ----------------- | ---------------- | ------------------------------------ |
| <!-- OP-001 --> | <!-- click/type/select/submit/system trigger。 --> | <!-- UI control or route。 --> | <!-- handler/action/API/job request。 --> | <!-- rendered result。 -->  | <!-- response/data invariant。 --> | <!-- reload/readback persistence。 --> | <!-- disabled/failure/retry/recovery rows。 --> | <!-- SI/spec/design。 --> | <!-- handling。 --> | <!-- role。 --> | <!-- baseline / AC-001 / explicit-negative-boundary。 --> | <!-- AC-002 或 None。 --> | <!-- AC-001。 --> | <!-- T-001。 --> | <!-- 不引入 scope 外 operation。 --> |

### State / Branch Coverage Matrix

| State ID        | State / Branch                                                                       | Trigger Into                     | Observable UI / API Outcome    | Data/Event Facts                     | Allowed Next States    | Terminal?         | Scope Basis               | Artifact Handling   | Scope Role      | Provider AC ID                                            | Consumer AC IDs           | AC IDs            | Test IDs         | No-Scope-Expansion Check         |
| --------------- | ------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------ | ------------------------------------ | ---------------------- | ----------------- | ------------------------- | ------------------- | --------------- | --------------------------------------------------------- | ------------------------- | ----------------- | ---------------- | -------------------------------- |
| <!-- ST-001 --> | <!-- loading / empty / disabled / success / failed / timeout / unauthorized 等。 --> | <!-- entry condition/event。 --> | <!-- visible/API outcome。 --> | <!-- DB/event/outbox/job facts。 --> | <!-- next states。 --> | <!-- yes/no。 --> | <!-- SI/spec/design。 --> | <!-- handling。 --> | <!-- role。 --> | <!-- baseline / AC-001 / explicit-negative-boundary。 --> | <!-- AC-002 或 None。 --> | <!-- AC-001。 --> | <!-- T-001。 --> | <!-- 不引入 scope 外 state。 --> |

### Async / Realtime Chain Matrix

| Chain ID        | User/System Entry                 | Enqueue / Dispatch Fact          | Worker / Consumer Fact                | Domain Mutation               | Event / Outbox Fact              | Client Subscription / Readback | Rendered Terminal State                | Failure Variant                                             | Scope Basis               | Artifact Handling   | Scope Role      | Provider AC ID                                            | Consumer AC IDs           | AC IDs            | Test IDs         | No-Scope-Expansion Check         |
| --------------- | --------------------------------- | -------------------------------- | ------------------------------------- | ----------------------------- | -------------------------------- | ------------------------------ | -------------------------------------- | ----------------------------------------------------------- | ------------------------- | ------------------- | --------------- | --------------------------------------------------------- | ------------------------- | ----------------- | ---------------- | -------------------------------- |
| <!-- CH-001 --> | <!-- user action/system job。 --> | <!-- queue/action dispatch。 --> | <!-- worker/consumer processing。 --> | <!-- domain/data change。 --> | <!-- event/outbox/log fact。 --> | <!-- SSE/poll/readback。 -->   | <!-- success/failure terminal UI。 --> | <!-- failed/dispatch_failed/timeout 或 Not applicable。 --> | <!-- SI/spec/design。 --> | <!-- handling。 --> | <!-- role。 --> | <!-- baseline / AC-001 / explicit-negative-boundary。 --> | <!-- AC-002 或 None。 --> | <!-- AC-001。 --> | <!-- T-001。 --> | <!-- 不引入 scope 外 chain。 --> |

### Test Layer Plan

| AC ID           | Behavior / Boundary                                        | Scope Basis               | Required Layers                                                                                                        | Test IDs By Layer                                                                                                                                                                                                           | Omitted Layers / Reason                                                                           | Primary Proof Layer                                                                                            | Regression Entry                                                    | No-Scope-Expansion Check                           |
| --------------- | ---------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| <!-- AC-001 --> | <!-- 外部行为、preserve boundary 或 proof-only guard。 --> | <!-- SI/spec/design。 --> | <!-- unit / component / route/API contract / DB integration / browser E2E / security/negative / config/ops/check。 --> | <!-- 每个 Required Layer 必须有独立 exact T-###，例如 unit: T-001；component: T-002；browser E2E: T-003。同一 T-### 不得出现在多个 required layer；smoke/browser 只能填自己的真实层级，不能填作 unit/component/API/DB。 --> | <!-- 被省略的适用层必须写 scope-backed 理由；不要只写“已有 smoke 覆盖”或“需要真实 readback”。 --> | <!-- 最终验收主 proof 层，例如 browser E2E + DB integration；主 proof 可以跨层，但各层必须有独立 Test ID。 --> | <!-- root/package/CI 可触达的最小回归入口；未接入时写 blocked。 --> | <!-- 不用单一 smoke 替代可低层稳定断言的行为。 --> |

<!--
测试层级代码要求：
- unit：纯规则、解析/校验、映射、脱敏、状态机或 adapter contract；不得触发真实 HTTP、浏览器 DOM、DB、queue 或 storage side effect。
- component：必须 mount/render 到可交互 component harness，并用 role/label/text/query + user event 或真实 DOM event 证明表单、权限、pending/disabled、错误/恢复；静态 markup、snapshot、reducer/state-machine 只能是 supplemental。
- route/API contract：必须调用实际 route handler、server action、API entry、RPC resolver 或 service contract boundary，并断言 status/DTO/error/auth/privacy/default wiring。
- DB/integration：必须覆盖真实 DB/repository/transaction/migration/readback/invariant path；mock repository 或 SQL 字符串检查不算。
- worker/job integration：必须覆盖 enqueue/consume 或 processor boundary、retry/idempotency/terminal mutation/log/audit fact。
- realtime/SSE integration：必须覆盖 event/outbox/SSE/polling/subscription/readback chain 和 event shape/order/terminal state。
- browser E2E：必须使用 Playwright/WebDriver/Cypress 或等价真实 browser/page/context，执行 goto/click/fill/select/press/submit 等用户动作并断言 rendered DOM/readback/URL/screenshot/trace；tests/e2e 目录和直接 import route/repository/state machine 都不自动算 browser E2E。
- visual/responsive：必须用真实浏览器 viewport、screenshot、bounding box、pixel/layout/accessibility proof。
- security/negative：必须证明未授权、越权、MUST NOT、敏感字段、redaction、asset access、audit/log 或隐私边界。
- config/ops/check：只能证明稳定 config/env/build/migration/deployment/static gate，不替代行为层测试。
-->

### Test Evidence Matrix

| Test ID                                                                         | AC ID                                                      | Fixed Command                                                                    | Test File / Name                                                                                                                                                                                                                                                                                                                                                                                                               | Layer                                                                                                                                                                                                                                              | Covers Rows                               | Default Path?              | Fixture Boundary                                                   | Must Fail Before Implementation                                      | Red Command                                                                    | Expected Red Failure                                                       | Observed Red Failure                                                           | Green Command                                            | TDD Status                                                                                                    | Requires Tests Passed                                   | Evidence Directory                                                                         | Evidence Produced                                                                                         | Ledger File                                                      | CI Runnable?                                                   | Scope Basis               | Artifact Handling   | Scope Role      | No-Scope-Expansion Check            |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------- | ------------------- | --------------- | ----------------------------------- |
| <!-- T-001；必须匹配 exact T-###，禁止 T-005B / T-AC005-... / T-001-smoke。 --> | <!-- AC-001；只能有一个 AC ID，禁止多个 AC 或 shared。 --> | <!-- 最小固定命令；不得用 `pnpm test -- <file> -t <name>` 或 `pnpm test:e2e -- ...` 透传 selector；需要 filter 时用 `pnpm exec vitest ... <file> -t <name>`、Playwright 直接命令或专用 script。 --> | <!-- test file / stable test name or filter；永久测试代码按 production owner 放置：unit/domain -> packages/<domain>/src/**，DB -> packages/db/**，API route -> apps/web/app/api/**，component -> 对应 app/package，browser E2E -> tests/e2e/**，runtime/ops guard -> tests/runtime/**；browser E2E 必须真实启动 browser/page，不得只是 route handler/repository/state machine 直调；禁止 tests/<change-slug-prefix>/**、openspec/changes/** 或 test-results/**。同一文件覆盖多层时用不同 Test ID + stable filter 拆行。 --> | <!-- 只能写单一层级：unit / component / route/API contract / DB integration / worker/job integration / realtime/SSE integration / browser E2E / visual/responsive / security/negative / config/ops/check。直接 import route/repository/state machine 的 tests/e2e 文件不是 browser E2E；静态 render 或纯状态机不是 component 交互 primary proof。 --> | <!-- RS-001, OP-001, ST-001, CH-001。 --> | <!-- yes/no + reason。 --> | <!-- mocked/sandboxed segments and paired default-path proof。 --> | <!-- yes/no + expected failing gap；required behavior 默认 yes。 --> | <!-- red 阶段固定命令；通常与 Fixed Command 相同，必须可从仓库根目录重跑且真实定位本 Test ID。 --> | <!-- 预期失败缺口，必须来自 SI/spec/design/runtime row，不是测试错误。 --> | <!-- 实际失败摘要和 evidence path；失败原因必须匹配 Expected Red Failure。 --> | <!-- green 阶段重跑命令；通常与 Fixed Command 相同。 --> | <!-- red-required / red-observed / green-passed / not-applicable / blocked；完成时不能停留 red-required；deposited required behavior 必须是 green-passed，禁止 red-green 等非枚举状态。 --> | <!-- None / T-000；只能引用 earlier AC 的 Test ID。 --> | <!-- `test-results/<change-slug>/AC-001/T-001/`；最后一级目录必须与 Test ID 完全一致。 --> | <!-- command.log 或 runner/CI result/report、green-result.json/regression-result.json、red/green failure trace、DOM/screenshot、trace、API/DB/job/log facts；optional ledger 可列为 audit receipt，但不能替代执行证据。 --> | <!-- 可留空；若生成 optional audit ledger，写 `test-results/<change-slug>/AC-001/T-001/ledger.json`，字段名使用 acId，不使用 ac，可用 write_evidence_ledger.py 辅助生成。 --> | <!-- yes + root/package/CI entry；或 no + blocker reason。 --> | <!-- SI/spec/design。 --> | <!-- handling。 --> | <!-- role。 --> | <!-- 不引入 scope 外 behavior。 --> |

### Regression Test Deposit

<!--
本表记录可长期维护的回归测试沉淀，不替代 Test Evidence Matrix 的验收 evidence。
每个 required behavior Test ID 完成时必须为 deposited，或以 blocked / not-applicable 给出 scope-backed 理由；required 只表示计划，不能作为完成状态。
deposited 表示永久测试文件或稳定 smoke/e2e/ops 入口已存在，regression command 已由当前 green/final evidence 证明可重跑；不能只登记计划路径或一次性 evidence-only 文件。
永久测试文件必须按 production owner 放置，不得按 change slug 聚合；`test-results/<change-slug>/...` 只保存 evidence，不保存测试代码。
永久回归命令必须是最小可重跑命令，并能通过 root/package script、CI job、稳定 test file/filter 或已登记 smoke/e2e/ops script 触达。
smoke/e2e/ops 只能沉淀其真实层级；不得用一个 evidence-only smoke 脚本代表 unit/component/API/DB/security。若同一文件包含多层测试，必须用独立 Test ID、稳定 test name/filter 和独立 regression command 区分。
-->

| AC ID           | Test IDs                                                                                   | Permanent Test File                                                                                                                                                                                                                    | Regression Command                                                                                                                 | Behavior Contract                                   | Assertion Oracle                                                                    | Fixture Boundary                                              | CI Tier                                                                            | Not Testing                                                                         | Deposit Status                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| <!-- AC-001 --> | <!-- T-001；可列同一 AC 的多个 exact T-###，但每个 Test ID 必须已有独立 Evidence row。 --> | <!-- 仓库内按 production owner 放置的长期维护 test/spec/smoke/e2e 文件；unit/domain 不放 tests/<change-slug-prefix>，应靠近 packages/apps owner；browser E2E 入口必须真实使用 browser runtime；不得只指向临时 evidence-only smoke 代表低层测试；not-applicable 时写 N/A + 理由。 --> | <!-- 最小可重跑命令，例如 package-level test、稳定 file/filter 或登记 smoke/e2e/ops script；不要只写 broad workspace command；不得用 `pnpm test* -- ...` 透传 selector 伪装成精确命令。 --> | <!-- 来自 proposal/spec/design 的外部行为契约。 --> | <!-- 断言依据：用户可见结果、API contract、DB invariant、安全边界、错误分支等。 --> | <!-- 允许的 fixture/mock 和必须保留 default path 的边界。 --> | <!-- PR-fast / PR-integration / nightly / release / manual-staging；说明入口。 --> | <!-- 明确不测的实现细节，例如私有函数、调用次数、DOM 层级、样式类名、快照全文。 --> | <!-- required / deposited / not-applicable / blocked；完成时 required 不可保留；deposited required behavior 必须对应 green-passed，not-applicable 或 blocked 必须含 scope-backed reason。 --> |
