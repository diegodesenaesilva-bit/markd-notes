const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const tag = process.env.GITHUB_REF_NAME || 'v0.1.7';
const ver = tag.replace(/^v/, '');

// Find actual built setup exe path
let setupExePath = `src-tauri/target/release/bundle/nsis/Markd_${ver}_x64-setup.exe`;
if (!fs.existsSync(setupExePath)) {
  setupExePath = `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/Markd_${ver}_x64-setup.exe`;
}

const privateKey = `RWRTY0IyFfgMUpeiYexiguyOtqcC9yxkBZFC0V1EsKGqvpLF1N8AABAAAAAAAAAAAAIAAAAAaHsPP9dDAuNWjvx/T0oYpbHXEOmIPABwzzhRkDZRPtSTf1HpwndTix1CpHhTc6bOU9jnVbtrVnZU7bWUyqM5kFodykjvGQMsrPzbhA0Ee/dGtE5f6MXcpwS8xxb2PSSWv9JhIVOXB+w=`;

// Sign installer using environment variable
let signature = '';
try {
  const signOutput = cp.execSync(`npx tauri signer sign "${setupExePath}" -p markdkey2026`, {
    encoding: 'utf8',
    env: {
      ...process.env,
      TAURI_SIGNING_PRIVATE_KEY: privateKey,
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: 'markdkey2026'
    }
  });
  signature = signOutput.trim();
} catch (e) {
  console.error('Failed to sign with tauri signer:', e.message);
  if (e.stdout) console.log('Stdout:', e.stdout);
}

// Generate latest.json
const manifest = {
  version: tag,
  notes: `Markd ${tag}`,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: signature,
      url: `https://github.com/diegodesenaesilva-bit/markd-notes/releases/download/${tag}/Markd_${ver}_x64-setup.exe`
    }
  }
};

fs.writeFileSync('latest.json', JSON.stringify(manifest, null, 2), 'utf8');
console.log('Successfully generated signed latest.json:');
console.log(JSON.stringify(manifest, null, 2));
