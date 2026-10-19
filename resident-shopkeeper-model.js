/* Shopkeepers: sixty owners of the mall, annex-mall and night-market stalls.
   The apron is the trade. It is the only cloth in town that hangs from below the
   chest to just above the knee, it is a trapezoid because a shop apron widens
   toward the hem, and its colour IS the shop's identity, so five apron colours
   have to be told apart across the street. Sleeve cuffs over the forearms are the
   second tell and cost almost nothing. The everyday top underneath is a shirt, a
   tee or a striped tee, and the hand carries a small paper bag, a calculator, or a jacket dropped over the arm crook: a counter stance, which is what
   separates this group from the retirees, who stand straight with a cane or a
   shopping bag at the hip and wear no apron at all. */
(function(root,factory){
 const api=factory(root.CityResidentKit||(typeof module==='object'&&module.exports?require('./resident-character-kit.js'):null));
 root.CityShopkeeperModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kit){
 'use strict';
 const MODEL_REF='shopkeeper/v1';
 const MODEL_LABEL='围裙店主 · 站柜台';
 const DESCRIPTION='梯形围裙是全场唯一从胸下垂到膝上的一大块面料，颜色即店铺身份：深藏青 / 墨绿 / 酒红 / 炭灰 / 棕褐五色，配白衬衫、圆领 T 恤或条纹衫，小臂上一副浅色袖套。手里拎小纸袋、托计算器找零，或把外套搭在臂弯，是站柜台的姿态。';
 // Apron colour and its hem band are paired, because the band is a second piece of
 // the same shop identity and a random pairing would put a wine-red band on a
 // navy apron. The band is the lighter, greyer read of the same hue.
 const APRON=[
  {cloth:'#2c3550',band:'#93a0b8'},// deep navy
  {cloth:'#2f4a3c',band:'#9db39f'},// ink green
  {cloth:'#6a2f36',band:'#c69a95'},// wine red
  {cloth:'#3a3d42',band:'#a9adb2'},// charcoal
  {cloth:'#5a4636',band:'#c2a98c'} // tobacco brown
 ];
 // Three everyday tops under the apron, three shades each, flattened into ONE
 // nine-slot axis. Flattening is deliberate: a kind axis and a shade axis would
 // both have period 3, so on a sixty-person roster the prop cycle and the shirt
 // would stay locked together and every top would arrive with the same hand prop.
 // Nine is coprime with 2, 4 and 5, so the shirt can land on any combination.
 // Each shade has its own name, and the name goes on the mesh, because sixty
 // neighbours differ mostly above the bib and a test can only prove two of them
 // are not the same column from a name it can read.
 const TOPS=[
  {kind:'shirt',shade:'ivory',hex:'#e7e2d4'},
  {kind:'shirt',shade:'slate',hex:'#c3ccd2'},
  {kind:'shirt',shade:'sage',hex:'#b9c3ae'},
  {kind:'tee',shade:'cream',hex:'#d9d2c2'},
  {kind:'tee',shade:'chalk',hex:'#e2ded2'},
  {kind:'tee',shade:'stone',hex:'#b6b3aa'},
  {kind:'stripe',shade:'navy',hex:'#3d4a63'},
  {kind:'stripe',shade:'rust',hex:'#8a4f3c'},
  {kind:'stripe',shade:'moss',hex:'#4d5a41'}
 ];
 const TROUSER=['#3f444a','#454a44','#3a3f47','#4a463f'];
 const SOLE=['#2e3336','#33383a','#2b3032'];
 const CUFF='#dcd5c2';
 const KRAFT=['#c3a880','#cbb896','#bfa47e'];
 const COAT=['#3d434a','#4b4238','#3f4a44','#4d3f3f'];
 const HAIR_F=['bob','bun','ponytail','bob','bun'];
 const HAIR_M=['crop','buzz','curly','crop','buzz'];
 const PROPS=['bag','calc','coat'];
 // Every upper-layer mesh the shared mannequin owns. Recolouring them costs no
 // triangles, and leaving any of them in skin colour is the classic way a clothed
 // low-poly figure gives itself away, because the sleeves are their own meshes.
 const SLEEVES=['shoulder-left','shoulder-right','elbow-left','elbow-right','sleeve-upper-left','sleeve-upper-right','sleeve-lower-left','sleeve-lower-right'];
 // The apron is one trapezoid, measured in the rig's own frame: the bib is narrow
 // at the chest and the hem is nearly three times as wide. Chest front sits at
 // z=0.235 and the knee at y=1.02, so the hem stops above the knee and below the
 // waist, which is where a shop apron actually ends.
 const BIB_TOP=2.52,BIB_HEM=1.38,BIB_TOP_HALF=.17,BIB_HEM_HALF=.5;
 const bibHalf=y=>BIB_TOP_HALF+(BIB_HEM_HALF-BIB_TOP_HALF)*((BIB_TOP-y)/(BIB_TOP-BIB_HEM));
 // Strides are chosen so that no two axes stay locked together over the sixty
 // ordinals: shirt kind and apron colour differ, cuffs alternate against the prop
 // cycle, and the hair is a different permutation of five.
 const slot=(i,stride,count)=>(((i-1)*stride)%count+count)%count;
 function lookOf(ordinal,female){
  const top=TOPS[slot(ordinal,4,TOPS.length)];
  return {
   top,apron:APRON[slot(ordinal,2,APRON.length)],
   cuffs:slot(ordinal,1,2)===0,prop:PROPS[slot(ordinal,2,PROPS.length)],
   trouser:TROUSER[slot(ordinal,3,TROUSER.length)],sole:SOLE[slot(ordinal,2,SOLE.length)],
   hair:(female?HAIR_F:HAIR_M)[slot(ordinal,3,5)],
   kraft:KRAFT[slot(ordinal,3,KRAFT.length)],coat:COAT[slot(ordinal,1,COAT.length)]
  };
 }
 function create(T,{resident={},actor={}}={}){
  // The full jogging cycle otherwise drives the thigh through the apron hem.
  const rig=Kit.create(T,{resident,actor,stride:.5}),{p,proportion:size,colors}=rig,body=rig.torso;
  const female=size.female,ordinal=colors.ordinal,look=lookOf(ordinal,female);
  const cloth=p.material(look.apron.cloth),band=p.material(look.apron.band);
  const topMat=p.material(look.top.hex),cuffMat=p.material(CUFF,.92);
  const trouser=p.material(look.trouser),soleMat=p.material(look.sole,.9);
  const light=look.top.kind==='stripe'?p.material('#e6e0cf',.6):null,dark=p.material('#33383a',.55);
  rig.hair(look.hair);
  // The everyday top replaces the bare mannequin torso rather than covering it, so
  // the silhouette stays crisp and the budget keeps room for the apron and the prop.
  rig.hide('torso');
  const shirt=p.panel('apron-shirt-'+look.top.shade,topMat,[[-.33,1.94],[.33,1.94],[.39,2.55],[.47,2.94],[.26,3.06],[-.26,3.06],[-.47,2.94],[-.39,2.55]],.4,body);shirt.position.z=-.2;
  rig.wear(SLEEVES,topMat);
  if(look.top.kind==='shirt'){
   // A shirt is told by its collar, which sits ABOVE the bib,
   // because the apron covers everything from the chest down.
   for(const [sign,side]of[[-1,'left'],[1,'right']])
    p.panel('apron-collar-'+side,topMat,[[sign*.015,3.115],[sign*.22,3.05],[sign*.125,2.87]],.032,body).position.z=.243;
  }else if(look.top.kind==='tee'){
   p.mesh('apron-neckband',p.geometry(new T.CylinderGeometry(.185,.2,.095,6,1)),topMat,[0,3.055,0],[1,1,1],body);
  }else{
   // A striped tee keeps its stripes above the bib, so
   // only the two visible chest bands are built.
   p.mesh('apron-neckband',p.geometry(new T.CylinderGeometry(.185,.2,.095,6,1)),topMat,[0,3.055,0],[1,1,1],body);
   p.panel('apron-stripe-chest-upper',light,[[-.44,2.87],[.44,2.87],[.43,2.94],[-.43,2.94]],.018,body).position.z=.245;
   p.panel('apron-stripe-chest-lower',light,[[-.42,2.66],[.42,2.66],[.41,2.73],[-.41,2.73]],.018,body).position.z=.245;
  }
  // The apron keeps one trapezoid, a hem band and two neck straps.
  // The straps cross at the chest and pass in front of the collar,
  // which is the only way a neck strap reads without a second garment behind it.
  const bib=p.panel('apron-bib',cloth,[[-BIB_TOP_HALF,BIB_TOP],[BIB_TOP_HALF,BIB_TOP],[BIB_HEM_HALF,BIB_HEM],[-BIB_HEM_HALF,BIB_HEM]],.05,body);bib.position.z=.21;
  const bandTop=1.64,bandHem=1.5;
  p.panel('apron-hem-band',band,[[-bibHalf(bandHem)-.006,bandHem],[bibHalf(bandHem)+.006,bandHem],[bibHalf(bandTop)+.006,bandTop],[-bibHalf(bandTop)-.006,bandTop]],.05,body).position.z=.225;
  p.curve('apron-neck-strap-left',cloth,[[-.17,2.52,.255],[-.24,2.78,.255],[-.2,3.04,.25],[-.1,3.14,.19],[.05,3.17,.08],[.15,3.14,-.04]],.017,body);
  p.curve('apron-neck-strap-right',cloth,[[.17,2.52,.255],[.24,2.78,.255],[.2,3.04,.25],[.1,3.14,.19],[-.05,3.17,.08],[-.15,3.14,-.04]],.017,body);
  // The sleeve cuff is a short tube over the forearm, concentric with the arm it
  // sleeves, and it follows the elbow so the arm pose carries it for free.
  if(look.cuffs)for(const [sign,side]of[[-1,'left'],[1,'right']]){
   const elbow=rig.arms.find(a=>a.side===side).elbow;
   p.limb('apron-cuff-'+side,cuffMat,[0,-.05,0],[sign*.012,-.31,.02],.128,elbow,true);
  }
  rig.wear(['pelvis','thigh-left','thigh-right','knee-left','knee-right','shin-left','shin-right'],trouser);
  rig.wear(['shoe-left','shoe-right'],dark);
  rig.wear(['sole-left','sole-right'],soleMat);
  if(look.prop==='bag'){
   // The bag is small, paper and carries its handle at the rim, and it hangs from
   // the hand rather than resting at the hip: the retiree tote is canvas, bigger
   // in every direction, and slung from an unposed arm.
   const arm=rig.poseArm('right',{shoulderX:-.24,shoulderZ:-.12,elbowX:-.72,elbowZ:.08});
   const hold=new T.Group();hold.name='paper-bag-hold';hold.position.set(.028,-.5,.045);arm.elbow.add(hold);
   const kraft=p.material(look.kraft,.94);
   p.block('paper-bag-body',kraft,[0,-.17,0],[.26,.32,.15],hold);
   p.curve('paper-bag-handle',dark,[[-.085,0,0],[-.07,.085,0],[0,.115,0],[.07,.085,0],[.085,0,0]],.015,hold);
  }else if(look.prop==='calc'){
   // A calculator in the left palm and the other hand cupped for counting;
   // the original counter pose keeps both wrists stable.
   const caseMat=p.material('#3b4147',.5),screen=p.material('#9fb0a4',.35);
   const left=rig.poseArm('left',{shoulderX:-.16,shoulderZ:.1,elbowX:-1.42,elbowZ:-.1});
   rig.poseArm('right',{shoulderX:-.1,shoulderZ:-.07,elbowX:-1.02,elbowZ:.05});
   const palm=new T.Group();palm.name='calc-hold';palm.position.set(-.028,-.5,.045);left.elbow.add(palm);
   p.block('calc-body',caseMat,[0,.045,0],[.17,.05,.115],palm);
   p.block('calc-screen',screen,[0,.075,.024],[.13,.014,.05],palm);
  }else{
   // A jacket over the arm crook. The hold group undoes the elbow's world rotation,
   // so the coat hangs straight down in world units instead of sticking out along
   // the bent forearm, and because the pose is held it does not swing in the walk.
   const arm=rig.poseArm('left',{shoulderX:-.1,shoulderZ:.13,elbowX:-1.44,elbowZ:-.12});
   rig.update(0);
   const hold=new T.Group();hold.name='coat-hold';
   hold.quaternion.copy(arm.elbow.getWorldQuaternion(new T.Quaternion())).invert();
   hold.position.set(-.011,-.22,.017);arm.elbow.add(hold);
   const coat=p.material(look.coat,.9);
   p.block('coat-body',coat,[0,-.43,0],[.3,.86,.16],hold);
   p.limb('coat-sleeve',coat,[.1,-.05,0],[.13,-.62,.02],.062,hold);
  }
  rig.update(0);
  return {object:rig.object,modelRef:MODEL_REF,variant:{gender:female?'F':'M',age:size.age,ordinal},update:seconds=>rig.update(seconds),dispose:()=>rig.dispose()};
 }
 return {create,MODEL_REF,MODEL_LABEL,DESCRIPTION};
});
