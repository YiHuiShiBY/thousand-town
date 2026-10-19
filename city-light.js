/* Soft daylight effects. Positions and brightness depend only on the city seed and time. */
(function (root) {
  'use strict';
  const TAU=Math.PI*2;
  const randomGenerator=(typeof CityRandom==='object'&&CityRandom&&CityRandom.randomGenerator)
    ?CityRandom.randomGenerator
    :(typeof require==='function'?require('./city-random.js').randomGenerator:null);
  function create(city) {
    const random=randomGenerator(city.seed^0x4C495447),motes=[];
    for(let i=0;i<32;i++) {
      const river=i<20;
      const x=river?(i%2?1:-1)*(18+random()*10):(random()-.5)*310;
      const z=(random()-.5)*300;
      let y=river?14+random()*45:28+random()*85;
      for(const b of city.buildings)if(Math.abs(x-b.x)<b.w/2+6&&Math.abs(z-b.z)<b.d/2+6)y=Math.max(y,b.floors*6+12);
      motes.push({x,z,y,phase:random()*TAU,size:.55+random()*.7,warm:i%4!==0,star:i%7===0});
    }
    return motes;
  }
  function sample(motes,time) {
    return motes.map((m,i)=>({
      x:m.x+Math.sin(time*.13+m.phase)*2.2,
      z:m.z+Math.cos(time*.11+m.phase)*1.7,
      y:m.y+Math.sin(time*.3+m.phase)*3.2,
      alpha:.25+.65*Math.pow(.5+.5*Math.sin(time*.62+m.phase),3),
      size:m.size,warm:m.warm,star:m.star
    }));
  }
  function isOccluded(p,boxes,direction) {
    for(const box of boxes) {
      const lo=[box.x-box.w/2,box.y,box.z-box.d/2],hi=[box.x+box.w/2,box.y+box.h,box.z+box.d/2];
      const origin=[p.x,p.y,p.z],ray=[direction.x,direction.y,direction.z];
      let near=-Infinity,far=Infinity;
      for(let axis=0;axis<3;axis++) {
        if(Math.abs(ray[axis])<1e-9) {if(origin[axis]<lo[axis]||origin[axis]>hi[axis]){far=-Infinity;break;}}
        else {const a=(lo[axis]-origin[axis])/ray[axis],b=(hi[axis]-origin[axis])/ray[axis];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));}
      }
      if(far>=Math.max(near,.001))return true;
    }
    return false;
  }
  function halo(ctx,x,y,radius,color,alpha) {
    if(alpha<=0||radius<=0)return;
    const gradient=ctx.createRadialGradient(x,y,0,x,y,radius);
    gradient.addColorStop(0,`rgba(${color},${alpha})`);
    gradient.addColorStop(.35,`rgba(${color},${alpha*.48})`);
    gradient.addColorStop(1,`rgba(${color},0)`);
    ctx.fillStyle=gradient;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
  function shaft(ctx,x,y,endX,endY,width,alpha) {
    const length=Math.hypot(endX-x,endY-y);
    ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(endY-y,endX-x));
    const gradient=ctx.createLinearGradient(0,-width,0,width);
    gradient.addColorStop(0,'rgba(255,238,196,0)');
    gradient.addColorStop(.28,`rgba(255,241,206,${alpha*.22})`);
    gradient.addColorStop(.5,`rgba(255,250,229,${alpha})`);
    gradient.addColorStop(.72,`rgba(255,241,206,${alpha*.22})`);
    gradient.addColorStop(1,'rgba(255,238,196,0)');
    ctx.fillStyle=gradient;ctx.beginPath();
    ctx.moveTo(0,-width*.08);ctx.lineTo(length,-width);ctx.lineTo(length,width);ctx.lineTo(0,width*.08);ctx.closePath();ctx.fill();ctx.restore();
  }
  function atmosphere(ctx,w,h,time,strength) {
    if(!strength)return;
    ctx.save();
    halo(ctx,w*.15,h*.12,Math.max(w,h)*.72,'255,216,157',strength*.55);
    halo(ctx,w*.95,h*.22,w*.5,'200,192,231',strength*.35);
    halo(ctx,w*.72,h*.95,w*.53,'170,219,214',strength*.16);
    const drift=Math.sin(time*.075)*w*.012;
    for(const [end,width,alpha] of [[.42,.063,.33],[.67,.047,.3],[.93,.095,.2]]) {
      shaft(ctx,w*.10,-h*.22,w*end+drift,h*1.12,w*width,strength*alpha);
    }
    ctx.restore();
  }
  function veil(ctx,w,h,time,strength) {
    if(!strength)return;
    ctx.save();
    const drift=Math.sin(time*.075)*w*.012;
    shaft(ctx,w*.1,-h*.22,w*.67+drift,h*1.12,w*.047,strength*.16);
    shaft(ctx,w*.1,-h*.22,w*.42+drift,h*1.12,w*.063,strength*.13);
    ctx.restore();
  }
  function spark(ctx,x,y,radius,alpha,warm=true,star=false) {
    if(alpha<.015)return;
    ctx.save();
    halo(ctx,x,y,radius,warm?'255,196,91':'127,221,245',alpha*.8);
    const core=Math.max(.55,radius*.13);
    ctx.fillStyle=`rgba(${warm?'255,248,206':'235,254,255'},${Math.min(1,alpha*1.5)})`;
    ctx.beginPath();ctx.arc(x,y,core,0,TAU);ctx.fill();
    if(star) {
      const length=radius*.56,thin=Math.max(.35,radius*.035);
      ctx.fillStyle=`rgba(255,253,226,${alpha})`;
      ctx.beginPath();ctx.moveTo(x,y-length);ctx.lineTo(x+thin,y-thin);ctx.lineTo(x+length*.7,y);
      ctx.lineTo(x+thin,y+thin);ctx.lineTo(x,y+length);ctx.lineTo(x-thin,y+thin);
      ctx.lineTo(x-length*.7,y);ctx.lineTo(x-thin,y-thin);ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }
  const api={create,sample,isOccluded,atmosphere,veil,spark};
  root.CityLight=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
