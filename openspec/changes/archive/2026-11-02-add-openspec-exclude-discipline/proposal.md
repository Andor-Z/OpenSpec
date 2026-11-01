# openspec/ 提案产物本地排除与魔改工程纪律

## Why

《spec 建议清单》「纪律（改的时候必须遵守）」节的五条工程纪律目前只是需求稿里的口头约定：fork 仓库中没有任何一处持久化条款约束「改模板源不改生成物」「改完跑再生成三命令」「手工技能白名单登记」「openspec/ 提案产物本地 exclude 不入库」。后续每一次魔改（add-git-commit-checkpoints、add-apply-precise-staging、add-archive-with-validation-skill、add-stalled-change-triage）都要反复依赖这些纪律，一旦执行者遗忘（直接手改 skills/ 生成物、忘记先 build 就 generate、把手工技能放进未登记目录、用 git add -A 卷入提案产物），就会触发 parity 红灯、产物丢失或「一个提案一个 commit」被破坏。

本变更把纪律固化为两处：① `openspec/config.yaml` 的 rules 纪律条款（由 rules-injection 机制注入后续 artifact 生成指令，成为每次 propose/apply 的可见约束）；② `.git/info/exclude` 本地排除 `openspec/`（git 本地配置，不入库），使新提案产物默认不进版本库——这正是 add-apply-precise-staging「仓库不跟踪 openspec/ 的降级分支」的现场，也是 add-manual-skill-whitelist 白名单纪律的配套工程约定。

## What Changes

### 1. config.yaml rules 追加四条纪律条款

在 `openspec/config.yaml` 的 `rules.tasks` 追加四条（正文中文、路径与命令保留英文）：工作流行为改动只改模板源（`src/core/templates/`）不改生成物（`skills/`）；模板源改动后按顺序跑 `corepack pnpm build && corepack pnpm regen:parity-hashes && corepack pnpm generate:skills`（generate 从 `dist/` 导入，必须先 build）；手工技能不进模板生成管线、用 `MANUAL_SKILL_DIRS` 白名单登记保护；`openspec/` 新提案产物用 `.git/info/exclude` 本地排除不入库（只排除未跟踪新文件，已 tracked 历史提案不受影响，git add 会被静默跳过、需 `-f` 强制）。

### 2. 本地执行 .git/info/exclude 排除 openspec/

在仓库 `.git/info/exclude` 追加一行 `openspec/`。这是 git 本地配置，不是仓库文件，不入库、不进任何 commit。执行顺序约束：本变更自身目录必须先于 exclude 生效创建（作者已在创建本目录之后才追加 exclude），使「先创建、后排除」的顺序可审计；由于本变更产物在 exclude 生效时仍未 `git add`，后续入库本变更产物时需 `git add -f`（见 tasks.md 第 3 节），这本身就是纪律条款「git add 会被静默跳过、需 -f 强制」的实测点。

### 3. spec 处理选择：挂既有能力 openspec-conventions（ADDED），不用 skip_specs

本变更选择把纪律建模为既有能力 `openspec-conventions` 的 ADDED requirement（4 条），而非声明 `skip_specs: true`。理由：①这些纪律不是纯散文约定——`config-loading`/`rules-injection` 机制会读取 config.yaml rules 并注入后续 artifact 生成指令，条款的存在与内容是工具链可观察、可验证的行为（如 `openspec instructions tasks --change <name> --json` 的输出中可见）；②`openspec-conventions` 的 Purpose 本就是「OpenSpec 自身约定的单一事实源」，工程纪律归位于此最自然；③归档后纪律进入 specs/ 主规格，成为后续变更评审时可对照的持久条款，比 skip_specs（变更在规格语料中隐身）更符合「固化」目标。

## Impact

- 影响的能力：`openspec-conventions`（ADDED 4 条 requirement：模板源优先纪律、再生成三命令纪律、手工技能白名单登记纪律、openspec/ 本地排除纪律）。不 MODIFIED 任何既有 requirement。
- 配置文件：`openspec/config.yaml`（仅 `rules.tasks` 追加 4 条，不动 context 与其他 rules）。
- git 本地配置：`openspec-andor/.git/info/exclude` 追加 `openspec/`（不入库）。
- 生成物与测试：无模板源、无生成物变化；parity 套件不受影响。
- 呼应关系：add-apply-precise-staging 的「仓库不跟踪 openspec/ 降级分支」与本变更互为因果（exclude 生效后 apply 精确暂存自动走降级分支）；add-manual-skill-whitelist 的白名单纪律在本变更固化为条款；本变更及其余魔改变更的提交检查点若在 exclude 生效后执行，需 `git add -f` 收录 openspec/ 产物。

## 需求溯源

- 来源文档：`spec建议清单-图片还原.md`「纪律（改的时候必须遵守）」全节（图3）。
  - 「改模板源不改生成物（生成物重生成即覆盖）」→ What Changes 1 第 1 条 + spec「模板源优先纪律」。
  - 「改完跑再生成三命令：corepack pnpm build && corepack pnpm regen:parity-hashes && corepack pnpm generate:skills」→ What Changes 1 第 2 条 + spec「再生成三命令纪律」。
  - 「手工技能用白名单保护，不进生成管线。白名单在 src/core/shared/skill-generation.ts 的 MANUAL_SKILL_DIRS 数组……登记一个手工技能：往 MANUAL_SKILL_DIRS 数组加它的目录名」→ What Changes 1 第 3 条 + spec「手工技能白名单登记纪律」（机制本体由 add-manual-skill-whitelist 落地，本变更固化条款）。
  - 「openspec/ 提案产物本地 exclude 不入库。实现：.git/info/exclude 加 openspec/（只排除未跟踪新文件，已 tracked 的历史提案不受影响）。新提案产物是未跟踪，git add 会被 exclude 静默跳过（需 -f 强制）」→ What Changes 1 第 4 条 + What Changes 2 + spec「openspec/ 提案产物本地排除纪律」。
  - 「apply 是 skill/command 共享核心，改了模板源 command 面同步携带」→ 已由 add-git-commit-checkpoints 的 spec 场景（skill 与 command 两表面一致携带）承载，本变更不重复立项。
- 偏差说明：需求稿未规定纪律的固化载体与 spec 处理方式；「挂 openspec-conventions 而非 skip_specs」为作者按 planner 建议方向做出的裁定，理由见 What Changes 3。
