---
name: opsx-archive-with-validation
description: Validation-gated archive for OpenSpec changes: the standard path for archiving. Runs a four-phase flow (Phase 1 acceptance with real commands, Phase 2 repair, Phase 3 re-verification, Phase 4 archive) and refuses to archive unless every check item is pass with no pending matters. Use when the user wants to archive a change, wants acceptance run before archiving, or says "归档", "验收", "验收不过不准归档", "archive with validation", or "opsx archive with validation". Archiving without this acceptance flow is a bypass of the standard path.
allowed-tools: Bash, Read, Grep, Glob
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec-andor
  version: "1.0.0"
---

Archive an OpenSpec change only after a recorded, evidence-based acceptance pass.

**STANDARD ARCHIVE PATH (归档标准路径声明).** This skill is the standard path for archiving in every project that uses it.

- Any request that involves archiving an OpenSpec change defaults into this skill's four-phase flow: Phase 1 acceptance (验收) → Phase 2 repair (修复) → Phase 3 re-verification (复验) → Phase 4 archive (归档). When the user says "archive `<change>`", you enter Phase 1 for that change first — you never run an archive command before Phases 1–3 have produced a passing record for the current state of the change.
- Invoking the upstream archive flow without this skill's acceptance record is a bypass of the standard path. This includes running `openspec-archive-change` directly, running the `openspec archive` CLI command on your own initiative, or hand-moving a `changeRoot` into an `archive/` directory. Do not do any of these on an archive request unless the user, after seeing this declaration, explicitly rejects the standard path for that request; if that happens, record the user's rejection verbatim in a note, stop this skill, and hand the request back — this skill never performs an unverified archive itself.
- This declaration precedes every phase instruction in this file, and no later section reorders, weakens, or makes optional what it states. If any later wording appears to conflict with it, this declaration controls.
- The upstream `openspec-archive-change` skill stays unchanged and remains available as the non-standard fallback. This skill does not edit that skill. When this skill reaches Phase 4 it performs the same mechanical archive steps that skill defines, so the on-disk result of a validated archive is identical to an upstream archive; what this skill adds is the mandatory acceptance gate in front of those mechanics.

**Store selection:** If the user names a store (a store is a standalone OpenSpec repo registered on this machine) or the work lives in one, run `openspec store list --json` to discover registered store ids, then pass `--store <id>` on the commands that read or write specs and changes (`status`, `instructions`, `list`, `show`, `validate`, `archive`). Once selected, treat `--store <id>` as sticky for the rest of the flow. Every unscoped example of those commands below is shorthand: before running it, append the flag. Other commands, including the project's own build and test commands, do not take the flag. Hints printed by openspec commands already carry the flag; keep it on follow-ups. Without a store, commands act on the nearest local `openspec/` root.

**Project check:** These steps expect a project that already uses OpenSpec. Run `openspec list --json` (with `--store <id>` when a store is selected) and read `root`. A root object means the project is set up. `"root": null` means it is not — there is no `openspec/` directory here, and this skill has nothing to accept or archive. Do not create the root as a side effect, do not run `openspec init` unless the user asks for it, and do not hand-create `openspec/` files. If a command error starts with `Declared in` or `Invalid store declaration in` and names this project's `openspec/config.yaml` (or `config.yml`), the project uses a store this machine cannot resolve: stop before writing anything and show the user that error's `message` and `fix`.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous, run `openspec list --json` and prompt the user to select from the active changes (show only active changes, not already archived). Always announce: "Using change: <name>" and how to override it.

**Round model.** Every execution of the Phase 1 checklist is a numbered round, starting at round 1. A full re-execution in Phase 3 is the next round (round 2, round 3, ...). Rounds drive the pending ledger and the escalation counters described in "Pending ledger" below. Round history is persisted so counters and open matters survive session boundaries:

- Persist each round's acceptance report to `openspec/changes/<name>/acceptance-report.md`, overwriting the file's snapshot sections with the newest round and appending to its cumulative "Round log" section.
- When the flow starts (or resumes in a new session), read `openspec/changes/<name>/acceptance-report.md` if it exists. Take the next round number from the round log, and carry every open pending entry forward with its original id and `first pending round`; bump each carried entry's consecutive-pending count by one.
- Never rewrite or delete prior rounds' entries in the round log; the log is append-only.
- If the report file cannot be written (read-only tree, missing change directory), say so in the report output, keep the ledger in the conversation, and mark the flow "report persistence unavailable" — the gate rules still apply in full.

**Policy constants.** The definitions in this section are fixed. Do not reinterpret, extend, or soften them at runtime; if a situation seems to need a fourth verdict or a weaker gate, that situation is handled by the escalation and ledger rules below, not by redefining these constants.

