/* Hospital administrative staff: a short pale hospital-uniform top over dark
   trousers, a square ID card clipped on the left chest, a mask looped round the
   neck, and one upright chart held in a single hand.

   This is the group most at risk of being read as one of the two medical trades
   next door, so the separators are deliberate and measured rather than incidental:
     - the top stops AT THE WAIST (the doctor's white coat reaches the knee);
     - the prop is held upright in one hand (the school clerk carries a soft
       folder across a high bent forearm, the counter clerk lays a board flat on
       two crossed arms);
     - the pass is a small square card on the LEFT chest with no cord at all (the
       school clerk wears a centred lanyard badge, the doctor a tiny strap badge);
     - the mask hanging under the jaw belongs to nobody else in the roster.

   Built on the shared resident kit so every role keeps the same proportions and
   the same walk cycle. */
(function(root,factory){
 const api=factory(root.CityResidentKit||(typeof module==='object'&&module.exports?require('./resident-character-kit.js'):null));
 root.CityHospAdminModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kit){
 'use strict';
 const MODEL_REF='hosp-admin/v1';
 const MODEL_LABEL='医院行政';
 const MODEL_DESCRIPTION='浅色短款医院制服上衣（肩部拼色块）加左胸方形工牌，单手竖持一块病历夹。';
 // Original slots keep uniform/yoke colour, sleeve length, chart and skirt cut.
 const SLOTS=[
  {uniform:0,yoke:0,sleeve:'long' ,chart:'clipboard',skirt:false},
  {uniform:1,yoke:1,sleeve:'short',chart:'tablet'   ,skirt:false},
  {uniform:2,yoke:2,sleeve:'long' ,chart:'clipboard',skirt:true },
  {uniform:0,yoke:3,sleeve:'short',chart:'tablet'   ,skirt:false},
  {uniform:1,yoke:4,sleeve:'long' ,chart:'clipboard',skirt:false},
  {uniform:2,yoke:5,sleeve:'short',chart:'clipboard',skirt:true },
 ];
 const slotOf=ordinal=>SLOTS[(ordinal-1)%SLOTS.length];
 // Hospital cloth is the pale end of the wardrobe, but never bright white: the
 // doctor's coat owns that. The yoke is the only mid-tone block on the torso.
 const UNIFORM=['#e6edef','#dae7ee','#dceee3','#e4e8ef','#d9e9e8','#e9e9e7'];
 const YOKE=['#5d7f92','#5a8a7c','#6a7590','#4f7386','#6d8474','#5b6f8c'];
 const TROUSER=['#2e3742','#333b44','#2b3540','#384046','#313a42'];
 const SKIRT=['#3a4048','#3d444a','#353b42'];
 const HAIR_F=['bob','bun','crop','ponytail','bob','bun'];
 const HAIR_M=['crop','buzz','crop','bald','crop','buzz'];
 const HAIR_SLOTS=Math.max(HAIR_F.length,HAIR_M.length);
 function create(T,{resident={},actor={}}={}){
  const rig=Kit.create(T,{resident,actor,stride:resident.gender==='F'&&slotOf(Kit.ordinalOf(resident.id)).skirt?.16:1}),{p,proportion:size,colors}=rig;
  const female=size.female,ordinal=colors.ordinal,slot=slotOf(ordinal),body=rig.torso;
  const uniform=p.material(UNIFORM[slot.uniform],.9);
  const yokeMat=p.material(YOKE[slot.yoke],.86);
  const placket=p.material(new T.Color(uniform.color).multiplyScalar(.93),.9);

  const bottom=p.material((female?SKIRT:TROUSER)[(ordinal-1)%3],.86);

  const shoe=p.material('#2d3639',.66),soleMat=p.material('#1f2629',.72);
  const cardMat=p.material('#f3f0e6',.72),clipMat=p.material('#b7b0a0',.35);

  const boardMat=p.material('#5a6470',.7),paper=p.material('#f2efe4',.9);
  const screen=p.material('#3d4a56',.4),glass=p.material('#9fb6bf',.5);
  rig.hair((female?HAIR_F:HAIR_M)[(ordinal-1)%HAIR_SLOTS]);
  // The mannequin torso is bare skin, so the uniform replaces it outright rather
  // than covering it: a second garment layer would cost hundreds of triangles for
  // no silhouette, and this trade's silhouette is the hem, not the layering.
  rig.hide('torso');
  // THE HEM IS THE SIGNATURE. The shape stops at y=1.9, the waist line, where the
  // doctor's coat is still another twenty centimetres of white hanging down.
  p.panel('scrub-top',uniform,[[-.33,1.9],[.33,1.9],[.37,2.46],[.45,2.95],[.25,3.05],[-.25,3.05],[-.45,2.95],[-.37,2.46]],.38,body).position.z=-.19;
  // Yoke: the one mid-tone block across the shoulders, cut proud of the chest so
  // its lower seam reads as a real seam and not a printed stripe.
  p.panel('scrub-yoke',yokeMat,[[-.47,2.78],[.47,2.78],[.42,3.02],[.24,3.1],[-.24,3.1],[-.42,3.02]],.42,body).position.z=-.205;
  for(const sign of[-1,1]){
   const side=sign<0?'left':'right';
   p.panel('scrub-collar-'+side,placket,[[sign*.02,3.1],[sign*.2,3.04],[sign*.115,2.87]],.034,body).position.z=.24;
  }
  // Square pass card on the LEFT chest, clipped flat. No cord, no loop, no lanyard:
  // that absence is the whole difference from the school badge hanging dead centre.
  p.block('id-card',cardMat,[-.3,2.64,.246],[.16,.16,.024],body);

  // Trousers are a material swap on the mannequin legs, never a second layer.
  if(female&&slot.skirt){
   // A-line skirt: flared, unlike the counter clerk's straight pencil skirt, and
   // a different part name besides, so the two uniforms cannot merge.
   const hemY=1.2,flare=.38;
   p.panel('admin-skirt',bottom,[[-.35,1.93],[.35,1.93],[flare,hemY],[-flare,hemY]],.4,body).position.z=-.2;
   rig.wear(['pelvis'],bottom);
  }else{
   rig.wear(['pelvis','thigh-left','thigh-right','knee-left','knee-right','shin-left','shin-right'],bottom);
  }
  rig.wear(['shoe-left','shoe-right'],shoe);
  rig.wear(['sole-left','sole-right'],soleMat);
  // Sleeves belong to the UNIFORM. A long sleeve owns the whole arm; a short one
  // stops at the elbow, so the forearm keeps skin and the elbow ball becomes the
  // cuff line. Either way every arm part the cloth actually covers is recoloured,
  // because those meshes are the arms themselves.
  const armCloth=['shoulder-left','shoulder-right','sleeve-upper-left','sleeve-upper-right','elbow-left','elbow-right'];
  rig.wear(armCloth,uniform);
  if(slot.sleeve==='long')rig.wear(['sleeve-lower-left','sleeve-lower-right'],uniform);
  else rig.wear(['sleeve-lower-left','sleeve-lower-right'],rig.skin);

  // The chart is upright in ONE hand at the waist. Nothing is tucked into an
  // armpit: a relaxed arm leaves about 0.165 units there and a board dropped in
  // would simply vanish inside the sleeve. The board therefore hangs off the
  // torso while the arm is posed to meet its lower edge, which also means the
  // shared upper-body bob carries the hand and the chart together.
  rig.poseArm('left',{shoulderZ:.3,shoulderX:-.18,elbowX:-.7,elbowZ:.25});
  const chart=new T.Group();chart.name='chart-hold';chart.position.set(-.26,2.2,.44);body.add(chart);
  if(slot.chart==='clipboard'){
   p.block('chart-board',boardMat,[0,0,0],[.36,.56,.032],chart);
   p.block('chart-clip',clipMat,[0,.27,.03],[.15,.06,.05],chart);
   p.block('chart-pages',paper,[0,.02,.028],[.312,.49,.02],chart);
  }else{
   p.block('chart-tablet',screen,[0,0,0],[.34,.5,.03],chart);
   p.block('chart-tablet-glass',glass,[0,0,.022],[.3,.44,.014],chart);
  }
  rig.update(0);
  return {object:rig.object,modelRef:MODEL_REF,variant:{gender:female?'F':'M',age:size.age,ordinal},update:seconds=>rig.update(seconds),dispose:()=>rig.dispose()};
 }
 return {create,MODEL_REF,MODEL_LABEL,MODEL_DESCRIPTION};
});