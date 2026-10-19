(function(root){
'use strict';
  function joint(a,k,x,z,y){a[k]=x;a[k+1]=z;a[k+2]=y;}
  function personPose(p,out){
const o=out||{legs:new Array(18),arms:new Array(18)},still=p.standing===true;
const kind=p.activityKind||p.kind,jog=p.kind==='jogger'&&!still;
const step=still?0:Math.sin(p.phase),bob=Math.abs(step)*(jog?.12:.045);
const shop=still&&(kind==='shopper'||p.kind==='shopper'),vendor=still&&(kind==='vendor'||p.kind==='vendor');
const door=still&&kind==='door-visit',school=kind==='school-arrival';
o.lean=shop?.14:door?.07:jog?.2:.025;o.bob=bob;
o.pack=school||p.kind==='commuter';o.headY=3.55+bob;
for(let i=0;i<2;i++){
const side=i?1:-1,k=i*9,swing=side*step*(jog?.78:.48),lift=Math.max(0,-side*step)*(jog?.4:.13);
joint(o.legs,k,0,side*.23,1.72+bob);joint(o.legs,k+3,swing*.48,side*.24,.91+lift*.45);joint(o.legs,k+6,swing,side*.25,.16+lift);
let elbow=-swing*.46,elbowY=jog?2.48:2.31,hand=-swing*.7,handY=jog?2.78:1.97;
if(still){elbow=.06;hand=.09;}
if(shop&&side===1){elbow=.4;elbowY=2.47;hand=.88;handY=2.53;}
if(vendor&&side===1){elbow=.25;elbowY=2.7;hand=.44;handY=3.17+Math.sin(p.phase*.45)*.13;}
if(door&&side===1){elbow=.32;elbowY=2.45;hand=.58;handY=2.63;}
if(school&&still){elbow=.08;elbowY=2.48;hand=.16;handY=2.82;}
joint(o.arms,k,o.lean,side*.47,2.96+bob);joint(o.arms,k+3,elbow,side*.53,elbowY+bob);joint(o.arms,k+6,hand,side*.49,handY+bob);
}
return o;
}
  function createRooftopSearchlights(T,V,ag,external=[]){const o=new T.Group();o.name='rooftop-searchlights';const L=root.CityHelipad||(typeof require==='function'?require('./city-helipad.js'):null),al=L&&L.plan(V);const r=(V.places||[]).find(p=>p.kind==='plaza'),amusement=(V.places||[]).find(p=>p.kind==='amusement'),mall=V.buildings.find(b=>b.ledgerId==='c-mall');const U=['t-one','t-three','t-two','t-four'];const s=U.map(id=>V.buildings.find(b=>b.ledgerId===id)).filter(b=>b&&(!al||b.id!==al.buildingId)).slice(0,2);const k=[],H=[],j=[],up=new T.Vector3(0,1,0),M=new T.Matrix4(),W=new T.Vector3(15,190,15),F=new T.Vector3(),J=new T.Color();const externalRotation=new T.Quaternion();const t=new T.CylinderGeometry(1,.006,1,24,1,false);t.translate(0,.5,0);const u=new T.RawShaderMaterial({glslVersion:T.GLSL3,transparent:true,depthWrite:false,side:T.BackSide,blending:T.AdditiveBlending,toneMapped:false,uniforms:{showLevel:{value:0}},vertexShader:`precision highp float; precision highp int;
        uniform mat4 modelMatrix,viewMatrix,projectionMatrix; uniform vec3 cameraPosition;
        in vec3 position; in mat4 instanceMatrix; in vec3 instanceColor;
        out vec3 beamPoint,beamCamera,beamScale,beamTint;
        void main(){mat4 pose=modelMatrix*instanceMatrix;vec3 delta=cameraPosition-pose[3].xyz;
          beamPoint=position;beamScale=vec3(length(pose[0].xyz),length(pose[1].xyz),length(pose[2].xyz));
          beamCamera=vec3(dot(delta,pose[0].xyz),dot(delta,pose[1].xyz),dot(delta,pose[2].xyz))/(beamScale*beamScale);
          beamTint=instanceColor;gl_Position=projectionMatrix*viewMatrix*pose*vec4(position,1.0);}`,fragmentShader:`precision highp float; precision highp int;
        uniform float showLevel; in vec3 beamPoint,beamCamera,beamScale,beamTint;
        layout(location=0) out highp vec4 beamOutput;
        void main(){vec3 ray=beamPoint-beamCamera;float farPoint=length(ray);vec3 dir=ray/max(farPoint,.00001);
          vec3 inv=1.0/(dir+vec3(.000001));vec3 a=(vec3(-1.0,0.0,-1.0)-beamCamera)*inv,b=(vec3(1.0)-beamCamera)*inv;
          vec3 lo=min(a,b),hi=max(a,b);float start=max(0.0,max(lo.x,max(lo.y,lo.z))),end=min(farPoint,min(hi.x,min(hi.y,hi.z)));
          float stepSize=max(0.0,end-start)/16.0,density=0.0;
          for(int i=0;i<16;i++){vec3 p=beamCamera+dir*(start+(float(i)+.5)*stepSize);float radius=.006+.994*p.y;
            float radial=length(p.xz)/max(radius,.006);float edge=1.0-smoothstep(.55,1.0,radial);
            density+=edge*exp(-radial*radial*2.4)*pow(max(0.0,1.0-p.y),1.7);}
          float glow=(1.0-exp(-density*stepSize*length(dir*beamScale)*.075))*showLevel;
          beamOutput=vec4(beamTint,glow*1.6);}`});const c=new T.InstancedMesh(t,u,Math.max(1,s.length*2+(r?2:0)+(amusement?2:0)+(mall?2:0)+external.length));c.name='rooftop-searchlight-beams';c.frustumCulled=false;c.renderOrder=3;o.add(c);const ad=(am,N,ah,ai={})=>{const p={host:N,local:ah,floor:N===r||N===amusement?0:N.floors,roof:N!==r&&N!==amusement,...ai};am.push(p);return p;};for(const[i,f]of[...s,...(r?[r]:[]),...(amusement?[amusement]:[]),...(mall?[mall]:[])].entries()){const park=f===amusement,e=f===r||park,an=f.floors>=15,X=e?.27:1.4+f.floors*(f.floorHeight||6)+(f===mall?.4:0),w=f.w*(an?.8:1),d=f.d*(an?.86:1);const G=new T.Group();o.add(G);for(const O of[-1,1]){const x=park?O*16:e?O*9.5:O*w*.32,z=park?-21:e?20:-O*d*.32,y=X+1.44,q=new T.Quaternion(),Y=park?(O<0?'#8db9cf':'#e9c68c'):i?'#eed8b2':'#b8ccdf';ad(k,f,[x,X+.12,z,1.14,.24,1.14]);ad(k,f,[x,X+.72,z,.375,.96,.375]);const aj=ad(k,f,[x,y,z,.96,1.2,.96],{rotation:q,tint:'#bac7d1'});const ao=ad(H,f,[x,y,z,.81,.027,.81],{rotation:q,searchlight:true,tint:Y});const v=new T.SpotLight(Y,0,f===mall?80:230,.079,.75,1);v.castShadow=false;v.name='rooftop-searchlight-'+j.length;v.userData.ledgerId=park?'c-amusement':e?'c-plaza':f.ledgerId;G.add(v,v.target);const K=new T.Vector3(),ae=new T.Vector3();j.push({host:f,publicSite:park?'amusement':f===mall?'mall':e,anchor:G,x,y,z,phase:i*1.7+(O+1)*1.2,q,shell:aj,lens:ao,light:v,direction:K,origin:ae});c.setColorAt(j.length-1,new T.Color(Y));}}let D=0,A=false,C='off',a=null;    function af(ap,ak,n,l){if(A)return;const Z=root.CityDailyClock||(typeof require==='function'?require('./city-life-ext/daily-clock.js'):null);const P=Z&&Number.isFinite(n)?Z.minuteOfDay(n):-1;const fire=root.CityFireworks||(typeof require==='function'?require('./city-fireworks.js'):null);C='nightly';D=fire&&fire.nightlyState(n).enabled?1:0;const parkLevel=P>=1140&&P<1320?Math.min(1,(ak?.buildings?.['c-amusement']?.decoration||0)/.5):0;const mallLevel=D*Math.min(1,ak?.buildings?.['c-mall']?.facade??(ak?.buildings?.['c-mall']?.open?(ak.buildings['c-mall'].decoration||0)/.5:0));u.uniforms.showLevel.value=Number(Math.max(D,parkLevel,mallLevel,...external.map(e=>e.level||0))>0);let E=0;for(const h of j){const level=h.publicSite==='amusement'?parkLevel:h.publicSite==='mall'?mallLevel:D;h.lens.level=level;const Q=level>0&&(h.publicSite&&h.publicSite!=='mall'||ag.sampleBuilding(h.host,ap).complete);const aa=(Number.isFinite(n)?n:0)*.035+h.phase,aq=h.phase+Math.sin(aa)*1.1,m=.87+.22*Math.sin(aa*.71+.6);h.direction.set(Math.cos(aq)*Math.cos(m),Math.sin(m),Math.sin(aq)*Math.cos(m));h.q.setFromUnitVectors(up,h.direction);h.origin.set(h.x,h.y,h.z).addScaledVector(h.direction,.618);h.lens.local.splice(0,3,...h.origin.toArray());h.anchor.position.set(h.host.x,0,h.host.z);h.light.position.copy(h.origin);h.light.target.position.copy(h.origin).addScaledVector(h.direction,h.publicSite==='mall'?65:190);h.light.intensity=Q?(h.publicSite==='mall'?90:420)*level:0;if(Q){F.copy(h.origin);F.x+=h.host.x;F.z+=h.host.z;W.set(h.publicSite==='mall'?5:h.publicSite?12:15,h.publicSite==='mall'?65:h.publicSite?155:190,h.publicSite==='mall'?5:h.publicSite?12:15);M.compose(F,h.q,W);c.setMatrixAt(E,M);c.setColorAt(E,J.copy(h.light.color).multiplyScalar(.9*level));E++;}}
for(const e of external){if(e.light.intensity<=0||e.level<=0)continue;
 e.light.getWorldPosition(F);e.light.target.getWorldPosition(W);W.sub(F).normalize();
 externalRotation.setFromUnitVectors(up,W);W.set(e.radius,e.length,e.radius);M.compose(F,externalRotation,W);
 c.setMatrixAt(E,M);c.setColorAt(E,J.copy(e.light.color).multiplyScalar((e.gain||1)*e.level));E++;
}c.count=E;c.visible=E>0;c.instanceMatrix.needsUpdate=true;if(c.instanceColor)c.instanceColor.needsUpdate=true;}    function ab(B=false){const R=j.filter(h=>h.publicSite===B),S=A?0:R.filter(h=>h.light.intensity>0).length;return {installed:R.length,activeBeams:S,activeLights:S,hostIds:B?R.map(h=>h.host.id||'c-'+h.host.kind):s.map(h=>h.id),level:R.length?R[0].lens.level||0:0,festivalSource:C,window:[1140,1320],heads:R.map(h=>({hostId:h.host.id||'c-'+h.host.kind,ledgerId:h.publicSite==='amusement'?'c-amusement':h.publicSite===true?'c-plaza':h.host.ledgerId,origin:[h.host.x+h.origin.x,h.origin.y,h.host.z+h.origin.z],direction:h.direction.toArray()}))};}    function ac(){if(A)return;A=true;c.dispose();t.dispose();u.dispose();o.removeFromParent();o.clear();}    function g(I){if(I&&!a){a={visible:c.visible,power:j.map(h=>h.light.intensity)};c.visible=false;j.forEach(h=>{h.light.intensity=0;});}else if(!I&&a){c.visible=a.visible;j.forEach((h,i)=>{h.light.intensity=a.power[i];});a=null;}}return{group:o,fixtures:k,accents:H,update:af,getInfo:ab,dispose:ac,setReflectionCapture:g,get drawCalls(){return Number(c.visible);},get level(){return D;}};}
  // Fixed 24-pixel glyphs keep facade bulbs deterministic without DOM font work each frame.
  const facadeGlyphs={
    '我':'00ef607ffff03ffff83fcf7c078f380f8f107ffffe7ffffe7ffffe078f1807bf3c3fff7c7ffff87ff7f07f87ec078fde07bfde07fffe3ffdfc3fb1fc3f0078000000000000000000',
    '千':'001ff83ffff81ffffc1fffc0003c00003c00003c00003c007ffffe7ffffe7ffffe7ffffe003c00003c00003c00003c00003c00003c00003c00003c00003c00000000000000000000',
    '人':'003c00003c00003c00003c00003c00003c00007c00007c00007e00007e0000ff0000ff0001ff8003e7c007e7e00fc3f01f81f87f00fe7e007c3c0038180018000000000000000000',
    '小':'003c00003c00003c00003c00043c200f3cf00f3cf01f3cf81e3c781e3c783e3c7c3c3c3c3c3c3e7c3c3e783c1e183c18003c0003fc0003fc0003fc0001f000000000000000000000',
    '镇':'1e07c01c7ffe1ffffe3f83803ffffc787ffc7ff83c7ffffc7ffffc3e7ffc1e7ffc7ffffc7ffffc7ffffc1e783c1ffffe1ffffe1f9ef01ffefe1efc7e0c700c000000000000000000',
    'AI':'00000000000000000001e07803f07803f07803f07807f87807f8780738780f3c780f3c781ffe781ffe781ffe783c0f783c0f783c0f78000000000000000000000000000000000000',
    heart:'0000000000000f81f01fc3f83fe7fc3ffffc3ffffc3ffffc3ffffc3ffffc1ffff81ffff80ffff00ffff007ffe003ffc001ff8000ff00007e00003c00001800000000000000000000',
    '一':'0000000000000000000000000000000000000000000000003ffffc7ffffe7ffffe7ffffe000000000000000000000000000000000000000000000000000000000000000000000000',
    '键':'1c01c03dfffc3ffffc3f79fc7f7ffe78fffe7feffe7fe7fc7ffffc3dfffc7f3ffc7fbffc7ffffc1df9e01dfffc1ffffc1ff9c03fffe03ffffe1bcffe0181fc000000000000000000',
    '三':'0000001ffff81ffff81ffff81ffff80000000000000000000000000ffff00ffff00ffff00000000000000000000000007ffffe7ffffe7ffffe7ffffe000000000000000000000000',
    '连':'181e003c3e003ffffc1ffffc0ffffc0c7b8000fb803ef3807efffc7efffc3efffc1e03801ffffe1ffffe1ffffe1e03803f03807ffffe7ffffe3bfffe307ffc000000000000000000',
    '仪':'07870007a7980ff7bc0ff7bc1ff3fc1ef33c3e78783e78787e7c787e3cf07e3ef07e1fe02e1fe00e0fc00e0fc00e1fe00e7ff80efffe0ffcfe0ff03c0ee018000000000000000000',
    '绘':'0f07800f0fc01e0fe01e1ff03ffef87bfcfc7ff87e7ffffe7ffffc1e7ff41e00003c7ffc7ffffc7ffffc3f9f60001ef03fbcf07ffc787ffffc787ffc007c1c000000000000000000',
    '士':'003c00003c00003c00003c00003c00003c007ffffe7ffffe7ffffe003c00003c00003c00003c00003c00003c00003c001ffff83ffffc3ffffc3ffffc000000000000000000000000',
    'BY':'0000000000000000007f8f0f7fef0f7ff79e78f79e78f3fc79e3fc7fc1f87fe1f87df1f078f0f078f0f07df0f07ff0f07fc0f0000000000000000000000000000000000000000000',
    like:'000000000000000e00000f00000f80000f80001f80003f80003f00007f007cfffc7cfffe7cfffe7cfffe7cfffe7cfffc7cfffc7cfffc7cfffc7cfff87cfff87cfff0000000000000',
    coin:'00000000ff0003ffc007c3e00f7ef01dffb83bc3dc3ffffc76ff6e6e18766c18366c18366c18366c18367e187e76ff6e3ffffc3bc3dc1dffb80f7ef007c3e003ffc000ff00000000',
    star:'000000000000001800001800003c00003c00003c00007e003ffffc1ffff80ffff007ffe003ffc001ff8001ff8001ff8001ff8003e7c003c3c00300c0000000000000000000000000'
  };
  function facadeMessagePlan(city){
    const messages=[];
    for(const spec of [{id:'t-one',text:'我❤️AI',rows:['我','heart','AI'],colors:['#bce7ff','#ff2847','#bce7ff']},{id:'t-three',text:'千人小镇',rows:['千','人','小','镇'],colors:['#bce7ff','#bce7ff','#bce7ff','#bce7ff']}]){
      const host=city.buildings.find(b=>b.ledgerId===spec.id);if(!host)continue;
      const height=host.floorHeight||6,cut=host.floors>=15?Math.floor(host.floors*.74):host.floors;
      const rows=spec.rows.length*24+(spec.rows.length-1)*3;
      const pitch=Math.min(Math.min(host.w,host.d)*.76/24,Math.max(1,(cut-2)*height-4)/rows);
      const top=1.4+cut*height-2,dots=[];
      for(const [face,angle] of [['south',0],['east',Math.PI/2]])spec.rows.forEach((glyph,line)=>{
        for(let row=0;row<24;row++){const bits=parseInt(facadeGlyphs[glyph].slice(row*6,row*6+6),16);
          for(let col=0;col<24;col++)if(bits&(1<<(23-col))){const offset=(col-11.5)*pitch,y=top-(line*27+row)*pitch;
            dots.push({local:face==='south'?[offset,y,host.d/2+1.04]:[host.w/2+1.04,y,-offset],angle,size:pitch*.94,color:spec.colors[line]});
          }
        }
      });
      messages.push({host,text:spec.text,dots});
    }
    return messages;
  }
  // Fixed glyph masks are packed once. The GPU samples a frame without a canvas upload.
  function facadeScreenFrame(mode,time){
    const phase=Number.isFinite(time)?((time%12)+12)%12:0;
    const frame=mode===2?2:phase<6?0:1;
    return {phase,frame,scene:['点赞·投币·收藏','一键三连','仪绘士BY'][frame]};
  }
  let facadeMasks=null;
  function facadeContentFrames(){
    if(facadeMasks)return facadeMasks;
    facadeMasks=[['like','coin','star'],['一','键','三','连'],['仪','绘','士','BY'],['我','heart','AI'],['千','人','小','镇']].map(glyphs=>{
      const mask=new Uint8Array(24*105);
      glyphs.forEach((glyph,line)=>{for(let y=0;y<24;y++){const bits=parseInt(facadeGlyphs[glyph].slice(y*6,y*6+6),16);
        for(let x=0;x<24;x++)if(bits&(1<<(23-x)))mask[((glyphs.length===3?13:0)+line*27+y)*24+x]=255;
      }});return mask;
    });return facadeMasks;
  }
  function facadeScreenPlan(city){
    const frames=facadeContentFrames();
    return [{id:'t-two',mode:1,text:'点赞·投币·收藏 / 一键三连'},{id:'t-four',mode:2,text:'仪绘士BY'}].flatMap(spec=>{
      const host=city.buildings.find(b=>b.ledgerId===spec.id);if(!host)return [];
      const cut=host.floors>=15?Math.floor(host.floors*.74):host.floors,bottom=spec.mode===1?21:15;
      const top=1.4+cut*(host.floorHeight||6)-3,pitch=Math.min(Math.min(host.w,host.d)*.76/24,(top-bottom)/105);
      const width=pitch*24,height=pitch*105,y=top-height/2;
      return [{host,mode:spec.mode,text:spec.text,frames,columns:24,rows:105,surfaces:[
        {local:[0,y,host.d/2+1.04],angle:0,width,height},
        {local:[host.w/2+1.04,y,0],angle:Math.PI/2,width,height}
      ]}];
    });
  }
  function facadeMediaPlan(city){
    return [
      {id:'t-one',mode:3,text:'我❤️AI',tint:'#62b6f0'},
      {id:'t-two',mode:1,text:'点赞·投币·收藏 / 一键三连',tint:'#efb65e'},
      {id:'t-three',mode:4,text:'千人小镇',tint:'#56b1dc'},
      {id:'t-four',mode:2,text:'仪绘士BY',tint:'#e9aa57'}
    ].flatMap(spec=>{
      const host=city.buildings.find(b=>b.ledgerId===spec.id);if(!host)return [];
      const step=host.floorHeight||6,cut=host.floors>=15?Math.floor(host.floors*.74):host.floors,surfaces=[];
      for(const tier of [0,1]){
        const floors=tier?host.floors-cut:cut;if(!floors)continue;
        const w=host.w*(tier?.8:1),d=host.d*(tier?.86:1),height=floors*step,y=1.4+(tier?cut*step:0)+height/2;
        for(const [face,angle,local,width] of [
          ['south',0,[0,y,d/2+1.04],w],['east',Math.PI/2,[w/2+1.04,y,0],d],
          ['north',Math.PI,[0,y,-d/2-1.04],w],['west',-Math.PI/2,[-w/2-1.04,y,0],d]
        ]){
          const textHeight=Math.min(height*.68,width*.58*105/24),textWidth=textHeight*24/105;
          const region=tier===0?[(1-textWidth/width)/2,.17,textWidth/width,textHeight/height]:[0,0,0,0];
          surfaces.push({face,tier,angle,local,width,height,region,columns:Math.max(24,Math.round(width/.85)),rows:Math.ceil(height/.32)});
        }
      }
      return [{...spec,host,surfaces,frames:facadeContentFrames()}];
    });
  }
  function createFacadeMessages(T,city){
    const plan=facadeMediaPlan(city),count=plan.reduce((sum,p)=>sum+p.surfaces.length,0),data=new Uint8Array(128*128*4);
    // Five monochrome content frames share the existing immutable atlas; no bulb geometry.
    facadeContentFrames().forEach((mask,frame)=>{for(let y=0;y<105;y++)for(let x=0;x<24;x++)data.set([255,255,255,mask[y*24+x]],((104-y)*128+frame*24+x)*4);});
    const texture=new T.DataTexture(data,128,128,T.RGBAFormat);texture.colorSpace=T.SRGBColorSpace;texture.magFilter=texture.minFilter=T.NearestFilter;texture.needsUpdate=true;
    const geometry=new T.PlaneGeometry(1,1),material=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false});
    const mode=new T.InstancedBufferAttribute(new Float32Array(Math.max(1,count)),1),region=new T.InstancedBufferAttribute(new Float32Array(Math.max(1,count)*4),4),cells=new T.InstancedBufferAttribute(new Float32Array(Math.max(1,count)*2),2),clock={value:0},atlas={value:texture};
    const facadeLevel=new T.InstancedBufferAttribute(new Float32Array(Math.max(1,count)),1);
    geometry.setAttribute('facadeLevel',facadeLevel);
    geometry.setAttribute('facadeMode',mode);geometry.setAttribute('facadeRegion',region);geometry.setAttribute('facadeCells',cells);
    material.customProgramCacheKey=()=> 'town-full-facade-led-v6';
    material.onBeforeCompile=shader=>{
      shader.uniforms.facadeTime=clock;shader.uniforms.facadeAtlas=atlas;
      shader.vertexShader='attribute float facadeMode,facadeLevel; varying float vFacadeLevel; attribute vec4 facadeRegion; attribute vec2 facadeCells; varying float vFacadeMode; varying vec4 vFacadeRegion; varying vec2 vFacadeCells;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFacadeMode=facadeMode;vFacadeLevel=facadeLevel;vFacadeRegion=facadeRegion;vFacadeCells=facadeCells;');
      shader.fragmentShader='uniform float facadeTime; varying float vFacadeLevel; uniform sampler2D facadeAtlas; varying float vFacadeMode; varying vec4 vFacadeRegion; varying vec2 vFacadeCells;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
        // Antialiased physical LED columns remain continuous beyond the text area.
        float column=vMapUv.x*vFacadeCells.x;
        float edge=abs(fract(column)-.5),aa=max(fwidth(column),.012);
        float strip=1.0-smoothstep(.22-aa,.22+aa,edge);
        float diode=.88+.12*(1.0-smoothstep(.34,.49,abs(fract(vMapUv.y*vFacadeCells.y)-.5)));
        float curtain=.56+.012*sin(vMapUv.y*6.2831853-facadeTime*.5235988);
        vec3 led=vec3(curtain);float glyph=0.0,heart=0.0;
        if(vFacadeRegion.z>0.0){
          vec2 uv=(vMapUv-vFacadeRegion.xy)/vFacadeRegion.zw;
          float inside=step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);
          float frame=vFacadeMode>2.5?vFacadeMode:(vFacadeMode>1.5?2.0:(facadeTime<6.0?0.0:1.0));
          float phase=mod(facadeTime,6.0);
          vec2 grid=vec2(uv.x*24.0,(1.0-uv.y)*105.0),sampleGrid=grid;
          float line=floor((grid.y-((frame<.5||abs(frame-3.0)<.1)?13.0:0.0))/27.0),envelope=1.0;
          if(frame<1.5){
            float age=phase-max(0.0,line)*(frame<.5?.55:.38),reveal=smoothstep(0.0,.45,age);
            envelope=reveal*(1.0-smoothstep(5.5,6.0,phase));
            if(frame<.5){float bounce=1.0+.025*sin(clamp(age/.8,0.0,1.0)*3.14159265);sampleGrid.x=(grid.x-12.0)/bounce+12.0;}
          }else if(frame<2.5){envelope=.98+.02*sin(facadeTime*.5235988);}
          vec2 cell=floor(sampleGrid);
          float mask=texture2D(facadeAtlas,vec2((frame*24.0+cell.x+.5)/128.0,(104.0-cell.y+.5)/128.0)).a;
          mask*=step(0.0,cell.x)*step(cell.x,23.0)*step(0.0,cell.y)*step(cell.y,104.0);
          glyph=mask*envelope*inside;
          heart=abs(frame-3.0)<.1&&abs(line-1.0)<.1?glyph:0.0;
          vec3 tint=vec3(.95,.95,.95);
          led=mix(led,tint,glyph);
        }
        // Alpha alone carries coverage: multiplying RGB by strip again darkens distant LEDs.
        float textCoverage=mix(strip,1.0,smoothstep(.30,.75,aa));
        diffuseColor*=vec4(led*diode,.97*mix(strip,textCoverage,glyph));
      `);
      // Text has its own luminous ink; only the shared facade schedule controls its gain.
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nvec3 ink=vFacadeMode>2.5?vec3(.36,.82,1.35):vec3(1.45,.96,.30);\nink=mix(ink,vec3(1.4,.035,.065),heart);\ndiffuseColor.rgb=mix(diffuseColor.rgb,ink*1.35*vFacadeLevel*diode,glyph);');
    };
    const mesh=new T.InstancedMesh(geometry,material,Math.max(1,count));mesh.name='showcase-facade-messages';mesh.castShadow=false;mesh.frustumCulled=false;mesh.count=0;mesh.visible=false;
    const matrix=new T.Matrix4(),position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3(),color=new T.Color(),up=new T.Vector3(0,1,0);
    let matrixKey='',colorKey='',disposed=false,active=[];
    function update(levels,time,sample,daySeconds){
      clock.value=facadeScreenFrame(1,daySeconds).phase;
      if(disposed)return;active=plan.map(p=>({p,level:sample(p.host,time).complete?(levels.get(p.host)||0):0}));
      const visible=active.filter(a=>a.level>0),mk=visible.map(a=>[a.p.host.id,a.p.host.x,a.p.host.z].join('/')).join('|'),ck=visible.map(a=>a.level).join('/');
      const move=mk!==matrixKey,tint=move||ck!==colorKey;let index=0;const owners=[];
      if(move||tint)for(const {p,level} of visible)for(const face of p.surfaces){
        if(move){position.set(p.host.x+face.local[0],face.local[1],p.host.z+face.local[2]);rotation.setFromAxisAngle(up,face.angle);scale.set(face.width,face.height,1);matrix.compose(position,rotation,scale);mesh.setMatrixAt(index,matrix);mode.setX(index,p.mode);region.setXYZW(index,...face.region);cells.setXY(index,face.columns,face.rows);}
        if(tint){mesh.setColorAt(index,color.set(p.tint).multiplyScalar(1.4*level));facadeLevel.setX(index,level);}owners.push(p.host.id);index++;
      }
      if(move){mesh.instanceMatrix.needsUpdate=true;mode.needsUpdate=true;region.needsUpdate=true;cells.needsUpdate=true;mesh.userData.buildingIds=owners;}
      if(tint&&mesh.instanceColor){mesh.instanceColor.needsUpdate=true;facadeLevel.needsUpdate=true;}
      mesh.count=visible.reduce((sum,a)=>sum+a.p.surfaces.length,0);mesh.visible=mesh.count>0;matrixKey=mk;colorKey=ck;
    }
    const info=({p,level})=>({id:p.host.ledgerId,text:p.text,faces:4,textFaces:p.surfaces.filter(s=>s.region[2]>0).length,segments:p.surfaces.length,level:disposed?0:level,background:'vertical-led-curtain'});
    const current=()=>active.length?active:plan.map(p=>({p,level:0}));
    function getInfo(){return current().filter(({p})=>p.mode>=3).map(info);}
    function getScreenInfo(){return current().filter(({p})=>p.mode<3).map(a=>({...info(a),...facadeScreenFrame(a.p.mode,clock.value)}));}
    function dispose(){if(disposed)return;disposed=true;mesh.dispose();geometry.dispose();material.dispose();texture.dispose();mesh.removeFromParent();}
    return {mesh,update,getInfo,getScreenInfo,dispose};
  }

  function createNightShowcase(T, ak, n={}) {const O=new T.Group();O.name='night-showcase';const Z=ak.buildings.filter(b=>/^t-(one|two|three|four)$/.test(b.ledgerId)),aD=Z.find(b=>b.ledgerId==='t-two');const F=(ak.places||[]).find(p=>p.kind==='plaza'),C=ak.playground;const R=new Map(),W=new Map(Z.map(b=>[b,['t-one','t-three'].includes(b.ledgerId)?'#8cb8d8':'#e7b16e']));const av=b=>b===F?'c-plaza':b===C?'playground':b.ledgerId;const k=ak.buildings.find(b=>b.ledgerId==='c-mall');const m=[],B=[],S=[],X=[],aq=[],P=[];if(n.scene)lineScenes.set(n.scene,P);const bp=n.box||new T.BoxGeometry(1,1,1);if(!n.box)X.push(bp);const aP=n.kit&&n.kit.metal||new T.MeshStandardMaterial({color:'#ffffff',roughness:.42,metalness:.5});if(!n.kit||!n.kit.metal)X.push(aP);const be=n.accentMaterial||new T.MeshBasicMaterial({color:'#ffffff',toneMapped:false});if(!n.accentMaterial)X.push(be);let r=null,u=null,G=null,L=false,aw=0,Y=0,ac=0,N=n.bindings;const aG=new T.Matrix4(),al=new T.Vector3(),aM=new T.Quaternion(),aQ=new T.Vector3(),ar=new T.Color();const aR=root.CityModel||(typeof require==='function'?require('./city-model.js'):null);    function J(aS){const g=new T.Group();g.name='showcase-'+av(aS);g.userData.buildingId=aS.id;O.add(g);aq.push({host:aS,group:g});return g;}    function H(by,bz,x,y,z,w,h,d,bq,bA,br={}){const p={host:bz,local:[x,y,z,w,h,d],floor:bq,roof:!!bA,...br};by.push(p);return p;}    function aa(g,am,D,bB,bs,bt,as,aH,bf='#ffd39a',I=null){const E=new T.SpotLight(bf,0,180,bt,.8,1);E.name='showcase-'+av(am)+'-'+S.length;E.castShadow=false;E.position.fromArray(D);E.target.position.fromArray(bB);E.userData.ledgerId=av(am);g.add(E,E.target);S.push({host:am,light:E,power:bs,floor:as,roof:!!aH});E.distance=Math.min(180,Math.hypot(...bB.map((v,i)=>v-D[i]))+48);const aI=I||new T.Vector3(),w=Math.abs(aI.x)*2+.6,d=Math.abs(aI.z)*2+.6;if(I){E.userData.cityLineHalfSpan=I;E.penumbra=.65;P.push(E);H(B,am,D[0],D[1]+.03,D[2],w-.12,.08,d-.12,as,aH,{tint:bf});}H(m,am,D[0],D[1]-.22,D[2],I?w:.8,.42,I?d:.8,as,aH);const ax=D[1]<3?D[1]-.45:.35;for(const t of I?[-.8,0,.8]:[0])H(m,am,D[0]+aI.x*t,D[1]-.45-ax/2,D[2]+aI.z*t,.3,Math.max(.3,ax),.3,as,aH);return E;}    function V(bg,w,d,y,aT,bh,x=0,z=0){for(const bi of[-1,1]){H(B,bg,x,y,z+bi*(d/2+.5),w+1,.19,.19,aT,bh);H(B,bg,x+bi*(w/2+.5),y,z,.19,.19,d+1,aT,bh);}}for(const c of Z){const g=J(c),af=c.floorHeight||6,ag=c.floors>=15?Math.floor(c.floors*.74):c.floors;const ay=c.w*(ag<c.floors?.8:1),az=c.d*(ag<c.floors?.86:1),bd=1.4+c.floors*af;for(const[bC,an]of[['x',-1],['x',1],['z',-1],['z',1]]){const ab=bC==='x',bj=an*((ab?c.w:c.d)/2+6);const bD=aa(g,c,[ab?bj:0,1.6,ab?0:bj],[ab?an*c.w/2:0,Math.min(bd*.35,34),ab?0:an*c.d/2],145,1.25,1,false,W.get(c),new T.Vector3(ab?0:c.w*.48,0,ab?c.d*.48:0));bD.distance=Math.min(180,ag*af+28);if(ag<c.floors){const ah=an*((ab?ay:az)/2+4),bE=1.4+ag*af;aa(g,c,[ab?ah:0,bE+.6,ab?0:ah],[ab?an*ay/2:0,bd-3,ab?0:an*az/2],48,1.25,ag+1,false,W.get(c),new T.Vector3(ab?0:ay*.48,0,ab?az*.48:0));}}for(let M=3;M<c.floors;M++){const w=c.w*(M>=ag?.8:1),d=c.d*(M>=ag?.86:1),y=1.4+(M+.5)*af;for(const sx of[-1,1])for(const sz of[-1,1])H(B,c,sx*(w/2+.53),y,sz*(d/2+.53),.23,af-.25,.23,M+1,false);if(M%3===2)V(c,w,d,1.4+(M+1)*af-.56,M+1,false);}if(ag<c.floors)V(c,c.w,c.d,1.4+ag*af+.12,ag,false);V(c,ay,az,bd+.85,c.floors,true);V(c,ay,az,bd+1.55,c.floors,true);}if(k){const g=J(k),bk=k.floorHeight||6,aE=.2+k.floors*bk;for(let floor=1;floor<k.floors;floor++)V(k,k.w,k.d,.2+floor*bk-.17,floor,false);
for(const axis of [0,1])for(const side of [-1,1])for(let floor=0;floor<k.floors;floor++){
 const width=axis?k.w:k.d,face=side*((axis?k.d:k.w)/2+.76),y=.2+(floor+1)*bk-.35,pos=[axis?0:face,y,axis?face:0],target=[axis?0:side*k.w/2,y-3.2,axis?side*k.d/2:0];
  const E=new T.SpotLight('#ffe0aa',0,9,1.25,.7,1);E.name='showcase-mall-horizontal-'+S.length;E.userData.ledgerId='c-mall';E.userData.cityLineHalfSpan=new T.Vector3(axis?width*.48:0,0,axis?0:width*.48);E.position.fromArray(pos);E.target.position.fromArray(target);E.castShadow=false;P.push(E);g.add(E,E.target);S.push({host:k,light:E,power:22,floor:floor+1,roof:false});
 const mount=pos.slice();mount[axis?2:0]-=side*.16;
 H(m,k,...mount,axis?width+.2:.25,.12,axis?.25:width+.2,floor+1,false);
 const lens=pos.slice();lens[1]-=.035;
 H(B,k,...lens,axis?width*.96:.08,.055,axis?.08:width*.96,floor+1,false,{tint:'#fff0c6'});
}
for(const axis of [0,1])for(const side of [-1,1])for(const end of [-1,1]){
 const width=axis?k.w:k.d,face=side*((axis?k.d:k.w)/2+.65),points=[[end*width*.43,2.4],[end*width*.3,aE*.53],[end*width*.43,aE-.7]];
 for(let i=0;i<2;i++){const a=points[i],b=points[i+1],v=new T.Vector3(axis?b[0]-a[0]:0,b[1]-a[1],axis?0:b[0]-a[0]),mid=[axis?(a[0]+b[0])/2:face,(a[1]+b[1])/2,axis?face:(a[0]+b[0])/2],floor=Math.min(k.floors,Math.ceil(b[1]/bk)),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.clone().normalize());
 H(B,k,...mid,.32,v.length(),.32,floor,false,{rotation:q,tint:'#ead0a0'});
 const pos=mid.slice(),target=mid.slice();pos[axis?2:0]+=side*.8;target[axis?2:0]-=side*.65;
  const E=new T.SpotLight('#ffd69a',0,12,1.25,.7,1);E.name='showcase-mall-ribbon-'+S.length;E.userData.ledgerId='c-mall';E.userData.cityLineHalfSpan=v.multiplyScalar(.5);E.position.fromArray(pos);E.target.position.fromArray(target);E.castShadow=false;P.push(E);g.add(E,E.target);S.push({host:k,light:E,power:16,floor,roof:false});
 }
}V(k,k.w,k.d,aE+.25,k.floors,true);for(const sx of[-1,1])for(const sz of[-1,1])H(B,k,sx*(k.w/2+.55),aE/2,sz*(k.d/2+.55),.2,aE,.2,k.floors,false);const bu=root.document;if(bu&&bu.createElement){const ae=bu.createElement('canvas');ae.width=2048;ae.height=1152;const K=ae.getContext('2d'),U=K.createLinearGradient(0,0,2048,1152);U.addColorStop(0,'#1662c5');U.addColorStop(.65,'#2868a5');U.addColorStop(1,'#264660');K.fillStyle=U;K.fillRect(0,0,2048,1152);K.strokeStyle='#a8c6db';K.lineWidth=4;K.strokeRect(48,48,1952,1056);for(let i=0;i<42;i++){const x=i*50,h=130+(i*83%280);K.fillStyle=i%3?'#557f9c':'#adcddd';K.globalAlpha=.45+i%4*.1;K.fillRect(x,1110-h,34,h);for(let y=1110-h+18;y<1096;y+=25){K.globalAlpha=.7;K.fillRect(x+7,y,4,4);}}K.globalAlpha=1;K.textAlign='center';K.fillStyle='#edf7ff';K.font='bold 172px "Microsoft YaHei",sans-serif';K.fillText('城市之光',1024,440);K.font='50px "Microsoft YaHei",sans-serif';K.fillStyle='#b9e2ef';K.fillText('星河商场 · 共赴璀璨夜色',1024,575);K.font='32px sans-serif';K.fillStyle='#9cbacd';K.fillText('STAR RIVER  /  CITY LIGHTS',1024,655);u=new T.CanvasTexture(ae);}else u=new T.DataTexture(new Uint8Array([255,220,150,255]),1,1,T.RGBAFormat);u.colorSpace=T.SRGBColorSpace;u.wrapS=u.wrapT=T.ClampToEdgeWrapping;u.needsUpdate=true;X.push(u);G=new T.MeshBasicMaterial({color:'#ffffff',map:u,transparent:true,depthWrite:false,toneMapped:false});X.push(G);const ao=new T.PlaneGeometry(1,1);X.push(ao);r=new T.InstancedMesh(ao,G,1);r.name='showcase-screen';r.castShadow=false;r.frustumCulled=false;r.userData.buildingId=k.id;r.setMatrixAt(0,new T.Matrix4());r.setColorAt(0,new T.Color('#ffffff'));r.position.set(-k.w/2-1.0,aE*.62,0);r.rotation.y=-Math.PI/2;r.scale.set(Math.min(22,k.d*.48),Math.min(22,k.d*.48)*9/16,1);g.add(r);aa(g,k,[-k.w/2-2,aE*.62-Math.min(22,k.d*.48)*9/32-.7,0],[-k.w/2,5,0],42,.95,k.floors,false,'#ffe9c2');H(m,k,-k.w/2-.63,aE*.62,0,.46,Math.min(22,k.d*.48)*9/16+.6,Math.min(22,k.d*.48)+.6,k.floors,false);
 for(const side of [0,1])for(const dy of [-1.35,1.35])H(B,k,side?-22.1:0,1.4+k.floors*bk+3.45+dy,side?0:-24.1,side?.14:21,.14,side?21:.14,k.floors,true,{tint:'#fff3da'});}for(const b of ak.buildings.filter(b=>!Z.includes(b)&&b!==k)){const g=J(b),aW=b.floorHeight||6,bG=1.4+b.floors*aW;if(b.housing){const ai=b.housing.volumes;W.set(b,'#ffe4ba');for(const v of ai)V(b,v.w-.4,v.d-.4,1.4+v.floors*aW+.32,v.floors,false,v.x,v.z);for(const[bv,bm]of[[0,-1],[ai.length-1,1]]){const v=ai[bv];aa(g,b,[v.x,1.6,v.z+bm*(v.d/2+4)],[v.x,1.4+v.floors*aW*.5,v.z+bm*v.d/2],180,.78,1,false,'#ffe3b8');}}else{W.set(b,'#ffe0aa');const bH=root.CityFacilities||(typeof require==='function'?require('./city-facilities.js'):null),aA=bH&&bH.SITES.find(s=>s.facility===b.facility)||b,w=aA.mw||aA.w,d=aA.md||aA.d,z=aA.mz||0;const bw=['primary','secondary','workshop','depot','market'].includes(b.facility)?[['x',-1],['z',1]]:[['x',-1],['x',1],['z',-1],['z',1]];for(const[bI,aJ]of bw){const x=bI==='x';for(const t of[-.3,0,.3])aa(g,b,[x?aJ*(w/2+4):t*w,1.6,z+(x?t*d:aJ*(d/2+4))],[x?aJ*w/2:t*w,bG*.55,z+(x?t*d:aJ*d/2)],65,.9,1,false,'#ffe0af');}V(b,w,d,bG+.45,b.floors,true,0,z);}}if(F){const g=J(F);W.set(F,'#ffdb8d');for(const[x,z]of[[8,0],[-8,0],[0,8],[0,-8]])aa(g,F,[x,1.6,z],[x*.2,14,z*.2],65,.55,0,false,'#ffda94');V(F,11.4,11.4,.8,0,false);V(F,5.8,5.8,3.95,0,false);for(const sx of[-1,1])for(const sz of[-1,1]){const x=sx*19,z=sz*22;H(m,F,x,5,z,.25,9.5,.25,0,false);const bn=aa(g,F,[x,9.8,z],[sx*7,.3,sz*10],38,1,0,false,'#ffe6ba');const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,-1,0),bn.target.position.clone().sub(bn.position).normalize());H(m,F,x,9.8,z,1.8,.5,1.6,0,false,{rotation:q});const aX=new T.Vector3(0,-.32,0).applyQuaternion(q);H(B,F,x+aX.x,9.8+aX.y,z+aX.z,1.6,.1,1.4,0,false,{rotation:q,tint:'#fff0c9'});}}if(C){const g=J(C);W.set(C,'#e4efff');for(const sx of[-1,1])for(const sz of[-1,1]){const x=sx*18.5,z=sz*15;H(m,C,x,10.5,z,.45,20.5,.45,0,false);H(m,C,x,.55,z,1.7,.6,1.7,0,false);H(m,C,x,21,z,5,.35,.45,0,false);const aY=aa(g,C,[x,21,z],[-sx*5,.3,-sz*7],150,.8,0,false,'#e9f2ff');aY.distance=65;const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,-1,0),aY.target.position.clone().sub(aY.position).normalize());for(const dx of[-1.5,0,1.5]){H(m,C,x+dx,21,z,1.3,.6,1.5,0,false,{rotation:q});const aZ=new T.Vector3(0,-.37,0).applyQuaternion(q);H(B,C,x+dx+aZ.x,21+aZ.y,z+aZ.z,1.1,.1,1.3,0,false,{rotation:q,tint:'#e4efff'});}}}const infrastructure=(n.ground?.getNightLightAnchors()||[]).map(d=>{
 const light=new T.SpotLight(d.color,0,d.range,d.angle,.65,1);light.name=d.kind;light.userData.kind=d.kind;light.castShadow=false;O.add(light,light.target);
 if(d.span){light.userData.cityLineHalfSpan=new T.Vector3(...d.span);P.push(light);}
 if(d.kind==='bridge-flag')return{d,light};const size=d.kind==='tunnel-wall'?[2.58,.4,.5]:d.span?[Math.abs(d.span[0])*2+.18,.12,Math.abs(d.span[2])*2+.18]:[.42,.25,.42];
 const shell=H(m,d.host,0,0,0,...size,0,false,{infrastructure:d}),lens=H(B,d.host,0,0,0,...size.map(v=>v*.82),0,false,{infrastructure:d,tint:d.color});
 return {d,light,shell,lens};
 });
 const messages=createFacadeMessages(T,ak);O.add(messages.mesh);const f=createRooftopSearchlights(T,ak,aR,n.beamEmitters||[]);O.add(f.group);m.push(...f.fixtures);B.push(...f.accents);const j=new T.InstancedMesh(bp,aP,Math.max(1,m.length));j.name='showcase-fixtures';j.castShadow=!!n.castFixtures;j.receiveShadow=true;j.frustumCulled=false;O.add(j);const l=new T.InstancedMesh(bp,be,Math.max(1,B.length));l.name='showcase-gold';l.castShadow=false;l.frustumCulled=false;O.add(l);j.userData.buildingIds=m.map(p=>p.host.id);l.userData.buildingIds=B.map(p=>p.host.id);    const sampleCache=new Map(),instanceCache=new WeakMap(),tintCache=new Map();
    function aK(b,bJ){let value=sampleCache.get(b);if(!value){value=b===F||b===C||b.kind==='amusement'?{builtFloors:Infinity,complete:true}:aR.sampleBuilding(b,bJ);sampleCache.set(b,value);}return value;}    function aB(ba,bK){if(ba.infrastructure)return true;const s=aK(ba.host,bK);return s.builtFloors>=ba.floor&&(!ba.roof||s.complete);}    function bo(ad,bx,bL,ap){
let aj=0,matrixChanged=false,colorChanged=false;
let cache=instanceCache.get(ad);if(!cache){cache=[];instanceCache.set(ad,cache);}
const owners=ad.userData.buildingIds;
for(const p of bx){
 if(!aB(p,bL))continue;
 const level=p.infrastructure?p.level:p.searchlight?p.level||0:R.get(p.host)||0;
 if(ap&&level<=0)continue;
 const local=p.local,rotation=p.rotation||aM;
 const x=p.infrastructure?p.position[0]:p.host.x+local[0],y=p.infrastructure?p.position[1]:local[1],z=p.infrastructure?p.position[2]:p.host.z+local[2];
 let old=cache[aj];if(!old){old={};cache[aj]=old;}
 if(old.item!==p||old.x!==x||old.y!==y||old.z!==z||old.sx!==local[3]||old.sy!==local[4]||old.sz!==local[5]||old.qx!==rotation.x||old.qy!==rotation.y||old.qz!==rotation.z||old.qw!==rotation.w){
  al.set(x,y,z);aQ.set(local[3],local[4],local[5]);aG.compose(al,rotation,aQ);ad.setMatrixAt(aj,aG);matrixChanged=true;
  old.x=x;old.y=y;old.z=z;old.sx=local[3];old.sy=local[4];old.sz=local[5];old.qx=rotation.x;old.qy=rotation.y;old.qz=rotation.z;old.qw=rotation.w;
 }
 const tint=p.searchlight?p.tint:ap?p.tint||W.get(p.host)||'#ffd39a':p.tint||'#4a453c';
 let color=tint?.isColor?tint:tintCache.get(tint);
 if(!color){color=new T.Color(tint);tintCache.set(tint,color);}
 const gain=p.searchlight?level*2:ap?(Z.includes(p.host)?.72:p.host===k?1.05:1.5)*level:1;
 const red=Math.fround(color.r*gain),green=Math.fround(color.g*gain),blue=Math.fround(color.b*gain);
 if(old.item!==p||old.red!==red||old.green!==green||old.blue!==blue){
  ar.setRGB(red,green,blue);ad.setColorAt(aj,ar);colorChanged=true;old.red=red;old.green=green;old.blue=blue;
 }
 old.item=p;owners[aj]=p.host.id;aj++;
}
owners.length=aj;ad.count=aj;ad.visible=aj>0;
if(matrixChanged)ad.instanceMatrix.needsUpdate=true;
if(colorChanged)ad.instanceColor.needsUpdate=true;
}    function aL(aC,A,Q,aN){if(L)return;sampleCache.clear();const bN=(b,decorOnly=false)=>{if(b===C)return A&&A.minute>=1110&&A.minute<1320?A.lamps||0:0;const id=b&&av(b),au=id&&A&&A.buildings&&A.buildings[id];if(!au)return 0;if(!decorOnly&&Number.isFinite(au.facade))return Math.max(0,Math.min(1,au.facade));if(!Number.isFinite(au.decoration))return 0;const bO=N&&N.byLedgerId[id]?.ledger;const bP=root.CityLighting||(typeof require==='function'?require('./city-life-ext/lighting.js'):null);const bQ=bO&&bP?bP.isOpen(bO.open||'daily',A.day||1,A.minute):au.open;return bQ?Math.max(0,Math.min(1,au.decoration/(Z.includes(b)?.62:.5))):0;};for(const h of aq)R.set(h.host,bN(h.host));aw=R.get(aD)||0;Y=bN(k,true);ac=Number.isFinite(Q)?Q:0;for(const h of aq)h.group.position.set(h.host.x,0,h.host.z);for(const e of S)e.light.intensity=aB(e,aC)?e.power*(R.get(e.host)||0):0;f.update(aC,A,Q,aN);
 // Decorative water light recedes after the show; safety and flag lights retain their level.
 // 2026-10-09 拍板：喷泉彩灯脱离节目表——夜里（lamps>0）六灯各占一色相、整圈
 // 缓慢旋转，深夜随 quiet 一起变暗但不再退成单一冷白；停泵只停水的节目，不停灯。
 const minute=A?.minute||0,quiet=minute<360?.45:1-.55*Math.max(0,Math.min(1,(minute-1320)/60));
 for(const item of infrastructure){const {d,light,shell,lens}=item,pose=d.at(),level=(A?.lamps||0)*(d.kind==='bridge-flag'?(aN?.level||0):d.kind==='river-blue'?quiet:d.kind==='fountain-colour'?quiet*.65:1);
 light.position.fromArray(pose.position);light.target.position.fromArray(pose.target);light.intensity=d.power*level;
 if(d.kind==='fountain-colour'){if(level>0)light.color.setHSL((d.phase+ac*.008)%1,.62,.6);else light.color.set('#9dbbc8');}
 if(lens){lens.tint=light.color;lens.level=level;shell.level=level;shell.position=pose.position;lens.position=[pose.position[0],pose.position[1]+.075,pose.position[2]];}
 }
 messages.update(R,aC,aK,Q);bo(j,m,aC,false);bo(l,B,aC,true);if(r){r.visible=aK(k,aC).complete;G.opacity=1;G.color.setScalar(1.25+Y*1.55);u.repeat.set(1,1);u.offset.set(0,0);u.updateMatrix();}}    function bb(){return {facadeMessages:messages.getInfo(),facadeScreens:messages.getScreenInfo(),mallSearchlights:f.getInfo('mall'),amusementSearchlights:f.getInfo('amusement'),infrastructure:infrastructure.map(e=>({kind:e.d.kind,active:!L&&e.light.intensity>0})),plazaSearchlights:f.getInfo(true),coverage:aq.map(h=>({id:av(h.host),level:R.get(h.host)||0,activeLights:S.filter(e=>e.host===h.host&&e.light.intensity>0).length})),searchlights:f.getInfo(),towerId:aD&&aD.ledgerId,mallId:k&&k.ledgerId,lights:S.length,activeLights:L?0:S.filter(e=>e.light.intensity>0).length,towerLevel:aw,mallLevel:Y,screenActive:!!r&&!L&&r.visible,screenTime:ac,drawCalls:L?0:Number(j.visible)+Number(l.visible)+Number(r&&r.visible)+Number(messages.mesh.visible)+f.drawCalls,fixtureInstances:j.count,accentInstances:l.count};}    function bc(){if(L)return;L=true;if(n.scene&&lineScenes.get(n.scene)===P)lineScenes.delete(n.scene);messages.dispose();f.dispose();j.dispose();l.dispose();if(r)r.dispose();O.removeFromParent();O.clear();X.forEach(o=>o.dispose());}aL(0,null,0);return{group:O,fixtureMesh:j,accentMesh:l,update:aL,getInfo:bb,dispose:bc,setReflectionCapture:f.setReflectionCapture,setBindings:aO=>{N=aO;}};}
  function createInstanceAggregate(T,sources,compact=false){
const d=sources[0];if(!d||sources.some(m=>m.geometry!==d.geometry||m.material!==d.material||m.castShadow!==d.castShadow||m.receiveShadow!==d.receiveShadow))throw new Error('aggregate requires shared geometry and material');const f=sources.reduce((n,m)=>n+m.instanceMatrix.count,0),c=new T.InstancedMesh(d.geometry,d.material,f);c.name='vehicle-shell';c.castShadow=d.castShadow;c.receiveShadow=d.receiveShadow;c.frustumCulled=false;for(let i=0;i<f;i++)c.setColorAt(i,new T.Color('#ffffff'));    function h(g=[]){let e=0;const j=[];for(const a of sources){if(g.includes(a))continue;a.visible=false;if(compact){const b=a.instanceMatrix.array;for(let i=0;i<a.count;i++){const k=i*16;if(b[k]===0&&b[k+1]===0&&b[k+2]===0&&b[k+4]===0&&b[k+5]===0&&b[k+6]===0&&b[k+8]===0&&b[k+9]===0&&b[k+10]===0)continue;c.instanceMatrix.array.set(b.subarray(k,k+16),e*16);if(a.instanceColor)c.instanceColor.array.set(a.instanceColor.array.subarray(i*3,i*3+3),e*3);j.push(a.userData.buildingIds&&a.userData.buildingIds[i]||null);e++;}continue;}c.instanceMatrix.array.set(a.instanceMatrix.array.subarray(0,a.count*16),e*16);if(a.instanceColor)c.instanceColor.array.set(a.instanceColor.array.subarray(0,a.count*3),e*3);j.push(...(a.userData.buildingIds||Array(a.count).fill(null)).slice(0,a.count));e+=a.count;}c.userData.buildingIds=j;c.visible=e>0;c.count=e;c.instanceMatrix.needsUpdate=true;c.instanceColor.needsUpdate=true;}h();return{mesh:c,sync:h};}
function createStreetLighting(T,ground){
const c=new T.Group(),d=ground.group.userData.groundDetails.lampAnchors;c.name='street-surface-lighting';const b=ground.group.getObjectByName('street-light-pools'),k=b?Array.from(b.instanceMatrix.array):null;if(b){const n=new T.Matrix4().makeScale(0,0,0);d.forEach((a,i)=>b.setMatrixAt(i,n));b.instanceMatrix.needsUpdate=true;}const h=d.map(a=>{const l=new T.SpotLight('#ffe5bc',0,a.highMast?42:26,a.highMast?1.18:1.42,.7,2);l.name='street-surface-light';l.userData.anchor=a;l.castShadow=false;c.add(l,l.target);return l;});let e=false;function j(f){if(e)return;const m=Math.max(0,Math.min(1,f?.lamps||0));h.forEach((l,i)=>{const a=d[i];l.position.set(a.x,a.y+(a.highMast?17.05:8.06),a.z);l.target.position.set(a.x,a.y,a.z);l.intensity=m*(a.highMast?480:100);});}function g(){if(e)return;e=true;if(b){b.instanceMatrix.array.set(k);b.instanceMatrix.needsUpdate=true;}c.removeFromParent();c.clear();}return{group:c,update:j,dispose:g};}
const spotPasses=new WeakMap(),lineScenes=new WeakMap();
  function prepareGpuSpotRenderer(renderer){
if(spotPasses.has(renderer))return;
const state={pass:null},render=renderer.render;spotPasses.set(renderer,state);
renderer.render=function(...args){
const previous=state.pass,water=state.water,world=args[0];
const reuse=Boolean(previous&&water&&water.parent===previous&&water.scene===world&&previous.scene===world);
const auto=reuse?world.matrixWorldAutoUpdate:null;
state.pass={scene:world,camera:args[1]};
try{
// The outer scene pass already propagated transforms; the mirror camera still updates normally.
if(reuse)world.matrixWorldAutoUpdate=false;
const result=render.apply(this,args);if(reuse)water.rendered=true;return result;
}finally{if(reuse)world.matrixWorldAutoUpdate=auto;state.pass=previous;}
};
}
  function renderWaterReflection(reflect,renderer,scene,...args){
const state=spotPasses.get(renderer),previous=state.water,water={scene,parent:state.pass,rendered:false};
state.water=water;
try{reflect.call(this,renderer,scene,...args);return water.rendered;}
finally{state.water=previous;}
}
  function buildSpotGrid(T,p,world){
const c=[],v=[],e=[],f=new T.Vector3(),m=new T.Vector3(),l=new T.Matrix3().setFromMatrix4(world);let B=Infinity,C=Infinity,E=-Infinity,F=-Infinity;for(let i=0;i<p.count;i++){const k=i*16,a=p.data;if(!a[k+8]&&!a[k+9]&&!a[k+10])continue;v.push(i);const r=Math.abs(a[k+3]);if(!r){e.push(i);continue;}f.fromArray(a,k).applyMatrix4(world);m.fromArray(a,k+13).applyMatrix3(l);const G=r+Math.abs(m.x)+.01,H=r+Math.abs(m.z)+.01;const b=[i,Math.floor((f.x-G)/32),Math.floor((f.z-H)/32),Math.floor((f.x+G)/32),Math.floor((f.z+H)/32)];c.push(b);B=Math.min(B,b[1]);C=Math.min(C,b[2]);E=Math.max(E,b[3]);F=Math.max(F,b[4]);}const y=p.count+';'+e.join(',')+';'+c.join('|');if(p.gridKey===y)return false;p.gridKey=y;if(!c.length)B=C=E=F=0;let s=E-B+1,w=F-C+1,o=e.length*(s*w+1)+c.reduce((n,b)=>n+(b[3]-b[1]+1)*(b[4]-b[2]+1),0);const d=s*w>4096||p.count*16+(s*w+1)*4+o>65536;if(d){B=C=0;s=w=1;}const g=Array.from({length:1+s*w},()=>d?v.slice():e.slice());if(!d)for(const b of c)for(let z=b[2];z<=b[4];z++)for(let x=b[1];x<=b[3];x++)g[1+x-B+(z-C)*s].push(b[0]);o=g.reduce((n,D)=>n+D.length,0);const h=p.count*16,t=Math.max(16,Math.ceil((h+g.length*4+o)/16)*16);if(p.data.length<t){const u=new Float32Array(2**Math.ceil(Math.log2(t)));u.set(p.data.subarray(0,h));p.data=u;}else p.data.fill(0,h);let j=h+g.length*4,A=0;g.forEach((q,i)=>{q.sort((a,b)=>a-b);p.data[h+i*4]=j;p.data[h+i*4+1]=q.length;p.data.set(q,j);j+=q.length;A=Math.max(A,q.length);});(p.gridBounds||(p.gridBounds=new T.Vector4())).set(B,C,s,w);p.gridStats={total:p.count,active:v.length,cells:s*w,max:A,mean:(o-g[0].length)/(s*w),fallback:d};return true;}
const spotLoopPrepared=new WeakSet(),packedSpots=new WeakMap();
  function prepareGpuSpotLoop(T,d){if(!d||spotLoopPrepared.has(d)||(!d.isMeshStandardMaterial&&!d.userData?.cityWaterLighting))return;const C=d.onBeforeCompile,L=d.customProgramCacheKey(),n=new Set(),s=new T.Matrix4();d.addEventListener('dispose',()=>{for(const p of n){p.users.delete(d);if(!p.users.size){p.texture.dispose();p.cache.delete(p.native);}}n.clear();});d.onBeforeCompile=function(e,f){C.call(this,e,f);if(e.numSpotLights<1||e.numSpotLightShadows||e.numSpotLightMaps)return;const G=`vec3 cityWorld=(citySpotWorld*vec4(geometryPosition,1.0)).xyz;
      ivec2 cell=ivec2(floor(cityWorld.xz/32.0))-ivec2(citySpotGrid.xy);
      int slot=0;if(all(greaterThanEqual(cell,ivec2(0)))&&all(lessThan(cell,ivec2(citySpotGrid.zw))))slot=1+cell.x+cell.y*int(citySpotGrid.z);
      int header=citySpotLightCount*4+slot;vec2 bucket=texelFetch(citySpotData,ivec2(header%4,header/4),0).xy;
      for(int j=0;j<int(bucket.y);j++){
      int scalar=int(bucket.x)+j;vec4 ids=texelFetch(citySpotData,ivec2((scalar/4)%4,scalar/16),0);int i=int(ids[scalar%4]);

      vec4 p=texelFetch(citySpotData,ivec2(0,i),0);
      if(p.w<0.0){vec3 span=texelFetch(citySpotData,ivec2(3,i),0).yzw;float len2=dot(span,span);
        p.xyz+=span*clamp(dot(geometryPosition-p.xyz,span)/max(len2,.000001),-1.0,1.0);p.w=-p.w;}
      vec3 cityDelta=p.xyz-geometryPosition;
      if(p.w>0.0&&dot(cityDelta,cityDelta)>p.w*p.w)continue;
      vec4 c=texelFetch(citySpotData,ivec2(2,i),0);
      if(all(equal(c.rgb,vec3(0.0))))continue;
      vec4 d=texelFetch(citySpotData,ivec2(1,i),0);
      SpotLight cityLight;cityLight.position=p.xyz;cityLight.distance=p.w;cityLight.direction=d.xyz;cityLight.coneCos=d.w;
      cityLight.color=c.rgb;cityLight.penumbraCos=c.w;cityLight.decay=texelFetch(citySpotData,ivec2(3,i),0).x;
      getSpotLightInfo( cityLight, geometryPosition, directLight );
      if ( directLight.visible ) RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
    }`;const I=T.ShaderChunk.lights_fragment_begin.replace(/#pragma unroll_loop_start\s*for \( int i = 0; i < NUM_SPOT_LIGHTS; i \+\+ \) \{([\s\S]*?)\}\s*#pragma unroll_loop_end/,G);e.uniforms.citySpotLightCount={value:e.numSpotLights};function H(){const h=e.uniforms.spotLights.value;let q=packedSpots.get(f);if(!q){q=new WeakMap();packedSpots.set(f,q);}let c=q.get(h);if(!c){c={cache:q,native:h,users:new Set()};q.set(h,c);}if(c.count!==h.length){c.count=h.length;c.data=new Float32Array(Math.max(1,h.length)*16);c.gridKey=null;}c.users.add(d);n.add(c);const t=spotPasses.get(f)?.pass;if(t&&c.pass===t)return c;c.pass=t;const a=c.data;let A=false;const j=(k,v)=>{v=Math.fround(v);if(a[k]!==v){a[k]=v;A=true;}};const m=lineScenes.get(t?.scene),D=t?.camera?.matrixWorldInverse;if(c.sources!==m){c.sources=m;c.lines=new WeakMap();}const u=new T.Vector3(),J=new T.Vector3(),K=new T.Matrix4(),F=new T.Matrix3();for(let i=0;i<h.length;i++){const l=h[i],k=i*16;u.set(0,0,0);if(m&&D){if(!c.lines.has(l))c.lines.set(l,m.find(o=>o.distance===l.distance&&Math.abs(Math.cos(o.angle)-l.coneCos)<1e-10&&J.setFromMatrixPosition(o.matrixWorld).applyMatrix4(D).distanceToSquared(l.position)<1e-10)||null);const w=c.lines.get(l);if(w)u.copy(w.userData.cityLineHalfSpan).applyMatrix3(F.setFromMatrix4(K.multiplyMatrices(D,w.matrixWorld)));}j(k,l.position.x);j(k+1,l.position.y);j(k+2,l.position.z);j(k+3,u.lengthSq()?-l.distance:l.distance);j(k+13,u.x);j(k+14,u.y);j(k+15,u.z);j(k+4,l.direction.x);j(k+5,l.direction.y);j(k+6,l.direction.z);j(k+7,l.coneCos);j(k+8,l.color.r);j(k+9,l.color.g);j(k+10,l.color.b);j(k+11,l.penumbraCos);j(k+12,l.decay);}A=buildSpotGrid(T,c,t?.camera?.matrixWorld||s)||A;if(!c.texture||c.texture.image.data!==c.data){if(c.texture)c.texture.dispose();c.texture=new T.DataTexture(c.data,4,c.data.length/16,T.RGBAFormat,T.FloatType);A=true;}if(A)c.texture.needsUpdate=true;const E=spotPasses.get(f);if(E)E.stats=c.gridStats;return c;}e.uniforms.citySpotData={get value(){return H().texture;}};e.uniforms.citySpotGrid={get value(){return H().gridBounds;}};e.uniforms.citySpotWorld={get value(){return spotPasses.get(f)?.pass?.camera?.matrixWorld||s;}};e.fragmentShader=e.fragmentShader.replace('#include <lights_pars_begin>',T.ShaderChunk.lights_pars_begin.replace('uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];','uniform sampler2D citySpotData;'));if(d.userData.cityWaterLighting){ const B=G.replace('if ( directLight.visible ) RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );','if(directLight.visible){float facing=max(dot(geometryNormal,directLight.direction),0.0);vec3 halfVector=normalize(directLight.direction+geometryViewDir);cityWaterLight+=directLight.color*(facing>0.0?.4*facing+.08*pow(max(dot(geometryNormal,halfVector),0.0),48.0):0.0);}'); e.fragmentShader=e.fragmentShader.replace('/* city-water-lights */','vec3 geometryPosition=(viewMatrix*vec4(vWaterPosition,1.0)).xyz;vec3 geometryNormal=normalize(mat3(viewMatrix)*vec3(a*.035,1.0,b*.035));vec3 geometryViewDir=normalize(-geometryPosition);IncidentLight directLight;'+B); } e.fragmentShader='uniform int citySpotLightCount;uniform vec4 citySpotGrid;uniform mat4 citySpotWorld;\n'+e.fragmentShader.replace('#include <lights_fragment_begin>',I);};d.customProgramCacheKey=()=>L+'|city-spot-loop-v6';spotLoopPrepared.add(d);d.needsUpdate=true;}
const shadowPrepared=new WeakSet();
  function prepareOpaqueShadow(T,mesh){
if(!mesh.isMesh||shadowPrepared.has(mesh))return;
const before=mesh.onBeforeShadow,after=mesh.onAfterShadow;let maps=null;
mesh.onBeforeShadow=function(...args){before.apply(this,args);const depth=args[5];
if(!this.customDepthMaterial&&depth.isMeshDepthMaterial&&depth.depthPacking===T.RGBADepthPacking&&!depth.alphaTest&&!depth.alphaHash&&!depth.displacementMap){maps=[depth,depth.map,depth.alphaMap];depth.map=null;depth.alphaMap=null;}
};
mesh.onAfterShadow=function(...args){if(maps){maps[0].map=maps[1];maps[0].alphaMap=maps[2];maps=null;}after.apply(this,args);};shadowPrepared.add(mesh);
}
  // The city instance writer and inspection previews consume these same parts.
  const PERSON_BATCHES={torso:1,head:3,legs:4,arms:4,backpack:3};
  function personGeometries(T){
    return {box:new T.BoxGeometry(1,1,1),sphere:new T.SphereGeometry(1,12,8),cylinder:new T.CylinderGeometry(1,1,1,10)};
  }
  function personParts(p,out){
    const o=out||{pose:{legs:new Array(18),arms:new Array(18)},parts:[]};
    if(!o.parts.length)for(const [batch,count] of Object.entries(PERSON_BATCHES))for(let index=0;index<count;index++)
      o.parts.push({batch,index,shape:batch==='head'?'sphere':batch==='backpack'?'box':batch==='torso'?'cylinder':'limb',position:[0,0,0],scale:[1,1,1],a:[0,0,0],b:[0,0,0],radius:batch==='legs'?.145:.13,visible:true});
    const pose=personPose(p,o.pose),parts=o.parts;
    function copy(v,a,k){v[0]=a[k];v[1]=a[k+1];v[2]=a[k+2];}
    function place(part,x,z,y,sx,sy,sz){part.position[0]=x;part.position[1]=z;part.position[2]=y;part.scale[0]=sx;part.scale[1]=sy;part.scale[2]=sz;}
    place(parts[0],pose.lean*.5,0,2.37+pose.bob,.30,1.34,.46);
    place(parts[1],pose.lean,0,pose.headY,.38,.41,.36);
    for(let side=0;side<2;side++){
      const base=side*9;
      for(let segment=0;segment<2;segment++){
        for(let limbType=0;limbType<2;limbType++){
          const offset=limbType?8:4,points=limbType?pose.arms:pose.legs;
          const part=parts[offset+side*2+segment],k=base+segment*3;copy(part.a,points,k);copy(part.b,points,k+3);
        }
      }
      const k=base+6;
      place(parts[2+side],pose.arms[k],pose.arms[k+1],pose.arms[k+2],.14,.17,.14);
      place(parts[12+side],pose.legs[k]+.10,pose.legs[k+1],pose.legs[k+2]-.035,.44,.20,.30);
    }
    place(parts[14],-.36,0,2.48+pose.bob,.34,.82,.65);parts[14].visible=pose.pack;
    return o;
  }
  function createPersonPreview(T,options={}){
    const source=options.materials;
    if(!source?.skin||!source?.dark||!source?.clothes)throw new TypeError('预览需要城市场景的 skin/dark/clothes 材质');
    const actor={x:0,y:0,z:0,heading:0,size:1,kind:'walker',phase:0,color:'#648979',...options.actor};
    const geometries=personGeometries(T),materials={skin:source.skin.clone(),dark:source.dark.clone(),clothes:source.clothes.clone()};
    const object=new T.Group(),batches={},rig=personParts(actor),matrix=new T.Matrix4(),hidden=new T.Matrix4().makeScale(0,0,0);
    const pos=new T.Vector3(),scale=new T.Vector3(),q=new T.Quaternion(),up=new T.Vector3(0,1,0),a=new T.Vector3(),b=new T.Vector3(),direction=new T.Vector3();
    const tint=new T.Color(actor.color).lerp(new T.Color('#88918a'),.28);
    for(const [name,count] of Object.entries(PERSON_BATCHES)){
      const geometry=geometries[name==='head'?'sphere':name==='backpack'?'box':'cylinder'];
      const material=materials[name==='head'?'skin':name==='legs'||name==='backpack'?'dark':'clothes'];
      const mesh=new T.InstancedMesh(geometry,material,count);mesh.name='person-'+name;mesh.frustumCulled=false;batches[name]=mesh;object.add(mesh);
      if(name==='torso'||name==='arms')for(let i=0;i<count;i++)mesh.setColorAt(i,tint);
    }
    let disposed=false;
    function update(seconds){
      if(disposed)return;
      const time=Number.isFinite(seconds)?seconds:0,p={...actor,phase:actor.phase+time*4};
      personParts(p,rig);const c=Math.cos(p.heading),s=Math.sin(p.heading),size=p.size||1;
      const local=(v,point)=>v.set(p.x+(point[0]*c-point[1]*s)*size,p.y+point[2]*size,p.z+(point[0]*s+point[1]*c)*size);
      for(const part of rig.parts){
        const mesh=batches[part.batch];
        if(!part.visible){mesh.setMatrixAt(part.index,hidden);continue;}
        if(part.shape==='limb'){
          local(a,part.a);local(b,part.b);pos.copy(a).add(b).multiplyScalar(.5);direction.copy(b).sub(a);scale.set(part.radius*size,direction.length(),part.radius*size);q.setFromUnitVectors(up,direction.normalize());
        }else {local(pos,part.position);scale.set(part.scale[0]*size,part.scale[1]*size,part.scale[2]*size);q.setFromAxisAngle(up,-p.heading);}
        matrix.compose(pos,q,scale);mesh.setMatrixAt(part.index,matrix);
      }
      for(const mesh of Object.values(batches))mesh.instanceMatrix.needsUpdate=true;
      object.updateMatrixWorld(true);
    }
    update(0);
    return {object,update,dispose(){
      if(disposed)return;disposed=true;
      for(const mesh of object.children)mesh.dispose();
      for(const resource of new Set([...Object.values(geometries),...Object.values(materials)]))resource.dispose();
      object.clear();
    }};
  }

  // Stable place semantics are stored on source slots before demand is sampled.
  function townAppearanceActors(life,sample){
    const slots=new Map((life.town?.slots||[]).map(slot=>[slot.source.id,slot]));
    return [...sample.pedestrians,...sample.shoppers].filter(p=>p.kind!=='ferris').map(p=>{
      const slot=slots.get(p.id),kind=life.town?.bindings?.byLedgerId[slot?.ledgerId]?.kind;
      const sports=['track','football'].includes(slot?.source.activity);
      const schoolRole={primary:'student-p',secondary:'student-m',university:'student-u'}[kind];
      const appearanceRole=sports?'student-m':p.kind==='caller'?schoolRole||(kind==='hospital'?'medical-doc':undefined):undefined;
      return {...p,appearanceRole,appearanceTint:sports?slot.source.color:undefined};
    });
  }
  function create(settings) {
const T=root.THREE;
const renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});
prepareGpuSpotRenderer(renderer);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
const scene=new T.Scene();scene.background=new T.Color('#e9f0f5');
const camera=new T.PerspectiveCamera(30,1,5,settings.solarShow?5000:2400);
const kit=CityMaterials.create(T,renderer,settings);scene.environment=kit.environment;scene.environmentIntensity=.65;
    // A fixed uniform layout is compiled with the existing materials once.
    // Preview toggles never change NUM_POINT_LIGHTS or allocate shader variants.
    const fireworkLighting={enabled:{value:0},
      sources:{value:Array.from({length:8},()=>new T.Vector4())},
      colors:{value:Array.from({length:8},()=>new T.Color(0,0,0))}};
    kit.fireworkLighting=fireworkLighting;
    const fireworkMaterials=new WeakSet();
    const fireworkDeclarations='uniform float fireworkEnabled;\nuniform vec4 fireworkSources[8];\nuniform vec3 fireworkColors[8];\n';
    function prepareFireworkMaterial(mat){
      if(!mat?.isMeshStandardMaterial||fireworkMaterials.has(mat))return;
      fireworkMaterials.add(mat);
      const previous=mat.onBeforeCompile,previousKey=mat.customProgramCacheKey();
      mat.onBeforeCompile=function(shader,render){
        previous.call(this,shader,render);
        Object.assign(shader.uniforms,{fireworkEnabled:fireworkLighting.enabled,fireworkSources:fireworkLighting.sources,fireworkColors:fireworkLighting.colors});
        shader.fragmentShader=fireworkDeclarations+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',`#include <lights_fragment_begin>
          if(fireworkEnabled > .5){
            for(int f=0;f<8;f++){
              if(fireworkSources[f].w > .001){
                vec3 fireDelta=(viewMatrix*vec4(fireworkSources[f].xyz,1.0)).xyz-geometryPosition;
                float fireD2=dot(fireDelta,fireDelta);
                if(fireD2 < 52900.0){
                  float fireD=sqrt(max(fireD2,.01));
                  float fireFall=pow(max(0.0,1.0-fireD/230.0),2.0);
                  directLight.color=fireworkColors[f]*fireworkSources[f].w*fireFall;
                  directLight.direction=fireDelta/fireD;
                  directLight.visible=true;
                  RE_Direct(directLight,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,material,reflectedLight);
                }
              }
            }
          }`);
      };
      mat.customProgramCacheKey=()=>previousKey+'|town-firework-light-v1';
    }
function skyLoaded(){lastSignature='';lastReflection=-1;facadeReflectionKey='';facadePending=true;cancelFacadeJob();}
let visibleSky=CityMaterials.createSky(T,settings.seed,skyLoaded);scene.add(visibleSky.mesh);
const sky=new T.HemisphereLight(0xc4dbf5,0xb6a38a,.35);scene.add(sky);
const sun=new T.DirectionalLight(0xffe4c4,3.5);sun.position.set(-300,330,-150);sun.castShadow=true;
sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-345,right:345,top:345,bottom:-345,near:10,far:900});
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias=-.000035;sun.shadow.normalBias=.07;sun.shadow.radius=2.8;scene.add(sun);scene.add(sun.target);
const moon=new T.DirectionalLight(0x8fa7cc,0);moon.castShadow=false;scene.add(moon);
const SKY_NOON=new T.Color('#e9f0f5'),SKY_DUSK=new T.Color('#c98a5e'),SKY_NIGHT=new T.Color('#131c2b');
const HEMI_NOON=new T.Color(0xc4dbf5),HEMI_NIGHT=new T.Color('#5f739a');
const HEMI_GROUND_NOON=new T.Color(0xb6a38a),HEMI_GROUND_NIGHT=new T.Color('#1b2431');
const SUN_NOON=new T.Color(0xffe4c4),SUN_LOW=new T.Color('#ffb27a');
const skyScratch=new T.Color();// reused every frame; the background is mutated in place
const box=new T.BoxGeometry(1,1,1),sphere=new T.SphereGeometry(1,12,8),cylinder=new T.CylinderGeometry(1,1,1,10);
const matrix=new T.Matrix4(),q=new T.Quaternion(),pos=new T.Vector3(),scale=new T.Vector3(),up=new T.Vector3(0,1,0),direction=new T.Vector3();
const scratchTarget=new T.Vector3(),scratchDir=new T.Vector3(),scratchOffset=new T.Vector3(),scratchCenter=new T.Vector3(),scratchProjected=new T.Vector3();
let projectedX=[],projectedY=[];
const materialCache=new Map(),ownedMaterials=[];
    function material(name,color,roughness=.6){if(!materialCache.has(name)){const m=new T.MeshStandardMaterial({color,roughness,metalness:name==='trim'?.45:0});prepareFireworkMaterial(m);materialCache.set(name,m);ownedMaterials.push(m);}return materialCache.get(name);}
const trim=material('trim','#bbc7c7',.32),roofMat=material('roof','#a5aca6',.9),clothes=material('clothes','#ffffff',.85),rubber=material('rubber','#303b3a',.95),carPaint=material('car','#ffffff',.26);
let solarShow=null,solarBounds=[];
let city,life,ground,facilities=null,housing=null,frontage=null,helipad=null,airship=null,buildingRoot,actorRoot,buildings=[],plinthBatch=null,actors,bounds=[],district=null,prototype=null,prototypeBuilding=null,width=0,height=0,pixelRatio=0,lastColors='',lastSignature='',lastShadow=-1,lastReflection=-1,lastCamera='',lastWaterCamera='',waterCameraMoving=false,facadeDeferred=false,waterPending=false,reflect,actorsData=null,windowLights=[];
let facadeReflection=null,facadeReflectionKey='',facadeMaterials=[],facadeLight=1;
let initialProgramsPrepared=false,programsQueued=false,painted=false,facadeJob=null,facadePending=true;
let townView=null,townBindings=null;
let officeWindows=null,officePanes=[],officeLightKey='',officeArchitecture=null;
const pickRay=new T.Raycaster(),pickBox=new T.Box3(),pickPoint=new T.Vector3();
    // Review is opt-in and uses the existing city, camera, lighting and batches.
    let effectPreview=null,fireworkShow=null,fireworkTowerPlan=[];
    const effectScreenPoint=new T.Vector3();
    // Fixed world-space charge plane, facing the default show view. Orbiting
    // changes projection only; it must never redirect already burning particles.
    const effectGlyphBasis={right:new T.Vector3(Math.cos(2.3),0,-Math.sin(2.3)),up:new T.Vector3(0,1,0)};
    function setEffectPreview(next){
      const mode=next&&next.mode,previous=effectPreview?.mode,previousShow=effectPreview?.show,previousShape=effectPreview?.shape,previousSite=effectPreview?.selectedSite;
      effectPreview=mode==='fountain'||mode==='fireworks'
        ?{mode,shape:next.shape||'auto',selectedSite:next.selectedSite||'',show:next.show===true,seconds:Math.max(0,Number(next.seconds)||0),minute:Number.isFinite(next.minute)?next.minute:1263.1}:null;
      if(previous!==effectPreview?.mode||previousShow!==effectPreview?.show||previousShape!==effectPreview?.shape||previousSite!==effectPreview?.selectedSite)lastReflection=-1;
      lastSignature='';
    }
    function updateFireworkLighting(){
      const lamps=ground.getInfo().lampLevel;
      fireworkLighting.enabled.value=fireworkShow?1:0;
      fireworkLighting.sources.value.forEach(v=>v.set(0,0,0,0));
      if(!fireworkShow)return;
      for(const [slot,light] of fireworkShow.lights.entries()){
        const i=effectPreview?fireworkShow.sites.findIndex(site=>site.id===light.siteId):slot;
        if(i<0||light.energy<=0)continue;
        // Sustained light comes from the stars that are still burning, at their
        // brightness-weighted moving centre. It ends with them, not a fixed timer.
        const luminance=.2126*light.r+.7152*light.g+.0722*light.b;
        const balance=1/Math.max(.55,Math.sqrt(luminance));
        const power=2.2*light.energy*balance*(.28+.72*lamps);
        fireworkLighting.sources.value[i].set(light.x,light.y,light.z,power);
        fireworkLighting.colors.value[i].setRGB(light.r,light.g,light.b);
      }
    }
    function updateEffectPreview(state){
      if(ground.setFountainPreview)ground.setFountainPreview(effectPreview?.mode==='fountain'
        ?{enabled:true,seconds:effectPreview.seconds,minute:effectPreview.minute,show:effectPreview.show}:null);
      if(effectPreview?.mode==='fireworks'&&root.CityFireworks&&ground.setFireworksPreview){
        camera.updateMatrixWorld(true);
        fireworkShow=root.CityFireworks.townShow(effectPreview.seconds,
          {seed:city.seed,festival:1,city:city,shape:effectPreview.shape,glyphBasis:effectGlyphBasis});
        ground.setFireworksPreview({...fireworkShow,origin:{x:0,y:0,z:0},camera,selectedSite:effectPreview.selectedSite});
      }else if(!effectPreview&&root.CityFireworks&&ground.setFireworksPreview){
        camera.updateMatrixWorld(true);
        const show=root.CityFireworks.nightlyShow(state.daySeconds,{city,seed:city.seed,constructionTime:state.time,towerPlan:fireworkTowerPlan,glyphBasis:effectGlyphBasis});
        fireworkShow=show.enabled&&show.phase!=='off'?show:null;
        ground.setFireworksPreview(fireworkShow?{...show,origin:{x:0,y:0,z:0},camera,cull:true}:null);
      }else { fireworkShow=null;if(ground.setFireworksPreview)ground.setFireworksPreview(null); }
      updateFireworkLighting();
    }
    function effectPreviewInfo(){return {mode:effectPreview?.mode||(fireworkShow?'nightly':'none'),seconds:effectPreview?.seconds??fireworkShow?.seconds??0,
      minute:effectPreview?.minute??fireworkShow?.minute,window:[1140,1320],fireworks:{...(ground?.getInfo().sparks||{count:0}),
        illumination:{enabled:fireworkLighting.enabled.value===1,sources:fireworkLighting.sources.value.map((v,i)=>({position:v.toArray().slice(0,3),power:v.w,color:fireworkLighting.colors.value[i].toArray()}))},
        towerJets:fireworkShow?.towerJets||[],shells:fireworkShow?.shells.map(s=>({siteId:s.siteId,shapeName:s.shapeName,fireTime:s.fireTime,apexY:s.apexY}))||[],
        screenSites:(fireworkShow?.sites||[]).map(site=>{
          effectScreenPoint.set(site.x,site.y+.6,site.z).project(camera);
          return {id:site.id,label:site.label,x:(effectScreenPoint.x+1)*.5,y:(1-effectScreenPoint.y)*.5,
            visible:effectScreenPoint.z>-1&&effectScreenPoint.z<1&&Math.abs(effectScreenPoint.x)<1&&Math.abs(effectScreenPoint.y)<1};
        })},fountain:ground?.getInfo().fountain,
      resources:{programs:renderer.info.programs.length,...renderer.info.memory}};}
let zoomAnchor=null,zoomCache=null,lastFramingDistance=20;
    function zoomAnchorKey(px,py,w,h,state){
return[px,py,w,h,state.yaw,state.pitch,state.cameraYaw,state.cameraPitch,
state.cameraX,state.cameraY,state.cameraZ,state.panX,state.panY,
state.focusBuilding,state.focusFacility,JSON.stringify(state.observationBounds),
JSON.stringify(state.flyTarget)].join('|');
}
    function clearZoomAnchor(){zoomAnchor=null;zoomCache=null;}
    function captureZoomAnchor(px,py,w,h,state){
if(zoomAnchor)return;// Several wheel events can arrive before one render.
const now=performance.now(),key=zoomAnchorKey(px,py,w,h,state);
if(zoomCache&&zoomCache.key===key&&now-zoomCache.time<180){
zoomAnchor=zoomCache;return;
}
camera.updateMatrixWorld();
const cursor=new T.Vector2(px/w*2-1,1-py/h*2);
const normal=camera.getWorldDirection(new T.Vector3());
let point=null;
if(px!==w*.5||py!==h*.5){
pickRay.setFromCamera(cursor,camera);
for(const hit of pickRay.intersectObjects(scene.children.filter(object=>object!==actorRoot&&!object.isLight&&!object.isCamera),true)){
let shown=true;for(let object=hit.object;object;object=object.parent)if(!object.visible){shown=false;break;}
if(shown&&hit.distance>=camera.near&&hit.distance<=camera.far){point=hit.point.clone();break;}
}
}
if(!point)point=camera.position.clone().addScaledVector(normal,lastFramingDistance);
const plane=new T.Plane().setFromNormalAndCoplanarPoint(normal,point);
pickRay.setFromCamera(cursor,camera);
const anchor=pickRay.ray.intersectPlane(plane,new T.Vector3());
if(anchor)zoomAnchor=zoomCache={cursor,plane,point:anchor.clone(),px,py,w,h,key,time:now};
}
    function applyZoomAnchor(state){
if(!zoomAnchor)return;
const anchor=zoomAnchor;zoomAnchor=null;
camera.updateMatrixWorld();pickRay.setFromCamera(anchor.cursor,camera);
const projected=pickRay.ray.intersectPlane(anchor.plane,scratchProjected);
if(!projected)return;
const offset=scratchOffset.copy(anchor.point).sub(projected);
state.cameraX=(Number(state.cameraX)||0)+offset.x;
state.cameraY=(Number(state.cameraY)||0)+offset.y;
state.cameraZ=(Number(state.cameraZ)||0)+offset.z;
camera.position.add(offset);camera.updateMatrixWorld();
anchor.key=zoomAnchorKey(anchor.px,anchor.py,anchor.w,anchor.h,state);
anchor.time=performance.now();
}
    function projectBuilding(id,w,h){
const b=townBindings&&townBindings.locate(id)[0];if(!b)return null;
const p=new T.Vector3(b.x,(b.height||8)*.5,b.z).project(camera);
return{x:(p.x+1)*w*.5,y:(1-p.y)*h*.5};
}
    function setTownView(view,bindings){
townView=view;townBindings=bindings;
if(nightShowcase)nightShowcase.setBindings(bindings);
if(!officeWindows)createOfficeWindows();
if(view&&view.byBuilding['c-hospital'])setWindowLight('hospital-ward',view.byBuilding['c-hospital'].lightLevel);
for(const controller of[housing,facilities,ground,...publicScenes.map(item=>item.controller)]){
if(controller&&controller.setTownView)controller.setTownView(view,bindings);
}
prepareSceneMaterials();lastSignature='';lastReflection=-1;
}
    function pickBuilding(px,py,w,h){
if(!townBindings)return null;pickRay.setFromCamera(new T.Vector2(px/w*2-1,1-py/h*2),camera);const k=[buildingRoot,housing&&housing.group,facilities&&facilities.group,district&&district.group,...publicScenes.map(s=>s.controller.group)].filter(Boolean);const l=Object.keys(townBindings.byLedgerId).flatMap(u=>townBindings.locate(u).map(b=>({id:u,...b})));let f=null,e=Infinity;for(const j of pickRay.intersectObjects(k,true)){let o=true;for(let i=j.object;i;i=i.parent)if(!i.visible){o=false;break;}if(!o)continue;const m=j.object.userData;const q=m.buildingIds?.[j.instanceId]||m.buildingId||m.signs?.[Math.floor(j.faceIndex/2)]?.id;const n=townBindings.byMapId[q];if(n){f=n;e=j.distance;break;}const p=j.point;const c=l.filter(b=>p.y>=.15&&p.y<=(b.height||8)+1&&Math.abs(p.x-b.x)<=b.w/2+.7&&Math.abs(p.z-b.z)<=b.d/2+.7);c.sort((a,b)=>(a.w*a.d)-(b.w*b.d));if(c.length){f=c[0].id;e=j.distance;break;}}let r=null,g=Infinity;for(const t of Object.keys(townBindings.byLedgerId))for(const b of townBindings.locate(t)){if(f&&townBindings.byLedgerId[t].kind!=='park')continue;pickBox.min.set(b.x-b.w/2,.2,b.z-b.d/2);pickBox.max.set(b.x+b.w/2,Math.max(3,b.height||8),b.z+b.d/2);if(pickRay.ray.intersectBox(pickBox,pickPoint)){const d=pickPoint.distanceTo(camera.position);if(d<g){g=d;r=t;}}}return g<e?r:f;}
let nightShowcase=null,streetLighting=null;
let publicScenes=[];function setFacadeEnvironment(map){
facadeMaterials.forEach(mat=>{if(mat.envMap!==map){mat.envMap=map;mat.needsUpdate=true;}mat.envMapIntensity=(map?.85:1)*facadeLight;});
}
    function cancelFacadeJob(){if(facadeJob){facadeJob.target.dispose();facadeJob.filter.dispose();facadeJob=null;}}
    function releaseFacadeReflection(){
cancelFacadeJob();
setFacadeEnvironment(null);facadeMaterials=[];
if(facadeReflection)facadeReflection.dispose();facadeReflection=null;facadeReflectionKey='';
}
    function updateFacadeReflection(time,key,allowUpdate=true){
key+='|'+(nightShowcase?nightShowcase.getInfo().searchlights.level:0);facadePending=false;if((!district&&!prototype)||time<city.duration||settings.blenderModel===false){cancelFacadeJob();setFacadeEnvironment(null);return;}if(facadeJob&&facadeJob.key!==key)cancelFacadeJob();if(facadeReflectionKey===key){setFacadeEnvironment(facadeReflection?facadeReflection.texture:null);return;}facadePending=true;if(!allowUpdate)return false;if(!facadeJob){const i=new T.WebGLCubeRenderTarget(256,{type:T.HalfFloatType,generateMipmaps:false});const e=new T.CubeCamera(1,1800,i),l=new T.PMREMGenerator(renderer);e.position.set(prototypeBuilding.x,prototypeBuilding.floors*3+1.4,prototypeBuilding.z);e.coordinateSystem=renderer.coordinateSystem;e.updateCoordinateSystem();e.updateMatrixWorld(true);facadeJob={target:i,probe:e,filter:l,key,face:0,queued:false};}const flashEnabled=fireworkLighting.enabled.value,flashPool=ground.group.getObjectByName('street-light-pools'),flashPoolCount=flashPool.count;const job=facadeJob,h=scene.background,a=scene.backgroundIntensity;const f=ground.water.material,g=ground.water.onBeforeRender;const d=buildings.find(o=>o.b===prototypeBuilding);const c=[prototype?prototype.group.visible:false,actorRoot.visible,d.group.visible];const j=renderer.getRenderTarget(),q=renderer.getActiveCubeFace(),s=renderer.getActiveMipmapLevel(),t=renderer.xr.enabled;let worked=false;try{setFacadeEnvironment(null);fireworkLighting.enabled.value=0;flashPool.count=ground.group.userData.groundDetails.lightPools.length;if(nightShowcase)nightShowcase.setReflectionCapture(true);if(district)district.setExcludedBuilding(prototypeBuilding.id);if(prototype)prototype.group.visible=false;d.group.visible=false;actorRoot.visible=false;syncPlinths(prototypeBuilding.id);for(const k of actorAssemblies)k.sync([k.source]);scene.backgroundIntensity=scene.environmentIntensity;ground.water.material=kit.water;ground.water.onBeforeRender=function(){};renderer.xr.enabled=false;renderer.setRenderTarget(job.target,Math.min(job.face,5));if(!job.queued){renderer.compile(scene,job.probe.children[0]);job.filter.compileCubemapShader();job.queued=true;return;}if(!renderer.info.programs.every(p=>!p.program||!renderer.getContext().isProgram(p.program)||p.isReady()))return;worked=true;if(job.face<6){renderer.shadowMap.needsUpdate=sun.intensity>0&&job.face===0;renderer.render(scene,job.probe.children[job.face++]);}else{job.target.texture.needsPMREMUpdate=true;const r=job.filter.fromCubemap(job.target.texture);if(facadeReflection)facadeReflection.dispose();facadeReflection=r;facadeReflectionKey=key;facadePending=false;cancelFacadeJob();}}catch(m){cancelFacadeJob();facadeReflectionKey=key;facadePending=false;console.warn('Facade reflection unavailable; retaining the previous environment.',m);}finally{fireworkLighting.enabled.value=flashEnabled;flashPool.count=flashPoolCount;renderer.setRenderTarget(j,q,s);renderer.xr.enabled=t;if(nightShowcase)nightShowcase.setReflectionCapture(false);if(district)district.setExcludedBuilding(null);if(prototype)prototype.group.visible=c[0];for(const n of actorAssemblies)n.sync();actorRoot.visible=c[1];d.group.visible=c[2];syncPlinths();scene.background=h;scene.backgroundIntensity=a;ground.water.material=f;ground.water.onBeforeRender=g;setFacadeEnvironment(facadeReflection?facadeReflection.texture:null);renderer.shadowMap.needsUpdate=sun.intensity>0;}return worked;}
    function renderReflectionFrame(time,key,tick,cameraKey,direct){
const waterDue=tick!==lastReflection||cameraKey!==lastWaterCamera||!direct;
const moving=cameraKey!==lastCamera;
// Start a camera move with fresh water, then alternate while motion or clock demand persists.
const waterFirst=!painted||(moving&&!waterCameraMoving);
const allowFacade=!waterDue||(facadeDeferred&&!waterFirst);
const facadeWorked=painted&&updateFacadeReflection(time,key,allowFacade)===true;
facadeDeferred=facadePending&&waterDue&&!facadeWorked;
waterPending=waterDue&&facadeWorked;
let waterRendered=false;
ground.water.onBeforeRender=waterDue&&!facadeWorked?function(...args){waterRendered=renderWaterReflection.call(this,reflect,...args)||waterRendered;}:function(){};
renderer.render(scene,camera);
// A scheduled, culled or failed pass is not a completed water reflection.
if(waterRendered){lastReflection=tick;lastWaterCamera=cameraKey;}
painted=true;lastCamera=cameraKey;waterCameraMoving=moving;
}
    function mesh(geometry,mat,casts=true){const m=new T.InstancedMesh(geometry,mat,1);prepareInstanceColors(m);m.castShadow=casts;m.receiveShadow=true;return m;}
    function cube(parent,x,y,z,w,h,d,mat,casts=true){const m=mat===kit.glass?new T.InstancedMesh(box,mat,1):mesh(box,mat,casts);if(m.isInstancedMesh){prepareInstanceColors(m);m.castShadow=casts;m.receiveShadow=true;}m.position.set(x,y,z);m.scale.set(w,h,d);parent.add(m);return m;}
    function prepareSceneMaterials(){
// Firework injection needs the original light include before the GPU loop expands it.
function prepare(mat){prepareFireworkMaterial(mat);prepareGpuSpotLoop(T,mat);
 if(mat.isMeshBasicMaterial&&mat.map===kit.lightPoolMap)kit.prepareFireworkSprite(mat);}
Object.values(kit).filter(mat=>mat&&mat.isMaterial).forEach(prepare);
scene.traverse(node=>{prepareInstanceColors(node);prepareOpaqueShadow(T,node);if(node.material)for(const mat of [].concat(node.material))prepare(mat);});
}
    function prepareInstanceColors(mesh){
if(!mesh.isInstancedMesh||mesh.instanceColor!==null)return;
mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count*3).fill(1),3);
}
    function inst(parent,count,mat,geometry=box,casts=true){const m=new T.InstancedMesh(geometry,mat,count);prepareInstanceColors(m);m.castShadow=casts;m.receiveShadow=true;m.frustumCulled=false;parent.add(m);return m;}
    // Instance opacity
const fadingMaterials=new Map();
    function fadeMaterial(source){
if(!fadingMaterials.has(source)){
const mat=source.clone();
mat.onBeforeCompile=shader=>{
shader.vertexShader='attribute float actorVisibility; varying float vActorVisibility;\n'+shader.vertexShader;
shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvActorVisibility=actorVisibility;');
shader.fragmentShader='varying float vActorVisibility;\n'+shader.fragmentShader;
shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
            if(vActorVisibility<1.0){
              vec2 cell=mod(floor(gl_FragCoord.xy),4.0),lo=mod(cell,2.0),hi=floor(cell/2.0);
              float a=2.0*lo.x+3.0*lo.y-4.0*lo.x*lo.y,b=2.0*hi.x+3.0*hi.y-4.0*hi.x*hi.y;
              if(vActorVisibility<(4.0*a+b+0.5)/16.0)discard;
            }`);
};
mat.customProgramCacheKey=()=> 'town-actor-visibility-v2';
ownedMaterials.push(mat);fadingMaterials.set(source,mat);
}
return fadingMaterials.get(source);
}
const actorDepth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});ownedMaterials.push(actorDepth);
    function enableActorFade(mesh){
mesh.geometry=mesh.geometry.clone();mesh.userData.ownsActorGeometry=true;
const white=new T.Color('#ffffff');for(let i=0;i<mesh.count;i++)mesh.setColorAt(i,white);
const values=new T.InstancedBufferAttribute(new Float32Array(mesh.count).fill(1),1);values.setUsage(T.DynamicDrawUsage);
mesh.geometry.setAttribute('actorVisibility',values);
mesh.material=fadeMaterial(mesh.material);mesh.customDepthMaterial=fadeMaterial(actorDepth);
}
    function actorFade(mesh,index,count,value){
const attribute=mesh.geometry.getAttribute('actorVisibility');
for(let i=0;i<count;i++)attribute.setX(index+i,value);
attribute.needsUpdate=true;
}
    function put(m,i,x,y,z,w,h,d,angle=0,color){pos.set(x,y,z);scale.set(w,h,d);q.setFromAxisAngle(up,angle);matrix.compose(pos,q,scale);m.setMatrixAt(i,matrix);if(color)m.setColorAt(i,color);}
    function section(b,from,count,footprint,parent) {
const a=b.kind==='glass',q=Math.max(2,Math.round(footprint.w/(a?5.8:7.6))),r=Math.max(2,Math.round(footprint.d/(a?5.8:7.6)));const e=(q+r)*2,c=a?e+4:4;const i=inst(parent,count*e,kit.glass,box,false),f=inst(parent,count*c,a?trim:kit.stone,box,false);let B=0,x=0;const t=new T.Color();for(let j=0;j<count;j++){const y=(from+j)*6+1.4;for(let k=0;k<4;k++){const g=k%2===1,o=k<2?1:-1,v=g?footprint.d:footprint.w,h=g?r:q;const p=(v-(a?0:3.8))/h,m=p-(a?.25:1.1),l=a?5.65:4.45;for(let s=0;s<h;s++){const u=(s-(h-1)/2)*p,z=g?o*(footprint.w/2+.075):u,A=g?u:o*(footprint.d/2+.075);const n=.79+((b.detailSeed+j*47+k*19+s*23)%29)/140;t.setRGB(n,n,n);put(i,B++,z,y+3,A,m,l,.19,g?Math.PI/2:0,t);if(a)put(f,x++,g?z:u-p/2,y+3,g?u-p/2:A,.16,6,.3,g?Math.PI/2:0);}put(f,x++,g?o*(footprint.w/2+.12):0,y+5.94,g?0:o*(footprint.d/2+.12),v+.22,a?.16:.3,a?.35:.8,g?Math.PI/2:0);}}i.instanceMatrix.needsUpdate=true;i.instanceColor.needsUpdate=true;f.instanceMatrix.needsUpdate=true;return{panes:i,frames:f,perFloor:e,framePerFloor:c,from,max:count};}
    function topFoot(b){return b.kind==='glass'&&b.floors>=15?{w:b.w*.8,d:b.d*.86}:{w:b.w,d:b.d};}
    function syncPlinths(excluded){
if(!plinthBatch)return;let count=0;const ids=[];
for(const o of buildings){o.plinth.visible=false;if(o.b.id===excluded)continue;o.plinth.updateWorldMatrix(true,false);plinthBatch.setMatrixAt(count++,o.plinth.matrixWorld);ids.push(o.b.id);}
plinthBatch.count=count;plinthBatch.visible=count>0;plinthBatch.userData.buildingIds=ids;plinthBatch.instanceMatrix.needsUpdate=true;
}
    function createBuilding(b){
const c=new T.Group();c.position.set(b.x,0,b.z);buildingRoot.add(c);const o=b.kind==='glass'&&b.floors>=15?Math.floor(b.floors*.74):b.floors,a=topFoot(b),f=b.kind==='glass'?kit.glass:b.kind==='sand'?kit.sand:kit.stone;const r=cube(c,0,.6,0,b.w+2.5,1.2,b.d+2.5,kit.pavement);const B=cube(c,0,1.4,0,b.w,1,b.d,f),l=o<b.floors?cube(c,0,1.4,0,a.w,1,a.d,f):null;const h=[section(b,0,o,b,c)];if(l)h.push(section(b,o,b.floors-o,a,c));const p=l?cube(c,0,o*6+1.2,0,b.w+1.2,.7,b.d+1.2,kit.stone):null;const e=new T.Group();e.position.y=b.floors*6+1.4;c.add(e);cube(e,0,.35,0,a.w+.5,.7,a.d+.5,kit.stone);cube(e,0,.76,0,a.w-1.5,.12,a.d-1.5,roofMat,false);for(const t of[-1,1]){cube(e,0,1.35,t*(a.d/2-.35),a.w,.95,.7,kit.stone);cube(e,t*(a.w/2-.35),1.35,0,.7,.95,a.d,kit.stone);}if(b.roof==='solar'){for(let i=0;i<3;i++){const x=(i-1)*a.w*.24;cube(e,x,1.1,0,a.w*.2,.5,a.d*.49,kit.metal);const A=cube(e,x,1.48,0,a.w*.21,.15,a.d*.49,kit.solar);A.rotation.x=-.14;}}else if(b.roof==='garden'){cube(e,0,.94,0,a.w*.66,.2,a.d*.62,kit.grass,false);for(let i=0;i<3;i++){cube(e,(i-1)*a.w*.2,1.25,a.d*.16,3,.5,3,kit.stone);const m=mesh(sphere,kit.leaf);m.position.set((i-1)*a.w*.2,2.3,a.d*.16);m.scale.set(1.55,1.3,1.45);e.add(m);}}else if(b.roof!=='plain'){cube(e,-a.w*.18,2.3,-a.d*.16,a.w*.32,3,a.d*.23,kit.stone);for(let i=0;i<2;i++)cube(e,a.w*.22,1.65,(i-.5)*7,4,1.8,4.6,kit.metal);}const n=cube(c,0,1,0,b.w+.3,.28,b.d+.3,kit.stone);const j=[];for(let u=0;u<2;u++){const g=new T.Group();c.add(g);cube(g,0,2.82,0,b.w,5.65,b.d,f);cube(g,0,5.8,0,b.w+.4,.32,b.d+.4,kit.stone);const q=inst(g,4,kit.glass,box,false);for(let k=0;k<4;k++){const s=k%2===1,v=k<2?1:-1;put(q,k,s?v*(b.w/2+.1):0,2.95,s?0:v*(b.d/2+.1),(s?b.d:b.w)-2.7,4.15,.2,s?Math.PI/2:0);}q.instanceMatrix.needsUpdate=true;j.push(g);}return{b,group:c,low:B,upper:l,cut:o,top:a,sections:h,roof:e,activeTop:n,falling:j,terrace:p,plinth:r};}
const patrolMaterial=new T.MeshBasicMaterial({color:'#ffffff',toneMapped:false});ownedMaterials.push(patrolMaterial);
const headLightMat=new T.MeshStandardMaterial({color:'#fff2d4',emissive:'#ffe0a1',emissiveIntensity:0});
const tailLightMat=new T.MeshStandardMaterial({color:'#9b342b',emissive:'#ff2818',emissiveIntensity:0});
const carPoolMat=new T.MeshBasicMaterial({color:'#ffe2b5',map:kit.lightPoolMap,transparent:true,depthWrite:false,
blending:T.AdditiveBlending,opacity:0,toneMapped:false});
ownedMaterials.push(headLightMat,tailLightMat,carPoolMat);
const poolGeo=new T.PlaneGeometry(1,1);poolGeo.rotateX(-Math.PI/2);
let serviceRoutes=null,vehicleSample=null,activeCars=0,vehicleShell=null,carHeadBatch=null,roofBatches=[],actorAssemblies=[];
let residentBatch=null,residentAppearances=[],seatedSlots=new Map();
    function createActors(){
const d=CityLife.sample(life,0),b=new T.Color(),h=new T.Color('#88918a');const c=d.vehicles.length;const g=d.pedestrians.length+d.shoppers.length;const l=d.pets.length,f=d.riders.length;const a={body:inst(actorRoot,c,carPaint),cabin:inst(actorRoot,c,kit.vehicleGlass,box,false),roof:inst(actorRoot,c,carPaint),carPillars:inst(actorRoot,c*6,carPaint),carSeats:inst(actorRoot,c*4,rubber),carHeads:inst(actorRoot,c*4,kit.skin,sphere,false),carPeople:inst(actorRoot,c*4,clothes,box,false),steering:inst(actorRoot,c,rubber,cylinder,false),headlights:inst(actorRoot,c*2,headLightMat,box,false),taillights:inst(actorRoot,c*2,tailLightMat,box,false),carPools:inst(actorRoot,c,carPoolMat,poolGeo,false),wheels:inst(actorRoot,c*4,rubber,cylinder),hull:inst(actorRoot,2,kit.stone),deck:inst(actorRoot,2,kit.metal),torso:inst(actorRoot,g,clothes,cylinder),head:inst(actorRoot,g*3,kit.skin,sphere),legs:inst(actorRoot,g*4,kit.dark,cylinder),arms:inst(actorRoot,g*4,clothes,cylinder),backpack:inst(actorRoot,g*3,kit.dark),petBody:inst(actorRoot,l,clothes,box),petHead:inst(actorRoot,l,kit.skin,sphere),petTail:inst(actorRoot,l,clothes,cylinder),petLegs:inst(actorRoot,l*4,kit.dark,cylinder),riderTorso:inst(actorRoot,f,clothes,cylinder),riderHead:inst(actorRoot,f,kit.skin,sphere),riderLegs:inst(actorRoot,f*2,kit.dark,cylinder),riderArms:inst(actorRoot,f*2,clothes,cylinder),bikeWheel:inst(actorRoot,f*2,rubber,cylinder),bikeFrame:inst(actorRoot,f,kit.metal,box),bikeBody:inst(actorRoot,f*2,material('rider-body','#ffffff',.4),box),balloon:inst(actorRoot,Math.max(1,d.balloons.length),material('balloon','#ffffff',.55),sphere),lightBar:inst(actorRoot,Math.max(1,d.vehicles.filter(v=>v.police).length*2),patrolMaterial,box,false)};a.ball=inst(actorRoot,d.balls.length,material('football','#f4f1df',.82),sphere);for(const s of['torso','head','legs','arms','backpack','petBody','petHead','petTail','petLegs','riderTorso','riderHead','riderLegs','riderArms','bikeWheel','bikeFrame','bikeBody','balloon','ball'])enableActorFade(a[s]);d.vehicles.forEach((v,i)=>{b.set(v.color);a.body.setColorAt(i,b);a.roof.setColorAt(i,b);});d.pedestrians.forEach((p,i)=>{b.set(p.color).lerp(h,.28);a.torso.setColorAt(i,b);for(let j=0;j<4;j++)a.arms.setColorAt(i*4+j,b);});d.shoppers.forEach((p,i)=>{const o=d.pedestrians.length+i;b.set(p.color).lerp(h,.28);a.torso.setColorAt(o,b);for(let j=0;j<4;j++)a.arms.setColorAt(o*4+j,b);});d.pets.forEach((p,i)=>{b.set(p.color);a.petBody.setColorAt(i,b);a.petTail.setColorAt(i,b);});d.vehicles.filter(v=>v.police).forEach((v,i)=>{b.set('#d2473c');a.lightBar.setColorAt(i*2,b);b.set('#3a6fbf');a.lightBar.setColorAt(i*2+1,b);});d.riders.forEach((r,i)=>{b.set(r.color);a.riderTorso.setColorAt(i,b);for(let j=0;j<2;j++){a.riderArms.setColorAt(i*2+j,b);a.riderLegs.setColorAt(i*2+j,b);}a.bikeBody.setColorAt(i*2,b);a.bikeBody.setColorAt(i*2+1,b);});for(const m of Object.values(a))if(m.instanceColor)m.instanceColor.needsUpdate=true;vehicleShell=createInstanceAggregate(T,[a.body,a.roof,a.carPillars],true);actorRoot.add(vehicleShell.mesh);a.vehicleShell=vehicleShell.mesh;carHeadBatch=createInstanceAggregate(T,[a.carHeads],true);carHeadBatch.mesh.name='car-passenger-heads';actorRoot.add(carHeadBatch.mesh);a.carHeadBatch=carHeadBatch.mesh;actorAssemblies=[];for(const e of[a.deck,a.hull]){const q=roofBatches.find(m=>m.geometry===e.geometry&&m.material===e.material&&m.castShadow===e.castShadow&&m.receiveShadow===e.receiveShadow);if(!q)continue;const n=[q,e];if(e===a.deck)n.push(nightShowcase.fixtureMesh);const k=createInstanceAggregate(T,n,true);k.mesh.name=e===a.deck?'metal-surfaces':'stone-surfaces';buildingRoot.add(k.mesh);actorAssemblies.push({...k,source:e});}if(settings.residentModels!==false&&residentAppearances.length&&root.CityResidentCharacterModels?.createTownBatch){
 const all=[...d.pedestrians,...d.shoppers];seatedSlots=new Map();
 for(const p of all)if(p.kind==='ferris')seatedSlots.set(p.id,seatedSlots.size);
 residentBatch=CityResidentCharacterModels.createTownBatch(T,{actors:townAppearanceActors(life,d),residents:residentAppearances});actorRoot.add(residentBatch.object);
 for(const name of Object.keys(PERSON_BATCHES)){a[name].count=seatedSlots.size*PERSON_BATCHES[name];a[name].visible=seatedSlots.size>0;}
}
return a;}
    function batchRoofs(){
roofBatches=[];buildingRoot.updateMatrixWorld(true);
const batches=new Map();
buildings.forEach(o=>{
o.roofParts=[];
o.roof.traverse(part=>{
if(!part.isMesh)return;
const key=part.material.uuid+'|'+part.geometry.uuid+'|'+part.castShadow;
if(!batches.has(key))batches.set(key,{material:part.material,geometry:part.geometry,casts:part.castShadow,parts:[]});
const entry={owner:o,matrix:part.matrixWorld.clone()};batches.get(key).parts.push(entry);
if(part.isInstancedMesh)part.dispose();
});
o.group.remove(o.roof);o.wasComplete=null;
});
batches.forEach(batch=>{
const mesh=inst(buildingRoot,batch.parts.length,batch.material,batch.geometry,batch.casts);roofBatches.push(mesh);
batch.parts.forEach((part,i)=>{part.owner.roofParts.push({mesh,index:i,matrix:part.matrix});mesh.setMatrixAt(i,part.matrix);});
mesh.userData.buildingIds=batch.parts.map(part=>part.owner.b.id);mesh.instanceMatrix.needsUpdate=true;
});
}
    const WINDOW_WINGS=[{
id:'hospital-ward',facility:'hospital',
floors:[3,4,5],
base:1.4,floorHeight:6,rise:3.25,paneHeight:3.15,proud:.26,thickness:.06,
faces:[{axis:'z',columns:7,spacing:5.7,span:4.2},{axis:'x',columns:8,spacing:5.6,span:4.05}]
}];
const windowMaterials=new Map(),windowLevels=new Map();
    function windowMaterial(id){
if(!windowMaterials.has(id)){
const m=new T.MeshStandardMaterial({color:'#4a4239',roughness:.52,metalness:0,emissive:'#ffd7a0',emissiveIntensity:windowLevel(id)*1.15});
m.name='city-window-'+id;ownedMaterials.push(m);windowMaterials.set(id,m);
}
return windowMaterials.get(id);
}
    function windowLevel(id){const level=windowLevels.get(id);return level===undefined?1:level;}
    function createOfficeWindows(){
if(!townBindings)return;
officePanes=[];officeLightKey='';
for(const id of['t-one','t-two','t-three','t-four']){
const b=townBindings.byLedgerId[id]?.items[0]?.ref;if(!b)continue;
const panes=[];
for(let floor=id==='t-two'?3:0;floor<b.floors;floor++)for(const axis of['x','z'])for(const side of[-1,1]){
const span=axis==='x'?b.d:b.w,columns=Math.max(2,Math.floor(span/7));
const upper=b.floors>=15&&floor>=Math.floor(b.floors*.74),w=b.w*(upper?.8:1),d=b.d*(upper?.86:1);
for(let col=0;col<columns;col++){
const u=(col-(columns-1)/2)*span/columns*.8,y=floor*6+3.3;
panes.push(axis==='x'?[b.x+side*(w/2+.23),y,b.z+u,.06,2.7,2.8]:[b.x+u,y,b.z+side*(d/2+.23),2.8,2.7,.06]);
}
}
officePanes.push({id,building:b,panes,litWindows:0});
}
const count=officePanes.reduce((n,e)=>n+e.panes.length,0);if(!count)return;
const mat=material('office-live-window','#9d8c72',.7);mat.emissive=new T.Color('#ffd6a0');mat.emissiveIntensity=1.1;
officeWindows=inst(buildingRoot,count,mat,box,false);officeWindows.castShadow=false;officeWindows.receiveShadow=false;
for(let i=0;i<count;i++)officeWindows.setMatrixAt(i,hiddenMatrix);
}
    function updateOfficeWindows(time){
if(!officeWindows||!townView)return;
const key=officePanes.map(e=>e.id+':'+townView.byBuilding[e.id].lightLevel+':'+CityModel.sampleBuilding(e.building,time).complete).join('|');
if(key===officeLightKey)return;officeLightKey=key;let index=0,total=0;
for(const e of officePanes){
const level=townView.byBuilding[e.id].lightLevel;
e.litWindows=CityModel.sampleBuilding(e.building,time).complete?Math.ceil(level*e.panes.length):0;
e.panes.forEach((p,i)=>{if((i*73%e.panes.length)<e.litWindows)put(officeWindows,index,p[0],p[1],p[2],p[3],p[4],p[5]);else officeWindows.setMatrixAt(index,hiddenMatrix);index++;});total+=e.litWindows;
}
officeWindows.visible=total>0;officeWindows.instanceMatrix.needsUpdate=true;
}
    function createWindowLights(){
officeWindows=null;officePanes=[];officeLightKey='';
windowLights=[];
for(const wing of WINDOW_WINGS){
const b=(city.buildings||[]).find(item=>item.facility===wing.facility);
if(!b)continue;
const panes=[],paneSlots=[];
for(const floor of wing.floors){
if(floor>=b.floors)continue;
const y=wing.base+floor*wing.floorHeight+wing.rise;
for(const face of wing.faces){
const offset=(face.axis==='z'?b.d:b.w)/2+wing.proud;
for(const side of[-1,1])for(let i=0;i<face.columns;i++){
const u=(i-(face.columns-1)/2)*face.spacing;
panes.push(face.axis==='z'
?[b.x+u,y,b.z+side*offset,face.span,wing.paneHeight,wing.thickness]
:[b.x+side*offset,y,b.z+u,wing.thickness,wing.paneHeight,face.span]);
paneSlots.push({floor,axis:face.axis,side,column:i});
}
}
}
if(!panes.length)continue;
const mesh=inst(buildingRoot,panes.length,windowMaterial(wing.id),box,false);
mesh.castShadow=false;mesh.receiveShadow=false;
panes.forEach((p,i)=>put(mesh,i,p[0],p[1],p[2],p[3],p[4],p[5]));
mesh.instanceMatrix.needsUpdate=true;mesh.visible=false;
windowLights.push({wing,mesh,panes,paneSlots,interiorSlots:[],building:b,built:false,drawn:false,litWindows:0});
}
}
let windowRevision=0,interiorLightingMode='town';
    function applyWindowLight(entry){
const visible=windowLevel(entry.wing.id)>0&&entry.built;
const lit=visible?Math.ceil(entry.panes.length*windowLevel(entry.wing.id)):0;
const level=windowLevel(entry.wing.id);
if(lit!==entry.litWindows||level!==entry.lastLevel){
const roomLevels=[0,0,0];
entry.panes.forEach((p,i)=>{
const selected=(i*17%entry.panes.length)<lit,interior=entry.interiorSlots[i];
if(interior){if(selected)roomLevels[interior.bay]=level;entry.mesh.setMatrixAt(i,hiddenMatrix);}
else if(selected)put(entry.mesh,i,...p);else entry.mesh.setMatrixAt(i,hiddenMatrix);
});
if(interiorLightingMode==='legacy'&&entry.interiorSlots.some(Boolean)&&facilities?.setInteriorLights)facilities.setInteriorLights(roomLevels);
entry.mesh.instanceMatrix.needsUpdate=true;entry.litWindows=lit;entry.lastLevel=level;
}
if(visible===entry.drawn)return;
entry.mesh.visible=visible;entry.drawn=visible;
}
    function setWindowLight(id,level){
const value=Number(level);
if(!Number.isFinite(value))return false;
const next=Math.max(0,Math.min(1,value));
if(windowLevel(id)===next)return false;
windowLevels.set(id,next);
const material=windowMaterials.get(id);
if(material)material.emissiveIntensity=next*1.15;
const entry=windowLights.find(item=>item.wing.id===id);
if(entry)applyWindowLight(entry);
windowRevision++;
return true;
}
    function updateWindowLights(time){
// shows windows on floors that are still falling.
for(const entry of windowLights){
entry.built=CityModel.sampleBuilding(entry.building,time).complete;
applyWindowLight(entry);
}
}
const paneTint=new T.Color();
const paneMaterial=new T.MeshBasicMaterial({color:'#ffffff',toneMapped:false});ownedMaterials.push(paneMaterial);
let townPanes=null,townAccentBatch=null,paneAnchors=[],lightingInfo={litPanes:0,byBuilding:{}},lastLightingKey='';
    function makeTownLights(){
paneAnchors=[];
for(const controller of[facilities,district,housing])if(controller&&controller.getLightAnchors){
for(const a of controller.getLightAnchors())if((controller!==housing||a.layer==='entry')&&(controller!==facilities||a.layer==='entry'||a.ledgerId==='c-hospital'))paneAnchors.push({...a,refined:controller===district});
}
const roomAnchors=paneAnchors.filter(a=>a.interior);
for(const entry of windowLights){
entry.interiorSlots=entry.paneSlots.map(slot=>{
const anchor=roomAnchors.find(a=>a.building===entry.building&&a.floor===slot.floor&&
slot.axis==='z'&&slot.side===-1&&Math.abs(a.local[0]-(slot.column-3)*5.7)<.0001);
return anchor&&anchor.interior||null;
});
entry.lastLevel=null;
}
buildings.forEach(o=>{
if(!o.b.ledgerId)return;
o.sections.forEach(section=>{
for(let i=0;i<section.max*section.perFloor;i++){
section.panes.getMatrixAt(i,matrix);matrix.decompose(pos,q,scale);
const floor=section.from+Math.floor(i/section.perFloor);
paneAnchors.push({building:o.b,ledgerId:o.b.ledgerId,floor,fallback:true,
local:[pos.x,pos.y-floor*6-1.4,pos.z,(Math.abs(q.y)>.5?scale.z:scale.x)+.025,scale.y,(Math.abs(q.y)>.5?scale.x:scale.z)+.025]});
}
});
});
if(frontage&&frontage.getLightAnchors)paneAnchors.push(...frontage.getLightAnchors());
paneAnchors.sort((a,b)=>String(a.ledgerId).localeCompare(String(b.ledgerId))||
((a.floor*7+3)%Math.max(1,a.building.floors))-((b.floor*7+3)%Math.max(1,b.building.floors))||a.floor-b.floor);
townPanes=inst(buildingRoot,Math.max(1,paneAnchors.length),paneMaterial,box,false);
townPanes.name='town-occupied-windows';townPanes.receiveShadow=false;townPanes.count=0;townPanes.userData.buildingIds=[];
if(nightShowcase){townAccentBatch=createInstanceAggregate(T,[townPanes,nightShowcase.accentMesh]);townAccentBatch.mesh.name='town-lit-surfaces';buildingRoot.add(townAccentBatch.mesh);}
lastLightingKey='';
}
    function updateTownLights(time,lighting){
if(!lighting||!townPanes)return;
const refined=!!district&&settings.blenderModel!==false;
const key=[Math.floor(lighting.minute),lighting.day,time<city.duration?time:'built',refined].join('/');
if(key===lastLightingKey)return;lastLightingKey=key;
const available={},drawn={},samples=new Map(),roomLevels=[0,0,0];
let interiorLit=0;
const anchors=paneAnchors.filter(a=>a.ledgerId&&!(a.refined&&!refined)&&!(a.fallback&&refined));
for(const a of anchors)if(!a.layer)available[a.ledgerId]=(available[a.ledgerId]||0)+1;
let count=0;
for(const a of anchors){
const policy=lighting.buildings[a.ledgerId];if(!policy)continue;
const b=a.host||a.building;
if(!samples.has(b))samples.set(b,CityModel.sampleBuilding(b,time));
if(a.floor>=samples.get(b).builtFloors)continue;
let level=policy.room;
if(a.layer==='entry')level=policy.entry;
else if(policy.kind==='tower'){
// add the crown channel at a fixed sparse density.
const crown=policy.decoration>0&&a.floor>=samples.get(b).builtFloors-2;
let density=policy.room;
if(crown){density=Math.max(density,.34);level=Math.max(level,policy.decoration);}
if(paneU(a.ledgerId,a.floor,a.local)<density)drawn[a.ledgerId]=(drawn[a.ledgerId]||0)+1;
else level=0;
}
else{
const limit=Math.min(policy.maxPanes,Math.ceil((available[a.ledgerId]||0)*policy.room));
if((drawn[a.ledgerId]||0)>=limit||!level)continue;
drawn[a.ledgerId]=(drawn[a.ledgerId]||0)+1;
}
if(!level)continue;
if(a.interior){roomLevels[a.interior.bay]=level;interiorLit++;continue;}
const p=a.local,owner=a.building;
put(townPanes,count,owner.x+p[0],1.4+a.floor*6+p[1],owner.z+p[2],p[3],p[4],p[5]);
paneTint.set(a.floor%3===0?'#ffe6b2':'#ffd096').multiplyScalar(a.layer?level:.65+.35*lighting.windows);
townPanes.userData.buildingIds[count]=owner.id;townPanes.setColorAt(count++,paneTint);
}
if(facilities?.setInteriorLights)facilities.setInteriorLights(roomLevels);
townPanes.count=count;townPanes.visible=count>0;townPanes.instanceMatrix.needsUpdate=true;
if(townPanes.instanceColor)townPanes.instanceColor.needsUpdate=true;
let localCount=0,localBatches=0;
for(const controller of[housing,facilities])if(controller){
let used=false;
for(const entry of controller.getInfo().lights||[]){drawn[entry.id]=(drawn[entry.id]||0)+entry.litWindows;localCount+=entry.litWindows;used=used||entry.litWindows>0;}
if(used)localBatches++;
}
officePanes.forEach(e=>{e.litWindows=drawn[e.id]||0;});
lightingInfo={litPanes:count+localCount+interiorLit,byBuilding:drawn,batches:(count?1:0)+localBatches+(interiorLit?1:0)};
}
    function limb(m,i,a,b,r){pos.copy(a).add(b).multiplyScalar(.5);direction.copy(b).sub(a);scale.set(r,direction.length(),r);q.setFromUnitVectors(up,direction.normalize());matrix.compose(pos,q,scale);m.setMatrixAt(i,matrix);}
