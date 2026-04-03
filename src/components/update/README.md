# Auto update (`electron-updater`)

This project uses **electron-updater** for packaged builds. Update checks only run when `app.isPackaged` is true.

## Configure a release feed

In `electron-builder.json`, add a `publish` block with your own update server URL and provider. Official reference: [electron-builder publish](https://www.electron.build/configuration/publish).

Without `publish`, packaged apps will not receive updates from this template.

## Code

Main-process logic lives in `electron/main/update.ts`. The React UI is under `src/components/update/`.
