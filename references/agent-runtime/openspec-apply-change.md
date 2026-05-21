# openspec-apply-change 运行约束

当执行或触发 `openspec-apply-change` 技能实施某个 OpenSpec change 时，必须遵守以下约束。

本文档面向当前默认 schema `production-obligation-atom-driven`。历史 change 如果在 `.openspec.yaml` 中显式声明旧 schema，可按其 schema instructions 兼容处理；新 schema 不得创建或依赖 `source-truth.md`、独立 `acceptance.md`、旧版 source coverage artifact、`change-source-map.md` 或任何 proposal 前置 source artifact。

## 执行入口

1. 严格先执行 `openspec-apply-change` 技能原有流程：选择 change、读取 `openspec status --change "<name>" --json`、读取 `openspec instructions apply --change "<name>" --json`，并从 apply instructions 中获取 `contextFiles`、进度、任务列表和动态指令。
2. 对 `production-obligation-atom-driven` schema，apply instructions 必须只要求 `tasks` 作为 apply requirement，并且 context files 应包含 `proposal.md`、delta specs、`design.md`、`tasks.md`。
3. 若新 change 的 apply instructions 仍要求 `source-truth`、`acceptance`、旧版 source coverage、`change-source-map` 或任何 proposal 前置 source artifact，必须暂停并修正 schema/config/artifacts，而不是按旧流程实现。
4. 主 agent 先读取 `tasks.md`，解析 `Acceptance-Driven Coverage`、`Runtime Acceptance Index`、所有 `AC-###` section、`Verification Appendix`、每个未完成 checkbox 的 `Source Atoms` / `Projection` / `Spec` / `Design` / `Runtime Rows` / `Test IDs` / `Acceptance` / `Source` / `Preserve` / `Proof` / `Mock Policy` trace 字段。
5. 主 agent 同时读取 proposal 的 `Change Atom Coverage Register`、artifact projection map、相关 specs 和 design。不要批量展开所有原始 source docs；只有任务 trace、coverage gate、冲突协调或 proof 失败定位需要时，才通过 `OGA-####` 注册的 source document + line range 定点读取。
6. 主 agent 在分派 worker 或开始实现前，必须构建 apply preflight index：
   - proposal register rows、direct atoms、guard/boundary atoms、artifact projection、source line ranges。
   - spec requirements/scenarios 及其 `OGA-####` 引用。
   - design obligations 及其 `OGA-####` 引用。
   - AC sections、AC-local execution contract fields、checkbox task IDs、trace fields、coverage table rows、AC-owned Test Items、proof/evidence requirements。
   - runtime acceptance index：每个 AC 的 source basis、runtime surface rows、operation rows、state/branch rows、async/realtime rows、Test IDs、scope role、no-scope-expansion check 和 detail matrix row references。
   - verification appendix：`Runtime Surface Inventory`、`Operation Coverage Matrix`、`State / Branch Coverage Matrix`、`Async / Realtime Chain Matrix`、`Test Evidence Matrix` 的 row IDs、source basis、scope role、runtime detail `AC IDs`、Test Evidence owning `AC ID`、Test IDs 和 no-scope-expansion checks。
   - 用户可见 operation matrix：按当前 schema `apply.instruction` 和 `tasks` artifact instructions 解析；运行文档不重新定义矩阵字段。
   - state/branch matrix：status、stage、loading、empty、disabled、locked、success、failure、retry/recovery、terminal outcome、auth/security branch、responsive variant 及其 required tests。
   - async/realtime chain matrix：queue、worker、provider、webhook、outbox、SSE、polling、storage 或 readback path 的 success/failure terminal proof。
   - test evidence matrix：Test ID、owning AC ID、fixed command、test file/name、layer、covered row IDs、default path 标记、fixture boundary、must-fail-before-implementation、canonical evidence directory、ledger file、CI runnable 标记和 evidence produced。
   - 每个 AC 的 evidence ledger targets：fixed commands、canonical `test-results/<change-slug>/<AC-ID>/<Test-ID>/` artifacts、browser/rendered artifacts、API/DB/job/storage/log/audit facts、default-production-path proof。
   - 语言门禁：未完成任务标题、Acceptance/Preserve/Proof/Mock Policy 等解释性字段值不得是英文主导文本。
7. 完成 change 选择、status / instructions 读取、context 解析、preflight index、coverage gate、语言门禁检查和进度展示后，才能分派 worker 或开始实现。

## Implementation + Acceptance Gates

