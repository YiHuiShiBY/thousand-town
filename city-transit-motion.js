/* Deterministic depot duty cycles shared by WebGL and Canvas. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CityTransitMotion=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const slots=[[-17,-7,true],[-5,-7,true],[7,-7,true],[-18,18,false],[-8,18,false],[2,18,false],[12,18,false]];
  const mod=(v,n)=>((v%n)+n)%n;
  function route(points){
    const rounded=[points[0]];
    for(let i=1;i<points.length-1;i++){
      const a=points[i-1],b=points[i],c=points[i+1];
      const ab=Math.hypot(b[0]-a[0],b[1]-a[1]),bc=Math.hypot(c[0]-b[0],c[1]-b[1]);
      const radius=Math.min(2.2,ab*.3,bc*.3);
      const p=[b[0]+(a[0]-b[0])*radius/ab,b[1]+(a[1]-b[1])*radius/ab];
      const q=[b[0]+(c[0]-b[0])*radius/bc,b[1]+(c[1]-b[1])*radius/bc];
      rounded.push(p);
      for(let j=1;j<=10;j++){const t=j/10,u=1-t;rounded.push([u*u*p[0]+2*u*t*b[0]+t*t*q[0],u*u*p[1]+2*u*t*b[1]+t*t*q[1]]);}
    }
    rounded.push(points[points.length-1]);
    let length=0;
    const segments=[];
    for(let i=1;i<rounded.length;i++){
      const a=rounded[i-1],b=rounded[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(d>1e-8){segments.push({a,b,start:length,d});length+=d;}
    }
    return {segments,length};
  }
  function create(city){
    const site=(city.places||[]).find(p=>p.kind==='station');
    if(!site)return {vehicles:[],site:null};
    const side=site.gateSide||(site.x<0?1:-1),worldZ=side*site.z;
    return {site,side,vehicles:slots.map(([x,z,bus],index)=>{
      // West-bank coordinates rotate 180 degrees with an east-bank station.
      // Reverse out of bus bays, use the south exit and north return entrance.
      const path=route([[x,z],[x,4],[21,4],[21,13],[33.6,13],
        [33.6,150-worldZ],[38.4,150-worldZ],[38.4,-77.6-worldZ],
        [225.6,-77.6-worldZ],[225.6,77.6-worldZ],[38.4,77.6-worldZ],
        [38.4,-150-worldZ],[33.6,-150-worldZ],[33.6,-13],[21,-13],[21,4],[x,4],[x,z]]);
      return {id:(bus?'station-bus-':'station-taxi-')+(bus?index:index-3),x,z,bus,index,path,departure:5+index*26};
    })};
  }
  function sample(plan,time,daySeconds){
    if(!plan.site)return [];
    time=Math.max(0,Number(time)||0);
    const daily=Number.isFinite(daySeconds);
    if(daily)time=Math.max(0,daySeconds);
    const lighting=typeof module==='object'&&module.exports?require('./city-life-ext/lighting.js'):globalThis.CityLighting;
    const {site,side}=plan;
    return plan.vehicles.map(v=>{
      const driving=v.path.length/10,period=360;
      let phase=mod(time-v.departure,period);
      if(daily&&v.bus){
        // Anchor each day's first service at 06:00, retaining bay offsets and
        // the legacy interval. Previous-day departures allow a last trip to finish.
        const day=Math.floor(time/900);let departure=-Infinity;
        for(let d=day-1;d<=day;d++)for(let start=d*900+360*.625+v.departure;start<d*900+1350*.625;start+=period){
          if(start<=time)departure=Math.max(departure,start);
        }
        phase=time-departure;
      }
      const admitted=!daily||lighting.dispatch(v.bus?'bus':'taxi',v.bus?v.index:v.index-3,(time-phase)/.625);
      const started=daily||time>=v.departure;
      const operating=!daily||lighting.dispatch(v.bus?'bus':'taxi',v.bus?v.index:v.index-3,time/.625);
      let x=v.x,z=v.z,heading=-Math.PI/2,status=operating?'候车':'停运',moving=false;
      if(admitted&&started&&phase<driving){
        moving=true;
        const distance=phase*10,seg=v.path.segments.find(s=>distance<s.start+s.d)||v.path.segments.at(-1);
        const t=Math.min(1,(distance-seg.start)/seg.d);
        x=seg.a[0]+(seg.b[0]-seg.a[0])*t;z=seg.a[1]+(seg.b[1]-seg.a[1])*t;
        heading=Math.atan2(seg.b[1]-seg.a[1],seg.b[0]-seg.a[0]);
        if(v.bus&&distance<11)heading-=Math.PI;
        if(!v.bus&&distance>v.path.length-14)heading-=Math.PI;
        status=x<29?(distance<v.path.length/2?'出站':'回站'):'运营';
      }else if(operating&&admitted&&started&&phase<driving+24)status='整备维护';
      const wx=site.x+side*x,wz=site.z+side*z;
      let rise=0;
      for(const bz of [-80,80]){
        const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
        rise=Math.max(rise,smooth((33-Math.abs(wx))/10)*smooth((11.5-Math.abs(wz-bz))/4));
      }
      return {id:v.id,bus:v.bus,kind:v.bus?'bus':'taxi',x:wx,z:wz,y:1.7*rise,localX:x,localZ:z,
        heading:heading+(side<0?Math.PI:0),localHeading:heading,status,moving,color:v.bus?'#477d70':'#ecc654'};
    });
  }
  return {create,sample};
});
