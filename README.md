# MCP Browser

**MCP Browser** is an open-source Electron desktop app for **managing MCP (Model Context Protocol) HTTP endpoints** and **browsing server tools** (`tools/list`): names, descriptions, and `inputSchema`.

**Author & maintainer:** **Guo's**.

**Repository:** [github.com/unicorngithub/MCP-Browser](https://github.com/unicorngithub/MCP-Browser)

English | [简体中文](README.zh-CN.md)

---

## Screenshots

Captured against **[MCP Feature Reference Server](https://example-server.modelcontextprotocol.io/)** — **`https://example-server.modelcontextprotocol.io/debug/mcp`** (Debug MCP App, Streamable HTTP, no OAuth). The root **`/mcp`** path on the same host may require authorization; see the official site for OAuth.

<p align="center">
  <img src="docs/images/app-window.png" alt="MCP Browser — main window: sidebar and tools panel" width="820" />
</p>

<p align="center"><em>Main window: default UI is Simplified Chinese (switch via sidebar EN / 中文; menu bar follows). Connected to the official Debug MCP sample — tool list and selected tool (description, <code>inputSchema</code>, tool test).</em></p>

<p align="center">
  <img src="docs/images/app-add-server.png" alt="MCP Browser — Add MCP server dialog with optional HTTP headers" width="820" />
</p>

<p align="center"><em>Add or edit an endpoint; optional headers (e.g. <code>Authorization</code>) for authenticated servers.</em></p>

---

## Features

- **Endpoints**: add, edit, remove MCP HTTP URLs; persisted with **electron-store**. **File** menu: **export / import** endpoint JSON for backup or migration.
- **Window layout**: **Display** → **Window mode** (below **Refresh**) — **single window** (default) or **multi-tab**. Each tab is a full workspace (sidebar + tools); **+** adds a tab; **×** closes a tab (at least one tab remains). Mode is stored separately (`mcp-browser-window-mode`).
- **Connection & tools**: choose **MCP HTTP transport** in the main toolbar (e.g. Streamable HTTP / SSE, depending on the server). Under Streamable HTTP the client follows `initialize` → `Mcp-Session-Id` → `notifications/initialized` → `tools/list`. Tool list and detail (`inputSchema`), tool calls, and optional HTTP trace views.
- **UI & menus**: English and **简体中文** (**react-i18next**); **Settings → Appearance** (light / dark / system); **Help** (user guide, check for updates, MCP spec link, etc.). Menu bar strings stay aligned via preload (`appLocale`, `appShellStrings`).
- **React 18** + **TypeScript** + **Vite** + **Tailwind CSS** + **Zustand**

## Requirements

- **Node.js** 18+ (recommended 20 LTS)
- **pnpm** or npm

## Quick start

```bash
git clone https://github.com/unicorngithub/MCP-Browser.git
cd MCP-Browser
pnpm install
pnpm dev
```

Compile only (`tsc` + Vite; outputs under `dist/`, `dist-electron/`):

```bash
pnpm build
```

Production installers (run on the target OS when packaging; electron-builder per config):

```bash
pnpm dist
```

Portable output only (`release/<version>/win-unpacked/`, etc.), no NSIS installer:

```bash
pnpm run dist:dir
```

Clean `dist/`, `dist-electron/`, `release/`, and Vite cache before a full rebuild:

```bash
pnpm clean
pnpm rebuild   # clean + pnpm dist
```

### pnpm + Electron

If Electron fails to download or start under pnpm, ensure `package.json` includes `pnpm.onlyBuiltDependencies` for `electron` and `esbuild`, then reinstall.

## macOS: Gatekeeper and quarantine

Prebuilt releases are **not Apple-notarized**. If launch is blocked or you see **“MCP Browser is damaged and can’t be opened”**, it is usually **Gatekeeper / quarantine**, **not** a broken download.

**First**, clear quarantine on the installed `.app` (adjust the path if you installed elsewhere):

```bash
sudo xattr -r -d com.apple.quarantine /Applications/MCP\ Browser.app
```

If the app is under your user folder (e.g. `~/Applications`):

```bash
sudo xattr -r -d com.apple.quarantine ~/Applications/MCP\ Browser.app
```

If it still won’t open, use **System Settings → Privacy & Security** to allow the app. As a last resort you can temporarily run `sudo spctl --master-disable`, then `sudo spctl --master-enable` when done. More detail: [docs/macOS安装与无法打开说明（macOS-install-troubleshooting）.md](docs/macOS安装与无法打开说明（macOS-install-troubleshooting）.md).

## Project layout

```text
├── build/             App icons for electron-builder (`icon.png`, generated `.ico` / `.icns`)
├── docs/images/       README screenshots (`app-window.png`, `app-add-server.png`; refresh with `pnpm test:update-screenshots` on non-Linux, not on every `pnpm test`)
├── electron/          Main process, preload, IPC, MCP client
├── public/            Static assets (favicon, `icon.png` for the window in dev/prod)
├── scripts/           Helper scripts (e.g. `clean.mjs`)
├── shared/            Shared types, locale helpers, main-process UI strings (`appShellStrings.ts`, MCP IPC constants)
├── src/               React renderer (UI, stores)
├── dist/              Vite web build
└── dist-electron/     Compiled Electron main + preload
```

## Scripts

| Script | Description |
| ------ | ----------- |
| `pnpm dev` | Vite + Electron development |
| `pnpm build` | `tsc` + Vite only (no installer) |
| `pnpm dist` | `pnpm build` then electron-builder (installers per config) |
| `pnpm run dist:dir` | `pnpm build` then `electron-builder --dir` (unpacked app only) |
| `pnpm clean` | Remove `dist/`, `dist-electron/`, `release/`, `node_modules/.vite` |
| `pnpm rebuild` | `pnpm clean` then `pnpm dist` |
| `pnpm test` | Vitest (E2E uses the official Debug MCP HTTP demo; needs network, skipped on Linux; does **not** overwrite README screenshots) |
| `pnpm test:update-screenshots` | Sets `MCP_BROWSER_UPDATE_SCREENSHOTS=1` to refresh `docs/images/*.png` and `test/screenshots/e2e.png` |
| `pnpm preview` | Vite preview of the renderer build |

## Security notes

- **contextIsolation** enabled; preload exposes narrow APIs (`mcpDesktop`, `updaterIpc`, theme/locale/menu/workspace helpers), not full `ipcRenderer`
- MCP HTTP traffic runs in the **main process** (no renderer CORS issues)

## License

**MIT** — see [LICENSE](LICENSE). Copyright **Guo's** as stated there for this project.

Redistributing binaries or source aggregates may require shipping **LICENSE** and **[NOTICE](NOTICE)** together so third-party license obligations stay intact.

## References

- **[Model Context Protocol](https://modelcontextprotocol.io)** — specification and documentation this client implements against.

Dependencies ship under their own licenses; see package metadata and **NOTICE** where applicable.
