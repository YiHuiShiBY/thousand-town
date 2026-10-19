/* Pure presentation policy. Plans are supplied snapshots, never generated here. */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./daily-clock.js'):root.CityDailyClock,node?require('./resident-state.js'):root.CityResidentState);
  if(node)module.exports=api;
  if(root)root.CityLighting=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Clock,State){
  'use strict';
  const mod=(v,n)=>((v%n)+n)%n;
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  function factors(minute){
    const m=mod(minute,1440),daylight=Clock.daylight(m);
    const lamps=m<720?1-smooth(345,360,m):smooth(1110,1125,m);
    const dusk=smooth(990,1110,m)*(1-smooth(1140,1170,m));
    const windows=m<720?1-smooth(360,420,m):smooth(960,1035,m);
    return {minute:m,daylight,lamps,dusk,windows};
  }
  function isOpen(policy,day,minute){
    const type=Clock.dayType(day);
    return policy==='weekday'?type==='weekday':policy==='sat-am'?type==='weekday'||(type==='saturday'&&minute>=480&&minute<840):true;
  }
  // Stable per-building coin for the night-owl windows: FNV-1a over the ledger
  // id, so the same house keeps (or never gets) its late lights across replays.
  const hashId=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0)%1000/1000;};
  function sample(rows,snapshot,minute,townView){
    const f=factors(minute),counts={};
    snapshot.plans.forEach(plan=>{
      const v=State.stateAt(plan,f.minute);if(!v||v.location==='street')return;
      const c=counts[v.location]||(counts[v.location]={occupied:0,awake:0});
      c.occupied++;if(v.state!=='SLEEPING')c.awake++;
    });
    const buildings={};
    rows.forEach(row=>{
      const c=counts[row.id]||{occupied:0,awake:0};
      const entry=townView&&townView.byBuilding[row.id];
      const open=entry?entry.open:isOpen(row.open||'daily',snapshot.day,f.minute);
      const duty=!open&&c.occupied>0;
      const denominator=row.kind==='tower'?45:Math.max(1,row.capacity);
      const occupiedRoom=c.awake?f.windows*Math.min(.82,Math.max(.035,c.awake/denominator*.85)):0;
      // 塔楼夜间分量（氛围灯）：营业日傍晚到 23:00 前保底一层零星加班灯；冠部装饰灯走
      // decoration 通道，18:30–23:35 与路灯同亮同灭。occupied 如实统计不加戏——装饰亮灯
      // 不等于楼里有人，深夜两点两路都归零，守"不做假亮灯"的既有约定。
      const tower=row.kind==='tower';
      const overtime=tower&&open?.14*smooth(1075,1105,f.minute)*(1-smooth(1365,1395,f.minute)):0;
      // 晚睡窗（亮化第二批 #5）：23:00–01:00 之间，约四成住宅楼保一小撮灯——
      // 有人还没睡。楼级比例 .12 × 四成楼 ≈ 全镇 5% 的窗，到 01:00 截断，
      // 02:00 之后全城照旧归零（不与"深夜两点全黑"的既有断言打架）。
      const owl=row.kind==='housing'&&(f.minute>=1380||f.minute<60)&&hashId(row.id)<.38?.12*f.lamps:0;
      buildings[row.id]={kind:row.kind,open,occupied:c.occupied,awake:c.awake,
        room:Math.max(occupiedRoom,overtime,owl),
        maxPanes:duty?1:Infinity,
        // 门厅灯（#4）：楼道灯是市政行为的底线——有人出入的晚上近乎全亮，
        // 无人时刻也保三成微光，不再随 .16 的旧系数沉进夜色。
        entry:f.lamps*(c.occupied>0||f.minute<1350&&f.minute>=1080?.8:.3),
        facade:f.lamps*(f.minute>=1110&&f.minute<(tower?1415:1350)?1:.25),
        decoration:tower?f.lamps*(f.minute>=1110&&f.minute<1415?.62:0)
          :f.lamps*(f.minute>=1080&&f.minute<1350?.5:0)};
    });
    return Object.assign({day:snapshot.day,buildings},f);
  }
  // Bind BEFORE layout permutation; spatial sorting AFTER a swap changes identities.
  function bindBuildings(city,rows){
    const towers=city.buildings.filter(b=>b.kind==='glass').sort((a,b)=>a.z-b.z||a.x-b.x);
    const towerRows=rows.filter(r=>r.kind==='tower');
    city.buildings.forEach(b=>{
      const row=b.housing?rows.find(r=>r.kind==='housing'&&r.type===b.housing.type):b.facility?rows.find(r=>r.kind===b.facility):towerRows[towers.indexOf(b)];
      if(row)b.ledgerId=row.id;
    });
    return city;
  }
  function dispatch(kind,ordinal,minute){
    const m=mod(minute,1440);
    if(kind==='police')return true;
    if(kind==='bus'||kind==='shuttle')return m>=360&&m<1350;
    if(kind==='taxi')return ordinal===0||m>=360&&m<1380;
    return m>=360&&m<1200||m>=1200&&m<1380&&ordinal%2===0||ordinal%7===0;
  }
  // The rings stay on the board, so a service change settles over a mid-block
  // stretch instead of a cull beyond the edge.
  const STREET_FADE_RUN=8;
  function streetSchedule(life,city){
    return life.vehicleRoutes.map(route=>{
      // The seam is 25% along the longest street leg: the leg midpoint sits over
      // the canal bridge and both ends sit on avenue junctions, and a quarter in
      // lands on plain mid-block asphalt clear of both.
      const straight=route.segments.filter(s=>s.length>40).sort((a,b)=>b.length-a.length);
      const segment=straight[0]||route.segments[0];
      return {length:route.length,seam:segment.start+segment.length*.25};
    });
  }
  function streetVisibility(vehicle,route,seconds){
    const arc=mod(vehicle.offset+seconds*vehicle.speed-route.seam,route.length);
    const entered=seconds-arc/vehicle.speed;
    const previous=entered-route.length/vehicle.speed;
    const ordinal=vehicle.route*9+Number(vehicle.id.split('-').at(-1));
    const kind=vehicle.police?'police':vehicle.kind;
    const now=dispatch(kind,ordinal,entered/Clock.SECONDS_PER_SIM_MINUTE);
    const before=dispatch(kind,ordinal,previous/Clock.SECONDS_PER_SIM_MINUTE);
    if(now===before)return now?1:0;
    return now?Math.min(1,arc/STREET_FADE_RUN):Math.max(0,1-arc/STREET_FADE_RUN);
  }
  function streetActive(vehicle,route,seconds){
    return streetVisibility(vehicle,route,seconds)>0;
  }
  function roadHeight(city,x,z){
    const deck=(city.bridges||[]).reduce((height,b)=>Math.max(height,.25+1.7*smooth(0,1,(b.w/2+10-Math.abs(x-b.x))/10)*smooth(0,1,(b.d/2+4-Math.abs(z-b.z))/4)),.25);
    // V4 外环高架：高架上的车头灯光池要落在板面而不是板下的地面。公式与
    // city-ground / city-life 的 viaductHeight 同一条（横向平到 d/2+2.7、收边 1.2），两个
    // 渲染器共用本函数，一处改两处生效。
    const high=(city.viaducts||[]).reduce((top,v)=>Math.max(top,.25+(v.height-.25)*
      smooth(0,1,(v.flatX+v.rampX-Math.abs(x))/v.rampX)*
      smooth(0,1,(v.d/2+2.7-Math.abs(z-v.z))/1.2)),deck);
    // V4 环路隧道：车道带内路面离开 .25 基准、沿与行走模型同一条 S 曲线下沉，
    // Canvas 兜底与 WebGL 场景共用这条纵断，两边一起沉。
    let cut=0;
    (city.tunnels||[]).forEach(t=>{
      if(Math.abs(z-t.z)>t.halfD)return;
      const run=t.portalX-t.coverX;
      const along=Math.min(1,Math.max(0,(t.portalX-Math.abs(x))/run));
      cut=Math.max(cut,t.drop*smooth(0,1,along));
    });
    return cut>0?.25-cut:high;
  }
  return {roadHeight,factors,sample,isOpen,bindBuildings,dispatch,streetSchedule,streetActive,streetVisibility,STREET_FADE_RUN};
});