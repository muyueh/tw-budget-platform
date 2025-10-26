# tw-budget-platform

This repository now includes an offline-friendly static site generator so you can publish the budget explorer on GitHub Pages without installing webpack or other heavy build tooling.

## Prerequisites
- Node.js (v16 or newer is recommended).
- The repository's `budget_list.js` file contains the data that will be embedded in the static site. Update it before building if you need to change the available budgets.

## Build the static site
```bash
npm run build:static
```
The command clears the `docs/` directory and regenerates all pages and assets.

If your GitHub Pages site is published under a project path (for example `/my-project/`), set the base path when building so every link points to the correct location:

```bash
BASE_PATH=/my-project/ npm run build:static
```

## Deploy to GitHub Pages
1. Commit the updated `docs/` directory.
2. Push to GitHub and configure **Pages → Build and deployment → Source** to use the `docs/` folder on your default branch.
3. The generated site includes navigation, budget details, and download links for every entry in `budget_list.js`.

You can re-run the build command whenever `budget_list.js` changes; no external dependencies are required.
