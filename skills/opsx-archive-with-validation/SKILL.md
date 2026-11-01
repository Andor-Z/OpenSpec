---
name: opsx-archive-with-validation
description: Validation-gated archive for OpenSpec changes: the standard path for archiving. Runs a four-phase flow (Phase 1 acceptance with real commands, Phase 2 repair, Phase 3 re-verification, Phase 4 archive) and refuses to archive unless every check item is pass with no pending matters. Use when the user wants to archive a change, wants acceptance run before archiving, or says "归档", "验收", "验收不过不准归档", "archive with validation", or "opsx archive with validation". Archiving without this acceptance flow is a bypass of the standard path.
allowed-tools: Bash, Read, Grep, Glob
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec-andor
  version: "1.1.0"
---

Archive an OpenSpec change only after a recorded, evidence-based acceptance pass.

**STANDARD ARCHIVE PATH (归档标准路径声明).** This skill is the standard path for archiving in every project that uses it.

- Any request that involves archiving an OpenSpec change defaults into this skill's four-phase flow: Phase 1 acceptance (验收) → Phase 2 repair (修复) → Phase 3 re-verification (复验) → Phase 4 archive (归档).
- When the user says "archive `<change>`", you enter Phase 1 for that change first. You never run an archive command before Phases 1–3 have produced a passing record for the current state of the change.
- Invoking the upstream archive flow without this skill's acceptance record is a bypass of the standard path. This includes:
  - running `openspec-archive-change` directly on an archive request,
  - running the `openspec archive` CLI command on your own initiative,
  - hand-moving a `changeRoot` into an `archive/` directory.
- Do not do any of the above unless the user, after seeing this declaration, explicitly rejects the standard path for that request. If that happens, record the user's rejection verbatim in a note, stop this skill, and hand the request back. This skill never performs an unverified archive itself.
- This declaration precedes every phase instruction in this file, and no later section reorders, weakens, or makes optional what it states. If any later wording appears to conflict with it, this declaration controls.
- The upstream `openspec-archive-change` skill stays unchanged and remains available as the non-standard fallback. This skill does not edit that skill. When this skill reaches Phase 4 it performs the same mechanical archive steps that skill defines, so the on-disk result of a validated archive is identical to an upstream archive; what this skill adds is the mandatory acceptance gate in front of those mechanics.

**Store selection:** If the user names a store (a store is a standalone OpenSpec repo registered on this machine) or the work lives in one, run `openspec store list --json` to discover registered store ids, then pass `--store <id>` on the commands that read or write specs and changes (`status`, `instructions`, `list`, `show`, `validate`, `archive`).

- Once selected, treat `--store <id>` as sticky for the rest of the flow.
- Every unscoped example of those commands below is shorthand: before running it, append the flag.
- Other commands, including the project's own build and test commands, do not take the flag.
- Hints printed by openspec commands already carry the flag; keep it on follow-ups.
- Without a store, commands act on the nearest local `openspec/` root.

**Project check:** These steps expect a project that already uses OpenSpec. Run `openspec list --json` (with `--store <id>` when a store is selected) and read `root`.

- A root object means the project is set up.
- `"root": null` means it is not — there is no `openspec/` directory here, and this skill has nothing to accept or archive. Do not create the root as a side effect, do not run `openspec init` unless the user asks for it, and do not hand-create `openspec/` files.
- If a command error starts with `Declared in` or `Invalid store declaration in` and names this project's `openspec/config.yaml` (or `config.yml`), the project uses a store this machine cannot resolve: stop before writing anything and show the user that error's `message` and `fix`.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous, run `openspec list --json` and prompt the user to select from the active changes (show only active changes, not already archived). Always announce: "Using change: <name>" and how to override it.

**Relationship to other skills.** The upstream `openspec-verify-change` workflow remains available as a standalone, advisory verification report; this skill does not replace or modify it. When this skill runs, its Phase 1 checklist is the acceptance record that counts for the archive gate — an earlier advisory verify report is context, never a substitute for a round's real commands.

**Round model.** Every execution of the Phase 1 checklist is a numbered round, starting at round 1. A full re-execution in Phase 3 is the next round (round 2, round 3, ...). Rounds drive the Rulings list (未决清单) and the escalation counters described in "Rulings" below.

- Round history is persisted so counters and open matters survive session boundaries.
- Persist each round's acceptance report to `openspec/changes/<name>/acceptance-report.md`, overwriting the file's snapshot sections with the newest round and appending to its cumulative "Round log" section.
- When the flow starts (or resumes in a new session), read `openspec/changes/<name>/acceptance-report.md` if it exists. Take the next round number from the round log, and carry every open Rulings entry forward with its original id and `first pending round`; bump each carried entry's consecutive-pending count by one.
- Never rewrite or delete prior rounds' entries in the round log; the log is append-only.
- If the report file cannot be written (read-only tree, missing change directory), say so in the report output, keep the Rulings list in the conversation, and mark the flow "report persistence unavailable" — the gate rules still apply in full.