1. **Check-item verdict — exactly three states.** Every check item receives exactly one verdict per round:

   | verdict | meaning |
   |---------|---------|
   | `pass` | The item's real command(s) ran in this round and the observed output satisfies the item's expected result. |
   | `fail` | The item's real command(s) ran in this round and the observed output does not satisfy the expected result; a finding is produced. |
   | `not_verified` | The item's real command(s) could not be executed or its evidence could not be gathered in this round (command not installed, no permission, missing external credential, required environment absent, unreadable input). The item is inconclusive this round — no more, no less. |

   There is no fourth state. There is no "not applicable" verdict: a category that does not apply to the change at all is dropped at checklist construction time with a recorded structural reason (Phase 1 step 3), before it ever becomes a check item. `not_verified` is not "probably fine"; it is a hard inconclusive result with the same archive-blocking force as `fail`.

2. **Archive interception rule.** The overall verdict is `pass` if and only if every check item in the round is `pass`. If any item is `fail` or any item is `not_verified`, the overall verdict is not `pass` and the skill MUST NOT execute the archive. The blocking force of `not_verified` and `fail` is identical; they differ only in what happens next (a `fail` feeds Phase 2 repair, a `not_verified` feeds evidence-gathering or the pending ledger). Worked shape: with 10 constructed items where 9 are `pass` and 1 is `not_verified`, the overall verdict is not `pass`, the archive does not run, and the flow continues into repair or pending handling — the 9 passes do not buy anything.

3. **Finding — two mandatory fields.** Every finding produced from a `fail` or `not_verified` item carries both:

   - `gap_type` — exactly one of:

     | gap_type | meaning | typical evidence shape |
     |----------|---------|------------------------|
     | `missing` | The spec requires a behavior and the code lacks it (spec has it, code does not). | spec entry cites behavior X; codebase search finds no implementation of X. |
     | `wrong` | The code implements the behavior but diverges from the spec's stated behavior (spec has it, code has it, they disagree). | implementation site exists but contradicts the requirement/scenario text, or a test fails against the stated behavior. |
     | `extra` | The implementation includes behavior or files beyond what any spec entry requires, within the change's own feature area (code has it, spec has no matching entry). | surplus behavior in the change's own files with no requirement, design decision, or task behind it. |
     | `unrequested` | The change contains modifications no requirement, design decision, or task requested — work outside the change's declared scope (code has it, nothing asked for it). | diff touches files or behavior outside the change's declared scope entirely. |

     Choose `gap_type` from the observed nature of the gap, not from convenience: absent behavior is `missing`; present-but-divergent is `wrong`; surplus inside the feature area is `extra`; out-of-scope work is `unrequested`. When torn between `extra` and `unrequested`, ask whether the surplus still serves the change's declared subject (→ `extra`) or sits wholly outside it (→ `unrequested`).

   - `source_ref` — a two-way evidence anchor with both ends, each locatable from the other:

     - `code`: a concrete code location — file path with line range, or file path with symbol name.
     - `spec`: the concrete spec entry the code location must satisfy — capability and `Requirement:` name plus `Scenario:` name; or the change artifact path and section (proposal/design/tasks) when no capability spec covers the behavior.

   A reviewer holding `source_ref` must be able to jump from the code location to the spec entry and back: the code end names the symbol and lines that realize (or fail to realize) the behavior; the spec end names the requirement and scenario whose text decides pass/fail. A finding missing either field is invalid (Phase 1 step 7).

4. **Pending statuses.** Matters that are not settled at round end enter the pending ledger with one of three statuses:

   - `not_verified` — a check item whose evidence could not be gathered this round (mirrors the verdict; every `not_verified` verdict has a ledger entry).
   - `blocked` — a matter that cannot proceed due to an external dependency: a missing credential, a fix owned upstream, another change in flight, or a needed human decision.
   - `paused` — a matter the user explicitly set aside or deferred this round, with the user's stated reason recorded.

   Every open entry — regardless of status — blocks the archive until it is resolved and the resolution is confirmed by a later round.

5. **Escalation rule (3 rounds).** A ledger entry that remains open for 3 consecutive rounds is escalated to human ruling at the end of its third round: the report marks it `escalated_to_human (R<n>)`, the matter is presented to the user with everything needed to rule, and from that round on the skill performs no automatic retries for it — no re-running of its command, no workarounds, no repeated prompting inside the flow. The entry stays visible in every later report until a human ruling closes or resolves it. A ruling may close a ledger matter only with a recorded rationale; a ruling never converts a check-item `not_verified` or `fail` verdict into `pass` — only a later round's real run with real evidence can replace a verdict.

**Steps**

