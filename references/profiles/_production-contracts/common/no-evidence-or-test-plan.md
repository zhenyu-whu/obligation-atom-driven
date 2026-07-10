# 禁止测试执行与 Evidence 字段

本文件适用于 propose artifacts。propose 阶段只定义生产行为、runtime acceptance、Proof Slice 意图和 implementation work，不记录执行证据。

## 全局禁止

以下内容不得写入 `runtime-acceptance.md`、`verification.md` 或 `tasks.md`：

- `Test Evidence Matrix`
- `Regression Test Deposit`
- `Test Layer Plan`
- `Fixed Command`
- `Test File / Name`
- `Evidence Directory`
- `Evidence Status`
- `Deposit Status`
- `Test IDs`
- evidence/apply 产物路径、执行状态、deposit 状态
- 具体测试文件路径、固定测试命令、runner selector 或 CI runnable 不得作为 implementation work 本身；若出现在 tasks 文本中，validator 只发 warning，reviewer/preflight 必须判断是否构成 proof/test/evidence-only task。

## Verification 边界

- `verification.md` 只定义 Proof Slice、oracle、layer/harness/fixture 意图和禁止测试对象。
- `verification.md` 不得定义具体测试文件、固定命令、runner selector、evidence directory、执行状态或 regression deposit。
- Proof Slice 的 oracle 必须来自 `trace/runtime-acceptance.trace.json` canonical rows 的 runtime obligation、observable fact、default path、external boundary、failure/branch/no-scope 字段，不得来自当前实现细节、测试文件结构、artifact 文本结构或 apply evidence。

## Tasks 边界

- `tasks.md` checkbox 必须代表 production implementation work，例如代码、schema、migration、API、domain behavior、UI behavior、auth/security guard、config、provider contract、observability、deployment 或 runtime boundary preservation。
- checkbox 不得只为了 proof、verification、test、fixture replay、截图、evidence、coverage closure、acceptance closure 或 artifact closure 而存在。
- `tasks.md` 不再承载 `Proof:`、`Acceptance:` 或 coverage proof 摘要；完成标准和 oracle 必须从 runtime-acceptance 与 verification 反查。
