/* Preschool children: a one-piece romper worn bib fashion, soft shoes and one
   small carried toy. Built on the shared resident kit so age keeps driving
   stature; nothing here resizes the body or the head. */
(function(root,factory){
 const api=factory(root.CityResidentKit||(typeof module==='object'&&module.exports?require('./resident-character-kit.js'):null));
 root.CityPreschoolerModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kit){
 'use strict';
 const MODEL_REF='preschooler/v1';
 // Bright but soft warm tones. Six steps over forty children, so neighbouring
 // roster numbers never land on the same colour.
 const ROMPER=['#f0c46a','#f2a765','#8fc9c1','#e9a9b4','#c9d68a','#9fb8d8'];
 const BIB='#f7f1e3',SNAP='#5a6b73';
 const SHOE=['#f4efe3','#e7ddc9','#dbe6e6'];
 const TOYS=['bottle','doll','pack'];
 const shade=(T,hex,k)=>p=>p.material(new T.Color(hex).multiplyScalar(k));
 function create(T,{resident={},actor={}}={}){
  const rig=Kit.create(T,{resident,actor}),{p,proportion:size,colors}=rig;
  const female=size.female,ordinal=colors.ordinal,age=size.age;
  const cloth=ROMPER[(ordinal-1)%ROMPER.length];
  const romper=p.material(cloth),trim=shade(T,cloth,.84)(p);
  const bib=p.material(BIB);
  const shoe=shade(T,SHOE[ordinal%SHOE.length],1)(p),sole=shade(T,SHOE[ordinal%SHOE.length],.78)(p);
  // Under twos wear sparse hair; the top knot only arrives once a child can sit
  // up, so nobody at one gets a tail.
  rig.hair(age<=2?'buzz':female?'bun':'crop');
  // The romper replaces the bare torso and pelvis instead of covering them: a
  // second garment layer would double the trunk triangles for nothing.
  rig.hide('torso','pelvis');
  const body=rig.torso;
  const suit=p.panel('romper-body',romper,[[-.37,1.9],[.37,1.9],[.39,2.53],[.47,2.94],[.27,3.06],[-.27,3.06],[-.47,2.94],[-.39,2.53]],.4,body);suit.position.z=-.2;
  p.block('romper-seat',romper,[0,1.83,0],[.68,.15,.43],body);
  rig.wear(['thigh-left','thigh-right','shin-left','shin-right','knee-left','knee-right'],romper);
  // Long sleeves are their own meshes: recolouring them is what stops the
  // figure reading as dressed with bare arms.
  rig.wear(['sleeve-upper-left','sleeve-upper-right','sleeve-lower-left','sleeve-lower-right','shoulder-left','shoulder-right','elbow-left','elbow-right'],romper);
  const bibFront=p.panel('bib-front',bib,[[-.2,2.6],[.2,2.6],[.215,2.88],[.13,2.99],[-.13,2.99],[-.215,2.88]],.035,body);bibFront.position.z=.235;
  for(const sign of[-1,1]){
   const side=sign<0?'left':'right';
   p.limb('strap-'+side,bib,[sign*.135,2.98,.225],[sign*.2,3.07,0],.026,body,true);
   p.limb('strap-back-'+side,bib,[sign*.2,3.07,0],[sign*.16,2.92,-.21],.026,body,true);
  }
  // The bib and round neckline carry the toddler silhouette; the face stays blank.
  p.ball('collar',bib,[0,2.98,0],[.205,.075,.2],body,true);
  // Soft shoes: a fraction under adult size, and smaller again at one, so the
  // feet never read as borrowed from an adult figure.
  const shoeScale=.8+age*.024;
  rig.wear(['shoe-left','shoe-right'],shoe);
  rig.wear(['sole-left','sole-right'],sole);
  for(const leg of rig.legs){
   const side=leg.side,boot=rig.object.getObjectByName('shoe-'+side),base=rig.object.getObjectByName('sole-'+side);
   if(boot)boot.scale.multiplyScalar(shoeScale);
   if(base)base.scale.multiplyScalar(shoeScale);
  }
  // Toys are handed out by roster ordinal: four children in ten carry nothing,
  // so forty residents are not forty identical balls.
  const toy=ordinal%4===0?null:TOYS[(ordinal+Math.floor(ordinal/4))%TOYS.length];
  if(toy==='bottle'){
   const bottleMat=p.material('#eef1ea',.55),snap=p.material(SNAP,.6);
   const arm=rig.poseArm('left',{shoulderZ:-.22,elbowX:-1.3,elbowZ:.8});
   const hold=new T.Group();hold.name='toy-bottle-hold';hold.position.set(-.028,-.5,.07);hold.rotation.z=.16;arm.elbow.add(hold);
   p.limb('bottle-body',bottleMat,[0,0,0],[0,-.3,0],.072,hold);
   p.ball('bottle-cap',snap,[0,-.37,0],[.062,.05,.062],hold,true);
  }else if(toy==='doll'){
   // Both palms cup the original doll body; the held elbows and the toy share
   // the torso's movement, so neither hand can leave the hug while walking.
   const dollMat=p.material('#d8b38c');
   rig.poseArm('left',{shoulderZ:.17,elbowX:-1.6,elbowZ:.65});
   rig.poseArm('right',{shoulderZ:-.17,elbowX:-1.6,elbowZ:-.65});
   const hug=new T.Group();hug.name='toy-doll-hold';hug.position.set(0,2.4,.36);body.add(hug);
   p.ball('doll-body',dollMat,[0,0,0],[.13,.15,.1],hug,true);
   p.ball('doll-head',dollMat,[0,.2,.01],[.105,.1,.1],hug,true);
  }else if(toy==='pack'){
   const packMat=shade(T,cloth,1.12)(p);
   p.block('pack-body',packMat,[0,2.22,-.31],[.37,.42,.19],body);
   p.curve('pack-strap',trim,[[-.16,2.99,.19],[-.2,3.06,-.02],[0,3.09,-.26],[.2,3.06,-.02],[.16,2.99,.19]],.026,body);
  }
  rig.update(0);
  return {object:rig.object,modelRef:MODEL_REF,variant:{gender:female?'F':'M',age,ordinal},update:seconds=>rig.update(seconds),dispose:()=>rig.dispose()};
 }
 return {create,MODEL_REF};
});