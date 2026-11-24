# Descarga herramientas PORTABLES de auditoría y carga para Windows en .herramientas\ (ignorada por git).
# Sin WSL ni Docker y sin instalar nada en el sistema. Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\auditoria\instalar-herramientas.ps1
# Herramientas: k6 (carga), gitleaks (secretos en git), JDK 21 + OWASP ZAP (escaneo web). Semgrep: pip install semgrep.
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$raiz = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) ".herramientas"
New-Item -ItemType Directory -Force $raiz | Out-Null
$ua = @{ "User-Agent" = "auditoria-local" }

function Get-UltimoAsset($repo, $patron) {
  $rel = Invoke-RestMethod -Headers $ua "https://api.github.com/repos/$repo/releases/latest"
  $a = $rel.assets | Where-Object { $_.name -match $patron } | Select-Object -First 1
  if (-not $a) { throw "No encontré un archivo '$patron' en $repo" }
  return $a
}

function Expand-Descarga($url, $nombre, $destino) {
  $zip = Join-Path $raiz $nombre
  Write-Host "  descargando $nombre"
  Invoke-WebRequest -Headers $ua -Uri $url -OutFile $zip
  if (Test-Path $destino) { Remove-Item -Recurse -Force $destino }
  Expand-Archive -Path $zip -DestinationPath $destino
  Remove-Item $zip
}

if (-not (Get-ChildItem -Recurse -Filter k6.exe (Join-Path $raiz "k6") -ErrorAction SilentlyContinue)) {
  Write-Host "k6"
  $a = Get-UltimoAsset "grafana/k6" "windows-amd64\.zip$"
  Expand-Descarga $a.browser_download_url $a.name (Join-Path $raiz "k6")
}
if (-not (Test-Path (Join-Path $raiz "gitleaks\gitleaks.exe"))) {
  Write-Host "gitleaks"
  $a = Get-UltimoAsset "gitleaks/gitleaks" "windows_x64\.zip$"
  Expand-Descarga $a.browser_download_url $a.name (Join-Path $raiz "gitleaks")
}
if (-not (Get-ChildItem -Recurse -Filter java.exe (Join-Path $raiz "jdk") -ErrorAction SilentlyContinue)) {
  Write-Host "JDK 21 (Temurin, portable)"
  Expand-Descarga "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse" "jdk21.zip" (Join-Path $raiz "jdk")
}
if (-not (Get-ChildItem -Recurse -Filter "zap-*.jar" (Join-Path $raiz "zap") -ErrorAction SilentlyContinue)) {
  Write-Host "OWASP ZAP (multiplataforma)"
  $a = Get-UltimoAsset "zaproxy/zaproxy" "_Crossplatform\.zip$"
  Expand-Descarga $a.browser_download_url $a.name (Join-Path $raiz "zap")
}

if (-not (Get-ChildItem -Recurse -Filter nginx.exe (Join-Path $raiz "nginx") -ErrorAction SilentlyContinue)) {
  Write-Host "nginx (Windows, para probar la configuración y la micro-caché de la landing en local)"
  $pagina = Invoke-WebRequest -UseBasicParsing -Headers $ua "https://nginx.org/en/download.html"
  $zip = ($pagina.Links | Where-Object { $_.href -match "/download/nginx-[\d.]+\.zip$" } | Select-Object -First 1).href
  Expand-Descarga ("https://nginx.org" + $zip) (Split-Path $zip -Leaf) (Join-Path $raiz "nginx")
}

Write-Host ""
Write-Host "Listo en $raiz"
Get-ChildItem -Recurse $raiz -Include k6.exe, gitleaks.exe, java.exe, "zap-*.jar" | ForEach-Object { "  " + $_.FullName }
