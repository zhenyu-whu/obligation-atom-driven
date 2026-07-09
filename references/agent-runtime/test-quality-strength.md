# Test Quality Strength 运行约束

本文档是 `openspec-apply-change` test-worker 阶段的强制测试质量门禁。它只约束 test agent 的测试生成、测试执行和结果判定，不把旧 `tasks.md` 测试矩阵模式带回 schema artifact。

## 适用边界

1. test agent 必须在自身 Oracle Precheck 通过后读取并遵守本文档，再开始写测试。
2. test agent 的测试目标只能来自 `verificationTracePacket` 中的 `trace/verification.trace.json#/verification-slice-register` rows，以及 slice 引用的 `trace/runtime-acceptance.trace.json#/runtime-fact-register` rows。不得从 source/scope basis、tasks、Markdown、实现代码或 evidence 重新发明测试目标。
3. test-worker 默认禁止读取 `tasks.md`、`trace/tasks.trace.json`、AC checkbox、AC `Work` 或 task links；tasks 不得作为测试上下文、测试 oracle 来源或 proof sufficiency 依据。canonical runtime row truth 来自 `trace/runtime-acceptance.trace.json`。
4. Proof Slice 定义原子证明义务和 oracle。`proof-evidence-mode: durable-test` 的 slice 必须生成或确认持久测试；其它 mode 不生成测试代码，但必须记录非持久 proof evidence result。
5. `runtime` 是 Runtime Acceptance 的验收语义，不是测试层级、测试类型或默认测试目录。
6. 不得把具体执行计划、测试编号、固定命令、证据目录、CI 状态或回归沉淀状态写回 `tasks.md` 或 `verification.md`；verification 语义只来自 `trace/verification.trace.json`。
7. apply result 可以记录摘要；详细实际测试文件、实际命令、运行结果、非持久 evidence result、Runtime Row 与 Proof Slice 覆盖关系必须写入 `openspec-results/<change>/proof-test-map.json`。

## Proof Slice Rules

1. test agent 必须以 atomic Proof Slice 为测试生成/确认单位；不得写混合 browser/API/DB/provider/security 断言的大而全测试来覆盖多个独立分支。
2. 每个 Proof Slice 只能有一个 `Primary Runtime Row ID`、一个 `test-layer` 和一个 production owner；production owner 必须是单一 production code boundary token，不能是 owner list。
3. `Primary Runtime Row ID` 必须存在于该 slice 的 `Runtime Row IDs` 中，并作为 coverage/trace anchor；supporting rows 不能成为第二个 primary proof。
4. 同 owner、同 test-layer 的多个 durable Proof Slice 可以共享测试文件、fixture/helper 或参数化结构，但默认不得合并到同一个 primary `it` / `test`；每个 durable slice 必须有一个以 exact `PS-###` 开头的 primary test title。
5. slice 的 `oracle` 必须是单一原子行为断言，`assertion-shape` 必须对应一个清晰失败定位点。若 oracle 聚合 edit/delete/add、replay/mismatch、success/failure、retryable/non_retryable/empty_result、多个 viewport condition 或多个 security branches，test agent 必须输出 `Artifact Consistency Blocker`。
6. slice 必须声明 `runtime-fact-ids`、`proof-evidence-mode` 和 `planned-test-directory`，且每个 row ID 必须存在于 runtime-acceptance；slice 的 oracle、assertion shape、fixture boundary 和 evidence mode 只能来自 proposal/spec/design/runtime-acceptance/verification。
7. 如果 slice layer/owner 与代码 reality 不符，test agent 不得修改 verification trace 或 Markdown。oracle 不变且 source-compatible 的调整必须写入 apply result；否则输出 blocker。
8. repo-wide env/ops/workspace/forbidden-drift 检查不属于 production schema 的默认新测试义务；只有 proposal/spec/design 明确要求且能归入 production owner 时，才可作为 source/scope-backed negative/security slice。

## 分层强度

