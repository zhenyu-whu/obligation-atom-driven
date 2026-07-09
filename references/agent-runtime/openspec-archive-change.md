# openspec-archive-change 运行约束

## 默认行为

- 当执行或触发 `openspec-archive-change` 技能归档已完成 change，且未指定 change 名称时，先运行 `openspec list --json`。如果活跃 change 只有一个，则默认选择该 change 继续归档流程；如果存在多个活跃 change、无活跃 change，或上下文与列表结果冲突，必须停下向用户确认。
- 归档前读取 `openspec status --change "<name>" --json`，确认 `schemaName`、检查 `tasks.md` checkbox 完成度、确认 `trace/runtime-acceptance.trace.json` 和 `trace/verification.trace.json` 存在，并评估 delta specs 是否需要同步；若存在 `trace/specs/no-spec-delta/README.trace.json`，记录 `spec sync: not-applicable`。
- 两个 production schema 的新格式不兼容旧 trace 测试矩阵模式；旧 change 如需归档，必须先单独迁移或按其原 schema 处理，不在新 schema 归档门禁中兼容。
- 两个 production schema 的新格式采用 JSON Trace Plane 作为归档语义来源：归档检查必须从 JSON trace 读取 specs/design/runtime/tasks/verification closure、reconciliation 和 alignment gate；Markdown renderer exact output drift 不作为归档 warning 或 hard blocker。

## Schema-aware 归档门禁

- 对 `production-obligation-atom-driven`，归档前必须确认 `trace/tasks.trace.json` 不含 `GA-####`、`acceptance-driven-coverage`、`runtime-acceptance-index` 或 `runtime-acceptance-projection`；runtime source basis 只能来自 specs scenario pointer 和 `IDR-###`。
- 对 `production-default-acceptance-driven`，归档前必须确认 `trace/tasks.trace.json` 不含 `SI-###`、`acceptance-driven-coverage`、`runtime-acceptance-index` 或 `runtime-acceptance-projection`；runtime source basis 只能来自 specs scenario pointer 和 `IDR-###`。
- 两个 production schema 都必须检查 `trace/runtime-acceptance.trace.json#/runtime-fact-register[]` 的 canonical `RS-/OP-/ST-/CH-` rows：每行都有 source/scope basis、runtime obligation、observable fact、owner candidate、default path policy、external boundary、scope role 和 no-scope-expansion check，且不包含 AC checkbox、task、Proof Slice、测试文件、测试命令、evidence 或 deposit 状态字段。
- 如果 specs artifact 是 no-delta marker，归档门禁必须确认其 trace 为 `specs-completion-mode: "no-delta"`、`spec-delta-register: []`、`spec-gate` 无 blockers，并继续检查 design/runtime-acceptance/verification/tasks closure；不得因为没有 delta specs 跳过下游 closure。
- 两个 production schema 都必须检查 `tasks.md` 中每个 `trace/tasks.trace.json#/implementation-step-register[].tasks[].task-id` 有可回写且已完成的 checkbox 行；不得从 `tasks.md` 正文读取 Work、links 或 proof 语义。
- 两个 production schema 都必须检查 `trace/tasks.trace.json` 的 `implementation-step-register[]` 和 `task-gate`：所有 spec scenario、design detail、runtime fact links 都能解析；step links 等于 child task links 聚合；每个 in-scope spec scenario 有 task `completes`，每个非 `non-applicable` design detail 有 task `completes`，每个 required runtime fact 有 task `completes`，每个 preserve runtime fact 有 task `enforces`；AC dependency graph 从 `depends-on-step-ids[]` 读取且只能指向前置 AC。
- `trace/tasks.trace.json` 不得包含旧测试矩阵、固定命令、测试文件、evidence path、deposit status 或 legacy proof/preserve 字段。
- 新格式 change 必须检查 `trace/verification.trace.json#/verification-slice-register`：所有引用的 runtime fact 都已在 `trace/runtime-acceptance.trace.json` 定义；每个 required / preserve canonical runtime fact 都被至少一个 Proof Slice 覆盖。
- `openspec-results/<change-slug>/apply-result.md` 中每个 required Proof Slice 和 required / preserve runtime fact 都必须有最终 proof result：持久测试 mapping、非持久 evidence result、source/scope-backed `Manual / Environment Gate` 或 source/scope-backed `Not Applicable`。
- `openspec-results/<change-slug>/apply-result.md` 的 `Checkpoint Commits` 表只作为 apply-stage 过程审计轨迹；归档可读取 commit SHA、scope、status 和 blocker 摘要定位中间过程，但不得把 checkpoint commit 或 commit SHA 当作 Proof Slice pass、runtime fact covered、manual/not-applicable reason、test-proof-reviewer pass、repo-reviewer pass 或 final-reviewer pass 的替代条件。
- 如果存在 `openspec-results/<change-slug>/propose-result.md`，归档可读取其 artifact writer/reviewer、validator、blocker 和 repair 摘要定位 propose 阶段过程问题；该文件只作为 propose-stage 过程审计轨迹，不得替代 artifact / trace 门禁、apply-result、proof-test-map、Proof Slice pass、runtime fact covered、manual/not-applicable reason、test-proof-reviewer pass、repo-reviewer pass 或 final-reviewer pass。
- 新格式 change 必须存在 `openspec-results/<change-slug>/proof-test-map.json`，且 `node openspec/agent-runtime/scripts/audit-proof-test-mapping.mjs --change "<change-slug>"` 通过；每个 durable Proof Slice 必须 exactly one primary test mapping，且实际 `file` 必须落在该 slice canonical `planned-test-directory` 下；每个 non-durable Proof Slice 必须 exactly one proof evidence result 且不得进入 `proof-test-results[]`。
- 任一 `Authoring Blocker`、`Execution Failure`、`Artifact Consistency Blocker`、`Checkpoint Commit Blocker`、`repo-test-entrypoint-missing`、`repo-test-environment-blocker` 或 P0/P1 `engineering-practice-finding` 未解决时不得归档成功。
- `openspec-results/<change-slug>/apply-result.md` 必须能说明实际测试摘要、实际命令、运行结果、非持久 evidence 结果、`proof-test-map.json` 路径、checkpoint commit 审计轨迹、`Repo Review Loop` 每轮 findings / fix action / 最终 pass 结论和 blocker 处理结果；详细 `runtime fact -> Proof Slice -> proof result` 机器映射进入 `proof-test-map.json`，evidence 不要求写回 `runtime-acceptance.md`、`tasks.md` 或 `verification.md`。

