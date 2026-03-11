const fs = require('fs');
const app = fs.readFileSync('public/js/app.js', 'utf8');
const html = fs.readFileSync('public/dashboard.html', 'utf8');
const regex = /getElementById\(['"]([^'"]+)['"]\)/g;
let match;
let ids = [];
while ((match = regex.exec(app)) !== null) {
  ids.push(match[1]);
}
const missing = ids.filter(id => !html.includes('id="' + id + '"') && !html.includes("id='" + id + "'"));
console.log([...new Set(missing)]);
