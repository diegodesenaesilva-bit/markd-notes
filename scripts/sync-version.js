import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

const CORRECT_PUBKEY = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmFzaWduIHB1YmxpYyBrZXk6IEEwRDM1NzE5MUYwMTM4MDkKUldTZUNSdzlVclcyNDlrdjcyS2FwZjdzUXRwbkF4bEFsODVsZmsyaTFlaXNlSEhPcFJvdHRnTHQK";
const CORRECT_ENDPOINT = "https://github.com/diegodesenaesilva-bit/markd-notes/releases/latest/download/latest.json";

function log(emoji, msg) {
  console.log(`${emoji} ${msg}`);
}

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function writeJsonFile(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// ── 1. Clean up conflicting workspace files ─────────────────────────────────

function cleanWorkspace() {
  const bunLockPath = join(projectRoot, "bun.lock");
  if (existsSync(bunLockPath)) {
    try {
      unlinkSync(bunLockPath);
      log("🧹", "Removed bun.lock to prevent lockfile conflicts");
    } catch {}
  }
}

// ── 2. Fix Rust imports ─────────────────────────────────────────────────────

function fixRustImports() {
  const libRsPath = join(projectRoot, "src-tauri", "src", "lib.rs");
  if (!existsSync(libRsPath)) return;

  let content = readFileSync(libRsPath, "utf-8");
  if (content.includes("app_handle()") && !content.includes("use tauri::Manager;")) {
    const lines = content.split(/\r?\n/);
    let lastUseIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^use\s+/.test(lines[i])) lastUseIndex = i;
    }
    if (lastUseIndex >= 0) {
      lines.splice(lastUseIndex + 1, 0, "use tauri::Manager;\n");
    } else {
      lines.unshift("use tauri::Manager;\n");
    }
    writeFileSync(libRsPath, lines.join("\n"), "utf-8");
    log("🔧", "Restored `use tauri::Manager;` in lib.rs");
  }
}

// ── 3. Regenerate Cargo.lock if missing ─────────────────────────────────────

function ensureCargoLock() {
  const cargoLockPath = join(projectRoot, "src-tauri", "Cargo.lock");
  if (!existsSync(cargoLockPath)) {
    log("🔧", "Cargo.lock missing — regenerating...");
    try {
      execSync("cargo generate-lockfile --manifest-path src-tauri/Cargo.toml", {
        cwd: projectRoot,
        stdio: "pipe",
      });
      log("✅", "Cargo.lock regenerated successfully");
    } catch (e) {
      log("⚠️", `Cargo.lock regeneration failed: ${e.message}`);
    }
  }
}

// ── 4. Synchronize versions across all 6 files ──────────────────────────────

function syncVersions() {
  const tauriConfPath = join(projectRoot, "src-tauri", "tauri.conf.json");
  if (!existsSync(tauriConfPath)) {
    console.error("❌ tauri.conf.json not found!");
    process.exit(1);
  }

  const conf = readJsonFile(tauriConfPath);
  
  // Sanitize updater and security
  if (!conf.bundle) conf.bundle = {};
  conf.bundle.createUpdaterArtifacts = "v1Compatible";
  conf.bundle.category = "Productivity";
  if (!conf.app) conf.app = {};
  if (!conf.app.security) conf.app.security = { csp: null };
  conf.app.security.assetProtocol = { enable: true, scope: [] };
  if (!conf.plugins) conf.plugins = {};
  if (!conf.plugins.updater) conf.plugins.updater = {};
  if (conf.plugins.updater.pubkey !== CORRECT_PUBKEY) conf.plugins.updater.pubkey = CORRECT_PUBKEY;
  if (!Array.isArray(conf.plugins.updater.endpoints) || conf.plugins.updater.endpoints[0] !== CORRECT_ENDPOINT) {
    conf.plugins.updater.endpoints = [CORRECT_ENDPOINT];
  }
  writeJsonFile(tauriConfPath, conf);

  const version = conf.version;
  if (!version) {
    console.error("❌ No version in tauri.conf.json!");
    process.exit(1);
  }

  log("📦", `Canonical version from tauri.conf.json: ${version}`);

  // File 1: package.json
  const pkgPath = join(projectRoot, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = readJsonFile(pkgPath);
    if (pkg.version !== version) {
      pkg.version = version;
      writeJsonFile(pkgPath, pkg);
      log("✓", `Synced package.json → ${version}`);
    }
  }

  // File 2: Cargo.toml & Cargo.lock
  const cargoTomlPath = join(projectRoot, "src-tauri", "Cargo.toml");
  if (existsSync(cargoTomlPath)) {
    let cargo = readFileSync(cargoTomlPath, "utf-8");
    const versionRegex = /^(\s*version\s*=\s*")[^"]+(".*)$/m;
    if (versionRegex.test(cargo)) {
      const newCargo = cargo.replace(versionRegex, `$1${version}$2`);
      if (newCargo !== cargo) {
        writeFileSync(cargoTomlPath, newCargo, "utf-8");
        log("✓", `Synced Cargo.toml → ${version}`);
      }
    }
  }

  const cargoLockPath = join(projectRoot, "src-tauri", "Cargo.lock");
  if (existsSync(cargoLockPath)) {
    let lock = readFileSync(cargoLockPath, "utf-8");
    const lockRegex = /(\[\[package\]\]\r?\nname\s*=\s*"Markd"\r?\nversion\s*=\s*")[^"]+(")/;
    if (lockRegex.test(lock)) {
      const newLock = lock.replace(lockRegex, `$1${version}$2`);
      if (newLock !== lock) {
        writeFileSync(cargoLockPath, newLock, "utf-8");
        log("✓", `Synced Cargo.lock → ${version}`);
      }
    }
  }

  // File 3: site/package.json
  const sitePkgPath = join(projectRoot, "site", "package.json");
  if (existsSync(sitePkgPath)) {
    const sitePkg = readJsonFile(sitePkgPath);
    if (sitePkg.version !== version) {
      sitePkg.version = version;
      writeJsonFile(sitePkgPath, sitePkg);
      log("✓", `Synced site/package.json → ${version}`);
    }
  }

  // File 4: site/lib/config.ts
  const configPath = join(projectRoot, "site", "lib", "config.ts");
  if (existsSync(configPath)) {
    let cfg = readFileSync(configPath, "utf-8");
    const newCfg = cfg.replace(/export const VERSION = "[^"]+"/, `export const VERSION = "${version}"`);
    if (newCfg !== cfg) {
      writeFileSync(configPath, newCfg, "utf-8");
      log("✓", `Synced site/lib/config.ts → ${version}`);
    }
  }

  // File 5: site/lib/changelog.ts
  const changelogPath = join(projectRoot, "site", "lib", "changelog.ts");
  if (existsSync(changelogPath)) {
    let cl = readFileSync(changelogPath, "utf-8");
    const newCl = cl.replace(/version:\s*"[^"]+"/, `version: "${version}"`);
    if (newCl !== cl) {
      writeFileSync(changelogPath, newCl, "utf-8");
      log("✓", `Synced site/lib/changelog.ts → ${version}`);
    }
  }

  log("✅", `All 6 configuration files synchronized to version ${version}`);
}

// ── Main Execution ──────────────────────────────────────────────────────────

cleanWorkspace();
fixRustImports();
syncVersions();
ensureCargoLock();
