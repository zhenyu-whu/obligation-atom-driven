# Apply Evidence And Ready Contract

## 目的

本文档定义 apply evidence result、proof mapping、runtime fact reconciliation 和 ready-to-archive 判定。Evidence 由 apply runtime、runner、CI、worker 或 auditor 收集；不写回 `tasks.md` 或 `verification.md`，也不进入产品测试代码。

## Apply Result

- Apply evidence result 必须写入或更新 `openspec-results/<change-slug>/apply-result.md`。
- `apply-result.md` 是 archive 阶段读取 Proof Slice 结果、实际测试文件、实际命令、运行结果、manual/not-applicable 理由、blocker 处理和 subagent 报告摘要的事实来源。
- Apply result 至少记录：
  - change 名称和 schema 名称。
  - 每个 AC 的完成状态。
  - 每个 required / preserve runtime fact 的 tasks/verification 覆盖状态。
  - 每个 required Proof Slice 的最终 proof result。
  - `openspec-results/<change-slug>/proof-test-map.json` 路径。
  - 实际命令、退出状态或 CI result。
  - manual/environment/not-applicable source/scope-backed reason。
  - source/scope-compatible layer/owner 调整理由。
  - `Checkpoint Commits` 表。
  - 未解决 blocker。
  - implementation/test/test-proof-review/fix/repo-reviewer/repo-fix-worker/final-reviewer 报告摘要。

## Checkpoint Commits 表

`Checkpoint Commits` 表必须包含：

- `sequence`
- `agent-role`
- `agent-id`
- `phase`
- `scope`
- `status`
- `commit-sha`
- `changed-files`
- `notes`

无 diff、跳过或失败的 checkpoint 也必须记录 sequence 和 reason。Checkpoint commit 不写入 `proof-test-map.json`，也不得作为测试 oracle、Proof Slice evidence、runtime fact covered、final-reviewer pass 或 ready-to-archive 依据。

## Proof Test Map

- 详细 `runtime fact -> Proof Slice -> proof result` 机器映射必须写入 `openspec-results/<change-slug>/proof-test-map.json`。
- Schema 固定为 `openspec-proof-test-map-v1`。
- 每个 durable PS 必须有 exactly one `proof-test-results[]`，包含 `slice-id`、`status`、`runner`、`file`、`test-title`、`filter`、`command`，且 `file` 必须落在该 slice 的 canonical `planned-test-directory` 下。
- 每个 non-durable PS 必须有 exactly one `proof-evidence-results[]`，包含 `slice-id`、`proof-evidence-mode`、`status`、实际命令和退出码，或 manual environment completion reason，且不得写入 `proof-test-results[]`。
- `browser/e2e` 和 `visual/responsive` 的 `proof-test-results[]` 还必须包含 `execution-scope`、`validation-runs[]` 和 `flake-status`。
- `validation-runs[]` 必须记录 containing-file / related-suite / workspace 级命令、退出状态和稳定性探测参数；focused command 不能单独作为该类 slice 的最终 `Passed` evidence。
- 测试代码不得硬编码 `openspec-results/**`、change slug、AC ID 或 evidence path。Runner artifact 可通过测试框架 output directory、attachment/report 或 apply 执行方复制保存。

## Ready Gate

不得在以下条件全部满足前声称 apply 完成、复核通过或 ready to archive：

- `tasks.md` implementation checkbox 全部完成。
- 每个 required / preserve runtime fact 的 tasks closure 与 verification projection 均闭合。
- 每个 required Proof Slice 都有最终 proof result：持久测试 mapping、非持久 evidence result、source/scope-backed `Manual / Environment Gate` 或 source/scope-backed `Not Applicable`。
- 所有 durable slice 的测试文件落在 canonical `planned-test-directory` 下。
- 所有 non-durable slice 都只有 proof evidence result，未误入 `proof-test-results[]`。
- 不存在 unresolved `Authoring Blocker`、`Execution Failure`、`Proof Sufficiency Blocker`、`Artifact Consistency Blocker`、`Checkpoint Commit Blocker` 或流程级 blocker。
- 最新 test-proof-reviewer pass。
- `proof-test-map.json` 通过 `node openspec/agent-runtime/scripts/audit-proof-test-mapping.mjs --change "<change-slug>"`。
- `apply-result.md` 已写入并包含 checkpoint、worker/reviewer/repo review loop/final-reviewer 摘要。
- 最新 repo-reviewer 已按 `openspec/agent-runtime/repo-review-gate.md` 返回 `pass`，若存在 repo-fix-worker 则该 pass 晚于最新 repo-fix-worker，且不存在 unresolved `repo-test-entrypoint-missing`、`repo-test-environment-blocker`、P0/P1 `engineering-practice-finding` 或其它 repo review blocker。
- final-reviewer 返回 pass。
