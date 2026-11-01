# 手工技能白名单实施清单

## 1. 白名单常量与清理跳过

- [ ] 1.1 在 `src/core/shared/skill-generation.ts` 导出 `MANUAL_SKILL_DIRS: readonly string[]`（初始含 `opsx-archive-with-validation`），附注释说明「登记 = 追加目录名」
- [ ] 1.2 修改 `scripts/skillssh-shared.mjs` 的 `cleanSkillSubdirectories(outDir, protectedNames = [])`：删除阶段跳过 `protectedNames`，symlink 拒绝检查保持前置且覆盖白名单目录
- [ ] 1.3 修改 `scripts/generate-skillssh.mjs`：从 `dist/core/shared/skill-generation.js` 导入 `MANUAL_SKILL_DIRS` 传入清理函数；生成前对白名单条目执行 kebab-case 校验，并与 `getSkillTemplates()` 的 `dirName` 集合做重名冲突断言

## 2. 测试增补与 parity 豁免

- [ ] 2.1 在 `test/core/templates/skillssh-generator-guards.test.ts` 增补：白名单目录在清理后保留且内容逐字节不变
- [ ] 2.2 同文件增补：未登记目录仍被清理、非法白名单条目抛错、白名单与模板 `dirName` 重名抛错、symlink 守卫覆盖白名单目录
- [ ] 2.3 修改 `test/core/templates/skillssh-parity.test.ts`「commits exactly the generated file set」用例：期望目录集扩为生成 `dirName` ∪ `MANUAL_SKILL_DIRS`（从同一常量导入），内层「仅含 SKILL.md」断言豁免手工目录，symlink 断言保持全覆盖；增补用例——手工目录存在时断言通过、未登记多余目录仍失败
- [ ] 2.4 回归确认 `test/core/templates/skill-templates-parity.test.ts` 与 skillssh 逐模板内容比对不受影响且全部通过

## 3. 再生成三命令

- [ ] 3.1 运行 `corepack pnpm build`（generate 从 `dist/` 导入，必须先编译）
- [ ] 3.2 运行 `corepack pnpm regen:parity-hashes` 重钉 parity 哈希
- [ ] 3.3 运行 `corepack pnpm generate:skills`，确认 12 个 `skills/openspec-*/` 目录内容零 diff、白名单目录（若存在）保留

## 4. parity 与相关测试

- [ ] 4.1 运行 `corepack pnpm test` 中 `test/core/templates/` 全部 22 个测试文件，重点 `skillssh-generator-guards.test.ts`、`skill-templates-parity.test.ts`、`skillssh-parity.test.ts`
- [ ] 4.2 手工验证：在 `skills/` 放一个临时手工目录（不入库），跑 `generate:skills` 确认被清理；把目录名加入 `MANUAL_SKILL_DIRS` 后重跑确认保留且 parity 仍绿，随后还原实验现场

## 5. 校验与提交检查点

- [ ] 5.1 运行 `openspec validate add-manual-skill-whitelist --strict`（仓库 CLI：`node ./bin/openspec.js`）
- [ ] 5.2 git 提交检查点实战：将本变更全部产物（本目录）以 `proposal: add-manual-skill-whitelist 手工技能白名单基建` 提交，确认单个 commit 仅含本变更文件、可独立回退（若 `.git/info/exclude` 已生效需 `git add -f`，见 add-openspec-exclude-discipline）
