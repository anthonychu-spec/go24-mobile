# Builds the PWA icons: the red GO24 mark centred on charcoal (#131313).
# The mark is cut from the left of assets\logo.png (the white wordmark beside it is left out).
# Usage: powershell -File scripts\make-icons.ps1 -Site site
param([string]$Site = "site")

Add-Type -AssemblyName System.Drawing
$logo = New-Object System.Drawing.Bitmap (Resolve-Path "$Site\assets\logo.png").Path

# Bounding box of the red pixels (the wordmark is white, so it is skipped).
$x0 = $logo.Width; $y0 = $logo.Height; $x1 = -1; $y1 = -1
for ($y = 0; $y -lt $logo.Height; $y++) {
  for ($x = 0; $x -lt $logo.Width; $x++) {
    $p = $logo.GetPixel($x, $y)
    if ($p.A -gt 40 -and $p.R -gt 150 -and $p.G -lt 100 -and $p.B -lt 120) {
      if ($x -lt $x0) { $x0 = $x }; if ($x -gt $x1) { $x1 = $x }
      if ($y -lt $y0) { $y0 = $y }; if ($y -gt $y1) { $y1 = $y }
    }
  }
}
if ($x1 -lt 0) { throw "No red mark found in logo.png" }
$src = New-Object System.Drawing.Rectangle $x0, $y0, ($x1 - $x0 + 1), ($y1 - $y0 + 1)
"mark at {0},{1} {2}x{3}" -f $src.X, $src.Y, $src.Width, $src.Height

$out = Join-Path $Site "icons"
New-Item -ItemType Directory -Force $out | Out-Null

# size, mark height as a share of the icon, file name
# Maskable icons keep the mark inside the central safe zone (Android crops to a circle).
$specs = @(
  @(192, 0.58, "icon-192.png"),
  @(512, 0.58, "icon-512.png"),
  @(512, 0.44, "icon-maskable-512.png"),
  @(180, 0.56, "apple-touch-icon.png"),
  @(32,  0.72, "favicon-32.png")
)

foreach ($s in $specs) {
  $size = [int]$s[0]; $share = [double]$s[1]
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml("#131313"))
  $h = [int]($size * $share)
  $w = [int]($h * $src.Width / $src.Height)
  # The mark is a downward triangle, so its visual centre sits above the box centre; nudge it down.
  $dst = New-Object System.Drawing.Rectangle ([int](($size - $w) / 2)), ([int](($size - $h) / 2 + $h * 0.06)), $w, $h
  $g.DrawImage($logo, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
  $bmp.Save((Join-Path $out $s[2]), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
$logo.Dispose()
Get-ChildItem $out | ForEach-Object { "{0} {1:N0} bytes" -f $_.Name, $_.Length }
