# 骨架仓纯中文检查门参考件（检查层）

## Why

三层防护的第三层（检查层）：校验层（allow-chinese-change-names）拦创建、引导层（naming-discipline-injection）让 AI 主动用中文，但已有英文目录名（历史存量）无人管。还原稿设计的检查层归宿是**公司骨架仓**——`skeleton/scripts/skeleton-check.ps1` 的 ⑦ 纯中文门 + `skeleton/log1-init.ps1` 的 Merge 模式探测。事实核验（recon 第 9 条）：本 fork 仓库**无** `skeleton/` 目录（全仓库唯一 `.ps1` 是 `scripts/binary/install.ps1` 二进制安装脚本，与骨架检查无关），检查门的真实执行时机与执行者是骨架铺设流程（与 ①-⑥ 其他门同列），fork 的 CLI 侧没有等价挂点。

**裁定（探索文档 3c 节）：以参考件形态在本变更目录内交付两份 `.ps1` 参考实现 + 契约文本，不做 fork 侧 `openspec validate`/`doctor` 等价物。** 理由：检查层的价值在「拦存量 + 自检」，其执行点在公司骨架铺设流程；强行在 fork 内做目录名门会创造**第二个政策源**，与骨架仓 ①-⑥ 门各自漂移，且 `validate` 每次全量扫历史目录慢且吵、偏离还原稿的执行点设计。若团队日后确需 fork 侧执法，`openspec doctor` 是自然归宿——登记为后续候选，本批不做。

## What Changes

### 1. artifacts/skeleton-check.ps1（⑦ 纯中文门参考件）

扫 `openspec/changes/`（不含 `archive/`，可用 `-IncludeArchive` 开关纳入）与 `openspec/specs/` 的目录名，实现三档语义：**新违规**（非纯中文且不在豁免标记内）→ FAIL（拦）；`.legacy-dirs.json` 标记内的目录 → WARN（存量豁免，提示 owner 待治理）；**纯中文** → PASS。归档日期前缀 `YYYY-MM-DD-` 是 `openspec archive` 生成的结构前缀（非用户命名），检查前剥离。脚本头注释标明「参考件——属公司骨架仓，随 allow-chinese 系列提案分发，落地到骨架仓后以骨架仓为准」与字符集单一来源声明（汉字判定以 OpenSpec naming 配置映射表 `\p{Script=Han}` 为准）。

### 2. artifacts/log1-init.ps1（Merge 模式探测段参考件）

Merge 模式探测 `openspec/changes/`、`openspec/specs/` 既有英文 kebab 目录 → 写 `openspec/.legacy-dirs.json`（`dirs` 清单 + `note` 待治理说明 + `generatedAt`）；探测为零时若存在旧清单则删除（owner 治理完后门自动恢复严格）。以可合并片段形态交付：完整函数 + 插入点说明，骨架仓落地时并入 `skeleton/log1-init.ps1` 的 Merge 分支。

### 3. design.md 固化契约

三档语义、`.legacy-dirs.json` 字段契约、字符集单一来源声明、纯中文判定口径（与校验层并集字符集的边界关系）写入 design.md，作为参考件与骨架仓真实版本之间防漂移的锚。

## Impact

- **无本仓运行时行为**：`.openspec.yaml` 声明 `skip_specs: true`（零 spec delta）；不动 `src/`、不动 `skills/`、不动模板与生成物（再生成三命令不适用）；公司骨架仓本身不在本仓库，无文件可改。
- 交付物：本变更目录内 `artifacts/skeleton-check.ps1`、`artifacts/log1-init.ps1`、`design.md` 契约。
- 风险：参考件与骨架仓真实版本可能漂移——以 design.md 契约 + 脚本头注释锚定，落地骨架仓后以骨架仓为准；交接清单见 tasks.md（复制到骨架仓并验收后删除本目录参考件）。
- 配套说明（非代码改动）：git 显示中文路径为转义八进制（`core.quotepath` 默认 true，纯显示层），公司环境统一 `git config core.quotepath false`——随参考件使用说明交付。
- 与校验层互补：校验层拦创建（合法性下限），检查层拦存量 + 自检（公司纪律层，口径更严，见 design.md 决策 4）。

## 需求溯源

- 来源文档：`openspec命名语言可配置方案-图片还原稿.md`「检查层：skeleton-check 纯中文门」全节（img-5）。
  - 「解决的问题」（校验层拦创建、引导层教 AI，但历史存量无人管；自检门新违规拦住、存量豁免）→ Why。
  - 「改哪些文件」`skeleton/scripts/skeleton-check.ps1`（⑦ 纯中文门）、`skeleton/log1-init.ps1`（Merge 模式探测既有英文目录 → 写 `.legacy-dirs.json` 标记）→ What Changes 1/2。
  - 「怎么改」⑦ 门扫 `openspec/changes`、`specs` 目录名非纯中文 FAIL；Merge 探测既有英文 kebab-case 目录写 `openspec/.legacy-dirs.json`（dirs 清单 + 待治理 note）；门读标记分档（标记内 WARN 不 FAIL、标记外 FAIL）→ What Changes 1/2 + design.md 契约 2/3。
  - 「关键机制」三档（新违规 FAIL / 历史存量 WARN / 纯中文 PASS）；`.legacy-dirs.json` 是豁免标记，owner 治理完删标记门恢复严格；与校验层互补（拦创建 vs 拦存量 + 自检）→ design.md 决策 2/3。
  - 「还原要点」→ tasks.md。
- 还原稿疑点 4：skeleton 脚本属公司骨架仓（本 fork 无 `skeleton/` 目录）；脚本编号「⑦」暗示骨架检查清单还有 ①-⑥ 其他门，均不在本仓库范围 → 参考件形态的根本原因。
- 探索文档裁定（3c 节）：形态 A 参考件交付（采纳）vs 形态 B fork 侧等价物（否决：双政策源漂移、validate 全量扫慢且吵、偏离执行点设计）；契约须固化三点（三档语义、`.legacy-dirs.json` 契约、字符集引用单一来源）。
- 偏差说明：本变更零 fork 代码、零 spec delta，是本批唯一使用 `skip_specs: true` 的变更（理由：参考件不产生本仓能力行为，契约由 design.md + 脚本注释承载，属纯交付物变更；对照 add-openspec-exclude-discipline 的取舍——那里纪律条款可被 rules-injection 机制观察，故挂能力规格，这里无机制挂点）。
