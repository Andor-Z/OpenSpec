# 设计：为什么 opsx-archive-with-validation 走手工技能而非模板生成管线

## Context

add-archive-with-validation-skill 要在 `skills/` 下放一个约 650 行的新技能 `opsx-archive-with-validation`。本仓库的技能有三层结构：模板源 `src/core/templates/workflows/*.ts`（唯一编辑处）→ 生成运行时 `src/core/shared/skill-generation.ts`（`getSkillTemplates()` 注册）→ 生成物 `skills/<name>/SKILL.md`（parity 测试逐字节钉死，手改必红）。add-manual-skill-whitelist 已为 `skills/` 增加 `MANUAL_SKILL_DIRS` 白名单，使登记目录在 `generate:skills` 全量清理时幸存。本技能选择走白名单手工路径，而非注册为模板技能。

## Decisions

### 1. 走手工技能 + 白名单（选定）

- 技能内容是内部验收政策（verdict 三态、finding 双字段、3 轮升级人工），不是 OpenSpec 通用工作流，不适合随 `openspec init/update` 推给所有上游用户。
- 约 650 行的策略文本预期高频迭代（验收项措辞、未决清单格式、分诊联动），手工文件改完即生效；走模板管线则每次都要 `build && regen:parity-hashes && generate:skills` 三命令全链路，迭代摩擦大。
- 不进模板注册表意味着 parity 测试不对它做逐字节钉死，避免把自有政策文本混进上游通用的 parity 金标准。
- 白名单机制（变更 1）按显式名单保护，符合仓库 rules「生成物按显式名单追踪，不做模式匹配删除」。

### 2. 备选方案「注册为模板技能」被否的原因（记录备查）

把 `opsx-archive-with-validation` 作为 `getSkillTemplates()` 的第 13 个条目（`dirName: 'opsx-archive-with-validation'`）技术上可行，但被否：

1. **分发语义错误**：`getSkillTemplates()` 的输出经 `openspec init/update` 写入每一个用户项目、经 skills.sh 分发树公开给 `npx skills add`。该标准路径会成为所有安装者的默认技能，越权。
2. **parity 钉死代价**：`skill-templates-parity.test.ts` 会对模板函数 payload 与生成内容做逐字节断言，650 行政策文本的每次微调都要重钉哈希并全量再生成，误改 skills/ 即红灯，把「编辑政策」变成「发版流程」。
3. **双表面耦合**：模板注册会同时进 skill 与 command 渲染面，而本技能没有对应 slash command 语义（它替换的是归档入口行为），需要额外加条件渲染豁免，复杂度不划算。
4. **上游同步冲突**：本 fork 需要长期跟上游演进（fork-status 显示与上游差异全部为官方演进），模板注册表是上游高频改动区，新增条目会制造永久合并冲突点；白名单常量在 `skill-generation.ts` 的落点小且稳定。

### 3. 技能文件自身的结构约定

- frontmatter：`name: opsx-archive-with-validation`、`description`（含触发词：归档、验收、验收不过不准归档）、`version`（起始 1.0，后续增强按 add-stalled-change-triage 约定 bump）。
- 开头「标准路径声明」段：声明本技能是归档的标准路径，上游 `openspec-archive-change` 的直接归档视为绕过标准。
- 正文四阶段（Phase 1 验收 → Phase 2 修复 → Phase 3 复验 → Phase 4 归档），每阶段有进入/退出条件；verdict 三态语义与未决清单格式以常量段落写死，避免执行时自由发挥。
- finding 双字段（`gap_type`、`source_ref`）在 Phase 1 的输出格式中定义为必填，缺字段的 finding 视为无效，Phase 2 不得依据无效 finding 动代码。

## Risks / Trade-offs

**Risk: 手工技能享受不到模板管线的防漂移保护。** 无 parity 钉死，人为误编辑不会被测试拦截。
→ 缓解：白名单目录名冲突断言（变更 1）+ 后续如需强约束可在 guards 测试中对 SKILL.md 的 frontmatter 与关键段落（verdict 三态、双字段、未决清单）做存在性断言，不做逐字节钉死。

**Risk: `openspec update` 不会把该技能同步到用户项目。** 手工技能只存在于本仓库 `skills/` 分发树。
→ 缓解：这正是选定方案的分发语义（内部标准路径，不外发）；若未来要外发，再走模板注册决策重评。

**Risk: 与上游 `openspec-archive-change` 的入口歧义。** 两个归档相关技能并存。
→ 缓解：技能开头标准路径声明 + description 触发词明确；上游技能保持原样不动，作为非标准回退路径存在。
