/* Doctors: an open knee-length white coat over a coloured shirt, a worn
   stethoscope, one pen in a chest pocket and a small badge. Built on the shared
   resident kit so every role keeps the same proportions; the white hem is the
   strongest silhouette in the roster and reaches just above the knee. */
(function(root,factory){
 const api=factory(root.CityResidentKit||(typeof module==='object'&&module.exports?require('./resident-character-kit.js'):null));
 root.CityMedicalDocModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kit){
 'use strict';
 const MODEL_REF='medical-doc/v1';
 // Under-colour and trouser tones hang off the resident ordinal, so one id always
 // rebuilds the same doctor and the shirt never reads as a hole in the open coat.
 const SHIRT=['#cfdcea','#dcd8cf','#c9d4dd','#e2ded2','#cdd6d0','#d6d9e2'];
 const SLACKS=['#2f3944','#35404a','#2b3440','#3b434b','#313c46','#394a44'];
 // Coat cut in scene units: shoulder / chest / waist / hem half-width and collar
 // reach. The hem is the signature and stays identical for both genders; only the
 // waist and the flare differ, which reads as a fitted coat without a second mesh.
 const CUT={M:{shoulder:.46,chest:.5,waist:.47,hem:.53,collar:.27},
            F:{shoulder:.44,chest:.47,waist:.41,hem:.52,collar:.25}};
 function create(T,{resident={},actor={}}={}){
  const rig=Kit.create(T,{resident,actor,stride:.1}),{p,proportion:size,colors}=rig;
  const female=size.female,ordinal=colors.ordinal,cut=female?CUT.F:CUT.M;
  const coat=p.material('#f2f4f2');
  const shirt=p.material(SHIRT[(ordinal-1)%SHIRT.length]);
  const slacks=p.material(SLACKS[(ordinal*2)%SLACKS.length]);
  const shoe=p.material('#2a3236',.68);
  const tube=p.material('#3a4045',.45),bell=p.material('#c6cac9',.32);

  rig.hair(female?(size.age>52?'bun':'bob'):(size.age>55?'buzz':'crop'));
  // The mannequin torso is bare skin, so the shirt layer replaces it outright.
  rig.hide('torso');
  const body=rig.torso;
  // Inner shirt layer: fills the open front and the side slit with a colour, so
  // neither opening reads as a hole punched through the figure.
  const shirtLayer=p.panel('shirt',shirt,[[cut.shoulder-.04,3.04],[-(cut.shoulder-.04),3.04],[-(cut.chest-.05),2.6],[-(cut.waist-.05),2.0],[-(cut.hem-.05),1.18],[0,1.16],[cut.hem-.05,1.18],[cut.waist-.05,2.0],[cut.chest-.05,2.6]],.38,body);shirtLayer.position.z=-.19;
  // One deep back panel carries the coat around the sides; the two front panels
  // stop short of the centre line, and the vertical seam left between them and the
  // back panel is the coat's side vent.
  const back=p.panel('coat-back',coat,[[cut.shoulder,3.03],[-cut.shoulder,3.03],[-cut.chest,2.6],[-cut.waist,2.0],[-cut.hem,1.15],[0,1.1],[cut.hem,1.15],[cut.waist,2.0],[cut.chest,2.6]],.34,body);back.position.z=-.27;

  for(const sign of[-1,1]){
   const side=sign<0?'left':'right';
   const front=p.panel('coat-front-'+side,coat,[[sign*cut.shoulder,3],[sign*.13,3.05],[sign*.16,2.72],[sign*.185,2.3],[sign*.21,1.6],[sign*.245,1.13],[sign*(cut.hem+.02),1.18],[sign*cut.chest,2.6]],.05,body);front.position.z=.2;
   const collar=p.panel('coat-collar-'+side,coat,[[sign*cut.collar,3.15],[sign*.09,3.12],[sign*.1,2.94],[sign*(cut.collar-.02),2.92]],.05,body);collar.position.z=.07;
  }
  // Retain the complete stethoscope silhouette and its original chest anchor.
  p.curve('stethoscope-yoke',tube,[[-.16,3.17,-.02],[-.2,3.11,-.19],[0,3.13,-.28],[.2,3.11,-.19],[.16,3.17,-.02]],.015,body);
  p.curve('stethoscope-tube-left',tube,[[-.17,3.16,.08],[-.27,2.95,.32],[-.31,2.7,.335],[-.3,2.5,.33]],.014,body);
  p.curve('stethoscope-tube-right',tube,[[.17,3.16,.08],[.2,2.98,.31],[.205,2.78,.33],[.21,2.63,.325]],.014,body);
  p.limb('stethoscope-bell',bell,[-.3,2.42,.27],[-.3,2.42,.36],.062,body);
  rig.wear(['sleeve-upper-left','sleeve-upper-right','sleeve-lower-left','sleeve-lower-right','shoulder-left','shoulder-right','elbow-left','elbow-right'],coat);
  rig.wear(['pelvis','thigh-left','thigh-right','knee-left','knee-right','shin-left','shin-right'],slacks);
  rig.wear(['shoe-left','shoe-right'],shoe);
  rig.update(0);
  return {object:rig.object,modelRef:MODEL_REF,variant:{gender:female?'F':'M',age:size.age,ordinal},update:seconds=>rig.update(seconds),dispose:()=>rig.dispose()};
 }
 return {create,MODEL_REF};
});