# 命名纪律注入技能模板（引导层）

## Why

校验层（allow-chinese-change-names）只在创建时拦非法名，但 AI 不知道要用中文——可能默认派生英文 kebab 名，创建时被拦才改，引导缺位。需要在技能模板里主动告诉 AI「change/capability 目录名优先用中文」，让 AI 一开始就用中文命名；校验层兜底拦漏网。纪律是引导不是硬拦。

现状（recon file:line）：kebab 命名措辞硬编码在 4 个模板 × 2 表面共 15 处——propose（skill :57/:66、command :230/:239）、new-change（skill :38/:47/:96、command :117/:126/:174）、ff-change（skill :42/:51、command :162/:171）、onboard（skill :252，无 command 面），其中 skill 面 8 处、command 面 7 处。若 skill 面既注入「目录名优先中文」又保留「derive a kebab-case name (e.g., add-user-auth)」，同表面自相矛盾、agent 行为不可预测——注入与措辞重写必须同步做。

## What Changes

### 1. 新增共享常量 NAMING_DISCIPLINE

`src/core/templates/workflows/naming-discipline.ts` 导出共享常量 `NAMING_DISCIPLINE`（仿 `store-selection.ts` 的 `STORE_SELECTION_GUIDANCE` 单文件单导出先例）：

- change 目录名纯中文（正文中文、`SHALL`/`MUST` 等规范关键词保留英文——RFC 2119 不动）；
- capability（spec）目录名引导用中文（当前无校验，引导为主；`NAMING_DISCIPLINE` 常量同时写明两条纪律，capability 名引导不单独立项）；
- 说明动机（名称自解释——几百个 spec 时目录名直接可读，英文 kebab 需要翻译）；
- 给出合法示例（`修复会话过期`）与非法示例（`Fix_Session`）；
- 对英文 kebab 名的措辞是「优先中文」不是「禁止英文」——并集字符集下英文 kebab 名仍合法，与校验层语义一致。

### 2. 注入 5 个模板的 skill 面

注入集 = propose、new-change、ff-change、onboard（**仅 skill 面**）+ apply-change（skill/command 共享正文 `getApplyInstructions()` 注入一次，两表面同步携带）。比还原稿的 3 模板（propose/apply/new-change）扩入 ff-change 与 onboard：两者是活跃建 change 路径，漏掉则 agent 走这两条流程时仍主动派生英文名，引导层在最常用入口破洞；共享常量注入是每模板 2-3 行，成本几乎不增；5 模板共享 1 常量是第二阶段语言可配置时唯一不需二次重构的形态。

**不对称纪律**：propose、new-change、ff-change 的 command 面一律保持上游原文一字不改（不注入、不改措辞）；apply 因共享正文结构，command 面同步携带（还原稿已接受此副作用）；onboard 本无 command 面。已知矛盾并接受：propose/new/ff 的 command 面仍有「derive a kebab-case name」措辞——并集字符集下英文名依然合法，command 驱动流程产出 kebab 名会通过校验层，只是不中文，属优雅降级而非阻断。

### 3. skill 面 8 处 kebab 措辞同步重写，英文示例改中文示例

propose :57/:66、new-change :38/:47/:96、ff-change :42/:51、onboard :252——重写为遵循纪律的表述，示例改中文（还原稿疑点 3「按模板实际内容定」即此 8 处），保证 skill 面无自相矛盾措辞。

### 4. spec delta：ADDED 挂 skill-generation + MODIFIED opsx-onboard-skill

- ADDED 挂 `skill-generation`（specs/ 能力清单核查裁定：new-change/ff/onboard 技能无既有能力规格可挂，拆挂 opsx-propose-skill + opsx-apply-skill 会漏掉三个模板或迫使新建能力规格；注入纪律是「模板 → 生成」管线属性，挂 `skill-generation` 单点覆盖 5 模板，不新建 naming-discipline 能力）。场景含「AI 主动用中文命名」「command 面不含纪律段（不对称）」「英文 kebab 名仍可通过校验（引导非硬拦）」。
- MODIFIED `opsx-onboard-skill`「Guided Artifact Creation」requirement（整块替换含全部 5 个既有 scenario）：「Change creation with narration」场景的 derived kebab-case name 措辞与新模板对齐（探索文档第 10 节列为可选 MODIFIED，本变更采纳以防规格与实现漂移）。

