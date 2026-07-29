import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

const expectedVersion = process.argv[2];

if (!/^\d+\.\d+\.\d+$/.test(expectedVersion ?? "")) {
  console.error("Usage: node scripts/verify-release-version.js <expected-version>");
  process.exit(1);
}

// Auto-sync versions first to ensure all 6 config files match tauri.conf.json
try {
  execSync("node scripts/sync-version.js", { cwd: projectRoot, stdio: "inherit" });
} catch (e) {
  console.error("Auto-sync failed:", e.message);
}

const readJson = (path) => JSON.parse(readFileSync(join(projectRoot, path), "utf8"));
const versions = new Map([
  ["package.json", readJson("package.json").version],
  ["src-tauri/tauri.conf.json", readJson("src-tauri/tauri.conf.json").version],
  ["site/package.json", readJson("site/package.json").version],
  [
    "site/lib/config.ts",
    readFileSync(join(projectRoot, "site/lib/config.ts"), "utf8").match(/VERSION = "([^"]+)"/)?.[1],
  ],
  [
    "site/lib/changelog.ts",
    readFileSync(join(projectRoot, "site/lib/changelog.ts"), "utf8").match(/version: "([^"]+)"/)?.[1],
  ],
  [
    "src-tauri/Cargo.toml",
    readFileSync(join(projectRoot, "src-tauri/Cargo.toml"), "utf8").match(/^version = "([^"]+)"/m)?.[1],
  ],
]);

let failed = false;
for (const [file, version] of versions) {
  if (version !== expectedVersion) {
    console.error(`Version mismatch in ${file}: expected ${expectedVersion}, found ${version}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Release version verification passed: ${expectedVersion}`);
