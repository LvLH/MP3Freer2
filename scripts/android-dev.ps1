# MP3Freer Android dev launcher
# Uses a short PATH to avoid Windows CreateProcess env-size failures.

$env:JAVA_HOME = "E:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:NDK_HOME = "$env:ANDROID_HOME\ndk\30.0.15729638"
$env:RUSTUP_DIST_SERVER = "https://static.rust-lang.org"
$env:RUSTUP_UPDATE_ROOT = "https://static.rust-lang.org/rustup"

$shortPath = @(
  "$env:JAVA_HOME\bin",
  "$env:ANDROID_HOME\platform-tools",
  "$env:ANDROID_HOME\emulator",
  "$env:ANDROID_HOME\cmdline-tools\latest\bin",
  "$env:USERPROFILE\.cargo\bin",
  "C:\nvm4w\nodejs",
  "C:\ProgramData\nvm",
  "C:\Windows\system32",
  "C:\Windows",
  "C:\Windows\System32\Wbem",
  "C:\Windows\System32\WindowsPowerShell\v1.0",
  "C:\Program Files\Git\cmd"
) -join ";"
$env:Path = $shortPath

Set-Location "E:\5.SP\GeminiUse\MP3Freer2"
Write-Host "JAVA_HOME=$env:JAVA_HOME"
Write-Host "ANDROID_HOME=$env:ANDROID_HOME"
Write-Host "NDK_HOME=$env:NDK_HOME"
adb devices
npm run android:dev
