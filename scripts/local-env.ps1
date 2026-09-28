param(
    [ValidateSet('dev', 'test', 'build', 'preview', 'prepare', 'ui-test')]
    [string]$Command = 'dev',
    [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$localRoot = Join-Path $env:LOCALAPPDATA 'IPPO'
$hash = [Security.Cryptography.SHA256]::Create()
function Get-TextHash([string]$Text) {
    return [BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text))).Replace('-', '').ToLowerInvariant()
}
function Get-FileDigest([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    try { return [BitConverter]::ToString($hash.ComputeHash($stream)) } finally { $stream.Dispose() }
}
$projectId = (Get-TextHash $sourceRoot.ToLowerInvariant()).Substring(0, 12)
$runtimeRoot = Join-Path $localRoot "environments\ippo-$projectId"
$lock = $null
$exitCode = 1

try {
    # Prefer the existing conda tools; a normal Node.js/pnpm installation also works.
    $nodeHome = $env:IPPO_NODE_HOME
    if (-not $nodeHome) { $nodeHome = Join-Path $env:USERPROFILE 'miniconda3\envs\ippo' }
    if (Test-Path -LiteralPath (Join-Path $nodeHome 'node.exe')) {
        $env:PATH = "$nodeHome;$nodeHome\Library\bin;$env:PATH"
    }
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $pnpm = (Get-Command pnpm.cmd -ErrorAction Stop).Source
    $nodeVersion = & $node --version
    $pnpmVersion = & $pnpm --version
    if ($LASTEXITCODE -ne 0) { throw 'Could not run pnpm.' }
    if ([int]($nodeVersion.TrimStart('v').Split('.')[0]) -lt 24) {
        throw 'Install Node.js 24 or newer. The existing conda ippo environment can be used.'
    }

    Write-Host "Source:  $sourceRoot"
    Write-Host "Runtime: $runtimeRoot"
    Write-Host "Tools:   Node.js $nodeVersion / pnpm $pnpmVersion"
    if ($runtimeRoot.StartsWith($sourceRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'The runtime must be outside the source folder.'
    }
    $ownerFile = Join-Path $runtimeRoot '.ippo-source.txt'
    if (Test-Path -LiteralPath $runtimeRoot) {
        if (-not (Test-Path -LiteralPath $ownerFile) -or
            (Get-Content -LiteralPath $ownerFile -Encoding UTF8 -Raw).Trim() -ne $sourceRoot) {
            throw 'This runtime folder belongs to another project. Nothing was overwritten.'
        }
    } else {
        New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
        [IO.File]::WriteAllText($ownerFile, $sourceRoot)
    }
    # Keep the exclusive lock outside Vite's watched folder.
    $lockDir = Join-Path $localRoot 'locks'
    New-Item -ItemType Directory -Path $lockDir -Force | Out-Null
    $lock = [IO.File]::Open((Join-Path $lockDir "$projectId.lock"), 'OpenOrCreate', 'ReadWrite', 'None')

    # Junctions exist ONLY on C. The shared source folder never contains runtime links.
    foreach ($name in @('src', 'tests', 'supabase', 'public')) {
        $source = Join-Path $sourceRoot $name
        $destination = Join-Path $runtimeRoot $name
        $existing = Get-Item -LiteralPath $destination -Force -ErrorAction SilentlyContinue
        if ($existing) {
            if ($existing.LinkType -ne 'Junction' -or $existing.Target -ne $source) {
                throw "Unexpected runtime entry: $destination"
            }
        } elseif (Test-Path -LiteralPath $source -PathType Container) {
            New-Item -ItemType Junction -Path $destination -Target $source | Out-Null
        }
    }

    # Small root configuration files are refreshed at launch; src edits are live.
    $rootFiles = @('package.json', 'pnpm-lock.yaml', 'vite.config.ts', 'tsconfig.json', 'index.html')
    $rootFiles += @(Get-ChildItem -LiteralPath $sourceRoot -File -Force | Where-Object { $_.Name -eq '.env' -or $_.Name.StartsWith('.env.') } | ForEach-Object Name)
    foreach ($name in $rootFiles) {
        $source = Join-Path $sourceRoot $name
        $destination = Join-Path $runtimeRoot $name
        if (-not (Test-Path -LiteralPath $destination) -or
            (Get-FileDigest $source) -ne (Get-FileDigest $destination)) {
            Copy-Item -LiteralPath $source -Destination $destination -Force
        }
    }
    # Remove only obsolete copied .env files, never anything through a junction.
    Get-ChildItem -LiteralPath $runtimeRoot -File -Force |
        Where-Object { ($_.Name -eq '.env' -or $_.Name.StartsWith('.env.')) -and $_.Name -notin $rootFiles } |
        ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }

    $storeDir = (Join-Path $localRoot 'pnpm-store').Replace('\', '/')
    $cacheDir = (Join-Path $localRoot 'pnpm-cache').Replace('\', '/')
    $stateDir = (Join-Path $localRoot 'pnpm-state').Replace('\', '/')
    # pnpm 11 reads these settings from workspace YAML, not .npmrc.
    $workspace = Get-Content -LiteralPath (Join-Path $sourceRoot 'pnpm-workspace.yaml') -Encoding UTF8 -Raw
    $workspace += "`nnodeLinker: hoisted`nstoreDir: '$($storeDir.Replace("'", "''"))'`ncacheDir: '$($cacheDir.Replace("'", "''"))'`nstateDir: '$($stateDir.Replace("'", "''"))'`n"
    [IO.File]::WriteAllText((Join-Path $runtimeRoot 'pnpm-workspace.yaml'), $workspace)
    $env:npm_config_cache = Join-Path $localRoot 'npm-cache'

    $fingerprint = "$nodeVersion`n$pnpmVersion`n"
    foreach ($name in @('package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml')) {
        $fingerprint += Get-FileDigest (Join-Path $runtimeRoot $name)
    }
    $installHash = Get-TextHash $fingerprint
    $stampFile = Join-Path $runtimeRoot '.ippo-installed.txt'
    $installed = Test-Path -LiteralPath $stampFile
    if ($installed) { $installed = (Get-Content -LiteralPath $stampFile -Encoding UTF8 -Raw) -eq $installHash }
    $installed = $installed -and (Test-Path -LiteralPath (Join-Path $runtimeRoot 'node_modules\vite\bin\vite.js'))

    Push-Location -LiteralPath $runtimeRoot
    try {
        if (-not $installed) {
            if (Test-Path -LiteralPath $stampFile) { Remove-Item -LiteralPath $stampFile }
            Write-Host 'Preparing dependencies on C (the first run needs internet)...'
            & $pnpm install --frozen-lockfile
            if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Run the launcher again to retry.' }
            [IO.File]::WriteAllText($stampFile, $installHash)
        }
        # Keep imports under the C-side junction paths so Node resolves C/node_modules.
        $env:NODE_OPTIONS = "$env:NODE_OPTIONS --preserve-symlinks --preserve-symlinks-main".Trim()
        $env:IPPO_LOCAL_ENV = '1'
        if ($Command -eq 'prepare') {
            Write-Host 'Environment is ready.'
            $exitCode = 0
        } elseif ($Command -eq 'dev') {
            Write-Host 'Keep this window open. Press Ctrl+C or close it to stop.'
            if ($NoOpen) { & $pnpm dev --host localhost } else { & $pnpm dev --host localhost --open }
            $exitCode = $LASTEXITCODE
        } elseif ($Command -eq 'ui-test') {
            & $pnpm exec tsx tests/browser-server.ts
            $exitCode = $LASTEXITCODE
        } else {
            & $pnpm $Command
            $exitCode = $LASTEXITCODE
        }
    } finally {
        Pop-Location
    }
} catch {
    Write-Host "IPPO could not start: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    if ($lock) { $lock.Dispose() }
    $hash.Dispose()
}
exit $exitCode
