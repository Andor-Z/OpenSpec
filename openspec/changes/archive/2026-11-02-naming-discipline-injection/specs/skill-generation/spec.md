## ADDED Requirements

### Requirement: 命名纪律共享常量

技能生成机制 SHALL 在 `src/core/templates/workflows/naming-discipline.ts` 维护单导出共享常量 `NAMING_DISCIPLINE`，内容 SHALL 同时包含两条纪律：change 目录名纯中文（spec 正文中文，`SHALL`/`MUST` 等规范关键词保留英文——RFC 2119 不动）与 capability（spec）目录名引导用中文（当前无校验，引导为主）；常量 SHALL 说明动机（名称自解释，spec 积累到数百个时目录名直接可读）并给出合法示例（如 `修复会话过期`）与非法示例（如 `Fix_Session`）；对英文 kebab 名的措辞 SHALL 是「优先中文」而非「禁止英文」——并集字符集下英文 kebab 名仍合法，与校验层语义一致。

#### Scenario: 常量内容覆盖两条纪律与动机

- **WHEN** 审查者阅读 `NAMING_DISCIPLINE` 常量文本
- **THEN** 文本同时包含 change 目录名与 capability 目录名两条命名纪律
- **AND** 包含「名称自解释」动机说明与合法示例 `修复会话过期`、非法示例 `Fix_Session`

#### Scenario: 规范关键词保留英文

- **WHEN** 常量描述 spec 正文的书写纪律
- **THEN** 明确 `SHALL`/`MUST` 等 RFC 2119 规范关键词保留英文
- **AND** 常量自身的规范词使用英文 `SHALL`/`MUST`、其余正文为中文

#### Scenario: 措辞为优先中文而非禁止英文

- **WHEN** 常量描述与英文 kebab 名的关系
- **THEN** 措辞是优先中文、英文 kebab 名仍合法（校验层并集字符集放行）
- **AND** 不出现「禁止英文」「必须拒绝英文」等与校验层矛盾的表述

### Requirement: 五模板 skill 面注入与措辞重写

技能生成 SHALL 把 `NAMING_DISCIPLINE` 注入 propose、new-change、ff-change、onboard 四个模板的 skill 面，并在 apply-change 的 skill/command 共享正文（`getApplyInstructions()`）注入一次使两表面同步携带；注入后 skill 面既有的 kebab 措辞（propose 2 处、new-change 3 处、ff-change 2 处、onboard 1 处，共 8 处）MUST 同步重写为遵循纪律的表述，示例改用中文，同表面 MUST NOT 保留与纪律相矛盾的「derive a kebab-case name」类指令；`SKILL_APPLY_HANDOFF`/`COMMAND_APPLY_HANDOFF` 等 optionalWorkflow 交接变量 MUST NOT 被插入纪律段。

#### Scenario: AI 主动用中文命名

- **GIVEN** agent 通过 propose/new-change/ff-change/onboard 任一技能路径创建变更，用户以中文描述需求
- **WHEN** agent 派生 change 目录名
- **THEN** agent 主动使用中文命名（如 `修复会话过期`），而不是默认派生英文 kebab 名等待校验层拦截后才改

#### Scenario: skill 面无自相矛盾措辞

- **WHEN** 再生成后审查 propose、new-change、ff-change、onboard 四个 skill 面文本
- **THEN** 每个表面不再出现「derive a kebab-case name」与英文命名示例（如 `add-user-auth`）
- **AND** 纪律段与步骤指令对目录名的表述一致，不存在同表面自相矛盾

#### Scenario: apply 共享正文注入后两表面同步携带

- **WHEN** 对比 `skills/openspec-apply-change/SKILL.md` 与 `/opsx:apply` command 生成内容
- **THEN** 两个表面包含同一段命名纪律文本（共享正文单点注入，parity 机制强制一致）
- **AND** 任一表面缺失纪律段时 parity 测试失败

#### Scenario: 纪律段不进 optionalWorkflow 交接变量

- **WHEN** 审查 propose 模板的 `SKILL_APPLY_HANDOFF`/`COMMAND_APPLY_HANDOFF` 渲染结果
- **THEN** 交接文本不含命名纪律段
- **AND** 纪律段仅以共享常量插值出现在 skill 面（与 apply 共享正文）固定位置

### Requirement: command 面不对称保持上游原文

propose、new-change、ff-change 的 command 模板 SHALL 保持上游原文一字不改：不注入 `NAMING_DISCIPLINE`、不改其 7 处 kebab 措辞；command 驱动流程派生英文 kebab 名时 MUST 仍能通过校验层（引导层不改变合法性边界，属优雅降级而非阻断）；onboard 无 command 面，不受本条约束。

#### Scenario: command 面不含纪律段

- **WHEN** 再生成后对比 `/opsx:propose`、`/opsx:new`、`/opsx:ff` 的 command 生成内容与上游模板原文
- **THEN** 三个 command 面与上游逐字节一致，未出现命名纪律段
- **AND** 其原有 kebab 措辞（如「derive a kebab-case name」）保持原文未被改写

#### Scenario: 英文 kebab 名仍可通过校验（引导非硬拦）

- **GIVEN** agent 经 command 面流程派生英文 kebab 名（如 `add-user-auth`）
- **WHEN** 该名称通过 `openspec new change` 创建
- **THEN** 校验层放行（并集字符集下英文 kebab 名合法），创建成功
- **AND** 引导层不改变校验层行为——skill 面引导中文与 command 面产出英文名并存，属优雅降级
