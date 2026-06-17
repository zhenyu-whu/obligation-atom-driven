# Test Quality Strength 运行约束

本文档是 `openspec-apply-change` Phase 3 的强制测试质量门禁。它只约束 test agent 的测试生成、测试执行和结果判定，不把旧 `tasks.md` 测试矩阵模式带回 schema artifact。

## 适用边界

1. test agent 必须在 Phase 2 Oracle Precheck 通过后读取本文档，再开始写测试。
2. test agent 的测试目标只能来自 `verification.md` 的 required VID、Proof Slice Matrix、Runtime Coverage Reconciliation 及其 proposal/specs/design/runtime-acceptance source basis。
3. `tasks.md` 只能作为生产实现和 runtime acceptance projection 的上下文，不得作为测试 oracle 来源；canonical runtime row truth 来自 `runtime-acceptance.md`。
4. VID 定义业务 oracle，不是 test case；Proof Slice 是 test agent 的测试生成和确认单位。
5. `runtime` 是 Runtime Acceptance 的验收语义，不是测试层级、测试类型或默认测试目录。
6. 不得把具体执行计划、测试编号、固定命令、证据目录、CI 状态或回归沉淀状态写回 `tasks.md` 或 `verification.md`；`verification.md` 只承载测试意图、oracle、Proof Slice、层级理由、harness 预期和 mock/fixture/default-path 边界。
7. apply result 可以记录实际测试文件、实际命令、运行结果、Runtime Row、VID 与 Proof Slice 覆盖关系、blocker 和 not-applicable reason。

## Proof Slice Rules

1. test agent 必须以 atomic Proof Slice 为测试生成/确认单位；不得直接按 VID 写混合 browser/API/DB/provider/security 断言的大而全测试。
2. 每个 Proof Slice 只能有一个 `Primary Runtime Row ID`、一个 primary layer 和一个 production owner；production owner 必须是单一 production code boundary token，不能是 owner list；不同 primary runtime row 或不同 primary layer 不得混成一个 primary proof。
3. `Primary Runtime Row ID` 必须存在于该 slice 的 `Runtime Row IDs` 中，并表示单一 operation、state、failure/retry、auth/security、layout 或 observability branch；`Runtime Row IDs` 可以包含必要 supporting rows，但 supporting rows 不能成为第二个 primary proof。
4. 同 owner、同 primary layer 的多个 Proof Slice 可以合并到同一测试文件或参数化结构，但不得串联到同一个 `it` / `test` 中伪装覆盖多个独立 branches；失败信号必须能定位到对应 slice。
5. slice 必须声明 `Runtime Row IDs`，且每个 row ID 必须存在于 `runtime-acceptance.md`；slice 的 oracle fragment、primary assertion shape 和 fixture/mock boundary 只能来自 verification/proposal/spec/design/runtime-acceptance；test agent 不得新增 oracle 或扩大 source/scope。
6. 如果 slice layer/owner 与代码 reality 不符，test agent 不得修改 `verification.md`。oracle 不变且 source-compatible 的调整必须写入 apply result；否则输出 blocker。
7. repo-wide env/ops/workspace/forbidden-drift 检查不属于 production schema 的默认新测试义务；只有 proposal/spec/design 明确要求且能归入 production owner 时，才可作为 source/scope-backed negative/security slice。

## 分层强度

1. 每个 required VID 必须选择能稳定证明 oracle 的最小充分测试层；更高层 smoke、browser 或 broad command 不能替代可低层稳定断言。
2. 纯规则、解析、校验、映射、脱敏、状态机优先使用 unit。
3. 组件状态、表单、编辑器交互、权限态、错误态和可交互 UI 状态优先使用 component。
4. Route handler、server action、DTO、auth/session、response/error contract 使用 route/API contract。
5. 事务、幂等、索引、迁移、持久化 invariant 和 repository readback 使用 DB/integration。
6. queue、worker、retry、补偿、job lifecycle 和 provider adapter 使用 worker/job integration。
7. SSE、订阅恢复、event projection 和 realtime readback 使用 realtime/SSE integration。
8. 跨页面真实用户路径、导航、提交后 rendered/readback 和浏览器专属行为使用 browser E2E。
9. responsive、布局、视觉可读性和截图对比只在 oracle 确实是视觉或布局行为时使用 visual/responsive。
10. MUST NOT、未授权、越权、敏感字段、redaction、配置失败和跨边界负向 guard 使用 security/negative；不得把 repo-wide ops/workspace drift 当成默认新业务测试层。
11. 如果 `verification.md` 的 suggested layer 与实际最小充分层不一致，test agent 必须按 oracle 选择更合适的层，并在 apply result 说明理由；不得修改 `verification.md` 适配当前实现。

## Test Placement Routing

1. test agent 必须根据 Proof Slice 的单一 `Production Owner + Primary Layer` 决定测试落位；owner 是 production code 边界，不是测试目录、协作边界列表或 evidence 目录。
2. `unit` / `contract` / domain contract 优先放 `packages/<pkg>/src/__tests__` 或 `packages/<pkg>/tests`。
3. `DB/integration` 优先放 `packages/db/tests`。
4. `route/API`、web integration、component 优先放 `apps/web/tests/api`、`apps/web/tests/integration` 或 `apps/web/tests/component`。
5. `browser/e2e`、`visual/responsive` 优先放 `apps/web/tests/e2e`。
6. `worker/job` 优先放 `apps/worker/tests`。
7. `security/negative` 优先归单一被测 production owner；跨页面或跨系统安全流程才归单一 e2e app owner。不得用多个 owner 表示跨边界协作。
8. `tests/runtime/**` 不作为新业务测试目标；只保留历史测试或 source/scope-backed 手动迁移对象。
9. 如果 owner-near tests 不被 root/package/CI entry 触达，test agent 必须修 runner include 或 package scripts，或报告 `Execution Failure`；不得为了通过 runner discovery 把 owner-near 测试移动到 `tests/runtime/**`。
10. broad workspace command 只能作为补充，不能替代 owner-near 测试命令和 slice 级覆盖。

