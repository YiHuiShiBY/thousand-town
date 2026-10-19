
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };


  const MIN_ZOOM=.7, MAX_ZOOM=6;
  const defaults = {seed:20260818,density:.8,skyline:1,speed:1,daySpeed:1,dreamLight:.7,stone:'#ece5d9',glass:'#8fa9ab',ground:'#d8d2c7',blenderModel:true,housingBlenderModel:true,playground:true,housing:true};
  const requestedShow=new URLSearchParams(location.search).get('show');
  const settings = {...defaults,residentModels:new URLSearchParams(location.search).get('people')!=='legacy',solarShow:['solar','thousand'].includes(requestedShow),dronePattern:requestedShow==='thousand'?'thousand':'solar'};
  const requestedSeed = new URLSearchParams(location.search).get('seed');
  if(requestedSeed!==null&&/^\d{1,10}$/.test(requestedSeed)&&Number(requestedSeed)<=4294967295)settings.seed=Number(requestedSeed);
  let layout=CityLayout.normalize(new URLSearchParams(location.search).get('layout'));
  const layoutHistory=[];
  let layoutEditing=false;






  //










  const facilityLots={hospital:7,mall:14,secondary:17,playground:16,amusement:19,station:12,plaza:18,
    primary:0,workshop:1,university:20,market:21,library:22,'annex-mall':23,depot:2};
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;



  // measuring what each (yaw,pitch) actually covers:








  const VIEW_PRESETS={
    home:{yaw:-.86,pitch:.56,zoom:1},
    top:{yaw:-1.55,pitch:1.0,zoom:1},     // 俯瞰：河从左到右穿过画面正中，直通城外
    solar:{yaw:-.66,pitch:.10,zoom:1.35},
    front:{yaw:-.66,pitch:.44,zoom:1},    // 低角度：街面、桥坡与对岸立面
    // Sunset: the sun sets toward -x, so this yaw is the one that actually faces
    // the sunset. home looks the other way and can never show the raking light.
    sunset:{yaw:.50,pitch:.44,zoom:1.06}
  };



  // 50-unit rim flattens into a disc from overhead.
  //











  const FACILITY_VIEWS={
    mall:{yaw:-2.45,pitch:.6},




    hospital:{yaw:-2.45,pitch:.75},
    secondary:{yaw:-0.95,pitch:.62},
    playground:{yaw:-.66,pitch:.95},
    amusement:{yaw:-.66,pitch:.5},
    plaza:{yaw:-.66,pitch:.95},
    waterfront:{yaw:-.9,pitch:.72},

    primary:{yaw:-.66,pitch:.6},workshop:{yaw:1.05,pitch:.72},depot:{yaw:-.9,pitch:.72},

    university:{yaw:-2.45,pitch:.6},market:{yaw:-2.45,pitch:.6},
    library:{yaw:-2.45,pitch:.6},'annex-mall':{yaw:-2.45,pitch:.6}
  };
  const FACILITY_DEFAULT={yaw:-.9,pitch:.6};

  // for, and all three flatten at the old .83.
  const HOUSING_VIEW={yaw:-.38,pitch:.7};


  const FOCUS_BUTTONS=Object.keys(FACILITY_VIEWS);

  const DAY_START_MINUTE=540;
  const DOW_NAMES=['周一','周二','周三','周四','周五','周六','周日'];
  const DAY_TYPE_NAMES={weekday:'工作日',saturday:'周六',sunday:'周日'};
  const requestedMinute=new URLSearchParams(location.search).get('minute');
  const requestedDay=Number(new URLSearchParams(location.search).get('day'));


  const requestEmbed=new URLSearchParams(location.search).get('embed')==='1';
  if(requestEmbed&&document.body)document.body.classList.add('is-immersive','embed');
  const startDay=Number.isSafeInteger(requestedDay)&&requestedDay>0?requestedDay:1;
  const startMinute=requestedMinute!==null&&/^\d{1,4}$/.test(requestedMinute)?Math.min(1439,Number(requestedMinute)):DAY_START_MINUTE;
  const state = {time:0,droneShowStart:0,paused:reducedMotion,loop:false,orbit:false,...VIEW_PRESETS.home,panX:0,panY:0,cameraX:0,cameraY:0,cameraZ:0,cameraYaw:0,cameraPitch:0,flyTarget:null,focusBuilding:false,focusFacility:null,
    daySeconds:((startDay-1)*1440+startMinute)*CityDailyClock.SECONDS_PER_SIM_MINUTE,observation:null};
  function dayClock(){
    const minute=CityDailyClock.minuteOfDay(state.daySeconds),day=CityDailyClock.dayIndex(state.daySeconds);
    const dow=CityDailyClock.dow(day),dayType=CityDailyClock.dayType(day);
    return {day,minute,dow,dayType,
      daylight:CityDailyClock.daylight(minute),night:CityDailyClock.isNight(minute),
      label:CityDailyClock.format(minute)+' · 第 '+day+' 日 · '+DOW_NAMES[dow]+' · '+DAY_TYPE_NAMES[dayType]};
  }
  function lightingState(){refreshTown();return state.lighting;}
  function bindLightingBuildings(){
    city.buildings.forEach(b=>{b.ledgerId=bindings.byMapId[b.id];});
  }
  const createCity=()=>{
    const next=CityLayout.apply(CityHousingPlan.decorate(CityPlaces.decorate(CityFacilities.decorate(CityModel.createCity(settings.seed,settings))),settings),layout);
    next.waterfront={stalls:CityWaterfront.plan(next),civic:CityWaterfront.civicSite(next)};
    next.reservations.push(...next.waterfront.stalls);

    // the layout swap rather than trusting the pre-swap plan.
    next.balloonStands=CityPlaces.balloonStands(next);


    next.frontage=CityFrontage.plan(next);
    next.reservations.push(...next.frontage.reservations);
    return next;
  };
  const helipadPlan={city:null,pad:null};
  const airshipPlan={city:null,route:null},airshipPose={};
  function airshipState(){
    if(!window.CityAirship)return null;
    if(airshipPlan.city!==city){airshipPlan.city=city;airshipPlan.route=CityAirship.plan(city);}
    return CityAirship.sample(airshipPlan.route,state.time,airshipPose);
  }
  /* 布置度（docs/festival-national-day.md）。
   * 2026-10-09 用户拍板：取消节日概念，装饰全量并入日常——旗帜、花瓣、
   * 灯笼增亮不再由日期窗口或 ?fest= 驱动，布置度恒为 1。CityFestival
   * 保留为纯计算模块（REST 常态色、axisColor 梯度仍被 city-ground 消费），
   * 它的日历与锁定路径不再进页面。找不到 CityFestival 时一律返回 0，
   * 也就是"没引节庆模块就等于没装饰"，页面不会因此报错。 */
  function resolveFestival(){
    if(typeof CityFestival==='undefined'||!CityFestival)return {level:0,source:'off',name:null};
    return {level:1,source:'daily',name:null};
  }
  let festivalDateKey='';
  function refreshFestival(){
    const key='daily';
    if(key===festivalDateKey)return false;
    festivalDateKey=key;state.festival=resolveFestival();return true;
  }
  refreshFestival();
  function festivalLevel(){return state.festival?state.festival.level:0;}

  window.__festivalProbe=function(){
    let festival=null;
    try{
      if(physicalScene&&typeof physicalScene.getInfo==='function'){
        const info=physicalScene.getInfo();
        festival=info&&info.festival?info.festival:null;
      }
    }catch(e){/* 探针不得影响页面 */}
    return {
      moduleLoaded:typeof CityFestival!=='undefined'&&!!CityFestival,
      level:festivalLevel(),
      source:state.festival?state.festival.source:'off',
      name:state.festival?state.festival.name:null,
      flowers:festival?festival.flowers:0,
      meshes:festival?festival.meshes:0,
      groundLevel:festival?festival.level:null,
      redness:festival?festival.redness:0,
      lanterns:festival?festival.lanterns:0,
      lanternDressed:festival?festival.lanternDressed:0,
      flags:festival?festival.flags:0,
      flagsVisible:festival?festival.flagsVisible:false,
      flagSample:festival?festival.flagSample:[],
      lampSample:festival?festival.lampSample:[],
      lampCount:festival?festival.lampCount:0,
      dayType:windowLight&&windowLight.clock?windowLight.clock.dayType:null
    };
  };
  window.__nightProbe=function(){
    /* 2026-10-09 流光带/喷泉彩灯只读探针：读真实实例缓冲与灯色，供 qa 验收；不影响渲染。 */
    let strip=null;const fountain=[];
    try{
      if(physicalScene&&physicalScene.scene){
        physicalScene.scene.traverse(function(o){
          if(o.name==='viaduct-flow-strip')strip=o;
          if(o.isSpotLight&&o.name==='fountain-colour')fountain.push({color:'#'+o.color.getHexString(),intensity:Math.round(o.intensity*10)/10});
        });
      }
    }catch(e){/* 探针不得影响页面 */}
    return {
      strip:strip?{visible:strip.visible,segments:strip.count,colors:Array.from(strip.instanceColor.array).map(function(v){return Math.round(v*1000)/1000;})}:null,
      fountain:fountain
    };
  };
  let city = createCity();
  let residentNameSource=CityResidentNames.loadRoster(()=>localStorage);
  let residentNameSignature=JSON.stringify(residentNameSource.roster);
  let town=CityResidents.create({seed:city.seed,roster:residentNameSource.roster});
  let bindings=CityTownView.bindMap(city,town.buildings);
  bindLightingBuildings();
  let snapshots=new Map(),walkingSelections=new Map(),snapshotIndex=null,townView=null,townKey='';
  let residentById=new Map(town.residents.map(r=>[r.id,r]));
  let selectedBuilding='h-terrace',selectedResident=null,residentMode='present',lastPanelKey='';
  let life = CityLife.create(city,{bindings,maxPeople:360});
  let streetService=CityLighting.streetSchedule(life,city);
  function vehicleActive(v,i){return CityLighting.streetActive(life.vehicles[i],streetService[life.vehicles[i].route],state.daySeconds);}
  function dailyVehicles(vehicles){return vehicles.map((v,i)=>({...v,active:vehicleActive(v,i)}));}
  let canvasActivity = null;
  let transitPlan=CityTransitMotion.create(city);
  let lightMotes = CityLight.create(city);

  state.time = city.duration;state.observation='neighborhood';state.yaw=1.05;state.pitch=.66;
  let ctx, view, sketch, renderCount=0, lastUI=0, lastFrameMs=0;
  const canvasLetterSigns=[];
  let dragging=null, moved=false, observer;
  let targets=null, colorCache=new Map();
  let physicalScene=null, frameTime=null;
  let immersive=false,fullscreenPending=false,pausedBeforeFullscreen=true;
  // 操作模式：orbit 环绕（默认）｜ fps 键鼠第一人称（Pointer Lock）｜ moba 触屏轮盘；joystickVec 为轮盘移动向量（x 右 y 前，-1..1）
  let controlMode='orbit',joystickVec=null,fpsHintTimer=null;
  const STATE_LABELS={HOME:'在家',SLEEPING:'休息',COMMUTE:'在途',AT_WORK:'工作 / 上课',LEISURE:'休闲',MEDICAL:'就医',SHOPPING:'购物 / 办事',DINING:'用餐'};
  const ROLE_LABELS={'preschooler':'学龄前儿童','student-p':'小学生','student-m':'中学生','student-u':'大学生',office:'职员',worker:'工人',shopkeeper:'店主',driver:'司机',teacher:'教师','school-admin':'学校行政','medical-doc':'医生','medical-nurse':'护士','hosp-admin':'医院行政',officer:'警员',clerk:'办事员',sanitation:'环卫人员',unemployed:'待业居民',patient:'住院居民',retiree:'退休居民',senior:'长者'};
  const BUILDING_LABELS={'h-courtyard':'庭院住宅','h-slab':'花园板楼','h-terrace':'退台公寓','h-point':'双塔住区','c-hospital':'社区医院','c-primary':'镇东小学','c-secondary':'未来中学','c-university':'城市大学','c-library':'社区图书馆','i-workshop':'轻工坊','i-depot':'物流场站','i-market':'批发市场','i-clinic-a':'花园板楼诊所','i-clinic-b':'退台公寓诊所','i-clinic-c':'双塔住区诊所','c-precinct':'警务室','i-waste':'环卫站','c-mall':'社区商场','c-annex-mall':'邻里商业','c-night-market':'河岸夜市','c-civic':'街道办事处','c-station':'公交与出租车站','c-amusement':'星光乐园','c-plaza':'城市广场','c-park-a':'西岸公园','c-park-b':'东岸公园','t-one':'北区办公楼','t-two':'银行商务楼','t-three':'东岸办公楼','t-four':'社区办公楼','c-bank':'社区银行'};
  const buildingLabel=id=>id==='street'?'在途中':(BUILDING_LABELS[id]||'未知地点');
  function currentSnapshot(day=dayClock().day){
    if(!snapshots.has(day)){
      const plans=town.residents.map(r=>CityPlans.buildDay(r,day,{seed:town.seed,town:town.town}));
      snapshots.set(day,CityPlanSnapshots.capture(town.seed,day,plans));

      if(snapshots.size>14)snapshots.delete(snapshots.keys().next().value);
    }
    return snapshots.get(day);
  }
  function walkingSelectionAt(seconds){
    const step=CityDailyClock.SECONDS_PER_SIM_MINUTE,absoluteMinute=Math.floor(seconds/step);
    if(!walkingSelections.has(absoluteMinute)){
      const day=Math.floor(absoluteMinute/1440)+1,minute=absoluteMinute%1440;
      const demand=CityTownView.sample(town,currentSnapshot(day),minute).demand;
      const frame=CityLife.sample(life,seconds,demand);
      walkingSelections.set(absoluteMinute,{
        pedestrians:frame.pedestrians.map(p=>({active:p.active,ledgerId:p.ledgerId})),
        shoppers:frame.shoppers.map(p=>({active:p.active,ledgerId:p.ledgerId})),
        riders:frame.riders.map(p=>({active:p.active,ledgerId:p.ledgerId}))});
      if(walkingSelections.size>512)walkingSelections.delete(walkingSelections.keys().next().value);
    }
    return walkingSelections.get(absoluteMinute);
  }
  function refreshTown(force=false){
    force=refreshFestival()||force;
    const clock=dayClock(),key=town.seed+':'+clock.day+':'+clock.minute;
    if(force||townKey!==key){
      const snapshot=currentSnapshot();snapshotIndex=CityPlanSnapshots.indexByOwner(snapshot);
      townView=CityTownView.sample(town,snapshot,clock.minute);
      const step=CityDailyClock.SECONDS_PER_SIM_MINUTE,start=Math.floor(state.daySeconds/step)*step;
      townView.demand.walking=CityLife.prepareWalking(life,start,start+step,walkingSelectionAt,townView.demand.maxPeople);
      state.lighting=CityLighting.sample(town.buildings,snapshot,clock.minute,townView);


      for(const [id,value] of Object.entries(townView.byBuilding)){
        value.lightLevel=state.lighting.buildings[id].room;
        value.maxPanes=state.lighting.buildings[id].maxPanes;
      }
      townKey=key;
      syncMinuteURL();
      windowLight.clock={dayType:clock.dayType,minute:clock.minute};
      for(const b of town.buildings)windowLight.policies.set(b.id,b.open||'daily');



      townView.festivalLevel=festivalLevel();
      townView.festivalName=state.festival&&state.festival.source==='lock'
        ?null:(state.festival&&state.festival.name);
      if(physicalScene)physicalScene.setTownView(townView,bindings);
    }
    return townView;
  }
  function setSimTime(next){
    const current=dayClock(),day=Math.max(1,Math.floor(Number(next.day)||current.day));
    const minute=clamp(Number.isFinite(Number(next.minute))?Number(next.minute):current.minute,0,1439);
    state.daySeconds=((day-1)*1440+minute)*CityDailyClock.SECONDS_PER_SIM_MINUTE;
    refreshTown(true);syncMinuteURL();if(physicalScene)physicalScene.invalidate();updateUI(true);
  }
  function observationBounds(id){
    let anchors;
    if(id==='neighborhood')anchors=[...bindings.locate('h-terrace'),...bindings.locate('c-secondary')];
    else anchors=bindings.locate(id);
    if(!anchors||!anchors.length)return null;
    if(id==='c-secondary'){const b=anchors[0];return {x:b.x-b.w/2-2,z:b.z,w:27,d:38,height:16};}
    const minX=Math.min(...anchors.map(a=>a.x-a.w/2)),maxX=Math.max(...anchors.map(a=>a.x+a.w/2));
    const minZ=Math.min(...anchors.map(a=>a.z-a.d/2)),maxZ=Math.max(...anchors.map(a=>a.z+a.d/2));
    return {x:(minX+maxX)/2+(id==='neighborhood'?18:0),z:(minZ+maxZ)/2,w:maxX-minX+(id==='neighborhood'?45:0),d:maxZ-minZ,height:Math.max(...anchors.map(a=>a.height||8))};
  }
  function observe(id){
    if(id!=='neighborhood'&&!town.town.byId[id])return false;
    if(id!=='neighborhood'){selectedBuilding=id;selectedResident=null;residentMode='present';}
    state.observation=id;state.focusFacility=null;state.focusBuilding=false;
    state.orbit=false;$('auto-orbit').checked=false;resetNavigation();
    const entry=bindings.byLedgerId[id]?.items[0];
    const gate=entry?.annex?.gate||CityFacilities.SITES.find(s=>s.facility===entry?.ref.facility)?.gate;
    const gateYaw={'z+':-.66,'z-':-2.45,'x+':1.05,'x-':-1.05}[gate];
    const closeViews={'h-courtyard':{yaw:-2.4,pitch:.58,zoom:1.1},'h-slab':{yaw:-2.4,pitch:.58,zoom:1.1},'h-terrace':{yaw:-2.4,pitch:.58,zoom:1.1},'h-point':{yaw:2.7,pitch:.58,zoom:1.1},'i-clinic-c':{yaw:-.95,pitch:.9,zoom:.85},'i-waste':{yaw:.65,pitch:.7,zoom:.85},'i-workshop':{yaw:1.05,pitch:.72,zoom:.94},'i-depot':{yaw:-.9,pitch:.72,zoom:.94}};
    const preset=closeViews[id]||(id==='c-civic'?{yaw:entry?.ref.side===1?-1.23:1.23,pitch:.72}:id==='c-hospital'||id==='c-bank'?{yaw:-2.45,pitch:.72}:id==='h-terrace'?{yaw:2.1,pitch:.58,zoom:1.15}:id==='c-night-market'?{yaw:2.7,pitch:.5,zoom:1}:id==='c-secondary'?{yaw:-1.18,pitch:.54,zoom:.82}:{yaw:gateYaw??1.05,pitch:.66});
    targets={zoom:1,...preset};lastPanelKey='';markView(null);
    if(physicalScene)physicalScene.invalidate();updateUI(true);return true;
  }
  function textElement(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
  const residentRows=new Map();
  let residentRowsKey='',residentDetailView=null;
  function updateResidentNameNotice(){
    let notice=$('resident-names-notice');
    if(residentNameSource.error&&!notice){
      notice=textElement('p','','hint');notice.id='resident-names-notice';notice.setAttribute('role','status');
      $('town-building').parentNode.insertBefore(notice,$('town-building'));
    }
    if(notice){notice.hidden=!residentNameSource.error;notice.textContent=residentNameSource.error||'';}
  }
  updateResidentNameNotice();
  function refreshResidentNames(){
    const source=CityResidentNames.loadRoster(()=>localStorage,town.residents.length);
    const signature=JSON.stringify(source.roster);
    const changed=signature!==residentNameSignature||source.error!==residentNameSource.error;
    residentNameSource=source;
    if(!changed)return {applied:town.stats.fans,error:source.error};
    const candidate=CityResidents.create({seed:town.seed,roster:source.roster});

    CityResidentNames.copyNameFields(town,candidate);
    residentNameSignature=signature;lastPanelKey='';


    for(const [id,row] of residentRows)row.firstElementChild.textContent=residentById.get(id).name;
    if(residentDetailView){
      const r=residentById.get(residentDetailView.id);
      $('resident-detail').firstElementChild.textContent=r.name+' · '+(ROLE_LABELS[r.role]||r.role);
    }
    updateResidentNameNotice();
    if(sketch)updateUI(true);
    return {applied:town.stats.fans,error:source.error};
  }
  window.addEventListener('storage',event=>{
    if(event.key===CityResidentNames.STORAGE_KEY||event.key===CityResidentNames.LEGACY_STORAGE_KEY||event.key===null)refreshResidentNames();
  });
  function updateTownPanel(){
    if(!$('town-building'))return;
    const v=refreshTown(),clock=dayClock();
    $('resident-count').textContent=String(town.residents.length);
    $('street-count').textContent=String(v.occupancy.street);
    $('day-prev').disabled=clock.day===1;
    const selector=$('town-building');
    if(selector.dataset.seed!==String(town.seed)){
      selector.replaceChildren(...town.buildings.map(b=>{const option=textElement('option',buildingLabel(b.id));option.value=b.id;return option;}));selector.dataset.seed=String(town.seed);
    }
    selector.value=selectedBuilding;
    const entry=v.byBuilding[selectedBuilding];if(!entry)return;
    const key=townKey+'|'+selectedBuilding+'|'+residentMode+'|'+selectedResident;
    if(lastPanelKey===key)return;lastPanelKey=key;
    $('building-name').textContent=buildingLabel(selectedBuilding);
    $('building-count').textContent=String(entry.presentIds.length);
    const residential=entry.kind==='housing';
    $('building-status').textContent=residential?(entry.awake?'有人活动':'安静休息'):(entry.open?'开放中':entry.working?'值班中':'休息中');
    $('building-activities').textContent=Object.entries(entry.byState).filter(([,n])=>n).map(([s,n])=>(STATE_LABELS[s]||s)+' '+n+'人').join(' · ')||'此刻无人';
    $('building-note').textContent=bindings.locate(selectedBuilding).length?(selectedBuilding==='c-night-market'?'人数为整条河岸夜市的合计。':''):'当前地图设置下未显示该建筑，可通过名单查看居民。';
    $('residents-home').hidden=!entry.homeIds.length;
    for(const [id,mode] of [['residents-present','present'],['residents-home','home']]){$(id).classList.toggle('is-active',residentMode===mode);$(id).setAttribute('aria-pressed',String(residentMode===mode));}
    const ids=residentMode==='home'?entry.homeIds:entry.presentIds;
    const list=$('resident-list'),scroll=list.scrollTop;
    const focused=list.contains(document.activeElement)?document.activeElement:null;
    const rowsKey=town.seed+'|'+selectedBuilding;
    if(residentRowsKey!==rowsKey){residentRows.clear();list.replaceChildren();residentRowsKey=rowsKey;}
    const wanted=new Set(ids);
    for(const [id,row] of residentRows)if(!wanted.has(id)){row.remove();residentRows.delete(id);}
    const empty=list.querySelector('.empty-note');if(empty&&ids.length)empty.remove();
    let next=list.firstElementChild;
    for(const id of ids){
      const r=residentById.get(id),s=CityResidentState.stateAt(snapshotIndex[id],clock.minute);
      let row=residentRows.get(id);
      if(!row){
        row=document.createElement('button');row.type='button';row.className='resident-row';row.dataset.resident=id;
        row.append(textElement('span',r.name),textElement('small',''));
        row.onclick=()=>{selectedResident=id;lastPanelKey='';updateTownPanel();};residentRows.set(id,row);
      }
      const label=STATE_LABELS[s.state],expanded=String(selectedResident===id);
      if(row.lastElementChild.textContent!==label)row.lastElementChild.textContent=label;
      if(row.getAttribute('aria-expanded')!==expanded)row.setAttribute('aria-expanded',expanded);
      if(row!==next)list.insertBefore(row,next);
      next=row.nextElementSibling;
    }
    if(!ids.length&&!empty)list.append(textElement('p','此刻没有居民在这里。','empty-note'));
    if(focused&&focused.isConnected&&document.activeElement!==focused)focused.focus({preventScroll:true});
    list.scrollTop=scroll;
    const detail=$('resident-detail');detail.hidden=!selectedResident;
    if(!selectedResident||!residentById.has(selectedResident)){
      if(detail.firstChild)detail.replaceChildren();residentDetailView=null;return;
    }
    const r=residentById.get(selectedResident),plan=snapshotIndex[r.id],s=CityResidentState.stateAt(plan,clock.minute);

    if(!residentDetailView||residentDetailView.id!==r.id||residentDetailView.plan!==plan){
      const status=textElement('p',''),heading=textElement('h4','今日计划'),schedule=document.createElement('ol');
      const locate=textElement('button','查看所在建筑','text-button');locate.type='button';
      const rows=plan.segments.map(seg=>textElement('li',CityDailyClock.format(seg.start)+'–'+(seg.end===1440?'24:00':CityDailyClock.format(seg.end))+' '+STATE_LABELS[seg.state]+' · '+buildingLabel(seg.location)));
      schedule.append(...rows);
      const view={id:r.id,plan,status,heading,locate,rows,location:s.location};
      locate.onclick=()=>observe(view.location);residentDetailView=view;
      detail.replaceChildren(textElement('h3',r.name+' · '+(ROLE_LABELS[r.role]||r.role)),status,heading,schedule);
    }
    const detailView=residentDetailView,statusText=r.age+'岁 · '+STATE_LABELS[s.state]+' · '+buildingLabel(s.location);
    if(detailView.status.textContent!==statusText)detailView.status.textContent=statusText;
    detailView.location=s.location;
    if(s.location!=='street'&&bindings.locate(s.location).length){
      if(detailView.locate.parentNode!==detail)detail.insertBefore(detailView.locate,detailView.heading);
    }else detailView.locate.remove();
    plan.segments.forEach((seg,i)=>{
      const current=clock.minute>=seg.start&&clock.minute<seg.end?'is-current':'';
      if(detailView.rows[i].className!==current)detailView.rows[i].className=current;
    });
  }


  const windowLight={
    clock:null,
    policies:new Map(),

    // dark with its last customer rather than with the sunset.
    satAmClose:840,
    open(id){
      const policy=this.policies.get(id)||'daily';
      const day=this.clock&&this.clock.dayType;
      if(!day||policy==='daily')return true;
      if(policy==='weekday')return day==='weekday';
      if(policy==='sat-am')return day==='weekday'||(day==='saturday'&&Number(this.clock.minute)<this.satAmClose);
      return true;                     // an unknown policy never invents a dark building
    },
    level(id){const row=townView&&townView.byBuilding[id==='hospital-ward'?'c-hospital':id];return row?row.lightLevel:(this.open(id)?1:0);},
    wings(){return physicalScene&&physicalScene.getInfo().windowLights||[];},
    sync(){
      if(!physicalScene)return this;
      for(const wing of this.wings())physicalScene.setWindowLight(wing.id,this.level(wing.id));
      return this;
    },
    policy(id,policy){this.policies.set(id,String(policy||'daily'));return this.sync();},
    setClock(next){this.clock=next&&next.dayType?{dayType:String(next.dayType),minute:Number(next.minute)}:null;return this.sync();},
    state(){return {clock:this.clock?{...this.clock}:null,policies:Object.fromEntries(this.policies),
      wings:this.wings().map(wing=>({id:wing.id,facility:wing.facility,panes:wing.panes,open:this.open(wing.id),lit:wing.lit}))};}
  };


  function zoomAt(factor,px,py,w,h,holdAnchor=true){
    const next=clamp(state.zoom*factor,MIN_ZOOM,MAX_ZOOM);
    const k=next/state.zoom;
    if(k===1)return;
    if(state.cameraYaw||state.cameraPitch){
      if(physicalScene){
        if(holdAnchor)physicalScene.captureZoomAnchor(px,py,w,h,state);
        else physicalScene.clearZoomAnchor();
        state.zoom=next;targets=null;return;
      }
      projection(w,h);const cx=view.cx,cy=view.cy;
      state.zoom=next;
      projection(w,h);const after=view;
      const right=(after.cx-(k*cx+(1-k)*px))/after.scale;
      const vertical=((k*cy+(1-k)*py)-after.cy)/after.scale;
      state.cameraX+=after.c*right-after.s*after.sp*vertical;
      state.cameraY+=after.cp*vertical;
      state.cameraZ+=-after.s*right-after.c*after.sp*vertical;
      targets=null;return;
    }
    state.panX=k*state.panX+(1-k)*(px-w*.5);
    state.panY=k*state.panY+(1-k)*(py-h*.5);
    state.zoom=next;targets=null;
  }






  const MOVEMENT_DIRS = {
    KeyW:['forward',1], ArrowUp:['forward',1], KeyS:['forward',-1], ArrowDown:['forward',-1],
    KeyA:['right',-1], ArrowLeft:['right',-1], KeyD:['right',1], ArrowRight:['right',1],
    KeyQ:['up',1], KeyE:['up',-1], KeyZ:['zoom',-1], KeyX:['zoom',1],
    KeyJ:['yaw',1], KeyL:['yaw',-1], KeyI:['pitch',-1], KeyK:['pitch',1],
    Equal:['zoom',1], Minus:['zoom',-1], NumpadAdd:['zoom',1], NumpadSubtract:['zoom',-1]
  };
  const KEY_FALLBACK = { w:'KeyW', a:'KeyA', s:'KeyS', d:'KeyD', q:'KeyQ', e:'KeyE', z:'KeyZ', x:'KeyX', j:'KeyJ', l:'KeyL', i:'KeyI', k:'KeyK',
    '=':'Equal', '-':'Minus', '+':'NumpadAdd', '_':'Minus',
    arrowup:'ArrowUp', arrowdown:'ArrowDown', arrowleft:'ArrowLeft', arrowright:'ArrowRight' };
  const heldKeys = new Set();
  let shiftHeld = false;
  const VIEW_SPEED={zoom:1.6,turn:.85};
  const LOOK_PITCH_MIN=-1.32,LOOK_PITCH_MAX=1.32;
  const viewVelocity={right:0,forward:0,up:0,zoom:0,yaw:0,pitch:0};
  function movementCode(event){
    if (MOVEMENT_DIRS[event.code]) return event.code;
    const alias = KEY_FALLBACK[String(event.key||'').toLowerCase()];
    return alias && MOVEMENT_DIRS[alias] ? alias : null;
  }
  function isEditableField(node){
    let el = node && node.nodeType === 1 ? node : node && node.parentElement;
    while (el) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) return true;
      el = el.parentElement;
    }
    return false;
  }
  function resetHeldKeys(){
    heldKeys.clear();shiftHeld=false;
    viewVelocity.right=0;viewVelocity.forward=0;viewVelocity.up=0;viewVelocity.zoom=0;viewVelocity.yaw=0;viewVelocity.pitch=0;
  }
  function resetNavigation(){
    if(physicalScene)physicalScene.clearZoomAnchor();
    state.cameraX=0;state.cameraY=0;state.cameraZ=0;state.cameraYaw=0;state.cameraPitch=0;state.panX=0;state.panY=0;state.flyTarget=null;state.focusAirship=false;resetHeldKeys();
  }
  document.addEventListener('keydown',e=>{
    if(e.code==='Escape'){resetHeldKeys();return;}
    if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||e.isComposing||document.hidden||
       isEditableField(e.target)||(e.composedPath&&e.composedPath().some(isEditableField))){resetHeldKeys();return;}
    if(e.code==='Space'){e.preventDefault();pause();}
    if(e.key.toLowerCase()==='r')chooseView('home');
    if(e.key==='0'){e.preventDefault();resetNavigation();targets=null;}
    if(e.key==='Shift'||e.code==='ShiftLeft'||e.code==='ShiftRight'){shiftHeld=true;}
    const dir=movementCode(e);
    if(!dir)return;
    e.preventDefault();
    state.orbit=false;$('auto-orbit').checked=false;targets=null;markView(null);
    heldKeys.add(dir);
  });
  document.addEventListener('keyup',e=>{
    if(e.key==='Shift'||e.code==='ShiftLeft'||e.code==='ShiftRight'){shiftHeld=false;}
    const dir=movementCode(e);
    if(dir)heldKeys.delete(dir);
  });
  addEventListener('blur',resetHeldKeys);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)resetHeldKeys();});



  function applyHeldKeys(dt){
    if(dt<=0)return;
    const boost=shiftHeld?2.5:1;
    function step(axis,want,speed){
      const target=want*speed*boost,ease=1-Math.exp(-dt*(want?18:28));
      viewVelocity[axis]+=(target-viewVelocity[axis])*ease;
      if(!want&&Math.abs(viewVelocity[axis])<.05)viewVelocity[axis]=0;
      return viewVelocity[axis]*dt;
    }
    const held=code=>heldKeys.has(code)?1:0;
    let right=(held('KeyD')||held('ArrowRight')?1:0)-(held('KeyA')||held('ArrowLeft')?1:0);
    let forward=(held('KeyW')||held('ArrowUp')?1:0)-(held('KeyS')||held('ArrowDown')?1:0);
    if(joystickVec){right+=joystickVec.x;forward+=joystickVec.y;}
    const up=held('KeyQ')-held('KeyE'),length=Math.max(1,Math.hypot(right,forward,up));
    const focus=state.observation?observationBounds(state.observation):CityPlaces.focus(city,state.focusFacility);
    const span=focus?Math.max(focus.w,focus.d,focus.height||8):state.focusBuilding?
      Math.max(...city.buildings.map(b=>b.floors*6)):Math.max(city.extentX,city.extentZ)*2;
    const speed=clamp(span*.45/state.zoom,5,160);
    const dr=step('right',right/length,speed),df=step('forward',forward/length,speed),du=step('up',up/length,speed);
    const dyaw=step('yaw',held('KeyJ')-held('KeyL'),VIEW_SPEED.turn),dpitch=step('pitch',held('KeyK')-held('KeyI'),VIEW_SPEED.turn);
    if((dr||df||du||dyaw||dpitch)&&physicalScene)physicalScene.clearZoomAnchor();
    if(dyaw||dpitch){
      state.cameraYaw+=dyaw;
      const wanted=state.pitch+state.cameraPitch+dpitch,next=clamp(wanted,LOOK_PITCH_MIN,LOOK_PITCH_MAX);
      state.cameraPitch=next-state.pitch;if(next!==wanted)viewVelocity.pitch=0;
    }
    const zoom=step('zoom',(held('KeyX')||held('Equal')||held('NumpadAdd')?1:0)-(held('KeyZ')||held('Minus')||held('NumpadSubtract')?1:0),VIEW_SPEED.zoom);
    if(dr||df||du){


      const heading=state.yaw+state.cameraYaw,c=Math.cos(heading),s=Math.sin(heading);
      state.cameraX+=dr*c-df*s;state.cameraZ-=dr*s+df*c;state.cameraY+=du;state.flyTarget=null;state.focusAirship=false;targets=null;
    }

    if(zoom&&sketch)zoomAt(Math.exp(zoom*.5),sketch.width*.5,sketch.height*.5,sketch.width,sketch.height,!(dr||df||du||dyaw||dpitch));
  }


  function rgb(hex) {
    if (!colorCache.has(hex)) colorCache.set(hex, [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)));
    return colorCache.get(hex);
  }
  function tint(hex, amount=0, alpha=1) {
    const target = amount >= 0 ? 255 : 30;
    const values=rgb(hex).map(v=>Math.round(mix(v,target,Math.abs(amount))));
    return `rgba(${values.join(',')},${alpha})`;
  }
  function raw(x,z,y=0) {
    const rx=x*view.c-z*view.s, depth=x*view.s+z*view.c;
    return [rx,depth*view.sp-y*view.cp,depth];
  }
  function point(x,z,y=0) {
    const p=raw(x,z,y);
    return [view.cx+p[0]*view.scale,view.cy+p[1]*view.scale];
  }
  function projection(w,h) {
    view={c:Math.cos(state.yaw),s:Math.sin(state.yaw),sp:Math.sin(state.pitch),cp:Math.cos(state.pitch)};
    const bounds=[];
    for(const x of [-city.extentX-5,city.extentX+5])for(const z of [-city.extentZ-5,city.extentZ+5])bounds.push(raw(x,z,-11));
    for(const b of city.buildings) {
      for(const x of [b.x-b.w/2,b.x+b.w/2])for(const z of [b.z-b.d/2,b.z+b.d/2])bounds.push(raw(x,z,b.floors*6+22));
    }
    if(window.CityAirship){const route=CityAirship.plan(city);for(const x of [-route.rx-40,route.rx+40])for(const z of [-route.rz-40,route.rz+40])for(const y of [route.altitude-25,route.altitude+25])bounds.push(raw(x,z,y));}
    const focus=!physicalScene&&(state.observation?observationBounds(state.observation):CityPlaces.focus(city,state.focusFacility));
    if(focus){
      bounds.length=0;
      for(const x of [focus.x-focus.w*.65,focus.x+focus.w*.65])for(const z of [focus.z-focus.d*.65,focus.z+focus.d*.65])for(const y of [0,focus.height||(focus.floors||0)*6+12])bounds.push(raw(x,z,y));
    }
    const xs=bounds.map(p=>p[0]),ys=bounds.map(p=>p[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const marginX=w<500?24:68,marginY=w<500?58:104;
    view.scale=Math.min((w-marginX)/(maxX-minX),(h-marginY)/(maxY-minY))*state.zoom;
    view.cx=w*.5-(minX+maxX)*.5*view.scale+state.panX;
    view.cy=h*.51-(minY+maxY)*.5*view.scale+state.panY;
    if(!physicalScene){
      if(state.focusAirship&&state.flyTarget){
        const anchor=raw(state.flyTarget.x,state.flyTarget.z,state.flyTarget.y);
        view.cx=w*.5-anchor[0]*view.scale;view.cy=h*.5-anchor[1]*view.scale;
      }
      if(state.cameraYaw||state.cameraPitch){


        const right=(w*.5-view.cx)/view.scale,vertical=(view.cy-h*.5)/view.scale;
        const distance=h/(2*view.scale*Math.tan(Math.PI/12))*1.01;
        const eyeX=view.c*right-view.s*view.sp*vertical+view.s*view.cp*distance+state.cameraX;
        const eyeY=view.cp*vertical+view.sp*distance+state.cameraY;
        const eyeZ=-view.s*right-view.c*view.sp*vertical+view.c*view.cp*distance+state.cameraZ;
        const yaw=state.yaw+state.cameraYaw,pitch=state.pitch+state.cameraPitch;
        view.c=Math.cos(yaw);view.s=Math.sin(yaw);view.sp=Math.sin(pitch);view.cp=Math.cos(pitch);
        view.cx=w*.5-(view.c*eyeX-view.s*eyeZ)*view.scale;
        view.cy=h*.5-((view.s*eyeX+view.c*eyeZ)*view.sp-eyeY*view.cp)*view.scale;
      }else{
        view.cx-=view.scale*(view.c*state.cameraX-view.s*state.cameraZ);
        view.cy-=view.scale*((view.s*state.cameraX+view.c*state.cameraZ)*view.sp-state.cameraY*view.cp);
      }
    }
  }
  function polygon(points, fill, stroke, width=.6) {
    ctx.beginPath();
    points.forEach((p,i)=>{const q=point(...p); i?ctx.lineTo(...q):ctx.moveTo(...q);});
    ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
  }
  function line(points,color,width=1) {
    ctx.beginPath(); points.forEach((p,i)=>{const q=point(...p);i?ctx.lineTo(...q):ctx.moveTo(...q);});
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();
  }
  function plane(x,z,w,d,y,color,stroke) {
    polygon([[x-w/2,z-d/2,y],[x+w/2,z-d/2,y],[x+w/2,z+d/2,y],[x-w/2,z+d/2,y]],color,stroke);
  }
  function cuboid(x,z,w,d,y,h,color,rotation=0,outline=false) {
    if(h<=0)return;
    const c=Math.cos(rotation),s=Math.sin(rotation);
    const corners=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(p=>[x+p[0]*c-p[1]*s,z+p[0]*s+p[1]*c]);
    const normals=[[0,-1],[1,0],[0,1],[-1,0]];
    const faces=[];
    for(let i=0;i<4;i++) {
      const n=normals[i],nx=n[0]*c-n[1]*s,nz=n[0]*s+n[1]*c;
      if(nx*view.s+nz*view.c < -.0001) continue;
      const a=corners[i],b=corners[(i+1)%4];
      const lit=nx*(-.55)+nz*(-.85);
      const shade=lit>0?-.035:-.15;
      const top=point(x,z,y+h)[1],bottom=point(x,z,y)[1];
      const gradient=ctx.createLinearGradient(0,top,0,bottom||top+1);
      gradient.addColorStop(0,tint(color,shade+.04));gradient.addColorStop(1,tint(color,shade-.025));
      faces.push({pts:[[...a,y],[...b,y],[...b,y+h],[...a,y+h]],fill:gradient,key:raw((a[0]+b[0])/2,(a[1]+b[1])/2)[2]});
    }
    faces.sort((a,b)=>a.key-b.key).forEach(f=>polygon(f.pts,f.fill,outline?'rgba(84,109,103,.18)':null,.65));
    polygon(corners.map(p=>[...p,y+h]),tint(color,.21),outline?'rgba(255,255,250,.64)':null,.7);
  }
  function wall(b,axis,u0,u1,y0,y1,color) {
    const xsign=view.s>=0?1:-1,zsign=view.c>=0?1:-1;
    if(axis==='x') {
      const x=b.x+xsign*(b.w*.5+.015);
      polygon([[x,b.z+u0,y0],[x,b.z+u1,y0],[x,b.z+u1,y1],[x,b.z+u0,y1]],color);
    } else {
      const z=b.z+zsign*(b.d*.5+.015);
      polygon([[b.x+u0,z,y0],[b.x+u1,z,y0],[b.x+u1,z,y1],[b.x+u0,z,y1]],color);
    }
  }
  function footprint(b,floor) {
    const setback=b.floors>=15&&b.kind==='glass';
    const upper=setback&&floor>=Math.floor(b.floors*.74);
    return {...b,x:b.x,z:b.z,w:b.w*(upper?.8:1),d:b.d*(upper?.86:1)};
  }
  function facilityPalette(b) {
    const civic=CityFacilities.civicPalette?.(b.facility);if(civic)return civic;
    const family={primary:'secondary',university:'secondary',library:'secondary',workshop:'mall',market:'mall','annex-mall':'mall',bank:'mall',depot:'hospital',clinic:'hospital',precinct:'hospital',waste:'hospital'}[b.facility]||b.facility;
    const palette={mall:{wall:'#c98775',glass:'#886e59',frame:'#e4c99b'},hospital:{wall:'#9ac5af',glass:'#557f69',frame:'#f1ecdb'},secondary:{wall:'#e6c47c',glass:'#92734d',frame:'#a55f48'}}[family];
    const office=window.CityDistrict?.officeProfile?.(b);
    return palette||(office?{...office,frame:office.trim}:null);
  }


  function architecture(b,sample,spec) {
    const facility=CityFacilities.architectureParts?.(b,spec);
    const office=window.CityDistrict?.officeParts?.(b)||[];
    const palette=facilityPalette(b)||{},level=townView.byBuilding[bindings.byMapId[b.id]]?.lightLevel||0;
    const doorTravel=townView.byBuilding[bindings.byMapId[b.id]]?.doorOpen||0;
    const colors={white:'#f1ecdb',glass:palette.glass||'#637a72',gold:'#d9b36b',cross:'#35967e',green:'#789181',terracotta:'#b17658',paving:'#d4cdc0',ivory:'#e6c47c',silver:'#b0b9b6'};
    const parts=(facility?.parts||[]).map((p,i)=>{
      const base={...p,roof:p.floor==='roof',y:1.4+(p.floor==='roof'?b.floors:p.floor)*6+p.y,color:p.material==='glass'&&((i*13)%31)/31<level?'#f6dcae':p.color||p.tint||colors[p.material]};
      // Door leaves answer the same snapshot as WebGL: slides move along the
      // facade, swings shrink toward the hinge side like a turned-out leaf.
      if(p.door&&doorTravel>0){
        if(p.door.slide){base.x+=p.door.slide[0]*doorTravel;base.z+=p.door.slide[1]*doorTravel;}
        else if(p.w>=p.d){const w2=p.w*(1-doorTravel*.86);base.x-=(p.w-w2)/2;base.w=w2;}
        else{const d2=p.d*(1-doorTravel*.86);base.z-=(p.d-d2)/2;base.d=d2;}
      }
      return base;
    }).concat(office);
    const visible=p=>{
      if(p.roof)return sample.complete;
      if(p.floor>=sample.builtFloors)return false;
      const mass=b.facility?{w:spec?.mw||b.w,d:spec?.md||b.d,z:spec?.mz||0}: {...footprint(b,p.floor),z:0};


      return (Math.abs(view.s)>.001&&p.x*Math.sign(view.s)+p.w/2>=mass.w/2-.6)||
        (Math.abs(view.c)>.001&&(p.z-mass.z)*Math.sign(view.c)+p.d/2>=mass.d/2-.6);
    };
    parts.filter(visible)
      .sort((a,c)=>raw(a.x,a.z,a.y)[2]-raw(c.x,c.z,c.y)[2])
      .forEach(p=>{
        const color=p.color||'#eee8d9';
        if(!p.tilt){cuboid(b.x+p.x,b.z+p.z,p.w,p.d,p.y-p.h/2,p.h,color);return;}

        const angle=p.tilt.z||0,c=Math.cos(angle),s=Math.sin(angle);
        const vertices=[];
        for(const y of [-p.h/2,p.h/2])for(const z of [-p.d/2,p.d/2])for(const x of [-p.w/2,p.w/2])vertices.push([b.x+p.x+x*c-y*s,b.z+p.z+z,p.y+x*s+y*c]);
        const faces=[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]];
        faces.map((indices,i)=>({points:indices.map(n=>vertices[n]),i})).sort((a,c)=>a.points.reduce((n,p)=>n+raw(...p)[2],0)-c.points.reduce((n,p)=>n+raw(...p)[2],0))
          .forEach(f=>polygon(f.points,tint(color,f.i===1?.16:-.08)));
      });
    for(const sign of facility?.signs||[]){
      if(sign.floor==='roof'?!sample.complete:sign.floor>=sample.builtFloors)continue;
      if(Math.sin(sign.rotationY)*view.s+Math.cos(sign.rotationY)*view.c<=0)continue;
      publicLabel(sign.text,b.x+sign.x,b.z+sign.z,1.4+(sign.floor==='roof'?b.floors:sign.floor)*6+sign.y,sign.ink,sign.background,1.7,true);
    }
  }
  function facade(b,y0,floors,kind,seed,palette=facilityPalette(b)) {
    if(floors<=0)return;
    const light=state.lighting&&state.lighting.buildings[b.ledgerId];
    const gate=/^(primary|university|library|workshop|depot|market)$/.test(b.facility)?CityFacilities.SITES.find(s=>s.facility===b.facility)?.gate:null;
    let litWindows=0;
    const paneLit=(floor,col,columns)=>!!light&&light.room>0&&litWindows<light.maxPanes&&
      ((floor*7+3)%Math.max(1,b.floors)+col/columns)/Math.max(1,b.floors)<light.room;
    for(const axis of ['x','z']) {
      const span=axis==='x'?b.d:b.w;
      if(kind==='glass') {
        for(let floor=0;floor<floors;floor++) {
          const y=y0+floor*6;
          wall(b,axis,-span/2,span/2,y+.16,y+.65,'rgba(245,248,239,.72)');
          const cols=Math.max(3,Math.round(span/6)),step=span/cols;
          for(let col=0;col<cols;col++)if(paneLit(floor,col,cols)){
            wall(b,axis,-span/2+col*step+.24,-span/2+(col+1)*step-.24,y+1.35,y+5.2,'#ffe0a4');litWindows++;
          }
        }
        const divisions=Math.max(3,Math.round(span/6));
        for(let i=1;i<divisions;i++) {
          const u=-span/2+i*span/divisions;
          wall(b,axis,u-.18,u+.18,y0,y0+floors*6,'rgba(228,245,235,.74)');
        }
        wall(b,axis,-span*.32,-span*.15,y0+.4,y0+floors*6-.3,'rgba(244,255,248,.19)');
        wall(b,axis,span*.16,span*.25,y0+.4,y0+floors*6-.3,'rgba(247,255,250,.13)');
        if(settings.dreamLight>0) {
          const center=Math.sin(state.time*.14+seed*.00001+(axis==='x'?1.3:0))*span*.31;
          const start=Math.max(-span/2,center-span*.18),end=Math.min(span/2,center+span*.18);
          const facePoint=u=>axis==='x'?point(b.x+(view.s>=0?1:-1)*b.w/2,b.z+u,y0):point(b.x+u,b.z+(view.c>=0?1:-1)*b.d/2,y0);
          const a=facePoint(start),c=facePoint(end),glimmer=ctx.createLinearGradient(...a,...c);
          glimmer.addColorStop(0,'rgba(255,239,182,0)');
          glimmer.addColorStop(.5,`rgba(255,248,204,${settings.dreamLight*.35})`);
          glimmer.addColorStop(1,'rgba(255,239,182,0)');
          wall(b,axis,start,end,y0+.5,y0+floors*6-.3,glimmer);
        }
      } else {
        const columns=Math.max(2,Math.round(span/7.6));
        const step=(span-4)/columns;
        for(let floor=0;floor<floors;floor++) {
          const y=y0+floor*6;
          const ledgerId=bindings.byMapId[b.id],level=townView.byBuilding[ledgerId]?.lightLevel||0;
          wall(b,axis,-span/2,span/2,y+.1,y+.55,palette?palette.frame:'rgba(255,255,250,.6)');
          if(axis==='z'&&gate===(view.c>=0?'z+':'z-'))continue; // Shared civic windows own the entrance face.
          for(let col=0;col<columns;col++) {
            const u=-span/2+2+col*step;
            const lit=paneLit(floor,col,columns);if(lit)litWindows++;
            const frame=palette?palette.frame:tint(settings.stone,.14),a=u+.45,c=u+step-1,m=(a+c)/2;
            wall(b,axis,a-.16,c+.16,y+1.14,y+4.71,frame);
            wall(b,axis,a,c,y+1.3,y+4.55,lit?'#ffe0a4':tint(palette?palette.glass:settings.glass,axis==='x'?-.14:-.025));
            wall(b,axis,a+.05,c-.05,y+4.40,y+4.48,'rgba(242,255,250,.25)');
            wall(b,axis,m-.055,m+.055,y+1.3,y+4.55,frame);
            wall(b,axis,a-.2,c+.2,y+1.14,y+1.3,frame);
          }
        }
      }
    }
  }
  function roof(b,y,kind,seed,palette) {
    const mineral=palette?palette.frame:settings.stone;
    cuboid(b.x,b.z,b.w+1.15,b.d+1.15,y,1.25,mineral);
    plane(b.x,b.z,b.w-3,b.d-3,y+1.3,'#d7ddd1');
    for(const z of [b.z-b.d/2,b.z+b.d/2])cuboid(b.x,z,b.w,.75,y+1.3,1.6,mineral);
    for(const x of [b.x-b.w/2,b.x+b.w/2])cuboid(x,b.z,.75,b.d,y+1.3,1.6,mineral);
    if(kind==='plain'||(b.facility&&CityFacilities.architectureParts?.(b).style))return;
    if(kind==='garden') {
      plane(b.x,b.z,b.w*.7,b.d*.62,y+1.35,'#b8c7a2');
      for(let i=0;i<3;i++)miniTree(b.x-b.w*.22+i*b.w*.2,b.z+b.d*.12,y+1.5,2.1,4.5);
      cuboid(b.x,b.z-b.d*.22,b.w*.45,3.5,y+1.4,2.5,'#e6dfcd');
    } else if(kind==='solar') {
      for(let i=0;i<3;i++) {
        const x=b.x-b.w*.23+i*b.w*.23;
        cuboid(x,b.z,b.w*.19,b.d*.44,y+1.4,.85,'#83aaa9',0,true);
        line([[x,b.z-b.d*.22,y+2.3],[x,b.z+b.d*.22,y+2.3]],'rgba(245,253,249,.65)',.6);
      }
    } else {
      cuboid(b.x-b.w*.18,b.z-b.d*.2,b.w*.32,b.d*.24,y+1.4,3.3,'#f3f1e6');
      cuboid(b.x+b.w*.22,b.z+b.d*.2,4.5,6,y+1.4,1.8,'#b6c6bf');
    }
  }
  const canvasFacadeMessages={city:null,byHost:new Map(),screens:new Map()};
  function officeFacadeMessage(b,sample){
    const level=state.lighting?.buildings?.[b.ledgerId]?.facade||0;
    if(!sample.complete||level<=0||typeof CityScene==='undefined')return;
    if(canvasFacadeMessages.city!==city){canvasFacadeMessages.city=city;canvasFacadeMessages.byHost=new Map(CityScene.facadeMediaPlan(city).map(p=>[p.host,p]));}
    const screen=canvasFacadeMessages.byHost.get(b);if(!screen)return;
    ctx.save();const alpha=ctx.globalAlpha;ctx.globalCompositeOperation='screen';ctx.shadowBlur=0;
    const clock=CityScene.facadeScreenFrame(screen.mode,state.daySeconds),frame=screen.mode>=3?screen.mode:clock.frame,mask=screen.frames[frame];
    for(const face of screen.surfaces){
      const c=Math.cos(face.angle),s=Math.sin(face.angle);if(c*view.c+s*view.s<=0)continue;
      const project=(u,y)=>point(b.x+face.local[0]+c*u,b.z+face.local[2]-s*u,y),bottom=face.local[1]-face.height/2;
      ctx.globalAlpha=alpha*level*.85;ctx.strokeStyle=screen.tint;ctx.lineWidth=Math.max(.35,face.width/face.columns*view.scale*.32);
      // Canvas uses the same host-attached curtain; the GPU supplies diode detail.
      for(let col=0;col<face.columns;col++){
        const u=((col+.5)/face.columns-.5)*face.width,p=project(u,bottom),q=project(u,bottom+face.height);
        ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();
      }
      const [rx,ry,rw,rh]=face.region;if(!rw)continue;ctx.globalAlpha=alpha*level;
      for(let row=0;row<105;row++)for(let col=0;col<24;col++)if(mask[row*24+col]){
        const line=Math.floor((row-(frame===0||frame===3?13:0))/27),phase=clock.phase%6;
        if(frame<2&&phase<Math.max(0,line)*(frame===0?.55:.38)+.12)continue;
        const p=project((rx+(col+.5)/24*rw-.5)*face.width,bottom+(ry+(1-(row+.5)/105)*rh)*face.height);
        ctx.fillStyle=frame===3&&line===1?'#ff3452':screen.mode>=3?'#b2edff':'#fff0b3';ctx.beginPath();ctx.arc(p[0],p[1],Math.max(.35,face.width*rw/24*view.scale*.3),0,Math.PI*2);ctx.fill();
      }
    }
    ctx.restore();
  }

  function building(b,sample) {
    const original=b,spec=CityFacilities.SITES.find(s=>s.facility===b.facility)||city.annexes?.find(a=>a.id===b.id);
    if(spec?.mw)b={...b,w:spec.mw,d:spec.md,z:b.z+(spec.mz||0)};
    const palette=facilityPalette(b),color=palette?(b.kind==='glass'?palette.glass:palette.wall):b.kind==='glass'?settings.glass:b.kind==='sand'?'#dec8ab':settings.stone;
    cuboid(b.x,b.z,b.w+3.2,b.d+3.2,.1,1.35,'#f1eee3');
    if(sample.builtFloors) {
      const cut=b.kind==='glass'&&b.floors>=15?Math.floor(b.floors*.74):b.floors;
      const low=Math.min(sample.builtFloors,cut);
      cuboid(b.x,b.z,b.w,b.d,1.4,low*6-.3,color,0,true);
      facade(b,1.4,low,b.kind,b.detailSeed);
      if(sample.builtFloors>cut) {
        cuboid(b.x,b.z,b.w+1.3,b.d+1.3,cut*6+1.1,.85,settings.stone);
        const top=footprint(b,cut);
        cuboid(top.x,top.z,top.w,top.d,cut*6+1.4,(sample.builtFloors-cut)*6-.3,color,0,true);
        facade({...b,...top},cut*6+1.4,sample.builtFloors-cut,b.kind,b.detailSeed,palette);
      }
      const f=footprint(b,sample.builtFloors-1);
      if(sample.complete){
        roof({...b,...f},sample.height+1.15,b.roof,b.detailSeed,palette);
        if(b.facility){
          const y=sample.height+4;
          if(b.facility==='hospital'){
            plane(b.x,b.z,10,3,y,'#35967e');plane(b.x,b.z,3,10,y+.02,'#35967e');
          }else if(b.facility==='mall')cuboid(b.x,b.z,20,25,y,.8,palette.glass);
          else if(b.facility==='secondary'&&!CityFacilities.architectureParts?.(original,spec).style)cuboid(b.x,b.z,24,18,y,.8,'#a95f47');
          if(!CityFacilities.architectureParts?.(original,spec).style){
          const sign=point(b.x,b.z,y+6);
          ctx.save();ctx.font=`600 ${Math.min(22,Math.max(10,view.scale*3.2))}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
          const label=(city.facilities||[]).find(f=>f.id===b.id)?.name||b.label;
          const width=ctx.measureText(label).width+12;
          ctx.fillStyle='#f5f4e9';ctx.fillRect(sign[0]-width/2,sign[1]-9,width,18);
          ctx.fillStyle=b.facility==='hospital'?'#267969':b.facility==='secondary'?'#875747':'#4b555c';ctx.fillText(label,...sign);ctx.restore();
          canvasLetterSigns.push({text:label,x:sign[0],y:sign[1],size:Math.min(22,Math.max(10,view.scale*3.2))});
          }
        }
      }
      else {
        plane(f.x,f.z,f.w+.7,f.d+.7,sample.height+1.3,tint(settings.stone,.18),'rgba(115,147,134,.2)');
        if(sample.flash>0)plane(f.x,f.z,f.w+1.6,f.d+1.6,sample.height+1.36,`rgba(251,214,155,${sample.flash*.42})`);
      }
      architecture(original,sample,spec);
      if(/^t-(one|two|three|four)$/.test(b.ledgerId))officeFacadeMessage(b,sample);
    } else {
      ctx.setLineDash([2,3]);
      plane(b.x,b.z,b.w,b.d,1.5,null,'rgba(116,142,129,.36)');
      ctx.setLineDash([]);
    }
  }
  function housingPaintAPI(b){return {ctx,view,point,raw,plane,cuboid,line,wall,miniTree,publicBench,publicLabel,tint,townView,bindings,entryLevel:state.lighting?.buildings[b.ledgerId]?.entry||0,doorTravel:()=>townView.byBuilding[bindings.byMapId[b.id]||b.ledgerId]?.doorOpen||0};}
  function fallingModule(b,module) {
    const f=footprint(b,module.floor),y=module.y+1.4;
    ctx.save();ctx.globalAlpha*=module.opacity;
    const palette=facilityPalette(b),color=palette?(b.kind==='glass'?palette.glass:palette.wall):b.kind==='glass'?settings.glass:b.kind==='sand'?'#dec8ab':settings.stone;
    const height=5.65;
    cuboid(f.x,f.z,f.w,f.d,y,height,color,module.rotation,true);
    if(Math.abs(module.rotation)<.015)facade(f,y,1,b.kind,b.detailSeed,palette);
    cuboid(f.x,f.z,f.w+.3,f.d+.3,y+height,.45,palette?palette.frame:settings.stone,module.rotation);
    if(module.progress>.07&&module.progress<.82) {
      const alpha=(1-module.progress)*.26;
      for(const dx of [-f.w*.36,f.w*.36])line([[f.x+dx,f.z,y+8],[f.x+dx,f.z,y+18]],`rgba(155,174,160,${alpha})`,.8);
    }
    ctx.restore();
  }
  function roofLight(b,sample) {
    if(settings.dreamLight<=0||sample.builtFloors<3||!(b.kind==='glass'||b.detailSeed%9===0))return;
    const f=footprint(b,sample.builtFloors-1),pulse=Math.pow(.5+.5*Math.sin(state.time*.58+b.detailSeed*.00001),5);
    const p=point(f.x+(view.s>=0?1:-1)*f.w*.48,f.z+(view.c>=0?1:-1)*f.d*.48,sample.height+2.9);
    CityLight.spark(ctx,p[0],p[1],view.scale*(7+pulse*2),settings.dreamLight*(.24+pulse*.6),true,true);
    if(b.kind==='glass') {
      const level=Math.max(1,Math.floor(sample.builtFloors*.67)),wall=footprint(b,level);
      const face=Math.abs(view.c)>=Math.abs(view.s)?point(wall.x+wall.w*.17,wall.z+(view.c>=0?1:-1)*(wall.d/2+.04),level*6+2):point(wall.x+(view.s>=0?1:-1)*(wall.w/2+.04),wall.z-wall.d*.14,level*6+2);
      CityLight.spark(ctx,face[0],face[1],view.scale*12,settings.dreamLight*(.42+pulse*.38),true,true);
    }
  }
  function floatingLight(samples,fade) {
    if(settings.dreamLight<=0)return;
    const boxes=[];
    city.buildings.forEach((b,i)=>{
      const sample=samples[i],cut=b.kind==='glass'&&b.floors>=15?Math.floor(b.floors*.74):b.floors;
      if(sample.builtFloors>0)boxes.push({...b,y:1.4,h:Math.min(sample.builtFloors,cut)*6+(sample.builtFloors<=cut?3:0)});
      if(sample.builtFloors>cut)boxes.push({...footprint(b,cut),y:cut*6+1.4,h:(sample.builtFloors-cut)*6+3});
      sample.falling.forEach(m=>{const f=footprint(b,m.floor),c=Math.abs(Math.cos(m.rotation)),s=Math.abs(Math.sin(m.rotation));boxes.push({...f,w:f.w*c+f.d*s,d:f.d*c+f.w*s,y:m.y+1.4,h:6.1});});
    });
    const direction={x:view.s*view.cp,y:view.sp,z:view.c*view.cp};
    ctx.save();ctx.globalAlpha=fade;
    CityLight.sample(lightMotes,state.time).forEach(m=>{
      if(CityLight.isOccluded(m,boxes,direction))return;
      const p=point(m.x,m.z,m.y);
      CityLight.spark(ctx,p[0],p[1],view.scale*m.size*5.5,m.alpha*settings.dreamLight,m.warm,m.star);
    });
    ctx.restore();
  }
  function waterLight() {
    if(settings.dreamLight<=0)return;
    ctx.save();ctx.beginPath();
    [[-14.7,-167,-.4],[14.7,-167,-.4],[14.7,167,-.4],[-14.7,167,-.4]].forEach((v,i)=>{const p=point(...v);i?ctx.lineTo(...p):ctx.moveTo(...p);});
    ctx.closePath();ctx.clip();
    for(let i=0;i<24;i++) {
      const z=-158+i*13.6,x=Math.sin(i*3.27)*10;
      const pulse=Math.pow(.5+.5*Math.sin(state.time*.82+i*1.7),7)*settings.dreamLight;
      if(pulse<.05)continue;
      const p=point(x,z,-.4);
      CityLight.spark(ctx,p[0],p[1],view.scale*5,pulse*.74,i%3===0,i%5===0);
      line([[x-2.5,z,-.38],[x+2.5,z+.8,-.38]],`rgba(255,250,205,${pulse*.85})`,Math.max(.7,view.scale*.45));
    }
    ctx.restore();
  }
  function miniTree(x,z,y,r,h) {
    line([[x,z,y],[x,z,y+h*.8]],'#aa9b7d',Math.max(.6,view.scale*.8));
    const p=point(x,z,y+h),radius=r*view.scale;
    const gradient=ctx.createRadialGradient(p[0]-radius*.38,p[1]-radius*.45,0,p[0],p[1],radius*1.25);
    gradient.addColorStop(0,'#c1d4a9');gradient.addColorStop(.64,'#a6bf94');gradient.addColorStop(1,'#829f80');
    ctx.fillStyle=gradient;ctx.beginPath();ctx.ellipse(p[0],p[1],radius,radius*1.12,0,0,Math.PI*2);ctx.fill();
  }
  function bridge(b) {
    cuboid(b.x,b.z,b.w,b.d,-.5,2.4,'#eeeadf');
    plane(b.x,b.z,b.w,b.d-4,1.95,'#d9ded4');
    for(const side of [-1,1]) {
      const near=b.x+side*b.w/2,far=near+side*10;
      polygon([[near,b.z-b.d/2,1.9],[far,b.z-b.d/2,.25],[far,b.z+b.d/2,.25],[near,b.z+b.d/2,1.9]],'#eeeadf');
      polygon([[near,b.z-b.d/2+2,1.96],[far,b.z-b.d/2+2,.3],[far,b.z+b.d/2-2,.3],[near,b.z+b.d/2-2,1.96]],'#d9ded4');
      for(const bankSide of [-1,1]) {
        const z=b.z+bankSide*b.d/2,zEnd=z+bankSide*4;
        polygon([[near-2.4,z,1.96],[near+2.4,z,1.96],[near+2.4,zEnd,.3],[near-2.4,zEnd,.3]],'#eeeadf');
      }
    }
  }
  function bridgeRail(x,z,length) {
    line([[x,z,4.4],[x+length,z,4.4]],'#a7b6aa',Math.max(.7,view.scale*.5));
    line([[x,z,1.9],[x,z,4.4]],'#b9c5b7',Math.max(.55,view.scale*.35));
    line([[x+length,z,1.9],[x+length,z,4.4]],'#b9c5b7',Math.max(.55,view.scale*.35));
  }
  function viaduct(v) {


    cuboid(0,v.z,v.flatX*2,v.d,v.height-.8,.55,'#eeeadf');
    plane(0,v.z,v.flatX*2,v.d-3.6,v.height,'#d9ded4');
    for(const side of [-1,1]) {
      const near=side*v.flatX,far=near+side*v.rampX;
      polygon([[near,v.z-v.d/2,v.height],[far,v.z-v.d/2,.25],[far,v.z+v.d/2,.25],[near,v.z+v.d/2,v.height]],'#eeeadf');
      polygon([[near,v.z-v.d/2+2,v.height+.06],[far,v.z-v.d/2+2,.3],[far,v.z+v.d/2-2,.3],[near,v.z+v.d/2-2,v.height+.06]],'#d9ded4');
    }


    const citySide=v.z<0?1:-1;
    for(let i=0;i<20;i++){
      const minute=state.lighting?.minute||0,quiet=minute<360?.45:1-.55*Math.max(0,Math.min(1,(minute-1320)/60));
      plane(-v.flatX+6+i*12+6,v.z+citySide*7.1,11.6,.8,v.height+.012,
        `rgba(155,183,201,${(state.lighting?.lamps||0)*quiet*.75})`);
    }
  }
  function car(v) {
    const c=Math.cos(v.heading),s=Math.sin(v.heading),van=v.kind==='van',shuttle=v.kind==='shuttle';
    const length=shuttle?9:van?8.7:v.kind==='compact'?7.2:8,bodyHeight=van||shuttle?1.75:1.35;
    const local=(x,z,y)=>[v.x+x*c-z*s,v.z+x*s+z*c,v.y+y];
    const block=(x,z,w,d,y,h,color)=>{
      const a=local(x,z,y);cuboid(a[0],a[1],w,d,a[2],h,color,v.heading,true);
    };
    polygon([local(-length*.54,-2,.06),local(length*.55,-2,.06),local(length*.55,2.25,.06),local(-length*.54,2.25,.06)],'rgba(73,100,83,.18)');
    for(const x of [-length*.3,length*.3])for(const z of [-1.69,1.69])block(x,z,1.25,.6,.15,.95,'#52635f');
    block(0,0,length,3.45,.6,bodyHeight,v.color);
    const cabinLength=shuttle?7.7:van?5.8:3.9,cabinX=van?-.55:-.3,roofY=.6+bodyHeight+1.03;
    block(.6,-.7,.5,.45,2.03,.45,'#ce9b79');
    ctx.save();ctx.globalAlpha*=.28;block(cabinX,0,cabinLength,2.9,.6+bodyHeight,.98,'#a7d2dc');ctx.restore();
    block(cabinX,0,cabinLength-.7,2.65,roofY,.22,v.color);
    if(v.police){
      // The bar: one red lamp and one blue, over the roof.
      for(const [lamp,dx] of [[-1,.9],[1,-.9]]){
        const a=local(dx,lamp*.5,roofY+.02),b=local(dx+.9,lamp*.6,roofY+.24);
        polygon([a,[b[0],b[1],b[2]],local(dx+.9,lamp*1.1,roofY+.24),local(dx,lamp*1.0,roofY+.02)],
          lamp>0?'#3a6fbf':'#d2473c');
      }
    }
    if(state.lighting&&state.lighting.lamps){
      const a=local(length/2+2.6,0,.27);
      ctx.save();ctx.globalAlpha=state.lighting.lamps*.5;plane(a[0],a[1],5.8,3.6,a[2],'#ffe5ad');ctx.restore();
    }
    for(const side of [-1,1]) {
      const z=side*1.47;
      line([local(cabinX,z,.6+bodyHeight),local(cabinX,z,roofY)],tint(v.color,.12),Math.max(.5,view.scale*.24));
      const facing=c*view.s+s*view.c;
      if(facing>0)polygon([local(length/2+.02,side*.7,1),local(length/2+.02,side*1.38,1),local(length/2+.02,side*1.38,1.43),local(length/2+.02,side*.7,1.43)],'#fff0b9');
      if(facing<0)polygon([local(-length/2-.02,side*.83,1),local(-length/2-.02,side*1.4,1),local(-length/2-.02,side*1.4,1.4),local(-length/2-.02,side*.83,1.4)],'#b97155');
    }
  }
  const canvasPersonPose={legs:new Array(18),arms:new Array(18)};
  function pedestrian(person) {
    const size=person.size||1,personScale=view.scale*size,pose=CityScene.personPose(person,canvasPersonPose);
    const forward=[Math.cos(person.heading),Math.sin(person.heading)],side=[-forward[1],forward[0]];
    const local=(along,across,y)=>[person.x+(along*forward[0]+across*side[0])*size,person.z+(along*forward[1]+across*side[1])*size,person.y+y*size];
    const shadow=point(person.x+.5,person.z+.3,person.y+.04);
    ctx.fillStyle='rgba(80,106,89,.19)';ctx.beginPath();ctx.ellipse(shadow[0],shadow[1],.85*personScale,.4*personScale,0,0,Math.PI*2);ctx.fill();
    for(let i=0;i<2;i++){
      const k=i*9;
      line([local(...pose.legs.slice(k,k+3)),local(...pose.legs.slice(k+3,k+6)),local(...pose.legs.slice(k+6,k+9))],'#354646',Math.max(.4,personScale*.29));
      line([local(...pose.arms.slice(k,k+3)),local(...pose.arms.slice(k+3,k+6)),local(...pose.arms.slice(k+6,k+9))],person.color,Math.max(.4,personScale*.26));
      line([local(pose.legs[k+6]-.08,pose.legs[k+7],pose.legs[k+8]),local(pose.legs[k+6]+.28,pose.legs[k+7],pose.legs[k+8])],'#354646',Math.max(.4,personScale*.27));
    }
    line([local(0,0,1.7+pose.bob),local(pose.lean,0,3.02+pose.bob)],person.color,Math.max(.7,personScale*.89));
    if(pose.pack)line([local(-.36,0,2.07+pose.bob),local(-.36,0,2.89+pose.bob)],'#354646',Math.max(.6,personScale*.65));
    const head=point(...local(pose.lean,0,pose.headY)),radius=Math.max(.35,personScale*.38);
    ctx.fillStyle='#c99977';ctx.beginPath();ctx.ellipse(head[0],head[1],radius,radius*1.08,0,0,Math.PI*2);ctx.fill();
  }


  // Pets, riders
  function pet(p) {
    const size=p.size||1,scale=view.scale*size;
    const c=Math.cos(p.heading),s=Math.sin(p.heading),step=Math.sin(p.phase);
    const local=(along,across,y)=>[p.x+(along*c-across*s)*size,p.z+(along*s+across*c)*size,p.y+y*size];
    const shadow=point(p.x+.6,p.z+.4,p.y+.04);
    ctx.fillStyle='rgba(80,106,89,.17)';ctx.beginPath();ctx.ellipse(shadow[0],shadow[1],.95*scale,.42*scale,0,0,Math.PI*2);ctx.fill();
    const body=p.kind==='dog'?[1.7,.62,.95]:[1.35,.55,.72];
    const width=Math.max(.35,scale*body[1]);
    for(const side of [-1,1])for(const axle of [-1,1])line([local(axle*.5*body[0]/1.7,side*.24,body[2]*.95),local(axle*.5*body[0]/1.7+side*step*.22,side*.26,.06)],'#53665e',Math.max(.3,scale*.16));
    line([local(-body[0]*.5,0,body[2]),local(body[0]*.9,0,body[2])],p.color,width);
    line([local(-body[0]*.45,0,body[2]+.1),local(-body[0]*.95,0,body[2]+.6+step*.2)],p.color,Math.max(.3,scale*.13));
    const head=point(...local(body[0]*1.05,0,body[2]+.34)),radius=Math.max(.32,scale*.34);
    ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(head[0],head[1],radius,0,Math.PI*2);ctx.fill();
  }
  function rider(r) {
    const scale=view.scale,forward=[Math.cos(r.heading),Math.sin(r.heading)],side=[-forward[1],forward[0]];
    const powered=r.kind!=='bicycle',length=powered?4.6:3.9;
    const local=(along,across,y)=>[r.x+(along*forward[0]+across*side[0]),r.z+(along*forward[1]+across*side[1]),r.y+y];
    const shadow=point(r.x+.8,r.z+.5,r.y+.04);
    ctx.fillStyle='rgba(80,106,89,.18)';ctx.beginPath();ctx.ellipse(shadow[0],shadow[1],length*.5*scale,.4*scale,0,0,Math.PI*2);ctx.fill();
    for(const axle of [-1,1]){const w=point(...local(axle*length*.32,0,.46));ctx.strokeStyle='#3c4a44';ctx.lineWidth=Math.max(.5,scale*.3);ctx.beginPath();ctx.arc(w[0],w[1],.46*scale,0,Math.PI*2);ctx.stroke();}
    line([local(-length*.32,0,.5),local(length*.32,0,.5)],'#7d8f96',Math.max(.4,scale*.24));
    if(powered)line([local(-length*.2,0,.95),local(length*.34,0,.95)],r.color,Math.max(.5,scale*.5));
    line([local(-.3,0,1.5),local(.1,0,2.45)],r.color,Math.max(.6,scale*.9));
    const head=point(...local(.22,0,2.92)),radius=Math.max(.4,scale*.5);
    ctx.fillStyle='#e2bc98';ctx.beginPath();ctx.arc(head[0],head[1],radius,0,Math.PI*2);ctx.fill();
    for(const s2 of [-1,1])line([local(.16,s2*.3,2.34),local(.86,s2*.34,2.06)],r.color,Math.max(.4,scale*.3));
  }
  function balloon(b) {
    const scale=view.scale,anchor=point(b.x,b.z,b.y);
    const foot=point(b.x-b.radius*.9,b.z-b.radius*.9,b.y-5.3);
    line([[b.x-b.radius*.9,b.z-b.radius*.9,b.y-5.3],[b.x,b.z,b.y-b.radius]],'rgba(70,86,92,.55)',Math.max(.3,scale*.08));
    ctx.fillStyle=b.color;ctx.beginPath();ctx.ellipse(anchor[0],anchor[1],b.radius*1.02*scale,b.radius*1.14*scale,0,0,Math.PI*2);ctx.fill();
  }
  function boat(z,time,index) {
    const x=index?-5:5, y=-.8+Math.sin(time*.8+index)*.13;
    polygon([[x-2.6,z+6,y],[x+2.6,z+6,y],[x+2.6,z-3,y],[x,z-7,y],[x-2.6,z-3,y]],'#f7f2df');
    cuboid(x,z,3.5,5,y,.85,index?'#d2aa89':'#a8bdb2');
    for(let i=0;i<3;i++)line([[x-2-i*.7,z+8+i*2,-1],[x+2+i*.7,z+8+i*2,-1]],'rgba(241,255,248,.5)',.7);
  }
  function playground2D(site) {
    const oval=(r,y)=>{
      const points=[];
      for(let i=0;i<=36;i++){const a=i*Math.PI/36;points.push([site.x+r*Math.cos(a),site.z+site.trackHalfStraight+r*Math.sin(a),y]);}
      for(let i=0;i<=36;i++){const a=Math.PI+i*Math.PI/36;points.push([site.x+r*Math.cos(a),site.z-site.trackHalfStraight+r*Math.sin(a),y]);}
      return points;
    };
    const inner=site.trackRadius-site.lanes*site.laneWidth;
    polygon(oval(site.trackRadius+.65,.28),'#dce7ee');
    polygon(oval(site.trackRadius,.30),'#be604e');
    polygon(oval(inner,.31),'#5f9448');
    for(let lane=0;lane<=site.lanes;lane++){const p=oval(inner+lane*site.laneWidth,.33);line([...p,p[0]],'#f3f1e4',Math.max(.35,view.scale*.08));}
    for(let band=0;band<8;band+=2)plane(site.x,site.z-site.pitchD/2+(band+.5)*site.pitchD/8,site.pitchW,site.pitchD/8,.34,'#73a257');
    const pitch=[[site.x-site.pitchW/2,site.z-site.pitchD/2,.36],[site.x+site.pitchW/2,site.z-site.pitchD/2,.36],[site.x+site.pitchW/2,site.z+site.pitchD/2,.36],[site.x-site.pitchW/2,site.z+site.pitchD/2,.36]];
    line([...pitch,pitch[0]],'#f3f1e4',Math.max(.4,view.scale*.1));
    line([[site.x-site.pitchW/2,site.z,.36],[site.x+site.pitchW/2,site.z,.36]],'#f3f1e4',Math.max(.4,view.scale*.1));
    const circle=[];for(let i=0;i<=48;i++){const a=i*Math.PI/24;circle.push([site.x+2.4*Math.cos(a),site.z+2.4*Math.sin(a),.36]);}
    line(circle,'#f3f1e4',Math.max(.4,view.scale*.1));
    for(const side of [-1,1]){const z=site.z+side*(site.pitchD/2+.18);for(const post of [-1,1])cuboid(site.x+post*2.5,z,.16,.16,.35,2.6,'#f3f1e4');cuboid(site.x,z,5.16,.16,2.79,.16,'#f3f1e4');}
  }
  // Compact Canvas counterparts retain each public place when WebGL is unavailable.
  function publicLabel(text,x,z,y,ink='#42685d',paper='#eee8d3',fontHeight=1.7,litLetters=false) {
    const p=point(x,z,y),size=clamp(view.scale*fontHeight,6,18);
    ctx.save();ctx.font=`600 ${size}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    const width=ctx.measureText(text).width+size*.65;
    ctx.fillStyle=paper;ctx.fillRect(p[0]-width/2,p[1]-size*.68,width,size*1.36);
    ctx.fillStyle=ink;ctx.fillText(text,...p);ctx.restore();
    if(litLetters)canvasLetterSigns.push({text,x:p[0],y:p[1],size});
  }
  function roundPaving(x,z,r,y,color,fill=false) {
    const points=[];for(let i=0;i<=64;i++){const a=i*Math.PI/32;points.push([x+r*Math.cos(a),z+r*Math.sin(a),y]);}
    if(fill)polygon(points,color);else line(points,color,Math.max(.35,view.scale*.13));
  }
  function publicPlaceGround(site) {
    plane(site.x,site.z,site.w,site.d,.27,site.kind==='station'?'#65736e':'#ded8cb');
    if(site.kind==='station') {
      const side=site.gateSide||1,x=v=>site.x+side*v,z=v=>site.z+side*v;
      plane(x(-5),z(-23),40,9,.3,'#eee8d9');plane(x(-5),z(25.7),40,3.8,.3,'#eee8d9');
      const bay=(x,z,w,d)=>line([[x-w/2,z-d/2,.31],[x-w/2,z+d/2,.31],[x+w/2,z+d/2,.31],[x+w/2,z-d/2,.31]],'#f3edd8',Math.max(.35,view.scale*.14));
      [-17,-5,7].forEach(v=>bay(x(v),z(-7),7,16));[-18,-8,2,12].forEach(v=>bay(x(v),z(18),6,9));
      for(let v=-24;v<=24;v+=6)plane(x(17.2),z(v),.15,2.8,.31,'#ecc654');
      for(const [v,sign] of [[-13,-1],[13,1]]){
        line([[x(20),z(v),.32],[x(24),z(v),.32]],'#f3edd8',Math.max(.45,view.scale*.2));
        const tip=22+sign*2;line([[x(tip-sign*1.2),z(v-.8),.32],[x(tip),z(v),.32],[x(tip-sign*1.2),z(v+.8),.32]],'#f3edd8',Math.max(.45,view.scale*.2));
      }
    } else {
      roundPaving(site.x,site.z,site.kind==='plaza'?18.25:20.2,.29,'#eee8d9',true);
      for(const radius of site.kind==='plaza'?[5.8,11.8,17.75]:[6,17.7,20])roundPaving(site.x,site.z,radius,.31,'#c5c1b5');
    }
  }
  function publicBench(x,z,side=1) {
    for(const side of [-1,1])cuboid(x+side*1.8,z,.25,1.35,.28,.8,'#526c71');
    cuboid(x,z,4.7,1.35,1.08,.2,'#927455');cuboid(x,z-side*.58,4.7,.16,1.28,.65,'#927455');
  }
  function stationVehicle(v) {
    const {x,z,bus,y,heading}=v,c=Math.cos(heading),s=Math.sin(heading);
    const length=bus?12.6:6.9,width=bus?4.1:3.3,color=bus?'#477d70':'#ecc654';
    const lit=v.moving&&state.lighting&&state.lighting.lamps>0;
    if(lit){const px=x+(length/2+2.6)*c,pz=z+(length/2+2.6)*s;ctx.save();ctx.globalAlpha*=state.lighting.lamps*.5;plane(px,pz,5.8,3.6,CityLighting.roadHeight(city,px,pz)+.045,'#ffe5ad');ctx.restore();}
    const part=(dx,dz,w,d,h0,h,col)=>cuboid(x+dx*c-dz*s,z+dx*s+dz*c,w,d,y+h0,h,col,heading);
    for(const side of [-1,1])for(const axle of [-1,1])part(axle*length*.31,side*(width/2+.02),bus?1.4:1.16,.38,.25,bus?1.4:1.16,'#283531');
    part(0,0,length,width,.8,bus?1.2:1.13,bus?'#eee8d9':color);
    part(0,0,length+.03,width+.04,1.2,bus?.55:.18,color);
    part(bus?4.7:.8,-.8,.45,.45,bus?2.6:2.13,.5,'#d5a47d');
    ctx.save();ctx.globalAlpha*=.28;part(0,0,bus?11.7:3.5,width-.22,bus?2.25:1.93,bus?1.12:1,'#a7d2dc');ctx.restore();
    part(0,0,bus?12.45:3.65,width,bus?3.38:2.94,.2,color);
    if(bus)part(-1.1,0,3.5,2.2,3.58,.38,'#eee8d9');
    else part(0,0,1.2,.7,3.14,.32,'#fff3c9');
    for(const side of [-1,1]){
      part(length/2+.025,side*width*.31,.12,.5,1.15,.32,lit?'#fff4cd':'#c4c9c2');
      part(-length/2-.025,side*width*.31,.12,.45,1.15,.25,lit?'#fb6655':'#92534c');
    }
    if(bus&&lit)part(0,0,9,.22,3.33,.045,'#ffe0a4');
  }
  function stationCanopy(site) {
    const side=site.gateSide||1,x=v=>site.x+side*v,z=v=>site.z+side*v;
    for(const v of [-12,0,11])publicBench(x(v),z(-23),side);
    cuboid(x(-21),z(-23.2),5.8,4.2,.41,4.62,'#eee8d9');
    wall({x:x(-21),z:z(-23.2),w:5.8,d:4.2},'z',-2.3,2.3,1.9,4.1,'#385b60');
    for(const dx of [-23,-11,1,13])for(const dz of [-26,-20])cuboid(x(dx),z(dz),.31,.31,.41,7.3,'#586f69');
    cuboid(x(-5),z(-23),39.2,8.1,7.765,.17,'#927455');
    cuboid(x(-5),z(-23),40,8.8,7.925,.47,'#eee8d9');
    cuboid(x(-5),z(-18.56),39.4,.12,8,.24,'#477d70');
    publicLabel('公交 · 出租换乘',x(-5),z(-18.6),10.1);

    if(state.lighting&&state.lighting.lamps>0){
      const a=state.lighting.lamps;
      ctx.save();ctx.globalAlpha=a*.5;
      for(const dz of [-25.4,-20.6])cuboid(x(-5),z(dz),38,.34,7.78,.08,'#ffe2ae');
      plane(x(-5),z(-23),38,7,.45,'#ffe0b0');plane(x(-5),z(25.7),38,3,.45,'#ffe0b0');
      ctx.restore();
    }
  }
  let amusementCanvasAsset=null,amusementCanvasReady=false;
  function amusementExtras(site,time){
    const light=CityLandmarks.amusementLighting(time,state.lighting,townView),lamps=[[-18,8],[18,-8],[-18,-18],[18,18],[-6.8,22],[6.8,22]];
    if(light.pathIntensity){ctx.save();ctx.globalAlpha*=light.pathIntensity*(light.operating||light.decoration>0?.33:.24);
      for(const [x,z] of lamps.concat([[0,20],[-11,6],[-6.5,-15]]))roundPaving(site.x+x,site.z+z,5.2,.32,'#ffd19a',true);
      ctx.restore();}
    for(const [x,z] of lamps){
      cuboid(site.x+x,site.z+z,.13,.13,.3,2.8,'#c4bba8');
      cuboid(site.x+x,site.z+z,.58,.58,2.92,.38,'#eee8d9');
      if(light.pathIntensity){ctx.save();ctx.globalAlpha*=light.pathIntensity;const pt=point(site.x+x,site.z+z,3.12);
        ctx.fillStyle='#ffdfab';ctx.beginPath();ctx.arc(...pt,Math.max(.6,view.scale*.36),0,Math.PI*2);ctx.fill();ctx.restore();}
    }
    if(amusementCanvasAsset!==globalThis.CityAmusementAsset){amusementCanvasAsset=globalThis.CityAmusementAsset;amusementCanvasReady=CityLandmarks.isAmusementAssetValid(amusementCanvasAsset);}
    if(!amusementCanvasReady)return;
    const x=site.x-11,z=site.z+6,a=((time%45+45)%45)/45*Math.PI*2;
    roundPaving(x,z,4.35,.32,'#ab8563',true);roundPaving(x,z,4.15,.64,'#eee4cf',true);
    cuboid(x,z,.48,.48,.65,5.3,'#c2a66b');
    const horses=Array.from({length:4},(_,i)=>{const t=a+i*Math.PI/2;return {x:x+Math.cos(t)*2.7,z:z+Math.sin(t)*2.7,t,i};});
    horses.sort((a,b)=>raw(a.x,a.z)[2]-raw(b.x,b.z)[2]).forEach(h=>{
      const c=Math.cos(h.t),s=Math.sin(h.t),at=(dx,dz)=>[h.x+dx*c+dz*s,h.z-dx*s+dz*c];
      line([[h.x,h.z,.7],[h.x,h.z,5.6]],'#b99a68',Math.max(.4,view.scale*.08));
      cuboid(h.x,h.z,1.6,.62,1.35,.72,h.i%2?'#e6d5b9':'#d6ddd1',h.t);
      for(const dx of [-.52,.5])for(const dz of [-.21,.21]){const p=at(dx,dz);cuboid(...p,.16,.15,.82,.6,'#e6d5b9',h.t);}
      const head=at(.72,0);cuboid(...head,.48,.46,1.9,.85,'#eee4cf',h.t);
      cuboid(h.x,h.z,.64,.7,2.04,.12,h.i%2?'#8ebfac':'#e38a77',h.t);
    });
    for(let i=0;i<12;i++){
      const u=a+i*Math.PI/6,v=u+Math.PI/6;
      polygon([[x,z,7.45],[x+Math.cos(u)*4.2,z+Math.sin(u)*4.2,5.94],[x+Math.cos(v)*4.2,z+Math.sin(v)*4.2,5.94]],i%2?'#eee4cf':'#dd9a87');
    }
    if(light.outlineIntensity){ctx.save();ctx.globalAlpha*=light.outlineIntensity;roundPaving(x,z,4.22,5.9,'#ffdfab');ctx.restore();}
    const tx=site.x-6.5,tz=site.z-15,ta=((time%30+30)%30)/30*Math.PI*2;
    roundPaving(tx,tz,2.75,.32,'#ab8563',true);roundPaving(tx,tz,2.6,.55,'#eee4cf',true);
    for(let i=0;i<3;i++){
      const u=ta+i*Math.PI*2/3,cx=tx+Math.cos(u)*1.5,cz=tz+Math.sin(u)*1.5,col=['#e38a77','#8ebfac','#e9c768'][i];
      cuboid(cx,cz,1.4,1.4,.6,.7,col);roundPaving(cx,cz,.80,1.45,col,true);roundPaving(cx,cz,.60,1.46,'#675952',true);
      roundPaving(cx,cz,.53,1.47,'#dfccae',true);
    }
    roundPaving(tx,tz,.38,1.37,'#e9c768',true);
    if(light.outlineIntensity){ctx.save();ctx.globalAlpha*=light.outlineIntensity;roundPaving(tx,tz,2.76,.4,'#ffdfab');ctx.restore();}
  }
  function ferrisWheel(site,time) {
    amusementExtras(site,time);
    const light=CityLandmarks.amusementLighting(time,state.lighting,townView);
    const passengers=CityLife.demandBudget(townView.demand).staticPassengers;
    const yaw=-.66,c=Math.cos(yaw),s=Math.sin(yaw),angle=((time%180+180)%180)/180*Math.PI*2;
    const p=(x,z,y)=>[site.x+x*c+z*s,site.z-x*s+z*c,y];
    const support=depth=>{
      for(const foot of [-9.2,9.2])line([p(foot,depth,.8),p(0,depth,26)],'#aabbb9',Math.max(.8,view.scale*.8));
      line([p(-6.8,depth,8.4),p(6.8,depth,8.4)],'#c4cfca',Math.max(.6,view.scale*.42));
    };
    support(-4.3);
    for(const depth of [-1.78,1.78]){
      const rim=[];for(let i=0;i<=72;i++){const phase=i*Math.PI/36;rim.push(p(Math.cos(phase)*20,depth,26+Math.sin(phase)*20));}
      line(rim,'#e8e1d5',Math.max(.7,view.scale*.48));
      for(let i=0;i<12;i++){const phase=angle+i*Math.PI/6;line([p(0,depth,26),p(Math.cos(phase)*20,depth,26+Math.sin(phase)*20)],'#aabdbb',Math.max(.45,view.scale*.16));}
    }
    const cabins=Array.from({length:12},(_,i)=>{const phase=angle+i*Math.PI/6,a=p(Math.cos(phase)*20,0,26+Math.sin(phase)*20);return {a,i};});
    if(light.outlineIntensity>0){
      ctx.save();ctx.globalAlpha*=light.outlineIntensity;
      for(const depth of [-2.16,2.16]){
        const rim=[];for(let i=0;i<=96;i++){const a=angle+i*Math.PI/48;rim.push(p(Math.cos(a)*20,depth,26+Math.sin(a)*20));}
        line(rim,'#ffe1a3',Math.max(.9,view.scale*.36));
        for(let i=0;i<8;i++){const a=angle+i*Math.PI/4;
          ctx.globalAlpha=light.outlineIntensity*(.78+.22*(.5+.5*Math.sin(i*Math.PI/4*3-light.chasePhase)));
          line([p(Math.cos(a)*1.8,depth,26+Math.sin(a)*1.8),p(Math.cos(a)*19.9,depth,26+Math.sin(a)*19.9)],i%2?'#a8d9c1':'#ffe1a3',Math.max(.6,view.scale*.28));
        }
        const hub=[];for(let j=0;j<=32;j++){const h=j*Math.PI/16;hub.push(p(Math.cos(h)*1.65,depth,26+Math.sin(h)*1.65));}
        line(hub,'#fff0cd',Math.max(.7,view.scale*.3));
      }
      ctx.restore();
    }
    cabins.sort((a,b)=>raw(a.a[0],a.a[1])[2]-raw(b.a[0],b.a[1])[2]).forEach(({a,i})=>{
      const color=['#e38a77','#e9c768','#8ebfac'][i%3];
      line([a,[a[0],a[1],a[2]-.8]],'#cbd5cf',Math.max(.45,view.scale*.18));

      cuboid(a[0],a[1],3.15,2.58,a[2]-3.95,1,color,-yaw);
      cuboid(a[0],a[1],2.9,2.3,a[2]-2.95,2.03,'#7aaba5',-yaw);
      if(light.cabinIntensity){ctx.save();ctx.globalAlpha*=light.cabinIntensity*.8;
        cuboid(a[0],a[1],2.9,2.3,a[2]-2.95,2.03,'#ffe0a6',-yaw);ctx.restore();}

      for(let seat=0;seat<2;seat++)if(i*2+seat<passengers){
        const head=point(a[0]+(seat? .65:-.65),a[1]-.9,a[2]-1.55);
        ctx.fillStyle='#e3b291';ctx.beginPath();ctx.arc(...head,Math.max(.6,view.scale*.28),0,Math.PI*2);ctx.fill();
      }
      cuboid(a[0],a[1],3.3,2.72,a[2]-.93,.24,color,-yaw);
      if(light.cabinIntensity){ctx.save();ctx.globalAlpha*=light.cabinIntensity;
        const corners=[[-1.58,-1.38],[1.58,-1.38],[1.58,1.38],[-1.58,1.38],[-1.58,-1.38]].map(([x,z])=>[a[0]+x*c+z*s,a[1]-x*s+z*c,a[2]-.70]);
        line(corners,'#ffe3b3',Math.max(.6,view.scale*.20));ctx.restore();}

    });
    support(4.3);line([p(0,-4.8,26),p(0,4.8,26)],'#b99a68',Math.max(1,view.scale*1.3));
  }
  function monument(site) {
    for(const [width,y,height] of [[11.4,.29,.5],[9.1,.79,.42],[7.2,1.21,.42],[5.8,1.63,2.26]])cuboid(site.x,site.z,width,width,y,height,'#d8ded8');
    cuboid(site.x,site.z,6.05,6.05,3.78,.18,'#b99a68');
    cuboid(site.x,site.z,3.85,3.85,3.96,16.65,'#c5c1b5');
    const top=[site.x,site.z,24.85],bottom=[site.x,site.z,19.75],rim=[[site.x-1.63,site.z,22.3],[site.x,site.z-1.63,22.3],[site.x+1.63,site.z,22.3],[site.x,site.z+1.63,22.3]];
    rim.map((a,i)=>({a,b:rim[(i+1)%4],depth:raw((a[0]+rim[(i+1)%4][0])/2,(a[1]+rim[(i+1)%4][1])/2)[2]})).sort((a,b)=>a.depth-b.depth).forEach((face,i)=>polygon([top,face.a,bottom,face.b],i%2?'#b99a68':'#e1c887'));
    roundPaving(site.x,site.z,2.5,20.93,'#b99a68');publicLabel('城市之光',site.x,site.z+2.977,2.65,'#545b5b','#cdb78f',.82);
  }
  function riverMarketPool(x,z) {
    return (city.waterfront?.stalls||[]).some(s=>Math.abs(x-s.x)<10&&Math.abs(z-s.z)<s.d/2+8);
  }
  function marketStall(s) {

    const b=(dx,y,dz,w,h,d,color)=>cuboid(s.x+s.side*dx,s.z+dz,w,d,y-h/2,h,color);
    const cyl=(dx,y,dz,r,h,color)=>{b(dx,y,dz,r*2,h,r*2,color);roundPaving(s.x+s.side*dx,s.z+dz,r,y+h/2,color,true);};
    const puff=(dx,y,dz,rx,ry,color)=>{const p=point(s.x+s.side*dx,s.z+dz,y);ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(...p,Math.max(.35,view.scale*rx),Math.max(.35,view.scale*ry),0,0,Math.PI*2);ctx.fill();};
    const open=townView.byBuilding['c-night-market']?.open,lamps=state.lighting?.lamps||0;
    if(lamps){
      const live=state.lighting.buildings?.['c-night-market']?.awake>0;
      ctx.save();ctx.globalAlpha*=lamps*(live?.5:.05)*.58;plane(s.x,s.z,4.8,5.8,.33,'#ffd9a0');ctx.restore();
      ctx.save();ctx.globalAlpha*=lamps*(live?.5:.05)*.28;plane(s.x-s.side*3.7,s.z,3.2,4.8,.33,'#ffd9a0');ctx.restore();
    }
    for(const dx of [-2.45,2.45])for(const dz of [-2.7,2.7])b(dx,2.93,dz,.15,5.24,.15,'#ede8d8');
    for(const [dx,dz,w,d] of [[.6,0,.7,5.4],[1.8,-1.075,1.7,3.25],[1.8,2.475,1.7,.45]])b(dx,1.25,dz,w,1.9,d,s.hot?'#4d6260':'#a98361');
    for(const [dx,dz,w,d] of [[.4,0,1.1,5.7],[1.85,-1.15,1.8,3.4],[1.85,2.55,1.8,.6]])b(dx,2.29,dz,w,.16,d,'#ede8d8');
    for(const dz of [-1.75,0,1.75]){b(.22,1.34,dz,.06,1.5,1.6,s.hot?'#78877e':'#af9272');b(.17,1.8,dz,.08,.08,.48,'#d7d4c5');}
    b(.18,.48,0,.08,.22,5.3,'#a98361');b(2.52,2.8,-2.25,.12,2.05,.85,'#506559');
    const stool=(dx,dz)=>{cyl(dx,1.15,dz,.34,.4,'#c8b391');b(dx,.95,dz,.5,.42,.5,'#8c7a63');};
    if(s.hot){
      b(.55,2.47,0,.9,.16,4.4,'#6c8381');b(1.3,4.62,0,2.2,.5,3.2,'#5d6b64');b(2.1,5.12,0,.4,.5,.4,'#4d6260');
      cyl(-1.25,1.05,0,.24,1.9,'#ede8d8');cyl(-1.25,2.02,0,.95,.16,'#c99a63');
      for(let k=0;k<5;k++){const a=Math.PI/2+k*Math.PI*2/5;stool(-1.25+Math.cos(a)*1.05,Math.sin(a)*1.55);}
    }else for(let k=0;k<4;k++)stool(-1.05,(k-1.5)*1.55);
    if(open){
      for(let k=0;k<4;k++)b(2.6,2.2+k*.33,-2.25,.025,.06,.6,'#f1dfb9');
      if(s.hot){
        cyl(-1.25,2.18,0,.24,.15,'#e9e1c6');cyl(-.86,2.19,.34,.11,.2,'#f5ead5');
        if(s.type==='grill'){
          b(1.3,2.64,-.65,1.85,.18,2.5,'#465650');
          for(let k=0;k<5;k++){const dz=-1.55+k*.43;b(1.25,2.78,dz,1.9,.055,.06,'#c4a079');for(const dx of [.75,1.15,1.55])puff(dx,2.88,dz,.16,.12,k%2?'#b67e54':'#b39160');}
        }else if(s.type==='griddle'){cyl(1.3,2.63,-.9,.76,.14,'#465650');cyl(1.3,2.73,-.9,.62,.06,'#c6a16d');b(.55,2.8,-1.75,.85,.06,.10,'#a98e68');}
        else{cyl(1.3,2.76,-.9,.6,.42,'#8c5a44');puff(1.3,3.19,-.9,.3,.28,'#efe9dd');puff(1.15,3.7,-.72,.42,.34,'#efe9dd');}
        b(.45,2.59,-.1,.9,.08,1.1,'#87958a');
        for(let k=0;k<3;k++){const dz=-.45+k*.35;cyl(.55,2.8,dz,.18,.34,'#ede4d1');cyl(.55,2.98,dz,.145,.025,'#b98c55');}
      }else if(s.type==='deli'){
        for(const dz of [-1.6,-.4,2.5]){b(1.55,2.44,dz,1.9,.08,.55,'#87958a');for(let k=0;k<4;k++)puff(.9+k*.35,2.58,dz,.14,.10,k%2?'#a5795f':'#b5a16c');}
      }else{
        for(let k=0;k<3;k++){
          const dz=[-1.6,-.4,2.5][k],drink=(s.type==='juice'?['#bd9660','#a0ac72','#bf8a6d']:['#ccad78','#a47c62','#98a17b'])[k];
          cyl(1.9,2.83,dz,.3,.9,drink);cyl(1.9,3.31,dz,.32,.06,'#ede4d1');b(1.53,2.52,dz,.18,.09,.11,'#596b63');
          cyl(.55,2.61,dz,.19,.46,'#ede4d1');cyl(.55,2.86,dz,.155,.025,drink);
        }
        b(.55,2.42,2.55,1.2,.08,.5,'#84917c');for(let k=0;k<4;k++)puff(.18+k*.25,2.64,2.55,.13,.17,s.type==='juice'?'#c49a60':'#c6b18c');
      }
    }
    for(const dx of [-2.42,2.42])b(dx,5.34,0,.12,.14,5.55,'#a98361');
    for(const dz of [-2.7,2.7])b(0,5.34,dz,5,.14,.12,'#a98361');
    const canopy={grill:'#a36f55',hotpot:'#94736b',griddle:'#b39463',deli:'#83938e',dessert:'#7e9388',juice:'#b49b68'}[s.type]||s.color;
    for(let k=0;k<8;k++){const dz=-2.595+k*.7417,color=k%2?'#f3ead6':canopy;b(-.05,5.5,dz,5.3,.18,.72,color);b(-2.55,5.15,dz,.12,.42,.72,color);}
    b(-2.66,4.95,0,.14,.9,5.65,'#ede8d8');publicLabel(s.name,s.x-s.side*2.75,s.z,4.95,'#42685d',lamps>.2?'#071820':'#eee8d3',.72,Boolean(open&&lamps>0));
    for(const dz of [-2.35,2.35]){puff(-.15,3.8,dz,.5,.65,'#d8483c');b(-.15,4.54,dz,.44,.16,.44,'#c8a86a');b(-.15,5.015,dz,.06,.79,.06,'#3c4a49');b(-.15,3.08,dz,.13,.34,.13,'#c8a86a');}
    for(let k=0;k<7;k++){const dz=-2.5+k*5/6,y=4.4-.42*(1-Math.pow(dz/2.5,2));puff(-2.5,y,dz,.22,.22,'#ffcf87');if(k)b(-2.5,y+.13,dz-5/12,.07,.07,5/6*.98,'#3c4a49');}
  }



  // The compatibility path draws
  function frontageObjects(objects,time) {
    const plan=city.frontage;
    if(!plan)return;
    const shop=CityFrontage.SHOP, wall=CityFrontage.WALL;
    const push=(x,z,paint)=>objects.push({x,z,paint});
    for(const site of plan.sites){
      const settled=time>=site.settleAt, risen=time>=site.riseAt;
      if(!risen)continue;
      const b=site.building;
      if(site.type==='shops'){
        const reach=shop.gap+Math.max(...Object.values(site.band));
        for(const side of ['x-','x+','z-','z+']){
          const depth=site.band[side];
          if(!depth)continue;
          const axis=side.charAt(0),sign=side.charAt(1)==='-'?-1:1;
          const center=shop.gap+depth/2;
          const x=axis==='z'?b.x:b.x+sign*(b.w/2+center);
          const z=axis==='z'?b.z+sign*(b.d/2+center):b.z;
          const w=axis==='z'?b.w+2*(shop.gap+depth):depth;
          const d=axis==='z'?depth:b.d+2*(shop.gap+depth);
          push(x,z,()=>{
            cuboid(x,z,w,d,.27,shop.height,'#f0e9da',0,true);
            if(!settled)return;
            const aw=1.05,gh=.15;
            const ax=axis==='z'?x:x+sign*(depth/2+aw/2);
            const az=axis==='z'?z+sign*(depth/2+aw/2):z;
            cuboid(ax,az,axis==='z'?w:aw,axis==='z'?aw:Math.min(d,18),shop.awningY-gh/2,gh,'#b4705f');
            cuboid(x,z,w,d,shop.height+.27,.3,'#f6f1e6');



            if(state.lighting&&state.lighting.lamps>0&&state.lighting.minute>=420&&state.lighting.minute<1320){
              ctx.save();ctx.globalAlpha=state.lighting.lamps*.5;
              const px=axis==='z'?x:x+sign*(depth/2+2.2),pz=axis==='z'?z+sign*(depth/2+2.2):z;
              plane(px,pz,axis==='z'?w*.8:4.4,axis==='z'?4.4:Math.min(d,18)*.8,.31,'#ffd9a0');
              cuboid(ax,az,axis==='z'?w:aw,axis==='z'?aw:Math.min(d,18),2.35,.55,'#ffdfae');
              ctx.restore();
            }
          });
        }
      }else if(site.type==='wall'){
        const ring=site.ring,gate=site.gate.side;
        for(const side of ['x-','x+','z-','z+']){
          const axis=side.charAt(0),sign=side.charAt(1)==='-'?-1:1;
          const x=axis==='z'?b.x:b.x+sign*(b.w/2+ring);
          const z=axis==='z'?b.z+sign*(b.d/2+ring):b.z;
          const span=axis==='z'?b.w+ring*2:b.d;
          const gated=side===gate;
          push(x,z,()=>{
            const half=gated?wall.gate/2:span/2,width=gated?span/2-wall.gate/2:span;
            const offset=gated?(sign>0?half+width/2:-(half+width/2)):0;
            const wx=axis==='z'?x+offset:x,wz=axis==='z'?z:z+offset;
            cuboid(wx,wz,axis==='z'?width:.5,axis==='z'?.5:width,.27,wall.base,'#d8dee1',0,true);
            if(settled)cuboid(wx,wz,axis==='z'?width:.16,axis==='z'?.16:width,wall.base,wall.railTop-wall.base,'#3d4a50');
          });
        }
        const inner=ring-1.05;
        for(const side of ['x-','x+','z-','z+']){
          const axis=side.charAt(0),sign=side.charAt(1)==='-'?-1:1;
          const x=axis==='z'?b.x:b.x+sign*(b.w/2+inner);
          const z=axis==='z'?b.z+sign*(b.d/2+inner):b.z;
          const w=axis==='z'?b.w+2*inner:.95,d=axis==='z'?.95:b.d+2*inner;
          push(x,z,()=>cuboid(x,z,w,d,.27,.7,'#6f8f52',0,true));
        }
        const sign=gate.charAt(1)==='-'?-1:1,axis=gate.charAt(0);
        const gx=axis==='z'?b.x:b.x+sign*(b.w/2+ring/2),gz=axis==='z'?b.z+sign*(b.d/2+ring/2):b.z;
        push(gx,gz,()=>cuboid(gx,gz,axis==='z'?2.5:ring,axis==='z'?ring:2.5,.28,.08,'#dce7ee'));
      }
    }
  }





  function helipadObjects(objects,time) {
    if(!window.CityHelipad)return;

    if(helipadPlan.city!==city){helipadPlan.city=city;helipadPlan.pad=CityHelipad.plan(city);}
    const pad=helipadPlan.pad;
    if(!pad)return;
    const craft=CityHelipad.sample(pad,time);
    if(!craft.visible)return;
    const PAD=CityHelipad.PAD,roofY=pad.roofY,radius=pad.radius,scale=view.scale;
    objects.push({x:pad.x,z:pad.z,paint:()=>{
      const centre=point(pad.x,pad.z,roofY+PAD.paint+.02);
      const disc=(r,fill)=>{
        ctx.beginPath();
        ctx.ellipse(centre[0],centre[1],r*scale,r*scale*Math.abs(view.sp),0,0,Math.PI*2);
        if(fill){ctx.fillStyle=fill;ctx.fill();}else ctx.stroke();
      };
      disc(radius,'#8e9a9c');
      ctx.strokeStyle='#f2f4f2';ctx.lineWidth=Math.max(.6,scale*PAD.hWidth);
      disc(radius-PAD.ringGap-PAD.ringWidth*.5);

      const bar=PAD.hBar, top=roofY+PAD.paint+.04;
      const strokes=[
        [point(pad.x-bar,pad.z-bar,top),point(pad.x-bar,pad.z+bar,top)],
        [point(pad.x+bar,pad.z-bar,top),point(pad.x+bar,pad.z+bar,top)],
        [point(pad.x-bar,pad.z,top),point(pad.x+bar,pad.z,top)]
      ];
      strokes.forEach(ends=>{ctx.beginPath();ctx.moveTo(ends[0][0],ends[0][1]);ctx.lineTo(ends[1][0],ends[1][1]);ctx.stroke();});
    }});

    const bodyY=craft.y+1.5, shadow=point(craft.x+1.6,craft.z+1.2,roofY+.05);
    objects.push({x:craft.x,z:craft.z,paint:()=>{
      if(craft.y-roofY<8){
        ctx.fillStyle='rgba(70,86,92,.2)';
        ctx.beginPath();ctx.ellipse(shadow[0],shadow[1],4.4*scale,2.1*scale,0,0,Math.PI*2);ctx.fill();
      }
      const body=point(craft.x,craft.z,bodyY),c=Math.cos(craft.heading),s2=Math.sin(craft.heading);
      ctx.strokeStyle='#4b5a60';ctx.lineWidth=Math.max(.5,scale*.26);
      for(const side of [-1,1]){
        const a=point(craft.x+c*1.9-side*s2*1.1,craft.z+s2*1.9+side*c*1.1,craft.y+.1);
        const b=point(craft.x-c*1.9-side*s2*1.1,craft.z-s2*1.9+side*c*1.1,craft.y+.1);
        ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
      }
      ctx.fillStyle='#5d6f76';
      ctx.beginPath();ctx.ellipse(body[0],body[1],3.5*scale,2.6*scale,0,0,Math.PI*2);ctx.fill();
      const nose=point(craft.x+c*2.6,craft.z+s2*2.6,bodyY+.3);
      ctx.fillStyle='#9fc4c8';
      ctx.beginPath();ctx.ellipse(nose[0],nose[1],1.5*scale,1.15*scale,0,0,Math.PI*2);ctx.fill();
      const tail=point(craft.x-c*5.4,craft.z-s2*5.4,bodyY+1.1);
      ctx.strokeStyle='#5d6f76';ctx.lineWidth=Math.max(.5,scale*.7);
      ctx.beginPath();ctx.moveTo(body[0],body[1]);ctx.lineTo(tail[0],tail[1]);ctx.stroke();

      ctx.strokeStyle='rgba(120,140,150,.75)';ctx.lineWidth=Math.max(.4,scale*.22);
      for(const blade of [0,Math.PI/2]){
        const p0=point(craft.x+Math.cos(craft.rotor+blade)*5.6,craft.z+Math.sin(craft.rotor+blade)*5.6,bodyY+2.4);
        const p1=point(craft.x-Math.cos(craft.rotor+blade)*5.6,craft.z-Math.sin(craft.rotor+blade)*5.6,bodyY+2.4);
        ctx.beginPath();ctx.moveTo(p0[0],p0[1]);ctx.lineTo(p1[0],p1[1]);ctx.stroke();
      }
      const hub=point(craft.x,craft.z,bodyY+2.4);
      ctx.fillStyle='#e8eef0';
      ctx.beginPath();ctx.arc(hub[0],hub[1],Math.max(.5,scale*.3),0,Math.PI*2);ctx.fill();
    }});
  }
  function publicPlaceObjects(objects,time) {
    const add=(x,z,paint)=>objects.push({x,z,paint});
    for(const site of city.places||[]){
      if(site.kind==='station'){
        const side=site.gateSide||1;
        add(site.x-side*5,site.z-side*23,()=>stationCanopy(site));
        for(const v of CityTransitMotion.sample(transitPlan,time,state.daySeconds))add(v.x,v.z,()=>stationVehicle(v));
      }else if(site.kind==='amusement'){
        add(site.x,site.z,()=>ferrisWheel(site,time));
        add(site.x-13.8,site.z+17.3,()=>{cuboid(site.x-13.8,site.z+17.3,5.4,5.3,.28,4.85,'#eee8d9');cuboid(site.x-13.8,site.z+17.3,6,5.9,5.08,.22,'#e38a77');});
        add(site.x,site.z+20.8,()=>{for(const x of [-6,6])cuboid(site.x+x,site.z+20.8,.7,.7,.28,4.55,'#ede8d9');cuboid(site.x,site.z+20.8,13.1,.8,4.46,.62,'#8ebfac');publicLabel('星光乐园',site.x,site.z+21.215,4.78,'#38524b','#8ebfac',.5);});
      }else if(site.kind==='plaza'){
        add(site.x,site.z,()=>monument(site));
        for(const dx of [-14.8,14.8])for(const dz of [-6.8,6.8])add(site.x+dx,site.z+dz,()=>publicBench(site.x+dx,site.z+dz));
      }
    }
    for(const stall of city.waterfront?.stalls||[])add(stall.x,stall.z,()=>marketStall(stall));
    const civic=city.waterfront?.civic;
    if(civic)add(civic.x,civic.z,()=>{
      cuboid(civic.x,civic.z,civic.w,civic.d,.28,9.1,'#ded8c8');
      cuboid(civic.x,civic.z,civic.w+.5,civic.d+.5,9.38,.3,'#718177');
      const level=townView.byBuilding['c-civic']?.lightLevel||0;
      for(const y of [2.2,6.5])for(let k=0;k<4;k++){
        const a=-civic.d/2+1+k*4,c=a+2;
        wall(civic,'x',a-.16,c+.16,y-.16,y+2.16,'#efe8d8');
        wall(civic,'x',a,c,y,y+2,level>k/4?'#ffdda0':'#657b74');
        wall(civic,'x',a+.95,a+1.05,y,y+2,'#d8d0be');
      }
      publicLabel('社区办事处',civic.x-civic.w/2-.1,civic.z,4.8,undefined,undefined,1.7,true);
    });
  }
  let cosmicPlanCity=null,cosmicPlan=null;
  function cosmicEdges2D(){
    const daylight=dayClock().daylight,night=1-daylight,level=night*night*(3-2*night);
    if(level<=0||!globalThis.CityGround)return;
    if(cosmicPlanCity!==city){cosmicPlanCity=city;cosmicPlan=CityGround.planCosmicEdges(city);}
    const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
    ctx.save();
    for(const site of cosmicPlan.waterfalls){
      const a=CityGround.cosmicEdgeAt(site);
      const at=(u,t)=>[a.x+u*a.width*(1+.18*t*t),a.z+a.dz*24*Math.sin(t*Math.PI/2),a.y-a.drop*Math.pow(t,1.55)];
      for(let i=0;i<32;i++){
        const t=i/32,n=(i+1)/32;ctx.globalAlpha=level*(1-smooth(.62,1,t))*.56;
        polygon([at(-.5,t),at(.5,t),at(.5,n),at(-.5,n)],'#258bd5');
      }
      for(let strand=0;strand<24;strand++){
        const u=(strand+.5)/24-.5;
        for(let j=0;j<32;j++){const t=j/32,n=(j+1)/32;ctx.globalAlpha=level*(1-smooth(.62,1,t))*(.25+.17*Math.sin(strand*3.7+state.daySeconds*2));line([at(u+Math.sin(t*18+state.daySeconds*.7+strand)*.008,t),at(u+Math.sin(n*18+state.daySeconds*.7+strand)*.008,n)],'#a0eeff',Math.max(.3,view.scale*.25));}
      }
    }
    ctx.restore();
  }

  function ground(w,h,time,samples) {
    CityMaterials.paintSky(ctx,w,h,state,city.seed);
    CityLight.atmosphere(ctx,w,h,state.time,settings.dreamLight*dayClock().daylight);
    cosmicEdges2D();
    ctx.save();ctx.shadowColor='rgba(88,109,91,.22)';ctx.shadowBlur=28*view.scale;ctx.shadowOffsetY=12*view.scale;
    plane(4,5,city.extentX*2,city.extentZ*2,-11,'#d8ded2');ctx.restore();
    cuboid(0,0,city.extentX*2-2,city.extentZ*2-2,-10,5,'#dddccf');
    cuboid(0,0,city.extentX*2,city.extentZ*2,-5,5,settings.ground,0,true);
    plane(0,0,city.extentX*2-1,city.extentZ*2-1,.03,'#eaece2');


    for(const r of city.roads) {
      plane(r.x,r.z,r.w+4,r.d+4,.12,'#f3f0e5');
      plane(r.x,r.z,r.w,r.d,.15,'#d3dcd4');

      if(r.walkOnlyTo)for(const side of [-1,1]) {
        plane(side*(15+r.walkOnlyTo)/2,r.z,r.walkOnlyTo-15,r.d+4,.16,'#e6e2d2');
      }
      const length=r.axis==='x'?r.w:r.d;
      for(let t=-length/2+5;t<length/2-4;t+=10) {
        if(r.walkOnlyTo&&Math.abs(r.x+t)<r.walkOnlyTo+4)continue;
        if(r.axis==='x')plane(r.x+t,r.z,3.7,.32,.17,'rgba(253,253,241,.88)');
        else plane(r.x,r.z+t,.32,3.7,.17,'rgba(253,253,241,.88)');
      }
    }
    for(const park of city.parks) {
      plane(park.x,park.z,park.w+2,park.d+2,.18,'#f0eddf');
      plane(park.x,park.z,park.w,park.d,.2,'#c8d5b7');
      if(park.use==='sports'&&city.playground){playground2D(city.playground);continue;}
      plane(park.x,park.z,4.6,park.d,.22,'#e9e7d5');
      plane(park.x,park.z,park.w,4.6,.23,'#e9e7d5');
      for(const side of [-1,1]) {
        plane(park.x+side*(park.w/2-4),park.z,1.8,park.d-10,.25,'#e9e7d5');
        plane(park.x,park.z+side*(park.d/2-5),park.w-8,1.8,.25,'#e9e7d5');
      }
    }
    for(const b of city.buildings){
      if(b.housing)CityHousingCanvas.drawGround(b,housingPaintAPI(b));
      else plane(b.x,b.z,b.w+6,b.d+6,.24,'#f2f0e5');
    }
    for(const place of city.places||[])publicPlaceGround(place);
    const water=city.water;
    plane(0,0,water.w+8,water.d+1,.2,'#e1e5d7');
    const wg=ctx.createLinearGradient(...point(-16,-168,-1),...point(16,168,-1));
    wg.addColorStop(0,'#acd2c5');wg.addColorStop(.48,'#80bcb6');wg.addColorStop(1,'#b2d7ca');
    plane(0,0,water.w,water.d,-.6,wg);
    for(const x of [-water.w/2-1.5,water.w/2+1.5]) {
      cuboid(x,0,2.5,water.d,.05,.8,'#f4f0e2');
      line([[x-1, -168,1],[x-1,168,1]],'rgba(255,255,248,.7)',.65);
    }
    for(let i=0;i<35;i++) {
      const z=-158+i*9.2+Math.sin(time*.24+i)*1.2;
      const x=Math.sin(i*3.7)*7,length=2.8+Math.sin(i*2.6)*1.8;
      line([[x-length,z,-.5],[x+length,z+1,-.5]],`rgba(233,250,235,${.2+Math.sin(time*.45+i)*.075})`,.7);
    }
    waterLight();

    for(const side of [-1,1])for(const [a,b] of [[-166,-93],[-67,-10],[10,67],[93,166]])plane(side*26.8,(a+b)/2,18,b-a,.28,'#e2dcca');

    ctx.save();
    for(let i=0;i<city.buildings.length;i++) {
      const source=city.buildings[i];
      const volumes=source.housing?CityHousingCanvas.shadowVolumes(source,samples[i]):[{...source,height:samples[i].height}];
      for(const b of volumes){
        if(b.height<=0)continue;
        const dx=b.height*.29,dz=b.height*.17;
        ctx.shadowColor='rgba(110,136,121,.1)';ctx.shadowBlur=3*view.scale;
        polygon([[b.x-b.w/2,b.z-b.d/2,.3],[b.x+b.w/2,b.z-b.d/2,.3],[b.x+b.w/2+dx,b.z-b.d/2+dz,.3],[b.x+b.w/2+dx,b.z+b.d/2+dz,.3],[b.x-b.w/2+dx,b.z+b.d/2+dz,.3],[b.x-b.w/2,b.z+b.d/2,.3]],'rgba(112,138,122,.12)');
      }
    }
    ctx.restore();
    for(const tree of city.trees) {
      const p=point(tree.x+tree.h*.2,tree.z+tree.h*.12,.4);
      ctx.fillStyle='rgba(118,145,117,.16)';ctx.beginPath();ctx.ellipse(p[0],p[1],tree.r*view.scale*1.2,tree.r*view.scale*.53,-state.yaw*.3,0,Math.PI*2);ctx.fill();
    }

    for(const x of [-96,96])for(const z of [-80,0,80]) {
      for(let i=-2;i<=2;i++)plane(x+i*1.8,z+9.5,.8,5,.36,'#f7f7ed');
    }
  }
  let highMastCanvasCity=null,highMastCanvasSites=[];
  function highMastCanvasPool(site) {
    const light=state.lighting?.lamps||0;if(!light)return;
    const a=CityGround.highMastPool(site),c=point(a.x,a.z,a.y),u=point(a.x+a.w/2,a.z,a.y),v=point(a.x,a.z+a.d/2,a.y);
    ctx.save();ctx.transform(u[0]-c[0],u[1]-c[1],v[0]-c[0],v[1]-c[1],c[0],c[1]);
    const g=ctx.createRadialGradient(0,0,0,0,0,1);
    for(let r=0;r<=1;r+=.125)g.addColorStop(r,'rgba(255,207,145,'+Math.pow(1-r*r,2)+')');
    ctx.globalAlpha=light*.72*a.level;ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();
  }
  function highMastCanvas(site) {
    const p=CityGround.highMastAt(site),x=p.x,z=p.z,b=p.y,light=state.lighting?.lamps||0;
    ctx.save();
    cuboid(x,z,1.35,1.35,b,.20,'#d7d4c9');cuboid(x,z,1.02,1.02,b+.20,.10,'#91a2a6');
    cuboid(x,z,.55,.55,b+.31,1.42,'#476576');

    polygon([[x-view.c*.255,z+view.s*.255,b+1.67],[x+view.c*.255,z-view.s*.255,b+1.67],[x+view.c*.115,z-view.s*.115,b+17.05],[x-view.c*.115,z+view.s*.115,b+17.05]],'#476576');
    cuboid(x,z,.60,.60,b+16.96,.44,'#91a2a6');
    line([[x,z,b+17.37],[x,z,b+18.50]],'#91a2a6',Math.max(.7,view.scale*.07));
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,c=Math.cos(a),sn=Math.sin(a);
      line([[x+c*.20,z+sn*.20,b+17.05],[x+c*1.42,z+sn*1.42,b+17.44]],'#476576',Math.max(1,view.scale*.12));
      line([[x+c*.08,z+sn*.08,b+16.73],[x+c*.95,z+sn*.95,b+17.30]],'#91a2a6',Math.max(.6,view.scale*.055));
      cuboid(x+c*1.71,z+sn*1.71,.98,.46,b+17.40,.18,'#476576',a);
      plane(x+c*1.71,z+sn*1.71,.77,.29,b+17.39,light>0?'#fff0d2':'#c6cec8');
    }
    if(festivalLevel()>0){
      cuboid(x,z,.58,.49,b+6.30,.20,'#91a2a6');
      for(const side of [-1,1]){
        const q=Math.SQRT1_2,at=(u,v)=>[x+side*q*(2.2+2.4*u-1.6*(1-v)),z,b+6.4+q*(2.2-2.4*u-1.6*(1-v))];
        line([[x,z,b+6.4],at(0,1)],'#b5c2c7',Math.max(.7,view.scale*.055));
        polygon([at(0,0),at(1,0),at(1,1),at(0,1)],'#db1025');
        polygon([at(0,0),at(.022,0),at(.022,1),at(0,1)],'#ede9db');
        const star=(cx,cy,r,rot)=>polygon(Array.from({length:10},(_,n)=>{const a=rot+n*Math.PI/5,rr=r*(n%2?.381966:1);return at((cx+Math.cos(a)*rr)/1.5,cy+Math.sin(a)*rr);}), '#ffda38');
        star(.25,.75,.15,Math.PI/2);for(const [sx,sy] of [[.5,.9],[.6,.8],[.6,.65],[.5,.55]])star(sx,sy,.05,Math.atan2(.75-sy,.25-sx));
      }
    }
    ctx.restore();
  }
  function renderTo(context,w,h) {
    refreshTown();
    if(state.focusAirship){const ship=airshipState();if(ship)state.flyTarget={x:ship.x,y:ship.y,z:ship.z};}
    state.observationBounds=state.observation?observationBounds(state.observation):null;
    if(physicalScene){projection(w,h);return physicalScene.render(context,w,h,state,settings,view,context===sketch.drawingContext);}
    const old=ctx;ctx=context;
    canvasLetterSigns.length=0;
    ctx.save();projection(w,h);
    const time=Math.min(state.time,city.duration);
    const samples=city.buildings.map(b=>CityModel.sampleBuilding(b,time));
    ground(w,h,time,samples);
    if(highMastCanvasCity!==city){highMastCanvasCity=city;highMastCanvasSites=CityGround.planHighMasts(city,life);}
    highMastCanvasSites.forEach(highMastCanvasPool);
    const fade=1;
    ctx.save();ctx.globalAlpha=fade;
    for(let i=0;i<2;i++) {const z=((state.time*(i?-1.3:1.6)+i*135+180)%280+280)%280-140;boat(z,state.time,i);}
    ctx.restore();
    city.bridges.forEach(bridge);
    (city.viaducts||[]).forEach(viaduct);
    const objects=[];
    highMastCanvasSites.forEach(site=>{const p=CityGround.highMastAt(site);objects.push({x:p.x,z:p.z,paint:()=>highMastCanvas(site)});});
    if(state.lighting&&state.lighting.lamps>0){
      city.roads.filter(r=>r.axis==='z').forEach(r=>{
        for(let z=-226;z<=226;z+=40){
          if(highMastCanvasSites.some(m=>m.vertical.x===r.x&&Math.abs(m.horizontal.z-z)<16))continue;
          const x=r.x+(r.x<0?-8.1:8.1);
          if(city.reservations.some(a=>Math.abs(x-a.x)<a.w/2+2&&Math.abs(z-a.z)<a.d/2+2))continue;
          objects.push({x,z,paint:()=>{
            ctx.save();ctx.globalAlpha=state.lighting.lamps*.4;plane(x+(r.x<0?3:-3),z,10,17,.31,'#ffdca1');ctx.restore();
            cuboid(x,z,.2,.2,.26,8.1,'#61717d');cuboid(x,z,.85,.5,8.5,.09,'#ffe9b7');
          }});
        }
      });

      // 与 WebGL 的车头灯光池同一条高度。
      (city.viaducts||[]).forEach(v=>{
        for(let lx=-(v.flatX-12);lx<=v.flatX-12;lx+=24)for(const side of [-1,1]){
          const z=v.z+side*6.35;
          objects.push({x:lx,z,paint:()=>{
            ctx.save();ctx.globalAlpha=state.lighting.lamps*.4;plane(lx-side*1.08,z,10,17,CityLighting.roadHeight(city,lx-side*1.08,z)+.045,'#ffdca1');ctx.restore();
            cuboid(lx,z,.2,.2,v.height-.05,8.1,'#61717d');cuboid(lx,z-side*.85,.85,.5,v.height+8.3,.09,'#ffe9b7');
          }});
        }
      });


      city.parks.forEach(park=>{
        if(park.use==='sports'&&city.playground)return;
        const halfX=park.w/2-4,halfZ=park.d/2-5;
        for(const arm of [[1,0],[-1,0],[0,1],[0,-1]])for(let step=1;step<=2;step++){
          const lx=park.x+arm[0]*step*halfX/2+arm[1]*1.9,lz=park.z+arm[1]*step*halfZ/2+arm[0]*1.9;
          if(city.trees.some(t=>Math.hypot(t.x-lx,t.z-lz)<Math.max(1.4,t.r*.55)))continue;
          objects.push({x:lx,z:lz,paint:()=>{
            ctx.save();ctx.globalAlpha=state.lighting.lamps*.4;plane(lx,lz,6.5,6.5,.31,'#ffdca1');ctx.restore();
            cuboid(lx,lz,.13,.13,.28,1.5,'#61717d');cuboid(lx,lz,.4,.4,1.72,.14,'#ffe9b7');
          }});
        }
      });



      city.roads.filter(r=>r.axis==='x'&&!r.unlit).forEach(r=>{
        const sgn=r.x<0?-1:1;
        for(const ax of [36,72,118,156]){
          if((city.tunnels||[]).some(t=>Math.abs(t.z-r.z)<.1&&ax<t.portalX))continue;
          for(const kerb of [-1,1]){
            const z=r.z+kerb*8.5,inward=-kerb,x=sgn*ax;
            objects.push({x,z,paint:()=>{
              const poolZ=z+inward*3.5,sample=riverMarketPool(x,poolZ);
              ctx.save();ctx.globalAlpha=state.lighting.lamps*.4*(sample?.55:1);plane(x,poolZ,sample?7:26,sample?14:13,.31,'#ffdca1');ctx.restore();
              cuboid(x,z,.2,.2,.26,8.1,'#61717d');cuboid(x,z+inward*.54,.4,.62,8.5,.09,'#ffe9b7');
            }});
          }
        }
      });
    }
    city.bridges.forEach(b=>{
      for(const z of [b.z-b.d/2+.7,b.z+b.d/2-.7])for(let x=b.x-b.w/2;x<b.x+b.w/2;x+=7) {
        const length=Math.min(7,b.x+b.w/2-x);
        objects.push({x:x+length*.5,z,paint:()=>{ctx.save();ctx.globalAlpha=1;bridgeRail(x,z,length);ctx.restore();}});
      }
    });
    city.trees.forEach(t=>objects.push({x:t.x,z:t.z,paint:()=>miniTree(t.x,t.z,.4,t.r,t.h)}));
    publicPlaceObjects(objects,state.daySeconds);
    frontageObjects(objects,Math.min(state.time,city.duration));
    helipadObjects(objects,state.time);
    city.buildings.forEach((b,i)=>{
      if(b.housing)CityHousingCanvas.addObjects(objects,b,samples[i],housingPaintAPI(b));
      else objects.push({x:b.x,z:b.z,paint:()=>{
        building(b,samples[i]);
        roofLight(b,samples[i]);

        samples[i].falling.forEach(m=>fallingModule(b,m));
      }});
    });
    for(const annex of city.annexes||[]){
      const index=city.buildings.findIndex(b=>b.id===annex.host),host=city.buildings[index],at=CityFacilities.annexAt(annex,host);
      if(!at||!samples[index]?.builtFloors)continue;
      const floors=Math.min(annex.floors,samples[index].builtFloors);
      const b={...annex,...at,kind:'stone',floorHeight:6,detailSeed:host.detailSeed,roof:'service'};
      const sample={builtFloors:floors,height:floors*6,complete:floors>=annex.floors,falling:[],flash:0};
      objects.push({x:b.x,z:b.z,paint:()=>building(b,sample)});
    }
    if(!canvasActivity)canvasActivity=CityLife.createSample(life);
    const activity=CityLife.sampleInto(life,state.daySeconds,canvasActivity,townView.demand);


    const onBoard=a=>a.active!==false&&CityModel.onBoard(city,a.x,a.z);
    dailyVehicles(activity.vehicles).filter(v=>v.active&&onBoard(v)).forEach(v=>objects.push({x:v.x,z:v.z,paint:()=>car(v)}));
    activity.pedestrians.filter(onBoard).forEach(p=>objects.push({x:p.x,z:p.z,paint:()=>{ctx.save();ctx.globalAlpha*=p.visibility??1;pedestrian(p);ctx.restore();}}));
    (activity.shoppers||[]).filter(onBoard).forEach(p=>objects.push({x:p.x,z:p.z,paint:()=>{ctx.save();ctx.globalAlpha*=p.visibility??1;pedestrian(p);ctx.restore();}}));
    (activity.pets||[]).filter(onBoard).forEach(p=>objects.push({x:p.x,z:p.z,paint:()=>{ctx.save();ctx.globalAlpha*=p.visibility??1;pet(p);ctx.restore();}}));
    (activity.riders||[]).filter(onBoard).forEach(r=>objects.push({x:r.x,z:r.z,paint:()=>{ctx.save();ctx.globalAlpha*=r.visibility??1;rider(r);ctx.restore();}}));
    (activity.balloons||[]).filter(onBoard).forEach(b=>objects.push({x:b.x,z:b.z,paint:()=>{ctx.save();ctx.globalAlpha*=b.visibility??1;balloon(b);ctx.restore();}}));
    activity.balls.filter(onBoard).forEach(b=>objects.push({x:b.x,z:b.z,paint:()=>{ctx.save();ctx.globalAlpha*=b.visibility??1;const p=point(b.x,b.z,b.y);ctx.fillStyle='#f4f1df';ctx.beginPath();ctx.arc(p[0],p[1],Math.max(.5,b.radius*view.scale),0,Math.PI*2);ctx.fill();ctx.restore();}}));
    objects.sort((a,b)=>raw(a.x,a.z)[2]-raw(b.x,b.z)[2]);
    ctx.globalAlpha=fade;
    objects.forEach(o=>o.paint());
    ctx.globalAlpha=1;
    floatingLight(samples,fade);

    const nightWash=1-dayClock().daylight;
    if(nightWash>0){ctx.save();ctx.globalCompositeOperation='multiply';
      ctx.fillStyle=`rgba(74,90,114,${(nightWash*.55).toFixed(3)})`;ctx.fillRect(0,0,w,h);ctx.restore();}
    const signLight=state.lighting?.lamps||0;
    if(signLight>0){
      const evening=state.lighting.minute>=1110&&state.lighting.minute<1380;
      ctx.save();ctx.globalAlpha=signLight*(evening?1:.4);
      ctx.shadowBlur=evening?9:5;
      ctx.textAlign='center';ctx.textBaseline='middle';
      canvasLetterSigns.forEach(sign=>{ctx.fillStyle=CityFacilities.nightSignInk(sign.text);ctx.shadowColor=ctx.fillStyle;ctx.font=`600 ${sign.size}px "Microsoft YaHei",sans-serif`;ctx.fillText(sign.text,sign.x,sign.y);});
      ctx.restore();
    }
    CityLight.veil(ctx,w,h,state.time,settings.dreamLight*(1-nightWash));
    const ship=airshipState();if(ship)CityAirship.drawCanvas(ctx,point,ship,state.lighting?.lamps||0);
    ctx.restore();ctx=old;
  }
  function updateUI(force=false) {
    if(!force&&performance.now()-lastUI<120)return;
    lastUI=performance.now();
    const summary=CityModel.summarize(city,Math.min(state.time,city.duration));
    const progress=summary.progress;
    $('build-count').textContent=String(summary.builtFloors);
    $('tower-count').textContent=String(summary.completedBuildings).padStart(2,'0')+' / '+summary.totalBuildings;
    $('seed-label').textContent=String(city.seed);
    refreshTown();
    const activity=CityLife.sample(life,state.daySeconds,townView.demand);
    const fleet=CityTransitMotion.sample(transitPlan,state.time,state.daySeconds);
    $('vehicle-count').textContent=String(dailyVehicles(activity.vehicles).filter(v=>v.active).length+fleet.filter(v=>v.moving).length);
    $('transit-status').textContent=`公交 3 辆 · 出租 4 辆｜运营 ${fleet.filter(v=>v.moving).length} · 整备 ${fleet.filter(v=>v.status==='整备维护').length} · 候车 ${fleet.filter(v=>v.status==='候车').length} · 停运 ${fleet.filter(v=>v.status==='停运').length}`;
    $('pedestrian-count').textContent=String(CityLife.countPeople(activity,p=>CityModel.onBoard(city,p.x,p.z)).total);
    updateTownPanel();
    $('progress-label').textContent=Math.round(progress*100)+'%';
    const clock=dayClock();
    for(const speed of [1,2,4]){const button=$('day-speed-'+speed);button.classList.toggle('is-active',settings.daySpeed===speed);button.setAttribute('aria-pressed',String(settings.daySpeed===speed));}
    $('time-label').textContent=Math.min(state.time,city.duration).toFixed(1)+' / '+city.duration.toFixed(1)+' s';
    $('day-label').textContent=clock.label;

    if(document.activeElement!==$('day-timeline'))$('day-timeline').value=String(clock.minute);
    $('day-timeline').style.setProperty('--range-progress',(clock.minute/1439*100)+'%');

    document.documentElement.dataset.sky=clock.daylight<.5?'dark':'light';

    $('phase-name').textContent=progress===1?('落成 · '+(clock.night?'日常 · 夜':'日常 · 日')):progress<.15?'奠基 · 铺展街区':progress<.7?'生长 · 楼层归位':'收束 · 天际线成形';
    $('timeline').value=String(Math.min(1,state.time/city.duration));
    $('timeline').style.setProperty('--range-progress',(Math.min(1,state.time/city.duration)*100)+'%');
    $('pause-btn').textContent=state.paused?(state.time>=city.duration?'继续城市生活':'继续营造'):(state.time>=city.duration?'暂停城市生活':'暂停营造');
    $('pause-btn').setAttribute('aria-pressed',String(state.paused));
    $('speed-value').textContent=settings.speed.toFixed(1)+'×';
    $('density-value').textContent=Math.round(settings.density*100)+'%';
    $('skyline-value').textContent=settings.skyline.toFixed(1)+'×';
    $('dream-light-value').textContent=Math.round(settings.dreamLight*100)+'%';
    if(physicalScene&&physicalScene.getInfo().district)$('blender-status').textContent=city.buildings.length+' 组已就绪';
    $('north-mark').style.transform=`rotate(${Math.atan2(Math.sin(state.yaw+state.cameraYaw),Math.cos(state.yaw+state.cameraYaw)*Math.sin(state.pitch+state.cameraPitch))}rad)`;
  }
  function setConstructionTime(seconds){
    if(settings.solarShow)state.droneShowStart+=seconds-state.time;
    state.time=seconds;
  }
  function rebuild(seed=settings.seed,keepProgress=false) {
    const ratio=keepProgress?Math.min(1,state.time/city.duration):0;
    settings.seed=Number.isFinite(Number(seed))?Math.trunc(Number(seed))>>>0:defaults.seed;
    city=createCity();
    if(state.focusFacility?.startsWith('housing-')&&!settings.housing)chooseView('home');
    $('focus-housing').disabled=$('housing-type').disabled=!settings.housing;
    if(state.focusFacility==='playground'&&!city.playground)chooseView('home');
    updateFacilityButtons();
    if(town.seed!==city.seed){
      residentNameSource=CityResidentNames.loadRoster(()=>localStorage);residentNameSignature=JSON.stringify(residentNameSource.roster);
      updateResidentNameNotice();
      town=CityResidents.create({seed:city.seed,roster:residentNameSource.roster});snapshots=new Map();residentById=new Map(town.residents.map(r=>[r.id,r]));selectedResident=null;
    }
    bindings=CityTownView.bindMap(city,town.buildings);bindLightingBuildings();townKey='';lastPanelKey='';walkingSelections.clear();
    life=CityLife.create(city,{bindings,maxPeople:360});
    streetService=CityLighting.streetSchedule(life,city);
    canvasActivity=null;
    transitPlan=CityTransitMotion.create(city);
    lightMotes=CityLight.create(city);
    if(physicalScene)physicalScene.rebuild(city,life,town.residents);refreshTown(true);
    setConstructionTime(ratio*city.duration);
    frameTime=performance.now();
    $('seed-input').value=String(city.seed);
    syncLayoutURL();
    updateLayoutEditor();
    updateUI(true);
  }

  function syncAtlasBack(){
    const link=$('atlas-back');
    if(link)link.href='./atlas.html?seed='+String(settings.seed);
  }
  function syncLayoutURL(){
    const url=new URL(location.href);
    url.searchParams.set('seed',String(settings.seed));
    if(layout.every((lot,i)=>lot===i))url.searchParams.delete('layout');
    else url.searchParams.set('layout',layout.join(','));
    try{history.replaceState(null,'',url.href);}catch(_){/* Local file browsers may disallow history updates. */}
    syncAtlasBack();
  }

  function syncMinuteURL(){
    const url=new URL(location.href);
    const minute=CityDailyClock.minuteOfDay(state.daySeconds);
    if(minute===DAY_START_MINUTE)url.searchParams.delete('minute');else url.searchParams.set('minute',String(minute));
    const day=dayClock().day;if(day===1)url.searchParams.delete('day');else url.searchParams.set('day',String(day));
    try{history.replaceState(null,'',url.href);}catch(_){/* Local file browsers may disallow history updates. */}
  }
  function updateLayoutEditor(message){
    const select=$('layout-facility');


    // would point the editor at somebody else's square.
    if(!facilityPresent(select.value)){
      const first=Array.from(select.options).find(option=>facilityPresent(option.value));
      if(first)select.value=first.value;
    }
    const selected=layout[facilityLots[select.value]];
    const cells=CityLayout.cells(city);
    $('layout-grid').replaceChildren(...cells.map(cell=>{
      const button=document.createElement('button');
      button.type='button';button.className='layout-cell';button.dataset.lot=cell.index;button.dataset.kind=cell.kind;
      button.style.gridColumn=String(cell.col+1+(cell.col>=2?1:0));button.style.gridRow=String(cell.row+1);
      button.setAttribute('aria-pressed',String(cell.index===selected));
      button.setAttribute('aria-label',cell.label+' '+cell.name+(cell.index===selected?'，当前所选设施':'，点击交换'));
      const coordinate=document.createElement('span');coordinate.textContent=cell.label;
      const name=document.createElement('b');name.textContent=cell.name;
      button.append(coordinate,name);
      try{CityLayout.swap(layout,selected,cell.index);}catch(_){button.disabled=true;button.title='车站需要位于城市两侧外缘';}
      button.onclick=()=>moveSelectedFacility(cell.index);
      return button;
    }));
    $('layout-undo').disabled=layoutHistory.length===0;
    $('layout-reset').disabled=layout.every((lot,i)=>lot===i);
    if(message)$('layout-status').textContent=message;
  }
  function setLayoutEditing(value){
    if(value&&immersive)return;
    layoutEditing=value;
    $('layout-editor').hidden=!value;
    document.querySelector('.model-frame').classList.toggle('is-editing',value);
    $('layout-toggle').setAttribute('aria-expanded',String(value));
    $('layout-toggle').classList.toggle('is-active',value);
    if(value){setConstructionTime(city.duration);pause(true);chooseView('top');updateLayoutEditor();}
    if(physicalScene)physicalScene.invalidate();
  }
  function applyLayout(next,message){
    layoutHistory.push(layout.slice());
    if(layoutHistory.length>40)layoutHistory.shift();
    layout=next;
    rebuild(city.seed,true);
    setConstructionTime(city.duration);pause(true);chooseView('top');
    updateLayoutEditor(message);
  }
  function moveSelectedFacility(destination){
    const type=$('layout-facility').value,source=layout[facilityLots[type]],cells=CityLayout.cells(city);
    if(source===destination){updateLayoutEditor(cells[source].name+'已在 '+cells[source].label+'，请选择另一个格子。');return;}
    let next;
    try{next=CityLayout.swap(layout,source,destination);}catch(_){updateLayoutEditor('车站需要位于两侧外缘，请选择 A 列或 D 列。');return;}
    applyLayout(next,cells[source].name+'已移至 '+cells[destination].label+'，与'+cells[destination].name+'交换。');
    $('layout-grid').querySelector('[data-lot="'+destination+'"]').focus({preventScroll:true});
  }
  function pause(value=!state.paused) {
    // Resume street life without rebuilding a completed city.
    state.paused=value;frameTime=performance.now();updateUI(true);
  }
  function markView(name) {
    if($('sky-view'))$('sky-view').value='';
    $('view-airship')?.classList.toggle('is-active',!!state.focusAirship);
    $('view-airship')?.setAttribute('aria-pressed',String(!!state.focusAirship));
    $('focus-housing').classList.toggle('is-active',Boolean(state.focusFacility?.startsWith('housing-')));
    $('focus-housing').setAttribute('aria-pressed',String(Boolean(state.focusFacility?.startsWith('housing-'))));
    for(const n of ['home','top','front','solar']){$('view-'+n).classList.toggle('is-active',n===name);$('view-'+n).setAttribute('aria-pressed',String(n===name));}
    for(const n of FOCUS_BUTTONS){
      const button=$('focus-'+n);
      if(!button)continue;                       // a kind registered before its button ships
      button.classList.toggle('is-active',state.focusFacility===n);
      button.setAttribute('aria-pressed',String(state.focusFacility===n));
    }
  }


  function facilityPresent(type){
    if(type==='waterfront')return Boolean(city.waterfront&&city.waterfront.stalls.length);
    if(type==='playground')return Boolean(city.playground);
    return (city.facilities||[]).some(item=>item.facility===type)||(city.places||[]).some(item=>item.kind===type);
  }
  function updateFacilityButtons(){
    for(const type of FOCUS_BUTTONS){
      const button=$('focus-'+type);
      if(!button)continue;
      button.disabled=!facilityPresent(type);
      button.title=button.disabled?'这一栋还没有画进地图':'近看'+button.textContent;
    }
    const select=$('layout-facility');
    for(const option of select.options)option.disabled=!facilityPresent(option.value);
  }
  function chooseSkyView(name){
    const minute={sunrise:331,sunset:1138,moon:1260}[name];if(minute===undefined)return;
    chooseView('home');setConstructionTime(city.duration);setSimTime({minute});pause(true);
    const sky=CityMaterials.skyState(state.daySeconds,lightingState().dusk);
    const d=name==='moon'?sky.moonDirection:sky.sunDirection;
    const offset=Math.min(.18,Math.atan(.48*sketch.width/sketch.height*Math.tan(Math.PI/12)));
    // Keep the eye above the town; only tilt its gaze up toward the higher moon.
    if(name==='moon')state.cameraPitch=.145-Math.asin(d.y);
    targets={yaw:Math.atan2(-d.x,-d.z)+offset,pitch:.025,zoom:.88};
    markView(null);$('sky-view').value=name;
    if(physicalScene)physicalScene.invalidate();
  }
  function chooseView(name) {
    state.solarView=name==='solar'&&settings.solarShow;
    state.observation=null;
    state.focusBuilding=false;state.focusFacility=null;
    targets=VIEW_PRESETS[name]||VIEW_PRESETS.home;
    state.orbit=false;$('auto-orbit').checked=false;resetNavigation();
    markView(name);
  }
  function updateDroneControls(){
    const pattern=window.SolarDroneShow.PATTERNS.find(p=>p.id===settings.dronePattern);
    $('view-solar').textContent=pattern.name+' · '+pattern.count+' 架';
    $('drone-pattern').value=pattern.id;
    $('drone-replay').hidden=!settings.solarShow||pattern.id!=='thousand';
    $('drone-pattern').disabled=$('drone-replay').disabled=!physicalScene;
  }
  function selectDronePattern(id){
    if(!physicalScene||!settings.solarShow)return;
    settings.dronePattern=id==='thousand'?'thousand':'solar';state.droneShowStart=state.time;
    physicalScene.setDronePattern(settings.dronePattern);updateDroneControls();chooseView('solar');pause(false);
    const url=new URL(location.href);url.searchParams.set('show',settings.dronePattern);history.replaceState(null,'',url.href);

  }

  function focusAirship(){
    resetNavigation();state.observation=null;state.focusBuilding=false;state.focusFacility=null;
    state.focusAirship=true;state.orbit=false;$('auto-orbit').checked=false;
    const ship=airshipState();if(ship)state.flyTarget={x:ship.x,y:ship.y,z:ship.z};
    targets={yaw:.65,pitch:.38,zoom:5};markView(null);if(physicalScene)physicalScene.invalidate();
  }
  function focusBlender(){
    if(!physicalScene||!physicalScene.getInfo().blender)return;
    state.observation=null;state.focusBuilding=true;state.focusFacility=null;state.orbit=false;$('auto-orbit').checked=false;resetNavigation();
    targets={yaw:-.66,pitch:.48,zoom:1};markView(null);physicalScene.invalidate();
  }
  function focusFacility(type){
    const focus=CityPlaces.focus(city,type);
    if(!focus)return;
    state.observation=null;state.focusBuilding=false;state.focusFacility=type;
    state.orbit=false;$('auto-orbit').checked=false;resetNavigation();
    const preset=type==='station'?{yaw:focus.x>0?.85-Math.PI:.85,pitch:.95}
      :type.startsWith('housing-')?HOUSING_VIEW:(FACILITY_VIEWS[type]||FACILITY_DEFAULT);
    targets={yaw:preset.yaw,pitch:preset.pitch,zoom:1};
    markView(null);if(physicalScene)physicalScene.invalidate();
  }
  function setControlMode(mode){
    if(mode===controlMode)return;
    controlMode=mode;
    document.querySelectorAll('.mode-chip').forEach(chip=>chip.setAttribute('aria-pressed',String(chip.dataset.mode===mode)));
    document.querySelectorAll('[data-mode-body]').forEach(body=>{body.hidden=body.dataset.modeBody!==mode;});
    if(document.pointerLockElement)document.exitPointerLock();
    joystickVec=null;
    $('joystick').hidden=mode!=='moba';
    $('joy-knob').style.transform='';
    const hint=$('fps-hint');
    hint.hidden=mode!=='fps';
    clearTimeout(fpsHintTimer);hint.classList.remove('is-faded');
    if(mode==='fps')hint.textContent='点击画面锁定鼠标，进入第一人称操控';
    if(mode!=='orbit'){state.orbit=false;$('auto-orbit').checked=false;}
    if(physicalScene)physicalScene.invalidate();
  }
  function setImmersive(value){
    if(immersive===value)return;
    immersive=value;document.body.classList.toggle('is-immersive',value);
    document.querySelectorAll('.topbar,.controls').forEach(element=>{element.inert=value;});
    $('fullscreen-btn').textContent=value?'退出全屏':'全屏播放';
    $('fullscreen-btn').setAttribute('aria-pressed',String(value));
    if(value){setLayoutEditing(false);pausedBeforeFullscreen=state.paused;pause(false);}else pause(pausedBeforeFullscreen);
    if(physicalScene)physicalScene.invalidate();
  }
  async function toggleFullscreen(){
    if(fullscreenPending)return;
    fullscreenPending=true;
    try{
      if(immersive){
        if(document.fullscreenElement)await document.exitFullscreen();
        setImmersive(false);
      }else{

        setImmersive(true);
        const panel=document.querySelector('.scene-panel');
        if(panel.requestFullscreen){try{await panel.requestFullscreen();}catch(_){/* Keep the immersive page view. */}}
      }
    }finally{fullscreenPending=false;}
  }
  async function exportPNG() {
    const canvas=document.createElement('canvas'),w=sketch.width,h=sketch.height;
    canvas.width=w*2;canvas.height=h*2;
    const context=canvas.getContext('2d');context.scale(2,2);while(renderTo(context,w,h)===false)await new Promise(requestAnimationFrame);
    canvas.toBlob(blob=>{
      if(!blob)return;
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=`千人小镇-V4-日常-${city.seed}.png`;a.click();
      setTimeout(()=>URL.revokeObjectURL(url),2000);
    },'image/png');
  }
  function bindControls() {
    $('seed-input').value=String(city.seed);
    syncAtlasBack();
    $('layout-toggle').onclick=()=>setLayoutEditing(!layoutEditing);
    $('layout-close').onclick=()=>{setLayoutEditing(false);$('layout-toggle').focus({preventScroll:true});};
    $('layout-facility').onchange=()=>updateLayoutEditor('已选择'+$('layout-facility').selectedOptions[0].textContent+'，点击目标格子交换。');
    $('layout-undo').onclick=()=>{if(!layoutHistory.length)return;layout=layoutHistory.pop();rebuild(city.seed,true);updateLayoutEditor('已撤销上一步，地块恢复到交换前的位置。');};
    $('layout-reset').onclick=()=>{if(layout.some((lot,i)=>lot!==i))applyLayout(CityLayout.identity(),'已恢复默认布局，可以撤销本次恢复。');};
    updateLayoutEditor(layout.some((lot,i)=>lot!==i)?'已载入网址中的布局，可继续交换或恢复默认。':null);
    $('playground-toggle').onchange=e=>{settings.playground=e.target.checked;rebuild(city.seed,true);};
    $('housing-toggle').onchange=e=>{settings.housing=e.target.checked;rebuild(city.seed,true);};
    $('housing-blender-toggle').onchange=e=>{settings.housingBlenderModel=e.target.checked;if(physicalScene){physicalScene.rebuild(city,life,town.residents);refreshTown(true);physicalScene.invalidate();frameTime=performance.now();}};
    $('focus-housing').onclick=()=>focusFacility('housing-'+$('housing-type').value);
    $('housing-type').onchange=()=>focusFacility('housing-'+$('housing-type').value);
    $('blender-toggle').onchange=e=>{settings.blenderModel=e.target.checked;if(physicalScene)physicalScene.invalidate();};
    $('blender-focus').onclick=focusBlender;
    for(const type of FOCUS_BUTTONS){const button=$('focus-'+type);if(button)button.onclick=()=>focusFacility(type);}
    updateFacilityButtons();
    $('fullscreen-btn').onclick=toggleFullscreen;
    document.addEventListener('fullscreenchange',()=>{setImmersive(Boolean(document.fullscreenElement));});
    // 隐藏界面：全屏观景时让顶部操作条与底部播放条退场（手机竖屏空间紧张时最有用）
    const syncShowUI=()=>{
      const hidden=document.body.classList.contains('ui-hidden');
      $('show-ui').hidden=!hidden;
      $('ui-toggle').setAttribute('aria-pressed',String(hidden));
    };
    $('ui-toggle').onclick=()=>{document.body.classList.toggle('ui-hidden');syncShowUI();};
    $('show-ui').onclick=()=>{document.body.classList.remove('ui-hidden');syncShowUI();};
    // 左上角镜头操作面板：桌面默认展开、触屏默认收起，隐藏/展开状态记在浏览器
    const hint=$('keys-hint'),hintOpen=$('keys-hint-open');
    const applyHint=hidden=>{
      hint.hidden=hidden;hintOpen.hidden=!hidden;
      $('keys-hint-toggle').setAttribute('aria-expanded',String(!hidden));
      try{localStorage.setItem('town-keys-hint',hidden?'1':'0');}catch(_){/* 隐私模式下静默 */}
    };
    let hintHidden=false;
    try{const saved=localStorage.getItem('town-keys-hint');hintHidden=saved===null?matchMedia('(pointer:coarse)').matches:saved==='1';}catch(_){hintHidden=matchMedia('(pointer:coarse)').matches;}
    applyHint(hintHidden);
    $('keys-hint-toggle').onclick=()=>applyHint(true);
    hintOpen.onclick=()=>applyHint(false);
    // 操作模式：环绕 / 键鼠第一人称（Pointer Lock）/ 触屏轮盘，切换按钮与说明都在左上面板内
    document.querySelectorAll('.mode-chip').forEach(chip=>chip.onclick=()=>{
      setControlMode(chip.dataset.mode);
      try{localStorage.setItem('town-control-mode',chip.dataset.mode);}catch(_){/* 隐私模式下静默 */}
    });
    // 初始模式自动识别：触屏设备（主指针为粗指针）默认轮盘，鼠标设备默认环绕；手动切换过的记忆优先
    let autoMode='orbit';
    try{
      const saved=localStorage.getItem('town-control-mode');
      autoMode=saved&&['orbit','fps','moba'].includes(saved)?saved:(matchMedia('(pointer:coarse)').matches?'moba':'orbit');
    }catch(_){autoMode=matchMedia('(pointer:coarse)').matches?'moba':'orbit';}
    if(autoMode!=='orbit')setControlMode(autoMode);
    document.addEventListener('pointerlockchange',()=>{
      if(controlMode!=='fps')return;
      const locked=document.pointerLockElement===stage;
      const hint=$('fps-hint');
      clearTimeout(fpsHintTimer);hint.classList.remove('is-faded');
      hint.textContent=locked?'WASD 移动 · Q/E 升降 · 鼠标转视角 · 滚轮缩放 · Esc 释放鼠标':'点击画面锁定鼠标，进入第一人称操控';
      if(locked)fpsHintTimer=setTimeout(()=>hint.classList.add('is-faded'),6000);
    });
    document.addEventListener('mousemove',e=>{
      if(controlMode!=='fps'||document.pointerLockElement!==stage)return;
      // FPS 瞄准约定：鼠标向右看右（与环绕拖拽的「抓取世界」方向相反，故 yaw 取负）
      state.yaw-=e.movementX*.0026;targets=null;markView(null);
      const wanted=state.pitch+state.cameraPitch+e.movementY*.0022,next=clamp(wanted,LOOK_PITCH_MIN,LOOK_PITCH_MAX);
      state.cameraPitch=next-state.pitch;if(next!==wanted)viewVelocity.pitch=0;
    });
    const joy=$('joystick'),joyKnob=$('joy-knob');
    let joyId=null,joyCenter=null;
    const joyUpdate=e=>{
      if(e.pointerId!==joyId||!joyCenter)return;
      const R=38;let dx=e.clientX-joyCenter.x,dy=e.clientY-joyCenter.y;
      const len=Math.hypot(dx,dy);
      if(len>R){dx*=R/len;dy*=R/len;}
      joyKnob.style.transform=`translate(${dx}px,${dy}px)`;
      joystickVec=len<R*.18?null:{x:dx/R,y:-dy/R};
    };
    joy.addEventListener('pointerdown',e=>{
      e.stopPropagation();joyId=e.pointerId;
      const r=joy.querySelector('.joy-base').getBoundingClientRect();
      joyCenter={x:r.left+r.width/2,y:r.top+r.height/2};
      try{joy.setPointerCapture(joyId);}catch(_){/* 指针不可捕获时退化为普通跟随 */}
      state.orbit=false;$('auto-orbit').checked=false;
      joyUpdate(e);
    });
    joy.addEventListener('pointermove',joyUpdate);
    const joyEnd=e=>{if(e.pointerId!==joyId)return;joyId=null;joystickVec=null;joyKnob.style.transform='';};
    joy.addEventListener('pointerup',joyEnd);joy.addEventListener('pointercancel',joyEnd);joy.addEventListener('lostpointercapture',joyEnd);
    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape')return;
      if(immersive){e.preventDefault();if(!fullscreenPending)toggleFullscreen();}
      else if(layoutEditing){e.preventDefault();setLayoutEditing(false);$('layout-toggle').focus({preventScroll:true});}
    });
    $('seed-input').addEventListener('change',()=>rebuild($('seed-input').value));
    $('seed-input').addEventListener('keydown',e=>{if(e.key==='Enter')rebuild($('seed-input').value);});
    $('seed-prev').onclick=()=>rebuild(city.seed-1);
    $('seed-next').onclick=()=>rebuild(city.seed+1);
    $('seed-random').onclick=()=>{const seed=crypto.getRandomValues(new Uint32Array(1))[0];layout=CityLayout.randomize(seed);layoutHistory.length=0;rebuild(seed);chooseView('home');pause(false);};
    $('replay-btn').onclick=()=>{setConstructionTime(0);pause(false);};
    $('pause-btn').onclick=()=>pause();
    $('view-airship').onclick=focusAirship;
    $('sky-view').onchange=e=>chooseSkyView(e.target.value);
    $('save-btn').onclick=exportPNG;
    $('timeline').addEventListener('input',()=>{setConstructionTime(Number($('timeline').value)*city.duration);pause(true);});
    // 日常时钟的滑杆**不暂停**画面：拖到 22:00 看到的就是 22:00 的镇子，松手继续走。
    // 落成动画照原样跑完，两条时钟互不干涉（§5.1）。
    $('day-timeline').addEventListener('input',()=>setSimTime({minute:Number($('day-timeline').value)}));
    $('day-prev').onclick=()=>setSimTime({day:dayClock().day-1});
    $('day-next').onclick=()=>setSimTime({day:dayClock().day+1});
    $('town-building').onchange=e=>observe(e.target.value);
    document.querySelectorAll('[data-observe]').forEach(button=>button.onclick=()=>observe(button.dataset.observe));
    $('residents-present').onclick=()=>{residentMode='present';lastPanelKey='';updateTownPanel();};
    $('residents-home').onclick=()=>{residentMode='home';lastPanelKey='';updateTownPanel();};
    for(const speed of [1,2,4])$('day-speed-'+speed).onclick=()=>{
      settings.daySpeed=speed;
      for(const other of [1,2,4]){const button=$('day-speed-'+other);
        button.classList.toggle('is-active',other===speed);button.setAttribute('aria-pressed',String(other===speed));}
    };
    $('speed').addEventListener('input',e=>{settings.speed=clamp(Number(e.target.value),.4,2.5);updateUI(true);});
    $('dream-light').addEventListener('input',e=>{settings.dreamLight=clamp(Number(e.target.value),0,1);updateUI(true);});
    for(const name of ['density','skyline'])$(name).addEventListener('input',e=>{settings[name]=Number(e.target.value);rebuild(city.seed,true);});
    for(const name of ['stone','glass','ground'])$(name+'-color').addEventListener('input',e=>{settings[name]=e.target.value;colorCache.clear();});
    $('auto-orbit').onchange=e=>{state.orbit=e.target.checked;targets=null;if(state.orbit)markView(null);};
    $('loop-toggle').disabled=settings.solarShow;
    $('loop-toggle').onchange=e=>{state.loop=e.target.checked;if(state.loop&&state.time>=city.duration)setConstructionTime(city.duration);};
    $('view-solar').hidden=!settings.solarShow;$('view-solar').disabled=!physicalScene;
    $('drone-library').hidden=!settings.solarShow;
    for(const pattern of window.SolarDroneShow.PATTERNS){const option=document.createElement('option');option.value=pattern.id;option.textContent=pattern.name;$('drone-pattern').appendChild(option);}
    updateDroneControls();$('drone-pattern').onchange=e=>selectDronePattern(e.target.value);$('drone-replay').onclick=()=>selectDronePattern('thousand');
    for(const name of ['home','top','front','solar'])$('view-'+name).onclick=()=>chooseView(name);
    $('reset-btn').onclick=()=>{
      Object.assign(settings,{...defaults,seed:city.seed});
      for(const n of ['density','skyline','speed'])$(n).value=String(settings[n]);
      for(const n of ['stone','glass','ground'])$(n+'-color').value=settings[n];
      $('dream-light').value=String(settings.dreamLight);
      $('blender-toggle').checked=settings.blenderModel;
      $('playground-toggle').checked=settings.playground;
      $('housing-toggle').checked=settings.housing;
      $('housing-blender-toggle').checked=settings.housingBlenderModel;
      state.loop=false;$('loop-toggle').checked=false;state.paused=reducedMotion;colorCache.clear();
      rebuild(city.seed);chooseView('home');
    };
    const stage=$('stage');
    // 多点触控：双指捏合缩放（手机端）。pointers 记录按下的指头，两指时以指距变化量驱动 zoomAt。
    const pointers=new Map();let pinchDist=0;
    stage.addEventListener('pointerdown',e=>{
      if(e.target.tagName!=='CANVAS'||e.button!==0)return;
      if(controlMode==='fps'){ // 键鼠模式：点击即锁定鼠标（桌面）；锁定期间不走拖动逻辑
        if(document.pointerLockElement!==stage&&e.pointerType!=='touch'&&stage.requestPointerLock){try{stage.requestPointerLock();}catch(_){/* 拒绝时保持页面模式 */}}
        return;
      }
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      stage.setPointerCapture(e.pointerId);
      if(pointers.size===2){
        dragging=null;stage.classList.remove('is-dragging');moved=true;
        const [a,b]=[...pointers.values()];pinchDist=Math.hypot(a.x-b.x,a.y-b.y);
        return;
      }
      if(pointers.size>2)return;
      targets=null;dragging={x:e.clientX,y:e.clientY,yaw:state.yaw,pitch:state.pitch+state.cameraPitch,basePitch:state.pitch};moved=false;
      stage.classList.add('is-dragging');
      state.orbit=false;$('auto-orbit').checked=false;
    });
    stage.addEventListener('pointermove',e=>{
      const tracked=pointers.get(e.pointerId);
      if(tracked){tracked.x=e.clientX;tracked.y=e.clientY;}
      if(pointers.size===2){
        const [a,b]=[...pointers.values()];const dist=Math.hypot(a.x-b.x,a.y-b.y);
        if(pinchDist>0&&dist>0){
          const box=stage.getBoundingClientRect();
          zoomAt(dist/pinchDist,(a.x+b.x)/2-box.left,(a.y+b.y)/2-box.top,box.width,box.height);
        }
        pinchDist=dist;
        return;
      }
      if(!dragging)return;
      const dx=e.clientX-dragging.x,dy=e.clientY-dragging.y;
      moved=moved||Math.abs(dx)+Math.abs(dy)>3;
      if(moved)markView(null);
      state.yaw=dragging.yaw+dx*.006;
      const desired=clamp(dragging.pitch+dy*.004,LOOK_PITCH_MIN,LOOK_PITCH_MAX);
      state.pitch=clamp(dragging.basePitch+dy*.004,state.solarView?.10:.28,LOOK_PITCH_MAX);state.cameraPitch=desired-state.pitch;
    });
    const release=e=>{
      pointers.delete(e.pointerId);
      if(pointers.size===1){ // 捏合后退回单指：以剩余指位重置旋转起点，避免视角跳变
        const [rest]=[...pointers.values()];
        dragging={x:rest.x,y:rest.y,yaw:state.yaw,pitch:state.pitch+state.cameraPitch,basePitch:state.pitch};moved=true;
        return;
      }
      if(pointers.size>0)return;
      if(e.type==='pointerup'&&dragging&&!moved&&physicalScene&&!layoutEditing){const rect=stage.getBoundingClientRect();const id=physicalScene.pickBuilding(e.clientX-rect.left,e.clientY-rect.top,rect.width,rect.height);if(id){selectedBuilding=id;selectedResident=null;residentMode='present';lastPanelKey='';updateUI(true);}}dragging=null;stage.classList.remove('is-dragging');
    };
    stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',release);stage.addEventListener('lostpointercapture',release);
    stage.addEventListener('wheel',e=>{
      if(e.target.tagName!=='CANVAS'){return;}
      e.preventDefault();
      const box=stage.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY*.001),e.clientX-box.left,e.clientY-box.top,box.width,box.height);
    },{passive:false});
  }

  new p5(p=>{
    sketch=p;
    p.setup=()=>{
      const stage=$('stage');
      const canvas=p.createCanvas(Math.max(1,stage.clientWidth),Math.max(1,stage.clientHeight));
      canvas.parent(stage);canvas.elt.setAttribute('aria-label','日光下的城市建筑模型，可拖拽旋转与滚轮缩放');
      canvas.elt.setAttribute('role','img');
      canvas.elt.style.touchAction='none';canvas.elt.style.display='block';
      p.pixelDensity(Math.min(window.devicePixelRatio||1,2));p.frameRate(60);
      try {physicalScene=CityScene.create(settings);physicalScene.rebuild(city,life,town.residents);physicalScene.attach(stage,canvas.elt);refreshTown(true);}
      catch(error){if(physicalScene)physicalScene.dispose();physicalScene=null;console.warn('WebGL unavailable; using the local canvas renderer.',error);}
      bindControls();updateUI(true);
      observer=new ResizeObserver(()=>{
        const w=Math.round(stage.clientWidth),h=Math.round(stage.clientHeight);
        if(w>0&&h>0&&(w!==p.width||h!==p.height))p.resizeCanvas(w,h);
      });observer.observe(stage);
      if(requestEmbed)setImmersive(true);
      const buildingAssets=window.CityDistrict||window.CityBlender;
      if(physicalScene&&buildingAssets){
        Promise.allSettled([buildingAssets.load(),CityHousing.load()]).then(results=>{
          physicalScene.rebuild(city,life,town.residents);refreshTown(true);frameTime=performance.now();
          if(results[0].status==='fulfilled'){
            $('blender-status').textContent=city.buildings.length+' 组已就绪';$('blender-toggle').disabled=false;$('blender-focus').disabled=false;
            document.documentElement.dataset.blenderReady='true';
          }else{$('blender-status').textContent='使用基础楼体';console.warn('District assets unavailable; keeping procedural buildings.',results[0].reason);}
          if(results[1].status==='fulfilled'){
            $('housing-blender-status').textContent='四类住宅 · Blender 精修';$('housing-blender-toggle').disabled=false;
            document.documentElement.dataset.refinedHousingReady='true';
          }else{$('housing-blender-status').textContent='使用原住宅模型';document.documentElement.dataset.refinedHousingReady='fallback';console.warn('Housing assets unavailable; keeping procedural housing.',results[1].reason);}
          if(settings.solarShow){state.time=city.duration;state.droneShowStart=state.time;updateDroneControls();chooseView('solar');pause(reducedMotion);}
          else if(new URLSearchParams(location.search).get('sample')==='blender')focusBlender();
          else if(new URLSearchParams(location.search).get('sample')==='district'){state.time=city.duration;pause(true);chooseView(layoutEditing?'top':'home');}
        });
      }else{$('blender-status').textContent='精细建筑需要三维模式';$('housing-blender-status').textContent='兼容模式住宅';document.documentElement.dataset.refinedHousingReady='fallback';}
      document.addEventListener('visibilitychange',()=>{frameTime=null;if(document.hidden)p.noLoop();else p.loop();});
    };
    p.draw=()=>{
      const before=performance.now(),dt=frameTime===null?0:Math.max(0,Math.min(.1,(before-frameTime)/1000));
      frameTime=before;

      if(document.visibilityState!=='hidden')applyHeldKeys(dt);
      if(!state.paused&&!document.hidden) {
        state.time+=dt*settings.speed;


        // 与影子的方向一定互相吻合。
        state.daySeconds+=dt*settings.daySpeed;
        if(state.loop&&!settings.solarShow&&state.time>city.duration+60)state.time=0;
        if(state.orbit&&!dragging)state.yaw+=dt*.045;
      }
      if(targets) {
        const factor=reducedMotion?1:1-Math.exp(-Math.min(p.deltaTime/1000,.5)*9);
        for(const key of ['yaw','pitch','zoom'])state[key]=mix(state[key],targets[key],factor);
        if(Math.abs(state.yaw-targets.yaw)+Math.abs(state.pitch-targets.pitch)+Math.abs(state.zoom-targets.zoom)<.001){Object.assign(state,targets);targets=null;}
      }
      if(renderTo(p.drawingContext,p.width,p.height)!==false){$('loading').hidden=true;document.documentElement.dataset.ready='true';renderCount++;}updateUI();lastFrameMs=performance.now()-before;
    };
  });
  window.cityStudio={
    getState:()=>({...state,layout:layout.slice(),layoutEditing,seed:city.seed,duration:city.duration,summary:CityModel.summarize(city,Math.min(state.time,city.duration)),settings:{...settings},renderCount,lastFrameMs,renderer:physicalScene?physicalScene.getInfo():{engine:'Canvas 2D fallback',airship:airshipState()?{position:{...airshipState()},route:{...airshipPlan.route}}:null},canvas:sketch?{width:sketch.width,height:sketch.height}:null}),
    seek:seconds=>{setConstructionTime(clamp(Number(seconds)||0,0,city.duration));state.paused=true;updateUI(true);},
    renderAt:seconds=>{state.time=Number.isFinite(Number(seconds))?Math.max(0,Number(seconds)):0;state.paused=true;targets=null;if(physicalScene)physicalScene.invalidate();renderTo(sketch.drawingContext,sketch.width,sketch.height);updateUI(true);},
    rebuild:seed=>rebuild(seed),pause:()=>pause(true),play:()=>pause(false),view:chooseView,skyView:chooseSkyView,focusBlender,focusFacility,focusAirship,
    // Camera tuning hook for the qa-redesign captures: put the viewpoint somewhere no
    // preset reaches, so a framing decision gets measured and screenshotted instead of
    // argued. `views()` reports the shipped presets.
    look:(yaw,pitch,zoom,panX,panY)=>{targets=null;state.cameraYaw=0;state.cameraPitch=0;resetHeldKeys();
      if(panX!==undefined||panY!==undefined)resetNavigation();
      state.yaw=Number(yaw);state.pitch=Number(pitch);
      if(Number.isFinite(Number(zoom)))state.zoom=Number(zoom);
      if(Number.isFinite(Number(panX)))state.panX=Number(panX);
      if(Number.isFinite(Number(panY)))state.panY=Number(panY);
      if(physicalScene)physicalScene.invalidate();},




    flyTo:(x,z,zoom,pitch,yaw,height)=>{targets=null;resetNavigation();
      state.observation=null;state.focusBuilding=false;state.focusFacility=null;
      if(Number.isFinite(Number(x))&&Number.isFinite(Number(z))){
        state.flyTarget={x:Number(x),y:Number.isFinite(height)?height:2,z:Number(z)};
      }
      if(Number.isFinite(Number(zoom)))state.zoom=clamp(Number(zoom),MIN_ZOOM,20);
      if(Number.isFinite(Number(pitch)))state.pitch=clamp(Number(pitch),.28,1.32);


      state.yaw=Number.isFinite(Number(yaw))?Number(yaw):VIEW_PRESETS.home.yaw;
      if(physicalScene)physicalScene.invalidate();updateUI(true);},
    views:()=>JSON.parse(JSON.stringify(VIEW_PRESETS)),
    facilityViews:()=>JSON.parse(JSON.stringify(FACILITY_VIEWS)),
    dayClock,lightingState,refreshResidentNames,

    seekDay:(minute,day)=>setSimTime({minute,day}),setSimTime,observe,
    setLayout:next=>applyLayout(CityLayout.normalize(next)),
    buildingAnchors:id=>bindings.locate(id),
    buildingScreenPoint:id=>physicalScene&&physicalScene.projectBuilding(id,sketch.width,sketch.height),
    townState:()=>{const v=refreshTown();return JSON.parse(JSON.stringify({...v,demand:undefined,proxyCounts:CityLife.countPeople(CityLife.sample(life,state.daySeconds,v.demand))}));},
    exportSnapshot:()=>CityPlanSnapshots.serialize(currentSnapshot()),
    windowLight,
    previewEffect:next=>{if(!physicalScene) return false;physicalScene.setEffectPreview(next);renderTo(sketch.drawingContext,sketch.width,sketch.height);return true;},
    getPlan:()=>JSON.parse(JSON.stringify(city)),getActivity:()=>{const activity=CityLife.sample(life,state.daySeconds,refreshTown().demand);return {...activity,vehicles:dailyVehicles(activity.vehicles),transit:CityTransitMotion.sample(transitPlan,state.time,state.daySeconds)};},exportPNG
  };
})();