**Policy constants.** The definitions in this section are fixed. Do not reinterpret, extend, or soften them at runtime; if a situation seems to need a fourth verdict or a weaker gate, that situation is handled by the escalation and Rulings rules below, not by redefining these constants.

1. **Check-item verdict — exactly three states.** Every check item receives exactly one verdict per round:

   | verdict | meaning |
   |---------|---------|
   | `pass` | The item's real command(s) ran in this round and the observed output satisfies the item's expected result. |
   | `fail` | The item's real command(s) ran in this round and the observed output does not satisfy the expected result; a finding is produced. |
   | `not_verified` | The item's real command(s) could not be executed or its evidence could not be gathered in this round (command not installed, no permission, missing external credential, required environment absent, unreadable input). The item is inconclusive this round — no more, no less. |

   - There is no fourth state. There is no "not applicable" verdict: a category that does not apply to the change at all is dropped at checklist construction time with a recorded structural reason (Phase 1 step 5), before it ever becomes a check item.
   - `not_verified` is not "probably fine"; it is a hard inconclusive result with the same archive-blocking force as `fail`.

2. **Archive interception rule.** The overall verdict is `pass` if and only if every check item in the round is `pass`.

   - If any item is `fail` or any item is `not_verified`, the overall verdict is not `pass` and the skill MUST NOT execute the archive.
   - The blocking force of `not_verified` and `fail` is identical; they differ only in what happens next: a `fail` feeds Phase 2 repair, a `not_verified` feeds evidence-gathering or the Rulings list.
   - Worked shape: with 10 constructed items where 9 are `pass` and 1 is `not_verified`, the overall verdict is not `pass`, the archive does not run, and the flow continues into repair or pending handling — the 9 passes do not buy anything.

3. **Finding — two mandatory fields.** Every finding produced from a `fail` or `not_verified` item carries both:

   - `gap_type` — exactly one of:

     | gap_type | meaning | typical evidence shape |
     |----------|---------|------------------------|
     | `missing` | The spec requires a behavior and the code lacks it (spec has it, code does not). | spec entry cites behavior X; codebase search finds no implementation of X. |
     | `wrong` | The code implements the behavior but diverges from the spec's stated behavior (spec has it, code has it, they disagree). | implementation site exists but contradicts the requirement/scenario text, or a test fails against the stated behavior. |
     | `extra` | The implementation includes behavior or files beyond what any spec entry requires, within the change's own feature area (code has it, spec has no matching entry). | surplus behavior in the change's own files with no requirement, design decision, or task behind it. |
     | `unrequested` | The change contains modifications no requirement, design decision, or task requested — work outside the change's declared scope (code has it, nothing asked for it). | diff touches files or behavior outside the change's declared scope entirely. |

   - Choose `gap_type` from the observed nature of the gap, not from convenience:
     - absent behavior is `missing`;
     - present-but-divergent is `wrong`;
     - surplus inside the feature area is `extra`;
     - out-of-scope work is `unrequested`.
   - When torn between `extra` and `unrequested`, ask whether the surplus still serves the change's declared subject (→ `extra`) or sits wholly outside it (→ `unrequested`).
   - `source_ref` — a two-way evidence anchor with both ends, each locatable from the other:
     - `code`: a concrete code location — file path with line range, or file path with symbol name.
     - `spec`: the concrete spec entry the code location must satisfy — capability and `Requirement:` name plus `Scenario:` name; or the change artifact path and section (proposal/design/tasks) when no capability spec covers the behavior.
   - A reviewer holding `source_ref` must be able to jump from the code location to the spec entry and back: the code end names the symbol and lines that realize (or fail to realize) the behavior; the spec end names the requirement and scenario whose text decides pass/fail.
   - A finding missing either field is invalid (Phase 1 step 9).

4. **Pending statuses.** Matters that are not settled at round end enter the Rulings list (未决清单) with one of three statuses:

   - `not_verified` — a check item whose evidence could not be gathered this round (mirrors the verdict; every `not_verified` verdict has a Rulings entry).
   - `blocked` — a matter that cannot proceed due to an external dependency: a missing credential, a fix owned upstream, another change in flight, or a needed human decision.
   - `paused` — a matter the user explicitly set aside or deferred this round, with the user's stated reason recorded.

   Every open entry — regardless of status — blocks the archive until it is resolved and the resolution is confirmed by a later round.

5. **Escalation rule (3 rounds).** A Rulings entry that remains open for 3 consecutive rounds is escalated to human ruling at the end of its third round.

   - The report marks it `escalated_to_human (R<n>)`.
   - The matter is presented to the user with everything needed to rule.
   - From that round on the skill performs no automatic retries for it — no re-running of its command, no workarounds, no repeated prompting inside the flow.
   - The entry stays visible in every later report until a human ruling closes or resolves it.
   - A ruling may close a Rulings matter only with a recorded rationale; a ruling never converts a check-item `not_verified` or `fail` verdict into `pass` — only a later round's real run with real evidence can replace a verdict.

**Steps**

