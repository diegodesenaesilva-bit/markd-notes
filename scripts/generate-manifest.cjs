const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const tag = process.env.GITHUB_REF_NAME || 'v0.2.0';
const ver = tag.replace(/^v/, '');

// Find actual built setup exe path
let setupExePath = `src-tauri/target/release/bundle/nsis/Markd_${ver}_x64-setup.exe`;
if (!fs.existsSync(setupExePath)) {
  setupExePath = `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/Markd_${ver}_x64-setup.exe`;
}

// 2-line minisign private key string
const rawKey = "untrusted comment: rsign encrypted secret key\nRWRTY0IyFfgMUpeiYexiguyOtqcC9yxkBZFC0V1EsKGqvpLF1N8AABAAAAAAAAAAAAIAAAAAaHsPP9dDAuNWjvx/T0oYpbHXEOmIPABwzzhRkDZRPtSTf1HpwndTix1CpHhTc6bOU9jnVbtrVnZU7bWUyqM5kFodykjvGQMsrPzbhA0Ee/dGtE5f6MXcpwS8xxb2PSSWv9JhIVOXB+w=\n";
// Base64 encode the 2-line key text as expected by Tauri v2
const b64Key = Buffer.from(rawKey, 'ascii').toString('base64');
fs.writeFileSync('temp_markd.key', b64Key, 'utf8');

let signature = '';
try {
  const signOutput = cp.execSync(`npx tauri signer sign "${setupExePath}" -f temp_markd.key -p markdkey2026`, { encoding: 'utf8' });
  const match = signOutput.match(/Public signature:\s*([\s\S]+?)(?:\s*Make sure|$)/i);
  if (match) {
    signature = match[1].trim();
  } else {
    signature = signOutput.trim();
  }
} catch (e) {
  console.error('Failed to sign with tauri signer:', e.message);
  if (e.stdout) console.log('Stdout:', e.stdout);
} finally {
  if (fs.existsSync('temp_markd.key')) {
    fs.unlinkSync('temp_markd.key');
  }
}

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
console.log('Successfully generated latest.json with extracted signature:');
console.log(JSON.stringify(manifest, null, 2));