const personScratch={legs:new Array(18),arms:new Array(18)};
let personVisibility=[];
const limbA=new T.Vector3(),limbB=new T.Vector3(),wheelQ=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2);
const hiddenMatrix=new T.Matrix4().makeScale(0,0,0);
    function paneU(id,floor,local){
let h=2166136261;const s=id+'/'+floor;
for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
h^=Math.round(local[0]*8)*374761393;h=Math.imul(h,1274126177);
h^=Math.round(local[2]*8)*2246822519;h=Math.imul(h,3266489917);
return(h>>>0)%1000/1000;
}
    function resizePerson(mesh,index,p,size){
mesh.getMatrixAt(index,matrix);
const e=matrix.elements;
for(let column=0;column<3;column++)for(let row=0;row<3;row++)e[column*4+row]*=size;
e[12]=p.x+(e[12]-p.x)*size;e[13]=p.y+(e[13]-p.y)*size;e[14]=p.z+(e[14]-p.z)*size;
mesh.setMatrixAt(index,matrix);
}
    function updateActors(time,lighting,daySeconds){
if(!actorsData)actorsData=CityLife.createSample(life);const o=CityLife.sampleInto(life,time,actorsData,townView&&townView.demand);const ak=Number.isFinite(daySeconds);headLightMat.emissiveIntensity=lighting?lighting.lamps*3.2:0;tailLightMat.emissiveIntensity=lighting?lighting.lamps*2.2:0;carPoolMat.opacity=lighting?lighting.lamps*.42:0;actors.carPools.visible=!!lighting&&lighting.lamps>0;activeCars=0;let A=0;o.vehicles.forEach((v,i)=>{v.fade=ak?CityLighting.streetVisibility(life.vehicles[i],serviceRoutes[life.vehicles[i].route],daySeconds):1;v.active=v.fade>0;if(v.active)activeCars++;const B=-v.heading,t=v.kind==='shuttle'?9:v.kind==='van'?8.7:v.kind==='compact'?7.2:8,al=v.kind==='van',e=v.kind==='shuttle',c=Math.cos(v.heading),s=Math.sin(v.heading);put(actors.body,i,v.x,v.y+1.17,v.z,t,1.3,3.35,B);put(actors.cabin,i,v.x-.35*c,v.y+(e?2.49:2.29),v.z-.35*s,e?7.7:al?5.6:4,e?1.5:1.1,2.83,B);put(actors.roof,i,v.x-.35*c,v.y+(e?3.29:2.89),v.z-.35*s,e?8:al?5.2:3.5,.16,2.99,B);const E=(m,ar,x,y,z,w,h,d)=>put(m,ar,v.x+x*c-z*s,v.y+y,v.z+x*s+z*c,w,h,d,B);const aE=e?3.29:2.89,O=e?3.15:2.78,F=1.82;for(let k=0;k<6;k++)E(actors.carPillars,i*6+k,-.35+(Math.floor(k/2)-1)*(e?3.75:al?2.65:1.9),(O+F)/2,k%2?1.43:-1.43,.12,O-F,.12);const W=e?4:i%3===0?2:1;for(let k=0;k<4;k++){const x=e?2.5-Math.floor(k/2)*2.6:(k<2?.65:-1.05),z=k%2?.7:-.7;E(actors.carSeats,i*4+k,x-.18,1.88,z,.68,.5,.7);if(k<W){E(actors.carPeople,i*4+k,x,e?2.33:2.12,z,.4,e?.55:.35,.43);E(actors.carHeads,i*4+k,x+.06,e?2.86:2.52,z,.22,.25,.22);}else{actors.carPeople.setMatrixAt(i*4+k,hiddenMatrix);actors.carHeads.setMatrixAt(i*4+k,hiddenMatrix);}}E(actors.steering,i,e?3.15:1.25,2.06,-.7,.28,.07,.28);for(let P=0;P<2;P++){E(actors.headlights,i*2+P,t/2+.015,1.45,P?1.08:-1.08,.08,.3,.56);E(actors.taillights,i*2+P,-t/2-.015,1.5,P?1.08:-1.08,.08,.24,.45);}const px=v.x+(t/2+2.6)*c,pz=v.z+(t/2+2.6)*s;const aa=CityLighting.roadHeight(city,px,pz),am=(CityLighting.roadHeight(city,px+c,pz+s)-CityLighting.roadHeight(city,px-c,pz-s))/2;pos.set(px,aa+.045,pz);q.setFromAxisAngle(up,B).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),Math.atan(am)));scale.set(5.8,1,3.6);matrix.compose(pos,q,scale);actors.carPools.setMatrixAt(i,matrix);if(v.police){const as=v.y+3.32;put(actors.lightBar,A++,v.x-.35*c+1.1*c,as,v.z-.35*s+1.1*s,.7,.2,.34,B);put(actors.lightBar,A++,v.x-.35*c-1.1*c,as,v.z-.35*s-1.1*s,.7,.2,.34,B);}let k=i*4;for(const ai of[-1,1])for(const aj of[-1,1]){pos.set(v.x+aj*t*.29*c-ai*1.65*s,v.y+.7,v.z+aj*t*.29*s+ai*1.65*c);q.setFromAxisAngle(up,B).multiply(wheelQ);scale.set(.66,.45,.66);matrix.compose(pos,q,scale);actors.wheels.setMatrixAt(k++,matrix);}});const l=a=>a.active===false||!CityModel.onBoard(city,a.x,a.z);const g=(at,an,ao)=>{for(let i=0;i<ao;i++)at.setMatrixAt(an+i,hiddenMatrix);};const Q=R=>{g(actors.torso,R,1);g(actors.head,R*3,3);g(actors.legs,R*4,4);g(actors.arms,R*4,4);g(actors.backpack,R*3,3);};if(residentBatch)residentBatch.update([...o.pedestrians,...o.shoppers].map(p=>l(p)?{...p,active:false}:p));const H=(u,p)=>{if(residentBatch){if(p.kind!=='ferris')return;u=seatedSlots.get(p.id);if(u===undefined)return;}if(l(p)){if(personVisibility[u]!==false)Q(u);personVisibility[u]=false;return;}personVisibility[u]=true;const S=p.visibility??1;for(const[au,ab]of[['torso',1],['head',3],['legs',4],['arms',4],['backpack',3]])actorFade(actors[au],u*ab,ab,S);const pose=personPose(p,personScratch),c=Math.cos(p.heading),s=Math.sin(p.heading),J=p.size||1;const X=(v,a,b,h)=>v.set(p.x+(a*c-b*s)*J,p.y+h*J,p.z+(a*s+b*c)*J);const U=(av,ap,a,b,h,w,d,aq)=>{X(pos,a,b,h);put(av,ap,pos.x,pos.y,pos.z,w*J,d*J,aq*J,-p.heading);};U(actors.torso,u,pose.lean*.5,0,2.37+pose.bob,.30,1.34,.46);U(actors.head,u*3,pose.lean,0,pose.headY,.38,.41,.36);for(let K=0;K<2;K++){for(const[aw,C,ah]of[[actors.legs,pose.legs,.145],[actors.arms,pose.arms,.13]]){const ax=K*9;for(let j=0;j<2;j++){const k=ax+j*3;X(limbA,C[k],C[k+1],C[k+2]);X(limbB,C[k+3],C[k+4],C[k+5]);limb(aw,u*4+K*2+j,limbA,limbB,ah*J);}}const k=K*9;U(actors.head,u*3+K+1,pose.arms[k+6],pose.arms[k+7],pose.arms[k+8],.14,.17,.14);U(actors.backpack,u*3+K,pose.legs[k+6]+.10,pose.legs[k+7],pose.legs[k+8]-.035,.44,.20,.30);}if(pose.pack)U(actors.backpack,u*3+2,-.36,0,2.48+pose.bob,.34,.82,.65);else actors.backpack.setMatrixAt(u*3+2,hiddenMatrix);};o.pedestrians.forEach((p,i)=>H(i,p));o.shoppers.forEach((p,i)=>H(o.pedestrians.length+i,p));o.pets.forEach((p,i)=>{for(const[ay,ac]of[['petBody',1],['petHead',1],['petTail',1],['petLegs',4]])actorFade(actors[ay],i*ac,ac,p.visibility??1);const c=Math.cos(p.heading),s=Math.sin(p.heading),f=p.size||1,aF=Math.sin(p.phase);const L=p.y+f*(p.kind==='dog'?.95:.72);put(actors.petBody,i,p.x,L,p.z,f*(p.kind==='dog'?1.7:1.35),f*.62,f*.62,p.heading);put(actors.petHead,i,p.x+c*f*.95,L+f*.42,p.z+s*f*.95,f*.5,f*.5,f*.46,p.heading);limbA.set(p.x-c*f*.8,L-f*.1,p.z-s*f*.8);limbB.set(p.x-c*f*1.35+Math.sin(p.phase*.5)*f*.3,L+f*.55,p.z-s*f*1.35);limb(actors.petTail,i,limbA,limbB,f*.09);for(const Y of[-1,1])for(const Z of[-1,1]){const id=i*4+(Y>0?2:0)+(Z>0?1:0);const ad=Y*Math.sin(p.phase+(Z>0?Math.PI:0))*f*.28;limbA.set(p.x+Z*f*.5*c-Y*f*.24*s,L-f*.28,p.z+Z*f*.5*s+Y*f*.24*c);limbB.set(limbA.x+ad*c,Math.max(p.y,p.y+f*.06),limbA.z+ad*s);limb(actors.petLegs,id,limbA,limbB,f*.1);}});// sitting forward with both hands on the bars.
o.riders.forEach((r,i)=>{const V=r.visibility??1;for(const[az,ae]of[['bikeWheel',2],['bikeFrame',1],['bikeBody',2],['riderTorso',1],['riderHead',1],['riderLegs',2],['riderArms',2]])actorFade(actors[az],i*ae,ae,V);const c=Math.cos(r.heading),s=Math.sin(r.heading),M=r.kind!=='bicycle';const D=M?4.6:3.9,I=M?.5:.46;for(const af of[-1,1]){pos.set(r.x+af*D*.32*c,r.y+I,r.z+af*D*.32*s);q.setFromAxisAngle(up,-r.heading).multiply(wheelQ);scale.set(I*2,.16,I*2);matrix.compose(pos,q,scale);actors.bikeWheel.setMatrixAt(i*2+(af>0?1:0),matrix);}put(actors.bikeFrame,i,r.x,r.y+I*.95,r.z,D*.86,.14,.24,-r.heading);if(M){put(actors.bikeBody,i*2,r.x,r.y+.62,r.z,D*.72,.5,.5,-r.heading);put(actors.bikeBody,i*2+1,r.x+c*D*.34,r.y+.86,r.z+s*D*.34,.9,.28,.42,-r.heading);}limbA.set(r.x-c*.3,r.y+1.5,r.z-s*.3);limbB.set(r.x+c*.1,r.y+2.45,r.z+s*.1);limb(actors.riderTorso,i,limbA,limbB,.4);put(actors.riderHead,i,r.x+c*.22,r.y+2.92,r.z+s*.22,.46,.5,.45);for(const G of[-1,1]){const id=i*2+(G>0?1:0);limbA.set(r.x-G*.26*s,r.y+1.42,r.z+G*.26*c);limbB.set(r.x+c*.75-G*.3*s,r.y+.86,r.z+s*.75+G*.3*c);limb(actors.riderLegs,id,limbA,limbB,.17);limbA.set(r.x+c*.16-G*.3*s,r.y+2.34,r.z+s*.16+G*.3*c);limbB.set(r.x+c*.86-G*.34*s,r.y+2.06,r.z+s*.86+G*.34*c);limb(actors.riderArms,id,limbA,limbB,.14);}});o.balloons.forEach((b,i)=>{actorFade(actors.balloon,i,1,b.visibility??1);put(actors.balloon,i,b.x,b.y,b.z,b.radius,b.radius*1.15,b.radius);});o.balls.forEach((b,i)=>{actorFade(actors.ball,i,1,b.visibility??1);put(actors.ball,i,b.x,b.y,b.z,b.radius,b.radius,b.radius);});if(window.__auditHidden){window.__auditHidden=[];}o.vehicles.forEach((v,i)=>{if(!l(v)&&v.active)return;for(const[aA,n]of[['carPillars',6],['carSeats',4],['carHeads',4],['carPeople',4],['steering',1],['headlights',2],['taillights',2],['carPools',1]])g(actors[aA],i*n,n);g(actors.body,i,1);g(actors.cabin,i,1);g(actors.roof,i,1);g(actors.wheels,i*4,4);});o.vehicles.forEach((v,i)=>{const N=v.fade;if(!(N>0&&N<1))return;const p={x:v.x,y:v.y,z:v.z};resizePerson(actors.body,i,p,N);resizePerson(actors.cabin,i,p,N);resizePerson(actors.roof,i,p,N);for(const[aB,n]of[['carPillars',6],['carSeats',4],['carHeads',4],['carPeople',4],['steering',1],['headlights',2],['taillights',2],['carPools',1]])for(let k=0;k<n;k++)resizePerson(actors[aB],i*n+k,p,N);for(let k=0;k<4;k++)resizePerson(actors.wheels,i*4+k,p,N);});let ag=0;o.vehicles.forEach(v=>{if(!v.police)return;if(l(v)||!v.active)g(actors.lightBar,ag,2);ag+=2;});o.pets.forEach((p,i)=>{if(!l(p))return;g(actors.petBody,i,1);g(actors.petHead,i,1);g(actors.petTail,i,1);g(actors.petLegs,i*4,4);});o.riders.forEach((r,i)=>{if(!l(r))return;g(actors.bikeWheel,i*2,2);g(actors.bikeFrame,i,1);g(actors.bikeBody,i*2,2);g(actors.riderTorso,i,1);g(actors.riderHead,i,1);g(actors.riderLegs,i*2,2);g(actors.riderArms,i*2,2);});o.balloons.forEach((b,i)=>{if(l(b))g(actors.balloon,i,1);});o.balls.forEach((b,i)=>{if(l(b))g(actors.ball,i,1);});for(let i=0;i<2;i++){const z=((time*(i?-1.3:1.6)+i*135+180)%280+280)%280-140,x=i?-5:5,y=-.44+Math.sin(time*.8+i)*.08;put(actors.hull,i,x,y,z,4.7,.75,10.5);put(actors.deck,i,x,y+.6,z,3.1,.5,4.5);}if(vehicleShell)vehicleShell.sync();if(carHeadBatch)carHeadBatch.sync();for(const m of Object.values(actors))m.instanceMatrix.needsUpdate=true;}
    function updateBuildings(time){
if(officeArchitecture)officeArchitecture.update(time);const e=Boolean(district&&settings.blenderModel!==false);if(district){district.setEnabled(e);district.update(time);}buildings.forEach(o=>{const s=CityModel.sampleBuilding(o.b,time),p=Math.min(s.builtFloors,o.cut),j=Math.max(0,s.builtFloors-o.cut);const c=e||Boolean(prototype&&o.b===prototypeBuilding&&settings.blenderModel!==false);if(prototype&&o.b===prototypeBuilding){prototype.setEnabled(c);prototype.update(s);}o.low.visible=p>0&&!c;o.low.scale.y=Math.max(.01,p*6);o.low.position.y=1.4+p*3;if(o.upper){o.upper.visible=j>0&&!c;o.upper.scale.y=Math.max(.01,j*6);o.upper.position.y=1.4+o.cut*6+j*3;o.terrace.visible=s.builtFloors>=o.cut;}o.sections.forEach(a=>{const n=Math.max(0,Math.min(a.max,s.builtFloors-a.from));a.panes.count=n*a.perFloor;a.frames.count=n*a.framePerFloor;a.panes.visible=a.frames.visible=!c;});const h=s.complete&&!c;if(o.wasComplete!==h){const l=new T.Matrix4().makeScale(0,0,0);o.roofParts.forEach(k=>{k.mesh.setMatrixAt(k.index,h?k.matrix:l);k.mesh.instanceMatrix.needsUpdate=true;});o.wasComplete=h;}o.activeTop.visible=!c&&!s.complete&&s.builtFloors>0;o.activeTop.position.y=s.height+1.5;const f=s.builtFloors>o.cut?o.top:o.b;o.activeTop.scale.set(f.w+.3,.28,f.d+.3);o.falling.forEach((g,i)=>{const m=s.falling[i];g.visible=Boolean(m)&&!c;if(!m)return;const f=m.floor>=o.cut?o.top:o.b;g.position.y=m.y+1.4;g.rotation.y=-m.rotation;g.scale.set(f.w/o.b.w,1,f.d/o.b.d);});});}
    function releaseGroup(group){if(!group)return;group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownsActorGeometry)o.geometry.dispose();});scene.remove(group);}
    function rebuild(nextCity,nextLife,residents=[]){
if(residentBatch){residentBatch.dispose();residentBatch=null;}residentAppearances=residents;seatedSlots.clear();
initialProgramsPrepared=false;programsQueued=false;painted=false;facadePending=true;
waterPending=false;facadeDeferred=false;waterCameraMoving=false;lastWaterCamera='';
clearZoomAnchor();
if(solarShow){solarShow.dispose();solarShow=null;}
if(streetLighting){streetLighting.dispose();streetLighting=null;}
if(nightShowcase){nightShowcase.dispose();nightShowcase=null;}
if(visibleSky.pattern.seed!==nextCity.seed){scene.remove(visibleSky.mesh);visibleSky.dispose();visibleSky=CityMaterials.createSky(T,nextCity.seed,skyLoaded);scene.add(visibleSky.mesh);}
releaseFacadeReflection();
publicScenes.forEach(item=>item.controller.dispose());publicScenes=[];
if(facilities){facilities.dispose();facilities=null;}
if(housing){housing.dispose();housing=null;}
if(frontage){frontage.dispose();frontage=null;}
if(helipad){helipad.dispose();helipad=null;}
if(airship){airship.dispose();airship=null;}
if(district){district.dispose();district=null;}
if(officeArchitecture){officeArchitecture.dispose();officeArchitecture=null;}
if(prototype){scene.remove(prototype.group);prototype.dispose();prototype=null;}prototypeBuilding=null;
if(ground){scene.remove(ground.group);ground.dispose();}releaseGroup(buildingRoot);releaseGroup(actorRoot);
city=nextCity;life=nextLife;ground=CityGround.create(T,kit,city);scene.add(ground.group);if(root.CityAirship){airship=CityAirship.create(T,kit,city);scene.add(airship.group);}nightShowcase=createNightShowcase(T,city,{scene,kit,box,ground,accentMaterial:paneMaterial,castFixtures:true,beamEmitters:airship?.beamEmitters||[]});scene.add(nightShowcase.group);fireworkTowerPlan=root.CityFireworks?root.CityFireworks.towerLaunchPlan(city):[];streetLighting=createStreetLighting(T,ground);scene.add(streetLighting.group);
reflect=ground.water.onBeforeRender;lastSignature='';lastShadow=-1;lastReflection=-1;lastCamera='';actorsData=null;personVisibility=[];vehicleSample=null;serviceRoutes=CityLighting.streetSchedule(life,city);
bounds=[];
for(const x of[-city.extentX,city.extentX])for(const z of[-city.extentZ,city.extentZ])bounds.push(new T.Vector3(x,-5.2,z));
for(const b of city.buildings)for(const x of[b.x-b.w/2,b.x+b.w/2])for(const z of[b.z-b.d/2,b.z+b.d/2])bounds.push(new T.Vector3(x,b.floors*6+22,z));
for(const site of city.places||[])for(const x of[site.x-site.w/2,site.x+site.w/2])for(const z of[site.z-site.d/2,site.z+site.d/2])bounds.push(new T.Vector3(x,site.height,z));
// Stable full-flight bounds preserve the airship framing across its route.
if(root.CityAirship){const route=CityAirship.plan(city);for(const x of[-route.rx-40,route.rx+40])for(const z of[-route.rz-40,route.rz+40])for(const y of[route.altitude-25,route.altitude+25])bounds.push(new T.Vector3(x,y,z));}
buildingRoot=new T.Group();actorRoot=new T.Group();scene.add(buildingRoot,actorRoot);
buildings=city.buildings.filter(b=>!b.facility&&!b.housing).map(createBuilding);plinthBatch=inst(buildingRoot,Math.max(1,buildings.length),kit.pavement);plinthBatch.name='office-plinths';syncPlinths();batchRoofs();createWindowLights();actors=createActors();
if(root.CityDistrict&&CityDistrict.createOfficeArchitecture){officeArchitecture=CityDistrict.createOfficeArchitecture(T,city);buildingRoot.add(officeArchitecture.group);}
if(root.CityFacilities){facilities=CityFacilities.create(T,kit,city);scene.add(facilities.group);}
if(root.CityHousing){housing=CityHousing.create(T,kit,city,settings);scene.add(housing.group);}
// reserved bands and the drawn ring can never disagree.
if(root.CityFrontage){frontage=CityFrontage.create(T,kit,city,city.frontage);scene.add(frontage.group);}
for(const[name,api]of[['waterfront',root.CityWaterfront],['transit',root.CityTransit],['landmarks',root.CityLandmarks]]){
if(api){const controller=api.create(T,kit,city);scene.add(controller.group);publicScenes.push({name,controller});}
}
if(root.CityDistrict&&CityDistrict.getStatus().ready){
prototypeBuilding=city.buildings.filter(b=>b.kind==='glass').sort((a,b)=>b.z-a.z||a.x-b.x)[0]||city.buildings[0]||null;
if(prototypeBuilding){district=CityDistrict.create(T,city,settings);scene.add(district.group);facadeMaterials=district.getGlassMaterials();}
}else if(root.CityBlender&&CityBlender.getStatus().ready){
prototypeBuilding=city.buildings.filter(b=>b.kind==='glass').sort((a,b)=>b.z-a.z||a.x-b.x)[0]||null;
if(prototypeBuilding){
prototype=CityBlender.createBuilding(T,prototypeBuilding);scene.add(prototype.group);CityBlender.updateColors(settings);
const glass=new Set();prototype.group.traverse(o=>{if(o.isMesh&&/^City_Glass/.test(o.material.name))glass.add(o.material);});facadeMaterials=Array.from(glass);
}
}
if(housing&&housing.getGlassMaterials)facadeMaterials.push(...housing.getGlassMaterials());
if(root.CityHelipad){helipad=CityHelipad.create(T,kit,city,settings);scene.add(helipad.group);}
solarBounds=bounds.slice();
if(settings.solarShow&&root.SolarDroneShow){
solarShow=SolarDroneShow.create(T,{pattern:settings.dronePattern,x:city.water.x,z:city.water.z,roof:Math.max(...bounds.map(p=>p.y))});scene.add(solarShow.group);
const box=solarShow.getInfo().bounds;
for(const x of[box.min[0],box.max[0]])for(const y of[box.min[1],box.max[1]])for(const z of[box.min[2],box.max[2]])solarBounds.push(new T.Vector3(x,y,z));
}

makeTownLights();
prepareSceneMaterials();
}
function setDronePattern(id){
if(!solarShow)return;solarShow.setPattern(id);solarBounds=bounds.slice();
const box=solarShow.getInfo().bounds;
for(const x of[box.min[0],box.max[0]])for(const y of[box.min[1],box.max[1]])for(const z of[box.min[2],box.max[2]])solarBounds.push(new T.Vector3(x,y,z));
lastSignature='';clearZoomAnchor();
}
    function render(context,w,h,state,settings,view,direct=false){
const ratio=direct?Math.min(devicePixelRatio||1,1.5):Math.min(2,Math.max(1,context.getTransform().a));
const signature=[w,h,ratio,settings.dronePattern,state.droneShowStart,state.solarView,state.time,state.yaw,state.pitch,state.zoom,state.panX,state.panY,state.cameraX,state.cameraY,state.cameraZ,state.cameraYaw,state.cameraPitch,state.focusBuilding,state.focusFacility,state.observation,settings.blenderModel,settings.dreamLight,settings.stone,settings.glass,settings.ground,windowRevision,state.daySeconds].join('|');
if(direct&&signature===lastSignature&&!zoomAnchor&&!facadePending&&!waterPending)return;
if(width!==w||height!==h||pixelRatio!==ratio){width=w;height=h;pixelRatio=ratio;renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);}
const colors=settings.stone+settings.glass+settings.ground;
if(colors!==lastColors){kit.update(settings);if(district)CityDistrict.updateColors(settings);if(prototype)CityBlender.updateColors(settings);lastColors=colors;}
const right=(w*.5-view.cx)/view.scale,vertical=(view.cy-h*.5)/view.scale;
const target=scratchTarget.set(view.c*right-view.s*view.sp*vertical,view.cp*vertical,-view.s*right-view.c*view.sp*vertical);
const distance=h/(2*view.scale*Math.tan(Math.PI/12))*1.01;
camera.position.copy(target).add(scratchDir.set(view.s*view.cp,view.sp,view.c*view.cp).multiplyScalar(distance));camera.up.set(0,1,0);camera.lookAt(target);
camera.aspect=w/h;camera.updateProjectionMatrix();
const solarFraming=Boolean(solarShow&&state.solarView),frameBounds=solarFraming?solarBounds:bounds;
if(solarFraming){
target.set(...(settings.dronePattern==='thousand'?[city.water.x,140,city.water.z]:[30,220,-100]));
camera.position.copy(target).add(scratchDir.set(view.s*view.cp,view.sp,view.c*view.cp).multiplyScalar(800));camera.lookAt(target);
}
for(let pass=0;(solarFraming||state.zoom<=1.01)&&pass<2;pass++){
camera.updateMatrixWorld();
if(projectedX.length!==frameBounds.length){projectedX=new Array(frameBounds.length);projectedY=new Array(frameBounds.length);}
let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
for(let b=0;b<frameBounds.length;b++){
const projected=scratchProjected.copy(frameBounds[b]).project(camera);
projectedX[b]=projected.x;projectedY[b]=projected.y;
if(projected.x<minX)minX=projected.x;
if(projected.x>maxX)maxX=projected.x;
if(projected.y<minY)minY=projected.y;
if(projected.y>maxY)maxY=projected.y;
}
const halfHeight=camera.position.distanceTo(target)*Math.tan(Math.PI/12);
const cx=(minX+maxX)*.5,cy=(minY+maxY)*.5;
const offset=scratchOffset.set(view.c,0,-view.s).multiplyScalar(cx*halfHeight*camera.aspect);
offset.add(scratchDir.set(-view.s*view.sp,view.cp,-view.c*view.sp).multiplyScalar(cy*halfHeight));
target.add(offset);camera.position.add(offset);
const fit=Math.max((maxX-minX)/1.84,(maxY-minY)/1.8);
if(fit>1)camera.position.sub(target).multiplyScalar(fit).add(target);
camera.lookAt(target);
}
if(solarFraming)camera.position.sub(target).multiplyScalar(1/state.zoom).add(target);
if(state.focusBuilding&&prototypeBuilding){
const b=prototypeBuilding,modelHeight=b.floors*6+8;
const center=scratchCenter.set(b.x,modelHeight*.5,b.z);
const distance=Math.max(modelHeight*.68,Math.max(b.w,b.d)*.8/camera.aspect)/Math.tan(Math.PI/12)/state.zoom;
camera.position.copy(center).add(scratchDir.set(view.s*view.cp,view.sp,view.c*view.cp).multiplyScalar(distance));camera.lookAt(center);
}
const focus=state.observationBounds||CityPlaces.focus(city,state.focusFacility);
if(focus){
const modelHeight=focus.height||(focus.floors?focus.floors*6+8:8);
const center=scratchCenter.set(focus.x,modelHeight*.42,focus.z);
const horizontal=(Math.abs(view.c)*focus.w+Math.abs(view.s)*focus.d)*.5;
const depth=(Math.abs(view.s)*focus.w+Math.abs(view.c)*focus.d)*.5;
const vertical=modelHeight*.5*view.cp+depth*view.sp;
const distance=(Math.max(horizontal/camera.aspect,vertical)*1.2/Math.tan(Math.PI/12)+depth*view.cp)/state.zoom;
camera.position.copy(center).add(scratchDir.set(view.s*view.cp,view.sp,view.c*view.cp).multiplyScalar(distance));camera.lookAt(center);
}
if(state.panX||state.panY){
const shift=scratchOffset.set(view.c,0,-view.s).multiplyScalar(state.panX/view.scale)
.add(scratchDir.set(-view.s*view.sp,view.cp,-view.c*view.sp).multiplyScalar(state.panY/view.scale));
target.add(shift);camera.position.add(shift);
}
if(state.flyTarget){
const fly=scratchCenter.set(state.flyTarget.x,state.flyTarget.y||0,state.flyTarget.z);
const distance=Math.max(h/(2*view.scale*Math.tan(Math.PI/12)),20);
camera.position.copy(fly).add(scratchDir.set(view.s*view.cp,view.sp,view.c*view.cp).multiplyScalar(distance));
camera.lookAt(fly);
}
lastFramingDistance=Math.max(20,camera.position.distanceTo(state.flyTarget||focus||state.focusBuilding?scratchCenter:target));
camera.position.add(scratchOffset.set(Number(state.cameraX)||0,Number(state.cameraY)||0,Number(state.cameraZ)||0));
const lookYaw=Number(state.cameraYaw)||0,lookPitch=Number(state.cameraPitch)||0;
if(lookYaw||lookPitch){
const yaw=state.yaw+lookYaw,pitch=state.pitch+lookPitch,cp=Math.cos(pitch);
camera.lookAt(scratchTarget.copy(camera.position).sub(scratchDir.set(Math.sin(yaw)*cp,Math.sin(pitch),Math.cos(yaw)*cp)));
}
applyZoomAnchor(state);
// Narrow/tall atlas panes move the camera farther away to fit the whole town.
// Keep the authored scene bounds inside the far plane after final navigation.
const farFloor=settings.solarShow?5000:2400;
let requiredFar=farFloor;
for(const point of frameBounds)requiredFar=Math.max(requiredFar,camera.position.distanceTo(point)+64);
requiredFar=requiredFar>farFloor?Math.ceil(requiredFar/64)*64:farFloor;
if(camera.far!==requiredFar){camera.far=requiredFar;camera.updateProjectionMatrix();}
const softness=settings.dreamLight;
const clock=root.CityDailyClock;
const hasDay=clock&&Number.isFinite(state.daySeconds);
const minute=hasDay?clock.minuteOfDay(state.daySeconds):720;
const daylight=hasDay?clock.daylight(minute):1;
const dusk=state.lighting?state.lighting.dusk:0;
const skyFrame=CityMaterials.skyState(state.daySeconds,dusk);
sun.position.set(skyFrame.sunPosition.x,skyFrame.sunPosition.y,skyFrame.sunPosition.z);
// Shadow-length clamp. At a low sun a 45 m tower throws a 300–1600 m shadow, but
// the shadow camera only spans ±345 with 5.94 texels/m. Everything past that is
// clipped away, so the ground silently loses its shadows and the raking light
// disappears exactly when it should be strongest. Raising the light until the
// shadow fits keeps the raking direction and colour while giving the ground its
// shadows back — no frustum growth, no texel-density loss.
{
  const rawY=skyFrame.sunDirection.y;
  const elev=Math.asin(Math.max(-1,Math.min(1,rawY)));
  // Below this elevation a tower's shadow runs past the shadow frustum and the
  // ground silently stops receiving shadows at all. 17.2 deg keeps a 45 m tower
  // at a 145 m shadow — still three times the noon stretch, so the raking read
  // survives, but inside ±345. The sky shader carries the low-sun look.
  const minElev=Math.atan(45/145);
  // Only while the disc is still up. Past the horizon the sun must keep sinking —
  // holding it at 17 deg after dark would light the town from a sun that has set.
  if(elev<minElev&&rawY>0.005){
    const p=sun.position;
    // Keep the sky's horizontal azimuth exactly, and set only the height so the
    // elevation lands on minElev. Scaling the whole vector instead would drag y
    // back down and lengthen the very shadows this is here to shorten.
    const horiz=Math.hypot(p.x,p.z);
    const horizAtMin=horiz*Math.cos(minElev)/Math.max(Math.cos(elev),1e-4);
    p.set(p.x*horizAtMin/(horiz||1), horiz*Math.tan(minElev), p.z*horizAtMin/(horiz||1));
  }
}
visibleSky.update(skyFrame);
moon.position.set(skyFrame.moonPosition.x,skyFrame.moonPosition.y,skyFrame.moonPosition.z);
// Golden hour leads the sun's own warm-up. The sky shader reads goldenHour from
// 17:00, but the directional light used to warm only once dusk had risen (18:10+),
// so glass facade reflections went gold a whole band before the direct light did.
// Warm on goldenHour, and let daylight take over only after the sun is actually
// setting — the two now start and peak together instead of half a band apart.
const sunWarm=Math.max(skyFrame.goldenHour,1-daylight,dusk*.88);
sun.intensity=(4.2-softness*1.0)*daylight*(1-.48*dusk);
sun.color.copy(SUN_NOON).lerp(SUN_LOW,sunWarm);
moon.intensity=.20*(1-daylight)*skyFrame.moonVisibility;
sky.intensity=(.22+softness*.22)*(.75+.25*daylight);
sky.color.copy(HEMI_NIGHT).lerp(HEMI_NOON,daylight);
sky.groundColor.copy(HEMI_GROUND_NIGHT).lerp(HEMI_GROUND_NOON,daylight);
sun.shadow.radius=1.25+softness*2.8;scene.environmentIntensity=(.56+softness*.13)*(.28+.72*daylight);
renderer.toneMappingExposure=.93+softness*.025+(1-daylight)*.06;
skyScratch.copy(SKY_NIGHT).lerp(SKY_NOON,daylight);
skyScratch.lerp(SKY_DUSK,Math.max(0,1-Math.abs(daylight-.28)/.28)*.5);
skyScratch.lerp(SKY_DUSK,dusk*.32);scene.background.copy(skyScratch);
const lifeSeconds=Number.isFinite(state.daySeconds)?state.daySeconds:state.time;
facadeLight=.22+.78*daylight;
updateBuildings(Math.min(state.time,city.duration));syncPlinths();updateActors(lifeSeconds,state.lighting,state.daySeconds);ground.update(lifeSeconds,softness,state.lighting,camera,h*ratio);updateEffectPreview(state);streetLighting.update(state.lighting);
if(facilities)facilities.update(Math.min(state.time,city.duration));
const interiorMode=state.lighting?'town':'legacy';
if(interiorMode!==interiorLightingMode){
interiorLightingMode=interiorMode;lastLightingKey='';windowLights.forEach(e=>{e.lastLevel=null;});
}
if(state.lighting){windowLights.forEach(e=>{e.mesh.visible=false;e.drawn=false;});if(officeWindows)officeWindows.visible=false;if(facilities&&facilities.setLighting)facilities.setLighting(state.lighting);}
else{
if(facilities?.setInteriorDaylight)facilities.setInteriorDaylight(daylight);
updateWindowLights(Math.min(state.time,city.duration));updateOfficeWindows(Math.min(state.time,city.duration));
}
if(housing)housing.update(Math.min(state.time,city.duration));
if(district&&state.lighting&&district.setLighting)district.setLighting(state.lighting);
if(frontage)frontage.update(Math.min(state.time,city.duration),state.lighting);
updateTownLights(Math.min(state.time,city.duration),state.lighting);
if(airship)airship.update(state.time,state.lighting);
if(nightShowcase)nightShowcase.update(Math.min(state.time,city.duration),state.lighting,state.daySeconds,state.festival);
if(townAccentBatch)townAccentBatch.sync();
for(const batch of actorAssemblies)batch.sync();
if(helipad)helipad.update(state.time);
if(solarShow)solarShow.update(settings.dronePattern==='thousand'?state.time-(state.droneShowStart||0):state.time,ratio);
publicScenes.forEach(item=>item.controller.update(lifeSeconds,state.lighting,state.daySeconds));
const walkingFade=actorsData&&[...actorsData.pedestrians,...actorsData.shoppers,...actorsData.riders].some(p=>p.visibility>0&&p.visibility<1);
const shadowTime=state.time+'|'+minute+(walkingFade?'|'+lifeSeconds:''),reflectionTick=Math.floor((effectPreview?effectPreview.seconds:lifeSeconds)*12),cameraKey=[state.yaw,state.pitch,state.cameraYaw,state.cameraPitch,state.zoom,state.focusBuilding,state.focusFacility,state.observation,settings.blenderModel,w,h,colors,softness,camera.position.x,camera.position.y,camera.position.z,camera.quaternion.x,camera.quaternion.y,camera.quaternion.z,camera.quaternion.w].join('|');
renderer.shadowMap.needsUpdate=sun.intensity>0&&(shadowTime!==lastShadow||cameraKey!==lastCamera||!direct);
// Poll all r180 program variants without blocking the browser on shader linking.
if(!initialProgramsPrepared){
if(!programsQueued){
renderer.compile(scene,camera);
if(ground.water.getRenderTarget){const previous=renderer.getRenderTarget(),water=ground.water.material;try{ground.water.material=null;renderer.setRenderTarget(ground.water.getRenderTarget());renderer.compile(scene,camera);}finally{renderer.setRenderTarget(previous);ground.water.material=water;}}
programsQueued=true;return false;
}
if(!renderer.info.programs.every(p=>!p.program||!renderer.getContext().isProgram(p.program)||p.isReady()))return false;
initialProgramsPrepared=true;
}
renderReflectionFrame(state.time,colors+'|'+softness+'|'+Math.floor(minute/30)+'|'+Math.floor(daylight*8),reflectionTick,cameraKey,direct);
lastShadow=shadowTime;
if(direct){
renderer.domElement.style.width=w+'px';renderer.domElement.style.height=h+'px';
lastSignature=signature;return;
}
context.save();context.fillStyle='#e9f0f5';context.fillRect(0,0,w,h);
context.drawImage(renderer.domElement,0,0,w,h);context.restore();lastSignature='';
}
    function dispose(){if(residentBatch){residentBatch.dispose();residentBatch=null;}if(solarShow)solarShow.dispose();if(streetLighting)streetLighting.dispose();if(nightShowcase)nightShowcase.dispose();scene.remove(visibleSky.mesh);visibleSky.dispose();releaseFacadeReflection();publicScenes.forEach(item=>item.controller.dispose());publicScenes=[];if(facilities)facilities.dispose();if(housing)housing.dispose();if(frontage)frontage.dispose();if(helipad)helipad.dispose();if(airship)airship.dispose();if(district)district.dispose();if(officeArchitecture)officeArchitecture.dispose();if(prototype){scene.remove(prototype.group);prototype.dispose();}if(ground)ground.dispose();releaseGroup(buildingRoot);releaseGroup(actorRoot);[box,sphere,cylinder,poolGeo,...ownedMaterials].forEach(o=>o.dispose());sun.shadow.dispose();kit.dispose();renderer.dispose();}
    function attach(stage,previous){renderer.domElement.setAttribute('aria-label',previous.getAttribute('aria-label'));renderer.domElement.setAttribute('role','img');renderer.domElement.style.touchAction='none';stage.replaceChild(renderer.domElement,previous);}
