/* Catalog behavior in a minimal DOM harness. This is not a browser renderer. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const canonical = JSON.parse(fs.readFileSync(path.join(root, 'content/asanas.json'), 'utf8'));
const imageMetadata = JSON.parse(fs.readFileSync(path.join(root, 'content/images.json'), 'utf8'));
const previousIDs = ['tadasana','sukhasana','shavasana','balasana','vajrasana','marjaryasana','bitilasana','dandasana','baddha-konasana','bhujangasana','makarasana','adho-mukha-svanasana','vrikshasana','utkatasana','virabhadrasana-2','trikonasana','parsvakonasana','setu-bandhasana','paschimottanasana','ardha-matsyendrasana','salabhasana','dhanurasana','ustrasana','garudasana','bakasana','sirsasana'];
const results = [];
function test(name, run) {
  try { run(); results.push({name,status:'passed'}); console.log('PASS ' + name); }
  catch (error) { results.push({name,status:'failed',error:error.stack}); console.error('FAIL ' + name + '\n' + error.stack); }
}
const {harness}=require('./helpers/help-harness.cjs');

test('Catalog has 200 distinct complete poses and preserves all original 100 names, IDs and levels',()=>{
  assert.equal(canonical.length,200);
  assert.equal(new Set(canonical.map(p=>p.id)).size,200);
  assert.equal(new Set(canonical.map(p=>p.imageKey)).size,200);
  assert.equal(new Set(canonical.map(p=>p.russian.trim().toLocaleLowerCase('ru'))).size,200,'No duplicate Russian position names');
  assert.equal(new Set(canonical.map(p=>p.hindi.trim())).size,200,'No duplicate Devanagari position names');
  assert.equal(new Set(canonical.map(p=>p.order)).size,200);
  for(const id of previousIDs)assert.ok(canonical.some(p=>p.id===id),'Preserved '+id);
  for(const original of JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/catalog-original-100.json'),'utf8'))){
    const preserved=canonical.find(p=>p.id===original.id);assert.ok(preserved,original.id);
    for(const key of ['level','russian','hindi'])assert.equal(preserved[key],original[key],'Original '+original.id+' '+key);
  }
  assert.deepEqual([1,2,3].map(level=>canonical.filter(p=>p.level===level).length),[80,70,50]);
  for(const p of canonical){
    assert.match(p.id,/^[a-z0-9-]+$/);
    for(const field of ['russian','transcription','summary','modifications','caution','duration'])assert.ok(typeof p[field]==='string'&&p[field].trim(),p.id+' '+field);
    assert.match(p.hindi,/[\u0900-\u097f]/,p.id+' Devanagari name');
    assert.match(p.transcription,/[А-Яа-яЁё]/,p.id+' Russian pronunciation');
    assert.ok(Array.isArray(p.steps)&&p.steps.length>=3,p.id+' technique steps');
    assert.ok(Array.isArray(p.attention)&&p.attention.length>=2,p.id+' attention points');
    assert.ok(p.sources.length>0,p.id+' sources');
    for(const source of p.sources){assert.ok(source.title);assert.equal(new URL(source.url).protocol,'https:');}
  }
  const ctx=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(dist,'asanas.js'),'utf8'),ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.window.YOGA_ASANAS)),canonical);
});
test('All view groups 200 cards into 80 easy, 70 medium and 50 hard entries',()=>{
  const a=harness();assert.equal(a.cards().length,200);assert.equal(a.groupCount(),3);
  assert.match(a.el('asanaCount').textContent,/200 из 200/);
  for(const [number,name,count] of [[1,'Лёгкий',80],[2,'Средний',70],[3,'Тяжёлый',50]]){
    assert.match(a.el('asanaList').innerHTML,new RegExp('id="asana-level-'+number+'"><span>'+name+'<\\/span><span class="level-badge level-'+number+'">'+count+'<'));
    a.level(number).click();assert.equal(a.cards().length,count);assert.equal(a.groupCount(),1);
    assert.ok(a.cards().every(card=>canonical.find(p=>p.id===card.dataset.id).level===number));
    a.level('all').click();
  }
});
test('Russian and Devanagari search combine correctly with difficulty and handle empty results',()=>{
  const a=harness();
  const pose=canonical.find(p=>p.id==='tadasana');
  a.search(pose.hindi);assert.deepEqual(a.cards().map(card=>card.dataset.id),canonical.filter(p=>[p.russian,p.hindi,p.transcription,p.sanskritLatin,p.summary].join(' ').includes(pose.hindi)).sort((a,b)=>a.level-b.level||a.order-b.order).map(p=>p.id));
  a.level(3).click();assert.equal(a.cards().length,0);assert.equal(a.groupCount(),0);assert.match(a.el('asanaList').innerHTML,/Асаны не найдены/);
  a.level('all').click();a.search('');assert.equal(a.cards().length,200);
  const added=canonical.find(p=>p.id==='urdhva-hastasana');
  a.search(added.transcription.toLocaleUpperCase('ru'));assert.ok(a.cards().some(card=>card.dataset.id===added.id));
  a.search('нет такой асаны 123');assert.equal(a.cards().length,0);
});
test('A new advanced pose opens full instructions and its own anatomical art; favorites survive reopening',()=>{
  const shared=new Map(),a=harness(shared);
  const pose=canonical.find(p=>p.id==='yoganidrasana');
  a.search(pose.hindi);assert.equal(a.cards().length,1);a.cards()[0].click();
  assert.equal(a.el('asanaDetail').style.display,'');
  const detail=a.el('asanaDetail').innerHTML;
  for(const text of [pose.russian,pose.hindi,pose.transcription,'Как выполнять','На что обратить внимание','Упрощение и опоры','Осторожность','Подробнее о технике'])assert.ok(detail.includes(text),text);
  const image=imageMetadata[pose.imageKey];assert.ok(image&&detail.includes(image.path));
  assert.match(detail,/role="img"/);assert.match(detail,/Тяжёлый/);
  a.el('asanaFavorite').click();assert.equal(a.el('asanaFavorite').getAttribute('aria-pressed'),'true');
  a.el('helpBack').click();a.search('');a.el('asanaFavorites').click();assert.equal(a.cards().length,1);
  const b=harness(shared);b.el('asanaFavorites').click();assert.equal(b.cards().length,1);assert.equal(b.cards()[0].dataset.id,pose.id);
});
test('Every pose has a unique in-bounds anatomical cell, without external image dependencies',()=>{
  assert.equal(Object.keys(imageMetadata).length,200);
  const cells=new Set(),paths=new Set();
  for(const pose of canonical){
    const image=imageMetadata[pose.imageKey];assert.ok(image,pose.id);
    assert.equal(image.kind,'generated-anatomy');assert.ok(image.path.startsWith('images/anatomy/'));
    assert.ok(image.column>=0&&image.column<image.columns&&image.row>=0&&image.row<image.rows);
    const cell=[image.path,image.column,image.row].join(':');assert.ok(!cells.has(cell),'Unique '+pose.id);cells.add(cell);paths.add(image.path);
  }
  assert.equal(cells.size,200);assert.equal(paths.size,35);
});

fs.writeFileSync(path.join(__dirname,'catalog-results.json'),JSON.stringify({engine:'Node.js VM with minimal DOM',note:'Catalog behavior and data validation only; no browser rendering, Safari or device execution',results},null,2)+'\n');
if(results.some(result=>result.status==='failed'))process.exitCode=1;
