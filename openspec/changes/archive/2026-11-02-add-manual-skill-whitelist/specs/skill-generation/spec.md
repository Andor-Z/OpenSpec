## ADDED Requirements

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