1. **Gate 1 / Artifact 完整性**：`tasks.md` 必须包含 `## Acceptance-Driven Coverage`、三张 coverage 表、`## Runtime Acceptance Index`、所有 `AC-###` sections 和后置 `## Verification Appendix` 五张 runtime/test 矩阵；每个 AC section 必须包含 `Acceptance`、`Source Atoms`、`Projection`、`Spec`、`Design`、`Runtime Rows Owned`、`Test IDs`、`Test Items`、`No-Scope Boundary`、`Primary Proof`、`Required Evidence`、`Mock / Fixture Boundary`、`Mock Policy`；每个未完成 task 必须有包含 `Runtime Rows` 和 `Test IDs` 的完整 trace 字段。
2. **Gate 2 / 语言门禁检查**：checkbox task description、Acceptance、Preserve、Proof、Mock Policy 等 agent 填写的解释性内容必须是中文；固定字段名、ID、路径、命令和精确 requirement/scenario 名称可保持英文。
3. **Gate 3 / Obligation Atom 覆盖检查**：每个 direct `OGA-####` 必须在 `Obligation Atom Coverage` 中有一行，并带有与 proposal register 一致的 `Artifact Projection`，映射到 acceptance slice、implementation task、verification task、guard/design handoff 或 acceptance proof。Direct atom 指 proposal register 中来自 final change packet `Direct Owning Atoms` 的 atom。禁止 OGA ranges；`Obligation Atom Coverage` 每行只能一个 `OGA-####`，禁止 aggregate row 或多 ID 单元格；不得为纯 `design-obligation` 或 `verification-obligation` atom 伪造 spec scenario。
4. **Gate 4 / Coverage task ID 解析检查**：三张 coverage 表中的每个 `Implementation Task IDs` 和 `Verification Task IDs` 必须解析到实际 checkbox task。每个 AC section 必须至少有一个 final verification / acceptance checkbox，并被 `Primary Proof`、`Required Evidence` 和相关 coverage rows 引用。
5. **Gate 5 / Runtime model 覆盖检查**：`Verification Appendix` 中每个 mandatory row 必须有 source basis、scope role、AC ID、Test ID 和 no-scope-expansion check；每个 Test ID 必须绑定具体 covered row IDs，且只能归属一个 exact `AC-###`。每个 mandatory row 必须出现在 `Runtime Acceptance Index` 和 owning AC-local `Runtime Rows Owned` / task `Runtime Rows` 中。若 specs/design 中出现的 operation、state、branch、terminal outcome、async chain、failure/retry/recovery、auth/security branch 或 responsive variant 没有进入 verification appendix、runtime index 和 AC-local contract，必须先修订 tasks。
6. **Gate 6 / Design obligation 提取检查**：worker 在实现某个 task 前，必须从 task trace 指向的 design/source 片段中提取可执行设计义务 checklist，并读取当前 AC-local contract 引用的 runtime detail rows。若 design 义务比 task 摘要、AC-local rows 或 proof 更强，必须停止并报告 artifact mismatch。
7. **Gate 7 / 任务级 TDD 与 proof 检查**：worker 应优先按当前 AC-local `Test IDs` / `Test Items`、任务 `Test IDs` 和 `Proof:` 建立或补齐对应验证。实现完成前 proof 应能失败或暴露缺口；实现后必须通过 AC-owned Test ID 的 fixed command，并在 canonical evidence directory 产出 evidence。无法让 proof 与 task trace、AC-local runtime row 和 Test ID 对应时不得勾选。对用户可见操作，必须执行当前 schema 中定义的 runtime interaction / operation matrix proof；presence-only、static-only、API-only 或 broad command proof 不得单独支撑勾选。
8. **Gate 8 / 默认路径与 no-mock 检查**：凡 task 涉及 Route Handler、auth、session、DB、AI/provider、storage、queue、SSE、worker、external service adapter、env/config 或 deployment wiring，proof 必须覆盖真实导出、default dependency 或 default config。mock、stub、dependency injection、Playwright route intercept、fixture-only、手工注入 EventSource、直接 DB seed 或 isolated unit test 只能作为补充，除非 runtime matrix 明确说明该 row 是 source-compatible deterministic path 且另有测试覆盖被替换的 production boundary。
9. **Gate 9 / 验收强度与 evidence ledger 检查**：每个 AC section 的 final verification task 必须完成 `Primary Proof`、`Required Evidence`、AC-local runtime rows、Test IDs 和 Test Items，并在 `test-results/<change-slug>/<AC-ID>/<Test-ID>/` 产出 evidence ledger 记录。用户可见 AC 需要 browser-rendered evidence；backend/data/worker/storage/security AC 需要 API、DB、queue/job、asset、log、audit 或 authorization facts。涉及用户可见操作的 AC 必须按当前 schema 的 operation matrix 记录 evidence；涉及 state/branch/terminal outcome 的 AC 必须逐行记录状态进入条件、UI/API outcome、data/event facts 和 allowed next state；只记录“测试通过”或控件存在不足以完成验收。
10. **Gate 10 / 完成判定**：只有当 `tasks.md` 全部 checkbox 完成、三张 coverage 表、`Runtime Acceptance Index`、每个 AC-local contract 和 `Verification Appendix` 五张 runtime/test 矩阵都能回链到已完成任务和 proof、每个 AC 的 required evidence、canonical evidence directories 和 evidence ledger 都已产生，才可称为 ready for archive。

