/* Town police keep their uniform, cap silhouettes, shift colours and radio or
   baton on the shared resident rig. Small insignia and edge trim are omitted. */
(function(root,factory){
 const api=factory(root.CityResidentKit||(typeof module==='object'&&module.exports?require('./resident-character-kit.js'):null));
 root.CityOfficerModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kit){
 'use strict';
 const MODEL_REF='officer/v1';
 // Original cap, brim, hair, shift, prop and stance slots stay stable.
 const SLOTS=[
  {cap:'rolled',brim:.46,prop:'radio',hair:'buzz',vest:0,stance:0},
  {cap:'wide',brim:.54,prop:'baton',hair:'crop',vest:0,stance:0},
  {cap:'none',brim:0,prop:'none',hair:'ponytail',vest:0,stance:0},
  {cap:'low',brim:.52,prop:'none',hair:'crop',vest:1,stance:'back'},
  {cap:'low',brim:.48,prop:'baton',hair:'bob',vest:0,stance:0},
  {cap:'rolled',brim:.50,prop:'none',hair:'bob',vest:1,stance:0},
  {cap:'wide',brim:.45,prop:'none',hair:'crop',vest:0,stance:0},
  {cap:'narrow',brim:.40,prop:'none',hair:'buzz',vest:1,stance:0}
 ];
 // Cap crowns are measured in head space, where the skull peaks near 4.12 and the
 // brows sit at 3.70. A pulled-low crown drops 0.06 and a low visor tilts down
 // over the brow line instead of shading empty air above it.
 const CROWN={rolled:[4.00,.27,.395],wide:[4.00,.27,.40],low:[3.90,.27,.41],narrow:[4.00,.27,.40]};
 const VISOR={rolled:[3.805,.19,.245,-.13],wide:[3.83,.20,.30,.03],low:[3.765,.23,.28,.30],narrow:[3.83,.19,.25,.04]};
 const NAVY='#2c3752',NAVY_DEEP='#1f2740',LEATHER='#232b30';
 const HIVIS='#bcc75e',TAPE='#c6d0c6';
 const slotOf=ordinal=>SLOTS[((ordinal-1)%SLOTS.length+SLOTS.length)%SLOTS.length];
 function create(T,{resident={},actor={}}={}){
  const rig=Kit.create(T,{resident,actor}),{p,proportion:size,colors}=rig,body=rig.torso,head=rig.head;
  const female=size.female,ordinal=colors.ordinal,slot=slotOf(ordinal);
  const shirt=p.material(slot.vest?HIVIS:NAVY,.82),trim=p.material(NAVY_DEEP,.84);
  const tape=p.material(TAPE,.28);
  const trouser=p.material(NAVY_DEEP,.86),shoe=p.material(LEATHER,.7),visor=p.material(NAVY_DEEP,.76);
  rig.hair(slot.hair);
  // The uniform shirt replaces the bare mannequin torso instead of covering it,
  // so the eight silhouettes stay crisp and the budget keeps room for the kit.
  rig.hide('torso');
  const uniform=p.panel('shirt',shirt,[[-.32,1.93],[.32,1.93],[.38,2.56],[.49,2.95],[.27,3.06],[-.27,3.06],[-.49,2.95],[-.38,2.56]],.4,body);uniform.position.z=-.2;
  for(const sign of[-1,1]){
   const side=sign<0?'left':'right';
   // Rounded shoulders and sleeves are the mannequin's own cylinders in shirt
   // cloth; a second sleeve layer would cost hundreds of triangles for nothing.
   rig.wear(['shoulder-'+side,'sleeve-upper-'+side,'sleeve-lower-'+side,'elbow-'+side],shirt);
   const collar=p.panel('collar-'+side,trim,[[sign*.02,3.115],[sign*.232,3.04],[sign*.122,2.86]],.03,body);collar.position.z=.213;
  }
  p.block('tie',trim,[0,2.84,.222],[.085,.36,.032],body);

  if(slot.vest){
   // High-visibility shift: the whole shirt is the reflective cloth, so the only
   // extra meshes are the large arm and chest bands that actually catch the dusk light.
   p.ball('hi-vis-band-arm-left',tape,[-.045,-.28,.016],[.155,.05,.155],rig.arms[0].shoulder,true);
   p.ball('hi-vis-band-arm-right',tape,[.045,-.28,.016],[.155,.05,.155],rig.arms[1].shoulder,true);
   p.panel('hi-vis-band-chest',tape,[[-.36,2.44],[.36,2.44],[.335,2.56],[-.335,2.56]],.022,body).position.z=.204;
  }
  p.block('belt',trim,[0,1.93,.02],[.68,.1,.42],body);
  if(slot.cap!=='none'){
   const [cy,ch,cz]=CROWN[slot.cap],[vy,vz,vl,vt]=VISOR[slot.cap];
   p.ball('cap-crown-'+slot.cap,shirt,[0,cy,-.004],[.472,ch,cz],head);
   p.block('cap-band-'+slot.cap,visor,[0,cy-.09,.01],[.9,.075,.772],head);
   const brim=p.ball('cap-visor-'+slot.cap,visor,[0,vy,vz],[slot.brim,.05,vl],head);brim.rotation.x=vt;

  }
  if(slot.prop==='radio'){
   p.block('radio-body',rig.dark,[-.15,2.44,.235],[.11,.17,.055],body);
   p.block('radio-antenna',rig.dark,[-.212,2.615,.226],[.02,.13,.02],body);
  }
  // The baton rides the duty belt rather than the hand: holding it would freeze
  // the arm out of the shared walk cycle, and the street walk must keep swinging.

  if(slot.prop==='baton'){
   const baton=p.block('baton',rig.dark,[-.398,1.71,-.06],[.05,.6,.05],body);baton.rotation.set(.3,0,.34);
  }
  rig.wear(['pelvis','knee-left','knee-right','thigh-left','thigh-right','shin-left','shin-right'],trouser);
  rig.wear(['shoe-left','shoe-right'],shoe);
  // Only the hands-behind-back officer gets a set arm; every other officer keeps
  // the kit default so the street walk still swings both arms.
  if(slot.stance==='back'){rig.poseArm('left',{shoulderX:.34,elbowX:.58});rig.poseArm('right',{shoulderX:.34,elbowX:.58});}
  rig.update(0);
  return {object:rig.object,modelRef:MODEL_REF,variant:{gender:female?'F':'M',age:size.age,ordinal},update:seconds=>rig.update(seconds),dispose:()=>rig.dispose()};
 }
 return {create,MODEL_REF};
});
