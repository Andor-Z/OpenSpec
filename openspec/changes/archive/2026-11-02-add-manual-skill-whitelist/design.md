# 设计：手工技能白名单（MANUAL_SKILL_DIRS）

## Context

`scripts/generate-skillssh.mjs` 从 `dist/` 导入 `getSkillTemplates()`，先 `cleanSkillSubdirectories(outDir)` 清空 `skills/` 全部子目录，再逐个重建 12 个 `openspec-*` 生成技能。清理逻辑在 `scripts/skillssh-shared.mjs`：先做 symlink 拒绝检查，然后对所有目录 `rmSync(recursive, force)`。`src/core/shared/skill-generation.ts` 是模板注册中心，也是生成运行时（`getSkillTemplates` / `getCommandTemplates` / `generateSkillContent`）。

手工技能（直接编辑 `skills/<name>/SKILL.md`、不进模板管线）在现状机制下无法存活。需求稿要求白名单常量 `MANUAL_SKILL_DIRS` 落在 `src/core/shared/skill-generation.ts`。

planner 实测校准（2026-11-01）：`skills/` 分发树由 `scripts/generate-skillssh.mjs` 管线重建；清理函数 `cleanSkillSubdirectories()` 实际位于 `scripts/skillssh-shared.mjs`（约 L36-49）；且 `test/core/templates/skillssh-parity.test.ts` 的「commits exactly the generated file set」用例断言磁盘 `skills/` 目录集合与 `getSkillTemplates()` 输出完全相等（`expect(dirs).toEqual(expectedDirs)`），对多余目录零容忍。因此白名单必须同时打通两处：①清理跳过（`skillssh-shared.mjs`）②parity 精确目录集断言豁免（`skillssh-parity.test.ts`）。

## Goals / Non-Goals

**Goals:**

- `generate:skills` 清理阶段跳过白名单目录，手工技能文件在再生成后原样保留
- skillssh-parity 的精确目录集断言对手工目录豁免；未登记的多余目录仍被拒绝
- 登记成本 = 往 `MANUAL_SKILL_DIRS` 数组追加一个目录名
- 白名单与既有生成器安全守卫（symlink 拒绝、目录名校验）协同，不引入新攻击面

**Non-Goals:**

- 不新增「手工技能注册 API」或配置文件，只做数组常量
- 不改变 `openspec init/update` 向用户项目写技能的运行时行为（白名单只影响本仓库 skills.sh 静态分发树的清理）
- 不在本变更中创建任何手工技能内容（由 add-archive-with-validation-skill 完成）
- 不放宽 symlink 拒绝等安全检查

## Decisions

### 1. 常量位置：`src/core/shared/skill-generation.ts`（按需求稿）

```ts
/**
 * Hand-written skills that live in skills/ but are NOT produced by the
 * template pipeline. cleanSkillSubdirectories() must skip these; register a
 * manual skill by appending its directory name here.
 */
export const MANUAL_SKILL_DIRS: readonly string[] = [
  'opsx-archive-with-validation',
];
```

备选是放在 `scripts/` 本地。否决原因：需求稿明确指定位置；且 `skill-generation.ts` 已是「哪些技能存在」的单一事实源，白名单与技能清单放一起最不易漂移；`skillssh-parity.test.ts` 本就直接 import 此模块，豁免断言消费零成本。

**与需求稿的差异说明**：需求稿把白名单机制整体描述为 `skill-generation.ts` 内部之事（隐含「`cleanSkillSubdirectories` 跳过即可生效」）。实测裁定机制的**生效落点**有两处——清理函数（`scripts/skillssh-shared.mjs`）与 parity 精确目录集断言（`test/core/templates/skillssh-parity.test.ts`）——常量所在地不等于生效点。本设计保留常量位置（需求稿钉死、登记方式不变），把两处生效点如实落到对应文件，见决策 2 与决策 5。

### 2. 清理函数签名：可选参数，默认不保护（生效点之一）

`scripts/skillssh-shared.mjs` 的 `cleanSkillSubdirectories(outDir)` 是 skills/ 分发树重建管线（`scripts/generate-skillssh.mjs` L33 调用）的唯一清理点：

```js
export function cleanSkillSubdirectories(outDir, protectedNames = []) {
  // symlink 拒绝检查保持不变（对所有目录，包括白名单目录）
  for (const entry of entries) {
    if (entry.isDirectory() && !protectedNames.includes(entry.name)) {
      rmSync(join(outDir, entry.name), { recursive: true, force: true });
    }
  }
}
```

- 默认参数保证现有调用与测试向后兼容。
- `includes` 显式名单查找，不用正则/前缀匹配（遵循 rules：「Prefer explicit lookups over pattern matching」）。
- symlink 拒绝检查保持在删除之前且覆盖白名单目录：白名单保护的是「不被清理」，不是「免于安全检查」。

