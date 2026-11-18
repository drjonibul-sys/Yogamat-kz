/* Content and navigation checks in Node VM; not a browser or physical iPad. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {harness}=require('./helpers/help-harness.cjs');
const root=path.resolve(__dirname,'..');
const plans=JSON.parse(fs.readFileSync(path.join(root,'content/practices.json'),'utf8'));
const poses=JSON.parse(fs.readFileSync(path.join(root,'content/asanas.json'),'utf8'));
const results=[];
function test(name,run){try{run();results.push({name,status:'passed'});console.log('PASS '+name);}catch(error){results.push({name,status:'failed',error:error.stack});console.error('FAIL '+name+'\n'+error.stack);}}
test('15 complete plans: three regular per level, three for each adjacent transition; exact totals <=75',()=>{
 assert.equal(plans.length,15);assert.equal(new Set(plans.map(p=>p.id)).size,15);
 for(const n of [1,2,3])assert.equal(plans.filter(p=>p.level===n&&p.kind==='regular').length,3);
 for(const n of [2,3])assert.equal(plans.filter(p=>p.level===n&&p.kind==='transition').length,3);
 assert.equal(plans.filter(p=>p.level===1&&p.kind==='transition').length,0);
 for(const p of plans){
  for(const k of ['title','goal','suitable','equipment','coverPose'])assert.ok(p[k]&&typeof p[k]==='string',p.id+' '+k);
  assert.ok(p.focus.length>=3);assert.ok(p.stages.length>=7);
  assert.ok(p.durationMinutes>0&&p.durationMinutes<=75,p.id+' total');
  assert.equal(p.durationMinutes,p.stages.reduce((sum,s)=>sum+s.minutes,0),p.id+' total includes all stages');
  assert.ok(poses.some(x=>x.id===p.coverPose));
  if(p.kind==='transition')assert.ok(p.readiness.length>100,p.id+' explicit readiness criteria');
  for(const s of p.stages){
   assert.ok(Number.isInteger(s.minutes)&&s.minutes>0);
   assert.ok(s.title.trim(),p.id+' stage title');
   for(const k of ['action','technique','sensations','adaptation'])assert.ok(typeof s[k]==='string'&&s[k].trim().length>0,p.id+' stage '+k);
   assert.ok(s.poses.length>0);for(const id of s.poses)assert.ok(poses.some(x=>x.id===id),p.id+' existing pose '+id);
  }
  assert.ok(p.stages.at(-1).poses.some(id=>id==='shavasana'||id==='shavasana-knees-bent'),'Concluding rest for '+p.id);
 }
 const context=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(root,'dist/practices.js'),'utf8'),context);
 assert.deepEqual(JSON.parse(JSON.stringify(context.window.YOGA_PRACTICES)),plans);
});
test('Tabs follow marked progression; all-practices list retains transitional groups first',()=>{
 const a=harness();a.query('[data-help-view]').find(x=>x.dataset.helpView==='practices').click();
 assert.equal(a.el('helpCatalog').style.display,'none');assert.equal(a.el('helpPractices').style.display,'');
 const groups=[['1-2',2,'transition','Переход с лёгкого на средний уровень'],['2-3',3,'transition','Переход со среднего на тяжёлый уровень'],['1',1,'regular','Лёгкая'],['2',2,'regular','Средняя'],['3',3,'regular','Тяжёлая']];
 assert.deepEqual(a.query('[data-practice-group]').map(x=>x.dataset.practiceGroup),groups.map(g=>g[0]));
 assert.deepEqual(a.query('[data-practice-level]').map(x=>x.dataset.practiceLevel),['all','1','1-2','2','2-3','3']);
 assert.deepEqual(a.query('[data-practice-id]').map(x=>x.dataset.practiceId),groups.flatMap(g=>plans.filter(p=>p.level===g[1]&&p.kind===g[2]).map(p=>p.id)));
 for(const [key,level,kind,title] of groups){
  const filter=a.query('[data-practice-level]').find(x=>x.dataset.practiceLevel===key);filter.click();
  assert.equal(filter.getAttribute('aria-pressed'),'true');assert.equal(a.query('[data-practice-id]').length,3);
  assert.deepEqual(a.query('[data-practice-group]').map(x=>x.dataset.practiceGroup),[key]);
  assert.ok(a.el('practiceList').innerHTML.includes(title));
  assert.ok(a.query('[data-practice-id]').every(x=>{const p=plans.find(p=>p.id===x.dataset.practiceId);return p.level===level&&p.kind===kind;}));
 }
 a.query('[data-practice-level]').find(x=>x.dataset.practiceLevel==='all').click();
 assert.equal(a.query('[data-practice-id]').length,15);
 assert.equal(new Set(a.query('[data-practice-id]').map(x=>x.dataset.practiceId)).size,15);
 a.query('[data-help-view]').find(x=>x.dataset.helpView==='asanas').click();assert.equal(a.cards().length,200);
});
test('Every plan renders a contiguous timeline, body cues, adaptations and links to valid asanas',()=>{
 const a=harness();
 for(const p of plans){
  a.query('[data-practice-id]').find(x=>x.dataset.practiceId===p.id).click();
  const html=a.el('practiceDetail').innerHTML;
  assert.equal(a.el('practiceDetail').style.display,'');
  for(const text of [p.title,'Основные аспекты','Техника','Ощущения и внимание','Как упростить',`Итого: ${p.durationMinutes} минут`])assert.ok(html.includes(text),p.id+' '+text);
  const times=[...html.matchAll(/class="practice-time">(\d+):00–(\d+):00</g)].map(m=>[+m[1],+m[2]]);
  assert.equal(times.length,p.stages.length);assert.equal(times[0][0],0);assert.equal(times.at(-1)[1],p.durationMinutes);
  times.forEach((v,i)=>{assert.equal(v[1]-v[0],p.stages[i].minutes);if(i)assert.equal(v[0],times[i-1][1]);});
  assert.equal(a.query('[data-practice-pose]').length,p.stages.reduce((sum,s)=>sum+s.poses.length,0));
  a.el('practiceBack').click();assert.equal(a.el('helpPractices').style.display,'');
 }
});
test('Asana detail returns to its originating practice and scroll position; help navigation retains section',()=>{
 const a=harness();const p=plans.find(p=>p.kind==='transition'&&p.level===3);
 a.query('[data-help-view]').find(x=>x.dataset.helpView==='practices').click();
 a.query('[data-practice-id]').find(x=>x.dataset.practiceId===p.id).click();
 a.context.scrollY=850;const poseButton=a.query('[data-practice-pose]')[0];poseButton.click();
 assert.equal(a.el('asanaDetail').style.display,'');assert.equal(a.el('practiceDetail').style.display,'none');
 assert.match(a.el('asanaDetail').innerHTML,/К практике/);
 a.el('helpBack').click();assert.ok(a.el('practiceDetail').innerHTML.includes(p.title));assert.equal(a.context.scrollY,850);
 a.el('practiceBackBottom').click();a.context.showPage('dashboard');a.helpTab().click();
 assert.equal(a.el('helpPractices').style.display,'');assert.equal(a.el('asanaDetail').style.display,'none');
 a.query('[data-help-view]').find(x=>x.dataset.helpView==='asanas').click();
 a.cards()[0].click();assert.match(a.el('asanaDetail').innerHTML,/К справочнику/);a.el('helpBack').click();
 assert.equal(a.el('helpCatalog').style.display,'');
});
fs.writeFileSync(path.join(__dirname,'practices-results.json'),JSON.stringify({engine:'Node.js VM with minimal DOM',note:'No browser rendering or physical iPad testing',results},null,2)+'\n');
if(results.some(x=>x.status==='failed'))process.exitCode=1;
