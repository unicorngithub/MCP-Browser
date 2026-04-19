/**
 * NSIS / Windows 安装器需要 .ico；从 build/icon.png 生成 build/icon.ico（见 .gitignore 中的 build/*.ico）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pngPath = path.join(root, "build", "icon.png");
const icoPath = path.join(root, "build", "icon.ico");

if (!fs.existsSync(pngPath)) {
  console.error(`Missing ${pngPath}; add icon.png under build/ first.`);
  process.exit(1);
}

const buf = await pngToIco(fs.readFileSync(pngPath));
fs.writeFileSync(icoPath, buf);
console.log(`Wrote ${icoPath}`);
