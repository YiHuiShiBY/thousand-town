/* Ward patients: striped hospital gown, soft slippers, and for the oldest a
   shawl and a walking cane. Built on the shared resident kit, so the eight-year
   old and the eighty-four-year-old in this role keep the same body as everyone
   else and the gown is cut to whatever body is actually under it. */
(function(root,factory){
 const api=factory(root.CityResidentKit||(typeof module==='object'&&module.exports?require('./resident-character-kit.js'):null));
 root.CityPatientModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kit){
 'use strict';
 const MODEL_REF='patient/v1';
 const MODEL_LABEL='条纹病号服';
 const DESCRIPTION='竖条纹病号服配软底拖鞋，年长者加披肩与拐杖，白发一望即知是病人。';
 // Two ward schemes, picked off the resident id: one bed is not thirty identical
 // stripes, and the same id always rebuilds the same scheme.
 const SCHEMES=[
  {cloth:'#eaf0f3',stripe:'#a7c2d3',trim:'#c2d3dd',sole:'#b3c1c7',slipper:'#e3eaee',pyjama:'#dce3e6',band:'#f3f2ec'},
  {cloth:'#ecf2ea',stripe:'#a3bd9d',trim:'#c4d5c0',sole:'#b8c5b7',slipper:'#e6ece3',pyjama:'#dfe6dd',band:'#f3f2ec'}
 ];
 // Age layers. The ward roll runs 8 to 84, so the robe has to be cut twice and
 // dressed twice; the body itself always comes from the kit's age tables.
 const CHILD=13,ELDER=68,CANE=78;
 const HAIR_F=['bun','ponytail','bob'],HAIR_M=['crop','buzz','curly'];
 function create(T,{resident={},actor={}}={}){
  const rig=Kit.create(T,{resident,actor}),{p,proportion:size,colors}=rig;
  const female=size.female,ordinal=colors.ordinal,age=size.age;
  const child=age<=CHILD,elder=age>=ELDER,caned=age>=CANE;
  // Arm parts are addressed through the arm group rather than through the sleeve
  // mesh, because the child's short sleeve drops that mesh.
  const elbowOf=side=>rig.arms.find(arm=>arm.side===side).elbow;
  const s=SCHEMES[(ordinal-1)%SCHEMES.length];
  const cloth=p.material(s.cloth),stripe=p.material(s.stripe),pyjama=p.material(s.pyjama);
  const soleMat=p.material(s.sole,.92),slipperMat=p.material(s.slipper,.72);
  // Old wards read as old: the kit already greys hair with age, elders get an
  // extra step towards white so the age layer shows in a wide shot.
  const hairMat=elder?p.material('#'+new T.Color(colors.hair).lerp(new T.Color('#e3e0d7'),.5).getHexString()):rig.hairMaterial;
  rig.hair(child?'buzz':female?HAIR_F[ordinal%HAIR_F.length]:HAIR_M[ordinal%HAIR_M.length],hairMat);
  // The gown replaces the bare mannequin torso rather than covering it, so the
  // silhouette stays crisp and the triangle budget keeps room for the props.
  rig.hide('torso');
  const body=rig.torso;
  // A patient garment hangs off the shoulders, so the panel is wider than the
  // mannequin torso at every height; that loose cut is the shape difference
  // against a coat and a cardigan. Proportions are in object space, so one cut
  // shrinks with the body; only the hem and the stripe band are cut twice,
  // because a child's tee is a short one.
  const hem=child?2.06:1.76,hemHalf=child?.30:.40,waist=child?.30:.41,chest=child?.34:.45,shoulder=child?.20:.27,top=3.06;
  const gown=p.panel('gown',cloth,[[-hemHalf,hem],[hemHalf,hem],[waist,2.5],[chest,2.9],[shoulder,top],[-shoulder,top],[-chest,2.9],[-waist,2.5]],.42,body);
  gown.position.z=-.21;
  // Stripes are real geometry, not a texture: thin bars standing proud of the
  // chest, on both faces, so the patient still reads as a patient from behind.
  const topStripe=2.84,bottomStripe=child?2.14:1.9,count=3,step=child?.19:.3,width=child?.065:.08;
  const middle=(topStripe+bottomStripe)/2,length=topStripe-bottomStripe;
  for(const sign of[1,-1])for(let i=0;i<count;i++)
   p.block((sign>0?'stripe-front-':'stripe-back-')+i,stripe,[(i-(count-1)/2)*step,middle,sign*.25],[width,length,.03],body);
  rig.wear(['pelvis','thigh-left','thigh-right','knee-left','knee-right','shin-left','shin-right'],pyjama);
  // A short sleeve is a sleeve that stops at the elbow. The mannequin's lower
  // sleeve IS the forearm, so the child drops it and gets a bare forearm under a
  // new name; every garment mesh left is still cloth.
  if(child){
   rig.drop('sleeve-lower-left','sleeve-lower-right');
   for(const [sign,side] of[[-1,'left'],[1,'right']])
    p.limb('forearm-skin-'+side,rig.skin,[0,-.03,0],[sign*.022,-.43,.033],.098,elbowOf(side));
  }
  // A gown with bare arms is the classic way a low-poly figure gives itself
  // away: the sleeves are their own meshes, so they need the cloth as well.
  rig.wear(['sleeve-upper-left','sleeve-upper-right','shoulder-left','shoulder-right','elbow-left','elbow-right',
   'sleeve-lower-left','sleeve-lower-right'],cloth);
  // Slippers: a low, long, pale upper over a flat soft sole that actually meets
  // the floor. The low soft shoe silhouette belongs to the ward.
  for(const [sign,side] of[[-1,'left'],[1,'right']]){
   const shoe=rig.parts['shoe-'+side],sole=rig.parts['sole-'+side];
   shoe.scale.set(.168,.092,.3);shoe.material=slipperMat;
   sole.position.set(0,-.035,.05);sole.scale.set(.3,.05,.46);sole.material=soleMat;
  }
  if(elder){
   // Shawl: a roll over the shoulders that passes behind the neck, plus two
   // tails hanging over the gown, so the elderly read as a different layer.
   const shawlMat=p.material('#87949b');
   p.curve('shawl-drape',shawlMat,[[-.47,2.68,.15],[-.5,2.95,.02],[-.31,3.09,-.1],[.31,3.09,-.1],[.5,2.95,.02],[.47,2.68,.15]],.07,body);
   p.panel('shawl-tail-left',shawlMat,[[-.46,3.02],[-.17,3.07],[-.2,2.55],[-.45,2.66]],.05,body).position.z=.245;
   p.panel('shawl-tail-right',shawlMat,[[.17,3.07],[.46,3.02],[.45,2.66],[.2,2.55]],.05,body).position.z=.245;
  }
  if(caned){
   // A real cane, not a prop: the shaft is cut to reach the floor from the posed
   // hand at THIS resident's height, so the ferrule lands on the ground and the
   // walking cycle does not float it.
   const arm=rig.poseArm('right',{shoulderX:-.1,shoulderZ:.2,elbowX:-.22,elbowZ:.1});
   const elbow=arm.elbow,grip=new T.Vector3(.028,-.5,.045),wood=p.material('#8a7358');
   rig.update(0);
   const hand=elbow.localToWorld(grip.clone());
   const down=new T.Vector3(0,-1,0).applyQuaternion(elbow.getWorldQuaternion(new T.Quaternion()));
   // The ferrule's own half height is .075, so aiming its centre low enough is
   // what puts the rubber tip on the floor instead of hovering above it.
   const tipY=.008+.075*size.heightScale;
   const reach=Math.max(1.1,(hand.y-tipY)/(size.heightScale*Math.max(.5,-down.y)));
   const cane=new T.Group();cane.name='cane';cane.position.copy(grip);elbow.add(cane);
   p.limb('cane-shaft',wood,[0,.18,0],[0,-reach,0],.024,cane);
   p.curve('cane-crook',wood,[[0,.18,0],[0,.28,-.07],[0,.3,-.16]],.022,cane);
   p.ball('cane-ferrule',rig.dark,[0,-reach,0],[.05,.075,.05],cane,true);
  }
  rig.update(0);
  return {object:rig.object,modelRef:MODEL_REF,variant:{gender:female?'F':'M',age:size.age,ordinal},update:seconds=>rig.update(seconds),dispose:()=>rig.dispose()};
 }
 return {create,MODEL_REF,MODEL_LABEL,DESCRIPTION};
});
