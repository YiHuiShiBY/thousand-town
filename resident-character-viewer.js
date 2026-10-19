/* One renderer for shared city figures and real role-specific mesh rigs. */
(function(root){
 'use strict';
 function create({container,onSelect,onFocus,onStats}){
  const T=root.THREE;
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.autoClear=false;
  renderer.setPixelRatio(Math.min(root.devicePixelRatio||1,1.5));renderer.domElement.className='preview-canvas';renderer.domElement.setAttribute('aria-hidden','true');container.prepend(renderer.domElement);
  const kit=root.CityMaterials.create(T,renderer,{}),clothes=new T.MeshStandardMaterial({color:'#ffffff',roughness:.85});
  const sourceMaterials={skin:kit.skin,dark:kit.dark,clothes};
  const floorGeometry=new T.PlaneGeometry(30,30),floorMaterial=new T.MeshStandardMaterial({color:'#b4c6c4',roughness:1});
  const grid=new T.GridHelper(30,30,'#95acab','#a9bdbb'),gridGeometry=grid.geometry,gridMaterial=grid.material;
  let entries=[],specs=[],viewCache=new Map(),raf=0,disposed=false,inView=true,lastFrame=0,renderCount=0,clock=0,started=performance.now();
  const options={linked:true,play:false,rotate:false,wireframe:false,clay:false,view:'3d',pose:'walker',night:false};
  const initial=()=>{const [yaw,pitch]=viewFor(options.view);return {yaw,pitch,radius:10.8,target:[0,1.9,0]};};
  const viewFor=name=>({front:[Math.PI/2,.01],side:[0,.01],back:[-Math.PI/2,.01],top:[0,1.48],'3d':[.65,.16]})[name]||[.65,.16];
  function elapsed(now=performance.now()){return clock+(options.play?(now-started)/1000:0);}
  function actorFor(){
   const pose=options.pose;return {kind:pose==='commuter'?'commuter':pose==='jogger'?'jogger':pose==='vendor'?'vendor':'walker',standing:pose==='standing'||pose==='vendor',phase:0,color:'#648979'};
  }
  function applyCamera(entry){
   const v=entry.view,cp=Math.cos(v.pitch),t=v.target;
   entry.camera.position.set(t[0]+v.radius*cp*Math.sin(v.yaw),t[1]+v.radius*Math.sin(v.pitch),t[2]+v.radius*cp*Math.cos(v.yaw));
   entry.camera.lookAt(...t);entry.camera.updateMatrixWorld();
  }
  function synchronize(entry){
   if(options.linked)for(const other of entries)if(other!==entry){other.view={...entry.view,target:entry.view.target.slice()};applyCamera(other);}
  }
  function request(){if(!disposed&&!raf&&!document.hidden&&inView&&entries.length)raf=requestAnimationFrame(frame);}
  function meshes(preview){const list=[];preview.object.traverse(part=>{if(part.isMesh)list.push(part);});return list;}
  function applyDisplay(entry){
   for(const mesh of meshes(entry.preview)){
    const original=entry.originals.get(mesh.material);
    mesh.material.color.copy(options.clay?entry.clayColor:original.color);mesh.material.wireframe=options.wireframe;
    if(mesh.instanceColor){
     if(options.clay)for(let i=0;i<mesh.count;i++)mesh.setColorAt(i,entry.white);
     else mesh.instanceColor.array.set(entry.colors.get(mesh));
     mesh.instanceColor.needsUpdate=true;
    }
    mesh.material.needsUpdate=true;
   }
   if(!entry.scene.background)entry.scene.background=new T.Color();entry.scene.background.set(options.night?'#627982':'#bfd0ce');
   entry.hemi.intensity=options.night?.55:1.6;entry.key.intensity=options.night?1.9:3.5;
  }
  function attachControls(entry){
   const element=entry.element;let pointer=null;
   const down=e=>{if(e.button!==0&&e.button!==2)return;e.preventDefault();pointer={id:e.pointerId,x:e.clientX,y:e.clientY,pan:e.button===2};element.setPointerCapture(e.pointerId);onSelect?.(entry.id);};
   const move=e=>{if(!pointer||pointer.id!==e.pointerId)return;
    const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer.x=e.clientX;pointer.y=e.clientY;
    if(pointer.pan){const k=entry.view.radius/Math.max(1,element.clientHeight);entry.view.target[0]-=dx*k*Math.cos(entry.view.yaw);entry.view.target[2]+=dx*k*Math.sin(entry.view.yaw);entry.view.target[1]+=dy*k;}
    else {entry.view.yaw-=dx*.008;entry.view.pitch=Math.max(-.35,Math.min(1.49,entry.view.pitch+dy*.007));}
    applyCamera(entry);synchronize(entry);request();
   };
   const up=e=>{if(pointer?.id===e.pointerId)pointer=null;};
   const wheel=e=>{e.preventDefault();entry.view.radius=Math.max(5.5,Math.min(22,entry.view.radius*Math.exp(e.deltaY*.001)));applyCamera(entry);synchronize(entry);request();};
   const context=e=>e.preventDefault();
   const double=e=>{e.preventDefault();onFocus?.(entry.id);};
   const handlers=[['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up],['wheel',wheel],['contextmenu',context],['dblclick',double]];
   handlers.forEach(([event,handler])=>element.addEventListener(event,handler,{passive:false}));
   entry.detach=()=>handlers.forEach(([event,handler])=>element.removeEventListener(event,handler));
  }
  function clearEntries(){for(const e of entries){viewCache.set(e.id,{...e.view,target:e.view.target.slice()});e.detach();e.preview.dispose();e.scene.clear();}entries=[];}
  function setCards(cards){
   const previous=entries[0]?.view;clearEntries();specs=cards.slice(0,4);
   for(const spec of specs){
    const builder=root.CityResidentCharacterModels?.resolve(spec.resident?.role);
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.1,100),preview=builder?builder.create(T,{resident:spec.resident,actor:actorFor()}):root.CityScene.createPersonPreview(T,{actor:actorFor(),materials:sourceMaterials});
    scene.add(preview.object);
    const floor=new T.Mesh(floorGeometry,floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.y=-.035;scene.add(floor);
    const localGrid=new T.LineSegments(gridGeometry,gridMaterial);localGrid.position.y=-.03;scene.add(localGrid);
    const hemi=new T.HemisphereLight('#e7f6f2','#748b82',1.6),key=new T.DirectionalLight('#fff5df',3.5);key.position.set(-3,8,5);scene.add(hemi,key);
    const fill=new T.DirectionalLight('#cadde9',.7);fill.position.set(4,3,-4);scene.add(fill);
    const savedView=options.linked?previous:viewCache.get(spec.id);
    const entry={...spec,scene,camera,preview,hemi,key,view:savedView?{...savedView,target:savedView.target.slice()}:initial(),originals:new Map(),colors:new Map(),clayColor:new T.Color('#e3e6dd'),white:new T.Color('#ffffff')};
    for(const mesh of meshes(preview)){entry.originals.set(mesh.material,{color:mesh.material.color.clone()});if(mesh.instanceColor)entry.colors.set(mesh,mesh.instanceColor.array.slice());}
    applyCamera(entry);applyDisplay(entry);attachControls(entry);entries.push(entry);
   }
   if(!entries.length){cancelAnimationFrame(raf);raf=0;renderer.setScissorTest(false);renderer.setClearColor(0,0);renderer.clear();}
   request();
  }
  function frame(now,force=false){
   raf=0;if(disposed||!entries.length||(!force&&(document.hidden||!inView)))return;
   const board=container.getBoundingClientRect(),width=container.clientWidth,height=container.clientHeight;
   if(!width||!height)return;
   const current=renderer.getSize(new T.Vector2());if(current.x!==width||current.y!==height)renderer.setSize(width,height,false);
   const seconds=elapsed(now),delta=lastFrame?Math.min(.05,(now-lastFrame)/1000):0;lastFrame=now;
   renderer.setScissorTest(false);renderer.setClearColor(0,0);renderer.clear();
   renderer.setScissorTest(true);
   for(const e of entries){
    const rect=e.element.getBoundingClientRect(),x=rect.left-board.left,y=board.bottom-rect.bottom;
    const left=Math.max(0,x),bottom=Math.max(0,y),right=Math.min(width,x+rect.width),top=Math.min(height,y+rect.height);
    if(right<=left||top<=bottom)continue;
    if(options.rotate){e.view.yaw+=delta*.3;applyCamera(e);}
    e.preview.update(seconds);e.camera.aspect=rect.width/Math.max(1,rect.height);e.camera.updateProjectionMatrix();
    renderer.setViewport(x,y,rect.width,rect.height);renderer.setScissor(left,bottom,right-left,top-bottom);
    renderer.clear(true,true,true);renderer.render(e.scene,e.camera);
   }
   renderCount++;
   if(onStats)for(const e of entries)onStats(e.id,stats(e));
   if(options.play||options.rotate)request();
  }
  function stats(entry){
   let triangles=0;for(const m of meshes(entry.preview))triangles+=(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1);
   const size=new T.Box3().setFromObject(entry.preview.object).getSize(new T.Vector3());
   return {meshes:meshes(entry.preview).length,triangles:Math.round(triangles),size:size.toArray()};
  }
  function setOptions(next){
   if(Object.hasOwn(next,'play')&&next.play!==options.play){clock=elapsed();started=performance.now();}
   const oldPose=options.pose;Object.assign(options,next);
   if(Object.hasOwn(next,'view')){
    viewCache.clear();const angles=viewFor(options.view);for(const e of entries){e.view=initial();e.view.yaw=angles[0];e.view.pitch=angles[1];applyCamera(e);}
   }
   if(next.linked&&entries.length)synchronize(entries[0]);
   if(oldPose!==options.pose){setCards(specs);return;}
   entries.forEach(applyDisplay);request();
  }
  function reset(){viewCache.clear();clock=0;started=performance.now();for(const e of entries){e.view=initial();const v=viewFor(options.view);e.view.yaw=v[0];e.view.pitch=v[1];applyCamera(e);}request();}
  function seek(seconds){clock=Math.max(0,Number.isFinite(seconds)?seconds:0);started=performance.now();request();}
  function capture(){
   cancelAnimationFrame(raf);raf=0;frame(performance.now(),true);const ratio=renderer.getPixelRatio(),canvas=document.createElement('canvas');
   canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;const ctx=canvas.getContext('2d');ctx.fillStyle='#102029';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(renderer.domElement,0,0);
   const board=container.getBoundingClientRect();ctx.scale(ratio,ratio);
   for(const e of entries){const r=e.element.getBoundingClientRect(),x=r.left-board.left,y=r.top-board.top;
    ctx.fillStyle='#d9e6e4';ctx.font='14px "Microsoft YaHei",sans-serif';ctx.fillText(e.label||e.id,x+12,y-31);
    ctx.fillStyle='#87c7b1';ctx.font='10px "Microsoft YaHei",sans-serif';ctx.fillText(e.id+' · '+(e.modelLabel||'共用基础造型'),x+12,y-12);
   }
   return canvas.toDataURL('image/png');
  }
  function getState(){
   return {options:{...options},elapsed:elapsed(),renderCount,visible:inView&&!document.hidden,memory:{...renderer.info.memory},canvasCount:container.querySelectorAll('canvas').length,sourceColors:{skin:kit.skin.color.getHex(),dark:kit.dark.color.getHex(),clothes:clothes.color.getHex()},cards:entries.map(e=>({id:e.id,modelRef:e.modelRef,...stats(e),camera:e.camera.position.toArray(),target:e.view.target.slice(),yaw:e.view.yaw,pitch:e.view.pitch,radius:e.view.radius,parts:meshes(e.preview).map(m=>({name:m.name,matrices:Array.from(m.isInstancedMesh?m.instanceMatrix.array:m.matrixWorld.elements),color:m.material.color.getHex(),wireframe:m.material.wireframe,instanceColors:m.instanceColor?Array.from(m.instanceColor.array):null}))}))};
  }
  function visibility(){if(document.hidden){cancelAnimationFrame(raf);raf=0;lastFrame=0;}else request();}
  const resize=new ResizeObserver(request);resize.observe(container);
  const intersection=new IntersectionObserver(items=>{inView=items[0]?.isIntersecting!==false;if(!inView){cancelAnimationFrame(raf);raf=0;lastFrame=0;}else request();});intersection.observe(container);
  document.addEventListener('visibilitychange',visibility);
  root.addEventListener('scroll',request,{passive:true});
  return {setCards,setOptions,focus:id=>onFocus?.(id),reset,seek,capture,getState,dispose(){
   if(disposed)return;disposed=true;cancelAnimationFrame(raf);clearEntries();resize.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);root.removeEventListener('scroll',request);
   for(const r of new Set([floorGeometry,floorMaterial,gridGeometry,...(Array.isArray(gridMaterial)?gridMaterial:[gridMaterial]),clothes]))r.dispose();
   kit.dispose();renderer.dispose();renderer.domElement.remove();
  }};
 }
 root.CityResidentCharacterViewer={create};
})(typeof globalThis!=='undefined'?globalThis:this);