## 任务章节拆分

1. implementation worker 的分派单位是包含未完成 checkbox 的 `AC-###` 一级 section。
2. `Acceptance-Driven Coverage`、`Runtime Acceptance Index` 和 `Verification Appendix` 不属于开发任务章节；它们只作为主 agent preflight、分派裁剪和最终 audit 的 coverage/runtime/test 索引使用。
3. 不存在独立 Acceptance Phase。AC section 内的 final verification task 就是该 slice 的验收闭环。
4. 如果多个 AC section 必然修改同一文件或模块，主 agent 必须通过更细的文件 ownership、串行等待或明确集成步骤降低冲突。
5. 如果 preflight 发现某个 AC section 缺少 AC-local runtime ownership、final verification / acceptance checkbox，或 coverage/runtime/test 表只引用 AC heading 而没有具体 verification task ID，必须先修订 artifacts，不得让 worker 直接补代码绕过。

## Subagent 分派

1. 用户明确要求执行或继续执行 `openspec-apply-change` 技能时，该请求即代表用户显式授权并要求按本节使用 `worker` subagent 和 delegation，除非用户在同一请求中明确禁止 subagent。
2. `worker` subagent 必须串行执行。禁止一次性启动多个 worker；任一时刻最多只能有一个 worker 处于运行中。
3. 对每个包含未完成任务的 AC section，必须按顺序分别创建一个 `worker` subagent 进行开发，除非用户明确禁止 subagent 或运行环境不可用。前一个 worker 自然返回最终完成或明确 blocker 前，不得启动下一个 worker。
4. 每个 worker 只负责自己 AC section 内的任务和该 section 的验收 proof。
5. 启动 worker 时默认不要 fork 完整对话历史；使用显式任务包传递必要上下文。只有当该章节必须依赖当前对话中尚未写入文件的决策时，才允许 fork。
6. 启动 worker 时必须传入：
   - change 名称和 schema 名称。
   - `contextFiles` 路径清单。
   - proposal register 中与该 AC 相关的 `OGA-####` rows。
   - 对应 AC section 的完整 AC-local execution contract，包括 acceptance、runtime rows owned、Test IDs、Test Items、no-scope boundary、required evidence、mock/fixture boundary、mock policy 和每个 task trace。
   - 相关 specs/design 片段路径。
   - 与该 AC 相关的 coverage 表行。
   - 与该 AC 相关的 runtime detail rows：surfaces、operations、states/branches、async/realtime chains 和 test evidence rows。只传当前 AC 拥有或引用的 rows；不要把完整全局矩阵作为 worker 的主要执行输入。
   - 与该 AC 相关的 evidence ledger targets、canonical `test-results/<change-slug>/<AC-ID>/<Test-ID>/` evidence storage contract，以及 final verification / acceptance checkbox ID。
   - 与该 AC 相关的用户可见 operation matrix；若 tasks/spec/design 没有提供但 source atoms 描述了用户操作，worker 必须先报告 artifact proof gap。
   - 允许修改的代码范围或模块边界。
   - 任务状态更新要求：worker 完成并验证自己 AC section 内任务后，必须把对应 checkbox 从 `- [ ]` 更新为 `- [x]`；未完成、未验证、proof 不足、default path 未证明或存在 blocker 的任务不得勾选。
7. 必须明确告知 worker：实现前必须通过 linked `OGA-####` 定点读取原始 source docs 相关片段，并在最终回复中列出读取的 source windows；若发现 context 冲突、任务边界不清、trace 缺失、proof 不可执行、task 弱于 atoms/spec/design/source docs，必须停止猜测并标明 blocker。
8. 必须明确告知 worker：它不是唯一开发者，不得回滚或覆盖其他 agent / 用户的改动；遇到重叠文件或冲突风险必须适配现有改动并在最终回复中说明。
9. 必须明确告知 worker：完成任务时要执行 AC-owned Test Items 的 fixed command，并在 `test-results/<change-slug>/<AC-ID>/<Test-ID>/` 提供 evidence ledger 条目，包括命令、截图/DOM、API/DB/job/storage/log/audit facts、AC-local runtime row IDs、Test IDs 或 default-path proof；只报告“测试通过”不足以支撑勾选。`/tmp`、未复制的 runner 默认输出、agent 当场手工截图或口述路径不得作为最终 evidence。对用户可见操作，ledger 必须满足当前 schema 的 operation matrix proof；对状态/分支/异步链路，ledger 必须满足对应 AC-local State / Branch 和 Async / Realtime Chain rows。

## 主 Agent 职责