return{rebuild,render,dispose,attach,scene,setDronePattern,setEffectPreview,setWindowLight,setTownView,pickBuilding,projectBuilding,captureZoomAnchor,clearZoomAnchor,invalidate:()=>{lastSignature='';lastShadow=-1;lastReflection=-1;clearZoomAnchor();},getInfo:()=>({effects:effectPreviewInfo(),initialization:{ready:initialProgramsPrepared,reflectionPending:facadePending,reflectionFace:facadeJob?facadeJob.face:null},nightShowcase:nightShowcase?nightShowcase.getInfo():null,engine:'Three.js r'+T.REVISION,residents:residentBatch?residentBatch.getInfo():null,solarShow:solarShow?solarShow.getInfo():null,shadows:renderer.shadowMap.enabled,shadowMap:sun.shadow.mapSize.toArray(),shadowFrustum:[sun.shadow.camera.left,sun.shadow.camera.right,sun.shadow.camera.top,sun.shadow.camera.bottom],reflection:Boolean(ground&&ground.water),festival:ground?ground.getFestivalInfo():null,blender:district?{id:prototypeBuilding.id,enabled:settings.blenderModel!==false,scope:'district',buildings:city.buildings.filter(b=>!b.facility&&!b.housing).length}:prototype?{id:prototypeBuilding.id,enabled:settings.blenderModel!==false,scope:'sample',buildings:1}:null,district:district?district.getInfo():null,officeArchitecture:officeArchitecture?officeArchitecture.getInfo():null,facilities:facilities?facilities.getInfo():null,housing:housing?housing.getInfo():null,frontage:frontage?frontage.getInfo():null,helipad:helipad?helipad.getInfo():null,airship:airship?airship.getInfo():null,places:Object.fromEntries(publicScenes.map(item=>[item.name,item.controller.getInfo()])),parkSeating:ground?ground.group.userData.groundDetails.parkSeating:[],streetExtras:ground?{bins:ground.group.userData.groundDetails.bins,binAnchors:ground.group.userData.groundDetails.furniture.filter(f=>f.kind==='bin').map(f=>({x:f.x,z:f.z})),streetTrees:ground.group.userData.groundDetails.streetTrees,pedestrianBridges:ground.group.userData.groundDetails.pedestrianBridges,vendingAnchors:ground.group.userData.groundDetails.furniture.filter(f=>f.kind==='vending').map(f=>({x:f.x,z:f.z})),mailboxAnchors:ground.group.userData.groundDetails.furniture.filter(f=>f.kind==='mailbox').map(f=>({x:f.x,z:f.z})),busStops:(city.transitStops||[]).filter(s=>s.kind==='bus').map(s=>({x:s.x,z:s.z,shelter:s.shelter===true}))}:null,officeLights:officePanes.map(e=>({id:e.id,mapId:e.building.id,level:townView?.byBuilding[e.id]?.lightLevel||0,windows:e.panes.length,litWindows:e.litWindows})),windowLights:windowLights.map(item=>({id:item.wing.id,facility:item.wing.facility,panes:item.mesh.count,litWindows:item.litWindows,level:windowLevel(item.wing.id),lit:item.mesh.visible===true})),lighting:{...lightingInfo,gpuSpots:spotPasses.get(renderer)?.stats||null,activeCars,streetLamps:ground?ground.group.userData.groundDetails.lamps:0,streetLampAnchors:ground?ground.group.userData.groundDetails.lampAnchors:[]},calls:renderer.info.render.calls,triangles:renderer.info.render.triangles})};
}
root.CityScene={create,townAppearanceActors,personParts,createPersonPreview,buildSpotGrid,prepareGpuSpotRenderer,createStreetLighting,personPose,facadeMessagePlan,facadeScreenPlan,facadeScreenFrame,facadeMediaPlan,createNightShowcase,createInstanceAggregate,prepareGpuSpotLoop,prepareOpaqueShadow};
if(typeof module==='object'&&module.exports)module.exports=root.CityScene;
})(typeof globalThis!=='undefined'?globalThis:this);
