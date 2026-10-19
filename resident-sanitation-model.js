/* Town sanitation: ten crews, six women and four men, ages 25-55, on the two
   street-side collection shifts.

   The collision risk in this town is the fluorescent. Officers on the hi-vis
   shift turn the whole shirt fluorescent, sleeves included, so a sanitation
   worker in the same cloth would be the same person twice. This role therefore
   wears a DARK long-sleeve work jacket with a fluorescent vest LAYERED OVER it:
   the sleeves stay navy, ink green or charcoal and only the chest block is
   hi-vis. That is a difference of cut and layering, not of hue. On top of that
   come the parts no other trade owns: a knee-high rubber boot, a padded glove
   and one of three street tools.

   Built on the shared resident kit so all ten keep one body and one walk
   cycle. */
(function(root,factory){
 const api=factory(root.CityResidentKit||(typeof module==='object'&&module.exports?require('./resident-character-kit.js'):null));
 root.CitySanitationModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kit){
 'use strict';
 const MODEL_REF='sanitation/v1';
 // One slot per roster ordinal, ten in all. The read that carries the trade is
 // structural - dark sleeves under a separate vest panel - so vest cut, workwear
 // cloth, tool, boot, glove, hat and hair are the axes that vary per person.
 const SLOTS=[
  {vest:'full', wear:0, tool:'broom', boot:0, glove:'pad',   hat:'beanie', arm:'right', hair:'crop'},
  {vest:'split',wear:1, tool:'tongs', boot:1, glove:'plain', hat:'none',   arm:'right', hair:'buzz'},
  {vest:'half', wear:2, tool:'bin',   boot:2, glove:'pad',   hat:'beanie', arm:'left',  hair:'ponytail'},
  {vest:'full', wear:3, tool:'broom', boot:1, glove:'plain', hat:'cap',    arm:'right', hair:'crop'},
  {vest:'split',wear:0, tool:'tongs', boot:0, glove:'pad',   hat:'none',   arm:'right', hair:'bob'},
  {vest:'half', wear:1, tool:'bin',   boot:1, glove:'plain', hat:'beanie', arm:'right', hair:'buzz'},
  {vest:'full', wear:2, tool:'broom', boot:2, glove:'pad',   hat:'cap',    arm:'left',  hair:'ponytail'},
  {vest:'split',wear:3, tool:'tongs', boot:2, glove:'plain', hat:'beanie', arm:'right', hair:'bun'},
  {vest:'half', wear:0, tool:'bin',   boot:0, glove:'plain', hat:'none',   arm:'right', hair:'crop'},
  {vest:'half', wear:1, tool:'broom', boot:1, glove:'pad',   hat:'beanie', arm:'left',  hair:'braid'}
 ];
 // Dark work cloth. Every one of these has to stay far away from the officer
 // hi-vis shift, because the sleeves are the whole point of the layering.
 const WORK=['#2f3d52','#2e4439','#3c4148','#414a3a'];
 const HIVIS='#d6e82c',TAPE='#c3cbd0';
 const BOOT=['#2a2f33','#3d3128','#2b3a3e'],GLOVE={pad:'#8a5f2e',plain:'#2f3a44'};
 const KNIT=['#4a5566','#3c4f42','#4b4f56'],WOOD='#8a6a42',BRISTLE='#a8913f';
 const BIN=['#3d5148','#3a4b5a','#4a4a44'];
 // Vest outlines in torso space. The widest point is 0.40 against a shoulder
 // half-width of 0.45 plus the sleeve cylinder, so the vest stops well short of
 // the arm: that gap is what separates layered hi-vis from a hi-vis shirt.
 const VEST_FULL=[[-.355,2.00],[.355,2.00],[.378,2.52],[.358,2.93],[.2,3.02],[-.2,3.02],[-.358,2.93],[-.378,2.52]];
 const VEST_LEFT=[[-.028,2.00],[-.355,2.00],[-.378,2.52],[-.358,2.93],[-.2,3.02],[-.086,3.0],[-.05,2.58]];
 const VEST_RIGHT=[[.028,2.00],[.355,2.00],[.378,2.52],[.358,2.93],[.2,3.02],[.086,3.0],[.05,2.58]];
 // Cap crowns are measured in head space: the skull peaks near 4.11 and the
 // brows sit at 3.70, so a beanie turn stops just above the brow line.
 const BEANIE=[4.01,.275,.412],CAP=[4.00,.27,.395];
 const slotOf=ordinal=>SLOTS[((ordinal-1)%SLOTS.length+SLOTS.length)%SLOTS.length];
 function create(T,{resident={},actor={}}={}){
  const rig=Kit.create(T,{resident,actor}),{p,proportion:size,colors}=rig,body=rig.torso,head=rig.head;
  const female=size.female,ordinal=colors.ordinal,slot=slotOf(ordinal);
  const work=p.material(WORK[slot.wear],.86),workDeep=p.material(new T.Color(WORK[slot.wear]).multiplyScalar(.78),.88);
  const hivis=p.material(HIVIS,.74);
  const bootMat=p.material(BOOT[slot.boot],.5),gloveMat=p.material(GLOVE[slot.glove],.72);
  const knit=p.material(KNIT[ordinal%KNIT.length],.9),wood=p.material(WOOD,.82),bristle=p.material(BRISTLE,.88);
  rig.hair(slot.hair);
  // The work jacket replaces the bare mannequin torso instead of covering it,
  // so the silhouette stays crisp and the budget keeps room for the kit.
  rig.hide('torso');
  const jacket=p.panel('work-jacket',work,[[-.32,1.93],[.32,1.93],[.38,2.56],[.49,2.95],[.27,3.06],[-.27,3.06],[-.49,2.95],[-.38,2.56]],.4,body);jacket.position.z=-.2;
  for(const sign of[-1,1]){
   const side=sign<0?'left':'right';
   // Long sleeves in the dark work cloth. They are the mannequin's own
   // cylinders, so this is a material swap and costs no triangles - and it is
   // the one thing an officer on the hi-vis shift can never have.
   rig.wear(['shoulder-'+side,'sleeve-upper-'+side,'sleeve-lower-'+side,'elbow-'+side],work);
   const wrap=p.panel('hi-vis-vest-side-'+side,hivis,[[sign*.322,2.06],[sign*.398,2.14],[sign*.398,2.88],[sign*.322,2.97]],.37,body);wrap.position.z=-.168;
  }
  if(slot.vest==='split'){
   p.panel('hi-vis-vest-left',hivis,VEST_LEFT,.035,body).position.z=.2;
   p.panel('hi-vis-vest-right',hivis,VEST_RIGHT,.035,body).position.z=.2;

  }else{
   p.panel('hi-vis-vest',hivis,VEST_FULL,.035,body).position.z=.2;
  }

  // The existing hands wear glove cloth without cuffs or padded micro-geometry.
  rig.wear(['hand-left','hand-right'],gloveMat);
  // Knee-high rubber boot. The shaft is a tapered cone around the shin that
  // stops just above the knee, which is the silhouette that says sanitation.
  // The leg under it has to be cloth: the boot shaft covers the shin, so leaving
  // the thigh in skin gave a dark-jacketed figure with bare legs.
  rig.wear(['thigh-left','thigh-right','knee-left','knee-right','shin-left','shin-right','pelvis'],work);
  const shaft=p.geometry(new T.CylinderGeometry(.184,.152,.92,8,1));
  const turnover=p.geometry(new T.CylinderGeometry(.208,.202,.115,8,1));
  for(const leg of rig.legs){
   const side=leg.side;
   p.mesh('boot-shaft-'+side,shaft,bootMat,[0,-.4,.006],[1,1,1],leg.lower);
   p.mesh('boot-turnover-'+side,turnover,bootMat,[0,.012,.006],[1,1,1],leg.lower);
   // The foot is a boxy rubber boot toe, so the rounded trainer sole is gone.
   rig.wear(['sole-'+side],bootMat);
   rig.hide('shoe-'+side);
   p.block('boot-foot-'+side,bootMat,[0,.052,.062],[.19,.152,.315],leg.foot);
  }
  if(slot.hat==='beanie'){
   const [cy,ch,cz]=BEANIE;
   p.ball('beanie-crown',knit,[0,cy,-.005],[.458,ch,cz],head);
   p.block('beanie-turn',knit,[0,3.82,.006],[.92,.086,.79],head);
  }else if(slot.hat==='cap'){
   const cy=CAP[0];
   p.ball('cap-crown-cap',knit,[0,cy,-.004],[.468,CAP[1],CAP[2]],head);
   p.block('cap-band-cap',workDeep,[0,cy-.09,.01],[.9,.075,.772],head);
   p.ball('cap-visor-cap',workDeep,[0,3.805,.245],[.47,.05,.27],head).rotation.x=.06;
  }
  // One arm leaves the shared walk cycle to hold the tool, so the prop stays in
  // the hand instead of swinging free. The other arm keeps swinging.
  const arm=rig.poseArm(slot.arm,TOOL_POSE[slot.tool]);
  const held=new T.Group();held.name=slot.tool+'-hold';held.position.set(arm.sign*.028,-.5,.048);held.rotation.x=TOOL_TILT[slot.tool];arm.elbow.add(held);
  if(slot.tool==='broom'){
   p.limb('broom-pole',wood,[0,.2,0],[0,-1.5,0],.028,held);
   p.block('broom-head',workDeep,[0,-1.53,.015],[.4,.13,.13],held);
   p.block('broom-bristle',bristle,[0,-1.635,.015],[.42,.09,.155],held);
  }else if(slot.tool==='tongs'){
   p.limb('tongs-handle',workDeep,[0,.02,0],[0,-.28,.02],.033,held);
   for(const sign of[-1,1]){
    const side=sign<0?'left':'right';
    p.limb('tongs-arm-'+side,workDeep,[sign*.026,-.26,.02],[sign*.072,-.78,.1],.024,held);
    p.block('tongs-jaw-'+side,bootMat,[sign*.072,-.83,.112],[.068,.092,.128],held);
   }
  }else{
   const bin=p.material(BIN[ordinal%BIN.length],.78),lid=p.material(new T.Color(BIN[ordinal%BIN.length]).multiplyScalar(.74),.76);
   p.limb('bin-bar-left',workDeep,[-.2,-.06,0],[-.2,-.68,0],.026,held);
   p.limb('bin-bar-right',workDeep,[.2,-.06,0],[.2,-.68,0],.026,held);
   p.limb('bin-bar-cross',workDeep,[-.2,-.06,0],[.2,-.06,0],.026,held);
   p.block('bin-lid',lid,[0,-.7,.045],[.56,.07,.52],held);
   p.block('bin-body',bin,[0,-1.19,.05],[.5,.9,.46],held);
   const wheelGeo=p.geometry(new T.CylinderGeometry(.115,.115,.055,8,1));
   for(const sign of[-1,1]){
    const side=sign<0?'left':'right';
    p.mesh('bin-wheel-'+side,wheelGeo,rig.dark,[sign*.26,-1.72,.06],[1,1,1],held).rotation.z=Math.PI/2;
   }
  }
  rig.update(0);
  return {object:rig.object,modelRef:MODEL_REF,variant:{gender:female?'F':'M',age:size.age,ordinal},update:seconds=>rig.update(seconds),dispose:()=>rig.dispose()};
 }
 // Arm poses are chosen so the tool hangs plumb or leans the way a worker
 // actually carries it, not so the hand lands on a tidy coordinate.
 const TOOL_POSE={broom:{shoulderX:-.24,elbowX:.24},tongs:{shoulderX:-.52,elbowX:.95},bin:{shoulderX:-.3,elbowX:.3}};
 const TOOL_TILT={broom:0,tongs:-.18,bin:0};
 return {create,MODEL_REF};
});
