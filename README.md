# MCP BROWSER

**MCP BROWSER** is an open-source Electron desktop app to **manage MCP (Model Context Protocol) HTTP endpoints** and **browse server tools** (`tools/list`), including names, descriptions, and `inputSchema`.

**Author & maintainer:** **Guo's** (open source).

**Repository:** [github.com/unicorngithub/MCP-Browser](https://github.com/unicorngithub/MCP-Browser)

English | [简体中文](README.zh-CN.md)

---

## Features

- Save, edit, and delete MCP server URLs; persist with **electron-store**
- **Streamable HTTP** client: `initialize` → session (`Mcp-Session-Id`) → `notifications/initialized` → `tools/list` (MCP spec–aligned)
- Tool list and detail view (JSON `inputSchema`)
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

Production build (installers depend on OS; run on target platform when packaging):

```bash
pnpm build
```

To produce a **portable folder** only (`release/<version>/win-unpacked/`, etc.) without an NSIS installer (useful when the installer toolchain download fails):

```bash
pnpm run build:dir
```

To wipe `dist/`, `dist-electron/`, `release/`, and Vite cache before a full rebuild:

```bash
pnpm clean
pnpm rebuild   # clean + pnpm build
```

### pnpm + Electron

If Electron fails to download or start under pnpm, ensure `package.json` includes `pnpm.onlyBuiltDependencies` for `electron` and `esbuild`, then reinstall dependencies.

## Project layout

```text
├── build/             App icons for electron-builder (`icon.png`, generated `.ico` / `.icns`)
├── electron/          Main process, preload, IPC, MCP client
├── public/            Static assets (favicon, `icon.png` for the window in dev/prod)
├── scripts/           Helper scripts (e.g. `clean.mjs`)
├── shared/            Shared TypeScript types
├── src/               React renderer (UI, stores)
├── dist/              Vite web build
└── dist-electron/     Compiled Electron main + preload
```

## Scripts

| Script            | Description |
| ----------------- | ----------- |
| `pnpm dev`        | Vite + Electron development |
| `pnpm build`      | `tsc` + Vite build + electron-builder (installer where configured) |
| `pnpm run build:dir` | `tsc` + Vite + `electron-builder --dir` (unpacked app only) |
| `pnpm clean`      | Remove `dist/`, `dist-electron/`, `release/`, `node_modules/.vite` |
| `pnpm rebuild`    | `pnpm clean` then `pnpm build` |
| `pnpm test`       | Vitest (includes Electron e2e smoke) |
| `pnpm preview`    | Vite preview of the renderer build |

## Security notes

- **contextIsolation** enabled; preload exposes narrow APIs (`mcpDesktop`, `updaterIpc`), not full `ipcRenderer`
- MCP requests run in the **main process** (no CORS issues for `fetch`)

## License

**MIT** — full text in [LICENSE](LICENSE). **Guo's** holds the copyright stated there for this project as shipped.

Upstream template attribution (**© 草鞋没号**, electron-vite-react, MIT) is recorded in [NOTICE](NOTICE). When redistributing, include **both** `LICENSE` and `NOTICE` where your packaging expects legal notices.

## Acknowledgements

- **[Model Context Protocol](https://modelcontextprotocol.io)** — public specification and documentation referenced by this client.
- **[electron-vite-react](https://github.com/electron-vite/electron-vite-react)** — upstream Electron + Vite + React starter (MIT).
- **Electron**, **Vite**, **React**, **Tailwind CSS**, **Zustand**, **electron-store**, and other npm packages — each under its own license (see `node_modules`).

Additional dependencies are subject to their respective licenses; redistributing the app may require bundling their notices as required by those licenses.
