/* Unemployed residents: ten people aged 18-22, three of them women. This is the
   only trade in the town drawn by NEGATIVE design. Every other one of the twenty
   roles is recognised by the one object it owns -- a badge, a case, an apron, a
   helmet, a stethoscope, a tool, a uniform -- and this group is recognised by
   owning none of them. That claim has to hold in geometry, not in prose: a single
   carried prop, even an empty lanyard, would turn this trade back into a trade.

   So there is no briefcase, no tote, no headphones, no campus card, no hard hat,
   no hi-vis stripe, no prisoner-style banding. What is left has to be designed
   properly or the group degrades into one shared mannequin, so the everyday
   clothes carry the whole read: washed-out hooded sweatshirt, crew tee and an open
   thin jacket, all in five faded, low-saturation colours (faded navy, grey green,
   dark red, ochre, khaki) that are deliberately duller than anything the student
   band wears, worn again and washed again. One small carried item each -- a phone
   held flat to the ear, both hands pushed into the hip pockets, or the hood pulled
   down over the head -- and that is the entire inventory.

   Four independent axes come off the roster ordinal (top / trouser / shoe /
   carried item), so no two of the ten share a parts list. Built on the shared
   resident kit, so the body and the walk cycle stay identical to every other
   role. Part names are prefixed per garment and never reuse a student band's
   name, which is what lets the test prove the two groups cannot collide. */
