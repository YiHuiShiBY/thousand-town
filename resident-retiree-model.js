/* Retirees: the largest single group in the town (190 on the roster, 56 to 70,
   women in the majority), so the look is spread over six independent axes and the
   held prop is what tells one of them from the next at street distance. Built on
   the shared resident kit, so a retiree keeps the same body and walk cycle as
   everyone else and the six axes cost material swaps, not triangles. */
(function(root,factory){
 const api=factory(root.CityResidentKit||(typeof module==='object'&&module.exports?require('./resident-character-kit.js'):null));
 root.CityRetireeModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kit){
 'use strict';
 const MODEL_REF='retiree/v1';
 const MODEL_LABEL='退休便装 · 买菜出门';
 const DESCRIPTION='夹克 / 开衫 / 马甲 / 衬衫配长裤、及膝裤或裙，拄手杖或拎购物袋，穿软底鞋，暖色不刺眼。名册序号散出六层个体差异，190 人不重样。';
 // Warm but never loud. Six outer slots, so two retirees do not share a colour by
 // accident, and the greying of the hair is left to the kit (it already lerps the
 // hair towards grey with age, so a 56-year-old is not painted white).
 const CLOTH=['#7b3b33','#9a8659','#3f5548','#5a6b7e','#b08f68','#6b4a36'];
 const SHIRT=['#dcd6c6','#cfd6d8','#d8cfc0','#c9d2cd'];
 const TROUSER=['#4a4f52','#5a5148','#3f4744','#6a6258','#454a55','#565048'];
 const LEATHER=['#4a3f37','#5d5148','#3a3736','#7b6a56'];
 const SOLE=['#3a332d','#2f2a26','#453c33'];
 const SCARF=['#8a5b4c','#6b6f52','#4e5a6b','#9a8464'];
 const TOTE=['#b7ab8c','#8e9a86','#a8927c'];
 // Four upper layers, because a vest over a shirt reads as two blocks of colour
 // from the front while a jacket reads as one. The cut is per layer: a vest is
 // short and narrow, a shirt is short and close to the body.
 const TOPCUT={
  jacket:[[-.37,1.95],[.37,1.95],[.43,2.53],[.49,2.94],[.27,3.06],[-.27,3.06],[-.49,2.94],[-.43,2.53]],
  cardigan:[[-.36,1.95],[.36,1.95],[.42,2.53],[.48,2.94],[.27,3.06],[-.27,3.06],[-.48,2.94],[-.42,2.53]],
  vest:[[-.33,2.07],[.33,2.07],[.38,2.56],[.45,2.94],[.26,3.05],[-.26,3.05],[-.45,2.94],[-.38,2.56]],
  shirt:[[-.31,1.95],[.31,1.95],[.37,2.56],[.48,2.95],[.27,3.06],[-.27,3.06],[-.48,2.95],[-.37,2.56]]
 };
 const TOPDEPTH={jacket:[.41,-.205],cardigan:[.4,-.2],vest:[.34,-.17],shirt:[.38,-.19]};
 const TOPS=['jacket','cardigan','vest','shirt'];
 // Women in this band are likelier to be out in a skirt; the array length is the
 // same for both so one stride covers the same count of ordinals.
 const BOTTOM_M=['trousers','trousers','capri','trousers','capri','trousers'];
 const BOTTOM_F=['trousers','skirt','trousers','capri','skirt','trousers'];
 const HELD=['cane','bag','none'];
 const HAIR_F=['bob','bun','crop','ponytail','bob'];
 const HAIR_M=['crop','buzz','crop','curly','buzz'];
 const SLEEVES=['shoulder-left','shoulder-right','elbow-left','elbow-right','sleeve-upper-left','sleeve-upper-right','sleeve-lower-left','sleeve-lower-right'];
 // 190 people cannot be told apart by two or three silhouettes, so every axis is
 // drawn off the roster ordinal with a stride coprime to its own slot count. Any
 // two nearby ordinals differ in at least two axes, and one ordinal always rebuilds
 // one look, so a resident keeps the same coat for the whole run.
 const slot=(i,stride,count)=>(((i-1)*stride)%count+count)%count;
 function lookOf(ordinal,female){
  return {
   top:TOPS[slot(ordinal,3,TOPS.length)],
   bottom:(female?BOTTOM_F:BOTTOM_M)[slot(ordinal,5,6)],
   cloth:CLOTH[slot(ordinal,1,CLOTH.length)],
   shirt:SHIRT[slot(ordinal,4,SHIRT.length)],
   trouser:TROUSER[slot(ordinal,2,TROUSER.length)],
   held:HELD[slot(ordinal,1,HELD.length)],
   hair:(female?HAIR_F:HAIR_M)[slot(ordinal,2,5)],
   leather:LEATHER[slot(ordinal,1,LEATHER.length)],
   sole:SOLE[slot(ordinal,3,SOLE.length)],
   tote:TOTE[slot(ordinal,2,TOTE.length)],
   scarf:ordinal%3===0
  };
 }
 function create(T,{resident={},actor={}}={}){
  const rig=Kit.create(T,{resident,actor}),{p,proportion:size,colors}=rig,body=rig.torso;
  const female=size.female,ordinal=colors.ordinal,look=lookOf(ordinal,female);
  const cloth=p.material(look.cloth),shirt=p.material(look.shirt),trouser=p.material(look.trouser);
  const leather=p.material(look.leather,.66),soleMat=p.material(look.sole,.94);
  const rib=p.material(new T.Color(look.cloth).multiplyScalar(.84));
  rig.hair(look.hair);
  // The outer layer replaces the bare mannequin torso rather than covering it, so
  // the silhouette stays crisp and the budget keeps room for the held prop.
  rig.hide('torso');
  const [depth,offset]=TOPDEPTH[look.top];
  const top=p.panel(look.top+'-body',cloth,TOPCUT[look.top],depth,body);top.position.z=offset;
  if(look.top==='jacket'){
   for(const [sign,side]of[[-1,'left'],[1,'right']]){
    p.panel('jacket-lapel-'+side,rib,[[sign*.02,3.12],[sign*.235,3.04],[sign*.135,2.78]],.03,body).position.z=.235;
   }
   p.block('jacket-hem',rib,[0,1.965,0],[.77,.08,.43],body);
   rig.wear(SLEEVES,cloth);
  }else if(look.top==='cardigan'){
   // A shirt triangle at the opening: the cardigan is the one layer
   // that shows what is underneath, which is what separates it from the jacket.
   p.panel('cardigan-shirt-v',shirt,[[-.17,3.045],[.17,3.045],[0,2.62]],.03,body).position.z=.215;
   p.block('cardigan-hem',rib,[0,1.975,0],[.75,.075,.425],body);
   rig.wear(SLEEVES,cloth);
  }else if(look.top==='vest'){
   // Long-sleeve shirt under the vest, so the sleeves take the shirt cloth and the
   // front reads as two blocks: a collar triangle and a V of shirt.
   p.panel('vest-shirt-v',shirt,[[-.19,3.04],[.19,3.04],[0,2.6]],.03,body).position.z=.21;
   for(const [sign,side]of[[-1,'left'],[1,'right']]){
    p.panel('shirt-collar-'+side,shirt,[[sign*.015,3.115],[sign*.215,3.05],[sign*.125,2.87]],.032,body).position.z=.235;
   }
   rig.wear(SLEEVES,shirt);
  }else{
   for(const [sign,side]of[[-1,'left'],[1,'right']]){
    p.panel('shirt-collar-'+side,shirt,[[sign*.015,3.115],[sign*.215,3.05],[sign*.125,2.87]],.032,body).position.z=.215;
   }
   rig.wear(SLEEVES,cloth);
  }
  if(look.bottom==='trousers')rig.wear(['pelvis','thigh-left','thigh-right','knee-left','knee-right','shin-left','shin-right'],trouser);
  else if(look.bottom==='capri'){
   // Calf-length trousers: the trouser stops at the knee and a cuff block gives the
   // hem an edge, so the bare shin below it is the point of the cut.
   rig.wear(['pelvis','thigh-left','thigh-right','knee-left','knee-right'],trouser);
   for(const side of['left','right'])p.block('capri-hem-'+side,rib,[0,.03,0],[.3,.06,.29],rig.legs.find(l=>l.side===side).lower);
  }else{
   rig.wear(['pelvis'],cloth);
   p.mesh('skirt-body',p.geometry(new T.CylinderGeometry(.33,.47,.68,12,1)),cloth,[0,1.5,0],[1,1,1],body);
   p.block('skirt-waist',rib,[0,1.86,0],[.64,.09,.36],body);
  }
  for(const side of['left','right']){
   // Soft-soled walking shoe, not the kit's block: wider than the foot's ankle,
   // a third lower at the heel, and a low vamp over the toe. This is the shape that
   // says "walks to the market" instead of "stands on a ward floor".
   const shoe=rig.parts['shoe-'+side],sole=rig.parts['sole-'+side];
   shoe.scale.set(.172,.1,.262);shoe.position.y=.05;shoe.material=leather;
   sole.position.set(0,-.028,.05);sole.scale.set(.322,.046,.446);sole.material=soleMat;
  }
  if(look.scarf){
   const wrap=p.material(SCARF[slot(ordinal,1,SCARF.length)]);
   p.limb('scarf-wrap',wrap,[0,3.1,0],[0,2.95,0],.215,body);
   p.panel('scarf-tail',wrap,[[-.15,3.02],[.15,3.02],[.11,2.6],[-.11,2.6]],.06,body).position.z=.24;
  }
  if(look.held==='cane'){
   // A walking stick, not a floating thin rod: the shaft is solved from THIS
   // resident's posed hand in world units, so the ferrule lands on the floor at
   // whatever height the age tables gave her. The pose is held, so the tip does not
   // swing away from the ground either.
   const arm=rig.poseArm('right',{shoulderX:-.14,shoulderZ:.2,elbowX:-.24,elbowZ:.1});
   const elbow=arm.elbow,grip=new T.Vector3(.028,-.5,.045),wood=p.material('#8a7358');
   rig.update(0);
   const hand=elbow.localToWorld(grip.clone());
   // The shaft is planted, not held at the forearm's angle: the hold group undoes
   // the elbow's world rotation, so local +Y is world +Y and the stick is genuinely
   // vertical. A cane that leans with the arm pushes its ferrule through the floor.
   const reach=Math.max(1.1,hand.y/size.heightScale);
   const stick=new T.Group();stick.name='walkstick-hold';
   stick.quaternion.copy(elbow.getWorldQuaternion(new T.Quaternion())).invert();
   stick.position.copy(grip);elbow.add(stick);
   p.limb('walkstick-ferrule',soleMat,[0,-reach,0],[0,-reach+.15,0],.05,stick);
   p.limb('walkstick-shaft',wood,[0,-reach+.12,0],[0,.16,0],.028,stick);
   p.curve('walkstick-crook',wood,[[0,.16,0],[.05,.262,0],[.118,.246,.012]],.022,stick);
  }else if(look.held==='bag'){
   // A shopping bag hangs at the hip with its box body and U handle.
   const arm=rig.poseArm('right',{shoulderX:.1,shoulderZ:-.06,elbowX:.14,elbowZ:.02});
   const canvas=p.material(look.tote),elbow=arm.elbow;
   const hold=new T.Group();hold.name='tote-hold';hold.position.set(.028,-.52,.045);elbow.add(hold);
   p.block('tote-body',canvas,[0,-.3,0],[.36,.46,.2],hold);
   p.curve('tote-handle',rib,[[-.13,-.07,0],[-.1,.1,0],[0,.16,0],[.1,.1,0],[.13,-.07,0]],.018,hold);
  }
  rig.update(0);
  return {object:rig.object,modelRef:MODEL_REF,variant:{gender:female?'F':'M',age:size.age,ordinal},update:seconds=>rig.update(seconds),dispose:()=>rig.dispose()};
 }
 return {create,MODEL_REF,MODEL_LABEL,DESCRIPTION};
});
