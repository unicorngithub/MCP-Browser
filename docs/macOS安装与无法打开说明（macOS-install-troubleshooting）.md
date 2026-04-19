# MCP Browser — macOS 安装与无法打开说明

> **MCP Browser** 预构建包未经过 Apple 公证。首次安装或打开时若被系统拦截、或提示「已损坏」，通常与 **门禁（Gatekeeper）** 与下载标记 **隔离（quarantine）** 有关，可按下文处理。

---

## 1. 安装方式

- **DMG**：双击挂载后，将 **MCP Browser** 拖入 **应用程序（Applications）** 文件夹。  
- **ZIP**：解压后，将 **MCP Browser.app** 移入 **/Applications** 或 **~/Applications**。

建议最终路径为：`/Applications/MCP Browser.app`。

---

## 2. 系统设置：允许来源

1. 点击屏幕左上角 **苹果菜单**（）> **系统设置**（macOS Monterey 及更早为 **系统偏好设置**）。  
2. 打开 **隐私与安全性**（较早版本为 **安全性与隐私**）。  
3. 在 **安全性**（或「允许从以下位置下载的应用」）中，若出现 **任何来源**，请选中。

---

## 3. 若没有「任何来源」选项

在「终端」中以**管理员**执行（会全局放宽门禁，用毕建议恢复）：

```bash
sudo spctl --master-disable
```

恢复默认策略：

```bash
sudo spctl --master-enable
```

---

## 4. 移除隔离标记（推荐优先尝试）

从网络下载的应用会带有 `com.apple.quarantine` 属性，可能触发「应用已损坏」等误报。对**已安装**的 `.app` 执行（路径请按实际安装位置修改）：

```bash
sudo xattr -r -d com.apple.quarantine /Applications/MCP\ Browser.app
```

若安装在用户目录下，例如：

```bash
sudo xattr -r -d com.apple.quarantine ~/Applications/MCP\ Browser.app
```

---

## 5. 命令对照

| 命令 | 作用范围 | 说明 |
|------|----------|------|
| `sudo xattr -r -d com.apple.quarantine <.app 路径>` | 单个应用 | 仅清除该应用的隔离标记；在信任本应用时**优先使用**。 |
| `sudo spctl --master-disable` | 整个系统 | 全局允许未签名/未公证应用，直至 `master-enable`；**慎用**，不建议长期开启。 |

---

## 6. English summary

Prebuilt **MCP Browser** is **not Apple-notarized**. If macOS blocks launch or reports the app as **damaged**, use **System Settings → Privacy & Security** and allow **Anywhere** if shown; otherwise run `sudo spctl --master-disable` (re-enable with `sudo spctl --master-enable` when done). Prefer removing quarantine for this app only:

```bash
sudo xattr -r -d com.apple.quarantine /Applications/MCP\ Browser.app
```

---

**Author / maintainer:** Guo's · **Repository:** [github.com/unicorngithub/MCP-Browser](https://github.com/unicorngithub/MCP-Browser)
