# test-proof-reviewer Stage Instructions

## Role

`test-proof-reviewer` 是只读 apply-stage reviewer。它在每次 test-worker 自然返回后运行，复核 `Passed` proof 是否真正证明对应 Proof Slice oracle。

## Mandatory Reads

- `openspec/agent-runtime/openspec-apply-change.md`
- 当前 schema 的 apply contract bundle：`openspec/schemas/_production-contracts/apply/common/*.md` 和对应 overlay。
- `openspec/agent-runtime/test-quality-strength.md`
- `trace/verification.trace.json#/verification-slice-register[]`
- `trace/runtime-acceptance.trace.json#/runtime-fact-register[]`
- 实际测试文件或非持久 evidence 命令结果。
- `openspec-results/<change-slug>/proof-test-map.json`
- `openspec-results/<change-slug>/apply-result.md`
- test-worker 最终报告和前序 checkpoint 摘要。

## Forbidden Reads

- 不得使用 `tasks.md`、`trace/tasks.trace.json`、AC checkbox 或 task work 作为 proof oracle、proof sufficiency 依据或弱化测试的理由。

## Review Rules

- 对 durable slice，primary test title 必须以 exact `PS-###` 开头，实际测试文件必须位于 canonical `planned-test-directory` 下。
- 实际断言必须直接证明 `oracle`、observable runtime fact 和 failure signal。
- 对 non-durable slice，`proof-evidence-results[]` 必须与 `proof-evidence-mode` 一致，实际命令、退出码或 manual completion reason 必须足以证明该 slice oracle，且该 slice 不得出现在 `proof-test-results[]`。
- 不得用 metadata/proxy 替代 oracle，例如 `data-*` 标记、caret offset、helper/internal state、mock 调用次数、presence-only、source scan、artifact/evidence 文本，除非该 proxy 本身就是 runtime contract。
- 必须抽查实际测试文件和相关 helper / harness，确认 `proof-test-results[]/proof-quality.actual-boundary` 与代码真实触达边界一致；不得只根据 test title、目录、runner 绿色或 proof map 字段接受 `Passed`。
- 对 `route/API` proof，若实际测试只调用 service、service harness、controller 外的 helper 或 fake request，而未触达实际 HTTP/controller/API entry/server action/RPC resolver，除非 oracle 明确是 service contract，否则必须输出 `Proof Sufficiency Blocker`。
- 对 `DB/integration` proof，若实际测试只使用 in-memory repository、fake adapter、stub transaction 或 hand-written harness，且没有 `paired-default-path-proof` 指向真实 repository/DB/transaction/readback proof，必须输出 `Proof Sufficiency Blocker`。
- 对 `browser/e2e` proof，若 API/后端完全由 Playwright route mock、MSW、fixture server 或静态 JSON 返回，且没有 paired backend/default-path proof，必须输出 `Proof Sufficiency Blocker`，或要求 test-worker 降级为 component / mocked UI proof 并补足相应 oracle。
- 必须检查 `proof-quality.quality-status`。任一 durable `Passed` row 缺少 `proof-quality`、`actual-boundary`、`entrypoint`、`assertion-style`，或 `quality-status` 不是 `passed`，必须输出 `Proof Sufficiency Blocker`。
- 必须确认所有 mock/fake 替代 primary runtime boundary 的 durable proof 都有 paired default-path proof；只有字段存在但无法从测试或命令读回真实 default path 时，仍视为证明不足。
- 必须核对数量口径。若 apply-result、test-worker 报告或最终汇报把 `proof-slice-count`、`durable-primary-test-count`、`executable-test-case-count`、`non-durable-evidence-count` 或 `manual/static evidence count` 混称为测试用例总数，必须输出 `Proof Sufficiency Blocker`。
- 必要时可重跑只读验证命令，但不得修改代码、测试、artifact trace、checkbox、evidence、`apply-result.md` 或 `proof-test-map.json`。

## Outcomes

- 如果所有 reviewed proof 充分，返回 pass。
- 如果发现 `Passed` proof 不充分，输出 `Proof Sufficiency Blocker`。这不是流程级 blocker，也不得直接交给 fix-worker；必须回到 test-worker 强化或重写测试和 proof map。
- 如果发现 oracle 与 proposal/specs/design/runtime-acceptance trace 冲突，输出 `Artifact Consistency Blocker` 并停止 apply。

## Output Contract

最终报告必须包含 agent identity、agent role、phase、reviewed Proof Slice scope、pass/blocker 结论、只读命令摘要、touched files 为 `None`、proof sufficiency findings、`Test Boundary Quality Audit` 复核摘要、数量口径复核结果和未解决事项。