1. 每个 Proof Slice 必须选择能稳定证明 oracle 的最小充分证明层；对 durable slice，更高层 smoke、browser 或 broad command 不能替代可低层稳定断言；对 non-durable slice，broad workspace command 只能补充，不能替代明确的非持久 evidence result。
2. 纯规则、解析、校验、映射、脱敏、状态机优先使用 unit。
3. 组件状态、表单、编辑器交互、权限态、错误态和可交互 UI 状态优先使用 component。
4. Route handler、server action、DTO、auth/session、response/error contract 使用 route/API contract。route/API primary proof 必须触达实际 HTTP/controller/API entry/server action/RPC resolver 的入口边界，并覆盖 route params、body、status、response/error contract；直调 service 只能作为 `service-contract` 或 supporting proof，不能冒充 route/API proof。
5. 事务、幂等、索引、迁移、持久化 invariant 和 repository readback 使用 DB/integration。DB/integration primary proof 必须触达真实 repository、database、transaction、migration、constraint、readback 或 invariant path；in-memory repository、fake transaction 或 hand-written repository double 只能作为辅助 proof。
6. queue、worker、retry、补偿、job lifecycle 和 provider adapter 使用 worker/job integration。
7. SSE、订阅恢复、event projection 和 realtime readback 使用 realtime/SSE integration。
8. 跨页面真实用户路径、导航、提交后 rendered/readback 和浏览器专属行为使用 browser E2E。browser/e2e primary proof 必须运行真实 browser app path；若 API/后端完全由 Playwright route mock、MSW、fixture server 或静态 JSON 返回，则该 proof 只能归类为 mocked UI flow / component-level proof，除非另有配对真实后端 default-path proof 支撑 e2e oracle。
9. responsive、布局、视觉可读性和截图对比只在 oracle 确实是视觉或布局行为时使用 visual/responsive。
10. MUST NOT、未授权、越权、敏感字段、redaction、配置失败和跨边界负向 guard 使用 security/negative；不得把 repo-wide ops/workspace drift 当成默认新业务测试层。
11. 如果 `trace/verification.trace.json` 的 suggested layer 与实际最小充分层不一致，test agent 必须按 oracle 选择更合适的层，并在 apply result 说明理由；不得修改 verification trace 或 Markdown 适配当前实现。

## Test Placement Routing

1. 只有 `proof-evidence-mode: durable-test` 的 Proof Slice 需要持久测试落点。propose 阶段必须在 `verification-slice-register[]/planned-test-directory` 中规划目录级 glob；test agent 必须消费该 canonical planned directory。
2. 新增或修改的持久测试必须写入 planned-test-directory 所覆盖的外置 `tests/**` placement。不得写入 production source tree。
3. Layer 驱动的默认实践：`unit` 使用 `tests/unit/**`；`component` 使用 `tests/component/**`；`route/API` 使用 `tests/api/**` 或 `tests/contract/**`；`DB/integration` 使用 `tests/integration/**`；`contract` 使用 `tests/contract/**`；`worker/job` 使用 `tests/worker/**`；`realtime/SSE` 使用 `tests/integration/**`；`browser/e2e` 和 `visual/responsive` 使用 `tests/e2e/**`；`security/negative` 使用 `tests/security/**` 或能真实触达被测 boundary 的对应 layer 子树。
4. `Production Owner` 只用于 proof trace，是 production code boundary，不是测试目录、协作边界列表、runner selector 或 evidence 目录。
5. test-only helper、fixture、seed helper、readback helper 和 Playwright helper 应放在对应 `tests/**` support module 或测试文件同目录的 test-only helper；不得进入 production runtime 目录。
6. forbidden placement 一律 hard fail：`openspec-results/**`、`test-results/**`、`openspec/changes/**`、`tests/runtime/**`、一次性 `scripts/**`、production source tree 内随手新增的 `.test.*` / `.spec.*`、非外置 tests 的 `__tests__/**`。
7. 不得为了测试 seed、readback 或 observation 暴露产品 route handler、test-only API 或 production runtime import path。
8. 如果持久测试不被 root/package/CI entry 触达，test agent 必须修 runner include 或 package scripts，或报告 `Execution Failure`。
9. 新增或修改 runner include 时，不得加入 production source tree 下的 `.test.*`、`.spec.*` 或 `__tests__/**` 来触达错误落位。
10. broad workspace command 只能作为补充，不能替代持久测试的 focused/containing-suite command，也不能替代非持久 Proof Slice 的 evidence result。
11. durable primary test title 必须以 exact `PS-###` 开头，并且默认只包含这一个 PS ID。
12. 如果 planned-test-directory 与真实 repo layout 不可用，或实际最小充分层与 canonical planned directory 冲突，test agent 必须输出 `Artifact Consistency Blocker` 或在 source/scope-compatible 情况下请求 repair verification。

## Harness 要求