1. 主 agent 负责 orchestration：选择 change、读取 status / instructions、解析 context、按 AC section 串行分派 worker、逐个耐心等待 worker 自然返回结果、统一审查改动、执行最终 coverage/proof audit、汇总证据。
2. 主 agent 必须等待所有已分派 worker 的任务全部完成或明确 blocker 后，才能开始主 agent 自己的任务，包括统一审查、集成修复、额外测试、proof audit、tasks checkbox 更新和最终汇总。
3. 任一 worker 运行期间，主 agent 只能执行必要的编排等待和状态记录；不得读取新的实现上下文、审查未完成 diff、运行新的验证命令、修改代码、修改 artifacts、勾选任务或接手实现。
4. 主 agent 不得打断、停止、关闭或要求正在运行的 worker 提前回报；不得对运行中的 worker 发送 interrupt、close、stop 或等价指令。除非用户明确要求终止当前 apply 流程，否则必须等待 worker 自然返回最终完成或明确 blocker。
5. 主 agent 在 worker 开发期间不得替代某个已分派 AC section 完成实现。若 worker 返回明确 blocker，主 agent 必须先暂停继续分派后续 worker，并征得用户同意后才能接手相关实现。
6. 主 agent 应避免批量读取 docs；需要核对时只做与冲突协调、结果审查、任务勾选或 proof 失败定位直接相关的定点读取。
7. 统一 audit 至少确认：
   - 相关代码改动符合 AC section、task trace、Global Atom IDs、artifact projection、spec/design 和原始 source docs。
   - 每个已勾选 task 都有实现证据和 proof 证据。
   - 每个 AC section 的 primary proof 和 required evidence 已满足。
   - 三张 coverage 表的每一行都有已勾选任务、真实存在的 verification task ID、验证证据、artifact projection handling 和验收 proof。
   - `Runtime Acceptance Index` 每行都能解析到 owning AC、AC-local `Runtime Rows Owned`、checkbox `Runtime Rows`、Test IDs、Test Items 和 `Verification Appendix` detail rows。
   - `Verification Appendix` 五张 runtime/test 矩阵的每个 mandatory row 都有已勾选任务、真实存在且只归属一个 AC 的 Test ID、fixed command、验证证据、source basis 和 no-scope-expansion check。
   - 涉及 runtime wiring 的默认导出/default dependency/default config 已被验证。
   - 用户可见 operation matrix 已按当前 schema 形成真实交互测试或等价 browser-rendered runtime proof，并与 API/data/readback 断言闭环。
   - 每个 AC-local State / Branch row 已覆盖所有 source-backed status、stage、loading/empty/disabled、success/failure、retry/recovery、terminal outcome、auth/security branch 和 responsive variant；成功状态 proof 没有替代失败或其他独立终态 proof。
   - 每个 AC-local Async / Realtime Chain row 已覆盖 required success 和 relevant failure variants；没有用手工事件注入、route intercept、fixture snapshot、直接 DB seed 或 isolated unit test 作为唯一 proof 替代 required default path。
   - evidence ledger 覆盖每个 AC 的 required evidence；每个 ledger path 都位于 `test-results/<change-slug>/<AC-ID>/<Test-ID>/` 且文件真实存在，不存在只用 broad test command、临时路径或 agent 手工操作代替 source-equivalent proof 的 AC。
   - 不存在违反当前 schema proof strength 的 presence-only、static-only、API-only 或 broad-command 验收。
   - 未引入明显跨 AC 冲突。
8. 若验收 proof 失败揭示 proposal/spec/design/tasks 与 obligation atoms 不一致，主 agent 必须暂停代码修复并提出 artifact 更新；不得用实现绕过 artifact mismatch。

## 状态更新

1. task checkbox 由负责对应 AC section 的 worker 执行。
2. worker 只能勾选自己 section 内已经完成且满足 `Projection`、`Proof`、linked spec scenario、linked design obligation、default runtime path verification、`Preserve` 和 `Mock Policy` 约束的任务。
3. 主 agent 在统一 audit 中核对 worker 已勾选任务是否可信；若发现误勾选、proof 不足或 coverage 行未覆盖，必须指出并纠偏。
4. 不需要更新独立 acceptance status；AC 的通过状态由该 section 下所有任务完成、required evidence 产出、coverage audit 通过共同表示。

## 最终汇报

最终汇报必须包含：

- 已完成 AC sections 和任务。
- 每个 worker 的关键改动范围。
- `Acceptance-Driven Coverage` audit 结果。
- 每个 AC 的 primary proof、required evidence、canonical evidence directories、evidence ledger、截图/DOM/API/DB/job/log/audit 等证据。
- 执行的验证命令及结果。
- 未完成、被阻塞、未验证或需要用户决策的事项。

不得在所有 AC section proof 未完成时声称 ready to archive。
