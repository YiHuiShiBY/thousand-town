/* Town office staff: 150 people, the second largest group in the census, so the
   read has to survive a whole floor of near-identical outfits. The briefcase is
   the silhouette that does it -- a closed case pinned under the arm, or a
   briefcase in a carried hand -- and the shirt, the skirt, the neckwear and the
   card all hang off the resident ordinal rather than off the trade, because 150
   people in one uniform would render as one repeated column. Built on the shared
   resident kit so every role keeps the same proportions and the same walk cycle.
   The office badge is deliberately smaller, lower and further left than the
   school office lanyard badge, and the lanyard itself is absent, so the two
   white-collar trades never meet in the same silhouette. */
(function(root,factory){
 const api=factory(root.CityResidentKit||(typeof module==='object'&&module.exports?require('./resident-character-kit.js'):null));
 root.CityOfficeModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kit){
 'use strict';
 const MODEL_REF='office/v1';
 const MODEL_LABEL='写字楼职员';
 const MODEL_DESCRIPTION='职员靠腋下或手提的公文包认人，配浅色衬衫、领带或细丝巾；女性及膝直筒／A 字裙、男性西裤，胸前保留素色小工牌。';
 // Original ordinal slots keep neckwear, carry mode and skirt flare stable.
 const NECKWEAR=['tie','scarf','open'],CARRY=['underarm','hand','none'];
 const SLOTS=NECKWEAR.length*CARRY.length*2;
 const slotOf=ordinal=>{
  const i=(ordinal-1)%SLOTS;
  return {neck:NECKWEAR[i%3],carry:CARRY[(i/3|0)%3],creased:i>=9};
 };
 // Six light office shirtings. Never a uniform: these are the clothes people
 // actually turn up in, so the floor keeps six tones instead of one.
 const SHIRT=['#dfe6ee','#f0ece1','#d7e3e6','#e7dde8','#e2e8dd','#cfd9e8','#eee6dc'];
 // Eleven bottom cloths, five cuts of suit trouser and six of skirt wool. The two
 // lists are separate because a skirt and a trouser of the same nominal colour do
 // not read the same from ten metres away.
 const TROUSER=['#2f3a45','#39414c','#333c48','#2c3740','#414049','#3b4640','#2a343e','#44423f','#37424e','#3e3b40','#313a44'];
 const SKIRT=['#3c4350','#4a4550','#3a4a4e','#4d463f','#414b56','#50484a','#3b444f','#4b4a42','#44505c','#4c4550','#37424a'];
 // Six hair slots per gender, so two staff who share a cut still share nothing else.
 const HAIR_F=['bob','ponytail','bun','long','curly','bob'],HAIR_M=['buzz','crop','curly','buzz','crop','curly'];
 const LEATHER=['#4a382c','#3a3038','#53433a','#2f3a3e','#5a4a3c'];
 function create(T,{resident={},actor={}}={}){
  const rig=Kit.create(T,{resident,actor,stride:resident.gender==='F'?.16:1}),{p,proportion:size,colors}=rig;
  const female=size.female,ordinal=colors.ordinal,slot=slotOf(ordinal),body=rig.torso;
  const shirt=p.material(SHIRT[(ordinal-1)%SHIRT.length],.86);

  const bottom=p.material((female?SKIRT:TROUSER)[(ordinal-1)%11],.87);

  const loafer=p.material('#2f3236',.62),soleMat=p.material('#20262a',.72);
  const neckMat=p.material(['#5a3550','#2f4a63','#6b4a2e','#3f4a3c','#6d3540'][(ordinal-1)%5],.8);
  const leather=p.material(LEATHER[(ordinal-1)%LEATHER.length],.58);
  const card=p.material('#f4f1e8',.7);
  rig.hair((female?HAIR_F:HAIR_M)[(ordinal-1)%6]);
  // The mannequin torso is bare skin, so the shirt replaces it outright rather
  // than covering it: the silhouette stays crisp and the budget keeps room for
  // the case, which is the only prop this trade is read by.
  rig.hide('torso');
  const hw=female?.395:.435;
  p.panel('shirt',shirt,[[-hw,1.94],[hw,1.94],[hw+.05,2.56],[hw+.02,2.96],[.235,3.06],[-.235,3.06],[-hw-.02,2.96],[-hw-.05,2.56]],.38,body).position.z=-.19;
  for(const sign of[-1,1]){
   const side=sign<0?'left':'right';
   p.panel('shirt-collar-'+side,shirt,[[sign*.022,3.105],[sign*.212,3.045],[sign*.118,2.872]],.032,body).position.z=.252;
  }
  // Neckwear: a tie is a blade, a knot and a wider tip; a scarf is a throat
  // panel and a knot; an open collar ships neither, so the three are three
  // different part lists rather than one tie in three colours.
  if(slot.neck==='tie'){
   p.block('necktie',neckMat,[0,2.86,.238],[.082,.4,.03],body);
   p.block('necktie-blade',neckMat,[0,2.625,.24],[.128,.095,.032],body);
   p.ball('necktie-knot',neckMat,[0,3.032,.238],[.05,.052,.036],body,true);
  }else if(slot.neck==='scarf'){
   p.panel('neck-scarf',neckMat,[[-.105,2.99],[.105,2.99],[.072,2.795],[0,2.72],[-.072,2.795]],.045,body).position.z=.228;
   p.ball('scarf-knot',neckMat,[0,2.775,.28],[.052,.052,.038],body,true);
  }
  // A blank left-chest pass keeps the original size and position.
  p.block('badge-id-card',card,[-.212,2.325,.258],[.115,.145,.018],body);
  // The case is the trade. Both kinds are real geometry -- a closed box with a
  // top handle -- and they are named apart because they are
  // two different objects carried in two different ways.
  if(slot.carry!=='none'){
   const hold=new T.Group();hold.name='briefcase-hold';
   if(slot.carry==='underarm'){
    // Pinned under the left arm. The box is thin (about 6 cm) and sits on the
    // OUTER face of the hanging arm, not in the armpit gap: a relaxed arm leaves
    // no room there, so a case tucked into the gap would simply vanish inside
    // the sleeve. The tilt swings the bottom clear of the forearm, which is what
    // leaves the case readable; the bent forearm supports its outer lower corner.
    const shoulder=rig.poseArm('left',{elbowZ:-.55}).shoulder;
    hold.position.set(-.19,-.435,.04);hold.rotation.z=-.09;shoulder.add(hold);
    p.block('briefcase-slim',leather,[0,-.31,0],[.16,.64,.72],hold);
    p.block('briefcase-slim-handle',rig.dark,[0,.045,0],[.05,.07,.3],hold);
   }else{
    // Carried in the hand: the left arm is posed rather than animated, so the
    // case rides the forearm at every frame instead of swinging through it.
    const elbow=rig.poseArm('left',{shoulderZ:-.16,elbowX:-.34,elbowZ:.1}).elbow;
    hold.position.set(-.028,-.52,.045);hold.rotation.z=.05;elbow.add(hold);
    p.block('briefcase',leather,[0,-.35,0],[.19,.6,.74],hold);
    p.block('briefcase-handle',rig.dark,[0,.04,0],[.05,.09,.3],hold);
   }
  }
  if(female){
   // Knee-length straight or A-line skirt. The hem is the strongest shape
   // difference this roster has, so it is cut to stop just above the knee and
   // the clothed pelvis closes the top of the legs.
   const hemY=1.26,flare=slot.creased?.42:.36;
   p.panel('skirt',bottom,[[-.35,1.95],[.35,1.95],[flare,hemY],[-flare,hemY]],.4,body).position.z=-.2;

   rig.wear(['pelvis'],bottom);
  }else{
   // Suit trousers are a material swap on the mannequin legs, not a second
   // garment layer: a hundred extra triangles would buy no silhouette.
   rig.wear(['pelvis','thigh-left','thigh-right','knee-left','knee-right','shin-left','shin-right'],bottom);

  }
  rig.wear(['shoe-left','shoe-right'],loafer);
  rig.wear(['sole-left','sole-right'],soleMat);
  // Sleeves, shoulders and elbows are recoloured rather than rebuilt: a shirt
  // over bare arms is the way this figure would give itself away, and the
  // sleeves are their own meshes, so the torso change alone leaves them skin.
  rig.wear(['sleeve-upper-left','sleeve-upper-right','sleeve-lower-left','sleeve-lower-right','shoulder-left','shoulder-right','elbow-left','elbow-right'],shirt);
  rig.update(0);
  return {object:rig.object,modelRef:MODEL_REF,variant:{gender:female?'F':'M',age:size.age,ordinal},update:seconds=>rig.update(seconds),dispose:()=>rig.dispose()};
 }
 return {create,MODEL_REF,MODEL_LABEL,MODEL_DESCRIPTION};
});
