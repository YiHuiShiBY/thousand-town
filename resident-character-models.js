/* Which role owns a real 3D appearance, and how to build one.
   Single source of truth: the catalog reads it for labels, the viewer reads it
   to build rigs. Adding a role is one entry here plus one module file. */
(function(root){
 'use strict';
 const MODELS={
  'school-admin':{
   global:'CitySchoolAdminModel',module:'resident-school-admin-model.js',ref:'school-admin/v1',
   label:'学校行政 · 低模 v1',
   description:"无五官空白头，针织开衫、素面工牌与文件夹；靠短发或盘发、发色、衣色和年龄身高区分。"
  },
  officer:{
   global:'CityOfficerModel',module:'resident-officer-model.js',ref:'officer/v1',
   label:'警员 · 低模 v1',
   description:"无五官空白头，制服、警帽与肩章的大色块，配对讲机或警棍；保留不同帽檐和制服颜色。"
  },
  preschooler:{
   global:'CityPreschoolerModel',module:'resident-preschooler-model.js',ref:'preschooler/v1',
   label:'学龄前儿童',
   description:"无五官大头短身，浅色连体衣与背带，手持奶瓶或布偶、背小包；保留年龄比例和发型。"
  },
  'medical-doc':{
   global:'CityMedicalDocModel',module:'resident-medical-doc-model.js',ref:'medical-doc/v1',
   label:'医生白大褂 · 低模 v1',
   description:"无五官空白头，敞开的及膝白大褂、内搭衬衫与听诊器，保留长衣和亮白色块。"
  },
  'medical-nurse':{
   global:'CityMedicalNurseModel',module:'resident-medical-nurse-model.js',ref:'medical-nurse/v1',
   label:'护士',
   description:"无五官空白头，护士帽、彩色上衣和白裤的分色制服，素面胸牌与听诊器。"
  },
  patient:{
   global:'CityPatientModel',module:'resident-patient-model.js',ref:'patient/v1',
   label:'病号服条纹',
   description:"无五官空白头，条纹病号服和浅色拖鞋；儿童保留大头短身，长者保留披肩或拐杖。"
  },
  retiree:{
   global:'CityRetireeModel',module:'resident-retiree-model.js',ref:'retiree/v1',
   label:'退休便装 · 买菜出门',
   description:"无五官空白头，夹克、开衫、马甲或衬衫，配长裤或裙；购物袋、手杖与灰发作为主要识别。"
  },
  senior:{
   global:'CitySeniorModel',module:'resident-senior-model.js',ref:'senior/v1',
   label:'高龄长者 · 拐杖低模',
   description:"无五官空白头，随年龄加重的驼背、厚外套和宽底鞋，配拐杖、四脚手杖或助行器。"
  },
  office:{
   global:'CityOfficeModel',module:'resident-office-model.js',ref:'office/v1',
   label:'写字楼职员',
   description:"无五官空白头，浅色衬衫、领带或丝巾、公文包，配西裤或裙；用配色和发型区分居民。"
  },
  worker:{
   global:'CityWorkerModel',module:'resident-worker-model.js',ref:'worker/v1',
   label:'戴安全帽的蓝领工人',
   description:"无五官空白头，靛蓝工装、厚底劳保鞋、圆顶安全帽或短发，保留工具腰带与大色块反光条。"
  },
  'student-p':{
   global:'CityStudentPModel',module:'resident-student-p-model.js',ref:'student-p/v1',
   label:'小学生 · 低模 v1',
   description:"无五官空白头，白衬衫、红领巾和双肩书包，配短裤或长裤；保留儿童头身比例。"
  },
  'student-m':{
   global:'CityStudentMModel',module:'resident-student-m-model.js',ref:'student-m/v1',
   label:'中学生·深色长款校服',
   description:"无五官空白头，藏青、深灰或墨绿的长款校服，敞开款露白衬衫和领带，配背包或斜挎包。"
  },
  'student-u':{
   global:'CityStudentUModel',module:'resident-student-u-model.js',ref:'student-u/v1',
   label:'大学生 · 休闲低模',
   description:"无五官空白头，卫衣、T恤或敞开衬衫，配宽松裤、托特包、帽子或耳机。"
  },
  teacher:{
   global:'CityTeacherModel',module:'resident-teacher-model.js',ref:'teacher/v1',
   label:'教师',
   description:"无五官空白头，柔和配色的开衫、衬衫或针织背心，抱住素面夹板；以衣服、发型和身高区分。"
  },
  clerk:{
   global:'CityClerkModel',module:'resident-clerk-model.js',ref:'clerk/v1',
   label:'银行办事员',
   description:"无五官空白头，白衬衫外罩马甲，素面卡套工牌，双臂夹住单据板。"
  },
  shopkeeper:{
   global:'CityShopkeeperModel',module:'resident-shopkeeper-model.js',ref:'shopkeeper/v1',
   label:'围裙店主 · 站柜台',
   description:"无五官空白头，大色块梯形围裙和浅色袖套，手持纸袋、计算器或搭在臂弯的外套。"
  },
  driver:{
   global:'CityDriverModel',module:'resident-driver-model.js',ref:'driver/v1',
   label:'戴鸭舌帽的车站司机',
   description:"无五官空白头，短前檐鸭舌帽、夹克或马甲，腰包和短手套保留司机剪影。"
  },
  sanitation:{
   global:'CitySanitationModel',module:'resident-sanitation-model.js',ref:'sanitation/v1',
   label:'环卫工人 · 荧光背心',
   description:"无五官空白头，深色工装外叠荧光背心，宽反光带、胶靴和手套，配扫帚、垃圾夹或手推桶。"
  },
  'hosp-admin':{
   global:'CityHospAdminModel',module:'resident-hosp-admin-model.js',ref:'hosp-admin/v1',
   label:'医院行政',
   description:"无五官空白头，浅色短款医院制服、肩部拼色和素面方工牌，单手持病历夹或平板。"
  },
  unemployed:{
   global:'CityUnemployedModel',module:'resident-unemployed-model.js',ref:'unemployed/v1',
   label:'待业居民 · 无物一身',
   description:"无五官空白头，低饱和的卫衣、T恤或薄外套，配宽松长裤和帆布鞋；保留电话或插兜姿态。"
  }
 };
 function entry(role){return MODELS[role]||null;}
 // Returns a builder only when the module global is actually loaded, so a
 // missing script degrades to the shared base instead of throwing mid-render.
 function resolve(role){
  const found=entry(role);if(!found)return null;
  const factory=root[found.global];
  return typeof factory?.create==='function'?{...found,create:(T,options)=>factory.create(T,options)}:null;
 }
 function describe(role){
  const found=entry(role);
  if(!found)return {modelRef:'city-scene/shared-base',modelStatus:'shared-base',source:'city-scene.js · personParts',modelLabel:'共用基础造型 · 待精修',description:'年龄 / 职业外观待精修。这里展示代表造型，尚未与街面居民逐人绑定。'};
  return {modelRef:found.ref,modelStatus:'role-prototype',source:found.module,modelLabel:found.label,description:found.description};
 }
 function roles(){return Object.keys(MODELS);}

 // Street proxies use census appearances, never a resident-to-route identity.
 function createTownBatch(T,{actors=[],residents=[],materials={}}={}){
  const object=new T.Group();object.name='resident-town-batch';
  const census=residents.filter(r=>resolve(r.role)).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  if(actors.length&&!census.length)throw new TypeError('Town batch needs loaded resident appearances');
  const hash=value=>{let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
  const byRole=new Map();for(const r of census){if(!byRole.has(r.role))byRole.set(r.role,[]);byRole.get(r.role).push(r);}
  const students=census.filter(r=>/^student-/.test(r.role));
  const generic=actors.filter(p=>!p.appearanceRole&&p.kind!=='vendor'&&p.activityKind!=='school-arrival').slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const coverage=generic.length>=byRole.size?new Map(generic.slice(0,byRole.size).map((p,i)=>[String(p.id),Array.from(byRole.keys())[i]])):new Map();
  function appearance(actor){
   const pool=byRole.get(actor.appearanceRole||coverage.get(String(actor.id)))||(actor.kind==='vendor'?byRole.get('shopkeeper'):null)||(actor.activityKind==='school-arrival'&&students.length?students:null)||census;
   return pool[hash(actor.id)%pool.length];
  }
  const categories=['body','head'],data={};
  for(const kind of categories)data[kind]={positions:[],normals:[],uvs:[],colors:[],roughness:[],skinIndices:[],weights:[],indices:[]};
  const rigs=[],bones=[],boneMap=new Map(),assignedByRole={},ids=new Set();
  const animated=/^(?:body-upper|head-rig|arm-(?:left|right)-rig|elbow-rig-(?:left|right)|leg-(?:left|right)-rig|knee-rig-(?:left|right)|foot-rig-(?:left|right))$/;
  const localMatrix=new T.Matrix4(),inverse=new T.Matrix4(),normalMatrix=new T.Matrix3(),point=new T.Vector3();
  function boneFor(mesh,rig){let bone=mesh.parent;while(bone!==rig.object&&!animated.test(bone.name))bone=bone.parent;if(!boneMap.has(bone)){boneMap.set(bone,bones.length);bones.push(bone);}return bone;}
  for(const sample of actors){
   const id=String(sample.id);if(!id||id==='undefined'||ids.has(id))throw new TypeError('Town proxy ids must be unique');ids.add(id);
   const resident=appearance(sample),actor={kind:sample.kind,standing:sample.standing===true},rig=resolve(resident.role).create(T,{resident,actor});
   if(sample.appearanceTint&&resident.role==='student-m'){
    const coat=rig.object.getObjectByName('uniform-coat-body'),hem=rig.object.getObjectByName('uniform-coat-hem');
    if(coat){const before=coat.material.color.clone(),tint=new T.Color(sample.appearanceTint);if(hem){const relative=new T.Color().setRGB(hem.material.color.r/before.r,hem.material.color.g/before.g,hem.material.color.b/before.b);hem.material.color.copy(tint).multiply(relative);}coat.material.color.copy(tint);}
   }
   assignedByRole[resident.role]=(assignedByRole[resident.role]||0)+1;
   const record={id,rig,actor,indices:{body:[],head:[]},ranges:{},visibility:-1,boneStart:bones.length,poseDirty:true,lastPose:null};
   for(const kind of categories)record.ranges[kind]=[data[kind].positions.length/3,0];
   rig.object.updateMatrixWorld(true);
   const sourceMeshes=[];
   rig.object.traverse(mesh=>{
    if(!mesh.isMesh)return;sourceMeshes.push(mesh);
    const kind=mesh.name==='face'?'head':'body',out=data[kind],geometry=mesh.geometry,pos=geometry.attributes.position,norm=geometry.attributes.normal,uv=geometry.attributes.uv;
    const bone=boneFor(mesh,rig),boneIndex=boneMap.get(bone),start=out.positions.length/3;
    inverse.copy(bone.matrixWorld).invert();localMatrix.multiplyMatrices(inverse,mesh.matrixWorld);normalMatrix.getNormalMatrix(localMatrix);
    for(let i=0;i<pos.count;i++){
     point.fromBufferAttribute(pos,i).applyMatrix4(localMatrix);out.positions.push(point.x,point.y,point.z);
     if(norm)point.fromBufferAttribute(norm,i).applyNormalMatrix(normalMatrix);else point.set(0,1,0);
     out.normals.push(point.x,point.y,point.z);out.uvs.push(uv?uv.getX(i):0,uv?uv.getY(i):0);
     out.colors.push(mesh.material.color.r,mesh.material.color.g,mesh.material.color.b);out.roughness.push(mesh.material.roughness);
     out.skinIndices.push(boneIndex,0,0,0);out.weights.push(1,0,0,0);
    }
    const count=geometry.index?geometry.index.count:pos.count;
    for(let i=0;i<count;i++){const index=start+(geometry.index?geometry.index.getX(i):i);out.indices.push(index);record.indices[kind].push(index);}
   });
   sourceMeshes.forEach(mesh=>mesh.removeFromParent());
   for(const kind of categories)record.ranges[kind][1]=data[kind].positions.length/3;
   record.boneEnd=bones.length;rigs.push(record);
  }
  const skeleton=new T.Skeleton(bones,bones.map(()=>new T.Matrix4()));
  // All vertices are baked into group-local space; inverses are exactly identity.
  // Let the renderer pack changed world poses once, without identity multiplies.
  skeleton.update=function(){let changed=false;for(const row of rigs){if(!row.poseDirty)continue;for(let i=row.boneStart;i<row.boneEnd;i++)this.boneMatrices.set(bones[i].matrixWorld.elements,i*16);row.poseDirty=false;changed=true;}if(changed&&this.boneTexture)this.boneTexture.needsUpdate=true;};
  const ownedMaterials=new Set(),meshes={},identity=new T.Matrix4();let disposed=false,active=0,triangles=0,activeKey='';
  // Clone scene materials while retaining their GPU light hook and uniforms.
  function fadingMaterial(source,head=false,depth=false){
   const mat=source?source.clone():depth?new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking}):new T.MeshStandardMaterial({color:'#fff',roughness:1});
   const before=source?source.onBeforeCompile:null,key=source?source.customProgramCacheKey():'';
   if(!depth){mat.color.set('#fff');mat.vertexColors=true;mat.flatShading=!head;mat.roughness=1;mat.metalness=0;mat.map=null;}
   mat.onBeforeCompile=function(shader,renderer){
    if(before)before.call(this,shader,renderer);
    shader.vertexShader=(!depth?'attribute float residentSmoothHead; varying float vResidentSmoothHead; varying vec3 vResidentNormal;\n':'')+'attribute float actorVisibility; varying float vActorVisibility;\n'+(!depth?'attribute float residentRoughness; varying float vResidentRoughness;\n':'')+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvActorVisibility=actorVisibility;'+(!depth?'\nvResidentRoughness=residentRoughness;':''));
    if(!depth)shader.vertexShader=shader.vertexShader.replace('#include <defaultnormal_vertex>','#include <defaultnormal_vertex>\nvResidentNormal=normalize(transformedNormal);vResidentSmoothHead=residentSmoothHead;');
    shader.fragmentShader=(!depth?'varying float vResidentSmoothHead; varying vec3 vResidentNormal;\n':'')+'varying float vActorVisibility;\n'+(!depth?'varying float vResidentRoughness;\n':'')+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\nif(vActorVisibility<1.0){vec2 cell=mod(floor(gl_FragCoord.xy),4.0),lo=mod(cell,2.0),hi=floor(cell/2.0);float a=2.0*lo.x+3.0*lo.y-4.0*lo.x*lo.y,b=2.0*hi.x+3.0*hi.y-4.0*hi.x*hi.y;if(vActorVisibility<(4.0*a+b+0.5)/16.0)discard;}');
    if(!depth)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nif(vResidentSmoothHead>.5){normal=normalize(vResidentNormal);\n#ifdef DOUBLE_SIDED\nnormal*=faceDirection;\n#endif\nnonPerturbedNormal=normal;}');
    if(!depth)shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=vResidentRoughness;');
   };
   mat.customProgramCacheKey=()=>key+'|resident-town-visibility-v1'+(depth?'|depth':'|surface');ownedMaterials.add(mat);return mat;
  }
  const depth=fadingMaterial(materials.depth,false,true),headOffset=data.body.positions.length/3;
  const src={};for(const key of['positions','normals','uvs','colors','roughness','skinIndices','weights'])src[key]=data.body[key].concat(data.head[key]);
  src.indices=data.body.indices.concat(data.head.indices.map(i=>i+headOffset));
  for(const row of rigs){row.indices.head=row.indices.head.map(i=>i+headOffset);row.ranges.head=row.ranges.head.map(i=>i+headOffset);}
  const geometry=new T.BufferGeometry();
  for(const [name,values,size] of[['position',src.positions,3],['normal',src.normals,3],['uv',src.uvs,2],['color',src.colors,3],['residentRoughness',src.roughness,1],['skinWeight',src.weights,4]])geometry.setAttribute(name,new T.Float32BufferAttribute(values,size));
  geometry.setAttribute('residentSmoothHead',new T.Float32BufferAttribute(new Float32Array(src.positions.length/3).fill(1,headOffset),1));
  geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(src.skinIndices,4));
  const visibility=new T.Float32BufferAttribute(new Float32Array(src.positions.length/3).fill(1),1);visibility.setUsage(T.DynamicDrawUsage);geometry.setAttribute('actorVisibility',visibility);
  const index=new T.BufferAttribute(new Uint32Array(src.indices),1);index.setUsage(T.DynamicDrawUsage);geometry.setIndex(index);
  const mesh=new T.SkinnedMesh(geometry,fadingMaterial(materials.body||materials.head,false));mesh.name='resident-town-people';mesh.bindMode='detached';mesh.bind(skeleton,identity);mesh.customDepthMaterial=depth;mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;meshes.body=meshes.head=mesh;object.add(mesh);
  const finite=value=>Number.isFinite(value)?value:0;
  function update(samples=[]){
   if(disposed)return;
   const sampleById=new Map(samples.map(p=>[String(p.id),p]));let key='',nextActive=0;
   for(const row of rigs){
    const p=sampleById.get(row.id),visibility=p&&p.active!==false?Math.max(0,Math.min(1,p.visibility??1)):0,shown=visibility>0;
    if(shown){
     nextActive++;key+=row.id+'\0';
     const moving=p.standing!==true&&p.kind!=='vendor',pose=[finite(p.x),finite(p.y),finite(p.z),finite(p.heading),p.kind,p.standing===true,moving?finite(p.phase):0];
     if(!row.lastPose||pose.some((value,i)=>value!==row.lastPose[i])){
      row.actor.kind=p.kind;row.actor.standing=p.standing===true;
      row.rig.object.position.set(pose[0],pose[1],pose[2]);row.rig.object.rotation.y=Math.PI/2-pose[3];
      // Real-age proportions already include child height; do not apply p.size again.
      row.rig.update(pose[6]/(p.kind==='jogger'?5.8:3.8));row.lastPose=pose;row.poseDirty=true;
     }
    }
    if(row.visibility!==visibility){for(const kind of categories){const attr=meshes[kind].geometry.attributes.actorVisibility,range=row.ranges[kind];attr.array.fill(visibility,range[0],range[1]);attr.needsUpdate=true;}row.visibility=visibility;}
   }
   if(key!==activeKey||active!==nextActive){
    const mesh=meshes.body,index=mesh.geometry.index;let offset=0;for(const row of rigs){if(!(row.visibility>0))continue;for(const kind of categories){index.array.set(row.indices[kind],offset);offset+=row.indices[kind].length;}}index.needsUpdate=true;mesh.geometry.setDrawRange(0,offset);mesh.visible=offset>0;triangles=offset/3;activeKey=key;
   }
   active=nextActive;object.updateMatrixWorld(true);
  }
  // Initialize even if every proxy starts hidden.
  active=-1;update(actors);
  function dispose(){if(disposed)return;disposed=true;for(const row of rigs)row.rig.dispose();for(const mesh of new Set(Object.values(meshes)))mesh.geometry.dispose();ownedMaterials.forEach(m=>m.dispose());skeleton.dispose();object.removeFromParent();object.clear();active=triangles=0;}
  function getInfo(){return {capacity:rigs.length,active,triangles,drawCalls:disposed?0:new Set(Object.values(meshes).filter(m=>m.visible)).size,availableRoles:roles().filter(r=>resolve(r)),assignedByRole:{...assignedByRole},disposed};}
  return {object,update,dispose,getInfo};
 }

 root.CityResidentCharacterModels={MODELS,entry,resolve,describe,roles,createTownBatch};
 if(typeof module==='object'&&module.exports)module.exports=root.CityResidentCharacterModels;
})(typeof globalThis!=='undefined'?globalThis:this);