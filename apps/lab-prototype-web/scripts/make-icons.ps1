# Builds the PWA icons: the THE LAB mark centred on Ink (#131313).
# Usage: powershell -File scripts\make-icons.ps1 -Site site
param([string]$Site = "site")

Add-Type -AssemblyName System.Drawing
$mark = [System.Drawing.Image]::FromFile((Resolve-Path "$Site\assets\mark.png"))
$out = Join-Path $Site "icons"
New-Item -ItemType Directory -Force $out | Out-Null

# size, mark height as a share of the icon, file name
# Maskable icons keep the mark inside the central safe zone (Android crops to a circle).
$specs = @(
  @(192, 0.62, "icon-192.png"),
  @(512, 0.62, "icon-512.png"),
  @(512, 0.48, "icon-maskable-512.png"),
  @(180, 0.60, "apple-touch-icon.png"),
  @(32,  0.70, "favicon-32.png")
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
  $w = [int]($h * $mark.Width / $mark.Height)
  $g.DrawImage($mark, [int](($size - $w) / 2), [int](($size - $h) / 2), $w, $h)
  $bmp.Save((Join-Path $out $s[2]), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
$mark.Dispose()
Get-ChildItem $out | ForEach-Object { "{0} {1:N0} bytes" -f $_.Name, $_.Length }
