# Test-Driven Regression Gates

本文件是项目内对 `obra/superpowers` 的 `test-driven-development` 和 `testing-anti-patterns` 技能可借鉴部分的精简版。它不是外部技能全文复制；只保留适合 OpenSpec production schema 的强制测试门禁。

Sources:
- https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md
- https://github.com/obra/superpowers/blob/main/skills/test-driven-development/testing-anti-patterns.md

## 目标

测试必须先定义“什么算成功”，再用同一个可重跑命令证明实现满足该定义。测试不是为已经写好的代码补一层一定 pass 的外壳。

本门禁适用于所有新增功能、bug fix、行为变更、回归修复、重要 preserve boundary 和安全/隐私/持久化边界。一次性部署检查、纯配置检查、manual-staging gate 或只证明现有 baseline 的测试可以例外，但必须在 `Test Evidence Matrix` 和 `Regression Test Deposit` 中写明 reason。

## Red Gate

每个 `Scope Role = required behavior` 的 Test ID 默认必须先进入 red 状态：

- 测试先于 production implementation 或行为修复代码建立。
- `Red Command` 必须是仓库根目录可重跑的固定命令。
- `Expected Red Failure` 必须描述来自 proposal/spec/design/runtime row 的缺口，例如缺少校验、缺少鉴权、未持久化、错误状态未渲染、敏感字段未脱敏。
- `Observed Red Failure` 必须证明命令确实失败，并且失败原因匹配 `Expected Red Failure`。
- 如果 red run 直接通过，不能继续实现；必须修正测试 oracle，或把该 Test ID 改为 preserve/baseline proof 并写明为什么 red 不适用。
- 如果 red run 是语法错误、fixture 错误、环境缺失或测试代码错误，不能算 red；先修测试，直到它因目标行为缺失而失败。

对已经存在的 legacy/baseline 行为，不要求删除现有代码重来；但不得把“当前实现 pass”当作充分证明。需要通过行为断言、negative path、临时不提交的 guard reversal/mutation、或明确的 preserve/baseline reason 证明该测试不是在复制实现细节。

## Green Gate

进入 green 阶段后，只写让 red 测试通过所需的最小 production change：

- `Green Command` 必须重跑同一个 Test ID 的固定命令，证明同一断言从 red 变 green。
- 如果 green 失败，优先修 production code，不得削弱断言、删除 edge case、放宽 security/privacy oracle 或改成匹配当前实现输出。
- 只有相关 Test IDs green，且 required prerequisite tests 仍通过，才能勾选 implementation 或 acceptance task。

## Refactor Gate

重构只能发生在相关 Test IDs green 之后：

- 重构不得改变 proposal/spec/design/runtime row 未授权的外部行为。
- 重构后必须重跑相关 `Green Command` 或更高层回归入口。
- 若重构暴露出新 operation、state、branch、terminal outcome、API、job、event、storage、auth/security 或 responsive variant，必须先回到 OpenSpec artifacts 更新 runtime/test matrices。

## Behavior Oracle

测试 oracle 必须来自外部行为契约，而不是来自当前实现：

- 允许的 oracle：用户可观察结果、API/DTO contract、DB invariant、audit/log/redaction fact、auth/security/privacy boundary、错误/恢复分支、spec scenario、design obligation、source atom。
- 不得作为 required behavior primary oracle：私有 helper、mock 调用次数、非契约 DOM 层级、className、快照全文、`data-testid` 存在、按钮 enabled、当前实现输出。
- 测试名称、fixture 和断言应描述“应该发生什么”，而不是“代码现在怎么写”。

## Mock Policy

Mock 只能隔离慢、外部或非确定性边界，不能成为被测试对象：

- 不断言 mock 元素或 mock 函数本身存在。
- 不为了测试向 production class/module 增加 test-only method。
- mock 前必须说明真实依赖有哪些 side effects、测试是否依赖这些 side effects、被 mock 掉的 production path 由哪个 default-path proof 覆盖。
- mock response 必须匹配真实 schema 中测试链路可能消费的结构；不要只填眼前断言需要的字段。
- 当 mock setup 比测试行为更复杂，优先考虑更真实的 integration/component/API test。

## Required Ledger Fields

每个 required behavior Test ID 的 evidence ledger 至少记录：

- `testId`
- `acId`
- `behaviorContract`
- `assertionOracle`
- `redCommand`
- `expectedRedFailure`
- `observedRedFailure`
- `redResult`
- `greenCommand`
- `greenResult`
- `refactorRerun`
- `tddStatus`
- `notApplicableReason`

`tddStatus` 只能使用 `red-required`、`red-observed`、`green-passed`、`not-applicable` 或 `blocked`。完成状态不能停留在 `red-required`。

## Completion Rule

一个 Test ID 只有在满足以下条件后，才可以作为 implementation success proof 或 deposited regression：

- red gate 已通过，或有可审计的 `not-applicable` / `blocked` reason。
- green command 已通过，并保存 evidence。
- 测试 oracle 不是实现细节，也不是 mock 行为。
- regression command 可由常规入口触达。
- 失败时会定位到目标行为缺口，而不是只证明测试文件、fixture 或 mock 存在。
