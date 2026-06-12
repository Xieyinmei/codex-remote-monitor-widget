# Codex Remote Monitor Widget

A small Windows desktop widget that shows local Codex quota and live CPU/GPU usage from a remote Linux machine over SSH.

The app is built with Electron, React, and TypeScript. It is designed to sit quietly on the desktop, stay on top when needed, and make long-running remote jobs easier to watch.

## Features

- Floating frameless Windows desktop widget.
- Tray menu with show/hide, refresh, settings, and exit actions.
- Codex quota display through local `codex app-server` JSON-RPC:
  - calls `account/rateLimits/read`
  - listens for `account/rateLimits/updated`
  - displays remaining percentage and reset time
- Remote Linux monitoring over SSH:
  - host/IP, port, username, and password configured in the settings panel
  - CPU usage from `/proc/stat`
  - NVIDIA GPU usage, memory, and temperature from `nvidia-smi`
- Passwords are encrypted locally with Electron `safeStorage`.
- Unit tests for CPU parsing, GPU parsing, and Codex quota normalization.

## Screenshot

Screenshot coming soon. The current UI is a compact translucent widget inspired by desktop quota/status cards.

## Requirements

- Windows 10 or Windows 11
- Node.js 20 or newer
- npm
- Codex CLI available locally, if you want Codex quota data
- A remote Linux machine with SSH enabled
- NVIDIA drivers and `nvidia-smi` on the remote machine, if you want GPU metrics

## Quick Start

```powershell
npm install
npm run dev
```

The widget opens as an Electron desktop window. Use the settings button to configure:

- remote host/IP
- SSH port, usually `22`
- username
- password
- refresh interval

To build the production files:

```powershell
npm run build
```

To run tests:

```powershell
npm test
```

To run type checks:

```powershell
npm run typecheck
```

## Remote Host Notes

The first version assumes the remote host is Linux.

CPU usage is calculated from two `/proc/stat` samples. GPU metrics use:

```bash
nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits
```

If `nvidia-smi` is not available, the widget continues showing CPU metrics and displays GPU as unavailable.

## Codex Quota Notes

Codex quota is read from the local Codex app-server process. The app starts:

```bash
codex app-server
```

Then it initializes a JSON-RPC connection and reads:

- `account/rateLimits/read`
- `account/rateLimits/updated`

If Codex is not installed or the app-server protocol changes, the widget shows an error instead of crashing.

## Security

- SSH passwords are encrypted through Electron `safeStorage` before being written to app data.
- Passwords are never written to `.env` files.
- The renderer process uses a preload bridge and does not get direct Node.js access.
- Host key fingerprints are stored after a successful connection test.

For vulnerability reports, see [SECURITY.md](SECURITY.md).

## Project Structure

```text
src/main      Electron main process: window, tray, settings, Codex, SSH
src/preload   Safe IPC bridge exposed to the renderer
src/renderer  React widget UI and settings panel
src/shared    Shared types, parsers, and normalization logic
scripts       Development and cleanup scripts
```

## Scripts

```text
npm run dev        Start Vite, compile main/preload in watch mode, and open Electron
npm run clean      Remove dist
npm run build      Build Electron main/preload and renderer
npm run start      Build and start Electron
npm run test       Run unit tests
npm run typecheck  Run TypeScript checks
```

## Packaging

The default package command creates an unpacked Windows app directory and reuses the Electron runtime installed in `node_modules/electron/dist`. This avoids downloading Electron during packaging.

```powershell
npm run package:win
```

Then run:

```text
release/win-unpacked/Codex Monitor Widget.exe
```

To build an NSIS installer instead:

```powershell
npm run package:installer
```

The installer target may download additional builder assets, depending on your local cache and network environment. A signed installer is not configured yet.

The unpacked directory build disables Windows executable resource editing/signing so it can work without downloading `winCodeSign` assets. The executable may show Electron's default metadata until a signed release pipeline is added.

## Roadmap

- Add screenshots and release artifacts.
- Add SSH private key authentication.
- Add Linux and macOS window behavior support.
- Add AMD/Intel GPU providers.
- Add richer Codex usage details.
- Add import/export for settings.

## License

MIT
