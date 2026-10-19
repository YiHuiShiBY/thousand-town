/* Town nurses: a folded or brimmed cap, a coloured scrub top over WHITE trousers,
   a contrast neckline, a clip-on badge card holder and a stethoscope worn round
   the neck. The cap plus the white bottoms are the read; the knee-length white
   coat, the open front and the chest-piece stethoscope are deliberately left to
   the doctor model, so the two trades never share a silhouette. Thirty nurses
   share six uniform slots, and the resident ordinal picks one, so the hospital
   ward does not render as one repeated column. Built on the shared resident kit
   so every role keeps the same proportions and the same walk cycle. */
(function(root,factory){
 const api=factory(root.CityResidentKit||(typeof module==='object'&&module.exports?require('./resident-character-kit.js'):null));
 root.CityMedicalNurseModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kit){
 'use strict';
 const MODEL_REF='medical-nurse/v1';
 const MODEL_LABEL='护士';
 const MODEL_DESCRIPTION='护士靠头顶那顶护士帽与"有色上衣 + 白裤"的分色制服认人：帽子是折叠短帽或带小檐的护士帽，颈后挂一副听诊器、胸前保留一块素色矩形胸牌。医生那件及膝白大褂与胸前胸件听诊器不在这套造型里，所以两者一眼可分。';
 // One uniform per slot. The cap is picked before the trim, because cap plus
 // white bottoms is the only pair of features still readable down a ward
 // corridor; the trim colour is then chosen to clash with its own top.
 const UNIFORM=[
  {top:'#9cc3a9',trim:'#2f5d6b',cap:'#eef1ef'},  // mint top, teal collar, white cap
  {top:'#b5d1e2',trim:'#8d4a63',cap:'#33507d'},  // pale blue top, plum collar, navy cap
  {top:'#94aabd',trim:'#e6ecef',cap:'#b3cee6'},  // grey-blue top, white collar, pink-blue cap
  {top:'#c4d3c2',trim:'#4a5f7a',cap:'#eef1ef'}   // sage top, slate collar, white cap
 ];
 // Six slots for thirty nurses. skirt and scarf are honoured for female nurses
 // only, and the male hair override below never lets a nurse grow a ponytail.
 const SLOTS=[
  {uniform:0,cap:'fold',skirt:0,scarf:0,pen:1,hair:'bun'},
  {uniform:1,cap:'brim',skirt:0,scarf:1,pen:0,hair:'bob'},
  {uniform:2,cap:'fold',skirt:1,scarf:0,pen:1,hair:'ponytail'},
  {uniform:3,cap:'tall',skirt:0,scarf:0,pen:0,hair:'braid'},
  {uniform:1,cap:'fold',skirt:1,scarf:1,pen:1,hair:'bob'},
  {uniform:0,cap:'brim',skirt:0,scarf:0,pen:0,hair:'crop'}
 ];
 const slotOf=ordinal=>SLOTS[((ordinal-1)%SLOTS.length+SLOTS.length)%SLOTS.length];
 // Seniors past forty-seven wear the folded cap whatever the slot says: a visor
 // is the first thing to look wrong on someone who has been on the ward for
 // twenty years, and the age rule keeps the cap from being a pure id lookup.
 const SENIOR_AGE=47;
 function create(T,{resident={},actor={}}={}){
  const rig=Kit.create(T,{resident,actor,stride:resident.gender==='F'&&slotOf(Kit.ordinalOf(resident.id)).skirt?.16:1}),{p,proportion:size,colors}=rig;
  const female=size.female,ordinal=colors.ordinal,slot=slotOf(ordinal);
  const head=rig.head,body=rig.torso,uniform=UNIFORM[slot.uniform];
  const top=p.material(uniform.top,.86),trim=p.material(uniform.trim,.7);
  const capCloth=p.material(uniform.cap,.8);
  const capBand=p.material(new T.Color(uniform.cap).multiplyScalar(.84),.8);
  // The white bottoms are the second half of the read. A white cap is allowed,
  // so it is the coloured top that keeps the figure from reading as one pale mass.
  const trouser=p.material('#edf0ee',.86),skirtCloth=p.material('#dfe4e1',.86);

  const sneaker=p.material('#eef1ef',.55),soleMat=p.material('#ccd4d0',.7);
  const card=p.material('#f5f7f5',.6);
  const tube=p.material('#3a434c',.45),bell=p.material('#cbd0cf',.3);
  rig.hair(female?slot.hair:(ordinal%2?'buzz':'crop'));
  // The scrub top replaces the bare mannequin torso rather than covering it, so
  // the silhouette stays crisp and the budget keeps room for cap and props.
  rig.hide('torso');
  const hw=female?.435:.465;
  p.panel('scrub-top',top,[[-hw,1.93],[hw,1.93],[hw+.055,2.56],[hw+.02,2.96],[.25,3.06],[-.25,3.06],[-hw-.02,2.96],[-hw-.055,2.56]],.4,body).position.z=-.2;
  p.ball('collar-stand',trim,[0,3.075,0],[.235,.075,.21],body,true);
  if(slot.scarf){
   p.panel('neck-scarf',trim,[[-.115,2.985],[.115,2.985],[.075,2.79],[0,2.705],[-.075,2.79]],.045,body).position.z=.222;
   p.ball('neck-scarf-knot',trim,[0,2.755,.272],[.055,.055,.038],body,true);
  }
  // A blank card is a single colour block on its original chest anchor.
  p.block('badge-card',card,[-.19,2.735,.238],[.155,.195,.022],body);
  // Retain the hanging bell and one tube on the original torso anchors.
  p.limb('scope-bell',bell,[.28,2.4,.262],[.265,2.575,.268],.058,body);
  p.curve('scope-yoke',tube,[[-.15,3.13,-.04],[-.185,3.05,-.2],[0,3.07,-.3],[.185,3.05,-.2],[.15,3.13,-.04]],.014,body);
  p.curve('scope-tube-pocket',tube,[[.15,3.13,-.04],[.245,2.98,.24],[.285,2.78,.29],[.272,2.63,.272],[.265,2.575,.268]],.013,body);
  // Sleeves, shoulders and elbows are recoloured rather than rebuilt: a second
  // garment layer would cost hundreds of triangles for no silhouette gain. A
  // scrub top over bare arms is the way this figure would give itself away.
  rig.wear(['sleeve-upper-left','sleeve-upper-right','sleeve-lower-left','sleeve-lower-right','shoulder-left','shoulder-right','elbow-left','elbow-right'],top);

  rig.wear(['pelvis','knee-left','knee-right','thigh-left','thigh-right','shin-left','shin-right'],trouser);
  if(slot.skirt&&female){
   const hemY=1.455;
   p.limb('scrub-skirt',skirtCloth,[0,1.92,0],[0,hemY,0],.335,body).scale.set(.36,.48,.395);
  }
  rig.wear(['shoe-left','shoe-right'],sneaker);
  rig.wear(['sole-left','sole-right'],soleMat);
  // Cap geometry is measured in head space, where the hair peaks at 4.115 and
  // the brows sit at 3.82. The crown is a ball reaching about 0.13 above that
  // peak, because a crown that stops at the hairline is not a cap at all, it is
  // a bald patch. The folded kind then hangs a flap off the back and folds a
  // small tab forward, the way the real thing is folded rather than stitched.
  const capKind=size.age>=SENIOR_AGE?'fold':slot.cap;
  if(capKind==='brim'){
   p.ball('nurse-cap-crown',capCloth,[0,4.04,-.01],[.475,.215,.4],head);
   p.block('nurse-cap-band',capBand,[0,3.935,0],[.95,.07,.81],head);
   p.ball('nurse-cap-visor',capBand,[0,3.855,.3],[.34,.05,.26],head).rotation.x=.14;
  }else{
   const tall=capKind==='tall';
   p.ball('nurse-cap-crown',capCloth,[0,tall?4.07:4.045,-.01],[tall?.45:.47,tall?.245:.2,tall?.39:.41],head);
   // Block scale is a full size, so half extents are half of it: the flap only
   // reads if it clears the crown's own z of 0.41, and the tab only if it
   // passes 0.41 in front. Both were swallowed by the crown before this.
   p.block('nurse-cap-fold',capBand,[0,tall?4.02:3.975,tall?-.3:-.34],[tall?.68:.8,tall?.1:.12,tall?.28:.34],head).rotation.x=-.45;
   p.block('nurse-cap-tab',capBand,[0,tall?4.03:4.0,tall?.3:.33],[tall?.62:.74,tall?.09:.1,tall?.26:.34],head).rotation.x=.3;
  }
  // Age shows in posture as well as hair colour: past the senior age the upper
  // body carries a slight forward lean and the head tips down. Both axes are
  // never touched by the shared walk cycle, so the lean survives every frame.
  if(size.age>=SENIOR_AGE){rig.upper.rotation.x=.07;rig.head.rotation.x=.05;}
  rig.update(0);
  return {object:rig.object,modelRef:MODEL_REF,variant:{gender:female?'F':'M',age:size.age,ordinal},update:seconds=>rig.update(seconds),dispose:()=>rig.dispose()};
 }
 return {create,MODEL_REF,MODEL_LABEL,MODEL_DESCRIPTION};
});
