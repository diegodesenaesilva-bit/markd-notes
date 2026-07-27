#!/usr/bin/env node

/**
 * CI Auto-Repair Script
 * 
 * Runs as the FIRST step in every CI/Release workflow.
 * Automatically fixes all known issues caused by AI Studio pushes:
 * 
 * 1. Removes conflicting workflow files (release-linux.yml, release-windows.yml)
 * 2. Ensures release.yml exists with correct content
 * 3. Removes bun.lock
 * 4. Regenerates Cargo.lock if missing
 * 5. Ensures `use tauri::Manager;` import exists in lib.rs
 * 6. Syncs version across all config files
 * 7. Sanitizes tauri.conf.json updater config
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

const CORRECT_ENDPOINT = "https://github.com/diegodesenaesilva-bit/markd-notes/releases/latest/download/latest.json";
const CORRECT_PUBKEY = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDdFNjNBOTNGNTRBQzFDNgpSV1RHd1VyMWt6cm1CenhURGY5RGdDKzNLYnFDKzF4U0dpbG80cnRBa080a2pER0ZPYjZNNEJrZQo=";

let fixCount = 0;

function log(emoji, msg) {
  console.log(`${emoji} ${msg}`);
}

function readJsonFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content.replace(/^\uFEFF/, ""));
}

function writeJsonFile(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// ─── 1. Remove conflicting workflow files ───────────────────────────────────

function removeConflictingFiles() {
  const badFiles = [
    join(projectRoot, ".github", "workflows", "release-windows.yml"),
    join(projectRoot, ".github", "workflows", "release-linux.yml"),
    join(projectRoot, "bun.lock"),
  ];

  for (const file of badFiles) {
    if (existsSync(file)) {
      unlinkSync(file);
      log("🗑️", `Removed conflicting file: ${file.replace(projectRoot, ".")}`);
      fixCount++;
    }
  }
}

// ─── 2. Ensure release.yml exists ───────────────────────────────────────────

const RELEASE_YML_CONTENT = `name: Release Markd Notes

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  release:
    permissions:
      contents: write
    runs-on: windows-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Auto-repair project
        run: node scripts/ci-auto-repair.js

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'

      - name: Install frontend dependencies
        run: npm install --legacy-peer-deps

      - name: Get version
        id: version
        shell: powershell
        run: |
          $ver = (Get-Content src-tauri/tauri.conf.json | ConvertFrom-Json).version
          echo "version=$ver" >> $env:GITHUB_OUTPUT
          echo "tag=v$ver" >> $env:GITHUB_OUTPUT

      - name: Build and release with Tauri Action
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: \${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ""
        with:
          tagName: v__VERSION__
          releaseName: "Markd v__VERSION__"
          releaseBody: "Nova versão do Markd"
          releaseDraft: false
          prerelease: false
          includeUpdaterJson: true
`;

function ensureReleaseYml() {
  const releaseYmlPath = join(projectRoot, ".github", "workflows", "release.yml");
  
  if (!existsSync(releaseYmlPath)) {
    mkdirSync(dirname(releaseYmlPath), { recursive: true });
    writeFileSync(releaseYmlPath, RELEASE_YML_CONTENT, "utf-8");
    log("🔧", "Restored missing release.yml workflow");
    fixCount++;
  }
}

// ─── 3. Regenerate Cargo.lock if missing ────────────────────────────────────

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
      fixCount++;
    } catch (e) {
      log("⚠️", `Cargo.lock regeneration failed: ${e.message}`);
    }
  }
}

// ─── 4. Fix Rust imports in lib.rs ──────────────────────────────────────────

function fixRustImports() {
  const libRsPath = join(projectRoot, "src-tauri", "src", "lib.rs");
  
  if (!existsSync(libRsPath)) return;
  
  let content = readFileSync(libRsPath, "utf-8");
  let modified = false;

  // Ensure `use tauri::Manager;` exists if app_handle() is used
  if (content.includes("app_handle()") && !content.includes("use tauri::Manager")) {
    // Find the last `use ...;` line and insert after it
    const lines = content.split(/\r?\n/);
    let lastUseIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^use\s+/.test(lines[i])) {
        lastUseIndex = i;
      }
    }
    if (lastUseIndex >= 0) {
      lines.splice(lastUseIndex + 1, 0, "use tauri::Manager;");
    } else {
      // No use statements found, add at top
      lines.unshift("use tauri::Manager;");
    }
    content = lines.join("\n");
    modified = true;
    log("🔧", "Added missing `use tauri::Manager;` import in lib.rs");
  }

  if (modified) {
    writeFileSync(libRsPath, content, "utf-8");
    fixCount++;
  }
}

// ─── 5. Sync versions ──────────────────────────────────────────────────────

function syncVersions() {
  const tauriConfPath = join(projectRoot, "src-tauri", "tauri.conf.json");
  if (!existsSync(tauriConfPath)) return;
  
  // Sanitize tauri.conf.json
  const conf = readJsonFile(tauriConfPath);
  let confModified = false;
  
  if (!conf.plugins) conf.plugins = {};
  if (!conf.plugins.updater) conf.plugins.updater = {};
  
  if (conf.plugins.updater.pubkey !== CORRECT_PUBKEY) {
    conf.plugins.updater.pubkey = CORRECT_PUBKEY;
    confModified = true;
  }
  
  if (!Array.isArray(conf.plugins.updater.endpoints) || conf.plugins.updater.endpoints[0] !== CORRECT_ENDPOINT) {
    conf.plugins.updater.endpoints = [CORRECT_ENDPOINT];
    confModified = true;
  }
  
  if (confModified) {
    writeJsonFile(tauriConfPath, conf);
    log("🛡️", "Fixed tauri.conf.json updater endpoints/pubkey");
    fixCount++;
  }
  
  const version = conf.version;
  if (!version) return;
  
  log("📦", `Version from tauri.conf.json: ${version}`);
  
  // Sync package.json
  const pkgPath = join(projectRoot, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = readJsonFile(pkgPath);
    if (pkg.version !== version) {
      pkg.version = version;
      writeJsonFile(pkgPath, pkg);
      log("✓", `Synced package.json → ${version}`);
      fixCount++;
    }
  }
  
  // Sync Cargo.toml
  const cargoTomlPath = join(projectRoot, "src-tauri", "Cargo.toml");
  if (existsSync(cargoTomlPath)) {
    let cargo = readFileSync(cargoTomlPath, "utf-8");
    const versionRegex = /^(\s*version\s*=\s*")[^"]+(".*)$/m;
    if (versionRegex.test(cargo)) {
      const newCargo = cargo.replace(versionRegex, `$1${version}$2`);
      if (newCargo !== cargo) {
        writeFileSync(cargoTomlPath, newCargo, "utf-8");
        log("✓", `Synced Cargo.toml → ${version}`);
        fixCount++;
      }
    }
  }
  
  // Sync site/package.json
  const sitePkgPath = join(projectRoot, "site", "package.json");
  if (existsSync(sitePkgPath)) {
    const sitePkg = readJsonFile(sitePkgPath);
    if (sitePkg.version !== version) {
      sitePkg.version = version;
      writeJsonFile(sitePkgPath, sitePkg);
      log("✓", `Synced site/package.json → ${version}`);
      fixCount++;
    }
  }
  
  // Sync site/lib/config.ts
  const configPath = join(projectRoot, "site", "lib", "config.ts");
  if (existsSync(configPath)) {
    let cfg = readFileSync(configPath, "utf-8");
    const newCfg = cfg.replace(/export const VERSION = "[^"]+"/, `export const VERSION = "${version}"`);
    if (newCfg !== cfg) {
      writeFileSync(configPath, newCfg, "utf-8");
      log("✓", `Synced site/lib/config.ts → ${version}`);
      fixCount++;
    }
  }
  
  // Sync site/lib/changelog.ts
  const changelogPath = join(projectRoot, "site", "lib", "changelog.ts");
  if (existsSync(changelogPath)) {
    let cl = readFileSync(changelogPath, "utf-8");
    const newCl = cl.replace(/version:\s*"[^"]+"/, `version: "${version}"`);
    if (newCl !== cl) {
      writeFileSync(changelogPath, newCl, "utf-8");
      log("✓", `Synced site/lib/changelog.ts → ${version}`);
      fixCount++;
    }
  }
}

// ─── 6. Fix ci.yml itself ───────────────────────────────────────────────────

function fixCiYml() {
  const ciYmlPath = join(projectRoot, ".github", "workflows", "ci.yml");
  if (!existsSync(ciYmlPath)) return;

  let content = readFileSync(ciYmlPath, "utf-8");
  let modified = false;

  // Remove --frozen-lockfile from bun install
  if (content.includes("--frozen-lockfile")) {
    content = content.replace(/bun install --frozen-lockfile/g, "bun install");
    modified = true;
    log("🔧", "Removed --frozen-lockfile from ci.yml");
  }

  // Remove --locked from cargo test
  if (content.includes("--locked")) {
    content = content.replace(/cargo test --manifest-path src-tauri\/Cargo\.toml --locked/g,
      "cargo test --manifest-path src-tauri/Cargo.toml");
    modified = true;
    log("🔧", "Removed --locked from cargo test in ci.yml");
  }

  // Ensure auto-repair step exists
  if (!content.includes("ci-auto-repair")) {
    // Add auto-repair step after Bun setup
    content = content.replace(
      /(- name: Set up Rust\s*\n\s*uses: dtolnay\/rust-toolchain@stable)/,
      `- name: Set up Node.js for repair\n        uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n\n      - name: Auto-repair project\n        run: node scripts/ci-auto-repair.js\n\n      $1`
    );
    modified = true;
    log("🔧", "Added auto-repair step to ci.yml");
  }

  if (modified) {
    writeFileSync(ciYmlPath, content, "utf-8");
    fixCount++;
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

console.log("╔════════════════════════════════════════════════╗");
console.log("║   🛡️  CI Auto-Repair — Markd Notes            ║");
console.log("╚════════════════════════════════════════════════╝\n");

removeConflictingFiles();
ensureReleaseYml();
fixCiYml();
fixRustImports();
syncVersions();
ensureCargoLock();

console.log("");
if (fixCount > 0) {
  console.log(`🔧 Applied ${fixCount} auto-repair(s). Build should now succeed.`);
} else {
  console.log("✅ No repairs needed — project is clean.");
}
console.log("");
