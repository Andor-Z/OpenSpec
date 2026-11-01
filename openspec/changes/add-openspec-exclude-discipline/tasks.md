# openspec/ 本地排除与魔改纪律固化实施清单

## 1. 纪律条款落地（config.yaml）

- [x] 1.1 在 `openspec/config.yaml` 的 `rules.tasks` 追加四条纪律：改模板源（`src/core/templates/`）不改生成物（`skills/`）；改完按顺序跑 `corepack pnpm build && corepack pnpm regen:parity-hashes && corepack pnpm generate:skills`；手工技能用 `MANUAL_SKILL_DIRS` 白名单登记保护（登记 = 往数组追加目录名，与 add-manual-skill-whitelist 呼应）；`openspec/` 新提案产物用 `.git/info/exclude` 本地排除（只排除未跟踪新文件，已 tracked 历史提案不受影响，git add 会被静默跳过需 `-f` 强制，与 add-apply-precise-staging 降级分支呼应）（作者已随本提案落地）

## 2. 本地排除执行（.git/info/exclude，顺序敏感）

- [x] 2.1 确认本变更目录已创建（创建动作先于 exclude 生效，满足「先创建、后排除」顺序；产物在 exclude 生效时未 add，入库需 `-f`）
- [x] 2.2 在 `openspec-andor/.git/info/exclude` 追加一行 `openspec/`（git 本地配置，不入库、不进任何 commit；作者已执行）

## 3. 验证

- [ ] 3.1 运行 `git check-ignore -v openspec/changes/add-openspec-exclude-discipline/proposal.md` 确认排除规则命中
- [ ] 3.2 运行 `git status --porcelain` 确认 `openspec/changes/` 下未跟踪新目录不再显示、而 `openspec/config.yaml`（已跟踪）的修改照常显示
- [ ] 3.3 运行 `node ./bin/openspec.js context --json` 确认 config.yaml 追加 rules 后解析正常
- [ ] 3.4 运行 `openspec validate add-openspec-exclude-discipline --strict`（仓库 CLI：`node ./bin/openspec.js`）

## 4. 提交检查点

- [ ] 4.1 git 提交检查点实战：`git add openspec/config.yaml`（已跟踪文件，无需 -f）+ `git add -f openspec/changes/add-openspec-exclude-discipline/`（被排除路径，需 -f 强制），以 `proposal: add-openspec-exclude-discipline 本地排除与魔改纪律固化` 提交；提交信息注明本变更是「先创建目录、后追加 exclude」顺序的 founding case
