# Requires $env:VERCEL_TOKEN (Vercel → Account → Tokens).
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot
node scripts/patch-vercel-project.mjs
