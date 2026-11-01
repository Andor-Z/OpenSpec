# 手工技能白名单（MANUAL_SKILL_DIRS）

## Why

fork 现状（HEAD 27c0515，纯上游快照）没有「手工技能」通道：`generate:skills` 运行时 `cleanSkillSubdirectories()`（`scripts/skillssh-shared.mjs`）会把 `skills/` 下所有子目录全量清空重建，且全仓库 grep `MANUAL_SKILL_DIRS` / `manualSkillDirs` 零命中。这意味着任何直接放在 `skills/` 下的手工技能（例如后续要新增的 `opsx-archive-with-validation`）都会在下次再生成时被静默删除，也没有任何豁免通道可救。

「验证式归档技能」等魔改需要手工编辑 `skills/` 下的文件而不进模板生成管线，这与现有「全量清理重建」机制直接冲突。因此必须先落地一个白名单基建，让 `generate:skills` 在清理时跳过登记过的手工技能目录。本变更是其余魔改变更（尤其是 add-archive-with-validation-skill）的前置基建。

## What Changes

### 1. 新增手工技能目录白名单常量

在 `src/core/shared/skill-generation.ts` 导出 `MANUAL_SKILL_DIRS: readonly string[]` 常量（初始含 `opsx-archive-with-validation`，为本 fork 后续手工技能占位）。登记一个手工技能 = 往该数组追加目录名，不做模式匹配、不做自动探测（遵循仓库 rules：「生成物按显式名单追踪，不做模式匹配删除」「Use existing constants and lists」）。

### 2. 清理函数跳过白名单目录

`scripts/skillssh-shared.mjs` 的 `cleanSkillSubdirectories(outDir)` 增加可选的受保护名单参数：删除阶段跳过名单中的目录，其余行为（递归建目录、symlink 拒绝前置检查）保持不变。`scripts/generate-skillssh.mjs` 调用时传入从 `dist/` 导入的 `MANUAL_SKILL_DIRS`。

### 3. 生成器守卫与测试同步

- 白名单目录名沿用 `prepareSkillDirectory` 同款 kebab-case 安全校验，非法名单条目让生成显式报错而不是静默跳过。
- `test/core/templates/skillssh-generator-guards.test.ts` 增补用例：白名单目录在清理后保留、未登记目录仍被清理、symlink 守卫对白名单目录同样生效。
- `test/core/templates/skillssh-parity.test.ts` 的「commits exactly the generated file set」用例实测断言磁盘 `skills/` 目录集合与生成器输出完全相等（对多余目录零容忍），必须同步把期望目录集扩为「模板 `dirName` ∪ `MANUAL_SKILL_DIRS`」，并把手工目录从内层「仅含 SKILL.md」断言中豁免；symlink 断言继续覆盖全部条目。
- `test/core/templates/skill-templates-parity.test.ts` 与 skillssh 逐模板内容比对保持只覆盖生成技能；本变更不改动任何模板指令文本。

## Impact

- 影响的能力：新增 `skill-generation` 能力规格（specs/ 中无既有相近能力可挂，最接近的 `command-generation` 只管命令面生成）。
- 模板源/源文件：`src/core/shared/skill-generation.ts`（新增常量，白名单单一来源）、`scripts/skillssh-shared.mjs`（生效点之一：清理跳过逻辑）、`scripts/generate-skillssh.mjs`（传参与重名冲突断言）、`test/core/templates/skillssh-parity.test.ts`（生效点之二：精确目录集断言豁免）。
- 生成物：`skills/` 树的清理行为变化——白名单目录不再被删除；12 个生成技能目录内容零变化。
- 测试：`test/core/templates/skillssh-generator-guards.test.ts`（新增用例）；`test/core/templates/skillssh-parity.test.ts`（精确目录集断言豁免手工目录）；`test/core/templates/skill-templates-parity.test.ts`（回归确认不红）。
- 不改动：任何 `src/core/templates/workflows/*.ts` 指令文本、任何已生成 `skills/openspec-*/SKILL.md`、`openspec/changes/` 下已有变更。

## 需求溯源

- 来源文档：`spec建议清单-图片还原.md`。
- 「纪律（改的时候必须遵守）」第 3 条：手工技能（`opsx-archive-with-validation`）用白名单保护、不进生成管线；白名单在 `src/core/shared/skill-generation.ts` 的 `MANUAL_SKILL_DIRS` 数组；`cleanSkillSubdirectories` 在 `generate:skills` 时清理 `skills/` 子目录但跳过白名单里的；登记方式=往数组加目录名。
- 顶部「关键前提」引用块与「验证式归档技能」节的「白名单保护不进生成管线」为同一机制的另一处表述。
- 偏差说明：需求稿把 `MANUAL_SKILL_DIRS` 当作既有机制引用，但 fork-status 核查确认该机制在本 fork 完全不存在，故本变更将其作为新基建立项落地，常量命名与登记方式严格按需求稿执行。
- 落点校准（planner 实测裁定）：需求稿把白名单机制描述为 `skill-generation.ts` 内部之事（隐含清理跳过即可生效）；实测发现机制的生效落点为两处——`scripts/skillssh-shared.mjs` 的 `cleanSkillSubdirectories()`（清理跳过）与 `test/core/templates/skillssh-parity.test.ts` 的「commits exactly the generated file set」精确目录集断言（对手工目录零容忍，必须豁免）。常量保留在需求稿钉死的 `skill-generation.ts`，生效点如实落到上述两处；差异与原因详见 design.md「与需求稿的差异说明」与决策 5。
