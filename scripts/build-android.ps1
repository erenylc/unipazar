$ErrorActionPreference = 'Stop'

$projectDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\android'))
$sdkDir = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }
$jdkDir = $env:JAVA_HOME
$keyFile = Join-Path $projectDir 'android.keystore'
$passwordFile = Join-Path $projectDir 'signing-password.txt'

if (-not $jdkDir -or -not (Test-Path (Join-Path $jdkDir 'bin\jarsigner.exe'))) {
  throw 'JAVA_HOME bir JDK 17 kurulumunu göstermeli.'
}
if (-not $sdkDir -or -not (Test-Path (Join-Path $sdkDir 'platforms\android-36\android.jar'))) {
  throw 'ANDROID_HOME Android API 36 kurulu SDK dizinini göstermeli.'
}
if (-not (Test-Path $keyFile) -or -not (Test-Path $passwordFile)) {
  throw 'Android imzalama anahtarı veya parola dosyası bulunamadı.'
}

$zipalign = Join-Path $sdkDir 'build-tools\36.0.0\zipalign.exe'
$apksigner = Join-Path $sdkDir 'build-tools\36.0.0\apksigner.bat'
if (-not (Test-Path $zipalign) -or -not (Test-Path $apksigner)) {
  throw 'Android Build-Tools 36.0.0 kurulu olmalı.'
}

$env:ANDROID_HOME = $sdkDir
$env:ANDROID_SDK_ROOT = $sdkDir
$env:UNISATIS_KEY_PASSWORD = (Get-Content -LiteralPath $passwordFile -Raw).Trim()
try {
  Push-Location $projectDir
  try {
    & (Join-Path $projectDir 'gradlew.bat') :app:bundleRelease :app:assembleRelease
    if ($LASTEXITCODE -ne 0) { throw 'Android derlemesi başarısız.' }

    & (Join-Path $jdkDir 'bin\jarsigner.exe') -keystore $keyFile -storetype PKCS12 `
      -storepass:env UNISATIS_KEY_PASSWORD -keypass:env UNISATIS_KEY_PASSWORD `
      -sigalg SHA256withRSA -digestalg SHA-256 `
      -signedjar (Join-Path $projectDir 'app-release-bundle.aab') `
      (Join-Path $projectDir 'app\build\outputs\bundle\release\app-release.aab') unisatis
    if ($LASTEXITCODE -ne 0) { throw 'AAB imzalanamadı.' }

    & $zipalign -f -p 4 `
      (Join-Path $projectDir 'app\build\outputs\apk\release\app-release-unsigned.apk') `
      (Join-Path $projectDir 'app-release-aligned.apk')
    if ($LASTEXITCODE -ne 0) { throw 'APK hizalanamadı.' }

    & $apksigner sign --ks $keyFile --ks-key-alias unisatis `
      --ks-pass env:UNISATIS_KEY_PASSWORD --key-pass env:UNISATIS_KEY_PASSWORD `
      --out (Join-Path $projectDir 'app-release-signed.apk') `
      (Join-Path $projectDir 'app-release-aligned.apk')
    if ($LASTEXITCODE -ne 0) { throw 'APK imzalanamadı.' }

    Write-Host "AAB: $(Join-Path $projectDir 'app-release-bundle.aab')"
    Write-Host "APK: $(Join-Path $projectDir 'app-release-signed.apk')"
  } finally {
    Pop-Location
  }
} finally {
  Remove-Item Env:UNISATIS_KEY_PASSWORD -ErrorAction SilentlyContinue
}
