# Reviewer 输出协议

本文件适用于每个 artifact reviewer 和最终 integration reviewer。

## Reviewer 角色

- Reviewer 只读审查 artifact 和 contract bundle，不得直接修改 artifact。
- Reviewer 不得把静态 validator PASS、artifact checklist、`Coverage Status = covered`、`Missing Proof Slice IDs = None` 或 JSON trace closure 当作语义通过证明。
- Reviewer 不读取当前实现、测试文件、`openspec-results/**`、evidence、apply-result 或 apply 阶段产物来推导 oracle。
- Reviewer 必须把 validator warning 作为待判定事项逐条处理；可修复的必须报告修复方向，确认为 false positive 时必须说明原因。

## 输出格式

Reviewer 只能输出 `Pass` 或 `Blocker`。

`Pass` 必须说明：

- 已读取的 contract bundle 文件；
- 已审查的 artifact path；
- validator warning 已处理或不存在；
- 未发现 source/scope drift、runtime projection drift 或 artifact-local contract violation。

`Blocker` 必须包含：

- artifact path；
- artifact anchor，例如 heading、table row、runtime row、Proof Slice、AC、`GA-####` 或 `SI-###`；
- contract source path 和 section heading；
- 问题描述；
- 所需修复方向。

## 主 Agent 分派 repair-writer 修复循环

- 主 Agent 收到 reviewer blocker 后必须分派当前 artifact 的 `repair-writer` 修订 artifacts，不得直接修改 artifacts。
- 主 Agent 必须等待 repair-writer 自然返回最终完成或明确 blocker；repair-writer 运行期间只能执行必要的编排等待和状态记录。
- 每次 repair-writer 修订后必须重新运行对应静态 validator；hard error 必须先由当前 artifact 的 `repair-writer` 修复。
- 同一 artifact reviewer 必须重新审查，直到 `Pass`。
- Reviewer finding 不使用人为稳定编号；使用 artifact path、contract section、row ID 和业务锚点定位。
