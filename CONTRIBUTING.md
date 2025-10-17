# Contributing

Thanks for helping improve Tab Stash. Keep changes small, focused, and easy to review.

## Getting Started
- Node 18+ and npm.

Install:
```
npm i
```

Typecheck:
```
npm run typecheck
```

Build (outputs `dist/`):
```
npm run build
```

## Workflow
- Create a feature branch from `main`.
- Write clear commits in imperative tense. Example: `Add AlertDialog for bulk delete`.
- Open a pull request with a short summary, screenshots for UI changes, and test steps.

## Code Style
- TypeScript + React (functional). Two‑space indent.
- Use shadcn/ui components from [src/components/ui/](src/components/ui/).
- Tailwind utilities for styling. Keep class lists short and consistent.
- No new dependencies without discussion.

## Quality Checks
- Run `npm run typecheck` and `npm run build` before pushing.
- UI overlays must be solid and above content:
  - Tooltips, dropdowns, dialogs use shadcn. Add `bg-*`, `isolate`, and a high `z-index`.
- Verify focus/visibility refresh works after sleep (Dashboard and Side Panel).

## PR Checklist
- Description of the change and why.
- Screenshots/GIFs for UI changes.
- Notes on any manifest or permission changes.
- Confirmed typecheck and build pass.

## Security
- No secrets or analytics.
- Data stays local (IndexedDB + `chrome.storage.local`).
