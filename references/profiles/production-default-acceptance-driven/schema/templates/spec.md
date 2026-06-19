## ADDED Requirements

<!-- 只有当本 capability 有新增 requirement 或 guard 时使用。不要为了 pure design/proof/context item 创建空 spec。 -->

### Requirement: <!-- requirement name，优先中文；只有 exact source-native 技术标题才保留英文 -->

<!-- 使用 SHALL / MUST / MUST NOT 写规范行为。Requirement 正文只承载 spec-level behavior 或 guard。Scope item 与 baseline trace 明细写入 JSON trace。 -->

#### Scenario: <!-- scenario name，优先中文；只有 exact source-native 名称才保留英文 -->

- WHEN <!-- condition / actor / state / API / route / job / UI event -->
- THEN <!-- expected production behavior。若包含多个用户操作，逐项枚举或拆分 scenario，并写明 UI/API/data/reload/failure 后果。 -->

## MODIFIED Requirements

<!-- 修改 existing requirement 时必须复制完整 existing requirement block，再按 OpenSpec delta 修改。无修改时删除本节。 -->

## REMOVED Requirements

<!-- 只在有 Reason 和 Migration 时使用。无删除时删除本节。 -->

## RENAMED Requirements

<!-- 只在有 FROM / TO 时使用。无重命名时删除本节。 -->

## Trace Appendix

Trace file: `trace/specs/<capability>.trace.json`
Trace schema: `openspec-trace-v1`
Trace digest: `<sha256-to-be-filled-after-trace-json-is-written>`
