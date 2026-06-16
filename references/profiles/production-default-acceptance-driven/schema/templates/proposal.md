## Why

<!-- 说明此 change 的动机：它解决哪个产品、技术、生产就绪或验证缺口？ -->

## What Changes

<!-- 描述新增或修改的用户/系统行为、数据/API contracts、routes、workers、events、auth/security rules、storage、observability、deployment 与 verification surfaces。引用 exact SI-###。 -->

## Capabilities

### New Capabilities

<!-- 只有新增 capability 时填写，使用 kebab-case capability name。 -->

- `<name>`: <!-- capability 范围；Scope Items: SI-... -->

### Modified Capabilities

<!-- 修改 existing capability 时填写，使用 openspec/specs/ 中已有 capability name。 -->

- `<existing-name>`: <!-- 变化的 requirement 或 guard；Scope Items: SI-... -->

## Non-Goals

<!-- 明确排除不属于当前 change 的行为、surface、provider、状态、数据模型、route、测试或运维范围。适用时引用 SI-###。 -->

## Impact

<!-- 说明受影响的 apps、packages、database migrations、APIs、workers、queues、SSE/outbox events、frontend routes、components、assets、auth/security/privacy boundaries、observability、deployment、verification commands 与 dependencies。 -->

## Rollout / Readiness

<!-- 说明 migration ordering、environment/config needs、backfill、compatibility、staging/production smoke、operational runbook、monitoring/audit readiness；不适用时写“无”。 -->

## Open Questions

<!-- 没有剩余问题时写“无”。 -->

## Trace Appendix

<!-- 本附录是审计平面，不是 Delivery Plane。主 agent、archive、final reviewer 可读取它做覆盖闭环；implementation worker 默认不把本附录的表格行当作 executable work。 -->

### Baseline / Input Read Set

<!-- 列出本 proposal 实际读取的用户输入、existing specs、代码路径、测试、配置、设计稿、issue 或外部文档。不要填入未读取的宽泛来源。 -->

| Input                                                            | Reference                                | Purpose                                       | Result                                 |
| ---------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------- | -------------------------------------- |
| <!-- 用户请求 / existing spec / code / test / design / issue --> | <!-- path、URL、消息摘要或 spec 名称 --> | <!-- baseline / scope / conflict / impact --> | <!-- confirmed / refined / blocker --> |

### Change Scope Coverage

<!-- 每个 material scope item 一行。Scope Item ID 使用 change-local SI-###，只在本 change 内有效，不使用 ranges。Artifact Handling 只能为 spec / guard / design / proof / context。 -->

| Scope Item ID | Input / Baseline Source                                        | Scope Type                                           | Artifact Handling                                | Capability               | Behavior / Constraint             | Evidence Need                                                       | Downstream Coverage                              |
| ------------- | -------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------ | ------------------------ | --------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| `SI-001`      | <!-- 用户请求 / existing spec / code path / issue / design --> | <!-- behavior / guard / design / proof / context --> | <!-- spec / guard / design / proof / context --> | <!-- capability name --> | <!-- 具体行为、边界或验证要求 --> | <!-- unit / component / API / DB / E2E / security / smoke / N/A --> | <!-- specs/design/tasks coverage expectation --> |

### Proposal Alignment Gate

- Existing specs read: <!-- paths / none -->
- Baseline code or tests read: <!-- paths / none -->
- External inputs read: <!-- issue/design/doc/URL / none -->
- Scope items covered by proposal: <!-- SI-001, SI-002；逐个枚举，不使用 ranges -->
- Artifact handling coverage: <!-- 每个 SI-### 的 handling 已记录并有 downstream coverage -->
- New capabilities: <!-- names / none -->
- Modified capabilities: <!-- names / none -->
- Non-goals captured: <!-- summary -->
- Open design decisions: <!-- summary / none -->
- Blockers: <!-- 无 / 具体 blocker -->
