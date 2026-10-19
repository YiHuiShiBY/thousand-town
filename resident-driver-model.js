/* Town drivers, 30 on the roster (city-life-ext/resident.js line 57), 27-55,
   15 F / 15 M, split between the station forecourt and the depot.

   The read is a forward peak. That single direction is the whole argument for
   this module, because the town already has two hats that go the other way or
   all the way round: the police cap is a wide formal peak worn forwards, the
   depot hard hat has a brim that runs right around the skull. A cap peak that
   covers only the brow and stops short of the ears measures about half the hard
   hat brim, and it is that half that tells the two apart across a street.

   The rest of the trade is a jacket or a waistcoat over a long-sleeve shirt, a
   belt bag slung at the front of the waist, and short gloves. Every variant is
   driven by the resident ordinal, so the thirty keep one body, one walk cycle
   and ten distinct silhouettes. Built on the shared resident kit. */
(function(root,factory){
 const api=factory(root.CityResidentKit||(typeof module==='object'&&module.exports?require('./resident-character-kit.js'):null));
 root.CityDriverModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kit){
 'use strict';
 const MODEL_REF='driver/v1';
 // One slot per roster ordinal. Ten slots over thirty residents means each slot
 // lands three times. Cap on or off, which outer layer, zipped or open, belt bag
 // and gloves are independent switches, so no two slots ship the same parts
 // list: the test asserts that over the roster rather than trusting the table.
 const SLOTS=[
  {cap:1,capTone:0,top:'jacket',topTone:0,zip:1,pack:1,glove:1,hairM:'buzz',hairF:'crop',    build:1.02},
  {cap:1,capTone:1,top:'vest',  topTone:2,zip:0,pack:1,glove:0,hairM:'crop',hairF:'ponytail',build:1.00},
  {cap:0,capTone:0,top:'jacket',topTone:1,zip:0,pack:1,glove:1,hairM:'crop',hairF:'bob',     build:1.04},
  {cap:1,capTone:2,top:'shirt', topTone:3,zip:0,pack:0,glove:0,hairM:'buzz',hairF:'crop',     build:1.00},
  {cap:1,capTone:3,top:'jacket',topTone:2,zip:1,pack:0,glove:1,hairM:'crop',hairF:'bun',      build:1.03},
  {cap:0,capTone:0,top:'vest',  topTone:3,zip:0,pack:1,glove:1,hairM:'buzz',hairF:'bob',      build:1.00},
  {cap:1,capTone:4,top:'jacket',topTone:3,zip:0,pack:1,glove:0,hairM:'crop',hairF:'crop',     build:1.05},
  {cap:1,capTone:5,top:'shirt', topTone:0,zip:0,pack:0,glove:1,hairM:'buzz',hairF:'ponytail', build:1.02},
  {cap:0,capTone:0,top:'jacket',topTone:0,zip:1,pack:1,glove:0,hairM:'buzz',hairF:'bob',     build:1.00},
  {cap:1,capTone:2,top:'vest',  topTone:1,zip:0,pack:1,glove:1,hairM:'crop',hairF:'crop',     build:1.04}
 ];
 const slotOf=ordinal=>SLOTS[((ordinal-1)%SLOTS.length+SLOTS.length)%SLOTS.length];
 // Driver outerwear: dark brown, black, navy and worn tan. All four are dark
 // enough to stay out of the officer's navy uniform and the depot's indigo
 // coverall, and none of them is a hi-vis cloth.
 const JACKET=['#3b2b20','#21242a','#232c40','#4a3527'];
 const VEST=['#4b3a2a','#2a2d33','#2c3850','#5a4632'];
 // Shirt cloth is the light note: it is what shows through an open jacket and
 // under a waistcoat, so it is the only pale surface on the trade.
 const SHIRT=['#cfc8b6','#7d8b9c','#8c4739','#416b60'];
 // Six cap colours a cap counter actually sells, none of them the hard hat set.
 const CAP=['#8a2f2a','#1c2734','#2e3a2b','#a97b3c','#45464b','#6d2027'];
 const GLOVE=['#221e1b','#4c3c2b','#585850'];
 const PACK=['#241f1a','#3c3527'];
 const TAPE='#8a8781';
 // Garment outlines in torso space. The zipped jacket is a closed outline; the
 // open jacket and the waistcoat both carry a notch cut down the centre, so the
 // shirt behind them is a real visible surface rather than a claim.
 const JACKET_CLOSED=[[-.34,1.92],[.34,1.92],[.40,2.56],[.49,2.95],[.27,3.06],[-.27,3.06],[-.49,2.95],[-.40,2.56]];
 const JACKET_OPEN=[[-.35,1.92],[.35,1.92],[.41,2.56],[.50,2.95],[.18,3.05],[0,2.32],[-.18,3.05],[-.50,2.95],[-.41,2.56]];
 const SHIRT_CUT=[[-.31,1.95],[.31,1.95],[.36,2.56],[.46,2.95],[.26,3.05],[-.26,3.05],[-.46,2.95],[-.36,2.56]];
 const VEST_CUT=[[-.31,1.96],[.31,1.96],[.37,2.58],[.46,2.96],[.15,3.05],[0,2.62],[-.15,3.05],[-.46,2.96],[-.37,2.58]];
 // The peak is measured in head space, where the head rig is scaled about 0.9
 // by the kit. A peak that reaches 0.58 units in front of the head centre
 // measures about 0.52 in the world, which is roughly half the hard hat brim
 // and about as far forward as a brow shade actually reaches.
 const PEAK=[.32,.262,.175];
 function create(T,{resident={},actor={}}={}){
  const rig=Kit.create(T,{resident,actor}),{p,proportion:size,colors}=rig,body=rig.torso,head=rig.head;
  const female=size.female,ordinal=colors.ordinal,slot=slotOf(ordinal),top=slot.top;
  // A wide-shouldered run is a width, not a new mesh: one scale on the upper
  // group carries the jacket panel, the collar and the sleeves out together.
  rig.upper.scale.set(slot.build,1,slot.build);
  rig.hair(female?slot.hairF:slot.hairM);
  const shirtMat=p.material(SHIRT[slot.topTone%SHIRT.length],.86);
  // One material per cut, built only for the cut this slot actually wears. A
  // plain shirt has no jacket, so giving it a jacket tone would colour the
  // sleeves in a cloth the figure is not wearing.
  const trimOf=(base,k)=>p.material(new T.Color(base.color).multiplyScalar(k),.8);
  const jacketMat=top==='jacket'?p.material(JACKET[slot.topTone%JACKET.length],.74):null;
  const vestMat=top==='vest'?p.material(VEST[slot.topTone%VEST.length],.74):null;
  const outerMat=jacketMat||vestMat;
  const trimMat=trimOf(outerMat||shirtMat,.78),shirtTrim=trimOf(shirtMat,.8);
  const trouserMat=p.material(new T.Color((outerMat||shirtMat).color).multiplyScalar(.66),.88);
  const shoeMat=p.material('#26221e',.6),soleMat=p.material('#4b443c',.86);
  // Sleeve cloth is the layer that actually covers the arm. A waistcoat is worn
  // over a long-sleeve shirt, so there the arm wears the shirt cloth, not the
  // waistcoat cloth: the same garment that covers the torso covers the arm.
  const sleeveMat=top==='jacket'?jacketMat:shirtMat;
  rig.hide('torso');
  if(top==='jacket'){
   // A zipped jacket is one solid panel: the shirt is inside it, so it costs no
   // triangles at all. An open one keeps the shirt as a real layer behind the
   // notch, because a jacket you cannot see into is a closed jacket.
   const open=!slot.zip;
   if(open){
    p.panel('jacket-shirt',shirtMat,SHIRT_CUT,.3,body).position.z=-.13;
    p.panel('jacket-body',jacketMat,JACKET_OPEN,.4,body).position.z=-.2;
   }else{
    p.panel('jacket-body',jacketMat,JACKET_CLOSED,.44,body).position.z=-.22;
   }
   p.block('jacket-hem',trimMat,[0,1.95,0],[.78,.08,.46],body);
  }else if(top==='vest'){
   p.panel('shirt-body',shirtMat,SHIRT_CUT,.4,body).position.z=-.2;
   p.panel('vest-body',vestMat,VEST_CUT,.16,body).position.z=.2;
   p.block('vest-hem',trimMat,[0,1.99,.28],[.66,.075,.18],body);
  }else{
   p.panel('shirt-body',shirtMat,SHIRT_CUT,.4,body).position.z=-.2;
   p.block('shirt-hem',shirtTrim,[0,1.98,0],[.72,.08,.44],body);
  }
  // A garment that covers the arms has to recolour the sleeves too: they are
  // separate meshes, so changing the torso alone leaves two bare forearms.
  rig.wear(['shoulder-left','shoulder-right','sleeve-upper-left','sleeve-upper-right','elbow-left','elbow-right','sleeve-lower-left','sleeve-lower-right'],sleeveMat);
  rig.wear(['pelvis','thigh-left','thigh-right','knee-left','knee-right','shin-left','shin-right'],trouserMat);
  rig.wear(['shoe-left','shoe-right'],shoeMat);
  rig.wear(['sole-left','sole-right'],soleMat);
  // The belt bag rides the front of the waist and stands clear of whatever the
  // outer layer ends at, so it is not swallowed by a zip or a waistcoat edge.
  if(slot.pack){
   const packMat=p.material(PACK[(ordinal-1)%PACK.length],.8);
   const z=top==='vest'?.37:.31,tag=top==='vest'?'vest-':'jacket-';
   p.block(tag+'waist-pack',packMat,[0,1.9,z],[.44,.2,.14],body);
   // The strap is what says "worn", so it is two short diagonals running back
   // to the hip instead of a band round the waist: a band would read as the
   // officer duty belt, and this trade must not carry one.
   for(const sign of[-1,1]){
    const side=sign<0?'left':'right';
    const strap=p.block(tag+'waist-pack-strap-'+side,packMat,[sign*.33,1.9,z-.16],[.22,.06,.3],body);
    strap.rotation.y=-sign*.62;
   }
  }
  // Gloves reuse the shared hand geometry with a paired material change.
  if(slot.glove){
   const gloveMat=p.material(GLOVE[(ordinal*2)%GLOVE.length],.76);
   rig.wear(['hand-left','hand-right'],gloveMat);
  }
  if(slot.cap){
   // A cap crown is a low, flat dome that stops at skull height, and the peak
   // is a single bead set well forward of the head centre with a quarter turn
   // of downward tilt. Its rear edge never crosses the head centre, so nothing
   // of it shows beside the ears: the peak is in front, and only in front.
   const capHex=CAP[slot.capTone%CAP.length];
   const capMat=p.material(capHex,.8),peakMat=p.material(new T.Color(capMat.color).multiplyScalar(.8),.78);
   p.ball('cap-crown',capMat,[0,3.9,-.012],[.462,.19,.42],head);
   p.block('cap-band',peakMat,[0,3.83,.005],[.9,.075,.79],head);
   const peak=p.ball('cap-peak',peakMat,[0,3.748,PEAK[0]],[PEAK[2],.042,PEAK[1]],head,true);
   peak.rotation.x=.24;
  }
  rig.update(0);
  return {object:rig.object,modelRef:MODEL_REF,variant:{gender:female?'F':'M',age:size.age,ordinal},update:seconds=>rig.update(seconds),dispose:()=>rig.dispose()};
 }
 return {create,MODEL_REF};
});