## Harness 要求

1. browser E2E 必须使用真实 browser runtime，例如 Playwright/WebDriver/Cypress 的 browser/context/page、`page.goto`、locator/getByRole、click/fill/select/press/submit、DOM/readback/screenshot/trace assertion。
2. component 测试必须 mount/render 到交互式 DOM，并使用 screen/getByRole/label/text、userEvent/fireEvent 或框架交互 helper；`renderToStaticMarkup`、字符串 DOM、snapshot 不能作为 component primary proof。
3. unit 测试不得触发真实 HTTP、浏览器 DOM、数据库事务、queue/worker、storage 或外部 provider side effect；跨越这些边界时必须改用对应 integration 层。
4. route/API 测试必须调用实际 route handler、server action、API entry、RPC resolver 或 service contract boundary，并构造 Request、session/auth/context、payload 和错误分支。
5. DB/integration 测试必须执行真实 database、repository、transaction、migration、constraint、readback 或 invariant path，并隔离 schema、事务或测试数据。
6. contract、worker/job、realtime/SSE、visual/responsive 和 security/negative 必须分别证明对应 production-compatible boundary；只证明 mock、fixture、静态文件存在或 broad command 通过不算 primary proof。

## Oracle 质量

1. 测试断言必须来自 proposal/specs/design/runtime-acceptance/verification 的外部行为契约，不能写成匹配当前实现输出的循环证明。
2. 测试应具备重构稳定性：只要外部契约不变，重命名私有函数、重排内部组件、拆分 service 或替换实现算法时测试不应失败。
3. 不得把私有 helper、mock 调用次数、非契约 DOM 层级、className、快照全文、`data-testid` 存在、按钮 presence-only、静态 markup、源文件文本扫描或 artifact/config/text scan 作为 required behavior primary proof。
4. 一个测试可以自然覆盖多个 VID 或 Proof Slice，但必须保持同一 production owner、同一 primary layer、同一 primary runtime row 或同一不可分割 runtime 行为；互相独立的 operation、state、failure/retry、auth/security、layout 或 observability branch 必须拆成独立 test case 或稳定 filter。
5. 一个 `it` / `test` 不得串联多个独立 Proof Slice 或独立分支来伪装覆盖；失败信号必须能定位到对应 Proof Slice、VID 或行为分支。

## Mock 与 Fixture

1. Mock 只能隔离外部、慢速、非确定性或不可控边界；不得断言 mock 行为本身。
2. Fixture 只能提供输入数据、凭证/claims、外部返回、确定性时间或环境；不能替代被测 runtime boundary 的默认实现。
3. 涉及 route、auth、session、provider、storage、queue、worker、env 或 config default path 时，测试必须区分 fixture data 与 production-compatible boundary proof。
4. 不得为了测试方便向 production code 增加 test-only API、扩大 public contract、绕过授权/持久化/锁/幂等路径，或把 `NODE_ENV=test` 专用路径当成 default path proof。
5. 如果某个 mock/fixture 替换了真实 side effect，test agent 必须用同层或配对 default-path proof 补偿，或输出 blocker/failure。

## 持久测试与运行入口

1. 新增或修改的测试应按单一 `Production Owner + Primary Layer` 放在对应 production owner 附近的长期 test/spec 文件中；跨页面 e2e、visual/responsive 放 app owner 的 e2e 入口。协作依赖写入 harness/mock/default-path 说明，不改变 owner。不得只放在 `tests/runtime/**`、`openspec-results/**`、`test-results/**`、`openspec/changes/**` 或一次性脚本中。
2. test agent 必须运行能实际触达相关测试的命令，并在 apply result 记录命令、退出状态和关键结果。
3. broad workspace command 可以作为补充，但不能替代能定位相关 oracle 的测试命令；只执行 discovery/listing 或错误 runner 不算通过。
4. 新增测试 runner、测试目录或 browser E2E spec 时，必须确认 root/package/CI entry 能真实触达；无法接入时不得输出 `Passed`。
5. 修改 `process.env`、global fetch、时间、随机源、log sink、cookie/session、数据库、文件系统输出或 mock registry 时必须恢复或隔离，避免污染后续测试。

## 结果判定

1. `Passed`：required atomic Proof Slice 的标准测试已生成或确认存在，满足本文档质量门禁，实际命令通过，且 runner/entry 能触达 owner-near 测试；required VID 的所有 required slices 都满足后，该 VID 才可汇总为 `Passed`；required runtime row 的所有 required VID/Proof Slice 都满足后，该 row 才可汇总为 covered。
2. `Authoring Blocker`：无法按本文档生成标准测试，原因是生产代码缺少合适 public/runtime boundary、稳定 observable surface、可控 dependency boundary、错误信号，或只能通过 implementation-detail/static/artifact proof 覆盖。
3. `Execution Failure`：标准测试已经能按本文档生成，oracle 表达正确，但测试命令失败、runner/entry 未触达、环境隔离失败或生产行为不满足 oracle。
4. `Artifact Consistency Blocker` 仍只限 Phase 2 定义的 artifact/oracle 问题；当前实现不支持 oracle、测试难写或测试失败都不是 artifact consistency blocker。
5. `Authoring Blocker` 和 `Execution Failure` 都必须进入 fix agent；test agent 不得通过弱化 oracle、改成实现细节测试、跳过 VID 或只跑 broad smoke 来消化失败。