1. **Phase 1 — Acceptance (验收)**

   **Entry condition:** an archive request exists, the change is selected, and the round number is known. **Exit condition:** all N check items carry a three-state verdict backed by this round's evidence, findings are recorded with validity marked, the pending ledger is updated, and the round's acceptance report is persisted.

   1. **Select and announce the change.** Use the provided name, infer from context, auto-select when only one active change exists, or prompt from `openspec list --json`. Announce: "Using change: <name> — entering Phase 1 acceptance (round <R>)". Do not run any archive command in this phase. Do not route to the upstream archive flow as a shortcut for anything Phase 1 does.

   2. **Read the persisted report for round continuity.** If `openspec/changes/<name>/acceptance-report.md` exists, read it. Take the next round number from the round log, and carry every open pending entry into this round's ledger unchanged (same id, same `first pending round`, consecutive-pending count +1). If it does not exist, this is round 1 with an empty ledger. Session boundaries do not reset counters: a matter open in a previous session's last round is open with consecutive count ≥ 1 in this one.

   3. **Construct the acceptance checklist.** Build the checklist from the default categories below. Record the construction in the report as a table: category, constructed (yes/no), and for every "no" a structural reason. The checklist has N items; N is the number of constructed categories. The per-category procedures (commands, expected results, fail shapes, not_verified causes) are defined in "Check procedures" below.

      | id | category | constructed when | real check |
      |----|----------|------------------|------------|
      | C1 | Artifact completion | always | `openspec status --change "<name>" --json` — every artifact `done` or `skipped` |
      | C2 | Task completion | always | `openspec list --json` — `completedTasks == totalTasks`, zero incomplete |
      | C3 | Delta spec validity | always | `openspec validate "<name>" --strict` |
      | C4 | Requirement implementation mapping | any ADDED/MODIFIED requirement exists | for each requirement: search the codebase for implementation evidence; record `file:line` per requirement |
      | C5 | Scenario coverage | any ADDED/MODIFIED scenario exists | for each scenario: locate a test or executable evidence; run the targeted test when one exists |
      | C6 | Removed/renamed behavior gone | delta contains REMOVED/RENAMED requirements | read the baseline behavior from the main spec; search the codebase for it; expect absence |
      | C7 | Build green | project has a build step | run the project's build command (in this fork: `corepack pnpm build`) |
      | C8 | Test suite green | project has tests | run the full test suite (in this fork: `corepack pnpm test`) |
      | C9 | Generation parity | template sources touched (`src/core/templates/` etc.) | run the regen pipeline and the parity tests; generated trees must match template output |
      | C10 | Declared docs impact | the change declares documentation impact | verify each claimed doc update exists and matches the shipped behavior |

      **Drop rules.** A category is dropped only for a structural reason: the change's schema defines no such artifact, the change declares a skip (for example `skip_specs: true`), or the category's subject does not exist in this change (no REMOVED requirements, no template sources touched, no docs impact declared, no build step). Difficulty, missing evidence, or a failing command is never a drop reason — those make the item `not_verified` or `fail`, not dropped. Every drop is recorded with its structural reason in the construction table; a dropped category never becomes a check item and needs no verdict. Keep the construction table in the report so a reviewer can audit every drop.

   4. **Execute every check item with real commands.** Run each constructed item's check in this round, following its procedure under "Check procedures". Record per item:

      - `command`: the actual command text as run, verbatim, including flags.
      - `output`: a 1–3 line summary quoting the decisive output lines (exit status, counts, error text, matched locations). Quote real output only — never paraphrase into an assumption and never invent output.
      - `verdict`: `pass` or `fail` (or `not_verified` per step 5), judged from the recorded output.

      For C4 and C5 the "command" may be a Grep/Read plus a targeted test run; still record what was searched or run and what it returned. A verdict is judged from evidence produced in this round; a verdict carried over from a previous round without re-execution is not allowed.

   5. **Handle unexecutable items as `not_verified`.** If an item's command cannot run in this environment — the tool is not installed, permission is missing, an external credential is required, a needed service or file is absent, or the input cannot be read — record the item with verdict `not_verified` and a concrete reason naming the blocker (which command, what is missing). MUST NOT mark such an item `pass`; MUST NOT silently skip it; MUST NOT drop it from the report. If only part of an item's evidence can be gathered, the item is `not_verified` with the reason describing the missing part. Every constructed item ends the round with exactly one of the three verdicts: there is no such thing as an item without a verdict or without a recorded reason.

   6. **Produce findings from every non-pass item.** Each `fail` or `not_verified` item yields at least one finding in this format:

      ```markdown
      - finding: F-<n>
        related check: C<k>
        verdict: fail | not_verified
        gap_type: missing | wrong | extra | unrequested
        description: <one sentence stating the observed gap>
        source_ref:
          code: <file path>:<lines or symbol>
          spec: <capability> spec — Requirement: <name> / Scenario: <name>
      ```

      For a `not_verified` item the finding records what evidence was missing and what would make the check runnable; its `spec` end still names the entry the check would have verified. Example of a complete finding:

      ```markdown
      - finding: F-2
        related check: C4
        verdict: fail
        gap_type: wrong
        description: Whitelist dirs are still wiped on regeneration — the cleanup never consults the whitelist.
        source_ref:
          code: src/core/shared/skill-generation.ts:88-104 (cleanSkillSubdirectories removes every subdirectory unconditionally)
          spec: opsx-manual-skill-whitelist spec — Requirement: 白名单清理豁免 / Scenario: 再生成保留白名单目录
      ```

   7. **Enforce finding validity before Phase 2.** A finding missing `gap_type` or missing either end of `source_ref` is invalid: mark it `invalid: missing <field>` in the report and return it to Phase 1 evidence gathering (re-run the search, re-read the spec entry, complete the anchor). An invalid finding MUST NOT drive any code change in Phase 2 — repair based on an invalid finding is prohibited even if the guessed fix seems obviously right. If the evidence cannot be completed, the underlying item keeps its `fail`/`not_verified` verdict and the matter enters the pending ledger; an invalid finding is never silently deleted from the report.

   8. **Aggregate the round verdict.** Overall verdict for round R:

      - every item `pass` → overall `pass` → Phase 4 is reachable (after Phase 3's confirmation rules below);
      - any item `fail` → overall `fail` → proceed to Phase 2 with the findings;
      - any item `not_verified` (even exactly one, all others `pass`) → overall not `pass` → no archive; gather the missing evidence (re-run in the next round) or, when the blocker is external, enter it in the pending ledger as `blocked`/`not_verified` and continue to Phase 2 for whatever else is repairable.

   9. **Update the pending ledger.** For every `not_verified` verdict, every `blocked` matter, and every `paused` matter, append or update a ledger entry (format under "Pending ledger" below) with the round number, and write the round's acceptance report to `openspec/changes/<name>/acceptance-report.md`.

2. **Phase 2 — Repair (修复)**

   **Entry condition:** the round's overall verdict is not `pass` and at least one valid finding exists. **Exit condition:** every valid finding is either repaired with a recorded change, or explicitly held open by the user (which keeps its check failing and its ledger entry open), and the change is ready for a full re-verification.

   1. **Repair only from valid findings.** Work through the findings list in check order. Each repair is the minimal change that makes the finding's `source_ref` code location satisfy its `source_ref` spec entry. Do not bundle unrelated improvements into a repair; unrelated observed problems become new findings in the next round, not drive-by edits. Do not "fix" a `not_verified` finding by changing code — its gap is evidence, not behavior.
   2. **Invalid findings drive nothing.** A finding marked `invalid: missing <field>` is not repairable in this phase. Complete its evidence (Phase 1 step 7) first; only then may it produce a repair.
   3. **Record every repair.** For each repaired finding record: finding id, files touched, and the intent ("makes C5 scenario X pass by ..."). This record is the input the next round's re-verification is checked against — Phase 3 confirms these specific findings turned `pass`.
   4. **Declined repairs stay open.** If the user declines to repair a finding, do not repair it and do not delete it: the finding, its item verdict (`fail`/`not_verified`), and its ledger entry (`blocked` or `paused`, with the user's stated reason quoted) all remain in the report. The archive stays blocked while they are open, and the declined finding counts as a pending matter for the escalation rule.
   5. **No verdict edits.** Phase 2 never edits verdicts directly. A repaired item's verdict changes only when Phase 3 re-runs the check and the new evidence supports `pass`.
   6. **Loop back target.** After Phase 2 completes, the flow always proceeds to Phase 3. Skipping Phase 3 and going to Phase 4 directly is prohibited, even when the repairs look trivial or the failing items "obviously" pass now.

3. **Phase 3 — Re-verification (复验)**

   **Entry condition:** Phase 2 ended (repairs recorded, or nothing was repairable and the round ended non-pass). **Exit condition:** a full round with all items `pass` (→ Phase 4), or the round ended non-pass and the loop rules below decide the next step.

   1. **Re-run the full Phase 1 checklist.** Phase 3 is a complete new round (round R+1), not a spot-check: re-run all N constructed items with real commands, including the items that passed last round, because repairs can regress unrelated checks. Reuse the construction table; re-verify that every drop reason still holds (a drop reason that no longer holds — for example template sources are now touched — constructs the category from this round on).
   2. **Confirm the original findings turned `pass`.** For every finding repaired in Phase 2, check that its related check item is now `pass` in this round's evidence. An item that is still `fail` means the repair did not take effect: produce a new finding and go back to Phase 2.
   3. **New fails go back to repair.** If re-verification produced any new `fail` item, return to Phase 2 with the new findings. Looping Phase 2 → Phase 3 is expected and each pass through Phase 1 is a new round with its own evidence.
   4. **`not_verified` in re-verification.** Treat per Phase 1 step 8: gather the missing evidence and re-run in the next round, or ledger it as `blocked` when the blocker is external. A `not_verified` item never advances to Phase 4.
   5. **Escalation applies here too.** At the end of each re-verification round, apply the 3-round escalation rule to every still-open ledger entry. An escalated matter is presented to the human and then waits; it is not auto-retried (see "Pending ledger").
   6. **No archive with open items.** Phase 4 is reachable only from a round in which every item is `pass` and the pending ledger has no open entries. Reaching Phase 3's end with any non-pass item or any open entry means the flow stops there and reports; it does not archive.

4. **Phase 4 — Archive (归档)**

   **Entry condition (the gate, all of it):** the latest round's overall verdict is `pass` — every check item is `pass` — AND the pending ledger has no open entries (every entry resolved and confirmed by a later round, or closed by a recorded human ruling) AND the user has confirmed the archive after seeing the final report.

   1. **Show the final acceptance report.** Present the round's full report (verdict table, findings, pending ledger) and ask the user to confirm the archive. An archive without this confirmation is a bypass of the standard path.
   2. **Perform the mechanical archive exactly as `openspec-archive-change` defines it.** This skill replaces that skill's entry point, not its mechanics — follow the upstream steps verbatim, with the same selected-root flags:
      - Assess delta-spec sync state from `artifactPaths.specs.existingOutputPaths` (no delta specs → proceed without a sync prompt). For each capability with a delta spec, compare it against the main spec; a new capability's main spec is an output of the sync, so only ADDED requirements can create one — a REMOVED-only or ADDED-less delta is sync-blocked, and a REMOVED-only delta on a retired capability (`retire_capabilities: true`) counts as already synced. Show the combined summary and route on the user's choice exactly as the upstream skill specifies ("Cancel" / "Archive without syncing" / "Sync now"); never start a sync while any capability is sync-blocked.
      - When sync is selected, run the `openspec-sync-specs` workflow inline (agent-driven), reusing one `openspec instructions specs --change "<name>" --json` snapshot, and verify each written main spec against the upstream sync contract (title, `## Purpose` handling, no delta-style section headers remaining, `### Requirement:`/`#### Scenario:` structure). Any sync stop or mismatch → the sync failed → stop the archive immediately; nothing has moved.
      - Create `archive/` under `planningHome.changesDir` if missing; derive the target name from the change name with a `YYYY-MM-DD-` prefix (never stack a second date); if the target exists, fail with an error and stop; otherwise move `changeRoot` into the archive directory. Preserve `.openspec.yaml` (it moves with the directory).
   3. **Attach the final acceptance report to the archive output.** The archive summary MUST include the change name, archive location, the final round number, the full verdict table, and the final pending-ledger state (empty at this point), so the archived record shows what was verified and how.

**Check procedures.** Per-category procedures for the Phase 1 checklist. Each category below states its purpose, the real check, what counts as `pass`, what produces a `fail` finding (with the expected `gap_type`), and the causes that make it `not_verified`. In all cases the evidence rule holds: record the command verbatim and quote decisive output.

- **C1 Artifact completion.** Purpose: confirm the change's artifact graph is complete before deeper checks. Command: `openspec status --change "<name>" --json`. Read `schemaName`, `planningHome`, `changeRoot`, `artifactPaths`, and each artifact's status. `pass`: every artifact is `done` or `skipped` (a `skipped` artifact satisfies the requirement — the change declares a skip). `fail`: any artifact neither `done` nor `skipped` → finding `missing` (artifact absent), `spec` end = the change's schema artifact list. `not_verified`: CLI unavailable, invalid JSON, or the change cannot be found.
- **C2 Task completion.** Purpose: confirm every tracked task is complete. Command: `openspec list --json`; find the entry whose `name` exactly matches the selected change; require exactly one match with nonnegative integer `totalTasks` and `completedTasks`, `completedTasks <= totalTasks`. Incomplete = `totalTasks - completedTasks`. `pass`: zero incomplete (`totalTasks` zero passes without a warning). `fail`: incomplete > 0 → finding `missing` per incomplete task (use the task descriptions; do not infer completion from artifact status or from the absence of a top-level `tasks.md`). `not_verified`: lookup fails, the change is missing or duplicated, or counts are invalid — report the problem rather than guessing.
- **C3 Delta spec validity.** Purpose: the change's specs must pass strict validation. Command: `openspec validate "<name>" --strict` (in a source checkout: `node ./bin/openspec.js validate "<name>" --strict`). `pass`: no validation issues under `--strict`. `fail`: any validation issue → finding `wrong`, `spec` end = the requirement path named in the validation message. `not_verified`: CLI missing or the command is unsupported in this environment.
- **C4 Requirement implementation mapping.** Purpose: every ADDED/MODIFIED requirement has implementation evidence. Procedure: read the delta specs (spec artifacts are those whose `artifactPaths.<id>.outputPath` is under `specs/`); for each ADDED or MODIFIED requirement (for MODIFIED, the delta's new text, not the old wording), derive search terms from the requirement and scenario text; Grep the implementation tree; Read the candidate sites to confirm intent. Matches inside `openspec/` artifacts, docs, or comments are not implementation evidence by themselves. `pass`: every requirement has at least one credible code site recorded as `file:line`. `fail`: requirement with no evidence → `missing`; site that contradicts the requirement → `wrong`; surplus behavior in the feature area → `extra`; modifications nothing requested → `unrequested`. `not_verified`: delta specs unreadable or contain no usable requirements — record the reason; do not pass the item on partial reads. Reasonable inference from search results is allowed, but record the searches that were run.
- **C5 Scenario coverage.** Purpose: every ADDED/MODIFIED scenario has test or executable evidence. Procedure: for each scenario, search the test tree for keywords, symbols, or fixtures tied to the scenario; when a candidate test exists, run it (the project's test runner, targeted file). `pass`: the scenario has a test that ran green in this round, or explicit executable evidence recorded. `fail`: scenario with no locatable test → `missing` (test); a test that exists but contradicts the scenario → `wrong`. `not_verified`: the test runner cannot run here, or no test evidence is locatable — record which. Skip scenarios under REMOVED requirements; that behavior is meant to be gone (C6 covers it).
- **C6 Removed/renamed behavior gone.** Purpose: REMOVED behavior is actually gone; RENAMED behavior survives under the new name. Constructed only when the delta contains REMOVED or RENAMED requirements. Procedure: a REMOVED block names the requirement but does not describe the behavior, so first read the baseline from the main spec at `<planningHome.root>/openspec/specs/<capability-path>/spec.md`, matching the exact normalized requirement name (the heading text after `Requirement:`, trimmed; case-sensitive). If the main spec no longer has it, recover the baseline from the planning repository's history: `git -C "<planningHome.root>" log -p -- openspec/specs/<capability-path>/spec.md`, or `git -C "<planningHome.root>" show <commit>^:./openspec/specs/<capability-path>/spec.md` once the applying commit is known. Empty history output means the pathspec matched nothing — re-check the path before concluding. A baseline with no body beyond a restatement of the name and no scenarios is unusable. Then search the codebase for the baseline behavior (matches in `openspec/` artifacts or code serving only the Migration note are not evidence). `pass`: the behavior is absent (search actually performed and recorded). `fail`: still delivered → `wrong` (the requested end-state is absence), name the delivering code path; for RENAMED, the TO behavior missing → `missing`. `not_verified`: no usable baseline — record the reason; an unsearched removal is never `pass`.
- **C7 Build green.** Purpose: the project builds as shipped. Command: the project's build command (in this fork: `corepack pnpm build`). `pass`: exit 0. `fail`: nonzero exit or build errors → finding `wrong` with the failing lines quoted. `not_verified`: toolchain missing (no corepack/node), dependencies not installed when installation is out of scope for this run — record the reason.
- **C8 Test suite green.** Purpose: the project's tests pass as shipped. Command: the full test suite (in this fork: `corepack pnpm test`). Targeted scope runs during repair do not replace this item; the round's official verdict uses the full suite. `pass`: exit 0 with pass/fail counts recorded. `fail`: any failing test → finding `wrong` per failing test group, quoting test names. `not_verified`: the suite cannot run in this environment — record the reason.
- **C9 Generation parity.** Purpose: generated artifacts match template sources. Constructed when the change touched template sources (`src/core/templates/` or other generation inputs). Command: `corepack pnpm build && corepack pnpm regen:parity-hashes && corepack pnpm generate:skills`, then the parity suite (in this fork: `corepack pnpm test test/core/templates/`). `pass`: parity tests green and regeneration produced no unexpected content change. `fail`: parity red or regeneration rewrites files the change did not account for → finding `wrong`, `code` end = the drifted generated file or template source. `not_verified`: pipeline commands unavailable in this environment — record the reason.
- **C10 Declared docs impact.** Purpose: documentation the change declares is actually updated. Constructed when the change declares documentation impact (proposal Impact, tasks, or design). Procedure: Read each claimed doc page; compare its statements against the shipped behavior evidenced in C4/C5. `pass`: every declared update exists and matches. `fail`: missing update → `missing`; update that misstates the behavior → `wrong`. `not_verified`: the docs tree is unavailable or the claim is too vague to locate — record the reason and ask the change owner to name the paths.

**Pending ledger.** The ledger is the report's tail section, titled "Pending ledger (未决清单)". It is mandatory in every acceptance report, including a report with zero entries (then it reads "none"). It collects every open `not_verified`, `blocked`, and `paused` matter with round attribution:

```markdown
## Pending ledger (未决清单)

| id | matter | status | first pending round | consecutive pending rounds | source round | escalation |
|----|--------|--------|---------------------|----------------------------|--------------|------------|
| P-1 | C6 — REMOVED baseline unreadable (main spec history unavailable) | not_verified | R2 | 2 | arose R2, carried through R3 | none |
| P-2 | Docs screenshot refresh awaiting designer asset | paused | R1 | 3 | arose R1, carried through R2–R3 | escalated_to_human (R3) |
```

- **All entries in, always.** Every open `not_verified`/`blocked`/`paused` matter appears here, whatever its origin phase. No open matter may live only in prose or only in a check row; the ledger is the complete list. A report with any non-pass item and an empty ledger is malformed — find the missing entry.
- **Round attribution.** Each entry records the round it arose (`first pending round`), how many consecutive rounds it has stayed open, and the rounds it was carried through. A matter is "the same" across rounds when it names the same check item and the same underlying cause; a new cause on the same item is a new entry.
- **Escalation.** When an entry's `consecutive pending rounds` reaches 3, set its escalation to `escalated_to_human (R<n>)` at that round's end, present the matter to the user with everything needed to rule (the finding, both `source_ref` ends, what was attempted in which round), and stop all automatic retries for it from that round on. Later rounds keep showing the entry unchanged except for the carried-through round numbers and any user-stated ruling note. A ruling that closes the entry must be quoted in its note; a ruling that resolves the root cause returns the underlying check to the normal verification loop, where it must actually pass before the gate opens.
- **Blocking.** Every open entry blocks the archive, regardless of status. The ledger being non-empty and the gate being closed are the same fact.

**Worked round example.** A template-touching change in round 2, with the ledger carried from round 1:

- Construction: C1–C8, C9 constructed (template sources touched); C10 dropped (no docs impact declared, structural reason recorded).
- Execution: C1–C5, C7, C8, C9 `pass` with recorded commands and outputs; C6 dropped last round and this round (no REMOVED requirements).
- One exception: C8 `not_verified` — "test runner could not start: no node modules installed and install was out of scope this round".
- Findings: F-3 from C8 (`not_verified`; `gap_type: wrong` is not used here — the finding records the missing evidence and what would make the check runnable: "run `corepack pnpm install` then `corepack pnpm test`").
- Aggregation: overall verdict is **not pass** (one `not_verified` among nine `pass`) → no archive → next round re-runs the full checklist with the environment fixed.
- Ledger: P-1 (carried from R1, consecutive 2, escalation none) plus a new P-2 entry for the C8 `not_verified` (first pending round R2, consecutive 1). If P-1 is still open at the end of round 3, it escalates then.

**Acceptance report format.** Persist to `openspec/changes/<name>/acceptance-report.md` each round and present it to the user in this shape:

```markdown
# Acceptance report — <change-name>

Round: <R> · Date: <YYYY-MM-DD> · Skill: opsx-archive-with-validation 1.0.0

## Checklist construction

| category | constructed | structural reason (drops only) |
|----------|-------------|--------------------------------|
| C1 Artifact completion | yes | |
| C6 Removed/renamed behavior gone | no | delta contains no REMOVED/RENAMED requirements |

## Verdict table (round <R>)

| id | check | command (verbatim) | output summary | verdict |
|----|-------|--------------------|----------------|---------|
| C1 | Artifact completion | openspec status --change "<name>" --json | all artifacts done | pass |
| C2 | Task completion | openspec list --json | completedTasks 24/24 | pass |
| C3 | Delta spec validity | node ./bin/openspec.js validate "<name>" --strict | no validation issues (exit 0) | pass |
| C4 | Requirement implementation mapping | grep + read per requirement | 6/6 requirements evidenced (files listed) | pass |
| C5 | Scenario coverage | targeted vitest files | 9/9 scenarios covered | pass |
| C8 | Test suite green | corepack pnpm test | 929 passed, 0 failed (exit 0) | pass |

Overall verdict (round <R>): pass | fail | not pass (blocked by <ids>)

## Findings

- finding: F-<n>
  related check: C<k>
  verdict: fail | not_verified
  gap_type: missing | wrong | extra | unrequested
  description: <one sentence>
  source_ref:
    code: <file>:<lines or symbol>
    spec: <capability> spec — Requirement: <name> / Scenario: <name>
  status: open | repaired in R<r> | invalid: missing <field> | declined by user | escalated

## Repairs this round (Phase 2 rounds only)

- F-<n>: touched <files> — intent: <what the repair makes pass>

## Pending ledger (未决清单)

<the mandatory tail table; "none" when empty>

## Round log (append-only)

- R1 (date): overall <verdict>; N items: x pass / y fail / z not_verified; ledger: <ids>; repairs: <ids>
- R2 (date): overall <verdict>; N items: ...; ledger: <ids with consecutive counts>; repairs: <ids>
```

**Orchestration rules.** When orchestrating the flow, apply these rules in order:

1. **Standard-path routing.** Any archive request enters this skill and announces it. Route away only when the user explicitly rejects the standard path after seeing the declaration, and record the rejection verbatim before stopping.
2. **Fixed phase order.** Phases run 1 → 2 → 3 → 4, never skipped, never reordered. After any Phase 2 repair, Phase 3's full re-run is mandatory. Entering Phase 4 requires the Phase 3 gate, not the Phase 1 gate alone.
3. **Verdict gate.** Archive only when every check item is `pass` and the pending ledger has no open entries. `not_verified` blocks with the same force as `fail`.
4. **Evidence rule.** Every verdict cites commands actually run in the current round with real output summaries. "Looks right", "should pass", or a verdict inherited from an earlier round without re-execution is not evidence.
5. **Finding rule.** Every finding carries `gap_type` and both ends of `source_ref`; findings missing them are invalid and drive no code change.
6. **Loop rules.** Phase 3 new `fail` → Phase 2; a repaired finding must be confirmed `pass` by re-verification before Phase 4; each pass through the checklist is a new round with a new number.
7. **Escalation rule.** A ledger entry open for 3 consecutive rounds is escalated to human ruling at that round's end; from the third round on, the skill makes zero automatic attempts on it and keeps it visible in every later report.
8. **Report persistence.** Write `openspec/changes/<name>/acceptance-report.md` every round; read it at flow entry for round continuity; keep the round log append-only; carry open ledger entries forward untouched.
9. **Scope rule.** This skill verifies and archives. It does not implement change tasks (that is the apply flow's job), does not edit specs or change artifacts to make checks pass, and does not touch files outside evidence gathering, the persisted report, and the Phase 4 archive move.

**Common pitfalls (do not do these)**

- Marking a check `pass` because it passed last round. Verdicts are per-round; re-run.
- Treating a `not_verified` as a soft pass because "the rest is green". One `not_verified` blocks the archive.
- Summarizing a failing suite as "mostly passing". Quote the failing tests and mark `fail`.
- Repairing from a finding whose `source_ref` names no spec entry. Complete the anchor first.
- Dropping a category because its command failed or its evidence was hard to find. Drops need structural reasons; this is `not_verified` or `fail` instead.
- Searching only the requirement name for a REMOVED behavior. Read the baseline behavior from the main spec and search for that.
- Letting the pending ledger drift from the verdict table. Every `not_verified` verdict has a ledger entry, and every open entry blocks.
- Auto-retrying an escalated matter "one more time". From the third consecutive pending round, zero automatic attempts.

**Guardrails**

- Never execute an archive — CLI, upstream skill, or manual move — unless the current round shows every check item `pass` and the pending ledger has no open entries. One `not_verified` among all-else-`pass` blocks exactly like a `fail`.
- Never record `pass` for an item whose command did not actually run in the current round, and never omit a constructed item from the report. An unexecutable item is `not_verified` with a concrete reason, in the report, always.
- Never modify code based on a finding that lacks `gap_type` or `source_ref`. Complete the evidence first; an invalid finding drives nothing.
- Never downgrade, reinterpret, or argue away a `not_verified` or `fail` verdict; only a later round's real run with real output replaces a verdict.
- Never skip Phase 3 after a repair, and never archive while a re-verification `fail` or an open ledger entry exists.
- Never treat difficulty or missing evidence as a drop reason at checklist construction. Drops require structural reasons and are recorded; everything else is a check item with a three-state verdict.
- Never bundle unrelated edits into a repair, and never edit specs or change artifacts to make a failing check pass.
- Never make more than one automatic attempt per pending matter within a round; from an entry's third consecutive pending round, make zero.
- Never rewrite prior rounds' round-log entries; the log is append-only history.
- Keep the upstream archive mechanics intact in Phase 4; this skill adds the gate in front of them and changes nothing behind it.
- Report only real evidence. If the user instructs a bypass, record the instruction verbatim, stop this skill, and hand back with the report as-is.

**Output on success (Phase 4 complete)**

```markdown
## Archive Complete (validated)

**Change:** <change-name>
**Archived to:** <archive path>
**Acceptance:** round <R> — all <N> check items pass; pending ledger: none
**Final report:** openspec/changes/<name>/acceptance-report.md (verdict table and findings attached above)
```

**Output when blocked (any non-pass item or open ledger entry)**

```markdown
## Archive Blocked (standard path)

**Change:** <change-name>
**Round:** <R> — overall verdict: <fail | not pass>
**Blocking:** <list of fail/not_verified items and open ledger entries with ids>
**Next:** <Phase 2 repairs pending | evidence needed for <ids> | human ruling needed for <ids>>
No archive was executed. The acceptance report was persisted to openspec/changes/<name>/acceptance-report.md.
```

**Version history**

| Version | Change | Notes |
|---------|--------|-------|
| 1.0.0 | add-archive-with-validation-skill | Initial manual skill: standard-path declaration, four-phase flow, three-state verdict with archive interception, finding double field (`gap_type` + `source_ref`), pending ledger with 3-round escalation. |
