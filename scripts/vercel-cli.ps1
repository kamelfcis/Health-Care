# Deploy backend + frontend to Vercel production (after: npx vercel login)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "==> npx vercel whoami" -ForegroundColor Cyan
npx vercel@latest whoami
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`n==> backend: vercel deploy --prod" -ForegroundColor Cyan
Set-Location "$root\backend"
npx vercel@latest deploy --prod --yes

Write-Host "`n==> frontend: vercel deploy --prod" -ForegroundColor Cyan
Set-Location "$root\apps\frontend"
npx vercel@latest deploy --prod --yes

Write-Host "`nDone." -ForegroundColor Green
Set-Location $root
