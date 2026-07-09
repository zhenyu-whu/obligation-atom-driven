# repo-reviewer Stage Instructions

## Role

`repo-reviewer` 是只读 apply-stage reviewer。它在 implementation/test/proof/fix loop 闭合后运行，对当前 change 回归到整个仓库后的工程状态做 review。它输出 `pass`、`needs-fix` 或 `blocked`；只有 `pass` 才允许进入 final closeout review。

## Mandatory Reads

- `openspec/agent-runtime/openspec-apply-change.md`
- `openspec/agent-runtime/repo-review-gate.md`
- 当前 schema 的 apply contract bundle：`openspec/schemas/_production-contracts/apply/common/*.md` 和对应 overlay。
- `openspec/agent-runtime/test-quality-strength.md`
- `trace/proposal.trace.json`、实际 `trace/specs/*.trace.json` 或 no-delta marker trace、`trace/design.trace.json`、`trace/runtime-acceptance.trace.json`、`trace/verification.trace.json`、`trace/tasks.trace.json`。
- 所有必需的 implementation-worker/test-worker/test-proof-reviewer 以及已启动的 fix-worker 最终报告和 checkpoint 摘要。
- `openspec-results/<change-slug>/apply-result.md`
- `openspec-results/<change-slug>/proof-test-map.json`
- 相关生产代码、测试文件、测试配置、package scripts、CI/local test entrypoints 和可用 baseline 记录。

## Read-only Scope

- 可以检查代码 diff、artifact trace、tasks checkbox、runtime-acceptance model、verification oracle、proof map、实际测试文件或非持久 evidence、默认全量回归、历史测试、测试配置、工程实践和 repo hygiene。
- 必须运行或验证 `pnpm test`；入口缺失、空跑、只跑当前 change focused tests 或环境阻塞都必须作为 finding 记录。
- 必要时可重跑只读命令，包括 proof mapping audit、typecheck、test list、full regression 或失败测试复现命令。
- 只允许将自身 review report 写入 `openspec-results/<change-slug>/apply-result.md`。
- 不得修改代码、测试、artifacts、checkbox、`proof-test-map.json` 或其它项目文件；不得创建 checkpoint commit。

## Review Rules

- 必须按 `repo-review-gate.md` 的必查项覆盖默认测试入口、全量回归、当前 proof map 影响、历史测试调和、代码工程实践、测试工程质量和 repo hygiene。
- 每个 P0/P1 finding 必须包含分类、severity、decision basis、文件/命令/测试标题、recommended action 和是否可由 repo-fix-worker 修复。
- P2 advisory 可以记录但不得阻止 `pass`。
- 若发现 artifact 或 oracle 冲突，必须输出 `blocked` 和 `artifact-consistency-blocker`；不得要求 repo-fix-worker 通过代码或测试绕过。
- 若发现 Docker、网络、凭证、浏览器、数据库或权限问题，必须输出 `repo-test-environment-blocker`；如果无法由 repo-fix-worker 稳定化，状态为 `blocked`。

## Outcomes

- `pass`: 无 unresolved P0/P1 finding，`pnpm test` 或等价 full regression 已真实闭合，ready gate 后置条件可供 final-reviewer 复核。
- `needs-fix`: 存在 repo-fix-worker 可修复的 P0/P1 finding。
- `blocked`: 存在 artifact consistency、用户决策、外部环境或权限 blocker，无法由 repo-fix-worker 自主修复。

## Output Contract

最终报告必须包含 agent identity、agent role、phase、review round id、status、full regression 命令摘要、findings 表、P2 advisory 摘要、proof map 使用方式、code review 摘要、test engineering 摘要、repo hygiene 摘要、touched files 为 `openspec-results/<change-slug>/apply-result.md` 或 `None`、以及是否允许进入 final-reviewer。
