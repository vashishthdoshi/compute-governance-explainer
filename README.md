# Compute Stack Explorer

An interactive explainer of who owns, hosts, runs, funds, governs and allocates shared AI and HPC compute. It was built to inform the governance section of the CalCompute framework report under California SB 53 (Government Code section 11546.8). It describes how existing systems work; it does not recommend a model.

- **Explore**: sixteen configurations (seven approaches, five variants, four international contrast cases) in two WebGL views, Strata and Constellation, with request, money, control and location flows.
- **Journeys**: eleven user stories that follow a request down the stack, with friction points tagged to SB 53's purposes.
- **Compare**, **Stakeholders**, **Bundling spectrum** and **Changelog**.

Every fact carries a status (verified, reported, not public, inferred) and links to its source.

## Where the data lives

All content comes from one workbook: `data/explorer-master.xlsx`. The site never contains facts that are not in the workbook.

1. Edit the workbook (Calibri 12; the Guide sheet explains every column).
2. Commit it to `main`.
3. The GitHub Action converts it to `src/generated/explorer.json`, checks every reference (organizations, layers, sources, journeys), type-checks the code and redeploys the site. If a reference is broken, the build stops and the Action log names the sheet and row.

Rows with `public = No` are left out of the site. The workbook itself is visible to anyone if the repository is public, so keep internal-only notes in your drive copy, not in the committed file.

Interface wording (titles, intros, footer) lives in the workbook's **UI Text** sheet, including the product name (`app.name`).

## Publish on GitHub Pages

1. Create a repository and upload the contents of this folder (not the folder itself), keeping the `.github` folder.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push or upload to `main`. The **Build and deploy** Action publishes the site; the URL appears in the Action's summary.
4. In the workbook's **UI Text** sheet, set `footer.issue.url` to your repository's issues page (for example `https://github.com/your-org/your-repo/issues/new`).

## Logos

Logo files live in `public/assets/logos/`, listed in that folder's README and the workbook's **Logos** sheet. A `logo_file` cell can name several files separated by semicolons; organizations without a file show their initials.

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

## Design rules

- Calibri (with the metric-compatible Carlito as a bundled fallback), 16 px body, 24 px subheadings, 32 px headings; 14 px only for annotations inside diagrams.
- Text is black or white depending on the background; navy is the only accent; off-white and dark-grey grounds for light and dark themes.
- Links are embedded in their topic text, shown in blue italic. Italic is used for nothing else.
- Status is shown by fill and border style, never by color alone.

## Accessibility

- Every 3-D view has a text equivalent: the detail panel lists each organization, its layers, facts and flows.
- The 3-D canvas takes keyboard focus; arrow keys turn it and plus or minus zoom.
- Motion follows the device's reduced-motion setting.
- Tabs, journeys and presenter mode work from the keyboard.

## State in the address bar

The current view is kept in the URL hash, so a copied link reopens it. For example, `#explore.empire.strata.rmb` opens Empire AI in Strata with request and money flows and bundling highlighted.

## License

Code: MIT (`LICENSE`). Data and text: CC BY 4.0 (`LICENSE-DATA.md`). Logos remain the trademarks of their owners.
