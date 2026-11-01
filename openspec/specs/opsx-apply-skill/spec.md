# opsx-apply-skill Specification

## Purpose
Defines how the apply skill reads the current apply inputs for a change while keeping the existing apply workflow behavior.

## Requirements

### Requirement: Consume current apply operation inputs

The `/opsx:apply` skill SHALL consume current project context and apply operation guidance returned by `openspec instructions apply --change "<name>" --json` while preserving its existing state-driven workflow.

#### Scenario: Apply context and guidance are configured

- **WHEN** apply instruction output contains `context` and `operationGuidance`
- **THEN** the skill treats context as a required prompt-level instruction input
- **AND** tells the agent to read it and apply relevant project facts, conventions, and constraints
- **AND** treats operation guidance as optional additive advice
- **AND** tells the agent to read and consider it and follow entries that are applicable and compatible with the built-in workflow

#### Scenario: Apply operation inputs are absent

- **WHEN** apply instruction output omits context and operation guidance
- **THEN** the skill continues with its existing apply workflow

#### Scenario: Runtime instructions conflict with apply state

- **WHEN** context or operation guidance conflicts with CLI-returned state, missing artifacts, tasks, progress, context files, or built-in instruction
- **THEN** the generated skill keeps required project context and advisory operation guidance separate from the CLI-returned apply fields
- **AND** tells the agent to report context conflicts
- **AND** tells the agent to explain why conflicting or inapplicable operation guidance was not followed
- **AND** this change does not modify the CLI-returned state, missing artifacts, tasks, progress, context files, or built-in instruction
- **AND** the template tells the agent that neither field is evidence of task completion or permission to bypass a blocked state
- **AND** the system does not represent that prompt-level precedence as an enforceable check

#### Scenario: Apply consumes runtime instructions without copying them

- **WHEN** the skill receives context or operation guidance
- **THEN** it does not copy those fields verbatim into implementation files or planning artifacts unless separately requested by the user

### Requirement: Preserve apply workflow behavior

The `/opsx:apply` skill template and CLI contract SHALL keep their existing change selection, context loading, task progression, pause-on-blocker behavior, and completion reporting structure in this change.

#### Scenario: Runtime inputs are consumed

- **WHEN** apply instructions return configured operation inputs
- **THEN** no CLI-controlled apply state transition, required implementation task, or completion criterion is added, removed, or replaced solely by this change

### Requirement: Apply 精确暂存

apply 技能 step 8 在用户同意提交后 SHALL 先运行 `git status --porcelain` 预检列出全部脏路径，然后只暂存两组路径：①本轮实施触及的实现文件；②`openspec/changes/<提案名>/` 产物；并 MUST 在模板 Guardrails 中明文禁止使用 `git add -A` 与 `git add .` 进行全量暂存。

#### Scenario: 正常精确暂存两组路径

- **GIVEN** apply 本轮实施编辑了实现文件，且 `openspec/changes/<提案名>/` 下产物有新增或修改
- **WHEN** 用户在 step 8 同意提交
- **THEN** 技能先运行 `git status --porcelain` 并向用户呈现脏路径清单
- **AND** 暂存范围恰好等于本轮触及的实现文件与 `openspec/changes/<提案名>/` 产物两组路径
- **AND** 工作区中其他任何脏路径都未进入暂存区

#### Scenario: 脏工作区含其他提案产物时不卷入

- **GIVEN** 工作区同时存在其他提案目录（如 `openspec/changes/<另一提案>/`）的未提交产物与本轮实施文件
- **WHEN** step 8 执行精确暂存
- **THEN** 只有 `<提案名>` 对应的产物目录被暂存
- **AND** 其他提案目录的产物保持未暂存状态，`git status --porcelain` 输出中它们不出现 `A`/`M` 暂存标记

#### Scenario: 全量暂存被明文禁止

- **WHEN** 审查者阅读 `skills/openspec-apply-change/SKILL.md` 的 Guardrails 段
- **THEN** 其中明文禁止 `git add -A` 与 `git add .` 两种全量暂存形式
- **AND** 步骤文本不提供任何「工作区干净所以可以 -A」之类的例外条款

