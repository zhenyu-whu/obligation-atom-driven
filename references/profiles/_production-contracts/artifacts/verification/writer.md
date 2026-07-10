# Verification Writer Contract

本文件只适用于 `verification-writer` 和 `verification-repair-writer`。Writer 的核心任务是把 runtime acceptance facts 拆成原子 Proof Slice；trace links 和 gate 是完成后的客观投影与自查结果，不是生成策略。

## 写入前

- 读取 `trace/runtime-acceptance.trace.json` 的 `runtime-fact-register[]` 和 `runtime-gate`。
- 读取实际 specs trace 路径和 `trace/design.trace.json` 只用于填写并校验 `source-interface`；不得从 specs/design/proposal 重新派生 oracle。
- 不得从 `proposal.md`、`specs/**/*.md`、`design.md`、`runtime-acceptance.md`、旧 `verification.md`、当前实现、测试文件、apply result 或 evidence 推导 Proof Slice。
- 对每个 `required behavior`、`preserve boundary` runtime fact，拆出所有独立可失败分支。
- 每个可验证分支生成一个 `PS-###` row；无法验证或存在冲突时写入 `verification-gate.blockers`，不得伪造 slice。
- Writer 只写严格 JSON `trace/verification.trace.json`；`verification.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 生成。

## Proof Slice 生成顺序

Writer 必须按以下顺序生成 verification trace：

1. 从 runtime trace 建立 canonical runtime fact index，只选择 `scope-role` 为 `required behavior` 或 `preserve boundary` 的 rows。
2. 对每个目标 runtime fact 分解独立可失败分支，包括 operation、state、failure/retry、auth/security、layout、observability、fixture variant、viewport 或 redaction branch。
3. 为每个分支生成单一原子 `oracle`、`failure-signal` 和 `assertion-shape`，且 oracle 只能来自 runtime fact 字段。
4. 选择最小充分 `proof-type`、`test-layer`、`production-owner` 和 `fixture-boundary`。
5. 选择 `proof-evidence-mode`：可通过持久测试证明的 slice 使用 `durable-test`；运行环境、构建、代码生成、compose 配置、静态边界或人工环境约束类 proof 使用对应 non-durable mode。
6. 对 `durable-test` slice 规划目录级 `planned-test-directory`，只能写外置 `tests/**` 子树 glob，不能写具体文件、命令、runner 或 evidence path。
7. 对 non-durable slice 将 `planned-test-directory` 写为 `N/A`，并填写 source/scope-backed `non-persistent-reason`。
8. 从同一 register model 投影 `delivery-plane.verification-intent`。Delivery Plane 只承载 renderer payload，不得复制 Proof Slice rows、coverage、gate 或 evidence 字段。
9. 最后生成 `verification-gate`。Gate 是 validator/reviewer 反查 runtime fact coverage、runtime refs、slice atomicity、proof modes、test placement 和 delivery projection 的闭合结果；它不是 writer 倒推 slice 的 authoring checklist。
10. 写入严格 JSON `trace/verification.trace.json`，再调用 renderer 生成 `verification.md`、Trace Appendix 和 manifest registry entry。

## Proof Slice 规则

- 每个 Proof Slice 必须代表一个独立可失败的 runtime 分支；不得把多个 operation、state、failure/retry、auth/security、layout、observability、fixture variant、viewport 或 redaction branch 合并成一个 slice。
- `runtime-fact-ids[]` 可以包含多个 facts，只能在同一个原子 branch 和同一个 oracle 同时覆盖这些 facts 时合并引用。
- `primary-runtime-fact-id` 必须代表该 slice 的主 oracle 来源。
- `oracle` 必须是 runtime acceptance fact 的原子断言，不得依赖实现内部细节、测试 fixture 便利、task checkbox、apply evidence 或 Markdown 描述。
- `production-owner` 是单一 production code boundary token；跨模块依赖写入 `fixture-boundary` 或 runtime fact 的外部边界语义，不得写 owner list。
- Verification 不创建测试执行计划；不得写具体测试文件、固定命令、runner selector、`openspec-results/**`、`test-results/**`、evidence path、执行状态或 regression deposit。

## Writer 提交前结构检查

调用 renderer 前，writer 只做结构一致性检查：

- `trace/verification.trace.json` 是严格 JSON，且只包含 `artifacts/verification/trace-schema.md` 允许的顶层字段。
- `source-interface` 只引用实际 runtime/spec/design trace，不包含 proposal trace、Markdown artifact、实现、测试、evidence 或 apply-stage 输入。
- 每个 Proof Slice ID、runtime fact ref、proof type、test layer、proof evidence mode、planned test directory 和 non-persistent reason 都符合 shared trace schema。
- 每个 required / preserve runtime fact 至少被一个 Proof Slice 覆盖。
- `verification-slice-register[]` 是原子 Proof Slice register，不是 runtime fact、coverage row、test file、command 或 evidence 的逐行镜像。
- `delivery-plane` 只保存 renderer payload，不泄漏 Proof Slice register、coverage、gate、trace pointer、测试计划或 evidence 字段。
- 若结构检查或生成后的 gate 出现缺口，writer 必须返回 blocker 或修订上游/语义模型；不得为了清空 gate 创建 non-atomic、proof-only、coverage-only 或 source/scope 外 slice。

## Repair Writer

Repair-writer 必须重新读取最新 runtime trace、当前 verification trace、contract bundle、validator hard error 和 reviewer blocker。修复时应重建受影响的 Proof Slice semantic model，而不是局部补字段来关闭 validator 或 reviewer finding。
