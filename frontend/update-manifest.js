import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(__dirname, "../build/manifest");

function updateVersion() {
  if (!fs.existsSync(manifestPath)) {
    console.error(`[Error] manifest 文件不存在: ${manifestPath}`);
    process.exit(1);
  }

  try {
    let content = fs.readFileSync(manifestPath, "utf8");
    const versionReg = /version\s*=\s*"([^"]+)"/;
    const match = content.match(versionReg);

    if (!match) {
      console.error("[Error] 未能在 manifest 中匹配到 version 属性");
      process.exit(1);
    }

    const currentVersion = match[1];
    const parts = currentVersion.split(".").map(Number);
    
    // 微版本加一，如 1.3.1 -> 1.3.2
    if (parts.length === 3 && !parts.some(isNaN)) {
      parts[2] += 1;
    } else {
      console.warn("[Warning] 版本格式不规范，将强制递增小版本");
      parts[parts.length - 1] = (parts[parts.length - 1] || 0) + 1;
    }

    const nextVersion = parts.join(".");
    content = content.replace(versionReg, `version               = "${nextVersion}"`);

    fs.writeFileSync(manifestPath, content, "utf8");
    console.log(`\x1b[32m%s\x1b[0m`, `[Success] 已自动更新 app 版本号: ${currentVersion} -> ${nextVersion}`);
  } catch (err) {
    console.error("[Error] 更新 manifest 版本发生异常:", err);
    process.exit(1);
  }
}

updateVersion();
