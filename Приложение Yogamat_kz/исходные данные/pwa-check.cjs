/* Node-only checks. No browser, preview server or iOS installation is emulated. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dist = path.resolve(__dirname, '../dist');
const poses = JSON.parse(fs.readFileSync(path.resolve(dist,'../content/asanas.json'),'utf8'));
const images = JSON.parse(fs.readFileSync(path.resolve(dist,'../content/images.json'),'utf8'));
const imagePaths = [...new Set(poses.map(pose => images[pose.imageKey].path))];
const sampleImagePath = images[poses[0].imageKey].path;
const origin = 'https://yoga.example.test';
const scope = origin + '/practice/';
const results = [];
async function test(name, run) {
  try { await run(); results.push({name,status:'passed'}); console.log('PASS '+name); }
  catch (error) { results.push({name,status:'failed',error:error.stack}); console.error('FAIL '+name+'\n'+error.stack); }
}
function fileResponse(url, options={}) {
  const u = new URL(url, scope);
  const relative = u.pathname.slice(new URL(scope).pathname.length) || 'index.html';
  const file = path.resolve(dist, relative);
  if (!file.startsWith(dist+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    const r = new Response('missing', {status:404}); Object.defineProperty(r,'url',{value:u.href}); return r;
  }
  const mime = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf'};
  const r = new Response(fs.readFileSync(file), {status:200, headers:{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}});
  Object.defineProperty(r,'url',{value:u.href});
  return r;
}
function workerHarness(options={}) {
  const listeners = new Map(), stores = options.stores || new Map(), networkCalls=[], messages=[];
  const key = request => new URL(typeof request === 'string' ? request : request.url, scope).href;
  function responseCopy(response) {
    const clone = response.clone();
    Object.defineProperty(clone,'url',{value:response.url});
    Object.defineProperty(clone,'redirected',{value:response.redirected});
    return clone;
  }
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name,new Map());
      const data=stores.get(name);
      return {
        async put(request,response){data.set(key(request),responseCopy(response));},
        async match(request,settings={}) {
          const target=key(request);
          for (const [url,value] of data) {
            if (url===target || (settings.ignoreSearch && new URL(url).origin+new URL(url).pathname===new URL(target).origin+new URL(target).pathname)) return responseCopy(value);
          }
        },
        async delete(request){return data.delete(key(request));},
        async keys(){return [...data.keys()].map(url=>new Request(url));},
        async addAll(requests) {
          const responses=await Promise.all(requests.map(async request=>{const r=await network(request); if(!r.ok)throw new Error('Cache addAll failed'); return r;}));
          for(let i=0;i<requests.length;i++)data.set(key(requests[i]),responseCopy(responses[i]));
        }
      };
    },
    async keys(){return [...stores.keys()];},
    async delete(name){return stores.delete(name);},
    async match(request,settings){for(const name of stores.keys()){const r=await (await this.open(name)).match(request,settings);if(r)return r;}}
  };
  let offline=false, skipCalls=0, claimCalls=0;
  async function network(request) {
    const url=key(request); networkCalls.push(url);
    if(offline)throw new TypeError('Network is offline');
    if(options.fetch)return options.fetch(url,request);
    return fileResponse(url);
  }
  const self = {
    location:{origin,href:scope+'sw.js'},registration:{scope},
    addEventListener(type,listener){listeners.set(type,listener);},
    async skipWaiting(){skipCalls++;},
    clients:{async claim(){claimCalls++;},async matchAll(){return [{postMessage(m){messages.push(m);}}];}}
  };
  const context=vm.createContext({self,caches,fetch:network,URL,Request,Response,Headers,AbortController,console,Promise,Set,Map,JSON,Date,Uint8Array,TextEncoder,setTimeout,clearTimeout});
  vm.runInContext(fs.readFileSync(path.join(dist,'sw.js'),'utf8'),context,{filename:'sw.js'});
  async function dispatch(type, extra={}) {
    const waits=[]; let response;
    const event={waitUntil(p){waits.push(Promise.resolve(p));},respondWith(p){response=Promise.resolve(p);},...extra};
    const fn=listeners.get(type); assert.ok(fn,'SW listener '+type); fn(event);
    const outcome=response?await response:undefined;
    await Promise.all(waits); return outcome;
  }
  return {dispatch,stores,caches,networkCalls,messages,setOffline(value){offline=value;},get skipCalls(){return skipCalls;},get claimCalls(){return claimCalls;}};
}
function businessContext() {
  const elements=new Map();
  const element=()=>({innerHTML:'',textContent:'',value:'',style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},addEventListener(){},setAttribute(){},getAttribute(){return null;}});
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelectorAll(){return [];},querySelector(){return element();},addEventListener(){}};
  const data=new Map(),storage={getItem(k){return data.get(k)||null;},setItem(k,v){data.set(k,String(v));},removeItem(k){data.delete(k);}};
  const context={document,localStorage:storage,console,Date,Math,JSON,Number,String,Set,Map,Array,Object,RegExp,Error,SyntaxError,confirm(){return true;},setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},scrollTo(){},addEventListener(){}};
  context.window=context;
  vm.createContext(context);
  const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
  const inline=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(x=>x.trim());
  for(const source of inline)vm.runInContext(source,context);
  vm.runInContext(fs.readFileSync(path.join(dist,'validation.js'),'utf8'),context);
  return {context,elements,evaluate(source){return vm.runInContext(source,context);}};
}
(async()=>{
  await test('Install metadata, icons and local asset links',()=>{
    const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
    assert.match(html,/rel="manifest"/);
    assert.match(html,/name="apple-mobile-web-app-capable"\s+content="yes"/);
    assert.match(html,/viewport-fit=cover/);
    assert.ok(!html.includes('src="native.js"'),'iOS bridge is not loaded in browser distribution');
    const manifestFile=html.match(/rel="manifest"\s+href="([^"]+)"/)[1];
    const manifest=JSON.parse(fs.readFileSync(path.join(dist,manifestFile),'utf8'));
    assert.equal(manifest.display,'standalone');
    for(const value of [manifest.id,manifest.start_url,manifest.scope])assert.ok(value&&!value.startsWith('/')&&!/^https?:/.test(value),'Manifest is deployable under a subdirectory');
    assert.ok(manifest.icons.length>=2);
    for(const icon of manifest.icons){
      const bytes=fs.readFileSync(path.join(dist,icon.src));
      assert.equal(bytes.subarray(1,4).toString(),'PNG');
      const [w,h]=icon.sizes.split('x').map(Number);assert.equal(bytes.readUInt32BE(16),w);assert.equal(bytes.readUInt32BE(20),h);
    }
    for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
      if(/^(https?:|data:)/.test(m[1]))continue;
      assert.ok(fs.existsSync(path.join(dist,m[1])),m[1]);
    }
    assert.equal(poses.length,200);
    assert.equal(Object.keys(images).length,200);
    const cells = new Set(), atlasGrids = new Map();
    for(const pose of poses){
      const image=images[pose.imageKey];
      assert.ok(image,'Anatomy image metadata for '+pose.id);
      assert.equal(image.kind,'generated-anatomy');
      assert.ok(image.path.endsWith('.png')&&!/^https?:/.test(image.path),'Local generated PNG for '+pose.id);
      assert.ok(Number.isInteger(image.columns)&&image.columns>0&&Number.isInteger(image.rows)&&image.rows>0,'Valid atlas grid for '+pose.id);
      assert.ok(Number.isInteger(image.column)&&image.column>=0&&image.column<image.columns,'Column in bounds for '+pose.id);
      assert.ok(Number.isInteger(image.row)&&image.row>=0&&image.row<image.rows,'Row in bounds for '+pose.id);
      const cell=image.path+':'+image.column+':'+image.row;
      assert.ok(!cells.has(cell),'Unique atlas cell for '+pose.id);cells.add(cell);
      const grid=[image.columns,image.rows];
      if(atlasGrids.has(image.path))assert.deepEqual(atlasGrids.get(image.path),grid,'Consistent grid for '+image.path);
      else atlasGrids.set(image.path,grid);
      assert.ok(image.author&&image.license,'Generated artwork attribution for '+pose.id);
      assert.ok(!image.licenseURL&&!image.sourceURL,'Generated artwork has no invented source or licence URL');
    }
    assert.equal(cells.size,200);assert.equal(imagePaths.length,35);
    for(const file of imagePaths){
      const bytes=fs.readFileSync(path.join(dist,file));
      assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Valid PNG header for '+file);
      const [columns,rows]=atlasGrids.get(file),width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
      assert.ok(width/columns>=256&&height/rows>=256,'Viable illustration resolution in each cell of '+file);
      assert.ok(Math.abs(width/columns-height/rows)<=1,'Square sprite cells in '+file);
    }
    const imageContext=vm.createContext({window:{}});
    vm.runInContext(fs.readFileSync(path.join(dist,'images.js'),'utf8'),imageContext);
    assert.deepEqual(JSON.parse(JSON.stringify(imageContext.window.YOGA_IMAGES)),images,'Runtime images match canonical metadata');
    for(const file of ['index.html','help.js','images.js'])assert.doesNotMatch(fs.readFileSync(path.join(dist,file),'utf8'),/commons\.wikimedia|Wikimedia Commons|Источник фотографии/i,'No obsolete Commons/photo attribution in UI');
  });
  await test('Local calendar, transfer and duplicate-visit accounting remain correct',()=>{
    const b=businessContext();
    assert.equal(b.context.addDays('2026-10-15',30),'2026-11-14');
    assert.deepEqual(Array.from(b.context.getWeekDates('2026-10-15')),['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18']);
    b.evaluate(`state={clients:[{id:'c1',name:'Анна',createdAt:'2026-10-01'}],plans:[{id:'p1',name:'4 занятия',visitsCount:4,durationDays:30,price:14000}],subscriptions:[{id:'s1',clientId:'c1',planId:'p1',purchaseDate:'2026-10-01',expiryDate:'2026-10-31',visitsTotal:4,visitsLeft:4,price:14000}],visits:[],transfers:[]};`);
    b.context.toggleAttendanceCell('c1','2026-10-15');
    assert.equal(b.evaluate('state.subscriptions[0].visitsLeft'),3);
    b.context.openVisitSheet(); // A historical date is still validated even if no active-today choices.
    b.context.document.getElementById('fVisitClient').value='c1';
    b.context.document.getElementById('fVisitDate').value='2026-10-15';
    b.context.saveVisit();
    assert.equal(b.evaluate('state.subscriptions[0].visitsLeft'),3);
    b.context.document.getElementById('fTransferDays').value='7';
    b.context.document.getElementById('fTransferDate').value='2026-10-15';
    b.context.document.getElementById('fTransferComment').value='Перенос';
    b.context.saveTransfer('s1');
    assert.equal(b.evaluate('state.subscriptions[0].expiryDate'),'2026-11-07');
    assert.equal(b.evaluate('state.subscriptions[0].visitsLeft'),3);
  });
  await test('Service worker precaches complete shell and illustrations for all200 asanas',async()=>{
    const sw=workerHarness();await sw.dispatch('install');
    await sw.dispatch('message',{data:{type:'PREPARE_OFFLINE'},ports:[]});
    assert.equal(sw.skipCalls,0,'An update must wait for user action');
    const cachePaths=[...sw.stores.values()].flatMap(store=>[...store.keys()]);
    const needed=['index.html','pwa.js','pwa.css','validation.js','rent.js','rent.css','help.js','practices.js','practices.css','asanas.js','images.js','mobile.css','fonts.css'];
    needed.push(...imagePaths);
    for(const file of needed)assert.ok(cachePaths.includes(file==='index.html'?scope:new URL(file,scope).href),'Precached '+file);
    assert.ok(cachePaths.every(url=>new URL(url).origin===origin),'No external origin is precached');
  });
  await test('Offline navigation, query URLs and all images use cached application',async()=>{
    const sw=workerHarness();await sw.dispatch('install');await sw.dispatch('activate');
    await sw.dispatch('message',{data:{type:'PREPARE_OFFLINE'},ports:[]});sw.setOffline(true);
    const request=(url,mode='same-origin')=>({url:new URL(url,scope).href,mode,method:'GET',headers:new Headers()});
    const response=await sw.dispatch('fetch',{request:request('index.html?from=home','navigate')});
    assert.ok(response&&response.ok);assert.match(await response.text(),/Йога-практика/);
    const practiceData=await sw.dispatch('fetch',{request:request('practices.js')});
    assert.ok(practiceData&&practiceData.ok,'Practice plans available offline');
    const practiceContext=vm.createContext({window:{}});vm.runInContext(await practiceData.text(),practiceContext);
    assert.equal(practiceContext.window.YOGA_PRACTICES.length,15,'All 15 plans can load without network');
    const practiceStyles=await sw.dispatch('fetch',{request:request('practices.css')});assert.ok(practiceStyles&&practiceStyles.ok);
    for(const file of imagePaths){
      const image=await sw.dispatch('fetch',{request:request(file)});
      assert.ok(image&&image.ok,'Offline atlas '+file);assert.ok((await image.arrayBuffer()).byteLength>100);
    }
  });
  await test('Offline-ready status requires every resource and detects eviction',async()=>{
    const sw=workerHarness();
    const status=async()=>{let reply;await sw.dispatch('message',{data:{type:'CACHE_STATUS'},ports:[{postMessage(value){reply=value;}}]});return reply;};
    assert.equal((await status()).ready,false);
    await sw.dispatch('install');
    const shell=await status();assert.equal(shell.coreReady,true);assert.equal(shell.ready,false);
    await sw.dispatch('message',{data:{type:'PREPARE_OFFLINE'},ports:[]});
    const complete=await status();assert.equal(complete.ready,true);assert.equal(complete.loaded,complete.total);assert.ok(complete.version);
    const imageURL=new URL(sampleImagePath,scope).href;
    const store=[...sw.stores.values()].find(s=>s.has(imageURL));
    store.delete(imageURL);
    assert.equal((await status()).ready,false);
    store.delete(scope);sw.setOffline(true);
    const response=await sw.dispatch('fetch',{request:{url:scope,mode:'navigate',method:'GET',headers:new Headers()}});
    assert.equal(response.status,503);
    assert.match(await response.text(),/подключитесь к интернету/);
  });
  await test('Sign-in documents, redirects and foreign origins cannot poison precache',async()=>{
    for(const kind of ['html-script','html-index','redirect','foreign-origin']){
      const previous='yoga-practice:'+scope+':previous';
      const stores=new Map([[previous,new Map()]]);
      const sw=workerHarness({stores,fetch(url){
        if(url.endsWith('/pwa.js') && kind!=='html-index'){
          const r=kind==='html-script'?new Response('<html>Sign in</html>',{headers:{'Content-Type':'text/html'}}):fileResponse(url);
          Object.defineProperty(r,'url',{value:kind==='foreign-origin'?'https://accounts.example/login':url,configurable:true});
          if(kind==='redirect')Object.defineProperty(r,'redirected',{value:true});
          return r;
        }
        if(url===scope&&kind==='html-index')return new Response('<html>Sign in</html>',{headers:{'Content-Type':'text/html'}});
        return fileResponse(url);
      }});
      await assert.rejects(sw.dispatch('install'),undefined,kind+' rejected');
      assert.equal([...sw.stores.values()].reduce((n,s)=>n+s.size,0),0,'Partial cache is removed after '+kind);
      assert.ok(stores.has(previous),'Previously active cache is untouched after '+kind);
    }
  });
  await test('Directory start URL installs despite canonical index.html redirect on the host',async()=>{
    const sw=workerHarness({fetch(url){
      if(url===scope+'index.html')return new Response('',{status:307,headers:{Location:scope}});
      return fileResponse(url);
    }});
    await sw.dispatch('install');await sw.dispatch('activate');
    assert.ok(sw.networkCalls.includes(scope),'Fetches the canonical directory document');
    assert.ok(!sw.networkCalls.includes(scope+'index.html'),'Does not request redirected index.html');
    const saved=await sw.caches.match(scope);assert.ok(saved&&saved.ok);
    sw.setOffline(true);
    for(const url of [scope,scope+'?from=home',scope+'index.html?from=old-shortcut']){
      const r=await sw.dispatch('fetch',{request:{url,method:'GET',mode:'navigate',headers:new Headers()}});
      assert.ok(r.ok);assert.match(await r.text(),/yoga-practice-pwa/);
    }
  });
  await test('Core offline use survives failed images; retry resumes without redownloading saved files',async()=>{
    let broken = true, inflight = 0, maximum = 0;
    const sw=workerHarness({async fetch(url){
      inflight++; maximum=Math.max(maximum,inflight);
      await new Promise(resolve=>setTimeout(resolve,1));
      inflight--;
      if(broken&&url===new URL(sampleImagePath,scope).href)return new Response('failed',{status:503});
      return fileResponse(url);
    }});
    await sw.dispatch('install');await sw.dispatch('activate');
    let reply;
    const status=async()=>{await sw.dispatch('message',{data:{type:'CACHE_STATUS'},ports:[{postMessage(s){reply=s;}}]});return reply;};
    assert.equal((await status()).coreReady,true);
    assert.equal((await status()).ready,false);
    await sw.dispatch('message',{data:{type:'PREPARE_OFFLINE'},ports:[]});
    const partial=await status();
    assert.equal(partial.coreReady,true);assert.equal(partial.ready,false);assert.equal(partial.error,'network');
    assert.equal(partial.loaded,partial.total-1);assert.equal(partial.preparing,false);
    assert.ok(sw.messages.some(m=>m.loaded>0&&m.loaded<m.total&&m.preparing),'Visible progress while loading');
    assert.ok(maximum<=2,'At most two simultaneous network fetches');
    sw.setOffline(true);
    const page=await sw.dispatch('fetch',{request:{url:scope,mode:'navigate',method:'GET',headers:new Headers()}});
    assert.ok(page.ok,'Accounting opens offline before all illustrations are saved');
    broken=false;sw.setOffline(false);
    const before=sw.networkCalls.length;
    await Promise.all([sw.dispatch('message',{data:{type:'PREPARE_OFFLINE'},ports:[]}),sw.dispatch('message',{data:{type:'PREPARE_OFFLINE'},ports:[]})]);
    assert.deepEqual(sw.networkCalls.slice(before),[new URL(sampleImagePath,scope).href],'Retry downloads only missing file, even when requested twice');
    const complete=await status();assert.equal(complete.ready,true);assert.equal(complete.error,'');
  });
  await test('Rejected illustration sign-in page stays out of cache; normal fetch repairs eviction',async()=>{
    let signIn=true;
    const sw=workerHarness({fetch(url){return signIn&&url===new URL(sampleImagePath,scope).href
      ?new Response('<html>Sign in</html>',{headers:{'Content-Type':'text/html'}}):fileResponse(url);}});
    await sw.dispatch('install');await sw.dispatch('activate');
    await sw.dispatch('message',{data:{type:'PREPARE_OFFLINE'},ports:[]});
    assert.equal(await sw.caches.match(new URL(sampleImagePath,scope).href),undefined);
    signIn=false;
    const req={url:new URL(sampleImagePath,scope).href,method:'GET',mode:'same-origin',headers:new Headers()};
    const online=await sw.dispatch('fetch',{request:req});assert.ok(online.ok);
    sw.setOffline(true);
    const offline=await sw.dispatch('fetch',{request:req});assert.ok(offline.ok,'Recovered file was saved');
  });
  await test('Cross-origin and non-GET requests bypass app caching',async()=>{
    const sw=workerHarness();await sw.dispatch('install');const before=[...sw.stores.values()].reduce((n,s)=>n+s.size,0);
    const external=await sw.dispatch('fetch',{request:{url:'https://other.example/avatar.jpg',method:'GET',mode:'cors',headers:new Headers()}});
    const post=await sw.dispatch('fetch',{request:{url:scope+'index.html',method:'POST',mode:'same-origin',headers:new Headers()}});
    const auth=await sw.dispatch('fetch',{request:{url:scope+'auth/login',method:'GET',mode:'navigate',headers:new Headers()}});
    const account=await sw.dispatch('fetch',{request:{url:origin+'/__auth/callback',method:'GET',mode:'navigate',headers:new Headers()}});
    assert.equal(external,undefined);assert.equal(post,undefined);
    assert.equal(auth,undefined);assert.equal(account,undefined);
    assert.equal([...sw.stores.values()].reduce((n,s)=>n+s.size,0),before);
  });
  await test('Activation preserves unrelated caches and update is explicit',async()=>{
    const stores=new Map([['other-application-v1',new Map()],['yoga-practice:'+origin+'/other/:old',new Map()],['yoga-practice:'+scope+':old',new Map()]]),sw=workerHarness({stores});
    await sw.dispatch('install');await sw.dispatch('activate');
    assert.ok(stores.has('other-application-v1'));
    assert.ok(stores.has('yoga-practice:'+origin+'/other/:old'),'Another installed path remains intact');
    assert.ok(!stores.has('yoga-practice:'+scope+':old'),'This scope old shell was removed');
    assert.equal(sw.skipCalls,0);
    await sw.dispatch('message',{data:{type:'UNRELATED'},ports:[]});assert.equal(sw.skipCalls,0);
    await sw.dispatch('message',{data:{type:'SKIP_WAITING'},ports:[]});assert.equal(sw.skipCalls,1);
  });
  await test('Update inherits unchanged illustrations from the previous cache without downloading them',async()=>{
    const swSource=fs.readFileSync(path.join(dist,'sw.js'),'utf8');
    const hashes=JSON.parse(swSource.match(/const HASHES = (\{.*\});/)[1]);
    const imgRel=sampleImagePath, changedRel=imagePaths.find(p=>p!==imgRel);
    const imgUrl=new URL(imgRel,scope).href, changedUrl=new URL(changedRel,scope).href;
    const oldHashes={...hashes,[changedRel]:'0000000000000000'};
    const old=new Map([
      [new URL('__asset-hashes.json',scope).href,new Response(JSON.stringify(oldHashes))],
      [imgUrl,new Response('OLD-IMAGE',{status:200})],
      [changedUrl,new Response('STALE-IMAGE',{status:200})]
    ]);
    const stores=new Map([['yoga-practice:'+scope+':old',old]]),sw=workerHarness({stores});
    await sw.dispatch('install');
    const fresh=[...stores.entries()].find(([name])=>!name.endsWith(':old'))[1];
    assert.equal(await fresh.get(imgUrl).text(),'OLD-IMAGE','unchanged image was copied');
    assert.ok(!sw.networkCalls.includes(imgUrl),'unchanged image was not downloaded');
    assert.ok(!fresh.has(changedUrl)||(await fresh.get(changedUrl).text())!=='STALE-IMAGE','changed image is never inherited');
  });
  fs.writeFileSync(path.join(__dirname,'results.json'),JSON.stringify({engine:'Node.js VM and static file checks',note:'No browser, real service-worker runtime or iOS home-screen installation was exercised',results},null,2)+'\n');
  if(results.some(r=>r.status==='failed'))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
