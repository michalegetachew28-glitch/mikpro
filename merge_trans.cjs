const fs = require('fs');

const extracted = JSON.parse(fs.readFileSync('./extracted_pairs.json', 'utf8'));

const content = fs.readFileSync('./src/data/translations.js', 'utf8');
const code = content.replace('export const translations =', 'return') + ';';
const trans = new Function(code)();

// Add missing pairs to dictionaries
for (const [eng, amh] of Object.entries(extracted)) {
  if (!trans.en[eng]) trans.en[eng] = eng;
  if (!trans.am[eng]) trans.am[eng] = amh;
  if (!trans.om[eng]) trans.om[eng] = eng; // default English for now
  if (!trans.so[eng]) trans.so[eng] = eng;
  if (!trans.ti[eng]) trans.ti[eng] = eng;
}

fs.writeFileSync('./src/data/translations.js', 'export const translations = ' + JSON.stringify(trans, null, 2) + ';\n');
console.log('Translations updated with ' + Object.keys(extracted).length + ' extracted pairs.');
