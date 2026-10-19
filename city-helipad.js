/* Rooftop helipad on the tallest tower: a raised deck with a painted ring, an H,
 * edge markers and a windsock, plus a helicopter that parks, lifts off, flies one
 * closed circuit over the city and lands again — one 96-second cycle.
 *
 * Roof choice: among city.buildings that are neither facility nor housing, the one
 * with the most floors (ties by id). Its roof level is floors*6+8, the same
 * convention city-scene.js frames that building with.
 *
 * Raised deck, not a roof corner — and this is the stated choice, so it holds for
 * every roof module the district draws. The roof modules top out above their own
 * base at floors*6+1.4: solar array and plant room 2.9 and 5.01, and the
 * Roof_Garden ornamental tree 5.928, which is the tallest of the three. A 0.5-unit
 * slab whose top is the roof level leaves its underside at floors*6+7.5, higher
 * than every drawn roof feature, so the deck cannot cut a solar array, a planter,
 * a pergola or a plant room of any roof, and it needs no columns — a corner pad
 * large enough for a rotor would have to stand inside one of those arrays. The deck
 * is also inside the tower's top footprint, radius <= min(w,d)/2-1, so it never
 * reads as bolted on past the roof edge. It appears with the roof module: nothing is
 * drawn until the tower itself is complete.
 *
 * plan() and sample() are pure: plan(city) settles the roof and the circuit from the
 * model alone, and sample(plan, time) is the whole flight — phase, position,
 * heading, bank, pitch and rotor angle — computed from absolute time, never
 * accumulated, so pausing, scrubbing, exporting and the Canvas fallback all agree.
 * The circuit is an ellipse through the pad and the board centre, so the aircraft
 * leaves the deck, crosses the middle of the city and returns to the same spot.
 */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CityHelipad=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  // The tower's plain roof means the top floor slab IS the roof: its top sits at
  // 1.4 + floors*6 (the district's own floor placement), so the deck rests on that
  // instead of floating at the old roof-module height.
  const TAU=Math.PI*2,FLOOR=6,SLAB_TOP=1.4,ROOF_RISE=SLAB_TOP;
  // Deck: slab thickness and radius cap, painted ring band, marking sizes.
  const PAD={deck:.5,maxRadius:8,ringGap:.2,ringWidth:.65,marker:.7,hBar:3.6,hWidth:.6,hGap:.8,paint:.03};
  // Tallest drawn roof feature above the roof module base, from the exported district
  // asset (Roof_Garden, 5.928, over a roof base at the tower's own floors*6+1.4).
  const ROOF_FURNITURE=1.4+5.928;
  // One cycle. The rotor idles while parked and runs at full speed for the flight.
  const CYCLE={period:96,takeOff:22,airborne:30,homecoming:72,touchdown:80,lift:10,cruise:150,idleSpin:12,flightSpin:1.5};
  // Turn rate to bank, level-cruise nose-down attitude, and both clamps.
  const BANK=2.6,MAX_BANK=.42,PITCH=-.012,MAX_PITCH=.16;
  // Main rotor radius; the blades turn inside the painted ring on the deck.
  const ROTOR=5.2;
  const TINT={deck:'#d9d4c3',paint:'#f6f8f5',pole:'#e9ecec',cloth:'#d4694f',sock:'#8d979b',
    body:'#3f5159',trim:'#39484f',rotor:'#ccd5d7',skid:'#2f3b41',glass:'#74a9b6'};
  const CYCLE_TURNS=CYCLE.takeOff/CYCLE.idleSpin+(CYCLE.touchdown-CYCLE.takeOff)/CYCLE.flightSpin+
    (CYCLE.period-CYCLE.touchdown)/CYCLE.idleSpin;
  const CRUISE_RISE=20;

  function clamp(value,low,high){return Math.max(low,Math.min(high,value));}
  function smoothstep(value){const v=clamp(value,0,1);return v*v*(3-2*v);}

  // The tallest ordinary building, ties by id. Civic and housing lots are excluded:
  // their roofs are their own modules, not the district's stacked roof levels.
  function choose(city){
    let tower=null;
    ((city&&city.buildings)||[]).forEach(building=>{
      if(building.facility||building.housing)return;
      if(!tower||building.floors>tower.floors||
        (building.floors===tower.floors&&String(building.id)<String(tower.id)))tower=building;
    });
    return tower;
  }

  function plan(city){
    const tower=choose(city);
    if(!tower)return null;
    const roofY=tower.floors*FLOOR+ROOF_RISE,span=Math.hypot(tower.x,tower.z)||1;
    // Circuit ellipse: centred halfway to the board centre, so its far end lands on
    // the canal in the middle of the city and its near end is the pad itself.
    const u={x:-tower.x/span,z:-tower.z/span},v={x:-u.z,z:u.x};
    // No roof furniture any more (the plain roof), so the deck is simply its own
    // nominal thickness resting on the slab top.
    const clearance=PAD.deck;
    return {
      buildingId:tower.id,x:tower.x,z:tower.z,roofY,radius:Math.min(PAD.maxRadius,Math.min(tower.w,tower.d)/2-1),
      floors:tower.floors,kind:tower.kind,w:tower.w,d:tower.d,
      deck:Math.min(PAD.deck,clearance-.15),clearance:clearance,
      // A cruise altitude that clears the tallest tower whatever the skyline setting;
      // 150 is the plain answer for the altitudes this city actually builds to.
      cruise:Math.max(CYCLE.cruise,roofY+CRUISE_RISE),
      // The deck appears with the roof module, at the frame the district completes it.
      readyAt:(tower.start||0)+(tower.floors-1)*(tower.step||0)+(tower.fallDuration||0),
      period:CYCLE.period,
      circuit:{cx:tower.x*.5,cz:tower.z*.5,a:span*.5,b:span*.5*.62,u:u,v:v}
    };
  }

  // The whole flight as a function of absolute time. Allocation-free when a caller
  // passes its own buffer, which is what update() does every frame.
  function sample(plan,time,out){
    const state=out||{};
    const moment=Number.isFinite(time)?Math.max(0,time):0;
    state.time=moment;
    if(!plan){
      state.phase='idle';state.x=0;state.y=0;state.z=0;state.heading=0;state.bank=0;state.pitch=0;
      state.rotor=0;state.rotorTurns=0;state.parked=true;state.grounded=true;state.visible=false;
      return state;
    }
    const circuit=plan.circuit,at=moment%CYCLE.period;
    // The parked heading is the circuit's own tangent at the pad, so heading is
    // continuous into the circuit and back out of it.
    const parkedHeading=Math.atan2(-circuit.v.z,-circuit.v.x);
    state.visible=moment>=plan.readyAt;
    if(at<CYCLE.takeOff||at>=CYCLE.touchdown){
      state.phase=at<CYCLE.takeOff?'parked':'shutdown';
      state.x=plan.x;state.z=plan.z;state.y=plan.roofY;
      state.heading=parkedHeading;state.bank=0;state.pitch=0;state.parked=true;state.grounded=true;
    }else if(at<CYCLE.airborne){
      state.phase='take-off';
      state.x=plan.x;state.z=plan.z;state.parked=false;state.grounded=false;
      state.y=plan.roofY+CYCLE.lift*smoothstep((at-CYCLE.takeOff)/(CYCLE.airborne-CYCLE.takeOff));
      state.heading=parkedHeading;state.bank=0;state.pitch=0;
    }else if(at<CYCLE.homecoming){
      const p=(at-CYCLE.airborne)/(CYCLE.homecoming-CYCLE.airborne);
      const phi=Math.PI+TAU*p,cosine=Math.cos(phi),sine=Math.sin(phi);
      state.phase='circuit';
      state.x=circuit.cx+circuit.a*cosine*circuit.u.x+circuit.b*sine*circuit.v.x;
      state.z=circuit.cz+circuit.a*cosine*circuit.u.z+circuit.b*sine*circuit.v.z;
      state.y=plan.roofY+CYCLE.lift+(plan.cruise-plan.roofY-CYCLE.lift)*Math.sin(Math.PI*p)*Math.sin(Math.PI*p);
      // Analytic tangent, curvature and speed: no finite differences, so a rewound
      // time gives the same heading and bank rather than a remembered slope.
      const fx=-circuit.a*sine*circuit.u.x+circuit.b*cosine*circuit.v.x;
      const fz=-circuit.a*sine*circuit.u.z+circuit.b*cosine*circuit.v.z;
      const gx=-circuit.a*cosine*circuit.u.x-circuit.b*sine*circuit.v.x;
      const gz=-circuit.a*cosine*circuit.u.z-circuit.b*sine*circuit.v.z;
      const rate=TAU/(CYCLE.homecoming-CYCLE.airborne),ramp=smoothstep(p/.14)*smoothstep((1-p)/.14);
      state.heading=Math.atan2(fz,fx);
      state.bank=clamp(BANK*(fx*gz-fz*gx)/(fx*fx+fz*fz)*rate,-MAX_BANK,MAX_BANK)*ramp;
      state.pitch=clamp(PITCH*Math.hypot(fx,fz)*rate,-MAX_PITCH,MAX_PITCH);
      state.parked=false;state.grounded=false;
    }else{
      state.phase='approach';
      state.x=plan.x;state.z=plan.z;state.parked=false;
      state.y=plan.roofY+CYCLE.lift*(1-smoothstep((at-CYCLE.homecoming)/(CYCLE.touchdown-CYCLE.homecoming)));
      state.heading=parkedHeading;state.bank=0;state.pitch=0;
      state.grounded=state.y<=plan.roofY+1e-9;
    }
    // The rotor keeps turning through every phase: the angle is the integral of a
    // piecewise-constant rate, so it never jumps and never winds back.
    let turns=Math.floor(moment/CYCLE.period)*CYCLE_TURNS;
    if(at<=CYCLE.takeOff)turns+=at/CYCLE.idleSpin;
    else{
      turns+=CYCLE.takeOff/CYCLE.idleSpin;
      if(at<=CYCLE.touchdown)turns+=(at-CYCLE.takeOff)/CYCLE.flightSpin;
      else turns+=(CYCLE.touchdown-CYCLE.takeOff)/CYCLE.flightSpin+(at-CYCLE.touchdown)/CYCLE.idleSpin;
    }
    state.rotorTurns=turns;
    state.rotor=(turns%1)*TAU;
    return state;
  }

  function create(T,kit,city,settings){
    // The pad follows the city alone, so the same city always keeps the same helipad.
    const data=(city&&city.helipad)||plan(city);
    const group=new T.Group();group.name='city-helipad';
    const geometries=[],materials=[],meshes=[],batches=new Map(),live=[],liveMeshes=new Set();
    let disposed=false,lastTime=null,instances=0,triangles=0;
    // One reusable sample buffer: update() never allocates.
    const motion={phase:'idle'};
    const matrix=new T.Matrix4(),aircraft=new T.Matrix4(),spinMatrix=new T.Matrix4();
    const tempA=new T.Matrix4(),tempB=new T.Matrix4();
    const position=new T.Vector3(),scale=new T.Vector3(),quaternion=new T.Quaternion();
    const yawQ=new T.Quaternion(),rollQ=new T.Quaternion(),pitchQ=new T.Quaternion();
    const up=new T.Vector3(0,1,0),axisX=new T.Vector3(1,0,0),axisZ=new T.Vector3(0,0,1);
    const color=new T.Color();
    function material(name,hex,parameters){
      const result=new T.MeshStandardMaterial(Object.assign({color:hex,roughness:.52,metalness:.22},parameters||{}));
      result.name=name;materials.push(result);return result;
    }
    const structure=material('helipad-deck','#ffffff');
    const glazing=material('helipad-canopy','#ffffff',{roughness:.12,metalness:.34});
    function own(geometry){geometries.push(geometry);return geometry;}
    const cube=own(new T.BoxGeometry(1,1,1));
    const drum=own(new T.CylinderGeometry(1,1,1,20));
    const kinds=new Map([[cube,'box'],[drum,'drum']]);
    let ring=null;
    if(data){
      // The painted ring is a real annulus sized to this pad and laid flat once.
      ring=own(new T.RingGeometry(data.radius-PAD.ringGap-PAD.ringWidth,data.radius-PAD.ringGap,72));
      ring.rotateX(-Math.PI/2);kinds.set(ring,'ring');
    }

    // One batch per (geometry, material) pair. Part costs the pad nothing extra and
    // flying() rides in the same batch with a matrix rewritten every frame, so the
    // whole pad and the whole helicopter come to four draw calls.
    function batchOf(geometry,mat){
      const key=geometry.uuid+'/'+mat.uuid;
      if(!batches.has(key))batches.set(key,{geometry:geometry,material:mat,kind:kinds.get(geometry)||'box',items:[],moving:false});
      return batches.get(key);
    }
    // A cell is [x, y, z, w, h, d, tint, yaw, pitch, roll]: scale in the part's own
    // frame, then its own pitch and roll, then its yaw.
    function add(batch,moving,cell,extra){
      yawQ.setFromAxisAngle(up,cell[7]||0);
      rollQ.setFromAxisAngle(axisX,cell[9]||0);
      pitchQ.setFromAxisAngle(axisZ,cell[8]||0);
      quaternion.copy(yawQ).multiply(rollQ).multiply(pitchQ);
      position.set(cell[0],cell[1],cell[2]);scale.set(cell[3],cell[4],cell[5]);
      matrix.compose(position,quaternion,scale);
      const item={local:matrix.clone(),tint:cell[6]||'#ffffff',batch:null,index:batch.items.length,spin:'',pivot:null};
      if(extra){
        item.spin=extra.spin||'';
        const pivot=extra.pivot;
        if(pivot)item.pivot=new T.Matrix4().makeTranslation(pivot[0],pivot[1],pivot[2]);
      }
      batch.items.push(item);
      return item;
    }
    function part(geometry,mat,x,y,z,w,h,d,tint,yaw,pitch,roll){
      return add(batchOf(geometry,mat),false,[x,y,z,w,h,d,tint,yaw,pitch,roll],null);
    }
    function flying(geometry,mat,x,y,z,w,h,d,tint,spin,pivot,yaw,pitch,roll){
      const batch=batchOf(geometry,mat);batch.moving=true;
      // A rotor part is stored relative to its pivot: the spin is applied about the
      // mast, then the aircraft's own transform on top of it.
      const px=pivot?pivot[0]:0,py=pivot?pivot[1]:0,pz=pivot?pivot[2]:0;
      const item=add(batch,true,[x-px,y-py,z-pz,w,h,d,tint,yaw||0,pitch||0,roll||0],{spin:spin,pivot:pivot});
      live.push(item);
      return item;
    }

    if(data){
      const roofY=data.roofY,radius=data.radius;
      // The pad's own frame: `dir` is the heading the aircraft parks on, `side` its
      // left. Markings are laid out in that frame, so the H and the aircraft agree.
      const heading=Math.atan2(-data.circuit.v.z,-data.circuit.v.x);
      const dir={x:Math.cos(heading),z:Math.sin(heading)},side={x:-Math.sin(heading),z:Math.cos(heading)};
      const yaw=-heading;
      const place=(dx,dz)=>[data.x+dir.x*dx+side.x*dz,data.z+dir.z*dx+side.z*dz];
      const box=(x,y,z,w,h,d,tint,turn)=>part(cube,structure,x,y,z,w,h,d,tint,turn===undefined?yaw:turn);
      const tube=(x,y,z,r,h,tint,turn,pitch)=>part(drum,structure,x,y,z,r,h,r,tint,turn===undefined?yaw:turn,pitch);
      // Deck, painted ring, H, edge markers and windsock. Nothing reaches below
      // roofY-deck: that is what keeps the deck clear of the roof furniture.
      tube(data.x,roofY-data.deck/2,data.z,radius,data.deck,TINT.deck,0,0);
      part(ring,structure,data.x,roofY+PAD.paint/2,data.z,1,1,1,TINT.paint);
      [-PAD.hGap,PAD.hGap].forEach(offset=>{
        const spot=place(0,offset);
        box(spot[0],roofY+PAD.paint/2,spot[1],PAD.hBar,PAD.paint,PAD.hWidth,TINT.paint);
      });
      box(data.x,roofY+PAD.paint/2,data.z,PAD.hWidth,PAD.paint,PAD.hGap*2+PAD.hWidth,TINT.paint);
      for(let tick=0;tick<8;tick++){
        const angle=heading+tick*Math.PI/4;
        const edge=radius-PAD.ringGap-PAD.ringWidth-PAD.marker*.75;
        box(data.x+Math.cos(angle)*edge,roofY+PAD.paint/2,data.z+Math.sin(angle)*edge,PAD.marker,PAD.paint,.3,TINT.paint,-angle);
      }
      const sock=place(0,radius-.8);
      box(sock[0],roofY+.14,sock[1],1.1,.28,1.1,TINT.sock);
      tube(sock[0],roofY+2.6,sock[1],.11,5.2,TINT.pole);
      for(let band=0;band<3;band++){
        const spot=place(.75+band*.5,radius-.8);
        tube(spot[0],roofY+4.75,spot[1],.38,.5,band%2?TINT.pole:TINT.cloth,undefined,-Math.PI/2);
      }
    }

    // The helicopter, in its own frame: +x the nose, +y up, +z its left. Its skids
    // touch y=0 at the deck contact point, so a parked sample is the deck level.
    if(data){
      const mast=[-.3,4.5,0],tailHub=[-6.15,3.5,.42];
      const box=(x,y,z,w,h,d,tint)=>flying(cube,structure,x,y,z,w,h,d,tint);
      const pane=(x,y,z,w,h,d)=>flying(cube,glazing,x,y,z,w,h,d,TINT.glass);
      const tube=(x,y,z,r,h,tint,turn,pitch)=>flying(drum,structure,x,y,z,r,h,r,tint,'',null,turn,pitch);
      const blade=(x,y,z,w,h,d,tint,spin,pivot)=>flying(cube,structure,x,y,z,w,h,d,tint,spin,pivot);
      box(0,2.05,0,4.6,1.8,2.3,TINT.body);                             // cabin
      box(2.75,1.95,0,1.0,1.35,1.7,TINT.body);                         // nose
      box(3.4,1.85,0,.35,.9,1.1,TINT.trim);                            // nose tip
      box(-.55,3.1,0,2.4,.45,1.65,TINT.trim);                          // engine deck
      box(-1.75,3.0,.55,.5,.5,.5,TINT.trim);                           // exhaust
      box(-3.55,2.7,0,2.6,.92,.92,TINT.trim);                          // tail boom
      box(-5.25,2.7,0,1.1,.68,.68,TINT.trim);
      box(-6.05,3.6,0,.95,1.7,.2,TINT.trim);                           // fin
      box(-6.25,2.8,0,1.0,.14,2.6,TINT.trim);                          // stabiliser
      [-1.06,1.06].forEach(x=>[-1.15,1.15].forEach(z=>box(x,.71,z,.2,.9,.2,TINT.trim)));
      [-1.3,1.3].forEach(z=>tube(-.1,.13,z,.13,4.8,TINT.skid,undefined,-Math.PI/2));
      pane(1.75,2.45,0,1.0,1.05,1.95);                                 // windscreen
      [-1.16,1.16].forEach(z=>pane(-.35,2.45,z,1.7,.85,.08));
      tube(mast[0],3.75,0,.13,1.2,TINT.trim);                          // mast
      tube(mast[0],4.4,0,.32,.3,TINT.trim);                            // hub
      [-2.6,2.6].forEach(offset=>blade(mast[0]+offset,mast[1],0,ROTOR,.07,.5,TINT.rotor,'y',mast));
      flying(drum,structure,tailHub[0],tailHub[1],tailHub[2],.22,.3,.22,TINT.trim,'',null,0,0,Math.PI/2);
      [-.55,.55].forEach(offset=>blade(tailHub[0],tailHub[1]+offset,tailHub[2],.12,1.1,.1,TINT.rotor,'z',tailHub));
    }

    batches.forEach(batch=>{
      const mesh=new T.InstancedMesh(batch.geometry,batch.material,batch.items.length);
      mesh.name=batch.material.name+'-'+batch.kind;
      batch.items.forEach((item,index)=>{
        mesh.setMatrixAt(index,item.local);
        mesh.setColorAt(index,color.set(item.tint));
        item.batch=mesh;item.index=index;
        const indexed=batch.geometry.index;
        triangles+=(indexed?indexed.count:batch.geometry.attributes.position.count)/3;
      });
      mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
      mesh.castShadow=true;mesh.receiveShadow=true;
      // A baked bounding sphere cannot follow an aircraft: those batches are never
      // culled and their instance buffer is re-uploaded every frame.
      mesh.frustumCulled=batch.moving===false;
      if(batch.moving){mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);liveMeshes.add(mesh);}
      else mesh.computeBoundingSphere();
      instances+=batch.items.length;
      group.add(mesh);meshes.push(mesh);
    });

    function update(time){
      if(disposed)return;
      const moment=Number.isFinite(time)?Math.max(0,time):0;
      if(moment===lastTime)return;
      lastTime=moment;sample(data,moment,motion);
      group.visible=motion.visible;
      if(!data)return;
      // The aircraft's frame: yaw first, then its own roll and pitch. Every moving
      // part is the same composition, so a rewound time reproduces both exactly.
      yawQ.setFromAxisAngle(up,-motion.heading);
      rollQ.setFromAxisAngle(axisX,motion.bank);
      pitchQ.setFromAxisAngle(axisZ,motion.pitch);
      quaternion.copy(yawQ).multiply(rollQ).multiply(pitchQ);
      position.set(motion.x,motion.y,motion.z);scale.set(1,1,1);
      aircraft.compose(position,quaternion,scale);
      for(let index=0;index<live.length;index++){
        const item=live[index];
        if(item.spin)spinMatrix.makeRotationAxis(item.spin==='y'?up:axisZ,motion.rotor);
        else spinMatrix.identity();
        tempA.multiplyMatrices(spinMatrix,item.local);
        if(item.pivot)tempB.multiplyMatrices(item.pivot,tempA);else tempB.copy(tempA);
        tempA.multiplyMatrices(aircraft,tempB);
        item.batch.setMatrixAt(item.index,tempA);
      }
      liveMeshes.forEach(mesh=>{mesh.instanceMatrix.needsUpdate=true;});
    }

    function getInfo(){
      return {
        ready:!disposed,
        drawCalls:disposed?0:meshes.length,
        instances:disposed?0:instances,
        triangles:disposed?0:triangles,
        building:data?{id:data.buildingId,x:data.x,z:data.z,roofY:data.roofY,floors:data.floors,
          kind:data.kind,w:data.w,d:data.d}:null,
        radius:data?data.radius:0,
        period:CYCLE.period,
        cruise:data?data.cruise:0,
        readyAt:data?data.readyAt:0,
        time:lastTime,
        phase:motion.phase,
        visible:disposed?false:group.visible,
        helicopter:data?{x:motion.x,y:motion.y,z:motion.z,heading:motion.heading,bank:motion.bank,
          pitch:motion.pitch,rotor:motion.rotor,rotorTurns:motion.rotorTurns,parked:motion.parked,
          grounded:motion.grounded}:null
      };
    }
    function dispose(){
      if(disposed)return;
      disposed=true;group.visible=false;group.removeFromParent();
      meshes.forEach(mesh=>{if(mesh.isInstancedMesh)mesh.dispose();});
      geometries.forEach(geometry=>geometry.dispose());
      materials.forEach(entry=>entry.dispose());
      group.clear();batches.clear();live.length=0;liveMeshes.clear();meshes.length=0;
    }
    const controller={group:group,update:update,dispose:dispose,getInfo:getInfo,plan:data};
    if(data)update(0);
    return controller;
  }

  return {plan:plan,sample:sample,create:create,choose:choose,PAD:PAD,CYCLE:CYCLE,ROOF_FURNITURE:ROOF_FURNITURE};
});
