/* Teachers keep soft layered tops, distinct hair and a chest-held clipboard.
   The shared resident rig preserves the original stature, joints and walk cycle. */
(function(root,factory){
 const api=factory(root.CityResidentKit||(typeof module==='object'&&module.exports?require('./resident-character-kit.js'):null));
 root.CityTeacherModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kit){
 'use strict';
 const MODEL_REF='teacher/v1';
 const MODEL_LABEL='教师';
 const MODEL_DESCRIPTION='教师靠抱在胸前的夹板和柔和色上衣认人，配针织开衫／衬衫／针织背心配燕麦、浅驼、雾蓝、藕粉、鼠尾草等柔和色，袖口套一副浅色袖套；不提公文包、不打领带、不挂工牌。';
 // The arm angles that hold the board. The shoulder swings the elbow forward and
 // the elbow folds the forearm up until it is nearly vertical, which leaves the
 // hand on the board's left edge at chest height.
 const HOLD_SHOULDER_X=.35,HOLD_ELBOW_X=2.3;
 // Where the board hangs, in the rig's own upper-body space (the figure faces
 // +z here). z is the depth in front of the chest, not a world axis: the root
 // group turns the rig a quarter turn, so this reads as world +x on screen.
 const BOARD_AT=[-.33,2.55,.44];
 // Female teachers are 15 of the 24 and the kit's own sex stature already sets
 // them a head below the men, so this is a bounded 2% nudge, not a second sex
 // scale: it keeps the roster's majority half off one identical column. It
 // scales the whole rig, so head-to-body ratio and the walk cycle are untouched.
 const FEMALE_LIFT=1.02;
 // Five soft knits and five shirt whites. Teaching clothes are the quiet ones --
 // the loud colour on this roster belongs to the school scarf, not to the staff.
 const KNIT=['#e3d7c0','#d8c4a6','#c4d3de','#e4cbcf','#c7d0bd'];
 const SHIRT=['#f3efe6','#e9edf1','#f0e7dd','#e5ebe5','#f1eae7'];
 const SKIRT=['#4a4f5c','#565048','#3f4f52','#5c4a4c','#48505a'];
 const TROUSER=['#3b4149','#4a453e','#2f3a3f','#514a44','#39424c'];
 // Sleeve protectors are the one accessory that is unmistakably chalk dust, and
 // they are cheap: a short band over the forearm cloth.
 const SLEEVE_CUFF=['#e9e2d0','#dfd3c0','#e6e9df','#e2d8d8','#dfe5ea'];
 // The five hair shapes this roster uses. Male teachers stay in the crop: the
 // brief's five are the female set, and the other five axes already keep nine
 // men apart without a hairstyle nobody in that age band would turn up with.
 const HAIR_F=['bob','bun','crop','ponytail','long'];
 const TOPS=['cardigan','blouse','vest'];
 // Every arm mesh a top has to cover. The sleeves, shoulders and elbows are
 // separate meshes, so recolouring the chest alone leaves a bare-armed figure.
 const SLEEVES=['sleeve-upper-left','sleeve-upper-right','sleeve-lower-left','sleeve-lower-right','shoulder-left','shoulder-right','elbow-left','elbow-right'];
 // Stable ordinal slots retain the original wardrobe, hair and clipboard choices.
 const slotOf=(ordinal,female)=>({
  top:TOPS[(ordinal-1)%TOPS.length],
  tone:Math.floor((ordinal-1)/TOPS.length)%KNIT.length,
  hair:(ordinal-1)%HAIR_F.length,
  clipboard:ordinal%4!==3,
  cuff:ordinal%4===1,
  skirt:female&&ordinal%3!==0
 });
 function create(T,{resident={},actor={}}={}){
  const rig=Kit.create(T,{resident,actor,stride:resident.gender==='F'&&slotOf(Kit.ordinalOf(resident.id),true).skirt?.16:1}),{p,proportion:size,colors}=rig,body=rig.torso;
  const female=size.female,ordinal=colors.ordinal,age=size.age,slot=slotOf(ordinal,female);
  if(female)rig.object.scale.multiplyScalar(FEMALE_LIFT);
  const knitHex=KNIT[slot.tone],shirtHex=SHIRT[slot.tone],bottomHex=(female&&slot.skirt?SKIRT:TROUSER)[slot.tone];
  const knit=p.material(knitHex,.9);
  const shirtMat=p.material(shirtHex,.86);
  const bottom=p.material(bottomHex,.87);
  const shoeMat=p.material('#4b4038',.68),soleMat=p.material('#2b2f31',.74);

  const boardMat=p.material('#a8926a',.82),paperMat=p.material('#f2eee1',.8),clipMat=p.material('#b0a077',.35);
  const cuffMat=p.material(SLEEVE_CUFF[slot.tone],.92);
  rig.hair(female?HAIR_F[slot.hair%HAIR_F.length]:'crop');
  // The top replaces the bare mannequin torso rather than covering it, so the
  // silhouette stays crisp and the budget keeps room for the two props this
  // trade is read by.
  rig.hide('torso');
  const hw=female?.4:.44;
  const SHELL=[[-hw,1.94],[hw,1.94],[hw+.05,2.56],[hw+.02,2.96],[.235,3.06],[-.235,3.06],[-hw-.02,2.96],[-hw-.05,2.56]];
  if(slot.top==='cardigan'){
   // Knit over a shirt: the open front of the cardigan shows a wedge of shirt
   // and a collar, which is what keeps a pale knit from reading as a colour
   // block. No tie is added here or anywhere else in this file.
   p.panel('cardigan',knit,[[-.36,1.95],[.36,1.95],[.42,2.53],[.48,2.94],[.27,3.06],[-.27,3.06],[-.48,2.94],[-.42,2.53]],.39,body).position.z=-.195;
   p.panel('shirt-opening',shirtMat,[[-.19,3.05],[.19,3.05],[.11,2.72],[0,2.54],[-.11,2.72]],.026,body).position.z=.238;
   for(const sign of[-1,1]){
    const side=sign<0?'left':'right';
    p.panel('shirt-collar-'+side,shirtMat,[[sign*.015,3.115],[sign*.225,3.05],[sign*.132,2.868]],.035,body).position.z=.276;
   }
   rig.wear(SLEEVES,knit);
  }else if(slot.top==='blouse'){
   p.panel('blouse',shirtMat,SHELL,.38,body).position.z=-.19;
   for(const sign of[-1,1]){
    const side=sign<0?'left':'right';
    p.panel('blouse-collar-'+side,shirtMat,[[sign*.022,3.105],[sign*.215,3.045],[sign*.12,2.872]],.032,body).position.z=.253;
   }
   rig.wear(SLEEVES,shirtMat);
  }else{
   p.panel('shirt',shirtMat,SHELL,.38,body).position.z=-.19;
   p.panel('vest',knit,[[-.34,1.96],[.34,1.96],[.39,2.56],[.3,2.96],[.055,2.63],[-.055,2.63],[-.3,2.96],[-.39,2.56]],.045,body).position.z=.226;
   for(const sign of[-1,1]){
    const side=sign<0?'left':'right';
    p.panel('shirt-collar-'+side,shirtMat,[[sign*.022,3.105],[sign*.215,3.045],[sign*.12,2.872]],.032,body).position.z=.253;
   }
   rig.wear(SLEEVES,shirtMat);
  }
  if(female&&slot.skirt){
   // Knee-length A-line. The hem is the strongest shape difference this roster
   // owns, so it keeps the original knee-length cut over
   // the clothed pelvis.
   const hemY=1.3,flare=.38;
   p.panel('skirt',bottom,[[-.35,1.95],[.35,1.95],[flare,hemY],[-flare,hemY]],.4,body).position.z=-.2;
   rig.wear(['pelvis'],bottom);
  }else{
   // Trousers are a material swap on the mannequin legs, not a second garment
   // layer: a few hundred triangles would buy no silhouette.
   rig.wear(['pelvis','thigh-left','thigh-right','knee-left','knee-right','shin-left','shin-right'],bottom);
  }
  rig.wear(['shoe-left','shoe-right'],shoeMat);
  rig.wear(['sole-left','sole-right'],soleMat);
  if(slot.clipboard){
   // Hugged, not under the arm. The left arm is posed rather than animated, so
   // the board rides the forearm at every frame instead of swinging through it,
   // and the holder cancels the arm's accumulated x rotation, which keeps the
   // board upright in the world however the pose angles above are retuned.
   const arm=rig.poseArm('left',{shoulderX:-HOLD_SHOULDER_X,elbowX:-HOLD_ELBOW_X});
   rig.update(0);
   const holder=new T.Group();holder.name='clipboard-hold';
   holder.rotation.x=HOLD_SHOULDER_X+HOLD_ELBOW_X;
   arm.elbow.add(holder);
   holder.position.copy(arm.elbow.worldToLocal(rig.upper.localToWorld(new T.Vector3(BOARD_AT[0],BOARD_AT[1],BOARD_AT[2]))));
   holder.rotation.y=-.14;
   p.block('clipboard',boardMat,[0,0,0],[.58,.66,.05],holder);
   p.block('clipboard-paper',paperMat,[0,-.015,.034],[.5,.55,.014],holder);
   p.block('clipboard-clip',clipMat,[0,.355,.036],[.2,.075,.05],holder);
  }
  // Sleeve protectors: a short band of pale cloth over the forearm, riding the
  // elbow group so it follows the arm whether it is posed or swinging.
  if(slot.cuff)for(const arm of rig.arms)p.limb('sleeveband-'+arm.side,cuffMat,[0,-.16,.014],[0,-.35,.027],.118,arm.elbow);
  rig.update(0);
  return {object:rig.object,modelRef:MODEL_REF,variant:{gender:female?'F':'M',age,ordinal},update:seconds=>rig.update(seconds),dispose:()=>rig.dispose()};
 }
 return {create,MODEL_REF,MODEL_LABEL,MODEL_DESCRIPTION};
});
