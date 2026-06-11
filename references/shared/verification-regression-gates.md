# Verification Regression Gates

本文件定义 OpenSpec production schema 的验证证据与永久回归测试契约。它只约束可重跑验证、证据落盘、测试层级和永久回归沉淀，不要求特定开发顺序。

## Phase Ownership

`tasks.md` 的职责是验证计划契约：列出每个 `T-###` 的 behavior contract、layer、默认路径级别、唯一 `Fixed Command`、`Verification Expectation`、fixture boundary、evidence directory 和预期执行证据类型。

`openspec-apply-change` 阶段负责落地测试、实现、命令执行和 evidence 更新：根据 `Test Evidence Matrix` 建立或补齐适用测试，完成实现后运行同一个 `Fixed Command`，把 `command.log` 或 runner/CI result/report 保存到 canonical evidence directory，并更新 `Evidence Status`、`Evidence Produced` 和 `Regression Test Deposit` 状态。

`validate_tasks_quality.py` 分为三个 gate：默认 plan gate 只检查验证计划结构和默认路径契约；`--evidence` / `--ac <AC-###> --evidence` 检查 apply 阶段产物；`--final` 要求 required behavior 不停留在 `planned`，且 execution evidence 与 regression deposit 已闭合。

## Fixed Command

- `Fixed Command` / `Regression Command` 必须是真正最小且可定位该 Test ID 的命令。
- 对 Vitest/Playwright 等 runner，不得用 `pnpm test -- <file> -t <name>`、`pnpm test:e2e -- <file> -t <name>` 或任何 `pnpm test* -- ...` 透传 selector 的形式作为单个 Test ID 的固定命令。
- 需要 selector 时，使用 runner 直接命令、`pnpm exec vitest/playwright ...`，或专用 package/root script。
- `command.log` 或 runner/CI result/report 是完成 Test ID 的执行事实源；只在对话中口述“已通过”或只引用未保存的临时输出，不能作为 execution evidence。

## Evidence Status

`Evidence Status` 只能使用：

- `planned`：tasks/propose 阶段的计划状态，或 apply 阶段尚未完成的 Test ID。
- `passed`：固定命令或等价 runner/CI result/report 已在当前 worktree 通过并落盘。
- `not-applicable`：该 Test ID 对应行为不需要执行验证，且有 source/scope-backed reason。
- `blocked`：当前无法完成验证，且记录 blocker reason。

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
- `Evidence Status` 是 `passed`，或有可审计的 `not-applicable` / `blocked` reason。
- 测试 oracle 不是实现细节，也不是 mock 行为。
- regression command 可由常规入口触达。
- `Regression Test Deposit` 为 `deposited` 时，永久测试文件或稳定 smoke/e2e/ops 入口必须存在，regression command 必须已在当前 worktree 运行通过，或与已保存的 `Fixed Command` 完全等价并在 command evidence 中明确说明。
- 失败时会定位到目标行为缺口，而不是只证明测试文件、fixture 或 mock 存在。