1. browser E2E 必须使用真实 browser runtime，例如 Playwright/WebDriver/Cypress 的 browser/context/page、locator/getByRole、click/fill/select/press/submit、DOM/readback/screenshot/trace assertion。
2. component 测试必须 mount/render 到交互式 DOM，并使用 screen/getByRole/label/text、userEvent/fireEvent 或框架交互 helper。
3. unit 测试不得触发真实 HTTP、浏览器 DOM、数据库事务、queue/worker、storage 或外部 provider side effect；跨越这些边界时必须改用对应 integration 层。
4. route/API 测试必须调用实际 HTTP/controller route handler、server action、API entry 或 RPC resolver。若只调用 service contract boundary，`actual-boundary` 必须记录为 `service-contract`，且不能作为 route/API primary proof，除非 oracle 本身明确只要求 service contract。
5. DB/integration 测试必须执行真实 database、repository、transaction、migration、constraint、readback 或 invariant path。若使用 in-memory repository、fake adapter、stub transaction 或 hand-written harness，必须记录为 `fake-repository` / `fake-transaction` 并提供 paired default-path proof，否则不能标为 `Passed`。
6. contract、worker/job、realtime/SSE、visual/responsive 和 security/negative 必须分别证明对应 production-compatible boundary；只证明 mock、fixture、静态文件存在或 broad command 通过不算 primary proof。
7. 每个 durable primary test 必须在 `proof-test-map.json` 对应 `proof-test-results[]/proof-quality` 记录 `intended-layer`、`actual-boundary`、`entrypoint`、`mock-replacements`、`paired-default-path-proof`、`assertion-style` 和 `quality-status`。`quality-status=passed` 只能用于 actual boundary 与 intended layer 相符，或 mock/fake 替代已有配对 default-path proof 的情况。
8. 上述字段共同构成 `Test Boundary Quality Audit`；缺少该审计记录时，测试命令通过也不能作为 durable Proof Slice 的 `Passed` 依据。

## Oracle 质量

1. 测试断言必须来自 proposal/specs/design/runtime-acceptance/verification 的外部行为契约，不能写成匹配当前实现输出的循环证明。
2. 测试应具备重构稳定性：只要外部契约不变，重命名私有函数、重排内部组件、拆分 service 或替换实现算法时测试不应失败。
3. 不得把私有 helper、mock 调用次数、非契约 DOM 层级、className、快照全文、`data-testid` 存在、按钮 presence-only、静态 markup、源文件文本扫描或 artifact/config/text scan 作为 required behavior primary proof。
4. 不得用 `JSON.stringify(...).toContain(...)`、字符串包含片段、序列化 payload 扫描、mock response 被渲染出来、CSS class 或 DOM 层级作为结构化 contract primary proof；必须改用结构化对象断言、schema/DTO contract、role/label/readback 或 oracle 明确要求的可观察信号。
5. Presence-only 只能证明元素存在，不能证明权限、保存、校验、持久化、路由或安全 oracle；除非 Proof Slice oracle 明确就是 presence/absence contract，否则必须补充行为或 readback 断言。
6. 每个 durable Proof Slice 默认对应一个 primary test case。互相独立的 operation、state、failure/retry、auth/security、layout、observability、fixture variant、viewport 或 redaction branch 必须拆成独立 test case 或参数化展开 case。
7. 一个 `it` / `test` 不得串联多个独立 Proof Slice 或独立分支来伪装覆盖；失败信号必须能定位到对应 Proof Slice 或行为分支。

## Mock 与 Fixture

1. Mock 只能隔离外部、慢速、非确定性或不可控边界；不得断言 mock 行为本身，也不得把 mock 预置结果当成被测 runtime boundary 的证明。
2. Fixture 只能提供输入数据、凭证/claims、外部返回、确定性时间或环境；不能替代被测 runtime boundary 的默认实现。
3. 涉及 route、auth、session、provider、storage、queue、worker、env 或 config default path 时，测试必须区分 fixture data 与 production-compatible boundary proof，并在 `proof-quality.mock-replacements` 中列出被替换边界。
4. 采用配对证明策略：mock/fake 不硬性禁用，但如果替换了 primary runtime boundary，必须有同层或配对真实 default-path proof，并在 `proof-quality.paired-default-path-proof` 中引用 `PS-###` 或 `command:<summary>`；没有配对证明时 `quality-status` 必须为 `needs-paired-proof` 或 `insufficient`，不得输出 `Passed`。
5. 不得为了测试方便向 production code 增加 test-only API、扩大 public contract、绕过授权/持久化/锁/幂等路径，或把 `NODE_ENV=test` 专用路径当成 default path proof。
6. 如果某个 mock/fixture 替换了真实 side effect，test agent 必须用同层或配对 default-path proof 补偿，或输出 blocker/failure。

