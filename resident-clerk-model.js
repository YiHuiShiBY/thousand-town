/* Bank and office counter staff: 22 people, ages 23-55, 12 female and 10 male.
   This is the group most at risk of reading as the office staff next door, so the
   silhouette is deliberately built on the one shape that trade does not have: a
   three-piece suit, that is a white shirt under a SLEEVELESS waistcoat. Seen from
   the front the clerk stacks three colour blocks -- shirt collar, waistcoat, waist
   band -- where the office worker stacks collar, tie and belt under open arms.
   The stance is the second separator: a counter clerk stands planted behind a
   window, so BOTH arms are posed and crossed over a rigid form board, and neither
   arm walks any more. The office worker swings a hard briefcase from one free arm,
   and the school office clerk carries a soft folder from one posed arm, so the
   three card-carrying trades never meet in one pose.
   The pass is the third: a counter window badge lives in a rigid card sleeve dead
   centre of the chest, higher and wider than the office cord badge down on the left
   chest, and unlike the school lanyard it is not worn on a strap. Built on the
   shared resident kit so every role keeps the same proportions and walk cycle. */
(function(root,factory){
 const api=factory(root.CityResidentKit||(typeof module==='object'&&module.exports?require('./resident-character-kit.js'):null));
 root.CityClerkModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kit){
 'use strict';
 const MODEL_REF='clerk/v1';
 const MODEL_LABEL='银行办事员';
 const MODEL_DESCRIPTION='三件套马甲是本职业第一剪影：白衬衫外罩无袖马甲、胸前正中挂硬卡套工牌，双臂交叠夹一块单据板站在柜台后。';
 // Keep the original modulo for stable neckwear and bottom cuts.
 const NECK=['tie','bow','open'],CUT=['skirt','trouser'],SLOTS=NECK.length*CUT.length*2;
 const slotOf=ordinal=>{
  const i=(ordinal-1)%SLOTS;
  return {neck:NECK[i%3],cut:CUT[(i/3|0)%2]};
 };
 // Banking cloth: deep navy, ink green, wine red, slate and charcoal plum. Never a
 // uniform -- twenty-two people behind four windows have to stay separable.
 const VEST=['#26344a','#2a4038','#592f37','#3d4550','#383040','#2f3b46'];
 // The shirt is always the pale layer under the waistcoat, so the front stacks
 // three blocks rather than one.
 const SHIRT=['#f4f2ec','#edf0f3','#e6ebee','#f1ebdf'];
 const TROUSER=['#2b3440','#333c46','#2f3a3a','#3a3640','#39414b','#2e3a42','#363a40','#3c3a3f','#333d46'];
 const SKIRT=['#384050','#3c4a4a','#423a44','#46423c','#3a4450','#44404a','#3e4650','#404a46','#453e46'];
 const HAIR_F=['bob','bun','ponytail','crop','bob','bun','ponytail','crop','bob','bun','ponytail','crop'];
 const HAIR_M=['crop','ponytail','crop','bob','crop','ponytail','crop','bob','crop','ponytail','crop','bob'];
 // Hair slots run over the whole roster rather than the twelve clothing slots, so
 // two people who share a suit still do not share a head.
 const HAIR_SLOTS=Math.max(HAIR_F.length,HAIR_M.length);
 function create(T,{resident={},actor={}}={}){
  const rig=Kit.create(T,{resident,actor,stride:resident.gender==='F'&&slotOf(Kit.ordinalOf(resident.id)).cut==='skirt'?.16:1}),{p,proportion:size,colors}=rig;
  const female=size.female,ordinal=colors.ordinal,slot=slotOf(ordinal),body=rig.torso;
  const vest=p.material(VEST[(ordinal-1)%VEST.length],.84);

  const shirt=p.material(SHIRT[(ordinal-1)%SHIRT.length],.88);

  const bottom=p.material((female?SKIRT:TROUSER)[(ordinal-1)%9],.86);

  const loafer=p.material('#2b2f33',.6),soleMat=p.material('#1d2226',.7);
  const neckMat=p.material(['#5c2f3a','#2c4459','#6a5330','#3f4a3c','#5a3550'][(ordinal-1)%5],.8);
  // The board is a hard grey shell with a metal clip, not the office leather case
  // and not the school folder, so all three props read apart at a distance.
  const boardMat=p.material('#3b3f45',.7);
  const paper=p.material('#f2eee2',.9),clipMat=p.material('#b9b2a2',.35);
  const sleeveCard=p.material('#d7dbde',.34),card=p.material('#f6f3ea',.72);

  rig.hair((female?HAIR_F:HAIR_M)[(ordinal-1)%HAIR_SLOTS]);
  // The mannequin torso is bare skin, so the shirt replaces it outright rather than
  // covering it, and the waistcoat is a genuine second garment layer on top of
  // that. Two layers is the whole point of this trade's silhouette, so it costs
  // the triangles rather than being faked with a recolour.
  rig.hide('torso');
  const hw=female?.395:.435;
  p.panel('shirt',shirt,[[-hw,1.92],[hw,1.92],[hw+.05,2.56],[hw+.02,2.96],[.235,3.06],[-.235,3.06],[-hw-.02,2.96],[-hw-.05,2.56]],.38,body).position.z=-.19;
  for(const sign of[-1,1]){
   const side=sign<0?'left':'right';
   p.panel('shirt-collar-'+side,shirt,[[sign*.022,3.105],[sign*.212,3.045],[sign*.118,2.872]],.032,body).position.z=.252;
  }
  // The waistcoat: sleeveless, V-necked, open at the front, nipped at the waist and
  // cut short above the shirt hem. It is deliberately narrower than the shirt at
  // the shoulder -- an armhole seam, not a sleeve -- and its hem stops at 2.02 so
  // the shirt remains visible under it.
  const vw=female?.352:.382;
  p.panel('vest',vest,[[-vw,2.02],[vw,2.02],[vw+.022,2.5],[vw-.028,2.9],[vw*.55,3.0],[0,2.7],[-vw*.55,3.0],[-vw+.028,2.9],[-vw-.022,2.5]],.42,body).position.z=-.215;

  // Neckwear: a tie shows only in the V of the waistcoat, a bow tie sits on the
  // shirt collar, an open collar ships neither. Three different part lists, and
  // neither of them is the office necktie or the office scarf.
  if(slot.neck==='tie'){
   p.ball('vest-neck-tie-knot',neckMat,[0,3.03,.238],[.052,.055,.038],body,true);
   p.block('vest-neck-tie',neckMat,[0,2.9,.242],[.088,.3,.03],body);
   p.block('vest-neck-tie-blade',neckMat,[0,2.735,.244],[.125,.08,.032],body);
  }else if(slot.neck==='bow'){
   // Two wings, named apart, because a mesh name may not repeat and a bow tie is
   // one object with two halves.
   p.panel('vest-neck-bow-left',neckMat,[[-.105,3.03],[-.012,3.07],[-.012,2.99]],.034,body).position.z=.25;
   p.panel('vest-neck-bow-right',neckMat,[[.105,3.03],[.012,3.07],[.012,2.99]],.034,body).position.z=.25;
   p.ball('vest-neck-bow-knot',neckMat,[0,3.03,.272],[.036,.04,.026],body,true);
  }
  // Window pass: a rigid card sleeve dead centre of the chest, hung high off a
  // original chest anchor. No lanyard, so it cannot be mistaken for the school badge,
  // and the sleeve is wider than the card behind it so the holder itself reads.
  p.block('badge-holder-sleeve',sleeveCard,[0,2.685,.29],[.348,.44,.036],body);
  p.block('badge-card',card,[0,2.68,.308],[.3,.38,.022],body);
  // Stance: both arms posed and crossed over the chest, which is what a counter
  // clerk looks like between customers. The board rides the posed LEFT forearm,
  // so the walk cycle still swings the legs while the board stays put. Nothing is
  // tucked into the armpit: a relaxed arm leaves about 0.165 units there and a
  // board dropped in would simply vanish inside the sleeve.
  const arm=rig.poseArm('left',{shoulderX:-.3,shoulderZ:.34,elbowX:-1.42,elbowZ:.3});
  rig.poseArm('right',{shoulderX:-.24,shoulderZ:-.26,elbowX:-1.3,elbowZ:-.34});
  const hold=new T.Group();hold.name='form-hold';
  // The counter rotation about X is not decoration: the crossed pose leaves the
  // forearm turned about 130 degrees, so without it the board lies almost flat
  // across the chest and reads as a tray instead of a clipboard.
  hold.position.set(.08,-.5,.04);hold.rotation.set(-1.1,.08,.3);arm.elbow.add(hold);
  // A hard board, a clip across the top, and a stack of forms whose top sheet
  // stands proud of the board edge: two layers, so it never reads as one slab.
  p.block('form-board',boardMat,[0,0,0],[.44,.6,.036],hold);
  p.block('form-clip',clipMat,[0,.268,.03],[.15,.07,.05],hold);
  p.block('form-sheets',paper,[0,.04,-.026],[.392,.53,.024],hold);
  if(female&&slot.cut==='skirt'){
   // Pencil skirt, straight rather than flared: the window staff uniform cut, and
   // deliberately narrower than the office A-line so the two do not merge.
   const hemY=1.24,flare=.35;
   p.panel('counter-skirt',bottom,[[-.35,1.95],[.35,1.95],[flare,hemY],[-flare,hemY]],.4,body).position.z=-.2;

   rig.wear(['pelvis'],bottom);
  }else{
   // Suit trousers are a material swap on the mannequin legs, not a second layer:
   // a few hundred triangles would buy no silhouette.
   rig.wear(['pelvis','thigh-left','thigh-right','knee-left','knee-right','shin-left','shin-right'],bottom);

  }
  rig.wear(['shoe-left','shoe-right'],loafer);
  rig.wear(['sole-left','sole-right'],soleMat);
  // Sleeves belong to the SHIRT, because the waistcoat has no sleeves at all: this
  // is the only correct answer, and it is why the sleeve material has to be
  // asserted equal to the shirt rather than merely different from skin.
  rig.wear(['sleeve-upper-left','sleeve-upper-right','sleeve-lower-left','sleeve-lower-right','shoulder-left','shoulder-right','elbow-left','elbow-right'],shirt);
  rig.update(0);
  return {object:rig.object,modelRef:MODEL_REF,variant:{gender:female?'F':'M',age:size.age,ordinal},update:seconds=>rig.update(seconds),dispose:()=>rig.dispose()};
 }
 return {create,MODEL_REF,MODEL_LABEL,MODEL_DESCRIPTION};
});
