/* Public-space lots decorate the base plan without changing its seeded construction clock. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CityPlaces=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const sites=[
    {kind:'station',label:'车站',name:'西岸公交 · 出租车站',x:-132,z:40,w:52,d:58,height:12},
    {kind:'amusement',label:'游乐场',name:'星光乐园',x:132,z:120,w:52,d:58,height:56},
    {kind:'plaza',label:'广场',name:'城市之光广场',x:60,z:120,w:48,d:58,height:25}
  ];
  // 气球摊摆在游乐场南侧的入园铺装带上：离轮心 26 以上不碰摩天轮与支架，离环场
  // 步道面（半幅 30 × 32.5，宽 2.8）3 以上不挡行人，摊位随地块一起搬移。
  const WALK={x:30,z:32.5,width:2.8},STAND={x:16.5,z:25,w:4.6,d:5.2,height:8,clearance:26,gap:3};
  function overlap(a,b,gap=0){return Math.abs(a.x-b.x)<(a.w+b.w)/2+gap&&Math.abs(a.z-b.z)<(a.d+b.d)/2+gap;}
  function balloonStands(city){
    const lot=(city.places||[]).find(place=>place.kind==='amusement'),stands=[];
    if(!lot)return stands;
    [-1,1].forEach((side,index)=>{
      const stand={id:'balloon-'+index,kind:'balloon',x:lot.x+side*STAND.x,z:lot.z+STAND.z,
        w:STAND.w,d:STAND.d,height:STAND.height,facing:0};
      // The counter faces the block walk, so `facing` is the yaw of the lot's south side.
      if(Math.abs(stand.x-lot.x)+stand.w/2>lot.w/2||Math.abs(stand.z-lot.z)+stand.d/2>lot.d/2)return;
      if(Math.hypot(stand.x-lot.x,stand.z-lot.z)<STAND.clearance)return;
      const walkGap=Math.min(WALK.x-WALK.width/2-Math.abs(stand.x-lot.x)-stand.w/2,
        WALK.z-WALK.width/2-Math.abs(stand.z-lot.z)-stand.d/2);
      if(walkGap<STAND.gap)return;
      if((city.places||[]).some(place=>place!==lot&&overlap(stand,place,1.6)))return;
      if((city.roads||[]).some(road=>overlap(stand,road,1)))return;
      if(city.water&&overlap(stand,city.water,1))return;
      stands.push(stand);
    });
    return stands;
  }
  // 候车点（2026-09-21 拍板 6 站 3 亭，docs/street-props-plan.md §3）：公交沿东西
  // 向道路的路缘设站，shelter 标记的站升候车亭、其余立站牌。南大街自西向东：
  // 车站接驳（-141，缘线上的灯杆与行道树把 -123 一带的亭位钳死，站随亭西挪
  // 到可落位处，仍在车站门前）、医院（-60）、广场乐园合并端（113）——提案原
  // 为 60/132 两站：广场与乐园两家地块的预留把 13.4 宽的亭位挤出缘线、两站
  // 中间又压着东堤大道（x=96）的路口，遂在大道东侧合并为一座站牌站；北大
  // 街：西居住（-42）、水岸夜市（42，东岸摊线外侧）、东居住（123，既有站，
  // 升亭补上第三座）。出租车队仍在车站临街一侧。位置随地块一起搬移（车站换
  // 地块时出租车站跟着走），供地面站台与候车人流共用。
  // Kerbside, just clear of the carriageway edge: buses on the two east-west roads,
  // the taxi rank alongside the station where its own fleet already operates.
  var STOPS={bus:[{x:-141,z:90.6,axis:'x',shelter:true},{x:-60,z:90.6,axis:'x',shelter:true},
      {x:113,z:90.6,axis:'x'},{x:-42,z:-90.6,axis:'x'},
      {x:42,z:-90.6,axis:'x'},{x:123,z:-90.6,axis:'x',shelter:true}],
    taxi:{x:-105,z:40,axis:'z'}};
  function transitStops(city){
    const stops=[];
    STOPS.bus.forEach((spot,index)=>{
      const stop={id:'bus-stop-'+index,kind:'bus',x:spot.x,z:spot.z,axis:spot.axis,w:16,d:3.4,facing:spot.z>0?-1:1,shelter:spot.shelter===true};
      if((city.roads||[]).some(road=>overlap(stop,road,.6)))return;
      if(city.water&&overlap(stop,city.water,1))return;
      if((city.buildings||[]).some(b=>overlap(stop,b,1.2)))return;
      stops.push(stop);
    });
    const station=(city.places||[]).find(place=>place.kind==='station');
    if(station){
      const rank={id:'taxi-rank',kind:'taxi',x:STOPS.taxi.x,z:STOPS.taxi.z,
        axis:STOPS.taxi.axis,w:3.4,d:16,facing:1};
      const blocked=(city.roads||[]).some(road=>overlap(rank,road,.6))||overlap(rank,station,-1.6)||
        (city.water&&overlap(rank,city.water,1));
      if(!blocked)stops.push(rank);
    }
    return stops;
  }
  function decorate(city){
    const places=sites.map(site=>({...site}));
    // A shared function (§4.4.1) stands inside somebody else's lot, so it is not a
    // building and the plot frontage never sees it — except the bank's podium, which
    // is the one annex that reaches past its host's envelope and therefore takes
    // ground the tower would otherwise have lined with shops. Reserving it here is
    // the same contract the river market uses, and `reservations` is one of the lists
    // CityLayout.apply translates, so a swap moves the reservation with its bank.
    // The footprint is the only position an annex ever writes into its record, and it
    // is the pre-layout one, which is precisely what a translateable reservation wants.
    const reserved=(city.annexes||[]).filter(annex=>annex.reserve&&annex.footprint)
      .map(annex=>({kind:'annex',id:annex.id,...annex.footprint}));
    const next={...city,places,
      buildings:city.buildings.filter(b=>!places.some(site=>overlap(b,site))),
      trees:city.trees.filter(t=>!places.some(site=>overlap({x:t.x,z:t.z,w:t.r*2,d:t.r*2},site,1.2))),
      reservations:[...places.map(site=>({...site})),...reserved]
    };
    next.balloonStands=balloonStands(next);
    next.transitStops=transitStops(next);
    return next;
  }
  function focus(city,type){
    if(type&&type.startsWith('housing-'))return city.buildings.find(b=>b.housing&&b.housing.type===type.slice(8));
    if(type==='playground')return city.playground;
    if(type==='waterfront')return {x:0,z:26,w:84,d:104,height:8};
    return (city.facilities||[]).find(p=>p.facility===type)||(city.places||[]).find(p=>p.kind===type)||
      // The shared functions are not facilities records either, so a camera aimed at
      // the bank or a clinic has to find them through their host: same lot, own door.
      // And an annex keeps no coordinates of its own — see city-facilities.js — so the
      // camera asks the one formula that has an answer for the layout it is looking at.
      annexFocus(city,type);
  }
  function annexFocus(city,type){
    // `globalThis`, not the wrapper's `root`: this file's factory is an argument to the
    // UMD call, so it never closes over that parameter — see how city-facilities.js
    // names `root` in its own factory signature. Reading `root` here throws
    // ReferenceError, which no node test catches because only the page aims a camera.
    const sites=globalThis.CityFacilities&&globalThis.CityFacilities.annexSites;
    return sites?sites(city).find(p=>p.facility===type):(city.annexes||[]).find(p=>p.facility===type);
  }
  return {decorate,overlap,focus,balloonStands,transitStops};
});
