const fs = require('fs');

const tag = process.env.GITHUB_REF_NAME || 'v0.2.1';
const ver = tag.replace(/^v/, '');

const manifest = {
  version: tag,
  notes: `Markd ${tag}`,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      url: `https://github.com/diegodesenaesilva-bit/markd-notes/releases/download/${tag}/Markd_${ver}_x64-setup.exe`
    }
  }
};

// Write latest.json strictly without UTF-8 BOM
fs.writeFileSync('latest.json', JSON.stringify(manifest, null, 2), 'utf8');
console.log('Successfully generated latest.json without UTF-8 BOM:');
console.log(JSON.stringify(manifest, null, 2));