### Requirement: 未跟踪 openspec/ 仓库的降级暂存

当仓库不跟踪 `openspec/`（未纳入版本管理或被 `.git/info/exclude` 排除）时，step 8 SHALL 降级为只暂存本轮实施触及的实现文件，并 MUST 在输出中说明 `openspec/changes/` 产物未入库的事实；此场景下 MUST NOT 通过 `-f` 强制添加被排除的产物。

#### Scenario: 仓库 exclude 了 openspec/ 时只暂存实现文件

- **GIVEN** 仓库的 `.git/info/exclude` 包含 `openspec/`，本轮产物为未跟踪新文件
- **WHEN** 用户同意提交且 step 8 执行暂存
- **THEN** 暂存区只含本轮触及的实现文件
- **AND** `openspec/changes/<提案名>/` 产物保持未跟踪且未暂存，输出中说明该事实
- **AND** 技能不使用 `git add -f` 绕过排除规则

#### Scenario: 实现文件与产物均无变化时如实报告

- **GIVEN** step 8 预检发现两组路径均无任何变化
- **WHEN** 用户同意提交
- **THEN** 技能不创建空提交，如实报告无可提交内容并结束检查点

### Requirement: 暂存清单留痕

每次精确暂存后，apply 技能 SHALL 把实际暂存的路径清单留痕——写入提交信息正文（第二个 `-m`）或 `openspec/changes/<提案名>/tasks.md`——使每个 commit 的文件构成可事后审计；两种留痕载体 MUST 至少使用其一。

#### Scenario: 以提交信息第二个 -m 留痕

- **GIVEN** step 8 已完成精确暂存并即将提交
- **WHEN** 技能选择提交信息留痕
- **THEN** `git commit` 使用第二个 `-m` 携带形如「Staged: <路径列表>」的清单
- **AND** 清单与实际暂存路径一一对应

#### Scenario: 以 tasks.md 留痕

- **GIVEN** step 8 已完成精确暂存且用户选择不清在提交信息中附带清单
- **WHEN** 技能选择产物留痕
- **THEN** `openspec/changes/<提案名>/tasks.md` 中记录本次暂存路径清单与日期
- **AND** 该记录不影响既有任务 checkbox 的勾选状态

### Requirement: Apply 实施完成提交检查点

apply 技能在实施循环结束（全部任务完成或按用户指示暂停）后，SHALL 执行一个提交检查点步骤（step 8）：向用户询问是否 git 提交本轮实施产物；用户同意时以 `apply:` 前缀的提交信息提交；该步骤 MUST 在 skill 与 command 两个表面同时存在（共享 instruction 文本，由 parity 机制强制一致），且 MUST NOT 在未经用户确认的情况下自动提交。

#### Scenario: 实施完成后询问提交

- **GIVEN** apply 技能已完成本轮全部任务并勾选了 tasks.md 对应 checkbox
- **WHEN** 技能进入 step 8 提交检查点并询问用户是否提交
- **THEN** 用户同意后技能执行一次 `git commit`，提交信息以 `apply:` 为前缀并概括变更名
- **AND** 提交前技能向用户呈现将纳入本次提交的文件范围

#### Scenario: 用户拒绝提交实施产物

- **GIVEN** apply 技能本轮实施已全部完成并进入 step 8
- **WHEN** 用户答复不提交
- **THEN** 技能不执行 `git commit`、不做任何暂存
- **AND** 技能说明未提交状态可能影响后续回退与归档检查点，并按用户指示结束本轮（如仅汇报完成状态）

#### Scenario: 暂停时同样经过检查点

- **GIVEN** apply 技能在任务未全部完成时因阻塞或用户打断而暂停
- **WHEN** 用户要求在暂停前提交已完成部分
- **THEN** 技能以 `apply:` 前缀提交已完成部分并在提交信息中注明未完成
- **AND** 未完成任务的 checkbox 保持未勾选状态

#### Scenario: skill 与 command 两表面一致携带

