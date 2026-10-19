/* Primary-school children: the largest band on the school roster (80 children,
   6-12, 37 girls and 43 boys). Three pieces carry the read and all three are
   real geometry: the collared white shirt, the red scarf knotted at the throat
   with two corners down the chest, and the two-strap schoolbag worn on the BACK.

   The bag direction is the point. Every other trade in the town carries its
   prop in front, so the school run is the one silhouette that still reads from
   behind — and the red scarf is the only saturated red anywhere on a child.

   The preschool band owns the one-piece romper and the big bare head; the two
   are deliberately kept apart, down to garment cut and the absence of any bag.

   Built on the shared resident kit, so age still drives stature and head size
   and the town still gets one walk cycle. */
(function(root,factory){
 const api=factory(root.CityResidentKit||(typeof module==='object'&&module.exports?require('./resident-character-kit.js'):null));
 root.CityStudentPModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kit){
 'use strict';
 const MODEL_REF='student-p/v1';
 // Shirt white through pale blue, pale pink, pale grey and pale celadon: a real
 // primary uniform never asks a child to wear one loud colour, so the variety
 // lives in five near-neighbours and the saturated colour stays on the scarf.
 const TOP=['#f2f1ea','#cfdcea','#f0d5da','#e4e8ee','#d6e3e1'];
 const BOTTOM=['#2b3550','#39404d','#4a4038','#2e4348'];
 // Four bag colours is what a school cloakroom actually holds; each one also
 // darkens into its own straps so the backpack keeps its attachment.
 const BAG=['#2f3f5c','#a03a30','#2f6a63','#4a4e57'];
 const SOCK='#f0efe8',SHOE='#e9e7de',SOLE='#c9c2b2',SCARF='#d4211f';
 // Shirt outline in torso space: the same wedge-shouldered panel the kit cuts
 // for the bare chest, one notch roomier and stopping above the trouser waist.
 const SHIRT=[[-.31,1.95],[.31,1.95],[.35,2.6],[.47,2.99],[.25,3.08],[-.25,3.08],[-.47,2.99],[-.35,2.6]];
 // One slot per roster ordinal. Ten slots over eighty children means each slot
 // lands eight times, and every slot owns a different
 // collar, sock, trouser cut and scarf still vary. Shirt and bag colours keep
 // neighbours distinct after the pocket, cuff and shoelace meshes are removed.
 const SLOTS=[
  {top:0,bottom:0,bag:0,collar:0,pocket:0,sock:0,cut:'shorts',scarf:1,hair:'crop',cuff:0,lace:1},
  {top:1,bottom:1,bag:1,collar:1,pocket:1,sock:0,cut:'shorts',scarf:1,hair:'buzz',cuff:1,lace:0},
  {top:2,bottom:0,bag:2,collar:0,pocket:0,sock:1,cut:'long',  scarf:1,hair:'bob',  cuff:0,lace:0},
  {top:3,bottom:2,bag:3,collar:1,pocket:0,sock:0,cut:'shorts',scarf:0,hair:'crop',cuff:1,lace:1},
  {top:4,bottom:1,bag:0,collar:0,pocket:1,sock:1,cut:'long',  scarf:1,hair:'ponytail',cuff:0,lace:0},
  {top:0,bottom:3,bag:1,collar:1,pocket:0,sock:0,cut:'shorts',scarf:1,hair:'buzz',cuff:0,lace:1},
  {top:1,bottom:2,bag:3,collar:0,pocket:0,sock:0,cut:'long',  scarf:0,hair:'crop',cuff:1,lace:0},
  {top:2,bottom:3,bag:0,collar:1,pocket:1,sock:1,cut:'shorts',scarf:1,hair:'bob',  cuff:0,lace:1},
  {top:3,bottom:0,bag:2,collar:0,pocket:1,sock:0,cut:'long',  scarf:1,hair:'ponytail',cuff:1,lace:0},
  {top:4,bottom:1,bag:2,collar:0,pocket:1,sock:0,cut:'shorts',scarf:1,hair:'crop',cuff:0,lace:0}
 ];
 const slotOf=ordinal=>SLOTS[((ordinal-1)%SLOTS.length+SLOTS.length)%SLOTS.length];
// No per-role stature lift. An earlier draft added one to reach a height band
// that had been estimated rather than read; the kit curve is the contract, and a
// six-year-old at 0.58 of adult stature is about 1.19 m, which is the child.
 function create(T,{resident={},actor={}}={}){
  const rig=Kit.create(T,{resident,actor}),{p,proportion:size,colors}=rig,body=rig.torso;
  const female=size.female,age=size.age,ordinal=colors.ordinal,slot=slotOf(ordinal);
  // stature is the kit's to decide; this role must not scale the rig itself.
  const topHex=TOP[slot.top%TOP.length],bottomHex=BOTTOM[slot.bottom%BOTTOM.length],bagHex=BAG[slot.bag%BAG.length];
  const shirt=p.material(topHex,.84);
  const bottomCloth=p.material(bottomHex,.86);
  const bagMat=p.material(bagHex,.8),strapMat=p.material(new T.Color(bagHex).multiplyScalar(.58),.8);
  const sockMat=p.material(SOCK,.9),shoeMat=p.material(SHOE,.7),soleMat=p.material(SOLE,.88);
  const scarfMat=p.material(SCARF,.8);
  // Age leads the bottom cut, exactly as a real school does: the younger bands
  // are put in shorts, the older ones in trousers. Below seven nobody is put in
  // long trousers no matter what the slot asks for.
  const long=age>=9||(slot.cut==='long'&&age>=7);
  // Short hair is the norm at this age. The kit has no child-specific tail, so
  // a girl keeps the ear-length bob and a boy the cropped or buzzed shell.
  const style=female?(slot.hair==='buzz'?'bob':slot.hair):(['bob','ponytail'].includes(slot.hair)?'crop':slot.hair);
  rig.hair(style);
  // The shirt replaces the bare mannequin torso instead of covering it, so the
  // silhouette stays crisp and the triangle budget keeps room for the kit.
  rig.hide('torso');
  p.panel('shirt-body',shirt,SHIRT,.42,body).position.z=-.21;
  for(const sign of[-1,1]){
   const side=sign<0?'left':'right';
   // Two collar cuts: a pointed flap and a squared school collar, both real
   // panels standing off the chest rather than a colour change.
   const collar=p.panel((slot.collar?'shirt-collar-square-':'shirt-collar-flap-')+side,shirt,
    slot.collar?[[sign*.02,3.12],[sign*.25,3.04],[sign*.21,2.9],[sign*.03,2.95]]:[[sign*.02,3.13],[sign*.25,3.05],[sign*.13,2.86]],.03,body);
   collar.position.z=.235;
   // A garment that covers the arms has to recolour the sleeves too: they are
   // separate meshes, so changing the shirt alone leaves two bare forearms.
   rig.wear(['shoulder-'+side,'sleeve-upper-'+side,'elbow-'+side,'sleeve-lower-'+side],shirt);
  }
  // Bottom: shorts keep the mannequin thigh and knee in skin and add their own
  // waist and leg cuffs, so a six-year-old really is bare to the knee. Trousers
  // recolour the whole leg and only add a hem to read the cut.
  rig.wear('pelvis',bottomCloth);
  if(long){
   rig.wear(['thigh-left','thigh-right','knee-left','knee-right','shin-left','shin-right'],bottomCloth);
   for(const leg of rig.legs)p.ball('trouser-hem-'+leg.side,bottomCloth,[0,-.74,.004],[.142,.075,.14],leg.lower,true);
  }else{
   p.block('shorts-waist',bottomCloth,[0,1.95,.01],[.68,.11,.42],body);
   for(const leg of rig.legs)p.mesh('shorts-leg-'+leg.side,p.shaft,bottomCloth,[0,-.17,.004],[.172,.44,.168],leg.upper);
  }
  // White socks and canvas sneakers. The inner shin shares the sock's six-sided
  // cross section: radius alone cannot enclose an eight-sided shin in a hexagon.
  // The aligned ring keeps the same outer sock dimensions and follows the knee.
  const sockName=slot.sock?'sock-tall-':'sock-cuff-';
  for(const leg of rig.legs){
   const side=leg.side;
   rig.parts['shin-'+side].geometry=p.shaft;
   p.mesh(sockName+side,p.shaft,sockMat,[0,slot.sock?-.5:-.66,0],slot.sock?[.14,.68,.138]:[.134,.3,.132],leg.lower);
   rig.wear('shoe-'+side,shoeMat);rig.wear('sole-'+side,soleMat);
  }
  // The red scarf: one knot at the throat, a band around the back of the neck so
  // it does not float, and two triangular corners hanging down the chest. Real
  // panels, so the scarf is the one shape a child silhouette never loses.
  if(slot.scarf){
   p.block('scarf-knot',scarfMat,[0,3.01,.245],[.17,.15,.14],body);
   p.mesh('scarf-band-back',p.shaft,scarfMat,[0,3.02,-.16],[.16,.17,.15],body);
   for(const sign of[-1,1]){
    const side=sign<0?'left':'right';
    p.panel('scarf-tail-'+side,scarfMat,[[sign*.02,2.98],[sign*.02,2.72],[sign*.3,2.6]],.018,body).position.z=.27;
   }
  }
  // The schoolbag keeps its simple body and two shoulder straps.
  p.block('sbag-body',bagMat,[0,2.36,-.4],[.6,.8,.35],body);
  for(const sign of[-1,1]){
   const side=sign<0?'left':'right';
   p.curve('sbag-strap-'+side,strapMat,[[sign*.17,2.99,.19],[sign*.28,3.05,.04],[sign*.42,3.03,-.12],[sign*.32,2.87,-.36],[sign*.16,2.75,-.45]],.028,body);
  }
  rig.update(0);
  return {object:rig.object,modelRef:MODEL_REF,variant:{gender:female?'F':'M',age,ordinal},update:seconds=>rig.update(seconds),dispose:()=>rig.dispose()};
 }
 return {create,MODEL_REF};
});
