# Verification Regression Gates

本文件定义 OpenSpec production schema 的验证证据与永久回归测试契约。它只约束可重跑验证、证据落盘、测试层级和永久回归沉淀，不要求特定开发顺序。

## Phase Ownership

`tasks.md` 的职责是验证计划契约：列出每个 `T-###` 的 behavior contract、layer、默认路径级别、唯一 `Fixed Command`、`Verification Expectation`、fixture boundary、evidence directory 和预期执行证据类型。

`openspec-apply-change` 阶段负责落地测试、实现、命令执行和 evidence 更新：根据 `Test Evidence Matrix` 建立或补齐适用测试，完成实现后运行同一个 `Fixed Command`，把 `command.log` 或 runner/CI result/report 以及需要保留的 artifact 保存到 canonical evidence directory，并更新 `Evidence Status`、`Evidence Produced` 和 `Regression Test Deposit` 状态。

Testing Quality Core 分为三个人工审阅 gate：plan gate 检查验证计划结构和默认路径契约；AC evidence gate 检查 apply 阶段当前 AC 的 execution evidence、evidence status 和 regression deposit；final gate 要求 required behavior 不停留在 `planned`，且 execution evidence 与 regression deposit 已闭合。

## Fixed Command

- `Fixed Command` / `Regression Command` 必须是真正最小且可定位该 Test ID 的命令。
- 对 Vitest/Playwright 等 runner，不得用 `pnpm test -- <file> -t <name>`、`pnpm test:e2e -- <file> -t <name>` 或任何 `pnpm test* -- ...` 透传 selector 的形式作为单个 Test ID 的固定命令。
- 需要 selector 时，使用 runner 直接命令、`pnpm exec vitest/playwright ...`，或专用 package/root script。
- `command.log` 或 runner/CI result/report 是完成 Test ID 的执行事实源；只在对话中口述“已通过”或只引用未保存的临时输出，不能作为 execution evidence。

## Execution Evidence Ownership

- `command.log` 或 runner/CI result/report 是本地 apply 的 mandatory execution fact。worker 必须把固定命令的 stdout/stderr、runner 报告或 CI 结果保存到 `Test Evidence Matrix` 声明的 canonical evidence directory；只在对话中口述“已通过”不能作为证据。
- canonical evidence path、`command.log` 或 runner/CI result/report、OpenSpec change/AC/Test routing 和需要保留的 artifacts 必须可审计。测试代码关注行为断言；需要保留的截图、trace、DOM snapshot、API/DB/job/log facts 应通过 runner attachment/report、测试框架 output directory，或 worker/final audit 记录的 artifact directory 产出并复制到 canonical directory。
- 如果测试框架没有 attachment/report 机制，可以使用共享测试 fixture 写临时 machine-readable artifact；该 fixture 只消费输出目录配置，不应在测试代码中硬编码 change slug、AC ID、Test ID 或 canonical OpenSpec evidence path。
- AC evidence gate 和 final gate 不得只检查 artifact 路径存在；必须检查固定命令的当前执行结果、`command.log` 或 runner/CI result/report、artifact 路径存在性、时间/运行标识非陈旧，以及 `Evidence Produced` 与实际落盘内容一致。

## Evidence Status

`Evidence Status` 只能使用：

- `planned`：tasks/propose 阶段的计划状态，或 apply 阶段尚未完成的 Test ID。
- `passed`：固定命令或等价 runner/CI result/report 已在当前 worktree 通过并落盘；若使用等价 CI evidence，必须有可审计的 CI result/report。
- `not-applicable`：该 Test ID 对应行为不需要执行验证，且有 source/scope-backed reason。
- `blocked`：该 Test ID 的验证因 agent 无法自主解除的原因无法完成，且记录 blocker reason。

`Evidence Status = blocked` 是 Test Evidence row 的证据状态，不等同于 worker/apply flow blocker。`Fixed Command` 失败、typecheck/lint/test 失败、缺失 `command.log` 或 runner/CI result/report、缺失 required runner artifact、测试 oracle 不足或 artifact/evidence 未闭合，默认都是当前 AC 尚未完成的修复工作；worker 必须先修实现、测试、artifacts 或 evidence 收集方式并重跑固定命令。只有当失败原因无法由 agent 在当前 change 范围内自主解除时，才可把 evidence 标记为 `blocked` 并返回流程级 blocker。

