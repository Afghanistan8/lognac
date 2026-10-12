param(
  [string]$SegmentsPath = "docs/demo/segments.json",
  [string]$OutputDir = "docs/demo/.work/audio",
  [int]$Rate = 1
)

$ErrorActionPreference = "Stop"
$segments = Get-Content -LiteralPath $SegmentsPath -Raw | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$speaker = New-Object -ComObject SAPI.SpVoice
$maleVoice = New-Object -ComObject SAPI.SpObjectToken
$maleVoice.SetId('HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Speech_OneCore\Voices\Tokens\MSTTS_V110_enUS_MarkM')
$speaker.Voice = $maleVoice
$speaker.Rate = $Rate

foreach ($segment in $segments) {
  $path = Join-Path (Resolve-Path -LiteralPath $OutputDir).Path ($segment.id + ".wav")
  $stream = New-Object -ComObject SAPI.SpFileStream
  try {
    $stream.Open($path, 3, $false)
    $speaker.AudioOutputStream = $stream
    [void]$speaker.Speak($segment.narration)
  } finally {
    $stream.Close()
  }
  Write-Output "$($segment.id): $path"
}
