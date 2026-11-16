# Setzt SITE_PASSWORD und AUTH_SECRET für das Vercel-Projekt (Production).
# Aufruf im Projektordner:  powershell -ExecutionPolicy Bypass -File .\scripts\set-secrets.ps1

$ErrorActionPreference = 'Stop'
$npx = 'C:\Program Files\nodejs\npx.cmd'

# 1) AUTH_SECRET: zufälliger 64-stelliger Hex-Wert, wird nirgends angezeigt
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$secret = -join ($bytes | ForEach-Object { $_.ToString('x2') })
& $npx -y vercel@latest env add AUTH_SECRET --environment production --sensitive --force --yes --value $secret
Remove-Variable secret

# 2) SITE_PASSWORD: Vercel fragt gleich nach dem Wert, dort euer Passwort eintippen
Write-Host ''
Write-Host 'Gleich wird nach dem Wert fuer SITE_PASSWORD gefragt: euer gemeinsames Passwort eingeben.' -ForegroundColor Cyan
& $npx -y vercel@latest env add SITE_PASSWORD --environment production --sensitive --force

Write-Host ''
Write-Host 'Fertig. Sag Claude Bescheid, dann wird deployed.' -ForegroundColor Green
