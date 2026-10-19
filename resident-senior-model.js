/* Town seniors, 72 to 90. The retirees next door can still carry a shopping bag,
   so the read here has to be stronger than "old": a walking aid that actually
   reaches the floor, a stoop that gets worse with age, an old heavy coat and a
   thick-soled shoe. The aid is posed, not animated, because a hand on a cane
   cannot swing with the walk cycle without letting go of it.
   Built on the shared resident kit so the group keeps the town proportions. */
(function(root,factory){
 const api=factory(root.CityResidentKit||(typeof module==='object'&&module.exports?require('./resident-character-kit.js'):null));
 root.CitySeniorModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kit){
 'use strict';
 const MODEL_REF='senior/v1';
 // A stoop turns on the waist, not the ankles. The kit's upper group pivots at
 // its own origin, which sits on the ground, so the lean is measured here and
 // the group is shifted back by the amount the waist would have travelled. That
 // keeps the pelvis on the hips instead of swinging the torso off the legs.
 const WAIST=1.88,LEAN_MIN=.13,LEAN_SPAN=.17;
 const leanOf=age=>{const t=Math.min(1,Math.max(0,((Number.isFinite(age)?age:78)-72)/18));return LEAN_MIN+LEAN_SPAN*t;};
 // One slot per roster ordinal. Aid kind, coat cut, knit cap and the extra at
 // the waist are four independent switches, so sixty residents read as eight
 // silhouettes rather than one hunched template. The aid leans on the cap: a
 // walker is for the weakest of the four, and the cap is for the ones who go out
 // in the cold, so the two rarely land on the same person.
 const SLOTS=[
  {aid:'cane', coat:'jacket', cap:0, hem:'belt',  hairM:'crop',   hairF:'bob'},
  {aid:'quad', coat:'sweater',cap:1, hem:'scarf', hairM:'buzz',   hairF:'crop'},
  {aid:'frame',coat:'hooded', cap:0, hem:'belt',  hairM:'crop',   hairF:'bun'},
  {aid:'cane', coat:'sweater',cap:1, hem:0,      hairM:'buzz',   hairF:'ponytail'},
  {aid:'quad', coat:'jacket', cap:0, hem:'scarf', hairM:'crop',   hairF:'bob'},
  {aid:'cane', coat:'hooded', cap:0, hem:0,      hairM:'bald',   hairF:'bun'},
  {aid:'frame',coat:'jacket', cap:1, hem:0,      hairM:'crop',   hairF:'bob'},
  {aid:'quad', coat:'hooded', cap:0, hem:'belt',  hairM:'bald',   hairF:'bun'}
 ];
 const slotOf=ordinal=>SLOTS[((ordinal-1)%SLOTS.length+SLOTS.length)%SLOTS.length];
 // Dark grey, navy, brown and wine only. A bright coat would make a senior look
 // younger, which is exactly the mistake the retiree group invites.
 const COAT=['#3c4045','#2f3a52','#5a4433','#5e2f36','#414a41','#4c433a'];
 const SCARF=['#8a6a4a','#6d7b6a','#7a4b4b','#5a5f6e'];
 const PANTS=['#3a3d42','#43464a','#4a453d'];
 const SHOE=['#2a2b2e','#35322d'];
 // Jacket is boxy and long, sweater is bulkier at the chest, hooded coat drops
 // below the hip. The cut is what separates the three at street distance.
 const CUT={
  jacket:{points:[[-.33,1.9],[.33,1.9],[.37,2.6],[.47,2.96],[.25,3.06],[-.25,3.06],[-.47,2.96],[-.37,2.6]],depth:.42},
  sweater:{points:[[-.35,1.93],[.35,1.93],[.4,2.5],[.46,2.93],[.26,3.05],[-.26,3.05],[-.46,2.93],[-.4,2.5]],depth:.44},
  hooded:{points:[[-.36,1.78],[.36,1.78],[.41,2.55],[.49,2.95],[.27,3.06],[-.27,3.06],[-.49,2.95],[-.41,2.55]],depth:.47}
 };
 // The hand grips the aid just under the crook, arm forward and a little out.
 // The walker is held with both arms, elbows in, so the two rails land about
 // shoulder width apart. A positive shoulderX swings an arm backwards and a
 // positive shoulderZ swings it outboard, so a forward inboard reach is negative.
 const AID_POSE={
  cane:{shoulderX:-.1,shoulderZ:-.14,elbowX:-.46},
  quad:{shoulderX:-.06,shoulderZ:-.07,elbowX:-.6},
  frame:{shoulderX:-.17,shoulderZ:-.14,elbowX:-.5}
 };
 const WOOD='#6b4f36',IRON='#8f9299';
 function create(T,{resident={},actor={}}={}){
  const rig=Kit.create(T,{resident,actor}),{p,proportion:size,colors}=rig,body=rig.torso,head=rig.head;
  const female=size.female,ordinal=colors.ordinal,slot=slotOf(ordinal),age=size.age;
  const lean=leanOf(age);
  // The oldest cohort reads thinner. One number on the upper group narrows the
  // shoulders, the coat panel and the head together, and the kit never writes
  // this scale, so the walk cycle cannot undo it.
  rig.upper.scale.set(age>=85?.92:age>=80?.95:1,1,1);
  const coat=p.material(COAT[(ordinal-1)%COAT.length]);
  const trim=p.material(new T.Color(coat.color).multiplyScalar(.78));
  const rib=p.material(new T.Color(coat.color).multiplyScalar(1.14),.92);
  const trouser=p.material(PANTS[(ordinal*2)%PANTS.length]);
  const shoeMat=p.material(SHOE[(ordinal-1)%SHOE.length],.62);
  const soleMat=p.material(new T.Color(shoeMat.color).multiplyScalar(.72),.74);
  const wood=p.material(WOOD,.7),iron=p.material(IRON,.4);
  const scarfMat=p.material(SCARF[(ordinal*3)%SCARF.length],.95);
  const capMat=p.material(SCARF[(ordinal*5)%SCARF.length],.95);
  const lift=WAIST*(1-Math.cos(lean)),shift=-WAIST*Math.sin(lean);
  // rig.update rewrites upper.position.y every frame, so the waist correction is
  // re-applied after the kit's own write instead of being baked into the rig.
  // The kit writes upper.position.y and head.rotation.y every frame and never
  // touches upper.rotation, so the stoop belongs here and survives the walk.
  function hinge(){rig.upper.rotation.x=lean;rig.upper.position.y=lift;rig.upper.position.z=shift;rig.object.updateMatrixWorld(true);}
  rig.hair(slot.cap?(female?'bob':'buzz'):(female?slot.hairF:slot.hairM));
  // The coat replaces the bare mannequin torso rather than covering it, so the
  // silhouette stays crisp and the budget keeps room for the walking aid.
  rig.hide('torso');
  const cut=CUT[slot.coat]||CUT.jacket,front=cut.depth/2;
  const body3d=p.panel('coat-body',coat,cut.points,cut.depth,body);body3d.position.z=-front;
  for(const sign of[-1,1]){
   const side=sign<0?'left':'right';
   p.panel('coat-collar-'+side,trim,[[sign*.02,3.115],[sign*.245,3.03],[sign*.135,2.83]],.032,body).position.z=front+.014;
  }
  p.block('coat-hem',rib,[0,cut.points[0][1]+.02,0],[.76,.075,cut.depth+.02],body);
  if(slot.hem==='belt'){
   p.block('coat-belt',trim,[0,2.02,0],[.72,.08,cut.depth+.02],body);
  }
  if(slot.hem==='scarf'){
   p.curve('scarf-loop',scarfMat,[[-.21,3.05,.13],[-.24,3.14,-.05],[0,3.17,-.17],[.24,3.14,-.05],[.21,3.05,.13]],.062,body);
   p.panel('scarf-tail',scarfMat,[[.01,3.06],[.17,2.99],[.145,2.55],[.005,2.62]],.042,body).position.z=front+.03;
  }
  // The hood is a roll around the back of the neck with a knot, so it reads as
  // a hood worn down rather than another hat.
  if(slot.coat==='hooded'){
   p.curve('coat-hood-roll',trim,[[-.44,2.99,.04],[-.35,3.13,-.15],[0,3.18,-.29],[.35,3.13,-.15],[.44,2.99,.04]],.082,body);
  }
  // Knit cap: a skull shell that stops above the brows plus a rolled brim ring.
  // Both are real geometry, and the crown is kept at skull height so a capped
  // senior is not taller than a bare one.
  if(slot.cap){
   p.shell('knit-cap-crown',capMat,{columns:14,rows:4,centre:[0,3.59,0],radius:[.462,.535,.42],back:1.95,front:.9,parent:head});
   const ring=[];
   for(let i=0;i<10;i++){const a=i/10*Math.PI*2;ring.push([Math.sin(a)*.474,3.85,Math.cos(a)*.442]);}
   p.curve('knit-cap-brim',rib,ring,.05,head,true);
  }
  rig.wear(['pelvis','thigh-left','thigh-right','knee-left','knee-right','shin-left','shin-right'],trouser);
  // A thick sole is the cheapest way to say this person is unsteady, and it is
  // the one thing a walking frame does not share with the retiree group.
  rig.wear(['shoe-left','shoe-right'],shoeMat);
  rig.wear(['sole-left','sole-right'],soleMat);
  for(const leg of rig.legs){
   const shoe=leg.foot.getObjectByName('shoe-'+leg.side),sole=leg.foot.getObjectByName('sole-'+leg.side);
   shoe.scale.set(.176,.132,.27);shoe.position.y=.062;
   sole.scale.set(.33,.078,.47);sole.position.y=-.02;
  }
  // Every coat here has sleeves, and the sleeves are their own meshes, so a
  // torso recolour alone would leave a pair of bare arms.
  rig.wear(['shoulder-left','shoulder-right','sleeve-upper-left','sleeve-upper-right','elbow-left','elbow-right','sleeve-lower-left','sleeve-lower-right'],coat);
  rig.update(0);hinge();
  // The aid is placed after the pose and the lean are settled, in the root's own
  // space, so its tip can be cut to the floor no matter how the body is folded.
  const localOf=part=>rig.object.worldToLocal(part.getWorldPosition(new T.Vector3()));
  const hold=new T.Group();hold.name=slot.aid+'-hold';rig.object.add(hold);
  const pose=AID_POSE[slot.aid];
  const arm=rig.poseArm('right',pose);rig.update(0);hinge();
  if(slot.aid==='frame'){
   // A walker needs both hands, mirrored about the spine so the rails stay level.
   rig.poseArm('left',{shoulderX:pose.shoulderX,shoulderZ:-pose.shoulderZ,elbowX:pose.elbowX,elbowZ:-pose.elbowZ});
   rig.update(0);hinge();
  }
  const right=localOf(arm.hand);
  if(slot.aid==='frame'){
   // The rails go where the hands already are, so the grip cannot drift off the
   // handle however the arm is retuned later.
   const left=localOf(rig.arms.find(a=>a.side==='left').hand);
   for(const [tag,g] of[['left',left],['right',right]]){
    p.limb('assist-frame-rail-'+tag,iron,[g.x,0,g.z],[g.x,g.y+.07,g.z],.022,hold);
    for(const dz of[-.14,.14])p.block('assist-frame-foot-'+tag+(dz<0?'-back':'-front'),rig.dark,[g.x,.035,g.z+dz],[.052,.07,.052],hold);
   }
   p.limb('assist-frame-brace-low',iron,[left.x,.52,left.z],[right.x,.52,right.z],.019,hold);
   p.limb('assist-frame-brace-high',iron,[left.x,right.y-.16,left.z],[right.x,right.y-.16,right.z],.019,hold);
  }else{
   hold.position.copy(right);
   const drop=-right.y,tip=slot.aid==='cane'?.05:0;
   // The shaft stops at the crook, which sits just above the gripping hand, so
   // the aid reads as something held rather than a pole through the palm.
   p.limb('assist-'+slot.aid+'-shaft',wood,[0,.12,0],[0,drop+.06,tip],.024,hold);
   p.curve('assist-'+slot.aid+'-crook',wood,[[0,.12,0],[0,.22,-.07],[0,.28,-.15]],.022,hold);
   if(slot.aid==='cane'){
    p.ball('assist-cane-ferrule',iron,[0,drop+.04,tip],[.042,.04,.042],hold,true);
   }else{
    // A four-foot base is what turns a walking stick into the thing a person
    // needs when a single point of contact is not enough any more.
    p.curve('assist-quad-base',wood,[[-.15,drop+.1,.01],[0,drop+.115,0],[.15,drop+.1,.01]],.024,hold);
    for(const sx of[-.14,.14])for(const sz of[-.05,.05])
     p.block('assist-quad-foot-'+(sx<0?'left':'right')+(sz<0?'-back':'-front'),rig.dark,[sx,drop+.045,sz],[.034,.09,.034],hold);
   }
  }
  rig.update(0);hinge();
  return {object:rig.object,modelRef:MODEL_REF,variant:{gender:female?'F':'M',age,ordinal},update:seconds=>{rig.update(seconds);hinge();},dispose:()=>rig.dispose()};
 }
 return {create,MODEL_REF};
});
