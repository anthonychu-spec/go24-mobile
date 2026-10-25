# Zips site\ into the-lab-prototype-web.zip with forward-slash folder paths.
# (PowerShell 5.1's Compress-Archive writes backslashes, which Cloudflare Pages reads as
# file names instead of folders, so images, fonts and icons go missing.)
# Usage: powershell -File scripts\pack.ps1
Set-Location (Join-Path $PSScriptRoot "..")
if (Test-Path the-lab-prototype-web.zip) { Remove-Item the-lab-prototype-web.zip -Confirm:$false }
& "$env:SystemRoot\System32\tar.exe" -a -c -f the-lab-prototype-web.zip -C site *
"{0:N1} MB" -f ((Get-Item the-lab-prototype-web.zip).Length / 1MB)
