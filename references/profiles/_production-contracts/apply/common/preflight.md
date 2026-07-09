# Apply Preflight Contract

## 目的

Phase 0 / Preflight 是实现前 trace-only 硬门禁。任何不依赖当前实现代码、测试文件或 apply evidence 就能判定的 trace/register 问题，都必须在启动 implementation-worker 前阻断；不得把明显的 runtime fact 引用错误、Proof Slice 非原子、owner/layer/primitive 非法、fake covered reconciliation 或 tasks projection 错误推迟到 test-worker 才首次发现。

## Complete Validator Gate

- Phase 0 必须先运行全量静态 artifact validator：

```bash
node openspec/agent-runtime/scripts/validate-production-artifacts.mjs --change "<change-slug>" --complete
```

- Validator hard error 是实现前 `Artifact Consistency Blocker`，必须在启动任何 implementation-worker 前停止。
- Validator warning 必须纳入 Phase 0 人工/agent preflight 判断，不得静默忽略；Markdown renderer exact output drift 不再是 validator warning 或 hard blocker。
- Static validator 不替代本文档的 schema-aware preflight；validator pass 后仍需按 apply contract bundle 做人工/agent 审计。

## Common Index Set

两个 production schema 的 common preflight 必须索引：

- `trace/proposal.trace.json`、实际 `trace/specs/*.trace.json` 或 no-delta marker trace、`trace/design.trace.json`、`trace/runtime-acceptance.trace.json`、`trace/tasks.trace.json`、`trace/verification.trace.json`。
- `tasks.md` 中与 task IDs 对应的可回写 checkbox 行。
- `trace/tasks.trace.json#/implementation-step-register[]` 的 step IDs、`work-stage`、`depends-on-step-ids[]`、step/task 三类 link arrays、checkbox task work。
- `trace/verification.trace.json#/verification-slice-register[]` 的 Slice ID、runtime fact IDs、Primary runtime fact ID、Proof Type、Branch、Oracle、Failure Signal、Test Layer、Production Owner、Assertion Shape、Fixture Boundary、Proof Evidence Mode、Planned Test Directory 和 Non-Persistent Reason。
- `trace/runtime-acceptance.trace.json#/runtime-fact-register[]` canonical RS-/OP-/ST-/CH- rows 及其 source/scope basis、runtime obligation、observable fact、default path policy、external boundary、scope role 和 no-scope-expansion check。

## Tasks Closure

- Step links 必须等于 child task links 的聚合。
- `supports` / `contributes` / `implements-part` / `uses` 只算贡献，不关闭 coverage。
- 每个 in-scope spec scenario 至少有 task `completes`。
- 每个非 `non-applicable` design detail 至少有 task `completes`。
- 每个 `required behavior` runtime fact 至少有 task `completes`。
- 每个 `preserve boundary` runtime fact 至少有 task `enforces`。
- AC dependency graph 从 `depends-on-step-ids[]` 读取，dependency 只能指向前置 AC。
- 不得用只执行 proof、verification、test、fixture、screenshot、evidence、coverage closure 或 acceptance closure 的 checkbox 关闭 production implementation coverage。

## Verification Slice Consistency

- 每个 required / preserve runtime fact 必须至少被 `verification-slice-register[]` 覆盖。
- 每个 Proof Slice 的 `runtime-fact-ids[]` 只能引用 runtime-acceptance 中已定义的 runtime fact。
- `primary-runtime-fact-id` 必须存在于同一 slice 的 `runtime-fact-ids[]` 中。
- `proof-type` 只能是 `operation`、`state`、`failure`、`negative-boundary`、`layout`、`observability`、`fixture-variant`、`authorization`。
- `test-layer` 只能是 `unit`、`component`、`route/API`、`DB/integration`、`contract`、`worker/job`、`realtime/SSE`、`browser/e2e`、`visual/responsive`、`security/negative`。
- `Production Owner` 必须是 exactly one production code boundary token，不得是测试目录、evidence 目录、runner selector、命令、owner list 或复合 owner。
- `branch`、`oracle`、`failure-signal` 和 `assertion-shape` 必须表达单一原子断言维度，不得聚合 edit/delete/add、replay/mismatch、success/failure、retryable/non_retryable/empty_result、多个 viewport condition、多个日志类别、多个 redaction 类别或多个 security branches。
- `proof-evidence-mode=durable-test` 时，`planned-test-directory` 必须是外置 `tests/` 目录 glob，以 `/**` 结尾，并匹配 `test-layer` 默认子树。
- 非 `durable-test` slice 必须使用 `planned-test-directory: N/A`，且必须有 `non-persistent-reason`。
- Proof Slice 不得把 repo-wide env/ops/workspace/forbidden-drift 作为默认新测试义务，除非 proposal/spec/design 明确给出 source/scope basis。

## Artifact Consistency Blockers

若 validator 或 preflight 发现以下问题，必须先修订 artifacts，不得让 worker 直接用代码绕过：

- coverage orphan、GA/SI range、implementation task ID 无法解析、runtime fact 无 owner。
- AC 顺序违反 `depends-on-step-ids[]`。
- runtime-acceptance row 缺少 source/scope basis、default path 或 no-scope boundary。
- tasks/verification 引用未定义 runtime fact。
- tasks 引用未定义 spec scenario 或 design detail。
- tasks spec/design/runtime closure 不闭合。
- required/preserve runtime fact 缺少 verification projection。
- tasks trace 包含旧 coverage/runtime projection/AC-local proof-preserve 字段或 tasks 旧 `runtime-fact-ids[]`。
- Proof Slice `Production Owner` 是复合 owner / owner list。
- Proof Slice 合并多个独立可失败分支。
- durable slice placement 非法。
- non-durable slice 未使用 `N/A` 或缺少 reason。
- oracle 与 proposal/spec/design/runtime-acceptance 冲突。
- oracle 引入 source/scope 外行为、要求测试 artifact/process、依赖 implementation detail，或只是检查 evidence、deposit、tasks 矩阵或 OpenSpec artifact 文本结构。
- tasks/verification trace 使用被禁止的旧测试矩阵字段。
