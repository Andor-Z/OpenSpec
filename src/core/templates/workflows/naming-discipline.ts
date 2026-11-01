/**
 * Shared naming-discipline guidance for skill template workflows.
 *
 * Interpolated into the skill face of the propose / new-change / ff-change /
 * onboard workflows and into apply-change's shared body (one insertion, so
 * the apply skill and command surfaces carry it alike; onboard's surfaces
 * share one body the same way). The command faces of propose / new-change /
 * ff-change stay upstream-verbatim by design (naming-discipline-injection):
 * an English kebab name derived there still passes validation, so the
 * asymmetry degrades gracefully instead of blocking.
 */
export const NAMING_DISCIPLINE = `**Naming discipline — change 与 capability 目录名**：目录名要自解释——spec 积累到几百个时，中文目录名一眼即知管什么（如 \`修复会话过期\`），英文 kebab 名（如 \`fix-session-timeout\`）需要翻译。

- change 目录名 SHALL 使用纯中文命名（如 \`修复会话过期\`）：从用户描述主动派生中文名，不要默认派生英文 kebab 名、等校验层拦截后再改。
- capability（spec）目录名同样优先用中文命名；当前 capability 名无校验，以引导为主。
- 英文 kebab 名依然合法——纪律是「优先中文」而不是「禁止英文」，校验层放行合法名，中文命名是主动引导。
- 非法示例：\`Fix_Session\`（大写字母与下划线不被允许）。
- 产物正文（proposal、design、spec、tasks）用中文书写；\`SHALL\`/\`MUST\` 等 RFC 2119 规范关键词 MUST 保留英文，不翻译。`;
