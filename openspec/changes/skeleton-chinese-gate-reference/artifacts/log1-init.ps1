# =====================================================================
# 参考件——属公司骨架仓，随 allow-chinese 系列提案分发，落地到骨架仓后以骨架仓为准。
# 本文件是 openspec-andor 仓库变更 skeleton-chinese-gate-reference 的交付物：
# log1-init.ps1「Merge 模式探测既有英文目录 → 写 openspec/.legacy-dirs.json」段的参考实现。
# 本仓库（openspec-andor fork）无 skeleton/ 目录与 log1-init.ps1，本文件以「可合并片段」
# 形态交付：骨架仓落地时把下述函数并入 skeleton/log1-init.ps1 的 Merge 分支，
# 插入点见文末「骨架仓并入说明」。判定契约以本批变更 design.md 为准。
# =====================================================================
#
# 职责（还原稿「检查层」关键机制 2）：
#   Merge 模式探测 openspec/changes、openspec/specs 下的既有英文 kebab-case 目录，
#   写 openspec/.legacy-dirs.json（dirs 清单 + 待治理 note），供 skeleton-check ⑦ 门
#   读取分档（标记内 WARN 存量豁免、标记外 FAIL 新违规）。
#   治理语义：清单以本次探测结果整体重写——owner 改中文名后目录自然退出清单；
#   探测为零且存在旧清单时删除清单文件，⑦ 门恢复严格（豁免可撤销，非永久白名单）。
#
# 字符集单一来源声明：非纯中文判定与 skeleton-check.ps1 ⑦ 门同源——以 OpenSpec naming
# 配置映射表（zh-CN -> \p{Script=Han}）为准，.NET 正则以 \u3400-\u9FFF 区段近似；
# 归档日期前缀 YYYY-MM-DD- 为结构前缀，探测同样先剥离再判定（与 ⑦ 门口径一致）。
# =====================================================================

# --- 与 skeleton-check.ps1 ⑦ 门同源的判定（两处正则 MUST 保持一致） ---
$script:DatePrefixPattern  = '^\d{4}-\d{2}-\d{2}-'
$script:PureChinesePattern = '^[\u3400-\u9FFF]+(?:-[\u3400-\u9FFF]+)*$'

function Test-DirectoryPureChinese {
    param([string]$Name)
    $effective = $Name -replace $script:DatePrefixPattern, ''
    if ([string]::IsNullOrEmpty($effective)) { return $false }
    return ($effective -match $script:PureChinesePattern)
}

<#
.SYNOPSIS
    Merge 模式下探测存量非纯中文目录并维护 openspec/.legacy-dirs.json。

.PARAMETER ProjectRoot
    项目根目录（log1-init 已定位的目标项目根）。

.OUTPUTS
    返回本次探测到的存量目录数（int）。清单写入/删除动作见函数内注释。

.NOTES
    幂等：每次 Merge 运行整体重写清单；探测为零时删除旧清单（门恢复严格）。
    清单内容 MUST NOT 手工编辑——豁免状态以探测结果为准，防清单沦为永久白名单。
#>
function Update-LegacyDirsManifest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$ProjectRoot
    )

    $openspecDir  = Join-Path $ProjectRoot 'openspec'
    $manifestPath = Join-Path $openspecDir '.legacy-dirs.json'
    if (-not (Test-Path -LiteralPath $openspecDir -PathType Container)) { return 0 }

    # --- 探测：changes（不含 archive，与 ⑦ 门默认口径一致）+ specs ---
    # dirs[].path 记录项目相对路径（正斜杠，契约示例口径：
    # openspec/changes/fix-session-timeout），与机器无关，随仓可迁移。
    $legacy = New-Object System.Collections.Generic.List[object]
    foreach ($sub in @('changes', 'specs')) {
        $dir = Join-Path $openspecDir $sub
        if (-not (Test-Path -LiteralPath $dir -PathType Container)) { continue }
        foreach ($child in (Get-ChildItem -LiteralPath $dir -Directory)) {
            if ($sub -eq 'changes' -and $child.Name -eq 'archive') { continue }
            if (-not (Test-DirectoryPureChinese -Name $child.Name)) {
                # [ordered] 保证 JSON 字段顺序稳定（path 在前，与契约示例一致）。
                $legacy.Add([ordered]@{
                    path = "openspec/$sub/$($child.Name)"
                    name = $child.Name
                })
            }
        }
    }

    if ($legacy.Count -eq 0) {
        # 治理完成（或首次 Merge 且无存量）：删除旧清单，⑦ 门恢复严格。
        if (Test-Path -LiteralPath $manifestPath -PathType Leaf) {
            Remove-Item -LiteralPath $manifestPath -Force
            Write-Log1Verbose '存量英文目录清单已清空，openspec/.legacy-dirs.json 已删除，纯中文门恢复严格。'
        }
        return 0
    }

    # --- 写入（整体重写，契约字段见 design.md） ---
    $manifest = [ordered]@{
        version     = 1
        generatedAt = (Get-Date -Format 'yyyy-MM-dd')
        note        = '以下目录为 Merge 探测发现的存量英文命名目录，owner 治理（改中文名）后从清单消失；清单为空或文件删除后 skeleton-check ⑦ 门恢复严格。'
        dirs        = $legacy
    }
    $json = $manifest | ConvertTo-Json -Depth 4
    [System.IO.File]::WriteAllText($manifestPath, $json, (New-Object System.Text.UTF8Encoding($false)))
    Write-Log1Verbose ("已登记 {0} 个存量英文目录到 openspec/.legacy-dirs.json（skeleton-check ⑦ 门将按 WARN 豁免提示治理）。" -f $legacy.Count)
    return $legacy.Count
}

# Write-Log1Verbose 为骨架仓 log1-init.ps1 既有的日志函数占位：
# 骨架仓并入时若函数名不同，按骨架仓实际日志函数替换（参考件在本仓库不可运行）。
function Write-Log1Verbose {
    param([string]$Message)
    Write-Verbose $Message
}

# =====================================================================
# 骨架仓并入说明（落地时阅读，落地验收后本参考件按 tasks.md 交接清单删除）
#
# 1. 插入点：skeleton/log1-init.ps1 的 Merge 分支中，在 OpenSpec 约定合并完成、
#    skeleton-check ①-⑥ 门运行之前调用：
#        $legacyCount = Update-LegacyDirsManifest -ProjectRoot $ProjectRoot
#    使 ⑦ 门运行时 .legacy-dirs.json 已就位。
# 2. 函数名 Write-Log1Verbose 按骨架仓实际日志函数替换。
# 3. 判定正则（DatePrefixPattern / PureChinesePattern）与 skeleton-check.ps1 ⑦ 门
#    保持逐字一致（单一来源声明见头注释）；OpenSpec naming 映射表扩容时两处同步。
# 4. 首跑验证三档（tasks.md 交接清单 2.3）：
#    构造新违规英文目录 → ⑦ FAIL；构造 .legacy-dirs.json 标记 → WARN；全中文 → PASS。
# =====================================================================
