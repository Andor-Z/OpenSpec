# apply 精确暂存实施清单

## 1. apply 模板源（step 8 暂存策略）

- [x] 1.1 修改 `src/core/templates/workflows/apply-change.ts` step 8：用户同意提交后先运行 `git status --porcelain` 预检并向用户呈现脏路径清单
- [x] 1.2 同文件 step 8 增补两组路径的精确暂存指令：①本轮实施触及的实现文件（实施循环中实际编辑/新建的文件）②`openspec/changes/<提案名>/` 产物目录
- [x] 1.3 同文件 step 8 增补降级分支：仓库不跟踪 `openspec/`（未纳入版本管理或被 `.git/info/exclude` 排除）时只暂存实现文件、说明产物未入库、禁止 `git add -f` 绕过
- [x] 1.4 同文件 step 8 增补留痕指令：暂存清单写入提交信息第二个 `-m` 或 `openspec/changes/<提案名>/tasks.md`，两者至少其一
- [x] 1.5 同文件 Guardrails 段增补红线：明文禁止 `git add -A` 与 `git add .`，无任何例外条款

## 2. 再生成三命令

- [x] 2.1 运行 `corepack pnpm build`（generate 从 `dist/` 导入，必须先编译）
- [x] 2.2 运行 `corepack pnpm regen:parity-hashes` 重钉 parity 哈希
- [x] 2.3 运行 `corepack pnpm generate:skills`，确认 `skills/openspec-apply-change/SKILL.md` 含 porcelain 预检、两组路径、禁止 `-A`/`.`、降级分支与留痕五项内容，其余生成技能零 diff

## 3. parity 与相关测试

- [x] 3.1 运行 `test/core/templates/skill-templates-parity.test.ts`（parity 金哈希），按流程重钉后跑至绿
- [x] 3.2 运行 `test/core/templates/skillssh-parity.test.ts`，确认 skills.sh 通道一致
- [x] 3.3 检查 `test/core/templates/` 下 apply 模板相关单元测试的文本断言是否需要同步
- [x] 3.4 确认 `/opsx:apply` command 生成内容同步携带全部五项暂存纪律（skill/command 共享文本）

## 4. 校验与提交检查点

- [x] 4.1 运行 `openspec validate add-apply-precise-staging --strict`（仓库 CLI：`node ./bin/openspec.js`）
- [x] 4.2 git 提交检查点实战：以 `proposal: add-apply-precise-staging 精确暂存` 提交本变更产物；实施落地后按新 step 8 实际执行一次精确暂存提交，验证脏工作区含无关文件时它们不进入 commit（若 `.git/info/exclude` 已生效需 `git add -f`，见 add-openspec-exclude-discipline）