1. **Phase 1 — Acceptance (验收)**

   **Entry condition:** an archive request exists, the change is selected, and the round number is known. **Exit condition:** all N check items carry a three-state verdict backed by this round's evidence, findings are recorded with validity marked, the Rulings list is updated, and the round's acceptance report is persisted.

   1. **Select and announce the change.**
      - Use the provided name, infer from context, auto-select when only one active change exists, or prompt from `openspec list --json`.
      - Announce: "Using change: <name> — entering Phase 1 acceptance (round <R>)".
      - Do not run any archive command in this phase. Do not route to the upstream archive flow as a shortcut for anything Phase 1 does.

   2. **Read the persisted report for round continuity.**
      - If `openspec/changes/<name>/acceptance-report.md` exists, read it.
      - Take the next round number from the round log, and carry every open Rulings entry into this round's list unchanged (same id, same `first pending round`, consecutive-pending count +1).
      - If it does not exist, this is round 1 with an empty list.
      - Session boundaries do not reset counters: a matter open in a previous session's last round is open with consecutive count ≥ 1 in this one.

   3. **Read the stalled-change registry (滞留改动登记.md) and present stalled items.**
      - Check whether `openspec/changes/<name>/滞留改动登记.md` exists.
      - If it exists: read it and present every stalled entry to the acceptor — all six fields (日期 / 路径 / 归属 / 滞留原因 / 建议处置 / 状态), complete and unsummarized — before executing any check item. The presentation is part of this round's acceptance inputs; the acceptor decides whether and how stalled items enter this round's acceptance scope.
      - If it does not exist: output nothing about stalled changes and go straight to the check items (no registry section in the report either).
      - When presented, record the presentation in the round's report under "Stalled-change presentation" (format below).
      - Stalled items are input and visibility, not evidence: a stalled entry never makes its related check pass, and registering one never substitutes for resolving it.

   4. **Load the change artifacts.**
      - Run `openspec status --change "<name>" --json` and read `schemaName`, `planningHome`, `changeRoot`, `artifactPaths`, and `actionContext`.
      - Run `openspec instructions apply --change "<name>" --json` and read the available artifacts from `contextFiles` (artifact id → concrete file paths): proposal, specs, design, tasks.
      - These artifacts are the raw material for the checklist construction below and for the C4/C5/C6 evidence work.
      - Treat apply `state` and `instruction` as context, not as a verification verdict.

   5. **Construct the acceptance checklist.**
      - Build the checklist from the default categories below.
      - Record the construction in the report as a table: category, constructed (yes/no), and for every "no" a structural reason.
      - The checklist has N items; N is the number of constructed categories.
      - The per-category procedures (commands, expected results, fail shapes, not_verified causes) are defined in "Check procedures" below.

      | id | category | constructed when | real check |
      |----|----------|------------------|------------|
      | C1 | Artifact completion | always | `openspec status --change "<name>" --json` — every artifact `done` or `skipped` |
      | C2 | Task completion | always | `openspec list --json` — `completedTasks == totalTasks`, zero incomplete |
      | C3 | Delta spec validity | always | `openspec validate "<name>" --strict` |
      | C4 | Requirement implementation mapping | any ADDED/MODIFIED requirement exists | for each requirement: search the codebase for implementation evidence; record `file:line` per requirement |
      | C5 | Scenario coverage | any ADDED/MODIFIED scenario exists | for each scenario: locate a test or executable evidence; run the targeted test when one exists |
      | C6 | Removed/renamed behavior gone | delta contains REMOVED/RENAMED requirements | read the baseline behavior from the main spec; search the codebase for it; expect absence |
      | C7 | Build green | project has a build step | run the project's own build command — infer it from the host project's scripts/conventions (e.g. package.json `scripts.build`, Makefile, CI config); never assume a specific toolchain. Example in this fork: `corepack pnpm build` |
      | C8 | Test suite green | project has tests | run the host project's own full test suite — infer it from the project's test runner configuration (e.g. package.json `scripts.test`, pytest/vitest/go test conventions); never assume a specific toolchain. Example in this fork: `corepack pnpm test` |
      | C9 | Generation parity | template sources touched (`src/core/templates/` etc.) | run the regen pipeline and the parity tests; generated trees must match template output |
      | C10 | Declared docs impact | the change declares documentation impact | verify each claimed doc update exists and matches the shipped behavior |

      **Drop rules.**
      - A category is dropped only for a structural reason: the change's schema defines no such artifact, the change declares a skip (for example `skip_specs: true`), or the category's subject does not exist in this change (no REMOVED requirements, no template sources touched, no docs impact declared, no build step).
      - Difficulty, missing evidence, or a failing command is never a drop reason — those make the item `not_verified` or `fail`, not dropped.
      - Every drop is recorded with its structural reason in the construction table; a dropped category never becomes a check item and needs no verdict.
      - Keep the construction table in the report so a reviewer can audit every drop.

   6. **Execute every check item with real commands.**
      - Run each constructed item's check in this round, following its procedure under "Check procedures".
      - Record per item:
        - `command`: the actual command text as run, verbatim, including flags.
        - `output`: a 1–3 line summary quoting the decisive output lines (exit status, counts, error text, matched locations). Quote real output only — never paraphrase into an assumption and never invent output.
        - `verdict`: `pass` or `fail` (or `not_verified` per step 7), judged from the recorded output.
      - For C4 and C5 the "command" may be a Grep/Read plus a targeted test run; still record what was searched or run and what it returned.
      - A verdict is judged from evidence produced in this round; a verdict carried over from a previous round without re-execution is not allowed.

   7. **Handle unexecutable items as `not_verified`.**
      - If an item's command cannot run in this environment — the tool is not installed, permission is missing, an external credential is required, a needed service or file is absent, or the input cannot be read — record the item with verdict `not_verified` and a concrete reason naming the blocker (which command, what is missing).
      - MUST NOT mark such an item `pass`; MUST NOT silently skip it; MUST NOT drop it from the report.
      - If only part of an item's evidence can be gathered, the item is `not_verified` with the reason describing the missing part.
      - Every constructed item ends the round with exactly one of the three verdicts: there is no such thing as an item without a verdict or without a recorded reason.

   8. **Produce findings from every non-pass item.**
      - Each `fail` or `not_verified` item yields at least one finding in this format:

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

      - For a `not_verified` item the finding records what evidence was missing and what would make the check runnable; its `spec` end still names the entry the check would have verified.
      - Example of a complete finding:

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

   9. **Enforce finding validity before Phase 2.**
      - A finding missing `gap_type` or missing either end of `source_ref` is invalid: mark it `invalid: missing <field>` in the report and return it to Phase 1 evidence gathering (re-run the search, re-read the spec entry, complete the anchor).
      - An invalid finding MUST NOT drive any code change in Phase 2 — repair based on an invalid finding is prohibited even if the guessed fix seems obviously right.
      - If the evidence cannot be completed, the underlying item keeps its `fail`/`not_verified` verdict and the matter enters the Rulings list.
      - An invalid finding is never silently deleted from the report.

   10. **Aggregate the round verdict.** Overall verdict for round R:
      - every item `pass` → overall `pass` → Phase 4 is reachable (after Phase 3's confirmation rules below);
      - any item `fail` → overall `fail` → proceed to Phase 2 with the findings;
      - any item `not_verified` (even exactly one, all others `pass`) → overall not `pass` → no archive; gather the missing evidence (re-run in the next round) or, when the blocker is external, enter it in the Rulings list as `blocked`/`not_verified` and continue to Phase 2 for whatever else is repairable.

   11. **Update the Rulings list (未决清单).**
      - For every `not_verified` verdict, every `blocked` matter, and every `paused` matter, append or update a Rulings entry (format under "Rulings" below) with the round number.
      - Write the round's acceptance report to `openspec/changes/<name>/acceptance-report.md`.

2. **Phase 2 — Repair (修复)**

   **Entry condition:** the round's overall verdict is not `pass` and at least one valid finding exists. **Exit condition:** every valid finding is either repaired with a recorded change, or explicitly held open by the user (which keeps its check failing and its Rulings entry open), and the change is ready for a full re-verification.

   1. **Repair only from valid findings.**
      - Work through the findings list in check order.
      - Each repair is the minimal change that makes the finding's `source_ref` code location satisfy its `source_ref` spec entry.
      - Do not bundle unrelated improvements into a repair; unrelated observed problems become new findings in the next round, not drive-by edits.
      - Do not "fix" a `not_verified` finding by changing code — its gap is evidence, not behavior.
   2. **Invalid findings drive nothing.**
      - A finding marked `invalid: missing <field>` is not repairable in this phase.
      - Complete its evidence (Phase 1 step 9) first; only then may it produce a repair.
   3. **Repair protocol per gap_type.**
      - `missing` — implement the behavior the `source_ref` spec entry states, at or near the `source_ref` code location; keep the implementation minimal and consistent with project patterns.
      - `wrong` — change the code to match the spec entry's stated behavior. If the code is right and the spec text itself is wrong, that is not a code repair: say so, and treat the discrepancy as a matter for the user (spec text is corrected through the change's own revision process, never by editing specs to make a check pass).
      - `extra` — the surplus behavior needs a decision: propose removing it (or, if the user wants to keep it, adding it to the spec through the change's revision process). Removing surplus code is a repair; keep the removal scoped to the surplus.
      - `unrequested` — the out-of-scope modification needs a user decision before anything moves: propose reverting it. Do not revert on your own initiative when the modification might belong to other work in the workspace; ask first, then act on the user's answer.
   4. **Record every repair.**
      - For each repaired finding record: finding id, files touched, and the intent ("makes C5 scenario X pass by ...").
      - This record is the input the next round's re-verification is checked against — Phase 3 confirms these specific findings turned `pass`.
   5. **Declined repairs stay open — and get registered.**
      - If the user declines to repair a finding (in Phase 2 or when Phase 3 re-presents it), do not repair it and do not delete it.
      - The finding, its item verdict (`fail`/`not_verified`), and its Rulings entry (`blocked` or `paused`, with the user's stated reason quoted) all remain in the report — a refused finding must never silently disappear from the report or the Rulings list.
      - Append a record to `openspec/changes/<name>/滞留改动登记.md`: 路径 = the finding's `source_ref` code location; 滞留原因 = the refusal reason, quoting the finding's `gap_type` and both `source_ref` ends (full record format under "Stalled-change registry").
      - The archive stays blocked while they are open, and the declined finding counts as a pending matter for the escalation rule.
      - Never repair without the user's consent: a repair the user has not agreed to MUST NOT be executed on your own initiative.
   6. **No verdict edits.**
      - Phase 2 never edits verdicts directly.
      - A repaired item's verdict changes only when Phase 3 re-runs the check and the new evidence supports `pass`.
   7. **Loop back target.**
      - After Phase 2 completes, the flow always proceeds to Phase 3.
      - Skipping Phase 3 and going to Phase 4 directly is prohibited, even when the repairs look trivial or the failing items "obviously" pass now.

3. **Phase 3 — Re-verification (复验)**

   **Entry condition:** Phase 2 ended (repairs recorded, or nothing was repairable and the round ended non-pass). **Exit condition:** a full round with all items `pass` (→ Phase 4), or the round ended non-pass and the loop rules below decide the next step.

   1. **Re-run the full Phase 1 checklist.**
      - Phase 3 is a complete new round (round R+1), not a spot-check.
      - Re-run all N constructed items with real commands, including the items that passed last round, because repairs can regress unrelated checks.
      - Reuse the construction table; re-verify that every drop reason still holds (a drop reason that no longer holds — for example template sources are now touched — constructs the category from this round on).
   2. **Confirm the original findings turned `pass`.**
      - For every finding repaired in Phase 2, check that its related check item is now `pass` in this round's evidence.
      - An item that is still `fail` means the repair did not take effect: produce a new finding and go back to Phase 2.
      - If the user now refuses to repair a still-failing finding, handle it as a declined repair (Phase 2 step 5), including the registry record.
   3. **New fails go back to repair.**
      - If re-verification produced any new `fail` item, return to Phase 2 with the new findings.
      - Looping Phase 2 → Phase 3 is expected; each pass through Phase 1 is a new round with its own evidence.
   4. **`not_verified` in re-verification.**
      - Treat per Phase 1 step 10: gather the missing evidence and re-run in the next round, or enter it in the Rulings list as `blocked` when the blocker is external.
      - A `not_verified` item never advances to Phase 4.
   5. **Escalation applies here too.**
      - At the end of each re-verification round, apply the 3-round escalation rule to every still-open Rulings entry.
      - An escalated matter is presented to the human and then waits; it is not auto-retried (see "Rulings").
   6. **No archive with open items.**
      - Phase 4 is reachable only from a round in which every item is `pass` and the Rulings list has no open entries.
      - Reaching Phase 3's end with any non-pass item or any open entry means the flow stops there and reports; it does not archive.

4. **Phase 4 — Archive (归档)**

   **Entry condition (the gate, all of it):** the latest round's overall verdict is `pass` — every check item is `pass` — AND the Rulings list has no open entries (every entry resolved and confirmed by a later round, or closed by a recorded human ruling) AND the user has confirmed the archive after seeing the final report. **Exit condition:** the archive is executed and its output carries the final acceptance report, or the user refuses the archive and the flow terminates with the registry record (step 4) — there is no third exit.

   1. **Show the final acceptance report.**
      - Present the round's full report (verdict table, findings, Rulings list) and ask the user to confirm the archive.
      - An archive without this confirmation is a bypass of the standard path.
   2. **Perform the mechanical archive exactly as `openspec-archive-change` defines it.** This skill replaces that skill's entry point, not its mechanics — follow the upstream steps verbatim, with the same selected-root flags:
      - Assess delta-spec sync state from `artifactPaths.specs.existingOutputPaths` (no delta specs → proceed without a sync prompt).
      - For each capability with a delta spec, compare it against the main spec; a new capability's main spec is an output of the sync, so only ADDED requirements can create one — a REMOVED-only or ADDED-less delta is sync-blocked, and a REMOVED-only delta on a retired capability (`retire_capabilities: true`) counts as already synced.
      - Show the combined summary and route on the user's choice exactly as the upstream skill specifies ("Cancel" / "Archive without syncing" / "Sync now"); never start a sync while any capability is sync-blocked.
      - When sync is selected, run the `openspec-sync-specs` workflow inline (agent-driven), reusing one `openspec instructions specs --change "<name>" --json` snapshot, and verify each written main spec against the upstream sync contract (title, `## Purpose` handling, no delta-style section headers remaining, `### Requirement:`/`#### Scenario:` structure).
      - Any sync stop or mismatch → the sync failed → stop the archive immediately; nothing has moved.
      - Create `archive/` under `planningHome.changesDir` if missing; derive the target name from the change name with a `YYYY-MM-DD-` prefix (never stack a second date); if the target exists, fail with an error and stop; otherwise move `changeRoot` into the archive directory.
      - Preserve `.openspec.yaml` (it moves with the directory).
   3. **Attach the final acceptance report to the archive output.**
      - The archive summary MUST include the change name, archive location, the final round number, the full verdict table, and the final Rulings state (empty at this point), so the archived record shows what was verified and how.
   4. **Handle a refused archive.**
      - If the user refuses the archive — at the confirmation gate or at any later point before the move — do not archive, and do not treat the refusal as a problem to argue away.
      - Append a record to `openspec/changes/<name>/滞留改动登记.md`: 滞留原因 = the refusal reason verbatim plus the round context (all checks pass, refused at Phase 4); 建议处置/去向 = where this proposal's changes remain (e.g., working tree, staged or unstaged), so the next session knows what state the proposal is in (full record format under "Stalled-change registry").
      - Terminate the flow with the change still active (it stays under `openspec/changes/<name>/`); the final report remains the evidence of what was verified.
      - The refusal and the change's whereabouts are also visible to the next session through the registry (Orchestrator rule 10).

**Rulings (未决清单).** The Rulings list is the report's tail section. It is mandatory in every acceptance report, including a report with zero entries (then it reads "none"). It collects every open `not_verified`, `blocked`, and `paused` matter with round attribution:

```markdown
## Rulings (未决清单)

| id | matter | status | first pending round | consecutive pending rounds | source round | escalation |
|----|--------|--------|---------------------|----------------------------|--------------|------------|
| P-1 | C6 — REMOVED baseline unreadable (main spec history unavailable) | not_verified | R2 | 2 | arose R2, carried through R3 | none |
| P-2 | Docs screenshot refresh awaiting designer asset | paused | R1 | 3 | arose R1, carried through R2–R3 | escalated_to_human (R3) |
```

- **All entries in, always.**
  - Every open `not_verified`/`blocked`/`paused` matter appears here, whatever its origin phase.
  - No open matter may live only in prose or only in a check row; the Rulings list is the complete list.
  - A report with any non-pass item and an empty Rulings list is malformed — find the missing entry.
- **Round attribution.**
  - Each entry records the round it arose (`first pending round`), how many consecutive rounds it has stayed open, and the rounds it was carried through.
  - A matter is "the same" across rounds when it names the same check item and the same underlying cause; a new cause on the same item is a new entry.
- **Single authoritative location (Rulings 归并).**
  - All pending handling — status, rounds, escalation, refusal and ruling notes — lives in this tail Rulings list and nowhere else.
  - The report body keeps each check item's three-state verdict (that is the check result, not pending handling) and may reference entries by id, but it no longer restates entry handling in prose, tables, or findings.
  - Moving entries here is a consolidation, not a deletion: nothing leaves the report; handling leaves the body.
- **Escalation.**
  - When an entry's `consecutive pending rounds` reaches 3, set its escalation to `escalated_to_human (R<n>)` at that round's end.
  - Present the matter to the user with everything needed to rule: the finding, both `source_ref` ends, what was attempted in which round, and the concrete decision the ruling must make.
  - From that round on, stop all automatic retries for it; later rounds keep showing the entry unchanged except for the carried-through round numbers and any user-stated ruling note.
  - A ruling that closes the entry must be quoted in its note; a ruling that resolves the root cause returns the underlying check to the normal verification loop, where it must actually pass before the gate opens.
- **Blocking.**
  - Every open entry blocks the archive, regardless of status.
  - The Rulings list being non-empty and the gate being closed are the same fact.

**Stalled-change registry (滞留改动登记.md).** The registry is the single cross-session record of stalled (滞留) matters. Location: `openspec/changes/<提案名>/滞留改动登记.md` — one registry per change, next to the change's artifacts.

- **Append-only (追加式不删行).**
  - New matters append new records; a status change appends a new record that cites the original record's date and path.
  - Never delete a line; never rewrite an existing record in place. The registry's history is its value.
- **Record format — six fields, always all six:**

  | field | content |
  |-------|---------|
  | 日期 | `YYYY-MM-DD` on which the record was appended |
  | 路径 | the stalled file or directory path (for a refused finding: the finding's `source_ref` code location; for a refused archive: the change root) |
  | 归属 | whose the matter is: 本提案 / 另一提案 / 无关本地实验 / 用户 |
  | 滞留原因 | why it is stalled — the concrete reason; for a refused finding, quote the finding's `gap_type` and both `source_ref` ends; for a refused archive, the refusal reason plus where the proposal's changes remain |
  | 建议处置 | the recommended handling — a suggestion only (由归属者自行处置 / 本提案不触碰 / 在其 own change 中处理 / 由用户决定); the skill never executes it on its own (see Guardrails) |
  | 状态 | `open` / `escalated` / `closed (user ruling: <one-line rationale>)` / `resolved` |

- **Registration triggers.** Append a record when:
  1. an unrelated change was marked stalled at checkpoint/triage time (the apply flow's triage registers these; the archive skill reads and presents them — and if the archive flow itself notices a new unrelated stalled matter during evidence gathering, it may append a record: registration is always safe, disposal never is),
  2. the user declines to repair a finding (Phase 2/3) — cite the finding's `gap_type` and both `source_ref` ends,
  3. the user refuses the archive (Phase 4) — state the refusal reason and where the proposal's changes remain.
- **Starter template.** When the first record is appended and the file does not exist yet, create it in this shape:

  ```markdown
  # 滞留改动登记 — <提案名>

  追加式登记册：只追加，不删行。状态变化以新记录表达并引用原记录。

  | 日期 | 路径 | 归属 | 滞留原因 | 建议处置 | 状态 |
  |------|------|------|----------|----------|------|
  ```

- **Cross-session visibility.** The registry lives on the filesystem, not in any conversation. Every new session entering the archive flow reads it before anything else runs (Phase 1 step 3 and Orchestrator rule 10); the apply flow's step 1 scan reads the same file.
- **Read-side discipline.** The registry is an input to acceptance (the Phase 1 presentation) and an output of refusal events (Phase 2/3/4). It never overrides a verdict: a stalled matter does not make its related check pass, and registering a matter never substitutes for resolving it.

**Worked round example.** A template-touching change in round 2, with Rulings entries carried from round 1:

- Construction: C1–C5, C7–C9 constructed (template sources touched → C9 built); C6 dropped (no REMOVED requirements); C10 dropped (no docs impact declared). Both drops recorded with structural reasons.
- Execution: C1–C5, C7, C9 `pass` with recorded commands and outputs.
- One exception: C8 `not_verified` — "test runner could not start: dependencies not installed and install was out of scope this round".
- Findings: F-3 from C8 (`not_verified`; the finding records the missing evidence and what would make the check runnable: "run `corepack pnpm install`, then re-run `corepack pnpm test`").
- Aggregation: overall verdict is **not pass** (one `not_verified` among nine `pass`) → no archive → next round re-runs the full checklist with the environment fixed.
- Rulings: P-1 (carried from R1, consecutive 2, escalation none) plus a new P-2 entry for the C8 `not_verified` (first pending round R2, consecutive 1). If P-1 is still open at the end of round 3, it escalates then.

**Acceptance report format.** Persist to `openspec/changes/<name>/acceptance-report.md` each round and present it to the user in this shape:

```markdown
# Acceptance report — <change-name>

Round: <R> · Date: <YYYY-MM-DD> · Skill: opsx-archive-with-validation <version>

## Stalled-change presentation (滞留项呈现)
(Include this section only when the registry exists; with no registry, no stalled content appears anywhere in the report.)

| 日期 | 路径 | 归属 | 滞留原因 | 建议处置 | 状态 |
|------|------|------|----------|----------|------|
<every registry entry, verbatim, unsummarized>

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
  status: open | repaired in R<r> | invalid: missing <field> | declined by user (registered P-<m>) | escalated

## Repairs this round (Phase 2 rounds only)

- F-<n>: touched <files> — intent: <what the repair makes pass>

## Rulings (未决清单)

<the mandatory tail table — the single authoritative location for all pending handling; "none" when empty>

## Round log (append-only)

- R1 (date): overall <verdict>; N items: x pass / y fail / z not_verified; rulings: <ids>; repairs: <ids>
- R2 (date): overall <verdict>; N items: ...; rulings: <ids with consecutive counts>; repairs: <ids>
```

**Orchestration rules.** When orchestrating the flow, apply these rules in order:

1. **Standard-path routing.** Any archive request enters this skill and announces it. Route away only when the user explicitly rejects the standard path after seeing the declaration, and record the rejection verbatim before stopping.
2. **Fixed phase order.** Phases run 1 → 2 → 3 → 4, never skipped, never reordered. After any Phase 2 repair, Phase 3's full re-run is mandatory. Entering Phase 4 requires the Phase 3 gate, not the Phase 1 gate alone.
3. **Verdict gate.** Archive only when every check item is `pass` and the Rulings list has no open entries. `not_verified` blocks with the same force as `fail`.
4. **Evidence rule.** Every verdict cites commands actually run in the current round with real output summaries. "Looks right", "should pass", or a verdict inherited from an earlier round without re-execution is not evidence.
5. **Finding rule.** Every finding carries `gap_type` and both ends of `source_ref`; findings missing them are invalid and drive no code change.
6. **Loop rules.** Phase 3 new `fail` → Phase 2; a repaired finding must be confirmed `pass` by re-verification before Phase 4; each pass through the checklist is a new round with a new number.
7. **Escalation rule.** A Rulings entry open for 3 consecutive rounds is escalated to human ruling at that round's end; from the third round on, the skill makes zero automatic attempts on it and keeps it visible in every later report.
8. **Report persistence.** Write `openspec/changes/<name>/acceptance-report.md` every round; read it at flow entry for round continuity; keep the round log append-only; carry open Rulings entries forward untouched.
9. **Scope rule.** This skill verifies and archives. It does not implement change tasks (that is the apply flow's job), does not edit specs or change artifacts to make checks pass, and does not touch files outside evidence gathering, the persisted report, the registry, and the Phase 4 archive move.
10. **Stalled-change visibility (滞留改动跨会话可见).** Stalled changes are visible across sessions: any new session entering the archive flow (or the apply flow) reads `openspec/changes/<提案名>/滞留改动登记.md` first, before its subsequent steps. Stalled state MUST NOT be lost when a session changes — entries registered in one session are visible, with their original six fields, in every later session. This rule, the Phase 1 registry presentation (step 3), and the apply flow's step 1 scan all point at the same registry file.

**Common pitfalls (do not do these)**

- Marking a check `pass` because it passed last round. Verdicts are per-round; re-run.
- Treating a `not_verified` as a soft pass because "the rest is green". One `not_verified` blocks the archive.
- Summarizing a failing suite as "mostly passing". Quote the failing tests and mark `fail`.
- Repairing from a finding whose `source_ref` names no spec entry. Complete the anchor first.
- Dropping a category because its command failed or its evidence was hard to find. Drops need structural reasons; this is `not_verified` or `fail` instead.
- Searching only the requirement name for a REMOVED behavior. Read the baseline behavior from the main spec and search for that.
- Letting the Rulings list drift from the verdict table. Every `not_verified` verdict has a Rulings entry, and every open entry blocks.
- Auto-retrying an escalated matter "one more time". From the third consecutive pending round, zero automatic attempts.
- Deleting, editing, committing, or reverting a stalled file "to help". The skill registers and presents only; disposal is the user's explicit call, and it gets logged in the registry when it happens.

**Guardrails**

- Never execute an archive — CLI, upstream skill, or manual move — unless the current round shows every check item `pass` and the Rulings list has no open entries. One `not_verified` among all-else-`pass` blocks exactly like a `fail`.
- Never record `pass` for an item whose command did not actually run in the current round, and never omit a constructed item from the report. An unexecutable item is `not_verified` with a concrete reason, in the report, always.
- Never modify code based on a finding that lacks `gap_type` or `source_ref`. Complete the evidence first; an invalid finding drives nothing.
- Never downgrade, reinterpret, or argue away a `not_verified` or `fail` verdict; only a later round's real run with real output replaces a verdict.
- Never skip Phase 3 after a repair, and never archive while a re-verification `fail` or an open Rulings entry exists.
- Never treat difficulty or missing evidence as a drop reason at checklist construction. Drops require structural reasons and are recorded; everything else is a check item with a three-state verdict.
- Never bundle unrelated edits into a repair, and never edit specs or change artifacts to make a failing check pass.
- Never make more than one automatic attempt per pending matter within a round; from an entry's third consecutive pending round, make zero.
- Never rewrite prior rounds' round-log entries; the log is append-only history. The registry is append-only too: never delete or rewrite a stalled-change record.
- **Never dispose of a change registered as stalled (滞留) on the user's behalf.** For stalled entries the skill's entire output is registration, presentation, and a recommended handling (建议处置): it MUST NOT delete, modify, `git add`, `git commit`, or `git checkout` those files. A disposal action happens only when the user explicitly instructs it — the action must correspond to that instruction — and the skill then appends a registry record noting the state change and that its basis is the user's instruction.
- Keep the upstream archive mechanics intact in Phase 4; this skill adds the gate in front of them and changes nothing behind it.
- Report only real evidence. If the user instructs a bypass, record the instruction verbatim, stop this skill, and hand back with the report as-is.

**Output on success (Phase 4 complete)**

```markdown
## Archive Complete (validated)

**Change:** <change-name>
**Archived to:** <archive path>
**Acceptance:** round <R> — all <N> check items pass; Rulings: none
**Final report:** openspec/changes/<name>/acceptance-report.md (verdict table and findings attached above)
```

**Output when blocked (any non-pass item or open Rulings entry)**

```markdown
## Archive Blocked (standard path)

**Change:** <change-name>
**Round:** <R> — overall verdict: <fail | not pass>
**Blocking:** <list of fail/not_verified items and open Rulings entries with ids>
**Next:** <Phase 2 repairs pending | evidence needed for <ids> | human ruling needed for <ids>>
No archive was executed. The acceptance report was persisted to openspec/changes/<name>/acceptance-report.md.
```

**Version history**

Bump the frontmatter `version` only when this file's behavior instructions change; an edit that fixes typos or formatting only keeps the version unchanged. Every behavior bump appends a row here naming the change proposal and what the bump adds.

| Version | Change | Notes |
|---------|--------|-------|
| 1.0.0 | add-archive-with-validation-skill | Initial manual skill: standard-path declaration, four-phase flow, three-state verdict with archive interception, finding double field (`gap_type` + `source_ref`), tail pending list with 3-round escalation. |
| 1.1.0 | add-stalled-change-triage | Stalled-change integration, seven enhancements: ① version bump (this record); ② Phase 1 opening reads and presents `滞留改动登记.md`; ③ Phase 2/3 refused repairs registered into the registry; ④ Phase 4 refused archive registered + pending entries consolidated into the tail Rulings list (single authoritative location); ⑤ registry record structure defined (日期/路径/归属/滞留原因/建议处置/状态, append-only); ⑥ Orchestrator rule 10 (cross-session stalled visibility); ⑦ red line: the skill never disposes of unrelated stalled changes on the user's behalf. Also completes the 1.0.0 procedure elaboration (artifact loading step, per-check procedures, per-gap_type repair protocol) that was drafted but not shipped at 1.0.0 archive time. |
