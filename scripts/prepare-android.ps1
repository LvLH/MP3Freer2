# MP3Freer — Windows 上车机 Android（Tauri）环境检查与准备
# 用法（在项目根目录）:
#   powershell -ExecutionPolicy Bypass -File .\scripts\prepare-android.ps1

$ErrorActionPreference = "Continue"
Write-Host "== MP3Freer Android 环境检查 ==" -ForegroundColor Cyan

$ok = $true

function Check-Cmd($name) {
  $c = Get-Command $name -ErrorAction SilentlyContinue
  if ($c) {
    Write-Host "[OK] $name -> $($c.Source)" -ForegroundColor Green
    return $true
  }
  Write-Host "[MISS] $name" -ForegroundColor Red
  return $false
}

# JDK：优先 Android Studio 自带 JBR，或 JDK 17+
$javaHomeCandidates = @(
  $env:JAVA_HOME,
  "$env:ProgramFiles\Android\Android Studio\jbr",
  "E:\Program Files\Android\Android Studio\jbr",
  "D:\Program Files\Android\Android Studio\jbr",
  "$env:LOCALAPPDATA\Programs\Android\Android Studio\jbr",
  "C:\Program Files\Eclipse Adoptium\jdk-17*",
  "C:\Program Files\Microsoft\jdk-17*"
) | Where-Object { $_ }

$resolvedJava = $null
foreach ($p in $javaHomeCandidates) {
  $expanded = Resolve-Path $p -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($expanded -and (Test-Path (Join-Path $expanded "bin\java.exe"))) {
    $resolvedJava = $expanded.Path
    break
  }
}

if ($resolvedJava) {
  Write-Host "[OK] JAVA_HOME candidate: $resolvedJava" -ForegroundColor Green
  if (-not $env:JAVA_HOME) {
    Write-Host "     建议: setx JAVA_HOME `"$resolvedJava`"" -ForegroundColor Yellow
  }
} else {
  Write-Host "[MISS] JDK 17+ / Android Studio JBR" -ForegroundColor Red
  Write-Host "     请安装 Android Studio，或单独安装 Temurin JDK 17" -ForegroundColor Yellow
  $ok = $false
}

$sdkCandidates = @(
  $env:ANDROID_HOME,
  $env:ANDROID_SDK_ROOT,
  "$env:LOCALAPPDATA\Android\Sdk",
  "$env:USERPROFILE\AppData\Local\Android\Sdk"
) | Where-Object { $_ }

$resolvedSdk = $null
foreach ($p in $sdkCandidates) {
  if ($p -and (Test-Path $p)) {
    $resolvedSdk = $p
    break
  }
}

if ($resolvedSdk) {
  Write-Host "[OK] ANDROID_HOME: $resolvedSdk" -ForegroundColor Green
  if (-not $env:ANDROID_HOME) {
    Write-Host "     建议: setx ANDROID_HOME `"$resolvedSdk`"" -ForegroundColor Yellow
  }
  $ndkRoot = Join-Path $resolvedSdk "ndk"
  if (Test-Path $ndkRoot) {
    $ndkVer = Get-ChildItem $ndkRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1
    if ($ndkVer) {
      Write-Host "[OK] NDK: $($ndkVer.FullName)" -ForegroundColor Green
      if (-not $env:NDK_HOME) {
        Write-Host "     建议: setx NDK_HOME `"$($ndkVer.FullName)`"" -ForegroundColor Yellow
      }
    }
  } else {
    Write-Host "[MISS] NDK (Side by side) — 在 Android Studio SDK Manager 安装" -ForegroundColor Red
    $ok = $false
  }
} else {
  Write-Host "[MISS] Android SDK" -ForegroundColor Red
  Write-Host "     请安装 Android Studio，并在 SDK Manager 勾选:" -ForegroundColor Yellow
  Write-Host "     - Android SDK Platform (API 34 推荐)" -ForegroundColor Yellow
  Write-Host "     - Android SDK Platform-Tools" -ForegroundColor Yellow
  Write-Host "     - Android SDK Build-Tools" -ForegroundColor Yellow
  Write-Host "     - NDK (Side by side)" -ForegroundColor Yellow
  Write-Host "     - Android SDK Command-line Tools" -ForegroundColor Yellow
  $ok = $false
}

if (-not (Check-Cmd "rustup")) { $ok = $false }
if (-not (Check-Cmd "cargo")) { $ok = $false }
Check-Cmd "adb" | Out-Null
Check-Cmd "emulator" | Out-Null

Write-Host ""
Write-Host "== Install Rust Android targets ==" -ForegroundColor Cyan
# Official dist server avoids broken mirror manifests (e.g. tuna 404)
$env:RUSTUP_DIST_SERVER = "https://static.rust-lang.org"
$env:RUSTUP_UPDATE_ROOT = "https://static.rust-lang.org/rustup"
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
if ($LASTEXITCODE -ne 0) {
  Write-Host "[FAIL] rustup target add" -ForegroundColor Red
  $ok = $false
} else {
  Write-Host "[OK] rust android targets" -ForegroundColor Green
}

Write-Host ""
Write-Host "== Windows Developer Mode (symlink) ==" -ForegroundColor Cyan
Write-Host "Tauri Android needs symlink into jniLibs. Enable:" -ForegroundColor Yellow
Write-Host "  Settings -> System -> For developers -> Developer Mode = ON" -ForegroundColor White
Write-Host "  ms-settings:developers" -ForegroundColor White

Write-Host ""
if ($ok -and $resolvedSdk -and $resolvedJava) {
  Write-Host "环境看起来就绪。下一步（新开终端以便 setx 生效）:" -ForegroundColor Green
  Write-Host "  npm run android:init" -ForegroundColor White
  Write-Host "  # Android Studio Device Manager 建横屏 Tablet AVD (1280x720)" -ForegroundColor White
  Write-Host "  npm run android:dev" -ForegroundColor White
} else {
  Write-Host "Please install missing components above, then re-run this script." -ForegroundColor Yellow
  Write-Host "Android Studio SDK Manager needed: NDK, cmdline-tools, system-image." -ForegroundColor Yellow
  exit 1
}
