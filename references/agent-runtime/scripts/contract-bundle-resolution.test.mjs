import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function repoPath(...segments) {
  return path.join(repoRoot, ...segments);
}

function readRepoFile(...segments) {
  return fs.readFileSync(repoPath(...segments), "utf8");
}

test("proposal specs design runtime-acceptance verification and tasks contract bundles use role-specific files", () => {
  for (const artifact of ["proposal", "specs", "design", "runtime-acceptance", "verification", "tasks"]) {
    for (const file of ["index.md", "trace-schema.md", "writer.md", "reviewer.md"]) {
      assert.equal(
        fs.existsSync(repoPath("openspec", "schemas", "_production-contracts", "artifacts", artifact, file)),
        true,
        `${artifact}/${file} should exist`,
      );
    }
  }

  for (const schema of ["production-obligation-atom-driven", "production-default-acceptance-driven"]) {
    for (const artifact of ["proposal", "specs"]) {
      for (const file of ["index.md", "trace-schema.md", "writer.md", "reviewer.md"]) {
        assert.equal(
          fs.existsSync(repoPath("openspec", "schemas", "_production-contracts", "overlays", schema, artifact, file)),
          true,
          `${schema}/${artifact}/${file} should exist`,
        );
      }
    }
  }
});

test("legacy proposal specs runtime-acceptance verification and tasks contract entry files are removed", () => {
  const dotMd = ".md";
  for (const artifact of ["proposal", "specs", "runtime-acceptance", "verification", "tasks"]) {
    assert.equal(
      fs.existsSync(repoPath("openspec", "schemas", "_production-contracts", "artifacts", `${artifact}${dotMd}`)),
      false,
    );
  }

  for (const schema of ["production-obligation-atom-driven", "production-default-acceptance-driven"]) {
    for (const artifact of ["proposal", "specs"]) {
      assert.equal(
        fs.existsSync(repoPath("openspec", "schemas", "_production-contracts", "overlays", schema, `${artifact}${dotMd}`)),
        false,
      );
    }
  }
});

test("propose runtime keeps role-specific artifacts out of generic bundle resolution", () => {
  const runtime = readRepoFile("openspec", "agent-runtime", "openspec-propose-artifacts.md");

  assert.match(runtime, /非 `proposal` \/ `specs` \/ `design` \/ `runtime-acceptance` \/ `verification` \/ `tasks` artifact/u);
  assert.match(runtime, /artifacts\/proposal\/index\.md/u);
  assert.match(runtime, /artifacts\/proposal\/trace-schema\.md/u);
  assert.match(runtime, /artifacts\/proposal\/writer\.md/u);
  assert.match(runtime, /artifacts\/proposal\/reviewer\.md/u);
  assert.match(runtime, /artifacts\/specs\/index\.md/u);
  assert.match(runtime, /artifacts\/specs\/trace-schema\.md/u);
  assert.match(runtime, /artifacts\/specs\/writer\.md/u);
  assert.match(runtime, /artifacts\/specs\/reviewer\.md/u);
  assert.match(runtime, /artifacts\/runtime-acceptance\/index\.md/u);
  assert.match(runtime, /artifacts\/runtime-acceptance\/trace-schema\.md/u);
  assert.match(runtime, /artifacts\/runtime-acceptance\/writer\.md/u);
  assert.match(runtime, /artifacts\/runtime-acceptance\/reviewer\.md/u);
  assert.match(runtime, /artifacts\/verification\/index\.md/u);
  assert.match(runtime, /artifacts\/verification\/trace-schema\.md/u);
  assert.match(runtime, /artifacts\/verification\/writer\.md/u);
  assert.match(runtime, /artifacts\/verification\/reviewer\.md/u);
  assert.match(runtime, /artifacts\/tasks\/index\.md/u);
  assert.match(runtime, /artifacts\/tasks\/trace-schema\.md/u);
  assert.match(runtime, /artifacts\/tasks\/writer\.md/u);
  assert.match(runtime, /artifacts\/tasks\/reviewer\.md/u);
  assert.match(runtime, /proposal-writer.*不得包含任何 proposal reviewer contract/u);
  assert.match(runtime, /proposal-reviewer.*不得把 proposal writer contract/u);
  assert.match(runtime, /specs-writer.*不得包含 `artifacts\/specs\/reviewer\.md`/u);
  assert.match(runtime, /specs-reviewer.*不得把 `artifacts\/specs\/writer\.md`/u);
  assert.match(runtime, /runtime-acceptance-writer.*不得包含 `artifacts\/runtime-acceptance\/reviewer\.md`/u);
  assert.match(runtime, /runtime-acceptance-reviewer.*不得把 `artifacts\/runtime-acceptance\/writer\.md`/u);
  assert.match(runtime, /verification-writer.*不得包含 `artifacts\/verification\/reviewer\.md`/u);
  assert.match(runtime, /verification-reviewer.*不得把 `artifacts\/verification\/writer\.md`/u);
  assert.match(runtime, /tasks-writer.*不得包含 `artifacts\/tasks\/reviewer\.md`/u);
  assert.match(runtime, /tasks-reviewer.*不得把 `artifacts\/tasks\/writer\.md`/u);
  assert.doesNotMatch(runtime, /非 `proposal` \/ `design` artifact/u);
  assert.doesNotMatch(runtime, /非 `design` artifact/u);
  assert.doesNotMatch(runtime, /design` 是当前唯一/u);
});
