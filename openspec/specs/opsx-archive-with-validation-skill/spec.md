# opsx-archive-with-validation-skill Specification

## Purpose
TBD - created by archiving change add-archive-with-validation-skill. Update Purpose after archive.

## Requirements

### Requirement: 归档标准路径声明

`skills/opsx-archive-with-validation/SKILL.md` 开头 SHALL 声明本技能是归档的标准路径：涉及归档的请求默认进入本技能的四阶段流程，未经验收直接调用上游归档流程视为绕过标准；声明段 MUST 出现在技能正文任何阶段指令之前。

#### Scenario: 技能开头声明标准路径

- **WHEN** 审查者打开 `skills/opsx-archive-with-validation/SKILL.md`
- **THEN** 正文前部存在明确的标准路径声明段，说明涉及归档的请求默认走本技能
- **AND** 声明段位于 Phase 1 验收指令之前

#### Scenario: 未经验收不触发归档

- **GIVEN** 用户请求归档某个变更
- **WHEN** 该变更尚未经过本技能的 Phase 1 验收
- **THEN** 技能先进入 Phase 1 验收，而不是直接执行归档命令

### Requirement: Phase 1 逐项真实验收

Phase 1 SHALL 对每个检查项执行真实命令并在报告中附上实际命令与输出摘要；对无法执行的检查项（命令不可用、环境缺失、需要外部凭证等）SHALL 将该项 verdict 记为 `not_verified` 并附具体原因，MUST NOT 将不可执行的检查项记为 `pass` 或静默跳过。

#### Scenario: 可执行检查项附命令与输出

- **GIVEN** Phase 1 验收清单含一个可用命令验证的检查项
- **WHEN** 技能执行该项验收
- **THEN** 报告中记录实际执行的命令原文与输出摘要
- **AND** 该项 verdict 基于输出内容判定为 `pass` 或 `fail`

#### Scenario: 检查项命令不可执行时记 not_verified

- **GIVEN** 某检查项依赖的命令在本环境不可用（未安装、无权限或缺外部凭证）
- **WHEN** 技能执行该项验收
- **THEN** 该项 verdict 记为 `not_verified` 并附不可执行的具体原因
- **AND** 报告不把该项标记为 `pass`，也不从报告中省略该项

#### Scenario: 验收清单逐项无遗漏

- **GIVEN** Phase 1 有 N 个检查项
- **WHEN** Phase 1 结束
- **THEN** 报告对全部 N 项逐一给出三态 verdict 之一
- **AND** 不存在既无 verdict 又无记录原因的检查项

### Requirement: verdict 三态与归档拦截

检查项 verdict SHALL 限定为 `pass` / `fail` / `not_verified` 三态；整体判定 SHALL 在全部检查项均为 `pass` 时才为 pass——存在任一 `not_verified` 或 `fail` 时整体不得判 pass、技能 MUST NOT 执行归档，`not_verified` 与 `fail` 的拦截力度相同。

#### Scenario: 任一 not_verified 拦截归档

- **GIVEN** Phase 1 的 10 个检查项中 9 项 `pass`、1 项 `not_verified`
- **WHEN** 技能汇总整体判定并考虑是否进入 Phase 4 归档
- **THEN** 整体判定不得为 pass
- **AND** 技能不能执行归档，进入修复或未决处理路径

#### Scenario: fail 同样拦截归档

- **GIVEN** Phase 1 存在任一 `fail` 检查项
- **WHEN** 技能汇总整体判定
- **THEN** 技能进入 Phase 2 修复阶段
- **AND** 在复验通过前不得执行归档

#### Scenario: 全 pass 才进入归档

- **GIVEN** 某轮验收全部检查项 verdict 均为 `pass`
- **WHEN** 技能汇总整体判定
- **THEN** 技能进入 Phase 4 执行归档

### Requirement: finding 双字段证据锚点

Phase 1 产出的每条 finding SHALL 同时携带 `gap_type` 与 `source_ref` 两个必填字段：`gap_type` 取 missing / wrong / extra / unrequested 之一，`source_ref` 给出代码 ↔ spec 的双向证据锚点（代码位置与 spec 条目位置各一）；缺任一字段的 finding MUST 视为无效，Phase 2 不得依据无效 finding 修改代码。

#### Scenario: finding 携带完整双字段

- **GIVEN** Phase 1 发现实现与 spec 不一致
- **WHEN** 技能产出该 finding
- **THEN** finding 的 `gap_type` 为四值之一并准确反映差异性质
- **AND** `source_ref` 同时包含代码文件位置与 spec 条目位置，两者互相可定位

#### Scenario: 缺字段 finding 被判无效

- **GIVEN** 某条 finding 缺少 `gap_type` 或 `source_ref` 任一字段
- **WHEN** Phase 2 修复阶段处理该 finding
- **THEN** 技能将该 finding 标记为无效并退回 Phase 1 补全证据
- **AND** 不依据无效 finding 修改任何代码

### Requirement: 未决清单与三轮升级

验收报告末尾 SHALL 强制输出未决清单：`not_verified` / `blocked` / `paused` 状态的条目全部入列并标注来源轮次；同一事项连续 3 轮未决 SHALL 升级人工裁决，且自第 3 轮起技能 MUST NOT 再对该事项自动重试。

#### Scenario: 未决条目全部入尾清单

- **GIVEN** 某轮验收存在 `not_verified`、`blocked`、`paused` 条目各若干
- **WHEN** 技能生成验收报告
- **THEN** 报告末尾的未决清单包含上述全部条目
- **AND** 每条标注其来源轮次（第几轮验收产生或遗留）

#### Scenario: 连续三轮未决升级人工

- **GIVEN** 同一事项在第 1、2、3 轮验收中均处于未决状态
- **WHEN** 第 3 轮结束时技能处理该事项
- **THEN** 技能将该事项标记为升级人工裁决并停止自动处理
- **AND** 第 3 轮起技能不再对该事项执行任何自动重试

### Requirement: 四阶段流程与全 pass 归档

技能 SHALL 按固定顺序执行四个阶段：Phase 1 验收 → Phase 2 修复（依据有效 finding 修改）→ Phase 3 复验（重跑 Phase 1 验收确认修复生效）→ Phase 4 归档（全部检查项 pass 才执行）；MUST NOT 跳过 Phase 3 直接归档，MUST NOT 在复验仍有非 pass 项时归档。

#### Scenario: 修复后必须复验

- **GIVEN** Phase 2 依据 finding 修改了代码
- **WHEN** Phase 2 结束
- **THEN** 技能进入 Phase 3 重跑验收
- **AND** 复验确认原 finding 对应检查项转为 `pass` 后才进入 Phase 4

#### Scenario: 复验引入新 fail 时回到修复

- **GIVEN** Phase 3 复验发现新的 `fail` 检查项
- **WHEN** 技能处理复验结果
- **THEN** 技能回到 Phase 2 修复新 finding
- **AND** 在全部检查项 pass 前不执行归档

#### Scenario: 全 pass 后执行归档

- **GIVEN** Phase 3 复验全部检查项 `pass` 且未决清单无阻断条目
- **WHEN** 技能进入 Phase 4
- **THEN** 技能执行归档流程并在归档输出中附最终验收报告

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
