/* University students: seventy people aged 18-22, the only trade in the town with
   no uniform at all. The whole read of the group is that they dress like young
   people rather than like staff: a hooded sweatshirt with a real geometric hood
   shell, loose denim or a jogger, canvas shoes, a soft canvas tote and a pair of
   headphones. There is deliberately no school language anywhere in this file --
   no tie, no scarf, no crest, no blazer -- because the primary, middle and upper
   school bands have to stay separable at a glance, and the strongest way to make
   the university band read as the oldest students is to give it nothing shared
   with the two younger ones.

   Seventy people in one outfit would render as one repeated column, so the parts
   list is driven by the roster ordinal across five independent axes: top kind
   (hoodie / tee / open shirt), trouser cut, shoe kind, bag carry and headphones.
   The major cuts, carry modes and cloth colours remain distinct after small
   shoe, cord and card decorations are removed. Built on the shared resident kit so this
   group keeps the same body and the same walk cycle as every other role. */
(function(root,factory){
 const api=factory(root.CityResidentKit||(typeof module==='object'&&module.exports?require('./resident-character-kit.js'):null));
 root.CityStudentUModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kit){
 'use strict';
 const MODEL_REF='student-u/v1';
 const MODEL_LABEL='大学生 · 休闲低模';
 const MODEL_DESCRIPTION='70 名 18-22 岁居民不穿任何制服：连帽卫衣（兜帽是真球壳，挂在头骨架上）/ T 恤 / 敞开的衬衫外穿，配工装牛仔裤、宽松长裤或束脚裤，帆布鞋配软塌托特包，耳机绕颈或挂耳。名册序号散出五轴个体差异，翻图册不重样。';
 // One mixed-radix counter over the five axes. 3*3*3*3 covers 81 ordinals, so the
 // real roster of seventy retains stable top/bottom/shoe/bag choices. Colours
 // and major cuts distinguish appearances when small shoe parts are removed.
 const TOPS=['hoodie','tee','open-shirt'],BOTTOMS=['denim','wide-denim','jogger'],
  SHOES=['canvas-low','canvas-high','skate'],BAGS=['shoulder','hand','none'],
  PHONES=['neck','ear','none'];
 const HAIR_F=['ponytail','bun','long','curly','bob','crop'],HAIR_M=['crop','buzz','curly','crop','ponytail','bob'];
 // Eight toppings rather than a uniform colour, and none of them is a school
 // colour: this is what people actually turn up in.
 const HOODIE_COLOUR=['#3f4a55','#6d7c63','#8c5a4a','#41586e','#5b5568','#2f3a41','#7a6a52','#4a5f6b'];
 const TEE_COLOUR=['#e4e0d4','#c9536a','#5d7f92','#d8a24e','#6a7f57','#b0b6bd','#7c5f8a','#dedad0'];
 const SHIRT_COLOUR=['#c9d2d6','#e6dccb','#9fb3a8','#d9c3b4','#b9c2cc','#e3d8c4'];
 const DENIM=['#3f4a5c','#4a5468','#35414f','#556070','#3c4a55'];
 const WIDE_DENIM=['#454f60','#3a4653','#4e5765','#404b58'];
 const JOGGER=['#3a3f45','#4c4a44','#2f3a3f','#555a52','#43474d'];
 const CANVAS=['#e6e2d6','#d8d2c2','#2f3438','#6a6f6a','#c9bfa8'];
 const SOLE=['#efece2','#d8c9a6','#3a3f44'];
 const TOTE=['#cfc3a6','#b8b0a2','#8e9a86','#c4a98a'];
 // The trim is one shade off each cloth, so a pale hoodie still has a hem and a
 // pocket edge to read instead of being one flat slab.
 const shade=(p,T,hex,factor)=>p.material(new T.Color(hex).multiplyScalar(factor),.9);
 const slotOf=ordinal=>{
  const i=Math.max(0,Math.floor(ordinal)-1);
  return {top:TOPS[i%3],bottom:BOTTOMS[(i/3|0)%3],shoe:SHOES[(i/9|0)%3],bag:BAGS[(i/27|0)%3],
   phone:PHONES[(i+(i/9|0))%3],cap:i%7===3,lanyard:i%5===2,colour:i};
 };
 function create(T,{resident={},actor={}}={}){
  const rig=Kit.create(T,{resident,actor}),{p,proportion:size,colors}=rig,body=rig.torso,head=rig.head;
  const female=size.female,ordinal=colors.ordinal,slot=slotOf(ordinal),i=slot.colour;
  rig.hair((female?HAIR_F:HAIR_M)[i%6]);
  // The mannequin torso is bare skin, so every top replaces it outright rather
  // than covering it: the silhouette stays crisp and the budget keeps room for
  // the hood, the tote and the headphones, which are the three things this trade
  // is actually read by.
  rig.hide('torso');
  // Torso outlines are measured against the kit's own panel, which runs
  // 1.92 at the waist to 3.07 at the collar. Casual cloth is a little roomier at
  // the chest and drops a little lower at the hem than a shirt does.
  const W=female?.375:.415;
  const TORSO={hoodie:[[-W-.03,1.86],[W+.03,1.86],[W+.06,2.56],[W+.05,2.94],[.25,3.05],[-.25,3.05],[-W-.05,2.94],[-W-.06,2.56]],
   tee:[[-W,1.93],[W,1.93],[W+.04,2.56],[W+.01,2.95],[.23,3.06],[-.23,3.06],[-W-.01,2.95],[-W-.04,2.56]],
   'open-shirt':[[-W-.04,1.88],[W+.04,1.88],[W+.08,2.58],[W+.04,2.96],[.26,3.06],[-.26,3.06],[-W-.04,2.96],[-W-.08,2.58]]};
  if(slot.top==='hoodie'){
   const cloth=p.material(HOODIE_COLOUR[i%8],.9),trim=shade(p,T,HOODIE_COLOUR[i%8],.86);
   p.panel('hoodie-body',cloth,TORSO.hoodie,.4,body).position.z=-.2;
   p.block('hoodie-hem',trim,[0,1.955,0],[W*2+.16,.1,.47],body);
   // The hood is a real shell parented to the head rig, not a painted patch: a
   // hood down is a lump of cloth bunched behind the neck, a hood up is a second
   // skull with the face clear in the opening. A backwards cap needs the head
   // outline, so it claims the same ordinals and the hood stays bunched down.
   const hoodUp=!slot.cap&&i%2===0;
   if(hoodUp)p.shell('hood-shell',cloth,{columns:14,rows:5,centre:[0,3.62,-.05],radius:[.5,.53,.49],back:2.55,front:.92,parent:head});
   else{
    p.shell('hood-shell',cloth,{columns:12,rows:4,centre:[0,3.18,-.3],radius:[.36,.3,.27],back:2.3,front:1,parent:head});
   }
   for(const arm of rig.arms){
    const side=arm.side;
    // Long sleeves run to the wrist, so the forearms are cloth too.
    rig.wear(['sleeve-lower-'+side,'elbow-'+side],cloth);
   }
   rig.wear(['sleeve-upper-left','sleeve-upper-right','shoulder-left','shoulder-right'],cloth);
  }else if(slot.top==='tee'){
   const cloth=p.material(TEE_COLOUR[i%8],.86),trim=shade(p,T,TEE_COLOUR[i%8],.88);
   p.panel('tee-body',cloth,TORSO.tee,.38,body).position.z=-.19;
   // The plain tee keeps its short-sleeve cut and round neckline.
   p.ball('tee-neck',trim,[0,3.02,0],[.235,.09,.235],body,true);
   // A short sleeve stops at the elbow: the forearms stay bare skin, which is
   // exactly what tells a summer tee from a sweatshirt.
   for(const arm of rig.arms)rig.wear(['sleeve-upper-'+arm.side,'shoulder-'+arm.side,'elbow-'+arm.side],cloth);
  }else{
   const cloth=p.material(SHIRT_COLOUR[i%6],.84),trim=shade(p,T,SHIRT_COLOUR[i%6],.87);
   const inner=p.material(TEE_COLOUR[(i+3)%8],.86);
   p.panel('open-shirt-body',cloth,TORSO['open-shirt'],.4,body).position.z=-.2;
   // Shirt worn open: the inner tee shows down the centre and the two outer
   // panels are the open shirt itself, so the front reads as three layers of
   // cloth rather than one slab.
   p.panel('undershirt-panel',inner,[[-.27,1.98],[.27,1.98],[.27,2.9],[0,3.02],[-.27,2.9]],.03,body).position.z=.2;
   p.panel('open-shirt-front-left',cloth,[[-.42,1.95],[-.27,1.95],[-.27,2.94],[-.36,3.0]],.035,body).position.z=.222;
   p.panel('open-shirt-front-right',cloth,[[.27,1.95],[.42,1.95],[.36,3.0],[.27,2.94]],.035,body).position.z=.222;
   p.panel('open-shirt-collar-left',trim,[[-.03,3.1],[-.23,3.03],[-.12,2.86]],.032,body).position.z=.245;
   p.panel('open-shirt-collar-right',trim,[[.03,3.1],[.23,3.03],[.12,2.86]],.032,body).position.z=.245;
   for(const arm of rig.arms){
    const side=arm.side;
    rig.wear(['sleeve-lower-'+side,'elbow-'+side],cloth);
   }
   rig.wear(['sleeve-upper-left','sleeve-upper-right','shoulder-left','shoulder-right'],cloth);
  }
  if(slot.bottom==='denim'){
   const cloth=p.material(DENIM[i%5],.88),trim=shade(p,T,DENIM[i%5],.84);
   rig.wear(['pelvis','thigh-left','thigh-right','knee-left','knee-right','shin-left','shin-right'],cloth);
   p.block('denim-waist',trim,[0,1.945,0],[.7,.09,.44],body);
   // Denim stays on the shared leg meshes; its hem follows the shin rig.
   for(const leg of rig.legs)p.ball('denim-hem-'+leg.side,trim,[0,-.7,0],[.163,.09,.163],leg.lower,true);
  }else if(slot.bottom==='wide-denim'){
   const cloth=p.material(WIDE_DENIM[i%4],.89),trim=shade(p,T,WIDE_DENIM[i%4],.85);
   rig.wear(['pelvis','thigh-left','thigh-right','knee-left','knee-right','shin-left','shin-right'],cloth);
   p.block('wide-denim-waist',trim,[0,1.945,0],[.76,.1,.46],body);
   // Loose trousers are a flared block over each shin, not a recolour: the extra
   // width is the whole difference in silhouette and it is twelve triangles.
   for(const leg of rig.legs)p.block('wide-denim-hem-'+leg.side,cloth,[0,-.66,.012],[.35,.19,.31],leg.lower);
  }else{
   const cloth=p.material(JOGGER[i%5],.9),trim=shade(p,T,JOGGER[i%5],.86);
   rig.wear(['pelvis','thigh-left','thigh-right','knee-left','knee-right','shin-left','shin-right'],cloth);
   p.block('jogger-waist',trim,[0,1.945,0],[.68,.11,.44],body);
   // The gathered ankle sits on the foot rig, above the shoe, or it hangs in the
   // air the moment the shared walk cycle swings the shin.
   for(const leg of rig.legs)p.ball('jogger-ankle-'+leg.side,trim,[0,.1,0],[.158,.1,.158],leg.foot,true);
  }
  const shoeCloth=p.material(CANVAS[i%5],.9),soleMat=p.material(SOLE[i%3],.74);
  rig.wear(['shoe-left','shoe-right'],shoeCloth);
  rig.wear(['sole-left','sole-right'],soleMat);
  for(const leg of rig.legs){
   const side=leg.side;
   if(slot.shoe==='canvas-high')p.ball('canvas-collar-'+side,shoeCloth,[0,.13,-.01],[.15,.13,.16],leg.foot,true);
  }
  // The canvas tote is the object that separates this trade from every office
  // worker: a soft square shopper against a rigid long briefcase. It is a
  // trapezoid panel that narrows toward the bottom, because a canvas bag full of
  // books collapses in on itself -- a straight box would read as the same prop.
  if(slot.bag!=='none'){
   const cloth=p.material(TOTE[i%4],.94),trim=shade(p,T,TOTE[i%4],.84);
   const bag=new T.Group();bag.name='tote-bag';
   p.panel('tote-body',cloth,[[-.24,.23],[.24,.23],[.19,-.2],[-.19,-.2]],.13,bag);
   // The trapezoid alone carries the canvas taper.
   if(slot.bag==='shoulder'){
    // On the strap: the bag rests on the outer front hip, in front of the arm
    // rather than inside the armpit gap, and the strap crosses the chest from the
    // shoulder. Parented to the torso so the walk cycle still swings both arms.
    bag.position.set(-.66,1.82,.26);bag.rotation.set(.06,0,-.07);body.add(bag);
    p.curve('tote-strap',trim,[[-.3,3.05,.14],[-.35,3.12,.02],[-.52,2.62,.08],[-.63,2.24,.2],[-.66,2.04,.26]],.017,body);
   }else{
    // In the hand: the left arm is posed rather than animated, so the bag rides
    // the forearm at every frame instead of swinging through the hip. The bag
    // sits outboard of the thigh, whose outer edge is at x=0.34.
    const elbow=rig.poseArm('left',{shoulderZ:.07,elbowX:-.34}).elbow;
    bag.position.set(-.16,-.72,.03);bag.rotation.set(0,0,-.05);elbow.add(bag);
    p.curve('tote-handle',trim,[[-.2,.21,0],[-.13,.36,0],[0,.4,0],[.13,.36,0],[.2,.21,0]],.016,bag);
   }
  }
  if(slot.phone==='neck'){
   // Round the neck: one closed band plus the two cups resting on the
   // collarbones, which is how this group is actually worn on a warm day.
   const band=p.material(['#2c2f33','#3d4348','#5a6068'][i%3],.5),cup=shade(p,T,['#2c2f33','#3d4348','#5a6068'][i%3],.78);
   const ring=[];for(let k=0;k<6;k++){const a=k/6*Math.PI*2;ring.push([Math.cos(a)*.17,3.05+Math.sin(a)*.04,Math.sin(a)*.155]);}
   p.curve('headphone-band',band,ring,.019,body,true);
   for(const sign of[-1,1])p.ball('headphone-cup-'+(sign<0?'left':'right'),cup,[sign*.16,2.94,.11],[.075,.055,.05],body,true);
  }else if(slot.phone==='ear'){
   // On the head: an arc over the crown with the cups on the ears, parented to
   // the head rig so the whole set follows the head.
   const band=p.material(['#2c2f33','#3d4348','#5a6068'][(i+1)%3],.5),cup=shade(p,T,['#2c2f33','#3d4348','#5a6068'][(i+1)%3],.78);
   p.curve('headphone-arc',band,[[-.47,3.63,-.02],[-.34,3.96,-.05],[0,4.09,-.05],[.34,3.96,-.05],[.47,3.63,-.02]],.021,head);
   for(const sign of[-1,1])p.ball('headphone-earcup-'+(sign<0?'left':'right'),cup,[sign*.47,3.62,-.02],[.07,.085,.075],head,true);
  }
  if(slot.cap){
   // A snapback worn backwards. The crown is a squashed ball half sunk into the
   // skull and the brim sits at the back of the head, which is the only detail
   // that says which way round it is.
   const crown=p.material(SHIRT_COLOUR[(i+2)%6],.9),brimMat=shade(p,T,SHIRT_COLOUR[(i+2)%6],.82);
   p.ball('snapback-crown',crown,[0,3.94,-.02],[.47,.25,.44],head);
   p.block('snapback-band',brimMat,[0,3.87,-.02],[.9,.06,.83],head);
   p.ball('snapback-brim',brimMat,[0,3.83,-.36],[.42,.045,.27],head);
  }
  rig.update(0);
  return {object:rig.object,modelRef:MODEL_REF,variant:{gender:female?'F':'M',age:size.age,ordinal},update:seconds=>rig.update(seconds),dispose:()=>rig.dispose()};
 }
 return {create,MODEL_REF,MODEL_LABEL,MODEL_DESCRIPTION};
});
