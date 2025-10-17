<div align="center">
  <strong>Tab Stash</strong> is a free and open‑source Chrome extension to quickly stash tabs locally to read later.

  <br /><br />
  <em>
    Stash locally • Read‑later statuses • Fast search & tags
    <br />
    Bulk restore • Import/Export • Privacy‑first, offline
  </em>

  <br /><br />
  <img src="public/branding/stashy.svg" alt="Stashy" width="280" />
  <br />
  <em>Hi, I'm Stashy. Designed by ChatGPT. Let's clean up those tabs...</em>
</div>

## Quick Start

Requirements: Chrome 114+, Node 18+, npm.

Clone the repo:
```
git clone https://github.com/iannuttall/tab-stash.git
```

Enter the folder:
```
cd tab-stash
```

Install dependencies:
```
npm i
```

Build the extension:
```
npm run build
```

Load in Chrome:
```
chrome://extensions
```
Enable Developer mode → Load unpacked → select `dist/`.

## Development

Run the UI dev server (load the extension separately in Chrome):
```
npm run dev
```

Type-check:
```
npm run typecheck
```

Build production:
```
npm run build
```

Create a versioned store upload zip:
```
npm run package
```



UI uses Tailwind and shadcn/ui components in [src/components/ui/](src/components/ui/).

## Keyboard Shortcuts (editable in Chrome)
- Stash all tabs:
  - Windows/Linux: <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>
  - macOS: <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>S</kbd>
- Stash current tab:
  - Windows/Linux: <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>X</kbd>
  - macOS: <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>X</kbd>
- Open Side Panel:
  - Windows/Linux: <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd>
  - macOS: <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>O</kbd>
- Open Dashboard:
  - Windows/Linux: <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd>
  - macOS: <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>D</kbd>

## Data and Privacy
- The extension does not send data to any server.
- All data is stored locally.
- Privacy policy: [docs/privacy.md](docs/privacy.md)

## Packaging for the Chrome Web Store
Run:
```
npm run package
```
- Upload the zip from `releases/`.
- Listing copy: [docs/store-listing.md](docs/store-listing.md)

## License
- MIT. See [LICENSE](LICENSE).

## Contributing
- Open issues and pull requests on GitHub.
