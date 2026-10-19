/* Shared proportions, body rig and low-poly primitives for every resident role model.
   Loaded only by the resident inspection page; the town never imports it.

   Scene units follow the project scale: 1 unit = 0.5 m, so an adult figure reads
   about 4.1 units and a child about 2.3. Age drives BOTH stature and head size,
   because stature alone leaves a five-year-old as a small adult. */
(function(root,factory){
 const api=factory();
 root.CityResidentKit=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';

 const clamp=(value,low,high)=>Math.min(high,Math.max(low,value));
 // Adult rig height in scene units, measured from the school-admin reference rig.
 const ADULT_UNITS=4.115;
 // Stature as a fraction of the adult baseline. Children are genuinely short:
 // a five-year-old lands near 0.55 of adult height, which is what makes the
 // child roles read as children instead of shrunken staff.
 const HEIGHT=[[1,.40],[2,.44],[3,.47],[4,.51],[5,.55],[6,.58],[7,.61],[8,.64],[9,.67],[10,.70],[11,.73],[12,.76],[13,.80],[14,.85],[15,.89],[16,.92],[17,.95],[18,1],[30,1],[45,1],[55,1],[60,.99],[65,.98],[70,.97],[75,.96],[80,.95],[85,.94],[90,.93]];
 // Head growth is much faster than height in childhood, so the head-to-body
 // ratio falls from about five heads tall to the adult seven.
 const HEAD=[[1,1.46],[3,1.36],[5,1.26],[7,1.20],[9,1.15],[12,1.10],[15,1.05],[18,1],[60,1],[90,.98]];
 const interpolate=(table,value)=>{
  const v=Number.isFinite(value)?clamp(value,table[0][0],table[table.length-1][0]):table[table.length-1][0];
  for(let i=0;i<table.length-1;i++){
   const a=table[i],b=table[i+1];
   if(v<=b[0]){const t=(v-a[0])/((b[0]-a[0])||1);return a[1]+(b[1]-a[1])*t;}
  }
  return table[table.length-1][1];
 };
 // The resident id is the only stable per-person key; appearance variants hang
 // off it so changing the id scheme would still reshuffle the whole town.
 function ordinalOf(id){const n=Number(String(id==null?'':id).split('-').pop());return Number.isFinite(n)&&n>0?n:1;}
 // Female figures read slightly narrower than male ones. This is an art choice
 // inherited from the reference rig, not a measured ratio.
 const FEMALE_STATURE=.97;
 function proportion(resident={}){
  const age=Number.isFinite(resident.age)?resident.age:35,female=resident.gender==='F',stature=female?FEMALE_STATURE:1;
  const heightScale=interpolate(HEIGHT,age)*stature;
  return {age,female,stature,heightScale,headScale:interpolate(HEAD,age),units:heightScale*ADULT_UNITS,adultUnits:ADULT_UNITS};
 }
 const SKIN=['#e8c3a4','#dcae8c','#c99977','#bd8a63','#ab7750'];
 function palette(T,resident={}){
  const ordinal=ordinalOf(resident.id),age=Number.isFinite(resident.age)?resident.age:35;
  const hairColor=new T.Color('#38312e').lerp(new T.Color('#8d8a80'),clamp((age-38)/62,0,1));
  return {ordinal,skin:SKIN[ordinal%SKIN.length],hair:'#'+hairColor.getHexString(),age};
 }
 // Primitives share their geometry objects, so a figure owns about twenty
 // buffers no matter how many parts reference them.
 function primitives(T,tracker){
  const geometries=new Set(),materials=new Set();
  tracker.geometries=geometries;tracker.materials=materials;
  const sphere=geometry(new T.SphereGeometry(1,10,6)),bead=geometry(new T.SphereGeometry(1,6,4)),cylinder=geometry(new T.CylinderGeometry(1,1,1,8)),shaft=geometry(new T.CylinderGeometry(1,1,1,6)),box=geometry(new T.BoxGeometry(1,1,1));
  function geometry(g){geometries.add(g);return g;}
  function material(color,roughness=.85,flatShading=true){const m=new T.MeshStandardMaterial({color,roughness,flatShading});materials.add(m);return m;}
  function mesh(name,g,m,pos=[0,0,0],scale=[1,1,1],parent){const part=new T.Mesh(g,m);part.name=name;part.position.set(pos[0],pos[1],pos[2]);part.scale.set(scale[0],scale[1],scale[2]);parent.add(part);return part;}
  function ball(name,m,pos,scale,parent,coarse){return mesh(name,coarse?bead:sphere,m,pos,scale,parent);}
  function block(name,m,pos,scale,parent){return mesh(name,box,m,pos,scale,parent);}
  function limb(name,m,a,b,r,parent,slim){const va=new T.Vector3(a[0],a[1],a[2]),vb=new T.Vector3(b[0],b[1],b[2]),delta=vb.clone().sub(va);const part=mesh(name,slim?shaft:cylinder,m,[(va.x+vb.x)/2,(va.y+vb.y)/2,(va.z+vb.z)/2],[r,delta.length(),r],parent);part.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return part;}
  function curve(name,m,points,r=.015,parent,closed=false,segments){const spline=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(p[0],p[1],p[2])),closed);return mesh(name,geometry(new T.TubeGeometry(spline,Math.min(8,segments||Math.max(4,points.length)),r,3,closed)),m,[0,0,0],[1,1,1],parent);}
  function panel(name,m,points,depth=.07,parent){const shape=new T.Shape();shape.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)shape.lineTo(points[i][0],points[i][1]);shape.closePath();return mesh(name,geometry(new T.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:false,curveSegments:1})),m,[0,0,0],[1,1,1],parent);}
  // A closed hair shell that follows the skull and stops above the forehead.
  function shell(name,m,{columns=12,rows=4,centre=[0,3.59,0],radius=[.425,.525,.381],back=1.94,front=.84,parent,offset=[0,0,0]}){
   columns=Math.min(columns,12);rows=Math.min(rows,6);
   const vertices=[],indices=[];
   for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const phi=col/columns*Math.PI*2,facing=(Math.cos(phi)+1)/2;
    const limit=back-front*facing,theta=Math.max(.001,row/rows*limit);
    vertices.push(Math.sin(theta)*Math.sin(phi)*radius[0]+offset[0],centre[1]+Math.cos(theta)*radius[1]+offset[1],Math.sin(theta)*Math.cos(phi)*radius[2]+offset[2]);
   }
   for(let r=0;r<rows;r++)for(let c=0;c<columns;c++){const a=r*(columns+1)+c,b=a+columns+1;indices.push(a,b,a+1,b,b+1,a+1);}
   const g=geometry(new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
   return mesh(name,g,m,[0,0,0],[1,1,1],parent);
  }
  return {geometry,material,mesh,ball,block,limb,curve,panel,shell,sphere,bead,cylinder,shaft,box};
 }
 // The default mannequin. Role models cover the torso and legs, then add the
 // silhouette that makes their trade readable at a distance.
 function body(T,{resident={},actor={},materials:overrides,stride=1}={}){
  const size=proportion(resident),colors=palette(T,resident),tracker={};
  const p=primitives(T,tracker);
  const object=new T.Group();object.name='resident-body';object.rotation.y=Math.PI/2;object.scale.setScalar(size.heightScale);
  const skin=p.material(overrides?.skin||colors.skin),hairMaterial=p.material(overrides?.hair||colors.hair);
  const dark=p.material('#323f40',.5);
  const group=(name,parent,x=0,y=0,z=0)=>{const g=new T.Group();g.name=name;g.position.set(x,y,z);(parent||object).add(g);return g;};
  const upper=group('body-upper');
  const neck=p.ball('neck',skin,[0,3.14,0],[.13,.23,.12],upper,true);
  // The head has to grow faster than the body in childhood, or a five-year-old is
  // just a shrunken adult. Scaling it here also moves the blank head and hair
  // shell with it, and the pivot stays at the neck so the head does not float.
  const headGrowth=size.headScale*size.stature;
  const head=group('head-rig',upper,0,3.59*(1-.93*headGrowth),0);head.scale.set(.9*headGrowth,.93*headGrowth,.9*headGrowth);
  // Only the blank head uses smooth normals; skin on the body stays faceted.
  const headSkin=p.material(overrides?.skin||colors.skin,.85,false);
  const face=p.ball('face',headSkin,[0,3.58,0],[size.female?.365:.393,.49,.346],head);
  // Children retain their larger head and shorter neck, with a blank face.
  if(size.headScale>1.06)neck.scale.set(.115,.17,.105);
  const torso=group('torso-rig',upper);
  const chest=p.panel('torso',skin,[[-.3,1.92],[.3,1.92],[.34,2.6],[.45,2.98],[.24,3.07],[-.24,3.07],[-.45,2.98],[-.34,2.6]],.38,torso);chest.position.z=-.19;
  const pelvis=p.block('pelvis',skin,[0,1.88,0],[.6,.3,.34],torso);
  const arms=[],legs=[];
  for(const [sign,side] of[[-1,'left'],[1,'right']]){
   const shoulder=group('arm-'+side+'-rig',torso,sign*.45,2.91,0);
   p.ball('shoulder-'+side,skin,[0,0,0],[.148,.148,.148],shoulder,true);
   p.limb('sleeve-upper-'+side,skin,[0,0,0],[sign*.1,-.61,.035],.142,shoulder);
   p.ball('elbow-'+side,skin,[sign*.1,-.61,.035],[.128,.128,.128],shoulder,true);
   const elbow=group('elbow-rig-'+side,shoulder,sign*.1,-.61,.035);
   p.limb('sleeve-lower-'+side,skin,[0,0,0],[sign*.022,-.435,.034],.104,elbow);
   const hand=p.ball('hand-'+side,skin,[sign*.028,-.5,.045],[.093,.128,.066],elbow,true);
   arms.push({shoulder,elbow,hand,sign,side});
   const hip=group('leg-'+side+'-rig',object,sign*.19,1.85,0);
   p.limb('thigh-'+side,skin,[0,0,0],[0,-.83,0],.152,hip);
   p.ball('knee-'+side,skin,[0,-.83,0],[.14,.148,.139],hip,true);
   const knee=group('knee-rig-'+side,hip,0,-.83,0);
   p.limb('shin-'+side,skin,[0,0,0],[0,-.78,0],.126,knee);
   const foot=group('foot-rig-'+side,knee,0,-.96,.054);
   p.ball('shoe-'+side,skin,[0,.055,.056],[.152,.118,.245],foot);
   p.block('sole-'+side,dark,[0,-.025,.045],[.283,.062,.418],foot);
   legs.push({upper:hip,lower:knee,foot,sign,side});
  }
  // One walk cycle shared by every trade, so silhouettes stay comparable.
  function update(seconds=0){
   const t=Number.isFinite(seconds)?seconds:0,moving=!actor.standing&&actor.kind!=='vendor';
   const speed=actor.kind==='jogger'?5.8:3.8,swing=moving?Math.sin(t*speed)*(actor.kind==='jogger'?.42:.28)*clamp(stride,.1,1):0;
   for(const leg of legs){const angle=swing*leg.sign,knee=moving?Math.max(0,-angle)*.72:0;leg.upper.rotation.x=angle;leg.lower.rotation.x=knee;leg.foot.rotation.x=-angle-knee;}
   for(const arm of arms){
    if(arm.pose){arm.shoulder.rotation.set(arm.pose.shoulderX||0,0,arm.pose.shoulderZ||0);arm.elbow.rotation.set(arm.pose.elbowX||0,0,arm.pose.elbowZ||0);}
    else arm.shoulder.rotation.x=-swing*arm.sign*.72;
   }
   upper.position.y=moving?.018*(1-Math.cos(t*speed*2)):0;
   head.rotation.y=moving?.018*Math.sin(t*speed*.5):0;
   object.updateMatrixWorld(true);
  }
  // Named handles let a role recolour or remove the mannequin instead of
  // rebuilding it. Recolouring costs no triangles; a duplicate garment layer
  // would cost hundreds, so plain shirts and trousers are material swaps.
  const parts={};
  for(const name of['torso','pelvis','neck','face','sleeve-upper-left','sleeve-upper-right','sleeve-lower-left','sleeve-lower-right','shoulder-left','shoulder-right','elbow-left','elbow-right','thigh-left','thigh-right','knee-left','knee-right','shin-left','shin-right','hand-left','hand-right','shoe-left','shoe-right','sole-left','sole-right'])
   parts[name]=object.getObjectByName(name);
  // Hair shells keep the forehead clear. Styles are named by shape, so a
  // role picks a silhouette rather than a colour.
  const HAIR={bald:null,buzz:{back:1.86,front:.76,rows:4,columns:12},crop:{back:1.95,front:.84},bob:{back:2.26,front:.8,radius:[.412,.535,.392],rows:5},long:{back:2.44,front:.74,radius:[.4,.55,.378],rows:6},curly:{back:2.02,front:.86,columns:10,rows:4,offset:[0,.02,0]}};
  function hair(style='crop',material=hairMaterial){
   const base=['bun','ponytail','braid'].includes(style)?'crop':style,spec=HAIR[base]===undefined?HAIR.crop:HAIR[base];
   const shellPart=spec?p.shell('hair',material,{...spec,parent:head,radius:spec.radius||[size.female?.396:.425,.525,.381]}):null;
   if(style==='bun')p.ball('hair-bun',material,[0,3.75,-.379],[.225,.209,.16],head);
   if(style==='ponytail')p.ball('hair-tail',material,[0,3.4,-.4],[.13,.3,.13],head);
   if(style==='braid')for(let i=0;i<4;i++)p.ball('braid-'+i,material,[0,3.5-i*.25,-.42],[.09,.16,.09],head,true);
   return shellPart;
  }
  function poseArm(side,pose={}){
   const arm=arms.find(a=>a.side===side);
   if(!arm)return null;
   arm.pose={shoulderZ:0,shoulderX:0,elbowX:0,elbowZ:0,...pose};
   update(0);
   return arm;
  }
  function wear(names,material){for(const name of[].concat(names))if(parts[name])parts[name].material=material;}
  function hide(...names){for(const name of names.flat()){const part=parts[name]||object.getObjectByName(name);if(part&&part.parent)part.parent.remove(part);}}
  let disposed=false;
  // The primitives own their own sets, so disposal must read those exact ones
  // rather than a same-named empty pair declared alongside them.
  function dispose(){
   if(disposed)return;disposed=true;
   object.removeFromParent();
   tracker.geometries.forEach(g=>g.dispose());tracker.materials.forEach(m=>m.dispose());
   object.clear();
  }
  return {object,upper,torso,head,face,neck,arms,legs,parts,skin,hairMaterial,dark,p,proportion:size,colors,update,dispose,poseArm,wear,hide,hair,HAIR,
   // Role models drop the mannequin parts they replace so the triangle budget
   // reflects what is actually drawn.
   drop(...names){hide(...names);}};
 }
 return {create:body,proportion,palette,primitives,ordinalOf,ADULT_UNITS,HEIGHT,HEAD,SKIN};
});