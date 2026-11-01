# skill-generation Specification

## Purpose
TBD - created by archiving change add-manual-skill-whitelist. Update Purpose after archive.

## Requirements

### Requirement: 手工技能目录白名单

技能生成机制 SHALL 在 `src/core/shared/skill-generation.ts` 维护一个导出常量 `MANUAL_SKILL_DIRS: readonly string[]`，列出由人工直接编辑、不进模板生成管线的 `skills/` 子目录名；登记一个手工技能的唯一方式 SHALL 是向该数组追加其目录名，机制 MUST NOT 提供模式匹配、前缀规则或自动探测等其他登记途径。

#### Scenario: 登记方式为向数组追加目录名

- **WHEN** 开发者要让一个手写技能（如 `opsx-archive-with-validation`）免于生成清理
- **THEN** 唯一需要的改动是在 `MANUAL_SKILL_DIRS` 数组中追加该技能的目录名字符串
- **AND** 不需要修改任何测试夹具、配置文件或生成脚本

#### Scenario: 无其他登记通道

- **WHEN** 审查者检查该机制的实现
- **THEN** 白名单来源只有 `MANUAL_SKILL_DIRS` 这一个常量
- **AND** 代码中不存在按文件名模式、正则或目录内容探测「手工技能」的逻辑

### Requirement: 清理阶段跳过白名单目录

`generate:skills` 运行 `cleanSkillSubdirectories()` 清理 `skills/` 子目录时，SHALL 跳过 `MANUAL_SKILL_DIRS` 中登记的目录（不删除、不重建、不改写其内容），未登记目录的清理行为 MUST 保持与现状完全一致（递归删除后由模板重建）。

#### Scenario: 白名单目录在再生成后保留

- **GIVEN** `skills/opsx-archive-with-validation/SKILL.md` 为人工编辑内容，且该目录名已登记进 `MANUAL_SKILL_DIRS`
- **WHEN** 依次运行 `corepack pnpm build && corepack pnpm regen:parity-hashes && corepack pnpm generate:skills`
- **THEN** `skills/opsx-archive-with-validation/SKILL.md` 的字节内容与再生成前完全一致
- **AND** 该目录内其他文件（如 references 子文档）同样原样保留

#### Scenario: 未登记目录仍被全量清理

- **GIVEN** `skills/` 下存在一个目录，其名称不在 `MANUAL_SKILL_DIRS` 中，也不是任何模板技能的 `dirName`
- **WHEN** 运行 `corepack pnpm generate:skills`
- **THEN** 该目录被整体删除
- **AND** 12 个模板生成技能目录被重建为与模板一致的内容

### Requirement: 白名单守卫与安全检查

生成器 SHALL 对 `MANUAL_SKILL_DIRS` 的每个条目执行与 `prepareSkillDirectory` 相同的目录名安全校验（kebab-case 格式），非法条目 MUST 使生成显式报错中止；当白名单条目与任一模板技能 `dirName` 重名时生成器 MUST 报错拒绝生成；symlink 拒绝检查 MUST 继续覆盖白名单目录。

#### Scenario: 非法白名单条目中止生成

- **WHEN** `MANUAL_SKILL_DIRS` 中出现含路径分隔符、`..`、大写字母或非 kebab-case 字符的条目
- **THEN** `corepack pnpm generate:skills` 抛出指明该条目的错误并中止
- **AND** `skills/` 树保持进入本次生成前的完整状态（拒绝发生在删除之前）

#### Scenario: 白名单与模板技能重名被拒绝

- **WHEN** `MANUAL_SKILL_DIRS` 中某条目与 `getSkillTemplates()` 返回的某个 `dirName` 相同
- **THEN** `generate:skills` 抛错提示该目录名既是模板技能又是手工技能、必须二选一
- **AND** 不执行任何清理或写入

#### Scenario: 白名单目录内的 symlink 仍被拒绝

- **GIVEN** `skills/` 下存在一个白名单目录
- **WHEN** `skills/` 下任何条目是指向外部的 symlink
- **THEN** `cleanSkillSubdirectories()` 在删除任何内容前抛出 symlink 错误
- **AND** 白名单身份不免除该安全检查

### Requirement: parity 精确目录集豁免

`test/core/templates/skillssh-parity.test.ts` 的精确目录集断言（「commits exactly the generated file set」）SHALL 把期望目录集从「模板 `dirName` 全集」扩为「模板 `dirName` 全集 ∪ `MANUAL_SKILL_DIRS`」，使已登记的手工技能目录在磁盘存在时断言仍通过；逐模板内容比对 SHALL 继续只覆盖模板生成技能；symlink 拒绝断言 MUST 继续覆盖 `skills/` 下全部条目（含手工目录）；未登记的多余目录 MUST 仍被精确目录集断言拒绝。

#### Scenario: 手工目录落地后精确目录集断言仍通过

- **GIVEN** `skills/opsx-archive-with-validation/` 已登记进 `MANUAL_SKILL_DIRS` 且目录存在于磁盘
- **WHEN** 运行 `test/core/templates/skillssh-parity.test.ts`
- **THEN** 「commits exactly the generated file set」断言通过
- **AND** 手工目录不受「目录内仅含 SKILL.md」内层断言约束（允许携带 references 等其他子文档）

#### Scenario: 未登记的多余目录仍被拒绝

- **GIVEN** `skills/` 下存在一个既非模板 `dirName` 也未登记白名单的目录
- **WHEN** 运行 skillssh-parity 的精确目录集断言
- **THEN** 断言失败并指出该多余目录
- **AND** 豁免名单只有 `MANUAL_SKILL_DIRS` 一个来源，不存在其他豁免通道

#### Scenario: symlink 红线覆盖手工目录

- **GIVEN** `skills/` 下某手工目录内出现 symlink 条目
- **WHEN** 运行 skillssh-parity 测试
- **THEN** symlink 断言失败
- **AND** 白名单身份不免除该安全检查

#### Scenario: 逐模板内容比对与生成物零 diff 不变

- **GIVEN** 本变更落地且模板指令文本零改动
- **WHEN** 运行 parity 套件并执行完整再生成三命令
- **THEN** 逐模板内容比对仍只覆盖 12 个生成技能且全部通过
- **AND** `git status` 显示 `skills/openspec-*/` 下无任何内容变化

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
