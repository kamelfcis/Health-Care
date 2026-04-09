# Design exports

## UI sitemap (PNG for designers)

| File | Purpose |
|------|---------|
| `ui-sitemap-flowchart.png` | High-resolution **PNG** of the full app structure (20 screens). Use in Figma references, slides, or print. |
| `ui-sitemap-flowchart.mmd` | **Mermaid source** — edit this file, then regenerate the PNG. |

**Regenerate the PNG** (from this folder):

```bash
npx --yes @mermaid-js/mermaid-cli@11.4.0 -i ui-sitemap-flowchart.mmd -o ui-sitemap-flowchart.png -w 3600 -s 2 -b white
```

- `-w 3600` — wide canvas for readable labels  
- `-s 2` — scale (sharper image)  
- `-b white` — white background (good for docs and printing)  

Requires Node.js and a network connection the first time (downloads the CLI and Chromium).

Colors follow the product brand: navy `#0B2A4A`, orange `#F27A1A` (see repo root `README.md`).