## 同步与归档

- 如果 delta specs 存在且同步评估显示主 specs 需要新增或修改，默认执行“同步并归档”：优先使用 `openspec archive "<name>" -y` 完成 spec 更新与归档；如果 CLI 不可用或自动同步失败，再按 `openspec-sync-specs` 技能手动同步后归档。
- 如果存在 `specs/no-spec-delta/README.md`，spec 同步结果为 `not-applicable`：归档不得把 `specs/no-spec-delta/README.md` 当作 `specs/<capability>/spec.md` 同步到主 specs，也不得为它调用 specs sync。可使用 `openspec archive "<name>" --skip-specs`，或在默认 archive dry-run/实际归档中确认 CLI 不会把 `no-spec-delta` 当作 capability delta spec。
- 只有遇到冲突或高风险状态时才向用户确认，包括但不限于：多个候选 change、归档目标目录已存在、delta spec 与主 spec 无法明确合并、存在未完成 checkbox、coverage 表存在 orphan `GA-####` / `SI-###`、runtime trace 缺失、runtime fact 重复或缺少 source/scope/default-path/no-scope 字段、tasks/verification trace 引用未定义 runtime fact、tasks trace 引用未定义 spec scenario 或 design detail、tasks trace 旧字段残留、spec/design/runtime closure 不闭合、required / preserve runtime fact 缺少 verification Proof Slice、required Proof Slice 缺少最终 proof result、durable slice 缺测试或测试文件未落在 planned directory 下、non-durable slice 缺 evidence 或误入 proof-test-results、存在未解决 blocker、命令失败、校验失败，或归档会覆盖/删除非目标文件。
- 归档完成后必须运行 `openspec validate --specs --strict --json`，并汇总 change 名称、schema、归档路径、spec 同步结果、任务完成情况、schema-aware coverage audit、runtime acceptance audit、verification Proof Slice 结果、遗留警告和校验结果。
