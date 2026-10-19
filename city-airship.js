/* Neon advertising airship. Absolute-time flight; two owned render batches.
 * Local +X is the nose. Four moving searchlights reuse the town's GPU volume batch. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CityAirship=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TAU=Math.PI*2, SIZE={length:72,height:22,width:25,bottom:21}, COPY={title:'千人小镇',subtitle:'N E O N   S K Y',footer:'让每一个梦想 · 发光'};
  function plan(city){
    city=city||{};
    const roof=Math.max(0,...(city.buildings||[]).map(b=>(b.floors||0)*(b.floorHeight||6)+22),...(city.places||[]).map(p=>p.height||0));
    // Helicopter rises to max(150, tallest ordinary roof + 20). Extra 64 covers
    // its rotor, our gondola, bob, bank and at least 16 units of free air.
    return {rx:Math.max(70,(city.extentX||190)*.71),rz:Math.max(90,(city.extentZ||258)*.64),altitude:Math.max(150,roof)+64,period:240};
  }
  function sample(route,time,out){
    const s=out||{},t=Number.isFinite(time)?Math.max(0,time):0,p=route||plan(),a=(t%p.period)/p.period*TAU+.65;
    s.x=Math.cos(a)*p.rx;s.z=Math.sin(a)*p.rz;s.y=p.altitude+Math.sin(a*2)*2;
    s.heading=Math.atan2(p.rz*Math.cos(a),-p.rx*Math.sin(a));s.bank=Math.sin(a)*.025;
    s.pulse=.88+.12*Math.sin(a*8);return s;
  }
  function makeAtlas(T){
    if(typeof document==='undefined'){
      const data=new Uint8Array([255,255,255,255]);const tex=new T.DataTexture(data,1,1);tex.needsUpdate=true;const emission=tex.clone();emission.needsUpdate=true;return {map:tex,emission};
    }
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=320;
    const c=canvas.getContext('2d');c.fillStyle='#ffffff';c.fillRect(0,0,1024,320);
    c.fillStyle='#08172d';c.fillRect(0,32,1024,288);
    const g=c.createLinearGradient(0,32,1024,320);g.addColorStop(0,'#16344d');g.addColorStop(.55,'#102137');g.addColorStop(1,'#302249');c.fillStyle=g;c.fillRect(0,32,1024,288);
    c.strokeStyle='rgba(82,218,255,.11)';c.lineWidth=1;
    for(let x=0;x<1024;x+=16){c.beginPath();c.moveTo(x,32);c.lineTo(x,320);c.stroke();}
    for(let y=32;y<320;y+=8){c.beginPath();c.moveTo(0,y);c.lineTo(1024,y);c.stroke();}
    c.strokeStyle='#54ecff';c.lineWidth=5;c.strokeRect(12,43,1000,264);
    c.textAlign='center';c.textBaseline='middle';c.shadowColor='#39deff';c.shadowBlur=16;c.fillStyle='#d7fcff';
    c.font='700 108px "Microsoft YaHei",sans-serif';c.fillText(COPY.title,512,141);
    c.shadowBlur=5;c.fillStyle='#e1b4ff';c.font='500 33px Arial,sans-serif';c.fillText(COPY.subtitle,512,229);
    c.shadowBlur=0;c.fillStyle='#9cf3ff';c.font='22px "Microsoft YaHei",sans-serif';c.fillText(COPY.footer,512,277);
    const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
    const mask=document.createElement('canvas');mask.width=1024;mask.height=320;const m=mask.getContext('2d');m.drawImage(canvas,0,0);m.fillStyle='#000000';m.fillRect(0,0,1024,16);
    const emission=new T.CanvasTexture(mask);emission.colorSpace=T.SRGBColorSpace;return {map:tex,emission};
  }
  function create(T,kit,city){
    const route=plan(city),group=new T.Group();group.name='neon-ad-airship';
    const solid=[],lit=[],halo=[],geometries=[],materials=[],atlas=makeAtlas(T),texture=atlas.map,pose={};
    let disposed=false,lastLamps=0;
    const tmp=new T.Object3D(),color=new T.Color(),beamDirection=new T.Vector3();
    function append(list,geo,tint,x=0,y=0,z=0,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,screen=false){
      tmp.position.set(x,y,z);tmp.scale.set(sx,sy,sz);tmp.rotation.set(rx,ry,rz);tmp.updateMatrix();
      const raw=geo.index?geo.toNonIndexed():geo.clone();geo.dispose();raw.applyMatrix4(tmp.matrix);
      const count=raw.attributes.position.count,colors=new Float32Array(count*3),uv=new Float32Array(count*2);color.set(tint);
      for(let i=0;i<count;i++){colors.set([color.r,color.g,color.b],i*3);
        if(screen){uv[i*2]=raw.attributes.uv.getX(i);uv[i*2+1]=raw.attributes.uv.getY(i)*.9;}
        else {uv[i*2]=.5;uv[i*2+1]=list===lit?.925:.98;}}
      raw.setAttribute('color',new T.BufferAttribute(colors,3));raw.setAttribute('uv',new T.BufferAttribute(uv,2));list.push(raw);
    }
    function merge(parts){
      const geo=new T.BufferGeometry();for(const key of ['position','normal','color','uv']){
        const size=key==='uv'?2:3,values=new Float32Array(parts.reduce((n,g)=>n+g.attributes[key].array.length,0));let at=0;
        parts.forEach(g=>{values.set(g.attributes[key].array,at);at+=g.attributes[key].array.length;});geo.setAttribute(key,new T.BufferAttribute(values,size));}
      parts.forEach(g=>g.dispose());geo.computeBoundingSphere();geometries.push(geo);return geo;
    }
    const box=(list,x,y,z,w,h,d,tint,rz=0)=>append(list,new T.BoxGeometry(1,1,1),tint,x,y,z,w,h,d,0,0,rz);
    function line(points,tint,radius=.16,withHalo=true){
      const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
      append(lit,new T.TubeGeometry(curve,Math.max(8,points.length-1),radius,4,false),tint);
      // The translucent glow needs fewer longitudinal segments than the solid neon.
      if(withHalo)append(halo,new T.TubeGeometry(curve,Math.max(8,Math.ceil((points.length-1)/2)),radius*5,3,false),tint);
    }
    // Tapered, faceted pressure envelope with a dark metallic belly.
    append(solid,new T.SphereGeometry(1,32,16),'#77849d',0,0,0,36,11,12.5);
    append(solid,new T.SphereGeometry(1,24,12),'#26354b',0,-4.8,0,31,6.6,10.2);
    // Two tail fins and a vertical stabiliser: deliberate long silhouette.
    for(const side of [-1,1]){
      box(solid,-29,0,side*11,15,.7,13,'#465575',side*.02);
      line([[-36,.6,side*15],[-25,.6,side*17],[-22,.6,side*7]],side>0?'#e69aff':'#58eaff');
    }
    box(solid,-28,9,0,11,12,.8,'#445775',-.32);
    line([[-35,7,0],[-32,16,0],[-23,13,0]],'#cb91ff');
    // Gondola, two pylons, panoramic cabin glazing and compact electric nacelles.
    for(const x of [-8,8])box(solid,x,-11,0,1.1,8,1.1,'#738397');
    append(solid,new T.SphereGeometry(1,20,10),'#34455c',3,-14,0,12,3.4,4.8);
    for(const side of [-1,1]){
      for(let i=0;i<5;i++)box(lit,-5+i*3.3,-13.5,side*4.35,2.6,1.55,.12,'#a4eeff');
      box(solid,-15,-10,side*9,2,2,5,'#4c5c78');
      append(solid,new T.CylinderGeometry(2.4,2.4,6,16,1,false),'#30455b',-15,-11,side*12,1,1,1,0,0,Math.PI/2);
      const ring=[];for(let j=0;j<=24;j++){const a=j/24*TAU;ring.push([-18.1,-11+Math.cos(a)*1.8,side*12+Math.sin(a)*1.8]);}
      line(ring,side>0?'#ce88ff':'#63eaff',.16);
    }
    // Long luminous seams follow the actual ellipsoid surface.
    for(const angle of [.6,Math.PI-.6,Math.PI+.6,TAU-.6]){
      const pts=[];for(let i=0;i<=32;i++){const x=-33+i*66/32,r=Math.sqrt(1-x*x/(36*36));pts.push([x,Math.sin(angle)*11.15*r,Math.cos(angle)*12.7*r]);}
      line(pts,angle<Math.PI?'#65eeff':'#c890ff',.14);
    }
    for(const x of [-26,25]){
      const pts=[],r=Math.sqrt(1-x*x/(36*36));for(let i=0;i<=32;i++){const a=i/32*TAU;pts.push([x,Math.sin(a)*11.15*r,Math.cos(a)*12.65*r]);}line(pts,'#94baff',.13,false);
    }
    // Compact gondola lenses join the existing geometry; no extra mesh batches.
    const beamEmitters=[],hullLights=[];
    const Fireworks=globalThis.CityFireworks||(typeof require==='function'?require('./city-fireworks.js'):null);
    for(const x of [-9,9])for(const side of [-1,1]){
      const y=-18.5,z=side*6.2;
      box(solid,x,y,z,.6,.4,.65,'#334b68');box(lit,x,y-.23,z,.45,.07,.48,side>0?'#a889ff':'#6bf1ff');
      const light=new T.SpotLight(side>0?'#d5c5a8':'#92bbd6',0,route.altitude+35,.05,.85,1);
      light.name='airship-searchlight-'+beamEmitters.length;light.position.set(x,y-.27,z);light.castShadow=false;
      group.add(light,light.target);beamEmitters.push({light,length:route.altitude+35,radius:(route.altitude+35)*.05,level:0,phase:beamEmitters.length*1.8,gain:.75});
    }
    for(const side of [-1,1]){
      const light=new T.SpotLight(side>0?'#b6a5ff':'#a3eaff',0,75,1.05,.82,1);
      light.name='airship-hull-wash-'+hullLights.length;light.position.set(-18,17,side*20);light.target.position.set(8,1,side*7);light.castShadow=false;
      group.add(light,light.target);hullLights.push(light);
    }
    // Two distinct, readable outward-facing curved screens share one atlas.
    for(const side of [-1,1]){
      const geo=new T.PlaneGeometry(47,11.5,24,8),p=geo.attributes.position;
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),y=p.getY(i),z=(12.5*Math.sqrt(Math.max(.05,1-x*x/1296-y*y/121))+.3)*side;
        p.setXYZ(i,side>0?x:-x,y,z);
      }
      geo.computeVertexNormals();append(lit,geo,'#ffffff',0,0,0,1,1,1,0,0,0,true);
      for(const y of [-6,6]){
        const pts=[];for(let i=0;i<=24;i++){const x=-24+i*2;pts.push([x,y,side*(12.5*Math.sqrt(Math.max(.05,1-x*x/1296-y*y/121))+.45)]);}line(pts,side>0?'#69eeff':'#da94ff',.19);
      }
    }
    box(lit,35.5,0,0,.65,1.2,1.2,'#f2edff');box(lit,-35.5,0,0,.5,1,1,'#ef93e6');
    const bodyMat=new T.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.48,metalness:.3,map:texture,emissiveMap:atlas.emission,emissive:'#ffffff',emissiveIntensity:1});
    bodyMat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif');};
    bodyMat.customProgramCacheKey=()=> 'airship-emissive-v1';
    const glowMat=new T.MeshBasicMaterial({color:'#ffffff',vertexColors:true,transparent:true,opacity:.16,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
    materials.push(bodyMat,glowMat);
    [solid.concat(lit),halo].forEach((parts,i)=>{const mesh=new T.Mesh(merge(parts),materials[i]);mesh.name=['airship-hull-advert-and-neon','airship-soft-glow'][i];mesh.castShadow=false;mesh.receiveShadow=false;group.add(mesh);});
    function update(time,lighting){
      if(disposed)return;sample(route,time,pose);group.position.set(pose.x,pose.y,pose.z);group.rotation.set(0,-pose.heading,0);group.rotateX(pose.bank);
      const lamps=Math.max(0,Math.min(1,lighting&&Number.isFinite(lighting.lamps)?lighting.lamps:0));lastLamps=lamps;
      bodyMat.emissiveIntensity=.72+1.15*lamps;glowMat.opacity=(.025+.24*lamps)*pose.pulse;
      const second=Number.isFinite(time)?Math.max(0,time):0;
      // Flight uses construction time; the light show follows the town clock.
      const show=Fireworks&&Number.isFinite(lighting?.minute)&&Fireworks.nightlyState(lighting.minute*.625).enabled;
      for(const e of beamEmitters){
        const a=second*.055+e.phase,side=e.light.position.z>0?1:-1;
        e.light.target.position.copy(e.light.position).add(beamDirection.set(Math.sin(a)*.34,-1,side*(.22+.15*Math.cos(a*.7))).normalize().multiplyScalar(e.length));
        e.level=show?lamps:0;e.light.intensity=150*e.level;
      }
      hullLights.forEach(light=>light.intensity=44*lamps);group.updateMatrix();group.updateMatrixWorld(true);
    }
    function dispose(){if(disposed)return;disposed=true;if(group.parent)group.parent.remove(group);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());texture.dispose();atlas.emission.dispose();group.clear();}
    update(0,{lamps:0});
    return {group,update,dispose,beamEmitters,getInfo:()=>({route:{...route},position:{x:pose.x,y:pose.y,z:pose.z},heading:pose.heading,lamps:lastLamps,drawBatches:2,triangles:geometries.reduce((n,g)=>n+g.attributes.position.count/3,0),advert:COPY.title,subtitle:COPY.subtitle,lighting:{activeBeams:disposed?0:beamEmitters.filter(e=>e.light.intensity>0).length,hullLights:disposed?0:hullLights.filter(l=>l.intensity>0).length}})};
  }
  // Canvas fallback shares the flight and projects physical anchors; simplified body shading.
  function drawCanvas(ctx,project,motion,lamps){
    const c=Math.cos(motion.heading),s=Math.sin(motion.heading);
    const p=(x,y,z)=>project(motion.x+c*x-s*z,motion.z+s*x+c*z,motion.y+y);
    const nose=p(36,0,0),tail=p(-36,0,0),mid=p(0,0,0),up=p(0,11,0);
    const length=Math.hypot(nose[0]-tail[0],nose[1]-tail[1]),radius=Math.max(2,Math.hypot(up[0]-mid[0],up[1]-mid[1]));
    if(!Number.isFinite(length)||length<1)return;
    const angle=Math.atan2(nose[1]-tail[1],nose[0]-tail[0]);
    ctx.save();ctx.translate(mid[0],mid[1]);ctx.rotate(Math.cos(angle)<0?angle+Math.PI:angle);
    const grad=ctx.createLinearGradient(0,-radius,0,radius);grad.addColorStop(0,'#9aa6bc');grad.addColorStop(.5,'#4f6585');grad.addColorStop(1,'#182d48');
    ctx.fillStyle=grad;ctx.beginPath();ctx.ellipse(0,0,length/2,radius,0,0,TAU);ctx.fill();
    ctx.strokeStyle='#68ecff';ctx.lineWidth=Math.max(1,length/300);ctx.shadowColor='#64dcff';ctx.shadowBlur=(lamps||0)*12;ctx.stroke();
    ctx.fillStyle='#182a44';ctx.fillRect(-length*.33,-radius*.52,length*.66,radius*1.04);
    ctx.strokeStyle='#d58eff';ctx.strokeRect(-length*.33,-radius*.52,length*.66,radius*1.04);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#d5fcff';ctx.font='700 '+Math.max(6,radius*.56)+'px "Microsoft YaHei",sans-serif';ctx.fillText(COPY.title,0,-radius*.08);
    ctx.font=Math.max(4,radius*.22)+'px sans-serif';ctx.fillStyle='#d69bff';ctx.fillText('NEON SKY',0,radius*.31);ctx.restore();
    const poly=(points,color)=>{ctx.beginPath();points.forEach((v,i)=>{const q=p(...v);if(i)ctx.lineTo(...q);else ctx.moveTo(...q);});ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#91c8ff';ctx.lineWidth=1;ctx.stroke();};
    ctx.save();poly([[-34,4,0],[-32,16,0],[-23,13,0],[-23,4,0]],'#425473');
    const cabin=p(3,-14,0);ctx.fillStyle='#7cdbea';ctx.beginPath();ctx.ellipse(cabin[0],cabin[1],length*.12,radius*.22,angle,0,TAU);ctx.fill();ctx.restore();
  }
  return {SIZE,COPY,plan,sample,create,drawCanvas};
});
