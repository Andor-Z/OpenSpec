## ADDED Requirements

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
