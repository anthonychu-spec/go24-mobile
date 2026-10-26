# Zips site\ into go24-prototype-web.zip with forward-slash folder paths.
# (PowerShell 5.1's Compress-Archive writes backslashes, which Cloudflare Pages reads as
# file names instead of folders, so images, fonts and icons go missing.)
# Usage: powershell -File scripts\pack.ps1
Set-Location (Join-Path $PSScriptRoot "..")
if (Test-Path go24-prototype-web.zip) { Remove-Item go24-prototype-web.zip -Confirm:$false }
& "$env:SystemRoot\System32\tar.exe" -a -c -f go24-prototype-web.zip -C site *
"{0:N1} MB" -f ((Get-Item go24-prototype-web.zip).Length / 1MB)
