## ADDED Requirements

### Requirement: <!-- requirement name，优先中文；只有 exact source-native 技术标题才保留英文 -->

<!-- 使用 SHALL / MUST / MUST NOT 写规范行为。Requirement 正文必须覆盖 source-backed behavior、failure/recovery、data/API/auth/security/UX/verification obligations。 -->

Source Atoms:
- `GA-0001`: <!-- exact Global Atom ID 和 obligation 摘要。逐个枚举 ID；不要使用 GA-0001-GA-0010 这类 ranges。 -->

Source Trace:
- <!-- exact source path + line range + source rule，例如 `docs/...` L10-L20。 -->

#### Scenario: <!-- scenario name，优先中文；只有 exact source-native 名称才保留英文 -->

- WHEN <!-- condition / actor / state / API / route / job / UI event -->
- THEN <!-- expected source-backed system behavior -->

## Production Alignment Gate

- Global Atom IDs covered: <!-- GA-0001, GA-0002, ...；逐个枚举 exact IDs，不使用 ranges -->
- Proposal Change Atom Coverage Register consumed: <!-- 是 / blocker -->
- Capability atom view file consumed: <!-- path -->
- Source docs and line ranges read: <!-- exact source windows, not broad files -->
- Orphan direct atoms: <!-- none / exact GA blockers -->
- Product workflow coverage: <!-- 说明覆盖的 workflow / route / lifecycle / object states -->
- Prototype route/object/responsive coverage: <!-- relevant 时填写，否则“无” -->
- Architecture/module coverage: <!-- package / runtime / module boundaries -->
- Data/API/backend coverage: <!-- tables / commands / APIs / DTOs / transactions / idempotency -->
- Auth/security/privacy coverage: <!-- auth / authorization / privacy / asset access / redaction -->
- Async/realtime/worker coverage: <!-- jobs / events / SSE / provider / queue / recovery -->
- Storage/asset coverage: <!-- assets / signing / retention / cleanup -->
- Observability/ops/deployment coverage: <!-- logs / metrics / migration / smoke / rollback -->
- Verification coverage: <!-- scenario-level proof expectations -->
- Forbidden drift checked: <!-- unplanned identifiers/routes/states/tables/jobs/providers/environments rejected -->
- Blockers: <!-- 无 / 具体 blocker -->
