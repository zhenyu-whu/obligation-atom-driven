## ADDED Requirements

### Requirement: <!-- requirement name，优先中文；只有 exact source-native 技术标题才保留英文 -->

<!-- 使用 SHALL / MUST / MUST NOT 写规范行为。Requirement 正文只承载 spec-requirement atoms 或必要 spec-guard；不要把 design-obligation / verification-obligation 伪装成用户或系统行为 scenario。 -->

Source Atoms:
- `GA-0001`: <!-- exact Global Atom ID 和 obligation 摘要。逐个枚举 ID；不要使用 GA-0001-GA-0010 这类 ranges。 -->

Source Trace:
- <!-- exact source path + line range + source rule，例如 `docs/...` L10-L20。 -->

#### Scenario: <!-- scenario name，优先中文；只有 exact source-native 名称才保留英文 -->

- WHEN <!-- condition / actor / state / API / route / job / UI event -->
- THEN <!-- expected source-backed system behavior -->

## Artifact Projection Notes

<!-- 对没有进入 requirement/scenario 的 relevant atoms 做投射说明，尤其是 design-obligation、verification-obligation、spec-guard，或非 direct contextual-only。这里是 specs 内的 handoff 记录；design-obligation 必须在 design artifact 中实际消费，verification-obligation 必须在 tasks/proof 中实际消费。没有时写“无”。 -->

| Global Atom ID | Artifact Projection | Spec Handling | Design / Tasks Handoff |
| --- | --- | --- | --- |
| `GA-0001` | <!-- spec-guard / design-obligation / verification-obligation / contextual-only --> | <!-- guard / non-goal / noted only / not applicable --> | <!-- design section 或 tasks/proof expectation --> |

## Production Alignment Gate

- Global Atom IDs covered: <!-- GA-0001, GA-0002, ...；逐个枚举 exact IDs，不使用 ranges -->
- Artifact Projection coverage: <!-- spec-requirement 进入 requirement/scenario；spec-guard/design/verification/context 已在 notes/gate handoff；无 projection mismatch -->
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
