# openspec-archive-change 运行约束

## 默认行为

- 当执行或触发 `openspec-archive-change` 技能归档已完成 change，且未指定 change 名称时，先运行 `openspec list --json`。如果活跃 change 只有一个，则默认选择该 change 继续归档流程，不再额外要求用户确认选择；如果存在多个活跃 change、无活跃 change，或上下文与列表结果冲突，必须停下向用户确认。
- 归档前仍需读取 `openspec status --change "<name>" --json`、确认 `schemaName`、检查 `tasks.md` 完成度，并评估 `openspec/changes/<name>/specs/` 下的 delta specs 是否需要同步。检查结果中的非阻断性警告应在最终汇总中说明，但默认不要求二次确认。
- 如果归档目标是旧 schema，按该 change 自身 schema instructions 兼容处理；不得把 `source-truth.md`、独立 `acceptance.md`、旧版 source coverage artifact、`change-source-map.md` 或任何 proposal 前置 source artifact 要求带入两个生产 schema 的 change。

## Schema-aware 归档门禁

- 对 `production-obligation-atom-driven` schema，归档前必须额外检查 `tasks.md` 的 `Acceptance-Driven Coverage`：`Obligation Atom Coverage` 每行只能有一个 exact `GA-####` 且 `Artifact Projection` 与 proposal register 一致，三张 coverage 表的 task ID 均能解析到已完成 checkbox，每个 AC 的 final verification / acceptance task 已完成，并且 execution evidence 覆盖相关 `GA-####` 的 projection/proof 义务。
- 对 `production-default-acceptance-driven` schema，归档前必须额外检查 `tasks.md` 的 `Acceptance-Driven Coverage`：`Scope Item Coverage` 每行只能有一个 exact `SI-###` 且 `Artifact Handling` 与 proposal `Change Scope Coverage` 一致，`Requirement / Scenario Coverage` 和 `Design Decision Coverage` 的 task ID 均能解析到已完成 checkbox，每个 AC 的 final verification / acceptance task 已完成，并且 execution evidence 覆盖相关 `SI-###` 的 handling/proof 义务。
- 两个生产 schema 归档前都必须检查 Testing Quality Core：`Test Layer Plan`、`Test Evidence Matrix`、verification evidence fields 和 `Regression Test Deposit`。每个 required behavior Test ID 都必须有永久回归文件或稳定测试入口、最小回归命令、behavior contract、assertion oracle、fixture boundary、CI tier 和 `Not Testing` 边界；`not-applicable` 行必须有 source/scope-backed 理由；`blocked` 是无法完成验证的证据状态，不是归档成功状态。不得用 smoke/browser proof 替代可低层稳定断言的 unit/component/API/DB/security 等层级。每个 Test ID 的测试代码必须满足其 `Layer` 的 code requirements：browser E2E 要真实 browser/page/context + 用户动作/readback，component 要交互式 component harness，route/API、DB、worker、SSE、visual、security、ops 要证明各自 production-compatible boundary；目录名、文件名或截图存在不能提升层级。
- 两个生产 schema 都必须检查 `Runtime Acceptance Index`、AC-local contract 和 `Verification Appendix` 六张 runtime/test 矩阵能回链到已完成任务、fixed commands、canonical evidence directories、verification evidence 和 execution evidence；Test ID 必须匹配 exact `T-[0-9]{3}`，不得带 AC 编号、slug、名称或字母后缀。无 runtime 行为的 runtime detail matrix 只能保留 source/scope-backed `Not applicable` 最小行。每个 completed Test ID 的 canonical evidence directory 必须至少包含 `command.log` 或 runner/CI result/report；等价 CI evidence 必须包含可审计 runner/CI result/report。`deposited` required behavior 必须通过当前 worktree 的 execution evidence 证明通过，或证明 regression command 与已通过的 fixed command 等价。固定命令不得用 `pnpm test* -- ...` 透传 file/filter 作为 Test ID selector。归档 evidence ownership 以 worker、change-stabilizer 或 CI artifact collector 的 canonical 输出为准；测试侧 artifact 可通过 runner attachment/report、框架 output directory 或记录的 artifact directory 被收集和保存。归档 final gate 中不得存在 `planned`、`blocked`、缺失 execution evidence 或未闭合 deposit 的 required behavior。
- 归档前必须确认每个已完成 AC 已执行 AC evidence audit，change-stabilizer 已执行全量 Testing Quality Core final audit：逐项检查 Test Evidence Matrix、Regression Test Deposit、canonical evidence directory、fixed command 结果、Evidence Status 和 execution evidence。不得跳过 Testing Quality Core；只读 final-reviewer 报告不再作为归档前置门禁，若已有 final-reviewer 报告可作为补充参考，但缺少 final-reviewer 报告本身不得阻止归档。

## 同步与归档

- 如果 delta specs 存在且同步评估显示主 specs 需要新增或修改，默认执行“同步并归档”：优先使用 `openspec archive "<name>" -y` 完成 spec 更新与归档；如果 CLI 不可用或自动同步失败，再按 `openspec-sync-specs` 技能手动同步后归档。
- 只有遇到冲突或高风险状态时才向用户确认，包括但不限于：多个候选 change、归档目标目录已存在、delta spec 与主 spec 无法明确合并、存在未完成任务、coverage 表存在 orphan `GA-####` / `SI-###`、proof/execution evidence 不足、canonical `command.log` 或 runner/CI result/report 缺失、Regression Test Deposit 缺失或不可信、`deposited` 只登记计划路径、命令失败、校验失败，或归档会覆盖/删除非目标文件。
- 归档完成后必须运行 `openspec validate --specs --strict --json`，并汇总 change 名称、schema、归档路径、spec 同步结果、任务完成情况、schema-aware coverage audit、runtime/proof/evidence audit、Regression Test Deposit audit（若适用）、遗留警告和校验结果。
