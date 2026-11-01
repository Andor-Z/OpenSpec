# git 提交检查点实施清单

## 1. propose 模板源（仅 skill 变体）

- [ ] 1.1 在 `src/core/templates/workflows/propose.ts` 的 `getOpsxProposeSkillTemplate()` 步骤 7「展示最终状态」之后插入提交检查点步骤：询问用户是否提交、`proposal:` 前缀、范围限 `openspec/changes/<提案名>/`、拒绝时记录并继续交接
- [ ] 1.2 同文件 `getOpsxProposeCommandTemplate()` 保持上游原文，不插入检查点步骤
- [ ] 1.3 检查点步骤文本明确「永不自动提交：用户未答复或拒绝时不得执行 `git commit`」

## 2. apply 模板源（skill/command 共享正文）

- [ ] 2.1 在 `src/core/templates/workflows/apply-change.ts` 步骤 7 之后新增 step 8 提交检查点：询问用户、`apply:` 前缀、提交前呈现文件范围、拒绝时按用户指示收尾
- [ ] 2.2 在 Output On Completion / Output On Pause 示例输出中同步补一版 step 8 的对话示例，保持模板内示例与步骤一致

## 3. 再生成三命令

- [ ] 3.1 运行 `corepack pnpm build`（generate 从 `dist/` 导入，必须先编译）
- [ ] 3.2 运行 `corepack pnpm regen:parity-hashes` 重钉 parity 哈希
- [ ] 3.3 运行 `corepack pnpm generate:skills`，确认 `skills/openspec-propose/SKILL.md` 与 `skills/openspec-apply-change/SKILL.md` 出现检查点步骤，其余 10 个生成技能零 diff

## 4. parity 与相关测试

- [ ] 4.1 运行 `test/core/templates/skill-templates-parity.test.ts`，若模板函数 payload 逐字节断言失败则按流程重钉哈希后再跑至绿
- [ ] 4.2 运行 `test/core/templates/skillssh-parity.test.ts`，确认 skills.sh 通道再生成-对比通过
- [ ] 4.3 检查模板相关单元测试是否有步骤计数/步骤列表断言需要同步更新
- [ ] 4.4 确认 `/opsx:apply` command 生成内容含 step 8、`/opsx:propose` 与 `/opsx:new` command 生成内容与上游一致

## 5. 校验与提交检查点

- [ ] 5.1 运行 `openspec validate add-git-commit-checkpoints --strict`（仓库 CLI：`node ./bin/openspec.js`）
- [ ] 5.2 git 提交检查点实战：将本变更全部产物以 `proposal: add-git-commit-checkpoints 提交检查点` 提交；随后在 apply 侧落地后按 step 8 以 `apply:` 前缀提交实施改动，验证一次提交一个提案、可独立回退（若 `.git/info/exclude` 已生效需 `git add -f`，见 add-openspec-exclude-discipline）
