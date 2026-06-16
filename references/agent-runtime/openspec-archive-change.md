# openspec-archive-change 运行约束

## 默认行为

- 当执行或触发 `openspec-archive-change` 技能归档已完成 change，且未指定 change 名称时，先运行 `openspec list --json`。如果活跃 change 只有一个，则默认选择该 change 继续归档流程；如果存在多个活跃 change、无活跃 change，或上下文与列表结果冲突，必须停下向用户确认。
- 归档前读取 `openspec status --change "<name>" --json`，确认 `schemaName`、检查 `tasks.md` 完成度、确认 `runtime-acceptance.md` 和 `verification.md` 存在，并评估 delta specs 是否需要同步。
- 两个 production schema 的新格式不兼容旧 `tasks.md` 内置测试矩阵模式；旧 change 如需归档，必须先单独迁移或按其原 schema 处理，不在新 schema 归档门禁中兼容。

## Schema-aware 归档门禁

- 对 `production-obligation-atom-driven`，归档前必须检查 `tasks.md` 的 `Acceptance-Driven Coverage`：`Obligation Atom Coverage` 每行只能有一个 exact `GA-####`，`Artifact Projection` 与 proposal register 一致，三张 coverage 表的 task ID 均能解析到已完成 checkbox，每个 AC 的 final acceptance/proof task 已完成。
- 对 `production-default-acceptance-driven`，归档前必须检查 `tasks.md` 的 `Acceptance-Driven Coverage`：`Scope Item Coverage` 每行只能有一个 exact `SI-###`，`Artifact Handling` 与 proposal `Change Scope Coverage` 一致，`Requirement / Scenario Coverage` 和 `Design Decision Coverage` 的 task ID 均能解析到已完成 checkbox，每个 AC 的 final acceptance/proof task 已完成。
- 两个 production schema 都必须检查 `runtime-acceptance.md` 的 canonical `RS-/OP-/ST-/CH-` rows：每行都有 source/scope basis、runtime obligation、observable fact、owner candidate、default path policy、external boundary、scope role 和 no-scope-expansion check，且不包含 AC checkbox、task、VID、Proof Slice、测试文件、测试命令、evidence 或 deposit 状态字段。
- 两个 production schema 都必须检查 `tasks.md` 的 `Runtime Acceptance Index` 和 `Runtime Acceptance Projection`：所有引用的 runtime row 都已在 `runtime-acceptance.md` 定义；每个 required / preserve / proof-only canonical runtime row 都有 AC owner、provider/consumer relationship 和 acceptance proof checkbox，或 explicit blocker/not-applicable reason；不得在 `tasks.md` 重新定义 canonical runtime row。
- `tasks.md` 不得包含 `Test Evidence Matrix`、`Regression Test Deposit`、`Test Layer Plan`、`Fixed Command`、`Test File / Name`、`Evidence Directory`、`Evidence Status`、`Deposit Status` 或 `Test IDs` 字段。
- `verification.md` 必须存在，且必须检查 `Behavior Oracle Matrix`、`Proof Slice Matrix` 和 `Runtime Coverage Reconciliation`：所有引用的 runtime row 都已在 `runtime-acceptance.md` 定义；每个 required / preserve / proof-only canonical runtime row 都有 VID 和 Proof Slice，或 source/scope-backed manual/not-applicable reason。
- `openspec-results/<change-slug>/apply-result.md` 中每个 required VID、Proof Slice 和 required / preserve / proof-only runtime row 都必须有最终结果：`Passed`、source/scope-backed `Manual / Environment Gate` 或 source/scope-backed `Not Applicable`。
- 任一 `Authoring Blocker`、`Execution Failure` 或 `Artifact Consistency Blocker` 未解决时不得归档成功。
- `openspec-results/<change-slug>/apply-result.md` 必须能说明实际测试文件、实际命令、运行结果、`Runtime Row -> VID -> Proof Slice -> test result` 映射和 blocker 处理结果；evidence 不要求写回 `runtime-acceptance.md`、`tasks.md` 或 `verification.md`。

## 同步与归档

- 如果 delta specs 存在且同步评估显示主 specs 需要新增或修改，默认执行“同步并归档”：优先使用 `openspec archive "<name>" -y` 完成 spec 更新与归档；如果 CLI 不可用或自动同步失败，再按 `openspec-sync-specs` 技能手动同步后归档。
- 只有遇到冲突或高风险状态时才向用户确认，包括但不限于：多个候选 change、归档目标目录已存在、delta spec 与主 spec 无法明确合并、存在未完成任务、coverage 表存在 orphan `GA-####` / `SI-###`、`runtime-acceptance.md` 缺失、runtime row 重复或缺少 source/scope/default-path/no-scope 字段、tasks/verification 引用未定义 runtime row、required / preserve / proof-only runtime row 缺少 tasks projection 或 verification VID/Proof Slice、runtime row projection 冲突、required VID 未通过、存在未解决 blocker、命令失败、校验失败，或归档会覆盖/删除非目标文件。
- 归档完成后必须运行 `openspec validate --specs --strict --json`，并汇总 change 名称、schema、归档路径、spec 同步结果、任务完成情况、schema-aware coverage audit、runtime acceptance audit、verification VID 结果、遗留警告和校验结果。
