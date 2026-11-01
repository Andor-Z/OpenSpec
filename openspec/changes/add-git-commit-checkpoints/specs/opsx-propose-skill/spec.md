## ADDED Requirements

### Requirement: Proposal 产物提交检查点

propose 技能在生成全部 proposal 产物并展示最终状态之后、交接 apply 之前，SHALL 增加一个提交检查点步骤：向用户询问是否将本次 proposal 产物 git 提交；用户同意时以 `proposal:` 前缀的提交信息提交 `openspec/changes/<提案名>/` 下的产物；该技能 MUST NOT 在任何情况下未经用户确认自动执行 `git commit`。propose 的 command 模板变体保持上游原文，不携带本检查点。

#### Scenario: 用户同意提交 proposal 产物

- **GIVEN** propose 技能已完成全部 proposal 产物（proposal.md、specs/ delta、tasks.md 等）并展示了最终状态
- **WHEN** 技能询问「是否将本次 proposal 产物 git 提交」且用户答复同意
- **THEN** 技能执行一次 `git commit`，提交信息以 `proposal:` 为前缀并概括变更名
- **AND** 提交暂存范围仅限 `openspec/changes/<提案名>/` 下的产物，不含项目代码与其他目录

#### Scenario: 用户拒绝提交 proposal 产物

- **GIVEN** propose 技能已生成全部 proposal 产物并进入提交检查点
- **WHEN** 用户答复不提交（或明确要求跳过）
- **THEN** 技能不执行任何 `git commit`、不创建任何暂存
- **AND** 技能如实记录「用户选择暂不提交」后照常给出 `/opsx:apply` 交接语，不因拒绝而中断流程

#### Scenario: 永不自动提交

- **GIVEN** proposal 产物已全部生成且用户尚未对检查点做出任何答复
- **WHEN** 技能处于检查点等待状态
- **THEN** 技能不执行 `git commit`，直到用户明确答复同意
- **AND** 产物只写入工作区，不产生任何 git 提交记录

#### Scenario: command 面不携带 propose 检查点

- **WHEN** 再生成后对比 `/opsx:propose` command 模板与上游原文
- **THEN** command 模板文本与上游一致，未新增提交检查点步骤
- **AND** 检查点仅存在于 `skills/openspec-propose/SKILL.md` 的技能步骤流中
