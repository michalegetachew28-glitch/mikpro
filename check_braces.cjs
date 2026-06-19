const fs = require('fs');
const content = fs.readFileSync('c:/Users/hp/OneDrive/Desktop/GARAGE/src/data/translations.js', 'utf8');

function checkBraces(text) {
  let stack = [];
  let map = {
    '(': ')',
    '[': ']',
    '{': '}'
  };

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(' || text[i] === '[' || text[i] === '{') {
      stack.push({char: text[i], pos: i, line: text.substring(0, i).split('\n').length});
    } else if (text[i] === ')' || text[i] === ']' || text[i] === '}') {
      let last = stack.pop();
      if (!last || map[last.char] !== text[i]) {
        console.log(`Mismatched ${text[i]} at line ${text.substring(0, i).split('\n').length}`);
        return false;
      }
    }
  }
  if (stack.length > 0) {
    console.log(`Unclosed ${stack[0].char} at line ${stack[0].line}`);
    return false;
  }
  console.log("Braces match!");
  return true;
}

checkBraces(content);