- **WHEN** 运行 parity 测试对比 `skills/openspec-apply-change/SKILL.md` 与 `/opsx:apply` command 生成内容
- **THEN** 两个表面包含同一步骤 8 提交检查点文本（`apply:` 前缀、询问式、不自动提交）
- **AND** 任一表面缺失该步骤时 parity 测试失败

### Requirement: Apply 启动滞留登记扫描

apply 技能 step 1（选定变更）SHALL 增加滞留登记扫描：若 `openspec/changes/<提案名>/滞留改动登记.md` 存在，先读取并向用户呈现遗留滞留项（路径、归属、原因、建议处置），使滞留改动跨会话可见；登记册不存在时静默跳过，不产生额外输出负担。

#### Scenario: 新会话读到上次的滞留登记

- **GIVEN** 上一会话在 `openspec/changes/<提案名>/滞留改动登记.md` 登记过 2 条滞留改动，当前是新会话
- **WHEN** 用户对本提案运行 apply，技能执行 step 1
- **THEN** 技能读取该登记册并向用户呈现全部 2 条滞留项的关键字段
- **AND** 呈现内容包含路径、归属与滞留原因，用户无需翻找登记册即可了解遗留情况

#### Scenario: 登记册不存在时静默跳过

- **GIVEN** `openspec/changes/<提案名>/` 下不存在 `滞留改动登记.md`
- **WHEN** apply step 1 执行滞留登记扫描
- **THEN** 技能不输出任何滞留相关内容，直接继续既定的变更选择流程

### Requirement: Apply 完成分诊与滞留登记

apply step 8 遇脏工作区 SHALL 先用 `git status --porcelain` 对全部脏路径分类：本提案相关路径 → 精确暂存；无关改动 → MUST NOT 暂存，且逐条登记入 `openspec/changes/<提案名>/滞留改动登记.md`；用户拒绝提交时，本提案自身改动 SHALL 同样登记为滞留。

#### Scenario: 无关改动不暂存且逐条登记

- **GIVEN** 脏工作区含本提案实现文件、本提案产物目录，以及一条无关改动（如 `scripts/experiment.tmp`）
- **WHEN** 用户在 step 8 同意提交
- **THEN** 仅本提案两组路径被精确暂存
- **AND** 无关改动未进入暂存区，且在 `滞留改动登记.md` 中新增一条记录（日期/路径/归属/滞留原因/建议处置/状态）

#### Scenario: 用户拒提交时本提案改动也登记滞留

- **GIVEN** apply 本轮实施完成并进入 step 8
- **WHEN** 用户拒绝提交
- **THEN** 技能不做任何暂存与提交
- **AND** 将本提案自身改动（实现文件与产物）登记入 `滞留改动登记.md`，滞留原因注明「用户拒绝提交」

#### Scenario: 登记动作不改变无关改动的工作区状态

- **GIVEN** step 8 完成分诊与登记
- **WHEN** 审查者检查无关改动的文件状态
- **THEN** 该文件内容与登记前逐字节一致
- **AND** 其 git 状态（未暂存）未被技能以任何方式变更

### Requirement: 滞留改动登记册格式

`openspec/changes/<提案名>/滞留改动登记.md` 的每条记录 SHALL 包含六个字段：日期、路径、归属、滞留原因、建议处置、状态；登记册 MUST 为追加式——新记录只追加，既有记录行 MUST NOT 被删除或改写，状态变化以追加新记录表达。

#### Scenario: 记录包含全部六字段

- **WHEN** 技能或归档技能向登记册追加一条滞留记录
- **THEN** 该记录同时含日期、路径、归属、滞留原因、建议处置、状态六个字段
- **AND** 任一字段无法确定时填入显式占位说明而非留空省略字段

#### Scenario: 登记册追加式不删行

- **GIVEN** 登记册已有 3 条历史记录
- **WHEN** 其中 1 条的状态需要更新（如已被处置）
- **THEN** 登记册在文件末尾追加 1 条新记录表达状态变化并回指原记录
- **AND** 原 3 条记录行保持逐字节不变，任何时刻都能从登记册还原完整滞留历史
