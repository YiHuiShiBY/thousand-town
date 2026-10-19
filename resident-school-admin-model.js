/* School office staff: knit cardigan, plain lanyard badge and a carried folder.
   Built on the shared resident kit so every role keeps the same proportions. */
(function(root,factory){
 const api=factory(root.CityResidentKit||(typeof module==='object'&&module.exports?require('./resident-character-kit.js'):null));
 root.CitySchoolAdminModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kit){
 'use strict';
 const MODEL_REF='school-admin/v1';
 const KNIT=['#394f64','#516863','#495b74','#696279','#647168','#3f626d'];
 function create(T,{resident={},actor={}}={}){
  const rig=Kit.create(T,{resident,actor}),{p,proportion:size,colors}=rig;
  const female=size.female,ordinal=colors.ordinal;
  const knit=p.material(KNIT[(ordinal-1)%KNIT.length]);
  const shirt=p.material('#f2ebdc');
  const pants=p.material(female?'#565f5d':'#687067');
  const shoe=p.material('#2e393c',.68);
  const strap=p.material('#547b6b'),badge=p.material('#f2ecdd');
  const folderMat=p.material('#b89866'),paper=p.material('#eee5ce');
  rig.hair(female?'bun':'crop');
  // The cardigan replaces the bare mannequin torso rather than covering it, so
  // the silhouette stays crisp and the budget keeps room for the props.
  rig.hide('torso');
  const body=rig.torso;
  const cardigan=p.panel('cardigan',knit,[[-.36,1.95],[.36,1.95],[.42,2.53],[.48,2.94],[.27,3.06],[-.27,3.06],[-.48,2.94],[-.42,2.53]],.39,body);cardigan.position.z=-.195;
  const opening=p.panel('shirt',shirt,[[-.19,3.055],[.19,3.055],[.11,2.73],[0,2.55],[-.11,2.73]],.026,body);opening.position.z=.235;
  for(const sign of[-1,1]){
   const side=sign<0?'left':'right';
   const collar=p.panel('collar-'+side,shirt,[[sign*.015,3.115],[sign*.22,3.05],[sign*.13,2.87]],.035,body);collar.position.z=.275;
  }
  rig.wear(['pelvis','thigh-left','thigh-right','knee-left','knee-right','shin-left','shin-right'],pants);
  rig.wear(['shoe-left','shoe-right'],shoe);
 // A cardigan with bare arms is the classic way a low-poly figure gives itself
 // away: the sleeves are their own meshes, so they need the knit as well.
 rig.wear(['sleeve-upper-left','sleeve-upper-right','sleeve-lower-left','sleeve-lower-right','shoulder-left','shoulder-right','elbow-left','elbow-right'],knit);
  // A plain badge identifies the staff without print or small hardware.
  p.curve('lanyard-left',strap,[[-.14,3.08,.185],[-.14,2.87,.313],[-.1,2.67,.335],[.005,2.575,.35]],.012,body);
  p.curve('lanyard-right',strap,[[.14,3.08,.185],[.14,2.87,.313],[.1,2.67,.335],[.005,2.575,.35]],.012,body);
  p.block('badge',badge,[.005,2.465,.354],[.196,.193,.035],body);
  // The left arm is posed, not animated: the folder stays carried while walking.
  const arm=rig.poseArm('left',{shoulderZ:-.2,elbowX:-1.55,elbowZ:.9});
  const held=new T.Group();held.name='folder-hold';held.position.set(-.01,-.54,.1);held.rotation.z=.14;arm.elbow.add(held);
  p.block('folder',folderMat,[0,0,0],[.48,.74,.078],held);
  p.block('folder-pages',paper,[0,.032,-.047],[.415,.64,.032],held);
  rig.update(0);
  return {object:rig.object,modelRef:MODEL_REF,variant:{gender:female?'F':'M',age:size.age,ordinal},update:seconds=>rig.update(seconds),dispose:()=>rig.dispose()};
 }
 return {create,MODEL_REF};
});