# =====================================================================
# 参考件——属公司骨架仓，随 allow-chinese 系列提案分发，落地到骨架仓后以骨架仓为准。
# 本文件是 openspec-andor 仓库变更 skeleton-chinese-gate-reference 的交付物（⑦ 纯中文门
# 参考实现）。本仓库（openspec-andor fork）无 skeleton/ 目录，无法运行验收本门；
# 骨架仓落地时将本实现并入 skeleton/scripts/skeleton-check.ps1（编号 ⑦，与 ①-⑥ 门同列）。
# 判定契约（三档语义、.legacy-dirs.json 字段、字符集来源）以本批变更 design.md 为准。
# =====================================================================
#
# ⑦ 纯中文门：扫描 openspec/changes 与 openspec/specs 的目录名，检查公司命名纪律（纯中文）。
#
# 三档语义：
#   FAIL —— 新违规：目录名非纯中文且不在 .legacy-dirs.json 豁免标记内（拦）
#   WARN —— 存量豁免：目录名非纯中文但在 .legacy-dirs.json 标记内（提示 owner 待治理）
#   PASS —— 扫描范围内目录名全部纯中文
# 退出码：0 = PASS（允许含 WARN）；1 = 存在任一 FAIL。
#
# 字符集单一来源声明：目录名汉字判定以 OpenSpec naming 配置映射表（CHARSET_MAP，
# zh-CN -> \p{Script=Han}，见 openspec-andor 仓库 src/core/naming-grammar.ts，
# configurable-naming-language 提案）为准；.NET 正则以 CJK 统一表意文字区段
# （\u3400-\u9FFF，URO + 扩展 A）近似。映射表扩容时本门判定需同步评估。
#
# 判定口径（与校验层的边界）：本门是公司纪律层，比校验层并集字符集更严——
# 编号前缀（100-修复登录）与中英混合（修复-session）在 OpenSpec 校验层合法可创建，
# 但本门照样报警治理；两门互补（创建不拦、铺设自检收敛）。
#
# 归档日期前缀：openspec archive 会给目录名拼 YYYY-MM-DD- 前缀（结构前缀，非用户命名），
# 检查前剥离；剥离后剩余部分必须为纯中文（允许连字符分段）。
#
# 用法：pwsh ./skeleton-check.ps1 [-ProjectRoot <path>] [-IncludeArchive]
#   -ProjectRoot    项目根目录（默认当前目录）
#   -IncludeArchive 额外扫描 openspec/changes/archive/ 历史（默认跳过；
#                   存量治理以活跃变更与 specs 为主，归档历史是否纳入由骨架仓落地时裁定）
# =====================================================================

[CmdletBinding()]
param(
    [string]$ProjectRoot = (Get-Location).Path,
    [switch]$IncludeArchive
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

# --- 编码统一（中文输出与 JSON 读写；PowerShell 5.1 默认编码差异防护） ---
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

# --- 纯中文判定（字符集单一来源见头注释） ---
# 有效名 = 剥离归档日期前缀后的剩余部分；必须为「汉字段（允许连字符分段）」。
$script:DatePrefixPattern   = '^\d{4}-\d{2}-\d{2}-'          # openspec archive 结构前缀
$script:PureChinesePattern  = '^[\u3400-\u9FFF]+(?:-[\u3400-\u9FFF]+)*$'

function Get-EffectiveName {
    param([string]$Name)
    return ($Name -replace $script:DatePrefixPattern, '')
}

function Test-PureChineseName {
    param([string]$Name)
    $effective = Get-EffectiveName -Name $Name
    if ([string]::IsNullOrEmpty($effective)) { return $false }   # 纯日期前缀名视为违规
    return ($effective -match $script:PureChinesePattern)
}

# --- 豁免标记读取（契约见 design.md；只读，本门绝不改写清单） ---
function Get-LegacyDirs {
    param([string]$OpenspecDir)
    $manifestPath = Join-Path $OpenspecDir '.legacy-dirs.json'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { return @{} }
    try {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 |
            ConvertFrom-Json
        $set = @{}
        foreach ($entry in @($manifest.dirs)) {
            if ($null -ne $entry -and $entry.path) { $set[[string]$entry.path] = $true }
        }
        return $set
    } catch {
        Write-Warning ("无法解析豁免标记 {0}：{1}（按无标记处理，全部按新违规判定）" -f $manifestPath, $_.Exception.Message)
        return @{}
    }
}

# --- 扫描目标收集 ---
# 每个目标同时给出项目相对路径（正斜杠），与 .legacy-dirs.json dirs[].path 的
# 契约口径（openspec/changes/... ）一致，豁免标记与机器无关、随仓可迁移。
function Get-TargetDirs {
    param([string]$OpenspecDir, [bool]$WithArchive)
    $targets = @()
    foreach ($sub in @('changes', 'specs')) {
        $dir = Join-Path $OpenspecDir $sub
        if (Test-Path -LiteralPath $dir -PathType Container) {
            foreach ($child in (Get-ChildItem -LiteralPath $dir -Directory)) {
                if ($sub -eq 'changes' -and $child.Name -eq 'archive' -and -not $WithArchive) { continue }
                $targets += [pscustomobject]@{
                    Dir     = $child
                    RelPath = "openspec/$sub/$($child.Name)"
                }
            }
        }
    }
    return $targets
}

# --- 主流程 ---
$openspecDir = Join-Path $ProjectRoot 'openspec'
if (-not (Test-Path -LiteralPath $openspecDir -PathType Container)) {
    Write-Output "[⑦ 纯中文门] PASS：未找到 openspec/ 目录（非 OpenSpec 项目，跳过）"
    exit 0
}

$legacyMap = Get-LegacyDirs -OpenspecDir $openspecDir
$targets   = Get-TargetDirs -OpenspecDir $openspecDir -WithArchive ([bool]$IncludeArchive)

$fails = @()
$warns = @()
$passes = 0

foreach ($t in $targets) {
    if (Test-PureChineseName -Name $t.Dir.Name) {
        $passes++
        continue
    }
    if ($legacyMap.ContainsKey($t.RelPath)) {
        $warns += $t
    } else {
        $fails += $t
    }
}

Write-Output ("[⑦ 纯中文门] 扫描 openspec/changes{0} 与 openspec/specs：共 {1} 个目录（纯中文 {2} / 存量豁免 {3} / 新违规 {4}）" -f `
    ($(if ($IncludeArchive) { '（含 archive）' } else { '' })), $targets.Count, $passes, $warns.Count, $fails.Count)

foreach ($t in $warns) {
    Write-Warning ("[⑦ WARN 存量待治理] {0}（在 openspec/.legacy-dirs.json 豁免标记内，owner 治理改中文名后标记自动收敛）" -f $t.RelPath)
}
foreach ($t in $fails) {
    Write-Output ("[⑦ FAIL 新违规] {0}（目录名非纯中文；新命名 MUST 遵循公司纯中文纪律，示例：修复会话过期）" -f $t.RelPath)
}

if ($fails.Count -gt 0) {
    Write-Output "[⑦ 纯中文门] FAIL：存在新违规目录，骨架铺设终止（存量目录请由 log1-init Merge 探测登记豁免后治理）"
    exit 1
}
Write-Output "[⑦ 纯中文门] PASS"
exit 0
