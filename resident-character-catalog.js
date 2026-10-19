/* Real resident references; visual metadata stays outside the census. */
(function(root,factory){
 const api=factory(root.CityResidents||(typeof module==='object'&&module.exports?require('./city-life-ext/resident.js'):null),root.CityResidentCharacterModels||(typeof module==='object'&&module.exports?require('./resident-character-models.js'):null));
 root.CityResidentCatalog=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Residents,Models){
 'use strict';
 const labels={'preschooler':'学龄前儿童','student-p':'小学生','student-m':'中学生','student-u':'大学生',office:'职员 / 白领',worker:'工人 / 蓝领',shopkeeper:'店主',driver:'司机',teacher:'教师','school-admin':'学校行政','medical-doc':'医生','medical-nurse':'护士','hosp-admin':'医院行政',officer:'警员',clerk:'银行 / 办事人员',sanitation:'环卫人员',unemployed:'待业居民',patient:'住院居民',retiree:'退休居民',senior:'高龄长者'};
 const ageBands=[[1,5],[6,12],[13,17],[18,22],[23,35],[36,55],[56,70],[71,90]];
 function modelFor(role){
  const found=Models?Models.describe(role):null;
  return found||{modelRef:'city-scene/shared-base',modelStatus:'shared-base',source:'city-scene.js · personParts',modelLabel:'共用基础造型 · 待精修',description:'年龄 / 职业外观待精修。这里展示代表造型，尚未与街面居民逐人绑定。'};
 }
 function create(town){
  if(!town||!Array.isArray(town.residents))throw new TypeError('需要真实居民名册');
  const residents=town.residents.slice(),roles=[...new Set([...Residents.CENSUS.map(r=>r.role),...residents.map(r=>r.role)])];
  const groups=roles.map(role=>{
   const members=residents.filter(r=>r.role===role);
   return {role,label:labels[role]||role,count:members.length,minAge:members.length?Math.min(...members.map(r=>r.age)):null,maxAge:members.length?Math.max(...members.map(r=>r.age)):null,...modelFor(role)};
  });
  function query(filters={}){
   const roles=Array.isArray(filters.roles)?filters.roles:[],text=String(filters.text||'').trim().toLocaleLowerCase();
   const base=residents.filter(r=>!roles.length||roles.includes(r.role));
   const min=filters.minAge==null||filters.minAge===''?1:Number(filters.minAge),max=filters.maxAge==null||filters.maxAge===''?90:Number(filters.maxAge);
   const selected=base.filter(r=>Number.isFinite(min)&&Number.isFinite(max)&&r.age>=min&&r.age<=max&&(!filters.gender||r.gender===filters.gender)&&(!text||[r.name,r.id,r.role,labels[r.role],r.pinyin].some(v=>String(v||'').toLocaleLowerCase().includes(text))));
   return {residents:selected,matched:selected.length,total:base.length};
  }
  return {groups,residents,query};
 }
 return {create,labels,ageBands,modelFor};
});
