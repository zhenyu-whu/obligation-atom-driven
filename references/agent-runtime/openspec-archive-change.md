# openspec-archive-change 运行约束

## 默认行为

- 当执行或触发 `openspec-archive-change` 技能归档已完成 change，且未指定 change 名称时，先运行 `openspec list --json`。如果活跃 change 只有一个，则默认选择该 change 继续归档流程；如果存在多个活跃 change、无活跃 change，或上下文与列表结果冲突，必须停下向用户确认。
- 归档前读取 `openspec status --change "<name>" --json`，确认 `schemaName`、检查 `tasks.md` 完成度、确认 `runtime-acceptance.md` 和 `verification.md` 存在，并评估 delta specs 是否需要同步。
- 两个 production schema 的新格式不兼容旧 `tasks.md` 内置测试矩阵模式；旧 change 如需归档，必须先单独迁移或按其原 schema 处理，不在新 schema 归档门禁中兼容。
- 两个 production schema 的新格式采用 Delivery Plane + JSON Trace Plane 布局：归档检查必须从 renderer 生成的 artifact 主体读取交付契约，从短 `## Trace Appendix` pointer、`trace/manifest.json` 和对应 JSON trace 读取 coverage、projection、reconciliation 和 alignment gate；`render-contract-version: trace-render-v1` 的 artifact 必须通过 renderer exact output validator。

## Schema-aware 归档门禁

