# Obligation Proposal Overlay

- Proposal 必须读取 final packet、global atom index，以及必要 capability view。
- `Trace Appendix` 必须包含 `Obligation Atom Preconditions`、`Change Atom Coverage Register`、`Production Source Coverage`、`Source Window Read Set` 和 `Proposal Alignment Gate`。
- `Change Atom Coverage Register` 每行只能包含一个 exact `GA-####`。
- Delivery Plane 不得出现 exhaustive `GA-####` coverage、`Direct atoms`、`Projection mix` 或 `Global Atoms:`。
- 如果用户请求扩展到 planned change boundary 之外，必须报告超出 canonical change contract，不得在 proposal 中扩 scope。
