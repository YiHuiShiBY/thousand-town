/* A deterministic light-point rehearsal, in world space; one point is one drone. */
(function(root){
  'use strict';
  const TAU=Math.PI*2,GOLDEN=Math.PI*(3-Math.sqrt(5)),COUNT=3000,SCALE=2.0;
  const ORBITS=Object.freeze([30,40,50,70,90,110,140,170]);
  const BODIES=Object.freeze([
    {name:'太阳',count:800,r:10,orbit:0,a:0,speed:0,tilt:0,color:[1,.49,.055]},
    {name:'水星',count:60,r:1.5,orbit:18,a:-.37,speed:1.8,tilt:.05,color:[.85,.89,1]},
    {name:'金星',count:110,r:2.2,orbit:25,a:3.66,speed:1.5,tilt:-.03,color:[1,.82,.3]},
    {name:'地球',count:200,r:2.8,orbit:33,a:5.25,speed:1.24,tilt:0,color:[.08,.65,1]},
    {name:'火星',count:80,r:1.9,orbit:41,a:1.76,speed:1.03,tilt:.05,color:[1,.15,.065]},
    {name:'木星',count:340,r:4.8,orbit:53,a:3.52,speed:.69,tilt:-.025,color:[1,.66,.28]},
    {name:'土星',count:220,r:3.5,orbit:67,a:5.74,speed:.51,tilt:.065,color:[1,.82,.4]},
    {name:'天王星',count:140,r:3,orbit:80,a:1.69,speed:.36,tilt:-.065,color:[.15,1,.8]},
    {name:'海王星',count:150,r:3.1,orbit:94,a:4.06,speed:.26,tilt:.03,color:[.13,.38,1]}
  ].map(Object.freeze));
  function formation(){
    const local=new Float32Array(COUNT*3),colors=new Float32Array(COUNT*3),sizes=new Float32Array(COUNT),body=new Uint8Array(COUNT),kind=new Uint8Array(COUNT);
    let n=0;
    function add(b,x,y,z,color,k,size){const p=n*3;local[p]=x;local[p+1]=y;local[p+2]=z;colors.set(color,p);body[n]=b;kind[n]=k;sizes[n]=size;n++;}
    BODIES.forEach((b,index)=>{
      for(let i=0;i<b.count;i++){
        // The Sun is only two concentric spheres: no arcs or protruding points.
        const inner=index===0&&i>=700,count=inner?100:index===0?700:b.count,j=inner?i-700:i;
        const y=1-2*(j+.5)/count,radial=Math.sqrt(1-y*y),a=j*GOLDEN,r=inner?7.3:b.r;
        let color=b.color;
        if(index===0&&i%5===0)color=[1,.8,.22];
        if(index===3&&Math.sin(a*2.1+y*9)+Math.sin(a*3.3-y*5)>.85)color=[.08,.95,.48];
        if(index===5&&Math.sin(y*22)>.3)color=[1,.88,.6];
        add(index,Math.cos(a)*radial*r,y*r,Math.sin(a)*radial*r,color,0,inner?1.6:2.6);
      }
    });
    for(let i=0;i<200;i++){
      const a=i*GOLDEN,r=Math.sqrt(4.5*4.5+(7.5*7.5-4.5*4.5)*(i+.5)/200),z=Math.sin(a)*r;
      add(6,Math.cos(a)*r,Math.sin(.48)*z,Math.cos(.48)*z,[1,.8,.35],1,1.7);
    }
    ORBITS.forEach((count,index)=>{
      const b=BODIES[index+1];
      for(let i=0;i<count;i++){
        const a=TAU*i/count,z=b.orbit*Math.sin(a);
        add(index+1,b.orbit*Math.cos(a),z*Math.sin(b.tilt),z*Math.cos(b.tilt),[.68,.86,1],2,3.4);
      }
    });
    if(n!==COUNT)throw new Error('Solar allocation must total 3000');
    return {local,colors,sizes,body,kind};
  }
  function sample(data,seconds,out){
    const t=Number.isFinite(seconds)?seconds:0,positions=out||new Float32Array(COUNT*3);
    const centers=BODIES.map(b=>{const a=b.a+t*.025*b.speed,z=b.orbit*Math.sin(a);return [b.orbit*Math.cos(a),z*Math.sin(b.tilt),z*Math.cos(b.tilt)];});
    const c=Math.cos(t*.045),s=Math.sin(t*.045);
    for(let i=0;i<COUNT;i++){
      const p=i*3,x=data.local[p],y=data.local[p+1],z=data.local[p+2],k=data.kind[i],center=centers[data.body[i]];
      positions[p]=(k===2?x:center[0]+(k===1?x:x*c-z*s))*SCALE;
      positions[p+1]=(k===2?y:center[1]+y)*SCALE;
      positions[p+2]=(k===2?z:center[2]+(k===1?z:x*s+z*c))*SCALE;
    }
    return positions;
  }
  function pose(seconds){
    const t=Number.isFinite(seconds)?seconds:0;
    return {position:[30+24*Math.sin(t*.018),300+6*Math.sin(t*.014),-190+16*Math.cos(t*.018)],rotation:[.43+.025*Math.sin(t*.018),-.24+.10*Math.sin(t*.015),.18]};
  }
  // Conservative all-time envelope, independent of camera, pause and timeline.
  const BOUNDS=Object.freeze({min:Object.freeze([-205,180,-415]),max:Object.freeze([270,420,35])});
  const PATTERNS=Object.freeze([
    Object.freeze({id:'solar',name:'太阳系',count:COUNT,status:'保留图案',description:'球形太阳、八条轨道与持续公转；已确认的 3000 架版本。'}),
    Object.freeze({id:'thousand',name:'1000 · 河心升起',count:COUNT,status:'新图案',description:'从河心升起，越过楼顶后展开，金色字面与冰蓝厚度持续旋转。'})
  ]);
  function roundedContour(w,h,r){
    const points=[];
    for(let corner=0;corner<4;corner++){
      const angle=corner*Math.PI/2,cx=(corner===0||corner===3?1:-1)*(w-r),cy=(corner<2?1:-1)*(h-r);
      for(let j=0;j<=12;j++){const a=angle+j*Math.PI/24;points.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}
    }
    return points;
  }
  const DIGITS=Object.freeze([
    {count:480,x:-78,outer:[[-14,24],[-2,40],[8,40],[8,-30],[17,-30],[17,-40],[-17,-40],[-17,-30],[-2,-30],[-2,22],[-8,15]],inner:[]},
    ...[-26,26,78].map(x=>({count:840,x,outer:roundedContour(22,40,11),inner:roundedContour(14,32,5)}))
  ]);
  function insidePolygon(x,y,points){
    let inside=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const a=points[i],b=points[j];
      if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    return inside;
  }
  function onContour(points,u){
    const lengths=points.map((p,i)=>Math.hypot(p[0]-points[(i+1)%points.length][0],p[1]-points[(i+1)%points.length][1]));
    let distance=u*lengths.reduce((a,b)=>a+b,0);
    for(let i=0;i<points.length;i++){
      if(distance<=lengths[i]||i===points.length-1){const a=points[i],b=points[(i+1)%points.length],f=distance/lengths[i];return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];}
      distance-=lengths[i];
    }
  }
  function numberFormation(){
    const local=new Float32Array(COUNT*3),colors=new Float32Array(COUNT*3),sizes=new Float32Array(COUNT),body=new Uint8Array(COUNT),kind=new Uint8Array(COUNT);
    let n=0;
    const fract=x=>x-Math.floor(x);
    DIGITS.forEach((digit,index)=>{
      const faces=Math.floor(digit.count*.8);let candidate=0;
      for(let j=0;j<digit.count;j++){
        let x,y,z;
        if(j<faces){
          do{candidate++;x=(fract(candidate*.754877666)-.5)*44;y=(fract(candidate*.569840296)-.5)*80;}
          while(!insidePolygon(x,y,digit.outer)||insidePolygon(x,y,digit.inner));
          z=j%2?5:-5;
        }else{
          const edge=j-faces,contour=digit.inner.length&&edge%2?digit.inner:digit.outer,p=onContour(contour,fract((edge+.5)*.618033989));
          x=p[0];y=p[1];z=(fract((edge+.5)*.414213562)-.5)*10;
        }
        local.set([x+digit.x,y,z],n*3);
        colors.set(j<faces?(z>0?[1,.78,.34]:[.34,.74,1]):[.52,.90,1],n*3);
        sizes[n]=j<faces?2.8:2.3;body[n]=index;kind[n]=j<faces?0:1;n++;
      }
    });
    return {local,colors,sizes,body,kind};
  }
  function numberContext(options={}){
    return {x:Number.isFinite(options.x)?options.x:0,z:Number.isFinite(options.z)?options.z:0,roof:Number.isFinite(options.roof)?Math.max(0,options.roof):148};
  }
  function numberPose(seconds,options){
    const t=Math.max(0,Number.isFinite(seconds)?seconds:0),c=numberContext(options),smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
    const rise=smooth(t/18),expand=smooth((t-18)/10),u=Math.max(0,t-24),angle=.065*(u<4?u*u/8:u-2);
    return {position:[c.x,17+(c.roof+66-17)*rise+2*Math.sin(Math.max(0,t-28)*.12),c.z],rotation:[0,-.66+angle,0],scale:.1+.9*expand,phase:t<18?'rising':t<28?'expanding':'rotating'};
  }
  function numberBounds(options){const c=numberContext(options);return {min:[c.x-112,12,c.z-112],max:[c.x+112,c.roof+110,c.z+112]};}

  function create(T,options={}){
    let pattern=options.pattern==='thousand'?'thousand':'solar',data=pattern==='solar'?formation():numberFormation();
    const positions=pattern==='solar'?sample(data,0):data.local.slice(),geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
    geometry.setAttribute('color',new T.BufferAttribute(data.colors,3));
    geometry.setAttribute('pointSize',new T.BufferAttribute(data.sizes,1));
    geometry.boundingSphere=new T.Sphere(new T.Vector3(),200);
    const material=new T.RawShaderMaterial({
      transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,toneMapped:false,
      uniforms:{pixelRatio:{value:1},brightness:{value:1}},
      vertexShader:'precision highp float; uniform mat4 modelViewMatrix,projectionMatrix; uniform float pixelRatio; attribute vec3 position,color; attribute float pointSize; varying vec3 vColor; void main(){vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp(pointSize*pixelRatio*1000.0/max(1.0,-p.z),pointSize>3.0?2.6:1.5,8.0);vColor=color;}',
      fragmentShader:'precision highp float; uniform float brightness; varying vec3 vColor; void main(){float r=length(gl_PointCoord-vec2(.5))*2.0;if(r>1.0)discard;float core=1.0-smoothstep(.2,.76,r);float halo=(1.0-r)*(1.0-r)*.35;gl_FragColor=vec4(vColor,brightness*(core*.92+halo));}'
    });
    const group=new T.Group(),points=new T.Points(geometry,material);group.name='solar-drone-show';points.name='3000-drone-lights';points.raycast=function(){};points.castShadow=false;points.receiveShadow=false;group.add(points);
    let time=NaN,disposed=false;
    function update(seconds,pixelRatio=1){
      if(disposed)return;
      material.uniforms.pixelRatio.value=pixelRatio;
      const t=Number.isFinite(seconds)?seconds:0;if(t===time)return;time=t;
      if(pattern==='solar')sample(data,t,positions);else positions.set(data.local);geometry.attributes.position.needsUpdate=true;
      const p=pattern==='solar'?pose(t):numberPose(t,options);group.position.fromArray(p.position);group.rotation.set(...p.rotation);group.scale.setScalar(p.scale||1);
    }
    function setPattern(id){
      if(disposed)return;
      pattern=id==='thousand'?'thousand':'solar';data=pattern==='solar'?formation():numberFormation();
      geometry.attributes.color.array.set(data.colors);geometry.attributes.color.needsUpdate=true;
      geometry.attributes.pointSize.array.set(data.sizes);geometry.attributes.pointSize.needsUpdate=true;
      geometry.boundingSphere.radius=pattern==='solar'?200:112;time=NaN;update(0);
    }
    setPattern(pattern);
    return {group,update,setPattern,getInfo:()=>({patternId:pattern,count:COUNT,orbitCount:pattern==='solar'?700:0,sunCount:pattern==='solar'?800:0,solarArcs:0,batches:1,seconds:time,center:group.position.toArray(),rotation:group.rotation.toArray().slice(0,3),scale:group.scale.x,phase:pattern==='solar'?'orbiting':numberPose(time,options).phase,bounds:pattern==='solar'?BOUNDS:numberBounds(options),representation:'light-points',orbitCounts:pattern==='solar'?ORBITS.slice():[],text:pattern==='thousand'?'1000':null}),dispose:()=>{if(disposed)return;disposed=true;group.removeFromParent();geometry.dispose();material.dispose();}};
  }
  const api={COUNT,SCALE,BODIES,ORBITS,BOUNDS,PATTERNS,DIGITS,formation,sample,pose,numberFormation,numberPose,numberBounds,create};
  root.SolarDroneShow=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