- 对 `production-obligation-atom-driven`，归档前必须检查 `trace/tasks.trace.json` 的 `acceptance-driven-coverage`：`obligation-atom-coverage` 每行只能有一个 exact `GA-####`，`Artifact Projection` 与 proposal `trace/proposal.trace.json` / `change-atom-coverage-register` 一致，三张 coverage 表的 task ID 均能解析到已完成 checkbox，每个 AC 的 final acceptance/proof task 已完成。
- 对 `production-default-acceptance-driven`，归档前必须检查 `trace/tasks.trace.json` 的 `acceptance-driven-coverage`：`scope-item-coverage` 每行只能有一个 exact `SI-###`，`Artifact Handling` 与 proposal `trace/proposal.trace.json` 的 `change-scope-coverage` 一致，`requirement-scenario-coverage` 和 `design-decision-coverage` 的 task ID 均能解析到已完成 checkbox，每个 AC 的 final acceptance/proof task 已完成。
- 两个 production schema 都必须检查 `runtime-acceptance.md` 的 canonical `RS-/OP-/ST-/CH-` rows：每行都有 source/scope basis、runtime obligation、observable fact、owner candidate、default path policy、external boundary、scope role 和 no-scope-expansion check，且不包含 AC checkbox、task、Proof Slice、测试文件、测试命令、evidence 或 deposit 状态字段。
- 两个 production schema 都必须检查 `tasks.md` AC Delivery Plane 的 `Resolved Runtime Contract`：每个 AC 的 table row IDs 与该 AC `Runtime Rows` 一致，全部存在于 `runtime-acceptance.md` 主体，且不与 canonical row 的 runtime obligation、observable fact、default path policy 或 no-scope boundary 冲突；不得在 `tasks.md` 重新定义 canonical runtime row。
- 两个 production schema 都必须检查 `trace/tasks.trace.json` 的 `runtime-acceptance-index` 和 `runtime-acceptance-projection`：所有引用的 runtime row 都已在 `runtime-acceptance.md` 主体定义；每个 required / preserve / proof-only canonical runtime row 都有 AC owner、provider/consumer relationship 和 acceptance proof checkbox，或 explicit blocker/not-applicable reason；AC dependency graph 从 JSON trace 读取，不要求 AC 主体包含 `Provides`、`Consumes`、`Depends On` 或 `Prerequisite Runtime Facts` 字段。
- `tasks.md` 不得包含 `Test Evidence Matrix`、`Regression Test Deposit`、`Test Layer Plan`、`Fixed Command`、`Test File / Name`、`Evidence Directory`、`Evidence Status`、`Deposit Status` 或 `Test IDs` 字段。
- `verification.md` 必须存在。新格式 change 还必须检查 `trace/manifest.json` 的 `trace-contract-version: proof-slices-v1`、`trace/verification.proof-slices.json`、主体的 `Proof Slice Matrix` 镜像和 `trace/verification.trace.json` 的 `runtime-coverage-reconciliation`：所有引用的 runtime row 都已在 `runtime-acceptance.md` 主体定义；每个 required / preserve / proof-only canonical runtime row 都有 expected Proof Slice，且 `Coverage Status = covered` 时 `Missing Proof Slice IDs = None`，或有 source/scope-backed manual/not-applicable reason。
- `openspec-results/<change-slug>/apply-result.md` 中每个 required Proof Slice 和 required / preserve / proof-only runtime row 都必须有最终结果：`Passed`、source/scope-backed `Manual / Environment Gate` 或 source/scope-backed `Not Applicable`。
- `openspec-results/<change-slug>/apply-result.md` 的 `Checkpoint Commits` 表只作为 apply-stage 过程审计轨迹；归档可读取 commit SHA、scope、status 和 blocker 摘要定位中间过程，但不得把 checkpoint commit 或 commit SHA 当作 Proof Slice pass、runtime row covered、manual/not-applicable reason、test-proof-reviewer pass、change-stabilizer pass 或 final-reviewer pass 的替代条件。
- 如果存在 `openspec-results/<change-slug>/propose-result.md`，归档可读取其 artifact writer/reviewer、validator、blocker 和 repair 摘要定位 propose 阶段过程问题；该文件只作为 propose-stage 过程审计轨迹，不得替代 artifact / trace 门禁、apply-result、proof-test-map、Proof Slice pass、runtime row covered、manual/not-applicable reason、test-proof-reviewer pass、change-stabilizer pass 或 final-reviewer pass。
- 新格式 change 必须存在 `openspec-results/<change-slug>/proof-test-map.json`，且 `node openspec/agent-runtime/scripts/audit-proof-test-mapping.mjs --change "<change-slug>"` 通过；每个 required Proof Slice 必须 exactly one primary test mapping，除非 proof slice JSON 和 proof-test-map 同时提供 explicit waiver。
- 任一 `Authoring Blocker`、`Execution Failure`、`Artifact Consistency Blocker` 或 `Checkpoint Commit Blocker` 未解决时不得归档成功。
- `openspec-results/<change-slug>/apply-result.md` 必须能说明实际测试摘要、实际命令、运行结果、`proof-test-map.json` 路径、checkpoint commit 审计轨迹和 blocker 处理结果；详细 `Runtime Row -> Proof Slice -> test result` 机器映射进入 `proof-test-map.json`，evidence 不要求写回 `runtime-acceptance.md`、`tasks.md` 或 `verification.md`。

## 同步与归档

- 如果 delta specs 存在且同步评估显示主 specs 需要新增或修改，默认执行“同步并归档”：优先使用 `openspec archive "<name>" -y` 完成 spec 更新与归档；如果 CLI 不可用或自动同步失败，再按 `openspec-sync-specs` 技能手动同步后归档。
- 只有遇到冲突或高风险状态时才向用户确认，包括但不限于：多个候选 change、归档目标目录已存在、delta spec 与主 spec 无法明确合并、存在未完成任务、coverage 表存在 orphan `GA-####` / `SI-###`、`runtime-acceptance.md` 缺失、runtime row 重复或缺少 source/scope/default-path/no-scope 字段、tasks/verification 引用未定义 runtime row、AC `Resolved Runtime Contract` 缺失/row ID 不一致/与 canonical row 冲突、required / preserve / proof-only runtime row 缺少 tasks projection 或 verification Proof Slice、runtime row projection 冲突、required Proof Slice 未通过、存在未解决 blocker、命令失败、校验失败，或归档会覆盖/删除非目标文件。
- 归档完成后必须运行 `openspec validate --specs --strict --json`，并汇总 change 名称、schema、归档路径、spec 同步结果、任务完成情况、schema-aware coverage audit、runtime acceptance audit、verification Proof Slice 结果、遗留警告和校验结果。
