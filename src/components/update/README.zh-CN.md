# 自动更新（electron-updater）

本项目在**已打包**的应用中使用 **electron-updater** 做更新检测；开发模式（`app.isPackaged === false`）下不会真正拉取更新。

## 配置更新源

在 `electron-builder.json` 中自行添加 `publish` 字段，填写你的更新服务地址与策略。官方说明见：[electron-builder — Publish](https://www.electron.build/configuration/publish)。

未配置 `publish` 时，安装包不会从任何远程地址获取更新。

## 代码位置

主进程：`electron/main/update.ts`  
界面：`src/components/update/`
