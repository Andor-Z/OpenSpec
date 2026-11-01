# 滞留改动分诊

## Why

检查点提交遇到脏工作区时，工作区可能混有无关改动（其他提案的产物、临时实验）。上游与 add-git-commit-checkpoints / add-apply-precise-staging 之后的 step 8 仍只有「本提案相关精确暂存」的单侧行为：无关改动不被暂存（正确），但也无处登记、跨会话即失忆——下个会话不知道工作区留了什么、为什么留下、该谁处置。同时归档技能对「用户拒修、拒归档」的拒绝行为也没有留痕机制，未决事项（not_verified/blocked/paused）散落在报告正文里无法统一追踪。

本变更把「分诊」补全为闭环：相关改动精确暂存、无关改动登记入册跨会话可见、技能永不代用户处置无关改动、归档技能全面接入登记册。

## What Changes

### 1. apply step 1 增滞留登记扫描

apply 模板 step 1（选定变更）增加：若 `openspec/changes/<提案名>/滞留改动登记.md` 存在则先读取并向用户呈现遗留滞留项，实现跨会话可见性——新会话进来即知道上次留了什么。

### 2. apply step 8 增分诊

检查点提交遇脏工作区时，先 `git status --porcelain` 把所有脏路径分类：本提案相关 → 精确暂存（沿用 add-apply-precise-staging 逻辑）；无关改动 → 不暂存，逐条登记入 `openspec/changes/<提案名>/滞留改动登记.md`。用户拒提交时，本提案自身改动也登记为滞留。

### 3. 滞留改动登记册格式

登记册每条记录含：日期 / 路径 / 归属 / 滞留原因 / 建议处置 / 状态；追加式不删行（历史记录永不改写或移除，只以新记录更新状态）。

### 4. 归档技能七处增强

在 `skills/opsx-archive-with-validation/SKILL.md`（手工技能）上追加：①frontmatter 版本号 bump 标记本轮增强；②Phase 1 开头先读滞留改动登记.md 呈现给验收员；③Phase 3 用户拒修某 finding 时登记入册（标拒修原因）；④Phase 4 用户拒归档时登记拒归档原因，且未决条目从报告正文搬入尾部 Rulings 清单统一管理；⑤记录结构定义（登记册格式，与 apply 侧一致）；⑥Orchestrator 第 10 条：滞留改动跨会话可见、新会话先读登记册；⑦Guardrails 红线：技能永不代用户处置无关改动（只登记，不动手删/改）。

### 5. spec delta 顺序依赖说明

本变更对 `opsx-archive-with-validation-skill` 能力新增 requirement 采用 **ADDED** 而非 MODIFIED：该能力的主规格由 add-archive-with-validation-skill 先归档产生，在本变更起草与验证时主规格尚不存在，MODIFIED 会因对不上主规格而校验失败；ADDED 语义（向将存在的能力追加 requirement）与实施顺序（变更 4 先归档、变更 5 后归档）一致。

## Impact

- 影响的能力：`opsx-apply-skill`（ADDED 3 条：step1 扫描、step8 分诊、登记册格式）；`opsx-archive-with-validation-skill`（ADDED 6 条：版本 bump、Phase1 登记册呈现、Phase3 拒修登记、Phase4 拒归档登记与 Rulings 归并、Orchestrator 跨会话规则、不代用户处置红线）。其中⑤记录结构由 apply 侧「登记册格式」requirement 承载，归档侧引用同一格式。
- 模板源文件：`src/core/templates/workflows/apply-change.ts`（step 1 扫描 + step 8 分诊）。
- 手工技能文件：`skills/opsx-archive-with-validation/SKILL.md`（七处增强，frontmatter 版本 bump）。
- 生成物：`skills/openspec-apply-change/SKILL.md` 与 `/opsx:apply` command（共享文本同步）。
- 测试：`test/core/templates/skill-templates-parity.test.ts`、`skillssh-parity.test.ts`（重钉哈希）。
- 实施顺序依赖：add-git-commit-checkpoints（提供 step 8）→ add-apply-precise-staging（提供精确暂存）→ add-archive-with-validation-skill（提供归档技能主规格）→ 本变更。

## 需求溯源

- 来源文档：`spec建议清单-图片还原.md`「滞留改动分诊」全节（图2+图3）。
  - 「解决的问题」→ Why。
  - 「改哪些文件」三条（apply-change.ts、apply 生成物、归档技能七处增强）→ Impact。
  - 「怎么改」：脏路径分类（相关精确暂存/无关登记入册）、登记册六字段追加式、用户拒提交时本提案改动也登记、apply step 1 扫描、七处增强逐条 → What Changes 1–4。
  - 七处增强的①–⑦逐字对应 What Changes 4 的小项编号。
- 「纪律」节（模板源/三命令/白名单/共享核心）→ tasks.md 实施路径。
- 偏差说明：需求稿未规定 spec delta 的挂载与区块选择；因变更 4 的能力主规格在本变更验证时尚未归档产生，本变更对该能力用 ADDED 而非 MODIFIED（见 What Changes 5），这是对需求稿的落地方式补充而非行为偏离。
