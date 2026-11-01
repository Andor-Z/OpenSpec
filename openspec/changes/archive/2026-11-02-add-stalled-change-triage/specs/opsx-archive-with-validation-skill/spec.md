## ADDED Requirements

### Requirement: 技能版本演进记录

`skills/opsx-archive-with-validation/SKILL.md` 的 frontmatter `version` 字段 SHALL 随技能行为增强递增 bump，并以正文变更记录注明增强内容与对应变更提案名，使手工技能的演进可追溯。

#### Scenario: 增强落地时版本号递增

- **GIVEN** 本变更对归档技能做多处行为增强
- **WHEN** 增强落地到 `skills/opsx-archive-with-validation/SKILL.md`
- **THEN** frontmatter `version` 从既有值递增（如 `1.0` → `1.1`）
- **AND** 正文中可找到标注本轮增强内容与 `add-stalled-change-triage` 提案名的变更记录

#### Scenario: 无行为改动不 bump

- **GIVEN** 一次编辑仅修正错别字或格式，不改变任何行为指令
- **WHEN** 审查者核对该次编辑
- **THEN** frontmatter `version` 保持不变
- **AND** 版本号只在行为增强时递增

### Requirement: Phase 1 开头滞留登记册呈现

归档技能 Phase 1 验收开始时 SHALL 先检查 `openspec/changes/<提案名>/滞留改动登记.md` 是否存在：存在则读取并把全部滞留项呈现给验收员（含日期/路径/归属/滞留原因/建议处置/状态），作为验收输入的一部分；不存在则直接进入检查项验收。

#### Scenario: 验收员先看到滞留项再验收

- **GIVEN** 待归档变更的目录下存在含 2 条记录的 `滞留改动登记.md`
- **WHEN** 归档技能进入 Phase 1
- **THEN** 技能在执行任何检查项之前把 2 条滞留项完整呈现给验收员
- **AND** 验收员可据此决定是否将滞留项纳入本轮验收范围

#### Scenario: 无登记册时直接验收

- **GIVEN** 待归档变更目录下不存在滞留改动登记.md
- **WHEN** 归档技能进入 Phase 1
- **THEN** 技能不输出滞留相关内容，直接开始检查项验收

### Requirement: Phase 3 拒修登记

Phase 2/3 修复与复验阶段，用户拒绝修复某条 finding 时，归档技能 SHALL 将该 finding 登记入 `openspec/changes/<提案名>/滞留改动登记.md`（标注拒修原因与 finding 的 `gap_type`/`source_ref`），MUST NOT 静默丢弃被拒 finding，也 MUST NOT 未经用户同意替用户执行修复。

#### Scenario: 用户拒修时 finding 入册

- **GIVEN** Phase 3 复验存在 1 条未通过的 finding，用户明确拒绝修复
- **WHEN** 技能处理该拒绝
- **THEN** `滞留改动登记.md` 追加一条记录，路径指向 finding 的 `source_ref` 代码位置
- **AND** 记录的滞留原因标注拒修原因并引用 `gap_type` 与 `source_ref`

#### Scenario: 被拒 finding 不得静默消失

- **GIVEN** 用户拒绝了某 finding 的修复
- **WHEN** Phase 4 汇总验收状态
- **THEN** 该 finding 仍出现在验收报告与未决清单中
- **AND** 技能不能因为被拒绝而从报告中删除该 finding

### Requirement: Phase 4 拒归档登记与 Rulings 归并

Phase 4 中用户拒绝归档时，归档技能 SHALL 将拒归档原因登记入滞留改动登记.md 并终止归档；同时 SHALL 把未决条目（`not_verified`/`blocked`/`paused`）从报告正文搬入报告尾部的 Rulings 清单统一管理，Rulings 清单成为未决事项的唯一权威位置。

#### Scenario: 用户拒归档时登记并终止

- **GIVEN** 验收全部 pass 但用户在 Phase 4 拒绝归档
- **WHEN** 技能处理该拒绝
- **THEN** 滞留改动登记.md 追加一条拒归档记录（注明拒归档原因与本提案改动去向）
- **AND** 技能不能执行归档，变更保持活动状态

#### Scenario: 未决条目统一搬入 Rulings

- **GIVEN** 某轮报告正文散落着 3 条 `not_verified` 与 1 条 `paused` 条目
- **WHEN** 技能生成最终报告
- **THEN** 报告尾部的 Rulings 清单包含全部 4 条未决条目并标注来源轮次
- **AND** 报告正文不再重复罗列这些条目的处置状态，Rulings 清单是唯一权威位置

### Requirement: Orchestrator 跨会话滞留可见性

归档技能的 Orchestrator 编排规则 SHALL 增加第 10 条：滞留改动跨会话可见——任何新会话进入归档或 apply 流程时先读取滞留改动登记.md 再执行后续步骤，滞留状态 MUST NOT 因会话更替而丢失。

#### Scenario: Orchestrator 第 10 条存在且可执行

- **WHEN** 审查者阅读归档技能的 Orchestrator 编排规则
- **THEN** 第 10 条明确规定滞留改动跨会话可见、新会话先读登记册
- **AND** 该条与 Phase 1 的滞留呈现要求、apply step 1 的扫描要求指向同一登记册文件

#### Scenario: 会话更替不丢失滞留状态

- **GIVEN** 会话 A 登记了滞留改动后结束，会话 B 接手同一提案
- **WHEN** 会话 B 开始归档或 apply
- **THEN** 会话 B 的流程入口先读取登记册
- **AND** 会话 A 登记的滞留项在会话 B 中可见且仍带原始六字段信息

### Requirement: 永不代用户处置无关改动

归档技能与 apply 技能的 Guardrails SHALL 增加红线：对登记为滞留的无关改动，技能只做登记与呈现，MUST NOT 代替用户删除、修改、提交或还原这些改动；处置动作只能由用户显式发起并执行。

#### Scenario: 技能对无关改动只登记不动手

- **GIVEN** 登记册中有一条归属他人的滞留改动
- **WHEN** 验收或分诊流程处理该条目
- **THEN** 技能的输出仅包含登记、呈现与建议处置
- **AND** 不存在任何由技能自动执行的对该文件的删除、修改、`git add`、`git commit` 或 `git checkout` 动作

#### Scenario: 处置必须由用户显式发起

- **GIVEN** 用户要求技能处置某条滞留改动（如删除临时文件）
- **WHEN** 技能执行该处置
- **THEN** 处置动作对应这条用户显式指令
- **AND** 技能在登记册追加状态变更记录，注明处置依据是用户指令
