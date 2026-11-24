# Mide CPU y RAM del servidor Next (proceso que escucha en -Puerto y sus hijos) y de PostgreSQL cada 2 s.
# Uso: powershell -File tests\carga\monitor.ps1 -Puerto 3500 -Salida .data\carga\monitor-landing.csv
# Se detiene solo cuando existe el archivo "<Salida>.fin" (lo crea tests/carga/correr.mjs al terminar k6).
param([int]$Puerto = 3500, [string]$Salida = ".data\carga\monitor.csv", [int]$Intervalo = 2)
$nucleos = [Environment]::ProcessorCount

function Get-Arbol([int]$raiz) {
  $todos = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId
  $ids = @($raiz); $cola = @($raiz)
  while ($cola.Count) {
    $p = $cola[0]; $cola = $cola[1..($cola.Count)]
    $hijos = $todos | Where-Object { $_.ParentProcessId -eq $p } | ForEach-Object { $_.ProcessId }
    foreach ($h in $hijos) { $ids += $h; $cola += $h }
  }
  return $ids
}

$escucha = (Get-NetTCPConnection -LocalPort $Puerto -State Listen -ErrorAction Stop | Select-Object -First 1).OwningProcess
# Sube hasta el primer ancestro que ya no es node (en cluster el socket puede ser de un hijo) y suma todo el árbol.
$raiz = $escucha
while ($true) {
  $padre = (Get-CimInstance Win32_Process -Filter "ProcessId=$raiz").ParentProcessId
  $p = Get-CimInstance Win32_Process -Filter "ProcessId=$padre" -ErrorAction SilentlyContinue
  if (-not $p -or $p.Name -ne "node.exe") { break }
  $raiz = $padre
}
$pids = Get-Arbol $raiz
"fecha,cpu_app_pct,nucleos_app,ram_app_mb,cpu_pg_pct,ram_pg_mb" | Out-File -Encoding utf8 $Salida
$antes = @{}
$t0 = Get-Date
while (-not (Test-Path "$Salida.fin")) {
  $app = Get-Process -Id $pids -ErrorAction SilentlyContinue
  $pg = Get-Process -Name postgres -ErrorAction SilentlyContinue
  $ahora = Get-Date
  $dt = ($ahora - $t0).TotalSeconds; $t0 = $ahora
  $cpuApp = ($app | ForEach-Object { $_.TotalProcessorTime.TotalSeconds } | Measure-Object -Sum).Sum
  # Postgres corre como servicio con otro usuario: su tiempo de CPU se lee de los contadores de WMI (no de Get-Process).
  $pgPerf = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -Filter "Name LIKE 'postgres%'" -ErrorAction SilentlyContinue
  $cpuPg = ($pg | ForEach-Object { $_.TotalProcessorTime.TotalSeconds } | Measure-Object -Sum).Sum
  $pctPg = ($pgPerf | Measure-Object PercentProcessorTime -Sum).Sum / $nucleos
  $ramPg = ($pgPerf | Measure-Object WorkingSetPrivate -Sum).Sum / 1MB
  if ($antes.Count) {
    $dApp = $cpuApp - $antes.app; $dPg = $cpuPg - $antes.pg
    $inv = [Globalization.CultureInfo]::InvariantCulture
    $fila = [string]::Format($inv, "{0},{1:0.0},{2:0.00},{3:0},{4:0.0},{5:0}", $ahora.ToString("HH:mm:ss"), (100 * $dApp / $dt / $nucleos), ($dApp / $dt), (($app | Measure-Object WorkingSet64 -Sum).Sum / 1MB), $pctPg, $ramPg)
    $fila | Out-File -Append -Encoding utf8 $Salida
  }
  $antes = @{ app = $cpuApp; pg = $cpuPg }
  Start-Sleep -Seconds $Intervalo
}
Remove-Item "$Salida.fin" -ErrorAction SilentlyContinue
