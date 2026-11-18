/* Node DOM stubs exercise status decisions, not Safari installation itself. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../dist/pwa.js'),'utf8');
const results=[];
function page(options={}) {
  const elements=new Map(),events=new Map(),swEvents=new Map(),posts=[];
  function element(){return {innerHTML:'',textContent:'',hidden:false,disabled:false,value:0,max:1,dataset:{},style:{setProperty(){}},classList:{contains(){return false;}},listeners:new Map(),addEventListener(n,f){this.listeners.set(n,f);},setAttribute(){},after(){},append(){}};}
  const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  let cacheStatus={ready:true,coreReady:true,version:'test',loaded:61,total:61,...options.status};
  const worker={postMessage(message,ports){posts.push(message);if(message.type==='CACHE_STATUS')queueMicrotask(()=>ports[0].onmessage({data:cacheStatus}));},addEventListener(){}};
  const registration={active:worker,waiting:null,addEventListener(){},async update(){}};
  const navigator={standalone:options.installed===true,onLine:true,serviceWorker:{controller:worker,ready:Promise.resolve(registration),addEventListener(n,f){swEvents.set(n,f);},async register(){if(options.registrationFailure)throw Error('network');return registration;}}};
  const context={navigator,document:{documentElement:get('root'),body:get('body'),getElementById:get,createElement:element,querySelector:get,addEventListener(n,f){events.set('document:'+n,f);}},location:{protocol:'https:',reload(){}},isSecureContext:true,matchMedia(){return {matches:options.mediaInstalled===true};},addEventListener(n,f){events.set(n,f);},MessageChannel:class {constructor(){this.port1={close(){}};this.port2=this.port1;}},setTimeout(){return 1;},clearTimeout(){},queueMicrotask,archiveHtml(){return '';},openSheet(){},closeSheet(){},showToast(){},confirm(){return true;},console};
  context.window=context;vm.createContext(context);vm.runInContext(source,context);
  return {get,navigator,posts,registration,events,async settle(){for(let i=0;i<6;i++)await Promise.resolve();},message(data){cacheStatus={...cacheStatus,...data};swEvents.get('message')({data:{type:'CACHE_STATUS',...cacheStatus}});}};
}
async function test(name,run){try{await run();results.push({name,status:'passed'});console.log('PASS '+name);}catch(error){results.push({name,status:'failed',error:error.stack});console.error('FAIL '+name+'\n'+error.stack);}}
(async()=>{
  await test('Home-screen launch is identified independently from network and cache readiness',async()=>{
    for(const options of [{installed:true},{mediaInstalled:true}]){
      const p=page(options);await p.settle();
      assert.equal(p.get('pwaLaunchStatus').textContent,'Приложение с домашнего экрана');
      assert.match(p.get('pwaOfflineStatus').textContent,/Готово к работе без интернета/);
      p.navigator.onLine=false;p.events.get('offline')();
      assert.match(p.get('pwaOfflineStatus').textContent,/Без подключения/);
      assert.equal(p.get('pwaLaunchStatus').textContent,'Приложение с домашнего экрана');
    }
    const p=page();await p.settle();
    assert.equal(p.get('pwaLaunchStatus').textContent,'Открыто во вкладке браузера');
    assert.match(p.get('pwaOfflineStatus').textContent,/Готово к работе без интернета/,'A browser tab may also be ready offline');
  });
  await test('Partial copy starts image loading and shows progress without claiming full readiness',async()=>{
    const p=page({status:{ready:false,coreReady:true,loaded:26,total:61}});await p.settle();
    assert.ok(p.posts.some(m=>m.type==='PREPARE_OFFLINE'));
    p.message({ready:false,preparing:true,loaded:37,total:61});
    assert.equal(p.get('pwaDownloadProgress').value,37);
    assert.equal(p.get('pwaDownloadProgress').max,61);
    assert.equal(p.get('pwaDownloadProgress').hidden,false);
    assert.equal(p.get('pwaDownload').disabled,true);
    assert.match(p.get('pwaOfflineStatus').textContent,/37 из 61/);
    assert.doesNotMatch(p.get('pwaOfflineStatus').textContent,/Готово к работе/);
    p.message({ready:true,preparing:false,loaded:61});
    assert.equal(p.get('pwaDownloadProgress').hidden,true);
    assert.equal(p.get('pwaDownload').hidden,true);
  });
  await test('Failed download offers retry and storage failure has a distinct explanation',async()=>{
    const p=page({status:{ready:false,coreReady:true,loaded:26}});await p.settle();
    p.message({ready:false,preparing:false,error:'network'});
    assert.equal(p.get('pwaDownload').hidden,false);assert.equal(p.get('pwaDownload').disabled,false);
    assert.match(p.get('pwaDownload').textContent,/Повторить/);
    assert.match(p.get('pwaOfflineStatus').textContent,/Загрузка прервалась/);
    p.message({error:'storage'});
    assert.match(p.get('pwaOfflineStatus').textContent,/Недостаточно места/);
    await p.get('pwaDownload').listeners.get('click')();
    assert.ok(p.posts.filter(m=>m.type==='PREPARE_OFFLINE').length>=2);
  });
  await test('Registration failure retains an accessible retry and installation instructions',async()=>{
    const p=page({registrationFailure:true});await p.settle();
    assert.match(p.get('pwaOfflineStatus').textContent,/Автономная работа пока недоступна/);
    assert.equal(p.get('pwaDownload').hidden,false);
    assert.equal(p.get('pwaDownload').disabled,false);
    assert.equal(p.get('pwaInstallHelp').textContent,'На главный экран');
  });
  fs.writeFileSync(path.join(__dirname,'pwa-ui-results.json'),JSON.stringify({engine:'Node.js VM with minimal DOM stubs',note:'No physical iPad or browser installation exercised',results},null,2)+'\n');
  if(results.some(r=>r.status==='failed'))process.exitCode=1;
})();
