# Web game template (GitHub Pages + PR previews)

This branch is intended as a starting point for small web games.

## What you get
- GitHub Pages deploy on every push to `main`
- PR preview deploys at `https://<user>.github.io/<repo>/pr/<PR_NUMBER>/`
- Automatic cleanup when PR closes

## Required GitHub Pages configuration (important)
This workflow publishes the site into the **`gh-pages` branch** (required).

1. Go to **Repo → Settings → Pages**
2. Under **Build and deployment**
   - **Source**: "Deploy from a branch"
   - **Branch**: **`gh-pages`**
   - **Folder**: **`/ (root)`**
3. Save

Notes:
- The workflow will create/update `gh-pages` automatically.
- Production deploy uses `/`.
- PR previews are deployed under `/pr/<PR_NUMBER>/`.

## Where it is implemented
- `.github/workflows/pages.yml`

## How to use
- Replace `index.html` and add your assets (JS/CSS/images).
- Open PRs: previews publish automatically.
