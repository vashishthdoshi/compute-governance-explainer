# Compute Stack Explorer

An interactive explainer of who owns, hosts, runs, funds, governs and allocates shared AI and HPC compute. It was built to inform the governance section of the CalCompute framework report under California SB 53 (Government Code section 11546.8).

* **Explore**: sixteen configurations (seven approaches, five variants, four international contrast cases) in two WebGL views, Strata and Constellation, with request, money, control and location flows.
* **Journeys**: eleven user stories that follow a request down the stack, with friction points tagged to SB 53's purposes.
* **Compare**, **Stakeholders**, **Bundling spectrum** and **Changelog**.

Facts are tagged as verified, reported, not public, and inferred and are linked to their sources.

## Where the data lives

All content comes from one workbook: `data/explorer-master.xlsx`. Only update the .xlsx for updates to the visuals.

1. Edit the workbook.
2. Commit it to `main`.
3. The GitHub Action converts it to `src/generated/explorer.json`, checks every reference (organizations, layers, sources, journeys), type-checks the code and redeploys the site. If a reference is broken, the Action log names the sheet and row.

Rows with `public = No` are left out of the site. The workbook itself is visible to anyone if the repository is public.

## Run it on your computer

Requires Node.js 20 or later.

```bash
npm ci
npm run dev        # converts the workbook and starts a local server
npm run build      # the same checks and build the Action runs
npm run build:preview   # one self-contained HTML file in dist-preview/, logos inlined
```

## Project structure

```
data/explorer-master.xlsx     the master workbook (single source of truth)
scripts/build-data.mjs        workbook → JSON, with reference checks
src/generated/explorer.json   generated; do not edit by hand
src/stage.ts                  WebGL views (three.js)
src/views/                    explore, journeys, compare, stakeholders, spectrum, changelog
src/styles.css                design tokens and layout
public/assets/logos/          logo files
.github/workflows/deploy.yml  build and deploy to GitHub Pages
```

## License

Code: MIT (`LICENSE`). Data and text: CC BY 4.0 (`LICENSE-DATA.md`). Logos remain the trademarks of their owners.

