# OpenSpec Conventions Specification

## Purpose

OpenSpec conventions SHALL define how system capabilities are documented, how changes are proposed and tracked, and how specifications evolve over time. This meta-specification serves as the source of truth for OpenSpec's own conventions.

## Requirements

### Requirement: Structured conventions for specs and changes

OpenSpec conventions SHALL mandate a structured spec format with clear requirement and scenario sections so tooling can parse consistently.

#### Scenario: Following the structured spec format

- **WHEN** writing or updating OpenSpec specifications
- **THEN** authors SHALL use `### Requirement: ...` followed by at least one `#### Scenario: ...` section

### Requirement: Behavior-First Specification Boundary
OpenSpec specifications SHALL capture verifiable behavior contracts and avoid internal implementation detail.

#### Scenario: Writing behavior requirements
- **WHEN** documenting a capability in `spec.md`
- **THEN** requirements focus on externally observable behavior, interfaces, error handling, and constraints
- **AND** scenarios remain testable or explicitly verifiable

#### Scenario: Avoiding implementation leakage
- **WHEN** details involve concrete library choices, class/function structure, or execution mechanics
- **THEN** those details SHALL be documented in `design.md` or `tasks.md` instead of behavioral requirements

### Requirement: Progressive Rigor
OpenSpec conventions SHALL keep specs lightweight by default and scale rigor only when risk or coordination complexity demands it.

#### Scenario: Routine change specification
- **WHEN** a change is local and low-risk
- **THEN** authors use concise, behavior-first requirements with minimal ceremony

#### Scenario: High-risk or cross-boundary change specification
- **WHEN** a change is cross-team, cross-repo, API-contract breaking, migration-heavy, or security/privacy sensitive
- **THEN** authors increase detail and explicit validation expectations proportionally

### Requirement: Project Structure
An OpenSpec project SHALL maintain a consistent directory structure for specifications and changes.

#### Scenario: Initializing project structure
- **WHEN** an OpenSpec project is initialized
- **THEN** it SHALL have this structure:
```
openspec/
├── project.md              # Project-specific context
├── AGENTS.md               # AI assistant instructions
├── specs/                  # Current deployed capabilities
│   └── <capability-path>/  # One or more directories for a focused capability
│       ├── spec.md         # WHAT and WHY
│       └── design.md       # HOW (optional, for established patterns)
└── changes/                # Proposed changes
    ├── [change-name]/      # Descriptive change identifier
    │   ├── proposal.md     # Why, what, and impact
    │   ├── tasks.md        # Implementation checklist
    │   ├── design.md       # Technical decisions (optional)
    │   └── specs/          # Complete future state
    │       └── <capability-path>/
    │           └── spec.md # Clean markdown (no diff syntax)
    └── archive/            # Completed changes
        └── YYYY-MM-DD-[name]/
```

### Requirement: Structured Format for Behavioral Specs

Behavioral specifications SHALL use a structured format with consistent section headers and keywords to ensure visual consistency and parseability.

#### Scenario: Writing requirement sections

- **WHEN** documenting a requirement in a behavioral specification
- **THEN** use a level-3 heading with format `### Requirement: [Name]`
- **AND** immediately follow with a SHALL statement describing core behavior
- **AND** keep requirement names descriptive and under 50 characters

#### Scenario: Documenting scenarios

- **WHEN** documenting specific behaviors or use cases
- **THEN** use level-4 headings with format `#### Scenario: [Description]`
- **AND** use bullet points with bold keywords for steps:
  - **GIVEN** for initial state (optional)
  - **WHEN** for conditions or triggers
  - **THEN** for expected outcomes
  - **AND** for additional outcomes or conditions

#### Scenario: Adding implementation details

- **WHEN** a step requires additional detail
- **THEN** use sub-bullets under the main step
- **AND** maintain consistent indentation
  - Sub-bullets provide examples or specifics
  - Keep sub-bullets concise

