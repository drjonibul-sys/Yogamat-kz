// Версия приложения: единый номер в константе и в подписи, формат MAJOR.MINOR.PATCH, подпись разработчика.
const fs=require('fs'),assert=require('assert'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
const v=html.match(/const APP_VERSION = '([^']+)'/);
assert.ok(v,'APP_VERSION not found');
assert.match(v[1],/^\d+\.\d+\.\d+$/);
assert.ok(html.includes('<div id="appVersionLabel">Версия: '+v[1]+'</div>'),'label differs from APP_VERSION');
assert.ok(html.includes('<em>Разработано Yogamat.kz</em>'));
const team=fs.readFileSync(path.join(__dirname,'../dist/team.js'),'utf8');
assert.ok(team.includes('placeFooter'),'footer is not placed on every page');
console.log('version-check ok',v[1]);
