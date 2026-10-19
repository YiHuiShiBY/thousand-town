/* Town workers — the third largest trade on the roster (105 people, 23-50, the
   depot crews, the workshop fitters and the market porters). The read is hard
   hat plus indigo coveralls plus steel-toe boots.

   The reflective language here is deliberately thin: one broad chest tape and
   plain trousers. The full fluorescent vest already belongs to the sanitation
   crew and the hi-vis shift to the officer, so a worker in a glowing shirt would
   be a third trade wearing the same lamp. Every variant here is measured
   against those two in tests/worker-model.test.cjs.

   Built on the shared resident kit, so a worker keeps the town proportions and
   the shared walk cycle like every other trade. */
(function(root,factory){
 const api=factory(root.CityResidentKit||(typeof module==='object'&&module.exports?require('./resident-character-kit.js'):null));
 root.CityWorkerModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kit){
 'use strict';
 const MODEL_REF='worker/v1';
 // Indigo work cloth and grey work trousers: white collar wears navy-black, so a
 // grey leg and a blue-denim top is what actually separates the two trades.
 const CLOTH=['#1e3a63','#24405f','#1b3350','#2a4260'];
 const TROUSER=['#4f5148','#5a5b50','#454a46','#585a52'];
 // Yellow, white, orange, blue — the four hard hat colours a depot actually stocks.
 const HAT=['#e3b62c','#e7e4d9','#d26c1c','#2f5b8c'];
 // One amber tape colour, never the officer's grey and never his vest green.
 const TAPE='#d9a53a';
 const BOOT='#312c27',SOLE='#c9bb9b',BELT='#54402f',METAL='#a9a49a';
 // One slot per roster ordinal. Fourteen slots over 105 residents means each
 // slot lands seven or eight times, and every slot owns a different
 // (helmet, garment, tape, pouch) tuple so no two neighbours look alike.
 const SLOTS=[
  {hat:1,tone:0,brim:.62,suit:'coverall',cloth:0,tape:2,pouch:1,build:1.05,hair:'buzz'},
  {hat:0,tone:0,brim:0,   suit:'shirt',   cloth:1,tape:0,pouch:0,build:1.03,hair:'crop'},
  {hat:1,tone:1,brim:.585,suit:'shirt',   cloth:2,tape:1,pouch:2,build:1.07,hair:'crop'},
  {hat:1,tone:2,brim:.655,suit:'coverall',cloth:3,tape:1,pouch:1,build:1.03,hair:'buzz'},
  {hat:0,tone:0,brim:0,   suit:'coverall',cloth:1,tape:2,pouch:0,build:1.05,hair:'buzz'},
  {hat:1,tone:3,brim:.62, suit:'coverall',cloth:2,tape:0,pouch:3,build:1.07,hair:'crop'},
  {hat:0,tone:0,brim:0,   suit:'shirt',   cloth:3,tape:1,pouch:1,build:1.03,hair:'buzz'},
  {hat:1,tone:0,brim:.585,suit:'coverall',cloth:0,tape:1,pouch:2,build:1.05,hair:'crop'},
  {hat:1,tone:1,brim:.655,suit:'shirt',   cloth:1,tape:2,pouch:0,build:1.07,hair:'buzz'},
  {hat:0,tone:0,brim:0,   suit:'coverall',cloth:2,tape:0,pouch:3,build:1.05,hair:'crop'},
  {hat:1,tone:2,brim:.62, suit:'shirt',   cloth:3,tape:2,pouch:1,build:1.03,hair:'buzz'},
  {hat:1,tone:3,brim:.585,suit:'coverall',cloth:1,tape:1,pouch:0,build:1.07,hair:'crop'},
  {hat:0,tone:0,brim:0,   suit:'shirt',   cloth:0,tape:0,pouch:2,build:1.03,hair:'crop'},
  {hat:1,tone:1,brim:.655,suit:'coverall',cloth:3,tape:2,pouch:3,build:1.05,hair:'buzz'}
 ];
 const slotOf=ordinal=>SLOTS[((ordinal-1)%SLOTS.length+SLOTS.length)%SLOTS.length];
 // Garment outlines sit in torso space. The coverall runs from the shoulder
 // wedges down past the hip (1.26) so its hem hangs below the trouser waist,
 // which is what makes it read as one garment from shoulder to boot.
 const COVERALL=[[-.37,1.26],[.37,1.26],[.40,1.95],[.43,2.62],[.52,2.99],[.27,3.08],[-.27,3.08],[-.52,2.99],[-.43,2.62],[-.40,1.95]];
 const SHIRT=[[-.34,2.0],[.34,2.0],[.38,2.58],[.49,2.97],[.27,3.07],[-.27,3.07],[-.49,2.97],[-.38,2.58]];
 function create(T,{resident={},actor={}}={}){
  const rig=Kit.create(T,{resident,actor,stride:slotOf(Kit.ordinalOf(resident.id)).suit==='coverall'?.16:1}),{p,proportion:size,colors}=rig,body=rig.torso,head=rig.head;
  const female=size.female,ordinal=colors.ordinal,slot=slotOf(ordinal),cover=slot.suit==='coverall';
  // Blue collar reads a size up from white collar. The width goes on the upper
  // group in plan only, so the standing height is untouched.
  rig.upper.scale.set(slot.build,1,slot.build);
  // Roomy work trousers are a width, not a colour: widening the hip rig carries
  // thigh, shin and boot out together instead of one fat cylinder per leg.
  for(const leg of rig.legs)leg.upper.scale.set(1.06,1,1.06);
  const clothHex=CLOTH[slot.cloth%CLOTH.length];
  const cloth=p.material(clothHex),rib=p.material(new T.Color(clothHex).multiplyScalar(.8));
  // A coverall is one garment, so the legs take the same cloth; the shirt
  // variant gets grey work trousers instead.
  const trouser=cover?cloth:p.material(TROUSER[slot.cloth%TROUSER.length]);
  const tapeMat=p.material(TAPE,.3);
  const bootMat=p.material(BOOT,.62),soleMat=p.material(SOLE,.9);
  const beltMat=p.material(BELT,.8),metalMat=p.material(METAL,.34);
  rig.hair(slot.hair);
  // The garment replaces the bare mannequin torso rather than covering it, so
  // the silhouette stays crisp and the budget keeps room for the kit.
  rig.hide('torso');
  p.panel(cover?'coverall-body':'work-shirt',cloth,cover?COVERALL:SHIRT,.4,body).position.z=-.2;
  p.block(cover?'coverall-hem':'work-shirt-hem',rib,[0,cover?1.3:2.04,.02],[cover?.82:.74,.09,cover?.45:.43],body);
  for(const sign of[-1,1]){
   const side=sign<0?'left':'right';
   p.panel('collar-flap-'+side,rib,[[sign*.02,3.11],[sign*.25,3.05],[sign*.13,2.86]],.032,body).position.z=.246;
  }
  rig.wear(['pelvis','thigh-left','thigh-right','knee-left','knee-right','shin-left','shin-right'],trouser);
  // A garment that covers the arms has to recolour the sleeves too: they are
  // separate meshes, so changing the torso alone leaves two bare forearms.
  rig.wear(['shoulder-left','sleeve-upper-left','elbow-left','sleeve-lower-left','shoulder-right','sleeve-upper-right','elbow-right','sleeve-lower-right'],cloth);
  // Safety boots are the second blue collar tell: a pale gum sole thick enough
  // to see from across the street under a dark upper. The kit sole is dropped
  // rather than recoloured because the work boot wants its own depth.
  rig.wear(['shoe-left','shoe-right'],bootMat);
  rig.hide('sole-left','sole-right');
  for(const leg of rig.legs){
   const side=leg.side;
   p.block('boot-sole-'+side,soleMat,[0,-.028,.05],[.33,.08,.5],leg.foot);
  }
  // Narrow industrial tape: one chest strip with no fine calf bands. The
  // legs keep the shared rig and solid work-cloth colour.
  if(slot.tape>=1)p.panel('tape-chest-upper',tapeMat,[[-.325,2.56],[.325,2.56],[.312,2.62],[-.312,2.62]],.02,body).position.z=.234;
  if(slot.belt!==0){
   p.block('toolbelt',beltMat,[0,1.92,.02],[.72,.115,.46],body);
  }
  if(slot.pouch===1){
   p.block('tool-pouch-left',beltMat,[-.4,1.78,.08],[.18,.26,.2],body);
  }
  if(slot.pouch===2){
   p.block('tool-holster-right',beltMat,[.4,1.78,.08],[.17,.27,.2],body).rotation.z=-.12;
   p.block('tool-spanner',metalMat,[.41,1.6,.14],[.05,.3,.05],body);
  }
  if(slot.pouch===3){
   p.block('tool-pouch-left',beltMat,[-.4,1.78,.08],[.18,.26,.2],body);
   p.block('tool-spanner',metalMat,[-.42,1.58,.13],[.05,.32,.05],body).rotation.z=.1;
  }
  if(slot.hat){
   // A hard hat is a real dome on a real brim, hung off the head rig: the dome
   // caps the skull at 4.16 in head space (about 4.33 units tall) and the brim
   // overhangs the face by more than a hand's width on each side, which is what
   // separates it from a peaked cap at any viewing distance.
   const hatHex=HAT[slot.tone%HAT.length];
   const hatMat=p.material(hatHex),brimMat=p.material(new T.Color(hatHex).multiplyScalar(.84));
   p.ball('hardhat-dome',hatMat,[0,3.92,-.01],[.56,.24,.48],head);
   p.ball('hardhat-brim',brimMat,[0,3.72,.06],[slot.brim,.05,.54],head,true);
  }
  rig.update(0);
  return {object:rig.object,modelRef:MODEL_REF,variant:{gender:female?'F':'M',age:size.age,ordinal},update:seconds=>rig.update(seconds),dispose:()=>rig.dispose()};
 }
 return {create,MODEL_REF};
});