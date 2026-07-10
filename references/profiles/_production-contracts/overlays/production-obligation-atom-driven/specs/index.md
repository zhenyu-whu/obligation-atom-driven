# Obligation Specs Overlay

本目录定义 `production-obligation-atom-driven` schema 的 specs 角色化 overlay。Base specs contract 定义通用角色边界；本 overlay 只定义 obligation schema 的 `GA-####` source identity、`change-ga-register` scope-reading interface、`artifact-routes[]` eligibility 和 non-direct boundary 限制。

## 角色化 Overlay 文件

- `overlays/production-obligation-atom-driven/specs/trace-schema.md`：obligation specs trace 的 GA direct set、source-id、guard handling 和 no non-direct propagation 结构规则。
- `overlays/production-obligation-atom-driven/specs/writer.md`：specs-writer / specs-repair-writer 按 `change-ga-register` 和 `artifact-routes[]` 生成 specs delta 的规则。
- `overlays/production-obligation-atom-driven/specs/reviewer.md`：specs-reviewer / integration reviewer 针对 direct GA、route eligibility、source-fact 保真和 pure verification 不传播的审查规则。

## 角色隔离

- Specs writer 只读取本目录的 `index.md`、`trace-schema.md` 和 `writer.md`；不得把 `reviewer.md` 当作生成 checklist。
- Specs reviewer 只读取本目录的 `index.md`、`trace-schema.md` 和 `reviewer.md`；不得把 `writer.md` 当作语义通过标准。
