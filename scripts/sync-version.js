#!/usr/bin/env node

/**
 * Version Synchronization Script
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

function readJsonFile(filePath) {
  try {
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content.replace(/^\uFEFF/, ""));
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    process.exit(1);
  }
}

function writeJsonFile(filePath, data) {
  try {
    const content = JSON.stringify(data, null, 2) + "\n";
    writeFileSync(filePath, content, "utf-8");
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error.message);
    process.exit(1);
  }
}

function updateCargoToml(filePath, version) {
  try {
    let content = readFileSync(filePath, "utf-8");
    const versionRegex = /^(\s*version\s*=\s*")[^"]+(".*)$/m;
    if (versionRegex.test(content)) {
      content = content.replace(versionRegex, `$1${version}$2`);
      writeFileSync(filePath, content, "utf-8");
      console.log(`✓ Updated Cargo.toml version to ${version}`);
    }
  } catch (error) {
    console.error(`Error updating Cargo.toml:`, error.message);
  }
}

function updatePackageJson(filePath, version) {
  if (!existsSync(filePath)) return;
  try {
    const packageJson = readJsonFile(filePath);
    if (packageJson.version !== version) {
      packageJson.version = version;
      writeJsonFile(filePath, packageJson);
      console.log(`✓ Updated ${filePath} version to ${version}`);
    }
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error.message);
  }
}

function updateSiteConfig(filePath, version) {
  if (!existsSync(filePath)) return;
  try {
    let content = readFileSync(filePath, "utf-8");
    content = content.replace(/export const VERSION = "[^"]+"/, `export const VERSION = "${version}"`);
    writeFileSync(filePath, content, "utf-8");
    console.log(`✓ Updated site/lib/config.ts version to ${version}`);
  } catch (error) {
    console.error(`Error updating site config:`, error.message);
  }
}

function updateSiteChangelog(filePath, version) {
  if (!existsSync(filePath)) return;
  try {
    let content = readFileSync(filePath, "utf-8");
    content = content.replace(/version:\s*"[^"]+"/, `version: "${version}"`);
    writeFileSync(filePath, content, "utf-8");
    console.log(`✓ Updated site/lib/changelog.ts version to ${version}`);
  } catch (error) {
    console.error(`Error updating site changelog:`, error.message);
  }
}

function syncVersion() {
  console.log("🔄 Syncing version across configuration files...\n");

  const tauriConfPath = join(projectRoot, "src-tauri", "tauri.conf.json");
  const tauriConf = readJsonFile(tauriConfPath);
  const version = tauriConf.version;

  if (!version) {
    console.error("❌ No version found in tauri.conf.json");
    process.exit(1);
  }

  console.log(`📦 Source version from tauri.conf.json: ${version}\n`);

  updatePackageJson(join(projectRoot, "package.json"), version);
  updateCargoToml(join(projectRoot, "src-tauri", "Cargo.toml"), version);
  updatePackageJson(join(projectRoot, "site", "package.json"), version);
  updateSiteConfig(join(projectRoot, "site", "lib", "config.ts"), version);
  updateSiteChangelog(join(projectRoot, "site", "lib", "changelog.ts"), version);

  console.log("\n✅ Version synchronization complete!");
  console.log(`   All files now use version: ${version}\n`);
}

syncVersion();