### Requirement: Header-Based Requirement Identification

Requirement headers SHALL serve as unique identifiers for programmatic matching between current specs and proposed changes.

#### Scenario: Matching requirements programmatically

- **WHEN** processing delta changes
- **THEN** use the `### Requirement: [Name]` header as the unique identifier
- **AND** strip a closing run of `#` characters when a space or tab precedes it and only spaces or tabs follow it, then trim surrounding whitespace
- **AND** compare normalized requirement names with case-sensitive equality

#### Scenario: Handling requirement renames

- **WHEN** renaming a requirement
- **THEN** use a special `## RENAMED Requirements` section
- **AND** specify both old and new names explicitly:
  ```markdown
  ## RENAMED Requirements
  - FROM: `### Requirement: Old Name`
  - TO: `### Requirement: New Name`
  ```
- **AND** if content also changes, include under MODIFIED using the NEW header

#### Scenario: Validating header uniqueness

- **WHEN** creating or modifying requirements
- **THEN** ensure no duplicate headers exist within a spec
- **AND** validation tools SHALL flag duplicate headers as errors

### Requirement: Change Storage Convention

Change proposals SHALL store only the additions, modifications, and removals to specifications, not complete future states.

#### Scenario: Creating change proposals with additions

- **WHEN** creating a change proposal that adds new requirements
- **THEN** include only the new requirements under `## ADDED Requirements`
- **AND** each requirement SHALL include its complete content
- **AND** use the standard structured format for requirements and scenarios

#### Scenario: Creating change proposals with modifications  

- **WHEN** creating a change proposal that modifies existing requirements
- **THEN** include the modified requirements under `## MODIFIED Requirements`
- **AND** use the same header text as in the current spec (normalized)
- **AND** include the complete modified requirement (not a diff)
- **AND** optionally annotate what changed with inline comments like `← (was X)`

#### Scenario: Creating change proposals with removals

- **WHEN** creating a change proposal that removes requirements
- **THEN** list them under `## REMOVED Requirements`
- **AND** use the normalized header text for identification
- **AND** include reason for removal
- **AND** document any migration path if applicable

The `changes/[name]/specs/` directory SHALL contain:
- Delta files showing only what changes
- Sections for ADDED, MODIFIED, REMOVED, and RENAMED requirements
- An optional `## Purpose` section on deltas that introduce a new capability
- Normalized header matching for requirement identification
- Complete requirements using the structured format
- Clear indication of change type for each requirement

#### Scenario: Introducing a new capability

- **WHEN** a delta introduces a capability that has no main spec yet
- **THEN** the delta MAY open with a `## Purpose` section describing the capability
- **AND** that Purpose SHALL seed the main spec created for it
- **AND** a delta for a capability that already has a main spec SHOULD NOT carry a `## Purpose`, because the existing Purpose is authoritative and the delta's is ignored

#### Scenario: Using standard output symbols

- **WHEN** displaying delta operations in CLI output
- **THEN** use these standard symbols:
  - `+` for ADDED (green)
  - `~` for MODIFIED (yellow)
  - `-` for REMOVED (red)
  - `→` for RENAMED (cyan)

### Requirement: Archive Process Enhancement

The archive process SHALL programmatically apply delta changes to current specifications using header-based matching.

#### Scenario: Archiving changes with deltas

- **WHEN** archiving a completed change
- **THEN** the archive command SHALL:
  1. Parse RENAMED sections first and apply renames
  2. Parse REMOVED sections and remove by normalized header match
  3. Parse MODIFIED sections and replace by normalized header match (using new names if renamed)
  4. Parse ADDED sections and append new requirements
- **AND** validate that all MODIFIED headers exist in current spec
- **AND** treat a REMOVED header that is already absent as already removed (warn and continue; a REMOVED header that names the FROM side of a RENAMED in the same delta — compared case- and whitespace-insensitively — or that differs only in case or whitespace from an existing requirement, is a conflict)
- **AND** treat an ADDED header that already exists with identical content as already synced (differing content is a conflict)
- **AND** treat a RENAMED whose source is gone but target present as already synced
- **AND** generate the updated spec in the main specs/ directory

