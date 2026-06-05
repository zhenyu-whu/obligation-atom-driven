## ADDED Requirements

<!-- 只有当本 capability 有新增 requirement 或 guard 时使用。不要为了 pure design/proof/context item 创建空 spec。 -->

### Requirement: <!-- requirement name，优先中文；只有 exact source-native 技术标题才保留英文 -->

<!-- 使用 SHALL / MUST / MUST NOT 写规范行为。Requirement 正文只承载 spec-level behavior 或 guard。 -->

Scope Items:
- `SI-001`: <!-- exact Scope Item ID 和 scope 摘要。逐个枚举 ID；不要使用 SI-001-SI-010 这类 ranges。 -->

Baseline Trace:
- <!-- 用户请求、existing spec、code path、route、DTO、table、test、设计稿或 issue。没有外部来源时写“用户请求”。 -->

#### Scenario: <!-- scenario name，优先中文；只有 exact source-native 名称才保留英文 -->

- WHEN <!-- condition / actor / state / API / route / job / UI event -->
- THEN <!-- expected production behavior。若包含多个用户操作，逐项枚举或拆分 scenario，并写明 UI/API/data/reload/failure 后果。 -->

## MODIFIED Requirements

<!-- 修改 existing requirement 时必须复制完整 existing requirement block，再按 OpenSpec delta 修改。无修改时删除本节。 -->

## REMOVED Requirements

<!-- 只在有 Reason 和 Migration 时使用。无删除时删除本节。 -->

## RENAMED Requirements

<!-- 只在有 FROM / TO 时使用。无重命名时删除本节。 -->

## Production Alignment Gate

- Scope items covered: <!-- SI-001, SI-002；逐个枚举 exact IDs，不使用 ranges -->
- Artifact handling coverage: <!-- spec items 进入 requirement/scenario；guard items 进入 MUST NOT / non-goal / gate -->
- Proposal Change Scope Coverage consumed: <!-- 是 / blocker -->
- Baseline/input consumed: <!-- paths / user request / none -->
- Product workflow coverage: <!-- 说明覆盖的 workflow / route / lifecycle / object states -->
- Architecture/module coverage: <!-- package / runtime / module boundaries -->
- Data/API/backend coverage: <!-- tables / commands / APIs / DTOs / transactions / idempotency -->
- Auth/security/privacy coverage: <!-- auth / authorization / privacy / asset access / redaction -->
- Async/realtime/worker coverage: <!-- jobs / events / SSE / provider / queue / recovery -->
- Storage/asset coverage: <!-- assets / signing / retention / cleanup -->
- Observability/ops/deployment coverage: <!-- logs / metrics / migration / smoke / rollback -->
- Verification coverage: <!-- scenario-level proof expectations -->
- Forbidden drift checked: <!-- unplanned identifiers/routes/states/tables/jobs/providers/environments rejected -->
- Blockers: <!-- 无 / 具体 blocker -->
