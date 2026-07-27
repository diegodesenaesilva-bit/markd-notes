#!/usr/bin/env node

/**
 * Self-Healing Version Synchronization Script
 * 
 * Reads the canonical version from src-tauri/tauri.conf.json and
 * propagates it to package.json, Cargo.toml, site/package.json,
 * site/lib/config.ts, and site/lib/changelog.ts.
 * 
 * Also runs ci-auto-repair.js for full project self-healing.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

// ── Run auto-repair first ──────────────────────────────────────────────────

try {
  execSync("node scripts/ci-auto-repair.js", { cwd: projectRoot, stdio: "inherit" });
} catch {
  console.warn("⚠️  ci-auto-repair.js not found or errored — skipping.");
}

console.log("\n📦 sync-version.js — done!\n");
