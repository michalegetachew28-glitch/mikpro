const fs = require('fs');
const path = require('path');

const srcDir = './src';
const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else if (dirFile.endsWith('.jsx')) {
      filelist.push(dirFile);
    }
  });
  return filelist;
};

const files = walkSync(srcDir);
const extracted = {};

// Regex to match language === 'en' ? 'Eng' : 'Amh'
const regex = /language\s*===\s*['"]en['"]\s*\?\s*(['"])(.*?)\1\s*:\s*(['"])(.*?)\3/g;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  content = content.replace(regex, (match, q1, eng, q2, amh) => {
    extracted[eng] = amh;
    changed = true;
    return `t("${eng.replace(/"/g, '\\"')}")`;
  });

  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Updated:', file);
  }
});

console.log('Extracted pairs:', Object.keys(extracted).length);
fs.writeFileSync('./extracted_pairs.json', JSON.stringify(extracted, null, 2));