### 3. 白名单条目校验：复用既有目录名守卫

`prepareSkillDirectory` 已用 `/^[a-z0-9][a-z0-9-]*$/` 拒绝不安全目录名。`generate-skillssh.mjs` 在清理前对 `MANUAL_SKILL_DIRS` 逐条跑同一校验，非法条目（含 `..`、大写、路径分隔符）直接抛错中止生成，绝不静默忽略——静默忽略会让一个拼写错误的手工技能登记变成「下次再生成即丢失」。

### 4. parity 逐模板内容比对不扩展到手工技能

`skill-templates-parity.test.ts` 与 `skillssh-parity.test.ts` 的**逐模板内容比对**只访问 `getSkillTemplates()` 返回的生成技能，天然不涉及手工目录，无需改动。手工技能不注册模板，意味着其内容不受逐字节钉死保护——这是选定方案的代价，见 Risks。若后续有人误把手工技能注册成模板，parity 会立即以内容不一致打回——这是期望行为，不是需要绕过的障碍。

### 5. parity 精确目录集豁免（生效点之二）

`test/core/templates/skillssh-parity.test.ts` 有两条断言：①逐模板内容比对（只访问生成 dirNames）；②「commits exactly the generated file set」——磁盘目录集合必须与生成器输出完全相等（隐藏文件豁免、symlink 一律拒绝、每目录仅容 SKILL.md）。手工技能目录一落地，断言②即红。因此本变更必须同步修改该用例：

- 期望目录集从「模板 dirNames」扩为「模板 dirNames ∪ MANUAL_SKILL_DIRS」（两处消费同一常量，单一来源）。
- 内层「仅含 SKILL.md」断言只对生成技能目录执行，手工目录豁免（允许自带 references/ 等子文档）。
- symlink 断言继续覆盖全部条目，白名单不免除安全检查。
- 未登记的多余目录仍然使断言②变红——豁免不是弱化「生成树之外零容忍」的守卫，只是把容忍名单从空集扩为白名单。

## Risks / Trade-offs

**Risk: 白名单目录与未来生成技能目录名冲突。** 若某天上游新增同名模板技能，`generate:skills` 会重建同名目录覆盖手工内容且 parity 照样绿。
→ 缓解：在 `generate-skillssh.mjs` 加一个显式断言——`MANUAL_SKILL_DIRS` 与 `getSkillTemplates()` 的 `dirName` 集合交集非空时抛错，提示二选一（移出白名单或改目录名）。

**Risk: 手工技能被误登记拼写错误的目录名。** 真实目录没被保护，下次再生成被删。
→ 缓解：守卫校验目录名格式只挡非法字符，挡不住「格式合法但不存在」的名字；在 guards 测试中增加「白名单条目在 skills/ 下不存在时给出显式提示」的宽松告警任务，不阻断生成。

**Risk: parity 豁免与清理名单漂移。** 若豁免名单与清理保护名单不一致，会出现「清理保留但 parity 报错」或反向的不一致。
→ 缓解：豁免与清理消费同一个 `MANUAL_SKILL_DIRS` 常量，代码层面不存在第二个名单；guards 测试钉住两处行为一致。

**Risk: 手工技能享受不到模板管线的防漂移保护。** 无逐字节钉死，人为误编辑不会被 parity 拦截。
→ 缓解：白名单目录名冲突断言（本变更）+ 后续如需强约束可在 guards 测试中对 SKILL.md 的 frontmatter 与关键段落（verdict 三态、双字段、未决清单）做存在性断言，不做逐字节钉死。

**Risk: 用户项目 `openspec update` 不认识手工技能。** 本变更只管本仓库分发树；`init/update` 写入用户项目时仍只写模板技能，不会删除用户手工技能（其清理按显式名单，见 config rules），跨面影响为零。

## Rollout Plan

1. `src/core/shared/skill-generation.ts` 增加 `MANUAL_SKILL_DIRS` 并导出。
2. `scripts/skillssh-shared.mjs` 给 `cleanSkillSubdirectories` 加受保护名单参数；`scripts/generate-skillssh.mjs` 从 `dist/` 导入常量传入，并加名称冲突断言。
3. `test/core/templates/skillssh-parity.test.ts` 精确目录集断言扩为「生成 dirNames ∪ MANUAL_SKILL_DIRS」，内层「仅 SKILL.md」检查豁免手工目录。
4. 增补 `test/core/templates/skillssh-generator-guards.test.ts` 用例（保留/清理/symlink/非法条目四类）。
5. `corepack pnpm build && corepack pnpm regen:parity-hashes && corepack pnpm generate:skills`，确认 12 个生成技能内容零 diff、白名单目录（若已存在）保留。
6. 全量 parity 与 guards 测试回归。
