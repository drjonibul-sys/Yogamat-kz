const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const dist=path.resolve(__dirname,'../../dist');
function harness(storage = new Map()) {
  const ids = new Map();
  let page;
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag; this.children = []; this.nodes = []; this.events = new Map();
      this.style = {}; this.dataset = {}; this.attributes = {}; this.value = ''; this.textContent = '';
      const classes = new Set();
      this.classList = {add(...names){names.forEach(x=>classes.add(x));},remove(...names){names.forEach(x=>classes.delete(x));},contains(name){return classes.has(name);},toggle(name,on){if(on===undefined)on=!classes.has(name);on?classes.add(name):classes.delete(name);return on;}};
    }
    set innerHTML(html) {
      this.html = html;
      for (const old of this.nodes) if (old.id && ids.get(old.id) === old) ids.delete(old.id);
      this.nodes = [];
      for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
        const node = new Element(match[1]);
        for (const a of match[2].matchAll(/([a-z][a-z0-9-]*)="([^"]*)"/gi)) {
          node.attributes[a[1]] = a[2];
          if(a[1]==='id'){node.id=a[2];ids.set(node.id,node);}
          if(a[1]==='class'){node.className=a[2];a[2].split(/\s+/).forEach(x=>node.classList.add(x));}
          if(a[1].startsWith('data-'))node.dataset[a[1].slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=a[2];
        }
        this.nodes.push(node);
      }
    }
    get innerHTML() { return this.html || ''; }
    addEventListener(name, fn) { this.events.set(name, fn); }
    dispatch(name) { const fn=this.events.get(name); if(fn)fn({currentTarget:this,target:this}); }
    click() { this.dispatch('click'); }
    setAttribute(name,value) { this.attributes[name]=String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    append(node) { this.children.push(node); }
    before(node) { page=node;ids.set(node.id,node); }
    focus() { this.focused=true; }
    querySelector(selector) {
      if(selector==='h2')return this.nodes.find(x=>x.tagName==='h2') || new Element('h2');
      return null;
    }
  }
  function allNodes(){return [...new Set([...(page?.nodes||[]),...['asanaList','asanaDetail','practiceList','practiceDetail'].flatMap(id=>ids.get(id)?.nodes||[])])];}
  const nav = new Element('nav');
  const document = {
    createElement(tag){return new Element(tag);},
    getElementById(id){assert.ok(ids.has(id),'DOM ID exists: '+id);return ids.get(id);},
    querySelector(selector){
      if(selector==='.tabbar')return nav;
      const match=selector.match(/^\[data-([a-z-]+)="([^"]+)"\]$/);
      if(match){const key=match[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return allNodes().find(x=>x.dataset[key]===match[2])||null;}
      return null;
    },
    querySelectorAll(selector){
      const data=selector.match(/^\[data-([a-z-]+)\]$/);
      if(data){const key=data[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return allNodes().filter(x=>x.dataset[key]!==undefined);}
      if(selector==='.asana-card')return ids.get('asanaList')?.nodes.filter(x=>x.classList.contains('asana-card')) || [];
      if(selector==='.tabbtn')return nav.children;
      return [];
    }
  };
  const context = {document,console,JSON,Number,String,Set,Map,Array,Object,RegExp,Error,
    localStorage:{getItem(key){return storage.get(key)||null;},setItem(key,value){storage.set(key,String(value));}},
    escapeHtml(value){return String(value).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));},
    showPage(name){context.currentPage=name;},scrollY:0,scrollTo(x,y){context.scrollY=y;}};
  context.window=context;vm.createContext(context);
  for(const file of ['asanas.js','images.js','practices.js','help.js'])vm.runInContext(fs.readFileSync(path.join(dist,file),'utf8'),context,{filename:file});
  return {context,storage,query(selector){return document.querySelectorAll(selector);},helpTab(){return nav.children.find(x=>x.dataset.tab==='help');},el(id){return document.getElementById(id);},cards(){return document.querySelectorAll('.asana-card');},level(value){return document.querySelectorAll('[data-level]').find(x=>x.dataset.level===String(value));},search(value){const input=this.el('asanaSearch');input.value=value;input.dispatch('input');},groupCount(){return (this.el('asanaList').innerHTML.match(/class="asana-level-group"/g)||[]).length;}};
}

module.exports={harness};
