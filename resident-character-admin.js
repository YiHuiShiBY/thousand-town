(function(root){
 'use strict';
 const $=id=>document.getElementById(id),el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;};
 const params=new URLSearchParams(location.search),rawSeed=Number(params.get('seed')||20260818),seed=Number.isFinite(rawSeed)?rawSeed>>>0:20260818;
 const saved=root.CityResidentNames.loadRoster(()=>localStorage),town=root.CityResidents.create({seed,roster:saved.roster}),catalog=root.CityResidentCatalog.create(town),labels=root.CityResidentCatalog.labels;
 let roles=(params.get('roles')||'worker').split(',').filter(r=>catalog.groups.some(g=>g.role===r)),page=Math.max(0,Math.floor(Number(params.get('page'))||0)),pageSize=params.get('count')==='2'?2:4,selected=params.get('resident')||'',focused=null,result,viewer,noticeTimer;
 if(params.has('roles')&&params.get('roles')==='')roles=[];
 const liveStats=new Map();
 function statsText(stats){return stats?stats.meshes+' 网格 / '+stats.triangles.toLocaleString()+' 面':'—';}
 function sizeText(stats){return stats?stats.size.map(n=>n.toFixed(2)).join(' × '):'—';}
 function notify(message){$('notification').textContent=message;$('notification').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notification').hidden=true,4300);}
 const age=(value,fallback)=>{const n=Number(value);return value&&Number.isFinite(n)?Math.max(1,Math.min(90,Math.round(n))):fallback;};
 $('min-age').value=age(params.get('min'),1);$('max-age').value=age(params.get('max'),90);$('gender').value=['M','F'].includes(params.get('gender'))?params.get('gender'):'';
 $('catalog-search').value=params.get('q')||'';
 $('back-city').href='./index.html?seed='+seed;
 function filters(){return {roles,text:$('catalog-search').value,minAge:$('min-age').value,maxAge:$('max-age').value,gender:$('gender').value};}
 function groupLabel(){return !roles.length?'全部居民':roles.length===1?labels[roles[0]]:roles.every(r=>r.startsWith('student-'))?'学生':roles.join(',')==='medical-doc,medical-nurse'?'医护':roles.join(',')==='retiree,senior'?'老人':'多个身份';}
 function updateURL(){const p=new URLSearchParams();p.set('seed',seed);p.set('roles',roles.join(','));p.set('min',$('min-age').value);p.set('max',$('max-age').value);if($('gender').value)p.set('gender',$('gender').value);if($('catalog-search').value)p.set('q',$('catalog-search').value);p.set('page',page);p.set('count',pageSize);if(selected)p.set('resident',selected);history.replaceState(null,'','?'+p);}
 function renderGroups(){
  const list=$('group-list');list.replaceChildren();
  catalog.groups.forEach((g,index)=>{
   const button=el('button','group-button');button.type='button';button.dataset.role=g.role;button.setAttribute('aria-pressed',String(roles.length===1&&roles[0]===g.role));
   button.append(el('span','group-number',String(index+1).padStart(2,'0')));const text=el('span','group-text');text.append(el('b','',g.label),el('small','',g.minAge+'–'+g.maxAge+' 岁 / '+g.count+' 位居民'));button.append(text,el('span','group-count',g.count));
   button.addEventListener('click',()=>{roles=[g.role];page=0;focused=null;render();});list.append(button);
  });
  document.querySelectorAll('[data-roles]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.roles===roles.join(','))));
 }
 function inspector(){
  const content=$('inspector-content');content.replaceChildren();const r=catalog.residents.find(r=>r.id===selected);
  if(!r){content.append(el('p','scope-note','当前没有选中的居民。'));return;}
  content.append(el('h3','resident-name',r.name),el('p','resident-id',r.id));const tags=el('div','resident-tags');for(const t of [labels[r.role],r.age+' 岁',r.gender==='M'?'男':'女'])tags.append(el('span','',t));content.append(tags);
  const model=root.CityResidentCatalog.modelFor(r.role),details=el('dl','resident-details'),building=id=>town.buildings.find(b=>b.id===id)?.name||id||'—';
  for(const [name,value] of [['住宅',building(r.home)],['工作地',building(r.workplace)],['模型来源',model.source],['造型状态',model.modelLabel]]){const row=el('div','');row.append(el('dt','',name),el('dd','',value));details.append(row);}
  const statsRow=el('div','');statsRow.append(el('dt','','模型规模'),el('dd','',statsText(liveStats.get(r.id))));statsRow.lastChild.id='selected-stats';details.append(statsRow);const sizeRow=el('div','');sizeRow.append(el('dt','','尺寸（场景单位）'),el('dd','',sizeText(liveStats.get(r.id))));sizeRow.lastChild.id='selected-size';details.append(sizeRow);content.append(details,el('p','model-status',model.description));
 }
 function select(id){selected=id;document.querySelectorAll('.model-card').forEach(card=>card.classList.toggle('selected',card.dataset.residentId===id));inspector();updateURL();}
 function focus(id){focused=id;selected=id;renderCards();inspector();updateURL();}
 function renderCards(){
  const slice=focused?result.residents.filter(r=>r.id===focused):result.residents.slice(page*pageSize,(page+1)*pageSize),cards=$('cards');cards.replaceChildren();cards.classList.toggle('focused',!!focused);
  const specs=[];
  slice.forEach((r,index)=>{
   const model=root.CityResidentCatalog.modelFor(r.role),card=el('article','model-card'+(r.id===selected?' selected':''));card.dataset.residentId=r.id;
   const header=el('div','model-header'),text=el('div','');text.append(el('small','','RESIDENT / '+String(page*pageSize+index+1).padStart(3,'0')),el('b','',r.name+' · '+r.age+' 岁'),el('span','',r.id));
   const expand=el('button','',focused?'返回并排':'↗ 放大');expand.type='button';expand.setAttribute('aria-label',focused?'返回并排':'放大观察 '+r.name);expand.addEventListener('click',()=>{if(focused){focused=null;renderCards();}else focus(r.id);});
   header.append(text,expand);const viewport=el('div','model-viewport');viewport.setAttribute('role','img');viewport.setAttribute('aria-label',r.name+' '+model.modelLabel+'，拖动旋转、滚轮缩放');viewport.tabIndex=0;
   viewport.addEventListener('keydown',e=>{if(e.key==='Enter')focus(r.id);});
   const footer=el('div','model-footer');const info=el('span','','正在绘制…');info.dataset.modelStats=r.id;footer.append(info,el('span','',model.modelLabel));card.append(header,viewport,footer);card.addEventListener('click',()=>select(r.id));cards.append(card);
   specs.push({id:r.id,label:r.name+' · '+r.age+' 岁 / '+labels[r.role],element:viewport,resident:r,modelRef:model.modelRef,modelLabel:model.modelLabel});
  });
  viewer.setCards(specs);$('empty-state').hidden=result.matched>0;$('exit-focus').hidden=!focused;
  const sync=$('linked').checked?'镜头已同步':'独立镜头';$('compare-caption').textContent=focused?'单模型放大观察':slice.length+' 个模型并列 · '+sync;
  $('previous-page').disabled=page<=0||!!focused;$('next-page').disabled=(page+1)*pageSize>=result.matched||!!focused;
  $('page-label').textContent=(result.matched?page+1:0)+' / '+Math.ceil(result.matched/pageSize);
  $('page-range').textContent=result.matched?(page*pageSize+1)+'—'+Math.min((page+1)*pageSize,result.matched)+' / '+result.matched+' 位居民':'0 位居民';
  document.querySelectorAll('[data-count]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.count)===pageSize)));
 }
 function render(){
  result=catalog.query(filters());page=Math.min(page,Math.max(0,Math.ceil(result.matched/pageSize)-1));
  const visible=result.residents.slice(page*pageSize,(page+1)*pageSize);if(!visible.some(r=>r.id===selected))selected=visible[0]?.id||'';
  if(focused&&!result.residents.some(r=>r.id===focused))focused=null;
  // Read the coverage off the catalog instead of naming one role, so the copy
 // stays true whether one trade or all twenty own a real model.
 const modelled=catalog.groups.filter(g=>g.modelStatus==='role-prototype').length,total=catalog.groups.length;
 $('group-title').textContent=groupLabel();$('group-description').textContent='真实居民资料 · '+modelled+' / '+total+' 个身份已有专属三维造型 · 种子 '+seed;
 $('model-stage').textContent=modelled===total?total+' 个职业全部完成专属造型 · 按分类查看':modelled+' 个职业已有专属造型 · 其余仍为基础造型';
 $('pose').querySelector('[value="commuter"]').textContent='背包通勤';$('pose').querySelector('[value="vendor"]').textContent='摊主招呼';
  $('match-count').textContent=result.matched;$('match-total').textContent='/ '+result.total+' 位居民';document.title=groupLabel()+' · 居民三维档案馆';
  renderGroups();renderCards();inspector();updateURL();
 }
 try {
  viewer=root.CityResidentCharacterViewer.create({container:$('comparison-board'),onSelect:select,onFocus:focus,onStats:(id,stats)=>{
   liveStats.set(id,stats);const label=document.querySelector('[data-model-stats="'+id+'"]');if(label)label.textContent=stats.meshes+' 网格 · '+stats.triangles.toLocaleString()+' 面';
   if(id===selected&&$('selected-stats')){$('selected-stats').textContent=statsText(stats);$('selected-size').textContent=sizeText(stats);}
  }});
  $('population').textContent=town.residents.length;$('directory-summary').textContent=catalog.groups.length+' 个身份分组';
  ['catalog-search','min-age','max-age','gender'].forEach(id=>$(id).addEventListener('input',()=>{page=0;focused=null;if(id==='min-age'||id==='max-age')$('age-band').value='';render();}));
  $('age-band').addEventListener('change',()=>{const values=$('age-band').value.split(',');$('min-age').value=values[0]||1;$('max-age').value=values[1]||90;page=0;focused=null;render();});
  $('clear-filters').addEventListener('click',()=>{$('catalog-search').value='';$('min-age').value=1;$('max-age').value=90;$('age-band').value='';$('gender').value='';page=0;focused=null;render();});
  document.querySelectorAll('[data-roles]').forEach(b=>b.addEventListener('click',()=>{roles=b.dataset.roles.split(',').filter(Boolean);page=0;focused=null;render();}));
  document.querySelectorAll('[data-count]').forEach(b=>b.addEventListener('click',()=>{pageSize=Number(b.dataset.count);page=0;focused=null;render();}));
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-view]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));viewer.setOptions({view:b.dataset.view});}));
  for(const [id,key] of [['linked','linked'],['wireframe','wireframe'],['clay','clay'],['auto-rotate','rotate'],['play','play']])$(id).addEventListener('change',()=>{viewer.setOptions({[key]:$(id).checked});$('compare-caption').textContent=(focused?'单模型放大观察':document.querySelectorAll('.model-card').length+' 个模型并列')+' · '+($('linked').checked?'镜头已同步':'独立镜头');});
  $('pose').addEventListener('change',()=>viewer.setOptions({pose:$('pose').value}));$('light-mode').addEventListener('change',()=>viewer.setOptions({night:$('light-mode').value==='night'}));
  $('reset-camera').addEventListener('click',()=>viewer.reset());
  $('exit-focus').addEventListener('click',()=>{focused=null;renderCards();});
  $('previous-page').addEventListener('click',()=>{page--;render();});$('next-page').addEventListener('click',()=>{page++;render();});
  $('capture').addEventListener('click',()=>{const link=el('a','');link.href=viewer.capture();link.download='resident-models-'+seed+'-'+(roles.join('-')||'all')+'.png';link.click();notify('当前模型截图已导出。');});
    root.addEventListener('storage',event=>{
   if(event.key===root.CityResidentNames.STORAGE_KEY||event.key===null){const next=root.CityResidentNames.loadRoster(()=>localStorage,town.residents.length);root.CityResidentNames.copyNameFields(town,root.CityResidents.create({seed,roster:next.roster}));render();if(next.error)notify(next.error);}
  });
  root.addEventListener('pagehide',event=>{if(!event.persisted)viewer.dispose();});
  root.CityResidentAdmin={getState:()=>({seed,roles:roles.slice(),filters:filters(),matched:result.matched,total:result.total,ids:result.residents.map(r=>r.id),page,pageSize,selected,focused,viewer:viewer.getState()})};
  render();document.documentElement.dataset.ready='true';if(saved.error)notify(saved.error);
 }catch(error){$('group-description').textContent='模型窗口未能载入：'+error.message;document.documentElement.dataset.ready='error';console.error(error);}
})(typeof globalThis!=='undefined'?globalThis:this);
