# Contributing

Thanks for helping improve Codex Remote Monitor Widget.

## Development

```powershell
npm install
npm run dev
```

Before opening a pull request, run:

```powershell
npm run typecheck
npm test
npm run build
```

## Pull Request Guidelines

- Keep changes focused and easy to review.
- Add or update tests when changing parsers, data normalization, IPC behavior, or settings persistence.
- Do not commit generated output from `dist/`, `release/`, or `node_modules/`.
- Do not commit real SSH credentials, host fingerprints from private infrastructure, or screenshots containing secrets.

## Code Style

- TypeScript should remain strict.
- Main-process code owns Node.js and Electron APIs.
- Renderer code should use the preload API instead of importing Node.js modules.
- Shared parsing and normalization logic belongs in `src/shared`.