## Impact

- 影响的能力：`skill-generation`（ADDED 3 条 requirement：命名纪律共享常量、五模板 skill 面注入与措辞重写、command 面不对称保持上游原文）；`opsx-onboard-skill`（MODIFIED 1 条 requirement「Guided Artifact Creation」）。
- 模板源：`src/core/templates/workflows/naming-discipline.ts`（新增）、`propose.ts`（skill 变体）、`new-change.ts`（skill 变体）、`ff-change.ts`（skill 变体）、`onboard.ts`、`apply-change.ts`（共享正文）。
- 生成物（随变更入库）：`skills/openspec-propose/SKILL.md`、`skills/openspec-new-change/SKILL.md`、`skills/openspec-ff-change/SKILL.md`、`skills/openspec-onboard/SKILL.md`、`skills/openspec-apply-change/SKILL.md` 及 `/opsx:apply` command 面（共享文本自动携带）；`/opsx:propose`、`/opsx:new`、`/opsx:ff` command 保持上游原文零 diff。
- 测试：新增 `test/core/templates/naming-discipline.test.ts`（仿 `project-root-guard.test.ts` 注入专测）；`skill-templates-parity.test.ts` 内容重钉；`skillssh-parity.test.ts` + `regen:parity-hashes` 哈希重钉。
- 不改动：command 模板面 7 处 kebab 措辞（保持上游原文）、`SKILL_APPLY_HANDOFF`/`COMMAND_APPLY_HANDOFF`（optionalWorkflow 不对称机制，与命名纪律无关，注入时不得插进 handoff 变量）、`MANUAL_SKILL_DIRS` 白名单机制、校验层代码。
- 依赖：allow-chinese-change-names 先实施（字符集定稿后纪律文案才不返工——「优先中文非禁止英文」措辞依赖并集语义）。

## 需求溯源

- 来源文档：`openspec命名语言可配置方案-图片还原稿.md`「引导层：技能模板注入命名纪律」全节（img-4 + img-5 重叠）。
  - 「解决的问题」（AI 不知道要用中文，可能默认英文 kebab 被拦才改）→ Why。
  - 「改哪些文件（模板源）」naming-discipline.ts（新增）、propose.ts、apply-change.ts、new-change.ts → Impact 模板源清单。
  - 「怎么改」新增共享常量 NAMING_DISCIPLINE（change/capability 目录名纯中文、spec 正文中文、SHALL/MUST 关键字保留英文）、注入三个模板、英文示例改成中文示例 → What Changes 1/2/3。
  - 「关键机制」纪律是引导不是硬拦（AI 主动用中文、校验层兜底）；RFC 2119 关键字不动；apply 是 skill/command 共享核心改一处两表面同步携带、propose/new 的 command 模板保持上游原文（不对称、最小改动）→ What Changes 2 + spec delta「command 面不对称」requirement。
  - 「还原要点」新增 naming-discipline.ts 共享常量、注入模板、英文示例改中文 → tasks。
- 探索文档补全与裁定（`openspec/explorations/spec-naming-language-config.md` 3b 节 + 风险表 #8/#10 + 第 7 节结论 2）：
  - 注入集从还原稿 3 模板扩为 5 模板（+ ff-change/onboard skill 面），理由：覆盖完全优先、成本几乎不增、第二阶段受益。
  - skill 面 8 处措辞必须同步重写（同表面矛盾不可接受）；command 面 7 处保持原文（优雅降级，第二阶段可再评估中性化）。
  - 共享常量注入先例（STORE_SELECTION_GUIDANCE / PROJECT_ROOT_GUARD）与 parity 测试锚点、再生成三命令纪律。
- 还原稿疑点 3：「英文示例改中文示例」具体指哪些——按模板实际内容定为 skill 面 8 处（propose 2、new-change 3、ff 2、onboard 1）。
- 偏差说明：任务指引提示 ADDED 可挂 opsx-propose-skill / opsx-apply-skill 或新建 naming-discipline 能力；按 specs/ 实际能力清单裁定挂 `skill-generation`（new-change/ff/onboard 无既有能力规格，拆挂会漏模板或迫使新建 3 个能力规格；注入是生成管线属性），并追加 opsx-onboard-skill 小范围 MODIFIED（还原稿与任务指引均未列，探索文档第 10 节「可选 MODIFIED」采纳）。