(function(root,factory){
 const api=factory(root.CityResidentKit||(typeof module==='object'&&module.exports?require('./resident-character-kit.js'):null));
 root.CityUnemployedModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kit){
 'use strict';
 const MODEL_REF='unemployed/v1';
 const MODEL_LABEL='待业居民 · 无物一身';
 const MODEL_DESCRIPTION='10 名 18-22 岁居民不穿制服也不带任何识别物：洗旧的连帽卫衣 / 圆领 T 恤 / 敞开的薄外套，灰调低饱和的旧衣配宽松运动长裤、旧牛仔裤与磨旧帆布鞋。全镇唯一靠"什么都没有"被认出的小组——没有工牌、没有包、没有耳机、没有工具，唯一随身物只有贴在耳边的手机、插在髋兜里的手或盖在头上的兜帽。';
 const TOPS=['sweatshirt','tee','windbreaker'],
  BOTTOMS=['trackpant','wornjean','wornjean-flare'],
  SHOES=['trainer','canvas-shoe','trainer-worn'],
  CARRY=['phone','pocket','hood'];
 // Worn-out cloth: five faded, low-saturation colours. Nothing here is a school
 // colour and nothing is bright, which is half of what separates this group from
 // the university band.
 const WEAR=['#4a5566','#5e6b58','#7a4f4a','#9a8759','#7d7358'];
 const TRACKPANT=['#43484b','#4e4b42','#3c4648','#585349','#475057'];
 const JEAN=['#414b58','#48525e','#3a434e','#4c5259','#3f4954'];
 const INNER=['#b9b4a6','#a8a396','#c2bcae','#9ea197'];
 const SHOE_UP=['#4b4f52','#5c5750','#3f4346','#54524a','#474d4f'];
 const SOLE=['#cdc7ba','#bfb6a4','#b0aca2'];
 // Hair is cropped and unstyled rather than arranged, so the silhouette says
 // "has not been fussed over" without needing a single prop.
 const HAIR_F=['crop','bob','long','crop','bun','ponytail'],
  HAIR_M=['crop','crop','buzz','crop','curly','crop'];
 const shade=(p,T,hex,factor)=>p.material(new T.Color(hex).multiplyScalar(factor),.9);
 // The arm rig cannot reach the front of the hip -- the pocket sits 1.22 units
 // from the shoulder against a 1.12 unit arm -- so "hands in the pockets" is
 // drawn as the elbow bent forward and inward with the hand at the outer front
 // of the thigh. Both
 // poses were solved numerically against the kit rig, not guessed.
 const POSE_PHONE={shoulderX:.3,shoulderZ:-2.4,elbowX:-1,elbowZ:-2.2},
  POSE_POCKET={shoulderX:.1,shoulderZ:.1,elbowX:-.4,elbowZ:.35};
 const slotOf=ordinal=>{
  const i=Math.max(0,Math.floor(ordinal)-1);
  const a=i%3,b=Math.floor(i/3)%3,c=Math.floor(i/6)%3,d=Math.floor(i/9)%3;
  const top=TOPS[a];
  let carry=CARRY[(a+c+d)%3];
  // A tee has no hood to pull down, so that combination carries the phone
  // instead. Sweatshirt and jacket both have one.
  if(carry==='hood'&&top==='tee')carry='phone';
  return {top,bottom:BOTTOMS[(a+b)%3],shoe:SHOES[(b+c)%3],carry,wear:WEAR[i%5],i};
 };
 function create(T,{resident={},actor={}}={}){
  const rig=Kit.create(T,{resident,actor}),{p,proportion:size,colors}=rig,
   female=size.female,ordinal=colors.ordinal,slot=slotOf(ordinal),i=slot.i,
   body=rig.torso,head=rig.head;
  rig.hair((female?HAIR_F:HAIR_M)[i%6]);
  // The mannequin chest is bare skin and every top here covers it completely, so
  // it is dropped rather than covered: no z-fighting, and the triangle budget
  // stays free for the clothes, which are this trade's only identity.
  rig.hide('torso');
  const cloth=p.material(slot.wear,.9),trim=shade(p,T,slot.wear,.86);
  const W=female?.375:.415;
  // A hood is a real cloth shell on the head rig: worn up it is a second skull
  // with the face clear in the opening and a brim over the brow, worn down it is
  // a lump of cloth bunched behind the neck. Neither of them is a hat.
  function hood(){
   if(slot.top!=='sweatshirt'&&slot.top!=='windbreaker')return;
   if(slot.carry==='hood'){
    p.shell('head-hood',cloth,{columns:10,rows:4,centre:[0,3.6,-.04],radius:[.49,.51,.48],back:2.5,front:.92,parent:head});
   }else{
    p.shell('neck-hood',cloth,{columns:10,rows:4,centre:[0,3.16,-.31],radius:[.35,.3,.26],back:2.2,front:1,parent:head});
   }
  }
  // Torso outlines are measured against the kit's own chest panel, which runs
  // 1.92 at the waist to 3.07 at the collar. Everyday cloth hangs lower and
  // wider than a shirt does, because it has been washed out of its shape.
  if(slot.top==='sweatshirt'){
   p.panel('sweatshirt-body',cloth,[[-W-.05,1.83],[W+.05,1.83],[W+.09,2.55],[W+.08,2.93],[.26,3.05],[-.26,3.05],[-W-.08,2.93],[-W-.09,2.55]],.42,body).position.z=-.21;
   p.block('sweatshirt-hem',trim,[0,1.925,0],[W*2+.2,.11,.5],body);
   hood();
   for(const arm of rig.arms){
    rig.wear(['sleeve-lower-'+arm.side,'elbow-'+arm.side],cloth);
   }
   rig.wear(['sleeve-upper-left','sleeve-upper-right','shoulder-left','shoulder-right'],cloth);
  }else if(slot.top==='tee'){
   p.panel('worn-tee-body',cloth,[[-W-.01,1.92],[W+.01,1.92],[W+.05,2.56],[W+.02,2.95],[.24,3.06],[-.24,3.06],[-W-.02,2.95],[-W-.05,2.56]],.38,body).position.z=-.19;
   p.ball('worn-tee-neck',trim,[0,3.02,0],[.24,.09,.24],body,true);
   // A short sleeve stops at the elbow, which is what separates a summer tee
   // from a sweatshirt at any distance.
   for(const arm of rig.arms)rig.wear(['sleeve-upper-'+arm.side,'shoulder-'+arm.side,'elbow-'+arm.side],cloth);
  }else{
   const inner=p.material(INNER[(i+2)%4],.88);
   p.panel('windbreaker-body',cloth,[[-W-.06,1.86],[W+.06,1.86],[W+.1,2.57],[W+.07,2.96],[.28,3.07],[-.28,3.07],[-W-.07,2.96],[-W-.1,2.57]],.4,body).position.z=-.2;
   // Worn open over an old tee, so the front reads as three layers of cloth:
   // the inner panel down the centre and one hanging edge on each side.
   p.panel('windbreaker-inner',inner,[[-.25,1.95],[.25,1.95],[.25,2.9],[0,3.03],[-.25,2.9]],.03,body).position.z=.215;
   p.panel('windbreaker-edge-left',cloth,[[-.45,1.92],[-.25,1.92],[-.25,2.95],[-.35,3.02]],.035,body).position.z=.234;
   p.panel('windbreaker-edge-right',cloth,[[.25,1.92],[.45,1.92],[.35,3.02],[.25,2.95]],.035,body).position.z=.234;
   p.panel('windbreaker-collar-left',trim,[[-.04,3.11],[-.24,3.04],[-.13,2.86]],.032,body).position.z=.247;
   p.panel('windbreaker-collar-right',trim,[[.04,3.11],[.24,3.04],[.13,2.86]],.032,body).position.z=.247;
   hood();
   for(const arm of rig.arms){
    rig.wear(['sleeve-lower-'+arm.side,'elbow-'+arm.side],cloth);
   }
   rig.wear(['sleeve-upper-left','sleeve-upper-right','shoulder-left','shoulder-right'],cloth);
  }
  // Trousers. The extras ride the thigh / shin / foot groups rather than the
  // torso, so they swing with the shared walk cycle instead of hanging in mid
  // air the moment the leg rotates.
  const kind=slot.bottom,
   leg=p.material(kind==='trackpant'?TRACKPANT[i%5]:JEAN[(i+1)%5],.9);
  rig.wear(['pelvis','thigh-left','thigh-right','knee-left','knee-right','shin-left','shin-right'],leg);
  if(kind==='trackpant'){
   p.block('trackpant-waist',trim,[0,1.945,0],[.74,.12,.48],body);
   for(const l of rig.legs){
    p.block('trackpant-hem-'+l.side,leg,[0,-.66,.012],[.35,.2,.31],l.lower);
   }
  }else if(kind==='wornjean'){
   p.block('wornjean-waist',trim,[0,1.945,0],[.71,.1,.45],body);
   for(const l of rig.legs){
    p.ball('wornjean-hemroll-'+l.side,trim,[0,-.7,0],[.166,.09,.166],l.lower,true);
   }
  }else{
   p.block('wornjean-waist',trim,[0,1.945,0],[.76,.12,.47],body);
   for(const l of rig.legs){
    p.block('wornjean-flare-leg-'+l.side,leg,[0,-.63,.012],[.36,.2,.32],l.lower);
   }
  }
  const shoeUpper=p.material(SHOE_UP[i%5],.9),soleMat=p.material(SOLE[(i+1)%3],.74);
  rig.wear(['shoe-left','shoe-right'],shoeUpper);
  rig.wear(['sole-left','sole-right'],soleMat);
  if(slot.shoe==='canvas-shoe')for(const l of rig.legs)
   p.ball('canvas-shoe-collar-'+l.side,shoeUpper,[0,.135,-.005],[.152,.135,.16],l.foot,true);
  // The entire inventory of this trade is one of these three things. The phone
  // is the only object in the file, and it is parented to the posed elbow so it
  // stays against the ear at every frame instead of swinging away with the walk.
  if(slot.carry==='phone'){
   const arm=rig.poseArm('left',POSE_PHONE),
    shell=p.material('#3c4147',.5);
   // Centred on the solved hand position, so the plate sits against the ear and
   // the hand is behind it rather than under it.
   p.block('phone-hand-left',shell,[-.03,-.52,.055],[.17,.34,.018],arm.elbow);
  }else if(slot.carry==='pocket'){
   rig.poseArm('left',POSE_POCKET);
   rig.poseArm('right',{...POSE_POCKET,shoulderZ:-POSE_POCKET.shoulderZ,elbowZ:-POSE_POCKET.elbowZ});
  }
  // The read of "nothing to do" is a slouch, so the whole upper body tips two
  // degrees forward. It is a lean from the ankles rather than the stoop of old
  // age, and it stays shallow enough to keep both feet on the ground.
  rig.upper.rotation.x=.04;
  rig.update(0);
  return {object:rig.object,modelRef:MODEL_REF,variant:{gender:female?'F':'M',age:size.age,ordinal},update:seconds=>rig.update(seconds),dispose:()=>rig.dispose()};
 }
 return {create,MODEL_REF,MODEL_LABEL,MODEL_DESCRIPTION};
});