required behavior 在 evidence/final gate 中不得停留在 `planned`。`Regression Test Deposit = deposited` 的 required behavior 必须对应 `Evidence Status = passed`，并有当前 worktree execution evidence 证明通过。

## Test Layer Code Requirements

`Test Evidence Matrix.Layer` 必须反映测试代码实际使用的 harness/runtime。目录、文件名、脚本名、截图存在或 agent 口述不能提升测试层级：

- `unit`：只覆盖纯函数、规则、解析/校验、映射、脱敏、状态机或小型 adapter contract。
- `component`：必须 mount/hydrate/render 到可交互 component harness，并用 role/label/text/query + user event 或真实 DOM event 证明用户可触发状态。
- `route/API contract`：必须调用实际 route handler、server action、API entry、RPC resolver 或 service contract boundary，并构造 Request/session/auth/context，断言 status、DTO、错误、auth/ownership/privacy/redaction 和 default wiring。
- `DB/integration`：必须覆盖真实 database/repository/transaction/migration/readback/invariant path。
- `worker/job integration`：必须覆盖 enqueue/consume 或 production-compatible processor boundary，并断言 retry、idempotency、terminal mutation、job/log/audit fact。
- `realtime/SSE integration`：必须覆盖 event/outbox/SSE/polling/subscription/readback chain，并断言 event shape、ordering、terminal state 或 recovery。
- `browser E2E`：必须使用真实浏览器 runtime，执行 navigation 和 user-equivalent actions，并通过 rendered DOM、network/readback、URL、screenshot/trace 或 reload persistence 断言用户路径。
- `visual/responsive`：必须用真实浏览器 viewport、screenshot、bounding box、pixel diff 或 accessibility/layout query 证明视觉/响应式状态。
- `security/negative`：必须覆盖未授权、越权、MUST NOT、敏感字段、redaction、asset access、audit/log 或隐私边界。
- `config/ops/check`：只能证明稳定 config/env/build/migration/deployment/static gate，不替代 required behavior 的 unit/component/API/DB/browser/security 测试。

## Mock And Oracle Boundaries

- 测试 oracle 必须来自外部行为契约，例如用户可观察结果、API/DTO contract、DB invariant、audit/log/redaction fact、auth/security/privacy boundary、错误/恢复分支、spec scenario、design obligation 或 source/scope basis。
- 不得把私有 helper、mock 调用次数、非契约 DOM 层级、className、快照全文、`data-testid` 存在、按钮 enabled 或当前实现输出登记为 required behavior 的 primary proof 或永久回归 oracle。
- Mock 只能隔离慢、外部或非确定性边界，不能成为被测试对象。
- mock 前必须说明真实依赖有哪些 side effects、测试是否依赖这些 side effects、被 mock 掉的 production path 由哪个 default-path proof 覆盖。

## Completion Rule

一个 Test ID 只有在满足以下条件后，才可以作为 implementation success proof 或 deposited regression：

- `Fixed Command` 已通过，并保存 `command.log` 或 runner/CI result/report。
- 本地 apply evidence 必须包含 `command.log` 或 runner result/report；等价 CI evidence 必须有可审计的 runner/CI result/report。
- `Evidence Status` 是 `passed`。`not-applicable` / `blocked` 只能作为不适用或无法完成验证的审计说明，不能作为 implementation success proof 或 deposited regression。
- 测试 oracle 不是实现细节，也不是 mock 行为。
- regression command 可由常规入口触达。
- `Regression Test Deposit` 为 `deposited` 时，永久测试文件或稳定 smoke/e2e/ops 入口必须存在，regression command 必须已在当前 worktree 运行通过，或与已保存的 `Fixed Command` 完全等价并在 command evidence 中明确说明。
- 失败时会定位到目标行为缺口，而不是只证明测试文件、fixture 或 mock 存在。
