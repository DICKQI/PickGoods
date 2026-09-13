[CmdletBinding()]
param(
    [string]$JavaHome = "",
    [string]$AndroidSdkRoot = "",
    [switch]$SkipInstall,
    [switch]$SkipWebBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Import-Module Microsoft.PowerShell.Utility -ErrorAction Stop
Import-Module Microsoft.PowerShell.Archive -ErrorAction Stop

$FrontendRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$AndroidRoot = Join-Path $FrontendRoot "android"
$ArtifactsRoot = Join-Path $FrontendRoot "artifacts"
$ToolsRoot = Join-Path $FrontendRoot ".cache\android-build-tools"
$JdkVersion = "21.0.12.1+1"
$JdkArchiveName = "OpenJDK21U-jdk_x64_windows_hotspot_21.0.12.1_1.zip"
$JdkUrl = "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/$JdkArchiveName"
$JdkSha256 = "f9d6e191ab098c0d416e7d588a24420a8621cd2f4720dab2459b8b7b2d2d8b4e"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Checked([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $LASTEXITCODE`: $Command $($Arguments -join ' ')"
    }
}

function Get-Sha256([string]$Path) {
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try {
            return ([System.BitConverter]::ToString($sha.ComputeHash($stream))).Replace("-", "")
        }
        finally {
            $sha.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
}

function Get-JavaMajor([string]$JavaExe) {
    if (-not $JavaExe -or -not (Test-Path -LiteralPath $JavaExe)) {
        return 0
    }
    $output = (& $JavaExe --version | Out-String)
    $match = [regex]::Match($output, '(?:version\s+"|openjdk\s+)(?<major>\d+)')
    if (-not $match.Success) {
        return 0
    }
    return [int]$match.Groups["major"].Value
}

function Find-JavaHome {
    $candidates = @()
    if ($JavaHome) {
        $candidates += $JavaHome
    }
    if ($env:JAVA_HOME) {
        $candidates += $env:JAVA_HOME
    }
    if ($env:ANDROID_STUDIO_JDK) {
        $candidates += $env:ANDROID_STUDIO_JDK
    }

    $javaCommand = Get-Command java.exe -ErrorAction SilentlyContinue
    if ($javaCommand) {
        $candidates += (Split-Path (Split-Path $javaCommand.Source -Parent) -Parent)
    }

    $candidates += @(
        (Join-Path $ToolsRoot "jdk-$JdkVersion"),
        "C:\Program Files\Android\Android Studio\jbr",
        "$env:LOCALAPPDATA\Programs\Android Studio\jbr",
        "C:\Program Files\Java\jdk-21",
        "C:\Program Files\Eclipse Adoptium\jdk-21*"
    )

    foreach ($candidate in $candidates) {
        if (-not $candidate) {
            continue
        }
        $expanded = Get-ChildItem -Path $candidate -Directory -ErrorAction SilentlyContinue |
            Select-Object -First 1 -ExpandProperty FullName
        foreach ($javaRoot in @($candidate, $expanded)) {
            if (-not $javaRoot) {
                continue
            }
            $javaExe = Join-Path $javaRoot "bin\java.exe"
            if ((Get-JavaMajor $javaExe) -ge 21) {
                return (Resolve-Path $javaRoot).Path
            }
        }
    }
    return ""
}

function Install-PortableJdk {
    $target = Join-Path $ToolsRoot "jdk-$JdkVersion"
    $javaExe = Join-Path $target "bin\java.exe"
    if ((Get-JavaMajor $javaExe) -ge 21) {
        return $target
    }

    Write-Step "Downloading portable Temurin JDK 21"
    New-Item -ItemType Directory -Force -Path $ToolsRoot | Out-Null
    $archive = Join-Path $ToolsRoot $JdkArchiveName
    if (-not (Test-Path -LiteralPath $archive)) {
        Invoke-WebRequest -Uri $JdkUrl -OutFile $archive -TimeoutSec 600
    }
    $hash = (Get-Sha256 $archive).ToLowerInvariant()
    if ($hash -ne $JdkSha256) {
        throw "JDK archive checksum mismatch: $hash"
    }

    if (-not (Test-Path -LiteralPath $javaExe)) {
        Expand-Archive -LiteralPath $archive -DestinationPath $ToolsRoot -Force
    }
    if ((Get-JavaMajor $javaExe) -lt 21) {
        throw "Portable JDK 21 installation failed"
    }
    return $target
}

function Ensure-AndroidSdk {
    $localProperties = Join-Path $AndroidRoot "local.properties"
    if (Test-Path -LiteralPath $localProperties) {
        return
    }

    $sdk = $AndroidSdkRoot
    if (-not $sdk) {
        $sdk = $env:ANDROID_SDK_ROOT
    }
    if (-not $sdk) {
        $sdk = $env:ANDROID_HOME
    }
    if (-not $sdk) {
        $sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
    }
    if (-not (Test-Path -LiteralPath $sdk)) {
        throw "Android SDK not found. Pass -AndroidSdkRoot or install Android SDK."
    }
    $escaped = $sdk.Replace("\", "\\").Replace(":", "\:")
    "sdk.dir=$escaped" | Set-Content -LiteralPath $localProperties -Encoding ASCII
}

function Ensure-MainActivityNativeSettings {
    $mainActivity = Join-Path $AndroidRoot "app\src\main\java\com\pickgoods\app\MainActivity.java"
    if (-not (Test-Path -LiteralPath $mainActivity)) {
        throw "MainActivity.java was not generated: $mainActivity"
    }

    $content = Get-Content -LiteralPath $mainActivity -Raw
    if ($content -notmatch "import\s+android\.view\.View;") {
        $content = $content -replace "(import\s+android\.os\.Bundle;)", "`$1`r`nimport android.view.View;"
    }
    $nativeSettings = @(
        "        getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);",
        "        getBridge().getWebView().setVerticalScrollBarEnabled(false);",
        "        getBridge().getWebView().setHorizontalScrollBarEnabled(false);"
    )
    $missing = @($nativeSettings | Where-Object { $content -notmatch [regex]::Escape($_) })
    if ($missing.Count -gt 0) {
        $insert = ($missing -join "`r`n")
        $content = $content -replace "(?m)^(\s*super\.onCreate\(savedInstanceState\);\s*)$", "`$1`r`n$insert"
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($mainActivity, $content, $utf8NoBom)
}

Push-Location $FrontendRoot
try {
    $package = Get-Content -LiteralPath (Join-Path $FrontendRoot "package.json") -Raw | ConvertFrom-Json
    $version = [string]$package.version

    if (-not $SkipInstall) {
        Write-Step "Installing frontend dependencies"
        Invoke-Checked "pnpm" @("install", "--frozen-lockfile")
    }

    if (-not $SkipWebBuild) {
        Write-Step "Building web assets"
        Invoke-Checked "pnpm" @("build")
    }

    if (-not (Test-Path -LiteralPath $AndroidRoot)) {
        Write-Step "Creating Capacitor Android project"
        Invoke-Checked "pnpm" @("exec", "cap", "add", "android")
    }

    Write-Step "Syncing Capacitor Android project"
    Invoke-Checked "pnpm" @("exec", "cap", "sync", "android")
    Ensure-AndroidSdk
    Ensure-MainActivityNativeSettings

    $jdkHome = Find-JavaHome
    if (-not $jdkHome) {
        $jdkHome = Install-PortableJdk
    }
    $env:JAVA_HOME = $jdkHome
    $env:Path = "$(Join-Path $jdkHome 'bin');$env:Path"
    Write-Step "Using JAVA_HOME=$jdkHome"

    Write-Step "Assembling debug APK"
    Push-Location $AndroidRoot
    try {
        Invoke-Checked ".\gradlew.bat" @("assembleDebug", "--no-daemon", "--console=plain")
    }
    finally {
        Pop-Location
    }

    $sourceApk = Join-Path $AndroidRoot "app\build\outputs\apk\debug\app-debug.apk"
    if (-not (Test-Path -LiteralPath $sourceApk)) {
        throw "Gradle completed but APK was not found: $sourceApk"
    }
    New-Item -ItemType Directory -Force -Path $ArtifactsRoot | Out-Null
    $outputApk = Join-Path $ArtifactsRoot "PickGoods-v$version-debug.apk"
    Copy-Item -LiteralPath $sourceApk -Destination $outputApk -Force

    $apk = Get-Item -LiteralPath $outputApk
    $sha256 = Get-Sha256 $outputApk
    Write-Host ""
    Write-Host "APK build complete" -ForegroundColor Green
    Write-Host "Path:   $($apk.FullName)"
    Write-Host "Size:   $($apk.Length) bytes"
    Write-Host "SHA256: $sha256"
}
finally {
    Pop-Location
}