## 持久测试与运行入口

1. 对 durable slice，新增或修改的测试必须放在 `planned-test-directory` 下的长期 test/spec 文件中。
2. 对 non-durable slice，test agent 不生成测试代码，不得写入 `proof-test-results[]`；必须按 `proof-evidence-mode` 执行或确认对应非持久 evidence，并在 `proof-test-map.json` 的 `proof-evidence-results[]` 中记录 `slice-id`、`proof-evidence-mode`、`status`、实际命令和退出码，或 manual environment completion reason。
3. `readiness-command`、`build-command`、`codegen-command`、`compose-config-readback` 和 `static-boundary-readback` 的 `passed` evidence 必须记录实际 command 且 exit status 为 0；`manual-environment` 必须记录 source/scope-backed manual reason 和完成状态。
4. test agent 必须运行能实际触达相关持久测试或非持久 evidence 的命令，并在 apply result 记录命令、退出状态和关键结果。
5. broad workspace command 可以作为补充，但不能替代能定位相关 oracle 的持久测试命令或非持久 evidence result。
6. 新增测试 runner、测试目录或 browser E2E spec 时，必须确认 root/package/CI entry 能真实触达持久测试。
7. 修改 `process.env`、global fetch、时间、随机源、log sink、cookie/session、数据库、文件系统输出或 mock registry 时必须恢复或隔离。
8. test agent 必须生成或更新 `openspec-results/<change>/proof-test-map.json`，并运行 `node openspec/agent-runtime/scripts/audit-proof-test-mapping.mjs --change <change>`；audit 未通过时不得输出 `Passed`。

## 执行稳定性门禁

1. `browser/e2e` 和 `visual/responsive` 的 `Passed` 必须同时具备 slice 级 primary proof 命令和 containing spec / related suite / workspace 级复跑证据。
2. 新增或修改 Playwright / visual responsive spec 时，必须完成稳定性探测：同一 containing-file / related-suite 命令连续两次通过，或一次 `repeat-each >= 3` 且 `workers=1` 的通过复跑。
3. `proof-test-map.json` 中的 `browser/e2e` 和 `visual/responsive` result 必须记录 `execution-scope`、`validation-runs[]` 和 `flake-status`。
4. `validation-runs[]` 是当前 evidence 的最终验收记录，不得在同一 `Passed` result 下混入非零退出码或 failed/timed-out validation run。
5. Playwright / visual responsive 测试必须先等待契约态稳定，再执行坐标、drag、截图和布局断言。
6. Playwright / visual responsive fixture 必须隔离 page/context、storage、session、service worker、DB seed、realtime subscription 和 mock registry。

## 结果判定

1. `Passed`：对 durable Proof Slice，标准测试已生成或确认存在，满足本文档质量门禁，实际命令通过，实际测试路径落在 canonical `planned-test-directory` 下且不在 forbidden placement，runner/entry 能触达该测试，`proof-test-map.json` 记录 exactly-one primary test、`proof-quality.quality-status` 为 `passed` 且 mapping audit 通过；对 non-durable Proof Slice，`proof-test-map.json` 记录 exactly-one `proof-evidence-results[]` 且 status 为 passed 或 manual environment completed，并且没有 `proof-test-results[]`。
2. `Authoring Blocker`：无法按本文档生成标准测试，原因是生产代码缺少合适 public/runtime boundary、稳定 observable surface、可控 dependency boundary、错误信号，或只能通过 implementation-detail/static/artifact proof 覆盖。
3. `Execution Failure`：标准测试已经能按本文档生成，oracle 表达正确，但测试命令失败、runner/entry 未触达、环境隔离失败或生产行为不满足 oracle。
4. `Artifact Consistency Blocker` 仍只限 test-worker Oracle Precheck 定义的 artifact/oracle 问题；当前实现不支持 oracle、测试难写或测试失败都不是 artifact consistency blocker。
5. `Authoring Blocker` 和 `Execution Failure` 都必须进入 fix agent；test agent 不得通过弱化 oracle、改成实现细节测试、跳过 Proof Slice 或只跑 broad smoke 来消化失败。