#### Scenario: Handling conflicts during archive

- **WHEN** delta changes conflict with current spec state
- **THEN** the archive command SHALL report specific conflicts
- **AND** require manual resolution before proceeding
- **AND** provide clear guidance on resolving conflicts

### Requirement: Proposal Format

Proposals SHALL explicitly document all changes with clear from/to comparisons.

#### Scenario: Documenting changes

- **WHEN** documenting what changes
- **THEN** the proposal SHALL explicitly describe each change:

```markdown
**[Section or Behavior Name]**
- From: [current state/requirement]
- To: [future state/requirement]
- Reason: [why this change is needed]
- Impact: [breaking/non-breaking, who's affected]
```

This explicit format compensates for not having inline diffs and ensures reviewers understand exactly what will change.

### Requirement: Change Review

The system SHALL support multiple methods for reviewing proposed changes.

#### Scenario: Reviewing changes

- **WHEN** reviewing proposed changes
- **THEN** reviewers can compare using:
- GitHub PR diff view when changes are committed
- Command line: `diff -u "specs/<capability-path>/spec.md" "changes/<name>/specs/<capability-path>/spec.md"`
- Any visual diff tool comparing current vs future state

### Requirement: Structured Format Adoption

Behavioral specifications SHALL adopt the structured format with `### Requirement:` and `#### Scenario:` headers as the default.

#### Scenario: Use structured headings for behavior

- **WHEN** documenting behavioral requirements
- **THEN** use `### Requirement:` for requirements
- **AND** use `#### Scenario:` for scenarios with bold WHEN/THEN/AND keywords

### Requirement: Verb–Noun CLI Command Structure
OpenSpec CLI design SHALL use verbs as top-level commands with nouns provided as arguments or flags for scoping.

#### Scenario: Verb-first command discovery
- **WHEN** a user runs a command like `openspec list`
- **THEN** the verb communicates the action clearly
- **AND** nouns refine scope via flags or arguments (e.g., `--changes`, `--specs`)

#### Scenario: Backward compatibility for noun commands
- **WHEN** users run noun-prefixed commands such as `openspec spec ...` or `openspec change ...`
- **THEN** the CLI SHALL continue to support them for at least one release
- **AND** display a deprecation warning that points to verb-first alternatives

#### Scenario: Disambiguation guidance
- **WHEN** item names are ambiguous between changes and specs
- **THEN** `openspec show` and `openspec validate` SHALL accept `--type spec|change`
- **AND** the help text SHALL document this clearly

### Requirement: 模板源优先纪律

本仓库 SHALL 把工作流行为的魔改入口限定为模板源 `src/core/templates/`（含 `workflows/*.ts` 与共享段落模块），生成物 `skills/<name>/SKILL.md` MUST NOT 直接手改——生成物由模板渲染重生成即被覆盖；已登记白名单的手工技能目录除外（见「手工技能白名单登记纪律」）。

#### Scenario: 行为魔改落在模板源

- **GIVEN** 需要修改 propose 或 apply 技能的步骤流（如新增提交检查点）
- **WHEN** 执行者实施该修改
- **THEN** 改动落在 `src/core/templates/workflows/` 下对应模板源文件
- **AND** 不直接编辑 `skills/openspec-propose/SKILL.md` 等生成物

#### Scenario: 手改生成物被 parity 拦截

- **GIVEN** 执行者直接编辑了某个未豁免的 `skills/openspec-*/SKILL.md`
- **WHEN** 运行 parity 测试套件
- **THEN** 「生成内容 == 磁盘内容」断言失败并提示重新生成
- **AND** 唯一合规路径是回到模板源修改后重跑再生成三命令

### Requirement: 再生成三命令纪律

