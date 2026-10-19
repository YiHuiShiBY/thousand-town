/* River night market: 32 stall plots on both banks, their outdoor seating, the
 * lighting that makes the bank read at night, and the street office that shares
 * the same river corridor. Static geometry, local materials, generous walking
 * clearance.
 *
 * The 140-stool promise in §4.5 is physical, not arithmetic: 12 hot-food plots
 * seat 5 at their outdoor table and 20 cold plots seat 4 at the counter, so
 * 12*5 + 20*4 = 140. `plan()` therefore has to deliver exactly 32 counted
 * plots, 16 per bank, and every number below is what makes that hold:
 *
 *  - the plot spans u in [28.35, 33.95] from the canal centre. 26.8 is the inner
 *    edge of the protected river-walk corridor (city-ground paves it, and the
 *    spatial QA refuses any raised part inside it), 33.95 stays clear of the
 *    34.0 lot line a swapped park or station would press against, and 28.35 is
 *    just far enough out that city-ground's promenade lamps (their reservation
 *    reaches 27.5 plus a 0.7 margin) are not squeezed out of the bank.
 *  - every raised part stays inside its own plot rectangle, because that
 *    rectangle is what is pushed into city.reservations and what the ground
 *    furniture, the frontage rings and the walking model all give way to.
 *  - usable bank length is |z| <= 228 (Stage 0): the market keeps the band it
 *    was seated on. The 2026-09-21 river straightening removed the mouth
 *    crescents this limit once matched — water now runs past every plot to
 *    |z| = 258 — and the seated plots stay put, so nothing downstream moves.
 *
 * Scale follows the project's own architecture, not metres (a storey is 6,
 * a walker is 4.35 to the top of the head, see the note atop city-frontage.js):
 * a stool seat is 1.35 high, a night-market table 2.1, a lantern 1.3, and the
 * festoon hangs at 4.4-5.0 so it clears the heads of the people under it.
 *
 * The trades are night food. V2's coffee/flowers/fruit/books row was a daytime
 * market; the ledger's third peak is a 20:05 supper, so the street sells hot
 * food and supper things and the awning colours went dark-and-warm with it. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CityWaterfront=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  // hot: true  -> carries the outdoor table group (5 seats); cold -> 4 counter stools.
  const styles=[
    {name:'炭火烤串',type:'grill',color:'#b4432c',hot:true},
    {name:'麻辣小锅',type:'hotpot',color:'#a8403a',hot:true},
    {name:'煎饼炉子',type:'griddle',color:'#c78c3e',hot:true},
    {name:'冰粉糖水',type:'dessert',color:'#7fa8a1'},
    {name:'鲜榨果饮',type:'juice',color:'#d5a65b'},
    {name:'卤味冷盘',type:'deli',color:'#8393ad'}];
  const HOT=styles.filter(s=>s.hot),COLD=styles.filter(s=>!s.hot);
  // The stall line sits in a corridor that is 8.25 units wide and shared by three
  // systems, so its centre has almost no play: the riverside promenade pavement ends
  // at |x| 27.9, a plot's compound reaches 2.9 in from its facade (ring 2.2 + a .41
  // section + the corner pier), and `partClear` wants .28 of air between the two.
  // With a 5.6-wide stall that leaves 30.7 .. 31.05 for the centre — the V2 line at
  // 31.2 sat inside it only because V2's stalls were 5.4 wide and its 16 stalls never
  // landed beside a corner. At 32 stalls spaced along the arc, 31.15 put three plots'
  // frontage outside the law, so the market steps 0.25 west and keeps .15 either side.
  const PLOT={x:30.9,w:5.6,d:6.6,height:6.2};          // u 28.1 .. 33.7
  const HALF_W=PLOT.w/2,HALF_D=PLOT.d/2;
  const SEATS={hot:5,cold:4};
  const PER_BANK=16,STAGGER=3.4;                        // banks never share a z
  // Six hot plots per bank, spread so no two sit either side of the same crossing.
  const HOT_SLOTS=[1,4,6,9,11,14];
  const COLD_SLOTS=Array.from({length:PER_BANK},(_,i)=>i).filter(i=>HOT_SLOTS.indexOf(i)<0);
  const END_INSET=30;                                    // stage-0 band inset from each board end
  const MARKET_ID='c-night-market';                      // resident.js: 2 waterfront functions
  // The street office is the corridor's second body: same bank band, north end,
  // no lot. `kind` and `id` are the ledger's words for it (city-life-ext/resident.js).
  const CIVIC={kind:'civic',id:'c-civic',name:'街道办事处',u:PLOT.x,w:5.6,d:18,height:11.6};
  const CIVIC_SPOTS=[{side:-1,z:-204},{side:1,z:-204},{side:-1,z:204},{side:1,z:204}];
  function overlap(a,b,gap=0){return Math.abs(a.x-b.x)<(a.w+b.w)/2+gap&&Math.abs(a.z-b.z)<(a.d+b.d)/2+gap;}
  function rect(city,site){return {x:city.water.x+site.side*site.u,y:0,z:site.z,w:site.w,d:site.d};}
  // Anything the module draws above walking height has to sit inside one of
  // these footprints, which is also the set the ground gives way to.
  function sites(city){return plan(city).concat([civicSite(city)]);}
  // The market's stage-0 band: plots seat between the crossings, clear of the
  // board ends. The inset was once the crescent depth city-ground filled the
  // mouths with; the straightening removed that fill and extended the
  // promenade, and the band stays where every seated plot already is.
  function bankLimit(city){return Math.abs(city.water.d)/2-END_INSET-HALF_D;}
  // Every predicate blockedFor() refuses on, projected onto the bank's z axis for
  // one side: a stall centred anywhere inside the returned band is clear of it by
  // at least `gap`. Per side, because the street office and a swapped-in lot only
  // ever stand on one bank. This is what keeps 16 plots a bank: cutting the
  // aprons first means no slot has to be abandoned to a crossing.
  function blockedBands(city,side){
    const blocked=[];
    const carve=(r,gap)=>{
      if(Math.abs(r.x-side*PLOT.x)>=(PLOT.w+r.w)/2+gap)return;
      blocked.push([r.z-r.d/2-gap-HALF_D,r.z+r.d/2+gap+HALF_D]);
    };
    city.roads.filter(r=>r.axis==='x').forEach(r=>carve(r,1));
    city.bridges.forEach(b=>carve({x:b.x,z:b.z,w:b.w+20,d:b.d+10},1));
    city.buildings.forEach(b=>carve(b,1.6));
    // A stall must also leave each plot its frontage. The narrowest wall the
    // frontage planner can build stands 2.61 in from its own facade (ring 2.2 plus
    // half a .41 section) and `partClear` wants .28 of air past that, so the
    // market's outer edge has to stop 2.89 short of the facade. A lot that reaches
    // that close — a split half, whose facade sits at |x| 36.15 while a whole-lot
    // block reaches 37 — has no legal stall beside it, so its z band is carved
    // like a crossing. Same rule that moved the pavement trees in Stage 0
    // (`city-model.js`'s `inFrontage`), seen from the other side of a corridor
    // that the canal, the promenade, the market and the frontage all share.
    city.buildings.forEach(b=>{
      if(Math.sign(b.x)!==side)return;              // only lots backing onto this bank
      const facade=Math.abs(b.x)-b.w/2;
      if(facade-(PLOT.x+HALF_W+2.61+.28)<0)
        blocked.push([b.z-b.d/2-HALF_D-.4,b.z+b.d/2+HALF_D+.4]);
    });
    (city.places||[]).forEach(p=>carve(p,1.6));
    (city.parks||[]).forEach(p=>carve(p,.2));
    if(city.playground)carve(city.playground,.2);
    city.trees.forEach(t=>carve({x:t.x,z:t.z,w:t.r*2,d:t.r*2},.5));
    const office=civicSite(city);
    if(office.side===side)carve({x:office.x,z:office.z,w:office.w,d:office.d},1.6);
    return blocked;
  }
  function freeWindows(city,side){
    const limit=bankLimit(city),blocked=blockedBands(city,side);
    blocked.sort((a,b)=>a[0]-b[0]);
    const free=[];let cursor=-limit;
    for(const band of blocked){
      if(band[1]<-limit||band[0]>limit)continue;
      if(band[0]>cursor)free.push([cursor,Math.min(band[0],limit)]);
      cursor=Math.max(cursor,band[1]);
    }
    if(cursor<limit)free.push([cursor,limit]);
    return free.filter(w=>w[1]-w[0]>PLOT.d);
  }
  function atArc(windows,distance){
    let rest=distance;
    for(const w of windows){const len=w[1]-w[0];if(rest<=len)return{z:w[0]+rest,window:w};rest-=len;}
    const last=windows[windows.length-1];
    return {z:Math.min(last[1]-HALF_D*.01,last[1]),window:last};
  }
  function blockedFor(city,body){
    return city.buildings.some(b=>overlap(body,b,1.6))
      ||city.roads.some(r=>overlap(body,r,1))
      ||city.bridges.some(b=>overlap(b,{...b,w:b.w+20,d:b.d+10},1)&&overlap(body,{...b,w:b.w+20,d:b.d+10},1))
      ||overlap(body,city.water,1)
      ||(city.places||[]).some(p=>overlap(body,p,1.6))
      ||(city.parks||[]).some(p=>overlap(body,p,.2))
      ||(city.playground&&overlap(body,city.playground,.2))
      ||city.trees.some(t=>overlap(body,{x:t.x,z:t.z,w:t.r*2,d:t.r*2},.5));
  }
  function civicSite(city){
    for(const spot of CIVIC_SPOTS){
      const site=Object.assign({},CIVIC,spot),test=rect(city,site);
      if(!blockedFor(city,test))return Object.assign(site,{x:test.x});
    }
    // Last resort: the corridor always has the office, even if a swapped lot line
    // touches its outer edge, because the ledger counts two river bodies.
    const site=Object.assign({},CIVIC,CIVIC_SPOTS[0]);
    return Object.assign(site,{x:rect(city,site).x});
  }
  function plan(city){
    const stalls=[];
    for(const side of[-1,1]){
      const windows=freeWindows(city,side);
      if(!windows.length)continue;
      const length=windows.reduce((n,w)=>n+w[1]-w[0],0),pitch=length/PER_BANK,placed=[];
      // The two banks run a fraction of a pitch out of step, so the market reads
      // as a woven pair of rows instead of one mirrored colonnade.
      for(let slot=0;slot<PER_BANK;slot++){
        const target=Math.min(length-.01,Math.max(0,(slot+.5)*pitch+side*STAGGER));
        const arc=atArc(windows,target);
        const hot=HOT_SLOTS.indexOf(slot)>=0,pool=hot?HOT:COLD;
        const style=pool[((hot?HOT_SLOTS:COLD_SLOTS).indexOf(slot)+(side>0?1:0))%pool.length];
        // The window already guarantees clearance from every other system. If a
        // lot swap has parked something across this arc position, slide along the
        // same window rather than dropping the plot: 32 counted plots is the
        // promise the ledger's 140 seats are priced off.
        let z=null;
        for(const nudge of [0,pitch*.2,-pitch*.2,pitch*.4,-pitch*.4,pitch*.6,-pitch*.6,pitch*.8,-pitch*.8]){
          const candidate=arc.z+nudge;
          if(candidate<arc.window[0]||candidate>arc.window[1]||Math.abs(candidate)>bankLimit(city))continue;
          if(placed.some(other=>Math.abs(other-candidate)<PLOT.d+.5))continue;
          if(!blockedFor(city,{x:side*PLOT.x,z:candidate,w:PLOT.w,d:PLOT.d})){z=candidate;break;}
        }
        if(z===null)continue;
        placed.push(z);
        stalls.push(Object.assign({id:'stall-'+side+'-'+slot,kind:'stall',height:PLOT.height,side,x:side*PLOT.x,z,w:PLOT.w,d:PLOT.d},style,{hot,seats:hot?SEATS.hot:SEATS.cold,outdoorTable:hot}));
      }
    }
    return stalls;
  }
  function create(T,kit,city){
    const group=new T.Group();group.name='city-waterfront';
    const geometries=[new T.BoxGeometry(1,1,1),new T.SphereGeometry(1,8,6),new T.CylinderGeometry(1,1,1,8)];
    const materials=[],textures=[],meshes=[],batches=new Map();let disposed=false;
    let landscape=root.CityLandscapeAsset || (typeof require==='function'?require('./assets/blender-landscape.js'):null);
    if(!landscape||!landscape.meta||landscape.meta.assetId!=='landscape-miniature-v1'||landscape.meta.schemaVersion!==1)landscape=null;
    const canopyData=landscape&&landscape.modules&&landscape.modules.CanopyStripe;
    let canopyGeometry=null;
    if(canopyData&&Array.isArray(canopyData.position)&&canopyData.position.length&&canopyData.position.length%9===0&&
       Array.isArray(canopyData.normal)&&canopyData.normal.length===canopyData.position.length&&canopyData.position.every(Number.isFinite)&&canopyData.normal.every(Number.isFinite)){
      canopyGeometry=new T.BufferGeometry();
      for(const key of ['position','normal'])canopyGeometry.setAttribute(key,new T.Float32BufferAttribute(canopyData[key],3));
      geometries.push(canopyGeometry);
    }
    const bulbGeometry=new T.IcosahedronGeometry(1,0);geometries.push(bulbGeometry);
    const matrix=new T.Matrix4(),position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3(),color=new T.Color();
    function material(name,hex,roughness=.8){const m=new T.MeshStandardMaterial({color:hex,roughness});m.name=name;materials.push(m);return m;}
    const wood=material('market-timber','#a98361'),frame=material('market-frame','#ede8d8'),fabric=material('market-canvas','#ffffff'),metal=material('market-metal','#536b69',.46),goods=material('market-goods','#ffffff'),paving=material('river-promenade','#e2dcca'),seams=material('promenade-inlay','#c5b9a3');
    // One emissive material carries every lamp part in the module: festoon
    // bulbs, hanging lanterns and the promenade light lines. Bulbs and lanterns
    // keep round lanterns; tiny bulbs use a 20-triangle template to pay for curved canvas.
    let lampLevel=0,marketOpen=true;
    const glow=new T.MeshStandardMaterial({color:'#fff4d8',roughness:.35,emissive:new T.Color('#ffb45e'),emissiveIntensity:0});glow.name='market-lantern';materials.push(glow);
    function part(g,mat,x,y,z,w,h,d,tint,yaw=0){const key=geometries.indexOf(g)+'|'+mat.uuid;if(!batches.has(key))batches.set(key,{geometry:g,material:mat,items:[]});batches.get(key).items.push({x,y,z,w,h,d,tint,yaw});}
    const box=(mat,x,y,z,w,h,d,tint)=>part(geometries[0],mat,x,y,z,w,h,d,tint);
    const ball=(mat,x,y,z,r,tint)=>part(geometries[1],mat,x,y,z,r,r,r,tint);
    // Scaled spheres are ellipses, so these two take semi-axes (half-widths), not
    // diameters: a 1.3-high lantern body is [.65] tall, not 1.3.
    const ell=(mat,x,y,z,rx,ry,rz,tint)=>part(geometries[1],mat,x,y,z,rx,ry,rz,tint);
    const pole=(mat,x,y,z,r,h,tint)=>part(geometries[2],mat,x,y,z,r,h,r,tint);
    // The market slab is the ground the stalls and the promenade share, so where
    // it stops is where the walking model expects bare earth. city-ground paves
    // its own river walk up to bridge `d/2+4` and road `d/2+3.6`, which leaves a
    // 3.6-unit apron either side of every street mouth with nothing under it:
    // this slab has to cover that apron, or a river walker's feet hang 0.25 above
    // an empty cell (the foot/surface QA in tests/place-life.test.cjs is exactly
    // that assertion). So the cuts are the road's own footprint, plus the bridge
    // envelope city-ground already stops paving at -- never wider than that, so
    // the two paved strips meet instead of leaving a seam, and the ramp geometry
    // keeps its clearance because nothing above walking height crosses it.
    // The market's own paving reaches the same stage-0 half-length the plots do.
    const shore=Math.abs(city.water.d)/2-END_INSET,crossings=[];
    city.roads.filter(r=>r.axis==='x').forEach(r=>crossings.push([r.z-r.d/2,r.z+r.d/2]));
    city.bridges.forEach(b=>crossings.push([b.z-(b.d/2+4),b.z+(b.d/2+4)]));
    const spans=[];let cursor=-shore;
    crossings.sort((a,b)=>a[0]-b[0]).concat([[shore+1,shore+2]]).forEach(cut=>{
      if(cut[0]>cursor+.5)spans.push([cursor,Math.min(cut[0],shore)]);
      cursor=Math.max(cursor,cut[1]);
    });
    for(const side of [-1,1])for(const [a,b] of spans){
      const z=(a+b)/2,len=b-a;
      box(paving,side*25.8,.275,z,20.6,.03,len);
      box(seams,side*18.5,.294,z,.22,.009,len);
      box(seams,side*25.8,.294,z,.12,.009,len);
      for(let joint=Math.ceil(a/6)*6;joint<b;joint+=6)box(seams,side*25.8,.294,joint,20.6,.008,.055);
      // Ground light line at the water edge of each span (never above the
      // walking plane, so it stays out of the collision geometry).
      if(len>14)box(glow,side*16.6,.29,z,.16,.05,len-9,'#ffb45e');
    }
    const stalls=(city.waterfront&&city.waterfront.stalls)||plan(city);
    const office=city.waterfront&&city.waterfront.civic||civicSite(city);
    const labelMaterials=new Map(),labelBatches=new Map();
    const signNames=[...new Set(stalls.map(s=>s.name))],atlasColumns=2;
    const atlasRows=Math.pow(2,Math.ceil(Math.log2(Math.max(1,Math.ceil(signNames.length/atlasColumns)))));
    const signsAPI=root.CityFacilities||(typeof require==='function'?require('./city-facilities.js'):null);
    const nightInk=name=>signsAPI?signsAPI.nightSignInk(name):'#edf4fa';
    let officeSignPainter=null,officeSignMode='day',marketSignPainter=null,marketSignMode='day';
    function sign(name,x,z,side,raised){
      if(!root.document)return;
      const market=name!==office.name,key=market?'market-atlas':name;
      if(!labelMaterials.has(key)){
        const canvas=root.document.createElement('canvas');
        canvas.width=market?512*atlasColumns:512;canvas.height=market?128*atlasRows:128;
        const c=canvas.getContext('2d');if(!c)return;
        const repaint=night=>{
          c.shadowBlur=0;
          c.fillStyle=night?'#071820':'#f4efdc';c.fillRect(0,0,canvas.width,canvas.height);
          c.font='600 75px "Microsoft YaHei",sans-serif';c.textAlign='center';c.textBaseline='middle';
          (market?signNames:[name]).forEach((text,i)=>{
            c.fillStyle=night?nightInk(text):'#4c665d';
            c.shadowColor=c.fillStyle;c.shadowBlur=night&&market?6:0;
            c.fillText(text,(i%atlasColumns)*512+256,Math.floor(i/atlasColumns)*128+68);
          });
        };
        repaint(false);
        const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;textures.push(texture);
        if(market)marketSignPainter={texture,repaint};else officeSignPainter={texture,repaint};
        const m=new T.MeshStandardMaterial({map:texture,emissiveMap:texture,roughness:.9,emissive:'#ffffff',emissiveIntensity:0});
        materials.push(m);labelMaterials.set(key,m);
      }
      if(!labelBatches.has(key))labelBatches.set(key,[]);
      labelBatches.get(key).push({name,x,z,side,raised});
    }
    // Every part below is written in plot-local terms: dx runs landward from the
    // plot centre, dz along the bank. The plot rectangle is the reservation the
    // ground furniture, the frontage rings and the walking model give way to, so
    // no raised part may reach past dx 2.80 / dz 3.30 -- the widest are the
    // counter top at 2.75 and the lantern end at 2.85 of its 3.30.
    //
    // A festoon strand: `count` bulbs on a sagging wire along the river edge of
    // the awning, staying inside the plot it belongs to.
    function lampTrain(at,dx,from,to,count,hang,radius,tint){
      const step=(to-from)/(count-1);
      for(let i=0;i<count;i++){
        const dz=from+step*i,y=hang-.42*(1-Math.pow(dz/((to-from)/2||1),2)),p=at(dx,dz);
        part(bulbGeometry,glow,p.x,y,p.z,radius,radius,radius,tint);
        if(i){const q=at(dx,dz-step/2);box(metal,q.x,y+.13,q.z,.07,.07,step*.98,'#3c4a49');}
      }
    }
    // One lantern: red body 1.3 high under a gold cap, a cord up to the canopy's
    // underside at 5.41, and a tassel. `hang` is the centre of the body.
    function lantern(at,dx,dz,hang){
      const p=at(dx,dz);
      ell(glow,p.x,hang,p.z,.5,.65,.5,'#d8483c');
      box(frame,p.x,hang+.74,p.z,.44,.16,.44,'#c8a86a');
      box(metal,p.x,hang+1.215,p.z,.06,.79,.06,'#3c4a49');
      box(wood,p.x,hang-.72,p.z,.13,.34,.13,'#c8a86a');
    }
    // A stool: seat top at 1.35, the height this project's own walkers sit at.
    function stool(at,dx,dz){
      const p=at(dx,dz);
      pole(wood,p.x,1.15,p.z,.34,.4,'#c8b391');
      box(frame,p.x,.95,p.z,.5,.42,.5,'#8c7a63');
    }
    stalls.forEach(s=>{
      const canopy={grill:'#a36f55',hotpot:'#94736b',griddle:'#b39463',dessert:'#7e9388',juice:'#b49b68',deli:'#83938e'}[s.type]||s.color;
      const at=(dx,dz)=>({x:s.x+s.side*dx,z:s.z+dz});
      const b=(mat,dx,y,dz,w,h,d,tint)=>{const p=at(dx,dz);box(mat,p.x,y,p.z,w,h,d,tint);};
      const cyl=(mat,dx,y,dz,r,h,tint)=>{const p=at(dx,dz);pole(mat,p.x,y,p.z,r,h,tint);};
      const puff=(mat,dx,y,dz,rx,ry,rz,tint)=>{const p=at(dx,dz);ell(mat,p.x,y,p.z,rx,ry,rz,tint);};
      // Awning on four posts, striped, with a valance over the river edge.
      for(const dx of [-2.45,2.45])for(const dz of [-2.7,2.7])b(frame,dx,2.93,dz,.15,5.24,.15);
      for(let stripe=0;stripe<8;stripe++){
        const dz=-2.595+stripe*.7417,tint=stripe%2?'#f3ead6':canopy;
        if(canopyGeometry)part(canopyGeometry,fabric,s.x,0,s.z+dz,1,1,1,tint,s.side<0?Math.PI:0);
        else {
          b(fabric,-.05,5.5,dz,5.3,.18,.72,tint);
          b(fabric,-2.55,5.15,dz,.12,.42,.72,tint);
        }
      }

      for(const dx of [-2.42,2.42])b(wood,dx,5.34,0,.12,.14,5.55);
      for(const dz of [-2.7,2.7])b(wood,0,5.34,dz,5,.14,.12);
      // A quiet rim frames the unchanged, readable sign face.
      b(frame,-2.66,4.95,0,.14,.9,5.65);
      b(wood,2.52,2.8,-2.25,.12,2.05,.85,'#506559');
      for(let menu=0;menu<4;menu++)b(goods,2.6,2.2+menu*.33,-2.25,.025,.06,.6,'#f1dfb9');
      if(s.hot){cyl(goods,-1.25,2.18,0,.24,.15,'#e9e1c6');cyl(goods,-.86,2.19,.34,.11,.2,'#f5ead5');}

      // Counter: a timber cabinet for the cold trades, a steel cart for the wok ones.

      // The customer-facing fascia stays continuous while two landward wings
      // leave the real vendor rig a standing bay at dx .95..2.75 / dz .55..2.25.
      b(s.hot?metal:wood,.6,1.25,0,.7,1.9,5.4,s.hot?'#4d6260':undefined);
      b(s.hot?metal:wood,1.8,1.25,-1.075,1.7,1.9,3.25,s.hot?'#4d6260':undefined);
      b(s.hot?metal:wood,1.8,1.25,2.475,1.7,1.9,.45,s.hot?'#4d6260':undefined);
      b(frame,.4,2.29,0,1.1,.16,5.7);
      b(frame,1.85,2.29,-1.15,1.8,.16,3.4);
      b(frame,1.85,2.29,2.55,1.8,.16,.6);

      // Three cabinet panels and a recessed toe rail keep the counter legible.
      for(const dz of [-1.75,0,1.75])b(fabric,.22,1.34,dz,.06,1.5,1.6,s.hot?'#78877e':'#af9272');
      b(wood,.18,.48,0,.08,.22,5.3);
      for(const dz of [-1.75,0,1.75])b(metal,.17,1.8,dz,.08,.08,.48,'#d7d4c5');

      if(s.hot){
        // The cart carries the fire: hot plate, chimney hood and flue stub to the
        // rafters, a pot on the counter and two puffs of steam off it.
        b(metal,.55,2.47,0,.9,.16,4.4,'#6c8381');
        b(frame,1.3,4.62,0,2.2,.5,3.2,'#5d6b64');
        b(metal,2.1,5.12,0,.4,.5,.4,'#4d6260');
        if(s.type==='grill'){
          b(goods,1.3,2.64,-.65,1.85,.18,2.5,'#465650');
          for(let k=0;k<5;k++){
            const dz=-1.55+k*.43;
            b(goods,1.25,2.78,dz,1.9,.055,.06,'#c4a079');
            for(const dx of [.75,1.15,1.55])puff(goods,dx,2.88,dz,.16,.12,.15,k%2?'#b67e54':'#b39160');
          }
        }else if(s.type==='griddle'){
          cyl(goods,1.3,2.63,-.9,.76,.14,'#465650');
          cyl(goods,1.3,2.73,-.9,.62,.06,'#c6a16d');
          b(goods,.55,2.8,-1.75,.85,.06,.10,'#a98e68');
        }else{
          cyl(goods,1.3,2.76,-.9,.6,.42,'#8c5a44');
          puff(goods,1.3,3.19,-.9,.3,.28,.3,'#efe9dd');
          puff(goods,1.15,3.7,-.72,.42,.34,.42,'#efe9dd');
        }

        // Serving bowls sit on a tray beside the cooking zone.
        b(goods,.45,2.59,-.1,.9,.08,1.1,'#87958a');
        for(let k=0;k<3;k++){
          const dz=-.45+k*.35;
          cyl(goods,.55,2.8,dz,.18,.34,'#ede4d1');
          cyl(goods,.55,2.98,dz,.145,.025,'#b98c55');
        }

        // Outdoor table: one round top on a pedestal, five stools around it, set on
        // the riverward third of the plot so the seats look at the water. Five seats
        // x 12 hot plots, plus four bar stools x 20 cold plots = the 140 seats the
        // ledger prices the night market at (§4.5), counted physically not arithmetically.
        cyl(frame,-1.25,1.05,0,.24,1.9);
        cyl(wood,-1.25,2.02,0,.95,.16,'#c99a63');
        for(let k=0;k<5;k++){
          const angle=Math.PI/2+k*Math.PI*2/5;
          stool(at,-1.25+Math.cos(angle)*1.05,Math.sin(angle)*1.55);
        }
      }else{
        for(let k=0;k<4;k++)stool(at,-1.05,(k-1.5)*1.55);   // bar stools at the counter
      }
      if(s.type==='deli'){
        for(const dz of [-1.6,-.4,2.5]){
          b(goods,1.55,2.44,dz,1.9,.08,.55,'#87958a');
          for(let k=0;k<4;k++)puff(goods,.9+k*.35,2.58,dz,.14,.10,.18,k%2?'#a5795f':'#b5a16c');
        }
      }else if(!s.hot){
        // Back-row dispensers and a front serving row read as drinks, not stools.
        const servingZ=[-1.6,-.4,2.5];
        for(let k=0;k<3;k++){
          const dz=servingZ[k],drink=s.type==='juice'?['#bd9660','#a0ac72','#bf8a6d'][k]:['#ccad78','#a47c62','#98a17b'][k];
          cyl(goods,1.9,2.83,dz,.3,.9,drink);
          cyl(goods,1.9,3.31,dz,.32,.06,'#ede4d1');
          b(goods,1.53,2.52,dz,.18,.09,.11,'#596b63');
          cyl(goods,.55,2.61,dz,.19,.46,'#ede4d1');
          cyl(goods,.55,2.86,dz,.155,.025,drink);
        }
        b(goods,.55,2.42,2.55,1.2,.08,.5,'#84917c');
        for(let k=0;k<4;k++)puff(goods,.18+k*.25,2.64,2.55,.13,.17,.14,s.type==='juice'?'#c49a60':'#c6b18c');
      }
      // Lighting on every plot, not just the hot ones: 32 x 2 lanterns, which is
      // what getInfo() reports. The name board sits behind the festoon's end post.
      lampTrain(at,-2.5,-2.5,2.5,7,4.4,.22,'#ffcf87');
      lantern(at,-.15,-2.35,3.8);
      lantern(at,-.15,2.35,3.8);
      sign(s.name,at(-2.75,0).x,s.z,s.side,true);
    });
    // The civic footprint was registered in W1.5b but had never contributed a
    // body to this renderer. Keep its existing corridor envelope and construct
    // the two compact storeys out of the market's shared frame/timber batches.
    const civicMatrices=[];let civicWindows=null,civicLevel=0,civicLit=0;
    if(city.waterfront&&city.waterfront.civic){
    box(frame,office.x,2.9,office.z,office.w-.3,5.2,office.d-.4,'#e1d6bc');
    box(frame,office.x,8.05,office.z,office.w-.3,5.1,office.d-.4,'#e1d6bc');
    box(wood,office.x,5.56,office.z,office.w,.22,office.d,'#879580');
    box(wood,office.x,10.72,office.z,office.w,.28,office.d,'#718778');
    for(let floor=0;floor<2;floor++)for(let col=0;col<4;col++){
      const x=office.x-office.side*(office.w/2-.18),z=office.z+(col-1.5)*3.7,y=3+floor*5.15;
      box(metal,x,y,z,.13,2.8,2.5,'#586b62');
      box(frame,x,y,z,.10,3.12,2.82,'#efe8d8');
      box(frame,x-office.side*.12,y-1.48,z,.38,.16,2.98,'#efe8d8');
      box(metal,x-office.side*.14,y,z,.06,2.8,.105,'#d8d0be');
      position.set(x-office.side*.085,y,z);scale.set(.025,2.6,2.3);rotation.identity();civicMatrices.push(new T.Matrix4().compose(position,rotation,scale));
    }
    sign(office.name,office.x-office.side*(office.w/2-.04),office.z,office.side,false);
    const civicMaterial=new T.MeshStandardMaterial({color:'#ffe1b1',emissive:'#ffd69a',emissiveIntensity:1.35,roughness:.8});
    civicMaterial.name='civic-duty-windows';materials.push(civicMaterial);
    civicWindows=new T.InstancedMesh(geometries[0],civicMaterial,civicMatrices.length);
    civicWindows.name='civic-duty-windows';civicWindows.frustumCulled=false;civicWindows.castShadow=false;
    civicMatrices.forEach((m,i)=>civicWindows.setMatrixAt((i*3)%civicMatrices.length,m));
    civicWindows.count=0;civicWindows.visible=false;group.add(civicWindows);meshes.push(civicWindows);
    }
    batches.forEach(batch=>{
      const mesh=new T.InstancedMesh(batch.geometry,batch.material,batch.items.length);mesh.name=batch.material.name;
      batch.items.forEach((p,i)=>{position.set(p.x,p.y,p.z);scale.set(p.w,p.h,p.d);rotation.setFromAxisAngle(new T.Vector3(0,1,0),p.yaw);matrix.compose(position,rotation,scale);mesh.setMatrixAt(i,matrix);color.set(p.tint||'#ffffff');mesh.setColorAt(i,color);});
      mesh.castShadow=batch.material!==paving&&batch.material!==seams&&batch.material!==glow;mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);meshes.push(mesh);
    });
    labelBatches.forEach((items,key)=>{
      // Bake the same four corners and normals into one atlas batch, retaining
      // each 512x128 sign cell. No extra shader or per-frame geometry work.
      const positions=[],normals=[],uvs=[],indices=[],point=new T.Vector3(),normal=new T.Vector3();
      items.forEach((s,i)=>{
        position.set(s.x,s.raised?4.95:4.25,s.z);
        scale.set(5.4,s.raised?.72:1.15,1);
        rotation.setFromAxisAngle(new T.Vector3(0,1,0),-s.side*Math.PI/2);
        matrix.compose(position,rotation,scale);
        normal.set(0,0,1).applyQuaternion(rotation);
        const cell=key==='market-atlas'?signNames.indexOf(s.name):0;
        const columns=key==='market-atlas'?atlasColumns:1,rows=key==='market-atlas'?atlasRows:1;
        const left=(cell%columns+.5/512)/columns,right=(cell%columns+1-.5/512)/columns;
        const top=1-(Math.floor(cell/columns)+.5/128)/rows,bottom=1-(Math.floor(cell/columns)+1-.5/128)/rows;
        [[-.5,.5],[.5,.5],[-.5,-.5],[.5,-.5]].forEach(v=>{
          point.set(v[0],v[1],0).applyMatrix4(matrix);
          positions.push(point.x,point.y,point.z);normals.push(normal.x,normal.y,normal.z);
        });
        uvs.push(left,top,right,top,left,bottom,right,bottom);
        const base=i*4;indices.push(base,base+2,base+1,base+2,base+3,base+1);
      });
      const geometry=new T.BufferGeometry();geometries.push(geometry);
      geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
      geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
      const mesh=new T.InstancedMesh(geometry,labelMaterials.get(key),1);mesh.name='river-market-signs';
      mesh.setMatrixAt(0,new T.Matrix4());mesh.computeBoundingSphere();group.add(mesh);meshes.push(mesh);
    });
    // Stall light pools. The festoon bulbs and the lanterns are emissive, but a
    // low-poly emissive never brightens what sits around it, so each plot lays
    // two additive decals on the promenade slab: one under the awning, one on
    // the riverward apron where the stools and the queue stand. Same mechanism
    // as city-ground's street-light pools (kit.lightPoolMap, additive, per-frame
    // opacity), lifted to y .33 so it clears the ground light line at .315.
    let poolMat=null,pools=null;
    if(kit&&kit.lightPoolMap){
      poolMat=new T.MeshBasicMaterial({color:'#ffd9a0',map:kit.lightPoolMap,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
      poolMat.name='stall-light-pools';materials.push(poolMat);
      const poolGeometry=new T.PlaneGeometry(1,1);poolGeometry.rotateX(-Math.PI/2);geometries.push(poolGeometry);
      pools=new T.InstancedMesh(poolGeometry,poolMat,stalls.length*2);
      pools.name='stall-light-pools';pools.frustumCulled=false;
      const put=(i,x,z,w,d)=>{position.set(x,.33,z);scale.set(w,1,d);rotation.identity();matrix.compose(position,rotation,scale);pools.setMatrixAt(i,matrix);};
      stalls.forEach((s,i)=>{
        put(i*2,s.x,s.z,4.8,5.8);
        put(i*2+1,s.x-s.side*(3.7),s.z,3.2,4.8);
        // Per-instance tint stays under .65 on purpose: the wash is spill, not the
        // source (tests/public-spaces.test.cjs pins that). Brightness rides the
        // shared opacity below instead.
        color.setRGB(.58,.58,.58);pools.setColorAt(i*2,color);
        color.setRGB(.28,.28,.28);pools.setColorAt(i*2+1,color);
      });
      if(pools.instanceColor)pools.instanceColor.needsUpdate=true;
      pools.instanceMatrix.needsUpdate=true;pools.visible=false;group.add(pools);meshes.push(pools);
    }
    function setTownView(view){
      if(disposed)return;
      const market=view&&view.byBuilding&&view.byBuilding[MARKET_ID],civic=view&&view.byBuilding&&view.byBuilding[office.id];
      lampLevel=market?Math.max(0,Math.min(1,Number(market.lightLevel)||0)):0;glow.emissiveIntensity=1.35*lampLevel;
      marketOpen=Boolean(market&&(market.open===true||(market.open===undefined&&lampLevel>0)));
      meshes.forEach(mesh=>{if(mesh.material===goods)mesh.visible=marketOpen;});
      civicLevel=civic?Math.max(0,Math.min(1,Number(civic.lightLevel)||0)):0;civicLit=Math.ceil(civicLevel*civicMatrices.length);
      if(civicWindows){civicWindows.count=civicLit;civicWindows.visible=civicLit>0;}
      labelMaterials.forEach((m,name)=>{if(name!==office.name){m.emissive.set('#ffffff');m.emissiveIntensity=4.5*lampLevel;}});
    }
    const getInfo=()=>({ready:!disposed,landscapeAssetId:canopyGeometry?landscape.meta.assetId:null,lampLevel,marketOpen,civic:{id:office.id,level:civicLevel,windows:civicMatrices.length,litWindows:civicLit},stalls:stalls.length,vendors:stalls.length,banks:stalls.length?2:0,drawCalls:disposed?0:meshes.length,stallPools:pools&&!disposed?stalls.length*2:0,footprints:stalls.map(s=>({x:s.x,z:s.z,w:s.w,d:s.d,name:s.name})),walkClearWidth:7.6,hot:stalls.filter(s=>s.hot).length,outdoorTables:stalls.filter(s=>s.outdoorTable).length,seats:stalls.reduce((n,s)=>n+s.seats,0),lanterns:stalls.length*2,riverBodies:[MARKET_ID,office.id]});
    function dispose(){if(disposed)return;disposed=true;group.removeFromParent();meshes.forEach(m=>{if(m.isInstancedMesh)m.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());group.clear();}
    return {group,update(time,lighting){if(lighting){
      const occupied=lighting.buildings['c-night-market'];
      const live=occupied&&occupied.awake>0;
      // 灯笼与灯串的亮度（#夜市补光）：夜里 2.6，白天日光下灯箱不发光。
      // 实测 19:00–23:00 恒定满档（lamps=1、live=true），读数见 qa-redesign/probe-market-lighting.cjs。
      glow.emissiveIntensity=lighting.lamps*(live?2.6:.12);
      const nextMarketMode=lighting.lamps>.2?'night':'day';
      if(marketSignPainter&&nextMarketMode!==marketSignMode){
        marketSignMode=nextMarketMode;marketSignPainter.repaint(nextMarketMode==='night');marketSignPainter.texture.needsUpdate=true;
      }
      const officeSign=labelMaterials.get(office.name);
      if(officeSign){
        const nextMode=lighting.lamps>.2?'night':'day';
        if(officeSignPainter&&nextMode!==officeSignMode){officeSignMode=nextMode;officeSignPainter.repaint(nextMode==='night');officeSignPainter.texture.needsUpdate=true;}
        const evening=lighting.minute>=1110&&lighting.minute<1380;
        officeSign.emissiveIntensity=lighting.lamps*(evening?.05:.02);
        officeSign.color.setScalar(nextMode==='night'?(evening?3.5:1.6):1);
      }
      if(pools){poolMat.opacity=lighting.lamps*(live?.92:.05);pools.visible=lighting.lamps>0;}
    }},setTownView,dispose,getInfo};
  }
  return {plan,create,sites,civicSite,PLOT,SEATS,CIVIC};
});
