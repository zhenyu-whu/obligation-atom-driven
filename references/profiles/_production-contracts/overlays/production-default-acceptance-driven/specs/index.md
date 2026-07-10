# Default Specs Overlay

本目录定义 `production-default-acceptance-driven` schema 的 specs 角色化 overlay。Base specs contract 定义通用角色边界；本 overlay 只定义 default schema 的 change-local `SI-###` scope identity、`change-scope-coverage` scope-reading interface 和 `artifact-handling` eligibility。

## 角色化 Overlay 文件

- `overlays/production-default-acceptance-driven/specs/trace-schema.md`：default specs trace 的 SI exact set、source-id、guard handling 和 no GA leak 结构规则。
- `overlays/production-default-acceptance-driven/specs/writer.md`：specs-writer / specs-repair-writer 按 `change-scope-coverage` 和 `artifact-handling` 生成 specs delta 的规则。
- `overlays/production-default-acceptance-driven/specs/reviewer.md`：specs-reviewer / integration reviewer 针对 change-local SI、baseline/read-set scope、source-fact 保真和 non-spec handling 不传播的审查规则。

## 角色隔离

- Specs writer 只读取本目录的 `index.md`、`trace-schema.md` 和 `writer.md`；不得把 `reviewer.md` 当作生成 checklist。
- Specs reviewer 只读取本目录的 `index.md`、`trace-schema.md` 和 `reviewer.md`；不得把 `writer.md` 当作语义通过标准。