模板源改动后 SHALL 按固定顺序执行再生成三命令：`corepack pnpm build` → `corepack pnpm regen:parity-hashes` → `corepack pnpm generate:skills`；MUST NOT 跳过 build 直接运行 generate（generate 从 `dist/` 导入模板函数，跳过 build 会以旧编译产物覆盖生成物）。

#### Scenario: 完整顺序执行后生成物与模板一致

- **GIVEN** 模板源已修改
- **WHEN** 按顺序运行 `corepack pnpm build && corepack pnpm regen:parity-hashes && corepack pnpm generate:skills`
- **THEN** `skills/` 下生成技能内容与最新模板一致
- **AND** parity 测试套件全部通过

#### Scenario: 跳过 build 直接 generate 被视为违规

- **GIVEN** 模板源已修改但未运行 `corepack pnpm build`
- **WHEN** 执行者直接运行 `corepack pnpm generate:skills`
- **THEN** 生成物由旧的 `dist/` 编译产物渲染，与模板源不一致
- **AND** parity 测试失败，纠正方式是按完整三命令顺序重跑而非手改生成物

### Requirement: 手工技能白名单登记纪律

手工技能（直接编辑 `skills/` 下文件、不进模板生成管线的技能）SHALL 通过 `MANUAL_SKILL_DIRS` 白名单登记保护，登记方式为向该数组追加目录名；MUST NOT 在未登记的情况下把手工技能放入 `skills/`——未登记目录会在下一次 `generate:skills` 清理时被静默删除。

#### Scenario: 登记后的手工技能在再生成后保留

- **GIVEN** 一个手工技能目录已登记进 `MANUAL_SKILL_DIRS`
- **WHEN** 运行完整再生成三命令
- **THEN** 该目录及其内容原样保留
- **AND** skillssh-parity 的精确目录集断言因白名单豁免而保持通过

#### Scenario: 未登记的手工目录被清理

- **GIVEN** 一个手工技能目录存在于 `skills/` 下但未登记白名单
- **WHEN** 运行 `corepack pnpm generate:skills`
- **THEN** 该目录被清理删除
- **AND** 恢复方式是重新登记白名单后重放该手工技能内容，而非关闭清理

### Requirement: openspec/ 提案产物本地排除纪律

遵循本纪律的仓库 SHALL 在 `.git/info/exclude` 追加 `openspec/`，使新提案产物本地不入库；排除只影响未跟踪新文件，已 tracked 的历史提案 MUST 不受影响；被排除路径的 `git add` 会被静默跳过，入库 MUST 使用 `git add -f` 强制；需入库的变更目录 SHALL 在 exclude 生效前创建（如本变更自身目录），生效后入库时以 `-f` 补救。

#### Scenario: exclude 后新提案产物不入库

- **GIVEN** `.git/info/exclude` 已含 `openspec/`
- **WHEN** propose 流程在 `openspec/changes/<新提案>/` 创建产物
- **THEN** `git status` 不再显示这些未跟踪文件
- **AND** 普通 `git add openspec/` 不会把它们收入暂存区

#### Scenario: 已 tracked 的历史提案不受影响

- **GIVEN** `openspec/specs/` 与历史归档提案已被 git 跟踪，且 `.git/info/exclude` 含 `openspec/`
- **WHEN** 修改任一已跟踪文件并查看 `git status`
- **THEN** 该修改照常显示为已跟踪文件的变更
- **AND** 其提交无需 `-f`，排除规则对已跟踪文件不生效

#### Scenario: 被排除路径需 -f 强制入库

- **GIVEN** 本变更自身目录创建于 exclude 生效之前、但产物在 exclude 生效时仍未 `git add`
- **WHEN** 实施者需要把本变更产物入库
- **THEN** 使用 `git add -f openspec/changes/add-openspec-exclude-discipline/` 显式强制
- **AND** 提交后这些文件成为已跟踪状态，后续修改不再受排除规则影响
