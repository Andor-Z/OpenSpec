## ADDED Requirements

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
