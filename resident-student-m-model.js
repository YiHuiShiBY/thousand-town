/* Middle-school students: 50 residents aged 13-17, the only roster row whose
   silhouette is a long dark school coat. The hem runs from the shoulder wedge
   down to 1.28 in adult coordinates — mid-thigh, well below the 1.9 waist line
   every plain shirt in this town stops at — and that one number is what
   separates a middle schooler from the primary child in a white shirt and
   shorts and from the university student in casual wear. No red scarf: that
   belongs to the primary school, and wearing it here would read as the wrong
   age group rather than as a variant.

   Built on the shared resident kit, so a student keeps the town proportions,
   the shared walk cycle and the same head growth as every other role. */
(function(root,factory){
 const api=factory(root.CityResidentKit||(typeof module==='object'&&module.exports?require('./resident-character-kit.js'):null));
 root.CityStudentMModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kit){
 'use strict';
 const MODEL_REF='student-m/v1';
 // Three dark school-cloth bases — navy, charcoal, ink green — so fifty
 // residents read as one school with three house colours, not as fifty jackets.
 const COAT=['#22304f','#2f3540','#1f3b34'];
 const HEM_K=.8;
 const TROUSER=['#2a2f3a','#343a44','#262b26','#3a3f48'];
 const SHIRT='#f4f2ea';
 const TIE=['#7a2f34','#26405e','#3c4a3a'];
 const SHOE=['#e6e8e9','#d9dcdf','#2c3136'];
 const SOLE=['#cfc9b8','#b9b3a2','#3c4045'];
 const BAG=['#2e3440','#39414a','#243a36'];
 // One slot per roster ordinal: ten slots over fifty students, and every slot
 // owns a different (coat, zip, trouser, bag, badge) tuple so no two neighbours
 // in the roll call share a silhouette.
 const SLOTS=[
  {coat:0,zip:'open', trouser:0,bag:'back',   badge:0},
  {coat:1,zip:'shut', trouser:1,bag:'none',   badge:1},
  {coat:2,zip:'open', trouser:2,bag:'shoulder',badge:2},
  {coat:0,zip:'shut', trouser:3,bag:'back',   badge:0},
  {coat:1,zip:'open', trouser:0,bag:'none',   badge:1},
  {coat:2,zip:'shut', trouser:1,bag:'shoulder',badge:2},
  {coat:0,zip:'open', trouser:2,bag:'back',   badge:1},
  {coat:1,zip:'shut', trouser:3,bag:'none',   badge:0},
  {coat:2,zip:'open', trouser:1,bag:'shoulder',badge:2},
  {coat:0,zip:'shut', trouser:0,bag:'back',   badge:0}
 ];
 const MALE_HAIR=['crop','buzz','crop','buzz'];
 const FEMALE_HAIR=['bob','ponytail','bun','crop','braid'];
 const slotOf=ordinal=>SLOTS[((ordinal-1)%SLOTS.length+SLOTS.length)%SLOTS.length];
 // Coat outline in torso space. The hem sits at 1.28, halfway down the 1.85
 // thigh, and the skirt widens below the waist so the coat never reads as a
 // tucked shirt.
 const COAT_OUTLINE=[[-.40,1.28],[.40,1.28],[.44,2.02],[.46,2.62],[.52,2.99],[.27,3.08],[-.27,3.08],[-.52,2.99],[-.46,2.62],[-.44,2.02]];
 // Open zip: a tapering shirt strip runs the whole length of the coat.
 // Shut zip: only the collar triangle is out, which is all the shirt can show.
 const SHIRT_OPEN=[[-.24,3.05],[.24,3.05],[.19,2.66],[.14,2.20],[.17,1.30],[-.17,1.30],[-.14,2.20],[-.19,2.66]];
 const SHIRT_SHUT=[[-.16,3.06],[.16,3.06],[.13,2.86],[-.13,2.86]];
 const shade=(T,hex,k)=>p=>p.material(new T.Color(hex).multiplyScalar(k));
 function create(T,{resident={},actor={}}={}){
  const rig=Kit.create(T,{resident,actor,stride:.2}),{p,proportion:size,colors}=rig,body=rig.torso;
  const female=size.female,ordinal=colors.ordinal,slot=slotOf(ordinal),open=slot.zip==='open';
  const coatHex=COAT[slot.coat%COAT.length];
  const coat=p.material(coatHex),hem=shade(T,coatHex,HEM_K)(p);
  const shirt=p.material(SHIRT),tie=p.material(TIE[slot.coat%TIE.length]);
  const trouser=p.material(TROUSER[slot.trouser%TROUSER.length]);
  const shoeMat=p.material(SHOE[slot.trouser%SHOE.length]),soleMat=p.material(SOLE[slot.trouser%SOLE.length]);
  const bagMat=p.material(BAG[slot.coat%BAG.length]),flap=shade(T,BAG[slot.coat%BAG.length],.82)(p);
  const strap=p.material('#23262b',.7);
  const hair=female?FEMALE_HAIR[(ordinal*3+1)%FEMALE_HAIR.length]:MALE_HAIR[ordinal%MALE_HAIR.length];
  rig.hair(hair);
  // The coat replaces the bare mannequin torso rather than covering it: a
  // second garment layer would double the trunk triangles for nothing.
  rig.hide('torso');
  p.panel('uniform-coat-body',coat,COAT_OUTLINE,.42,body).position.z=-.21;
  p.block('uniform-coat-hem',hem,[0,1.32,.01],[.86,.1,.48],body);
  p.ball('uniform-collar',coat,[0,3.03,0],[.33,.085,.29],body,true);
  // School badge on the left chest: one small colour block, enough to say
  // "uniform" without a crest nobody could read from the street anyway.
  p.block('uniform-badge',tie,[-.2,2.87,.243],[.1,.075,.02],body);
  for(const sign of[-1,1]){
   const side=sign<0?'left':'right';
   if(open){
    p.panel('uniform-lapel-'+side,hem,[[sign*.25,3.07],[sign*.34,2.98],[sign*.3,2.62],[sign*.18,2.5]],.03,body).position.z=.216;
   }else{
    p.panel('uniform-front-'+side,hem,[[sign*.015,3.04],[sign*.19,3.02],[sign*.14,2.6],[sign*.03,2.2],[sign*.05,1.34],[0,1.33]],.03,body).position.z=.216;
   }
  }
  p.panel('uniform-shirt',shirt,open?SHIRT_OPEN:SHIRT_SHUT,.028,body).position.z=.212;
  if(open){
   p.panel('uniform-tie',tie,[[-.05,3.02],[.05,3.02],[.07,2.48],[-.07,2.48]],.022,body).position.z=.222;
   p.block('uniform-tie-knot',tie,[0,3.035,.232],[.11,.085,.04],body);
  }
  rig.wear(['pelvis','thigh-left','thigh-right','knee-left','knee-right','shin-left','shin-right'],trouser);
  // Full-length trousers recolour the whole leg so
  // the leg never reads as bare skin under a short coat.
  // A coat that covers the arms has to recolour the sleeves: they are separate
  // meshes, so changing the torso alone leaves two bare forearms.
  rig.wear(['shoulder-left','sleeve-upper-left','elbow-left','sleeve-lower-left','shoulder-right','sleeve-upper-right','elbow-right','sleeve-lower-right'],coat);
  // Sneakers rather than boots: a pale trainer with a gum sole and no sock
  // between the trouser and shoe, which is what a secondary school actually
  // puts on its students.
  rig.wear(['shoe-left','shoe-right'],shoeMat);
  rig.wear(['sole-left','sole-right'],soleMat);
  // Bags hang off the carrier group so the shoulder satchel can swing to the
  // hip without rebuilding the torso.
  if(slot.bag!=='none'){
   const carrier=new T.Group();carrier.name='schoolbag';
   if(slot.bag==='shoulder'){carrier.position.set(-.32,1.8,.16);carrier.rotation.set(0,.22,-.26);}
   else carrier.position.set(0,2.14,-.33);
   body.add(carrier);
   p.block('schoolbag-body',bagMat,[0,0,0],[.44,.5,.26],carrier);
   p.block('schoolbag-flap',flap,[0,.19,-.03],[.46,.14,.28],carrier);
   if(slot.bag==='back'){
    for(const sign of[-1,1])p.curve('schoolbag-strap-'+(sign<0?'left':'right'),strap,[[sign*.2,2.99,.17],[sign*.25,3.06,-.03],[sign*.2,2.88,-.3],[sign*.14,2.42,-.35]],.02,body);
   }else{
    // A single cross-body strap, with the arm posed so the hand stays on it
    // instead of swinging through the bag.
    p.curve('satchel-strap',strap,[[.24,2.99,.17],[.28,3.05,0],[-.02,2.62,.2],[-.28,1.92,.16]],.022,body);
    rig.poseArm('left',{shoulderZ:-.14,elbowX:-.24});
   }
  }
  rig.update(0);
  return {object:rig.object,modelRef:MODEL_REF,variant:{gender:female?'F':'M',age:size.age,ordinal},update:seconds=>rig.update(seconds),dispose:()=>rig.dispose()};
 }
 return {create,MODEL_REF};
});