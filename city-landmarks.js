/* Two compact public places: the ferris wheel with seated fares,
   the monument plaza and the planned balloon carts. */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CityLandmarks = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var TAU = Math.PI * 2, RADIUS = 20, AXLE_Y = 26, WHEEL_YAW = -.66, PERIOD = 180;
  var CityLife = root && root.CityLife || (typeof require === 'function' ? require('./city-life.js') : null);
  // Cabins are sized to carry people (1.45 x the old shell) and the axle is low
  // enough that the lowest cabin's floor sits about a step above the paving, which
  // is what lets riders board from the ground with no raised platform.
  var CABIN_SCALE = 1.45;
  // Balloons breathe on an exact divisor of the wheel period, so the whole park
  // returns to the same state every 180 seconds.
  var BOB_PERIOD = PERIOD / 15, BOB_HEIGHT = .18, BOB_SWAY = .05, SEAT_X = .72 * CABIN_SCALE, SEAT_Y = -2.95 * CABIN_SCALE;
  // Carts stand at least this far from the wheel centre, so no support can reach them.
  var WHEEL_CLEARANCE = 26;
  // Restrained clothing, skin and hair tones; a passenger index, never a random
  // source, decides each fare's colour.
  var CLOTHES = ['#4a738a', '#7b98a8', '#dde4e7', '#32697b', '#9ebbbd', '#b98264', '#b5a06b', '#72846b'];
  var SKINS = ['#e0b48c', '#c98f63', '#f0cbab', '#a9744c'], HAIR = '#40382f';
  var CANOPY_LEADS = ['#e38a77', '#8ebfac'];
  var CART_WOOD = '#aa8060', CART_TOP = '#ede8d9', CART_FRAME = '#e8eef0', CART_WHEEL = '#526c71', CART_STRING = '#7d8488';
  // One seated fare in the cabin's own frame: legs forward on the platform, back
  // against the rear bench. Every part is a box well inside the 2.89 by 2.02 by
  // 2.24 window band, so a figure stays in its cabin at the top and the bottom.
  var SEATED = [
    { dx: -.15, dy: .16, dz: -.29, w: .25, h: .32, d: 1.5, kind: 0 },
    { dx: .15, dy: .16, dz: -.29, w: .25, h: .32, d: 1.5, kind: 0 },
    { dx: 0, dy: .83, dz: .70, w: .66, h: 1.05, d: .42, kind: 0 },
    { dx: -.40, dy: .86, dz: .62, w: .17, h: .72, d: .28, kind: 0 },
    { dx: .40, dy: .86, dz: .62, w: .17, h: .72, d: .28, kind: 0 },
    { dx: 0, dy: 1.52, dz: .70, w: .58, h: .46, d: .54, kind: 1 },
    { dx: 0, dy: 1.74, dz: .70, w: .62, h: .18, d: .58, kind: 2 }
  ];

  var rideSpecs=[
    {kind:'carousel',local:{x:-11,z:6},radius:4.4,height:7.4,base:'CarouselBase',rotor:'CarouselRotor',period:45},
    {kind:'teacups',local:{x:-6.5,z:-15},radius:2.8,height:3.7,base:'TeacupsBase',rotor:'TeacupsRotor',period:30}
  ];
  function validAmusementAsset(asset){
    function sequence(v){return Array.isArray(v)||(ArrayBuffer.isView(v)&&typeof v.length==='number');}
    function finiteSequence(v){if(!sequence(v))return false;for(var i=0;i<v.length;i++)if(!Number.isFinite(v[i]))return false;return true;}
    if(!asset||!asset.meta||asset.meta.assetId!=='amusement-miniature-v1'||asset.meta.schemaVersion!==1||!asset.modules)return false;
    var receipt=asset.meta.sourceGLB,rows=asset.meta.modules;
    if(!receipt||typeof receipt.sha256!=='string'||!/^[a-f0-9]{64}$/i.test(receipt.sha256)||!Number.isInteger(receipt.bytes)||receipt.bytes<=0||
      !Array.isArray(rows)||rows.length!==4||new Set(rows.map(function(row){return row&&row.name;})).size!==4)return false;
    return ['CarouselBase','CarouselRotor','TeacupsBase','TeacupsRotor'].every(function(name,moduleIndex){
      var data=asset.modules[name],spec=rideSpecs[Math.floor(moduleIndex/2)],row=rows.find(function(row){return row&&row.name===name;});
      if(!data||!sequence(data.position)||!data.position.length||data.position.length%3||
        !sequence(data.normal)||data.normal.length!==data.position.length||!sequence(data.color)||data.color.length!==data.position.length||
        !finiteSequence(data.position)||!finiteSequence(data.normal)||!finiteSequence(data.color)||!data.color.every(function(v){return Number.isFinite(v)&&v>=0&&v<=1;}))return false;
      var count=data.position.length/3,indices=data.index||Array.from({length:count},function(_,i){return i;});
      if(!finiteSequence(indices)||!indices.length||indices.length%3||!indices.every(function(i){return Number.isInteger(i)&&i>=0&&i<count;}))return false;
      if(!row||row.triangles!==indices.length/3||!row.bounds||!Array.isArray(row.bounds.min)||!Array.isArray(row.bounds.max)||
        row.bounds.min.length!==3||row.bounds.max.length!==3||!finiteSequence(row.bounds.min)||!finiteSequence(row.bounds.max))return false;
      var minimum=[Infinity,Infinity,Infinity],maximum=[-Infinity,-Infinity,-Infinity];
      for(var v=0;v<count;v++){
        var at=v*3,x=data.position[at],y=data.position[at+1],z=data.position[at+2];
        var length=Math.hypot(data.normal[at],data.normal[at+1],data.normal[at+2]);
        for(var axis=0;axis<3;axis++){minimum[axis]=Math.min(minimum[axis],data.position[at+axis]);maximum[axis]=Math.max(maximum[axis],data.position[at+axis]);}
        if(Math.hypot(x,z)>spec.radius+.002||y<-.002||y>spec.height+.002||Math.abs(length-1)>.02)return false;
      }
      if(minimum.some(function(v,i){return Math.abs(v-row.bounds.min[i])>.002||Math.abs(maximum[i]-row.bounds.max[i])>.002;}))return false;
      for(var t=0;t<indices.length;t+=3){
        var a=indices[t]*3,b=indices[t+1]*3,c=indices[t+2]*3;
        var ux=data.position[b]-data.position[a],uy=data.position[b+1]-data.position[a+1],uz=data.position[b+2]-data.position[a+2];
        var vx=data.position[c]-data.position[a],vy=data.position[c+1]-data.position[a+1],vz=data.position[c+2]-data.position[a+2];
        if(Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)<1e-9)return false;
      }
      return true;
    });
  }

  // Shared read-only presentation policy for WebGL and Canvas.
  function amusementLighting(time, lighting, view) {
    var row=lighting&&lighting.buildings&&lighting.buildings['c-amusement'];
    var minute=lighting&&Number.isFinite(lighting.minute)?lighting.minute:view&&Number.isFinite(view.minute)?view.minute:720;
    minute=((minute%1440)+1440)%1440;
    var lamps=lighting&&Number.isFinite(lighting.lamps)?Math.max(0,Math.min(1,lighting.lamps)):view?(minute>=1110||minute<360?1:0):0;
    var viewRow=view&&(!Number.isFinite(view.minute)||((view.minute%1440)+1440)%1440===minute)&&view.byBuilding&&view.byBuilding['c-amusement'];
    var open=!!(viewRow?viewRow.open:row&&row.open);
    var decoration=row&&Number.isFinite(row.decoration)?Math.max(0,Math.min(1,row.decoration)):lamps*(minute>=1080&&minute<1350?.5:0);
    decoration=minute>=1080&&minute<1350?Math.min(lamps,decoration):0;
    var evening=minute>=1080&&minute<1350,operating=open&&lamps>0&&evening;
    var phase=((Number.isFinite(time)?time:0)%PERIOD+PERIOD)%PERIOD/PERIOD*TAU;
    return {lamps:lamps,open:open,decoration:decoration,operating:operating,
      pathIntensity:lamps*(operating?1:decoration>0?.9:.18),outlineIntensity:operating?lamps:Math.min(lamps,decoration*1.7),
      cabinIntensity:operating?lamps*.95:Math.min(lamps,decoration*1.5),
      phase:phase,chasePhase:operating?phase*4:0};
  }
  function create(THREE, kit, city) {
    kit = kit || {};
    var group = new THREE.Group(); group.name = 'city-landmarks';
    var ownedGeometries = [], ownedMaterials = [], ownedTextures = [], meshes = [], cabinBatches = [];
    var wheel = null, amusement = null, plaza = null, disposed = false, lastTime = null, angle = 0;
    var station = null, stationParts = [], cabinPositions = [], passengerPositions = [], drawCalls = 0, triangles = 0, doorLeafL = null, doorLeafR = null, doorOpen = [];
    // The boarding plan is public-space data like the balloon stands: without it the park
    // is built exactly as before, so an older fixture keeps its own batches and signs.
    var fareBatch = null, fareParts = [], cartBatch = null, balloonBatch = null, balloonParts = [], drawnStands = [];
    var passengerCount = 24;
    // 亮化第三批（#10/#11）：广场泛光池与草坪灯头、摩天轮彩灯批。声明在 create
    // 作用域，amusementPark/monumentPlaza 里赋值，setTownView 驱动。
    var plazaFlood = null, plazaFloodMesh = null, plazaLampHeads = null, bulbMesh = null, bulbMaterial = null, amusementOpen = false;
    var pathLightMesh=null,pathPoolMesh=null,cabinLightMesh=null;
    var currentTownView=null,currentLighting=null,parkLighting=amusementLighting(0,null,null);
    var rideRecords=[],rideMaterial=null,lightPhase={value:0},decorationRatio={value:0};
    var suppliedAsset=!!(root&&Object.prototype.hasOwnProperty.call(root,'CityAmusementAsset')),amusementAsset=root&&root.CityAmusementAsset;
    if(!suppliedAsset&&typeof require==='function'){try{amusementAsset=require('./assets/blender-amusement.js');}catch(_){amusementAsset=null;}}
    if(!validAmusementAsset(amusementAsset))amusementAsset=null;
    var landscape = root && root.CityLandscapeAsset || (typeof require === 'function' ? require('./assets/blender-landscape.js') : null);
    if (!landscape || !landscape.meta || landscape.meta.assetId !== 'landscape-miniature-v1' || landscape.meta.schemaVersion !== 1) landscape = null;
    var landscapeGeometry = {};
    function authored(name) {
      var data = landscape && landscape.modules && landscape.modules[name];
      if (!data || !Array.isArray(data.position) || !data.position.length || data.position.length % 9 ||
          !Array.isArray(data.normal) || data.normal.length !== data.position.length ||
          !Array.isArray(data.color) || data.color.length !== data.position.length || !data.position.every(Number.isFinite) ||
          !data.normal.every(Number.isFinite) || !data.color.every(Number.isFinite)) return null;
      if (landscapeGeometry[name]) return landscapeGeometry[name];
      var geometry = new THREE.BufferGeometry();
      ['position', 'normal', 'color'].forEach(function (key) { geometry.setAttribute(key, new THREE.Float32BufferAttribute(data[key], 3)); });
      ownedGeometries.push(geometry); landscapeGeometry[name] = geometry; return geometry;
    }
    var monumentGeometry = authored('Monument'), benchGeometry = authored('Bench'), planterGeometry = authored('Planter');
    var refinedPlaza = !!(monumentGeometry && benchGeometry && planterGeometry);
    // The unit box stays owned because the instanced fare, cart and string batches
    // below keep it as their live template; the other two are merge-only sources.
    var boxGeometry = new THREE.BoxGeometry(1, 1, 1); ownedGeometries.push(boxGeometry);
    var cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 12);
    var sphereGeometry = new THREE.IcosahedronGeometry(1, 1);
    var matrix = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3();
    var position = new THREE.Vector3(), scale = new THREE.Vector3(), quaternion = new THREE.Quaternion();
    var vertex = new THREE.Vector3(), normal = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

    function material(name, color, base, parameters) {
      var result = base ? base.clone() : new THREE.MeshStandardMaterial();
      result.name = 'landmark-' + name; result.color.set(color);
      Object.assign(result, { roughness: .72, metalness: .03 }, parameters || {});
      ownedMaterials.push(result); return result;
    }
    var landscapeMaterial = material('blender-landscape', '#ffffff', null, { vertexColors: true, roughness: .7, metalness: .12 });
    var paving = material('paving', '#ded8cb', kit.pavement, { roughness: .94 });
    var pale = material('ivory-stone', '#eee8d9', kit.stone, { roughness: .83 });
    var stone = material('monument-stone', '#c5c1b5', kit.stone, { roughness: .68 });
    var silver = material('silver-frame', '#e8e1d5', kit.metal, { roughness: .48, metalness: .38 });
    var gold = material('warm-metal', '#b99a68', kit.metal, { roughness: .37, metalness: .58 });
    var dark = material('slate', '#526c71', null, { roughness: .66 });
    var wood = material('bench-wood', '#aa8060', null, { roughness: .89 });
    var foliage = material('planting', '#789181', kit.grass, { roughness: .96 });
    var soil = material('soil', '#77695b', null, { roughness: 1 });
    var colors = ['#e38a77', '#e9c768', '#8ebfac'];
    var shells = colors.map(function (color, index) { return material('cabin-shell-' + index, color, null, { roughness: .42, metalness: .12 }); });
    var cabinPaint = material('cabin-paint', '#ffffff', null, { roughness: .42, metalness: .12 });
    var glazing = material('cabin-glass', '#ffffff', kit.glass,
      { roughness: .16, metalness: .12, transparent: true, opacity: .58, depthWrite: false, transmission: 0 });
    // A lit window band reveals the warm cabin interior; keep the original glass and paint.
    glazing.emissive.set('#ffdcab'); glazing.emissiveIntensity=0;
    // Fares, cart parts and balloon strings share one painted material: every part
    // is tinted per instance, so a whole figure or cart costs a single draw call.
    var paint = material('accent-paint', '#ffffff', null, { roughness: .58, metalness: .04 });
    var latex = material('balloon-latex', '#ffffff', null, { roughness: .4, metalness: .06 });

    // Static details merge once by material. Cabin templates are instanced across
    // all twelve positions, so window frames do not become individual draw calls.
    function append(parts, geometry, mat, transform, casts) {
      var key = mat.uuid + '/' + (casts !== false);
      if (!parts.has(key)) parts.set(key, { material: mat, casts: casts !== false, positions: [], normals: [], uvs: [], colors: [] });
      var batch = parts.get(key), points = geometry.getAttribute('position');
      var normals = geometry.getAttribute('normal'), uvs = geometry.getAttribute('uv'), colors = geometry.getAttribute('color');
      var index = geometry.index, count = index ? index.count : points.count;
      normalMatrix.getNormalMatrix(transform);
      for (var i = 0; i < count; i++) {
        var at = index ? index.getX(i) : i;
        vertex.fromBufferAttribute(points, at).applyMatrix4(transform);
        batch.positions.push(vertex.x, vertex.y, vertex.z);
        normal.fromBufferAttribute(normals, at).applyMatrix3(normalMatrix).normalize();
        batch.normals.push(normal.x, normal.y, normal.z);
        if (mat.vertexColors) batch.colors.push(colors ? colors.getX(at) : 1, colors ? colors.getY(at) : 1, colors ? colors.getZ(at) : 1);
        batch.uvs.push(uvs ? uvs.getX(at) : 0, uvs ? uvs.getY(at) : 0);
      }
    }
    function part(parts, geometry, mat, x, y, z, sx, sy, sz, rx, ry, rz, casts) {
      position.set(x, y, z); scale.set(sx, sy, sz);
      quaternion.setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0));
      matrix.compose(position, quaternion, scale); append(parts, geometry, mat, matrix, casts);
    }
    function box(parts, mat, x, y, z, w, h, d, yaw, casts) {
      part(parts, boxGeometry, mat, x, y, z, w, h, d, 0, yaw || 0, 0, casts);
    }
    function cylinder(parts, mat, x, y, z, radius, h, casts) {
      part(parts, cylinderGeometry, mat, x, y, z, radius, h, radius, 0, 0, 0, casts);
    }
    function rod(parts, mat, a, b, radius, geometry) {
      var start = new THREE.Vector3(a[0], a[1], a[2]), end = new THREE.Vector3(b[0], b[1], b[2]);
      var direction = end.clone().sub(start), length = direction.length();
      position.copy(start).add(end).multiplyScalar(.5); scale.set(radius, length, radius);
      quaternion.setFromUnitVectors(up, direction.normalize()); matrix.compose(position, quaternion, scale);
      append(parts, geometry || cylinderGeometry, mat, matrix, true);
    }
    function ring(parts, mat, inner, outer, y) {
      var geometry = new THREE.RingGeometry(inner, outer, 96);
      part(parts, geometry, mat, 0, y, 0, 1, 1, 1, -Math.PI / 2, 0, 0, false); geometry.dispose();
    }
    function bake(batch) {
      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(batch.positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(batch.normals, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(batch.uvs, 2));
      if (batch.colors.length) geometry.setAttribute('color', new THREE.Float32BufferAttribute(batch.colors, 3));
      geometry.computeBoundingBox(); geometry.computeBoundingSphere(); ownedGeometries.push(geometry);
      return geometry;
    }
    function flush(parts, parent, prefix) {
      parts.forEach(function (batch) {
        var mesh = new THREE.InstancedMesh(bake(batch), batch.material, 1);
        mesh.name = prefix + '-' + batch.material.name; mesh.castShadow = batch.casts; mesh.receiveShadow = true;
        parent.add(mesh); meshes.push(mesh);
      });
    }
    function sign(parent, text, x, y, z, w, h, ink, background, name) {
      if (!root.document || typeof root.document.createElement !== 'function') return;
      var canvas = root.document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
      var context = canvas.getContext('2d'); if (!context) return;
      context.fillStyle = background; context.fillRect(0, 0, 1024, 256);
      context.fillStyle = ink; context.textAlign = 'center'; context.textBaseline = 'middle';
      context.font = '600 154px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
      context.fillText(text, 512, 132);
      var texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      texture.name = name; ownedTextures.push(texture);
      var mat = new THREE.MeshStandardMaterial({ map: texture, roughness: .75, metalness: .02 });
      mat.name = name; ownedMaterials.push(mat);
      var geometry = new THREE.PlaneGeometry(w, h); ownedGeometries.push(geometry);
      var mesh = new THREE.InstancedMesh(geometry, mat, 1); mesh.name = name; mesh.position.set(x, y, z);
      parent.add(mesh); meshes.push(mesh);
    }
    function bench(parts, x, z, yaw) {
      function plank(mat, dx, y, dz, w, h, d) {
        box(parts, mat, x + dx * Math.cos(yaw) + dz * Math.sin(yaw), y,
          z - dx * Math.sin(yaw) + dz * Math.cos(yaw), w, h, d, yaw);
      }
      [-1, 1].forEach(function (side) {
        plank(dark, side * 1.7, .65, 0, .28, .75, 1.15);
        plank(dark, side * 1.7, 1.16, -.48, .16, 1.55, .16);
      });
      for (var slat = 0; slat < 3; slat++) plank(wood, 0, 1.05, (slat - 1) * .36, 4.6, .16, .28);
      plank(wood, 0, 1.68, -.48, 4.6, .46, .16);
    }
    function planter(parts, x, z, size) {
      cylinder(parts, pale, x, .59, z, size, .64);
      cylinder(parts, soil, x, .93, z, size - .2, .1);
      for (var i = 0; i < 7; i++) {
        var phase = i * TAU / 7, px = x + Math.cos(phase) * size * .5, pz = z + Math.sin(phase) * size * .5;
        part(parts, sphereGeometry, foliage, px, 1.13, pz, size * .49, .5, size * .49);
        part(parts, sphereGeometry, shells[i % 3], px, 1.53, pz, .23, .16, .23);
      }
    }
    function luminousMaterial(name,color){
      var mat=new THREE.MeshBasicMaterial({color:color||'#ffffff',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false});
      mat.name=name;ownedMaterials.push(mat);return mat;
    }
    function luminousMesh(parts,parent,name,mat){
      var mesh=new THREE.Mesh(bake(parts.values().next().value),mat);mesh.name=name;mesh.visible=false;
      mesh.castShadow=false;mesh.receiveShadow=false;parent.add(mesh);meshes.push(mesh);return mesh;
    }
    function rideGeometry(name){
      var data=amusementAsset.modules[name],geometry=new THREE.BufferGeometry();
      ['position','normal','color'].forEach(function(key){geometry.setAttribute(key,new THREE.Float32BufferAttribute(data[key],3));});
      if(data.index)geometry.setIndex(Array.from(data.index));
      geometry.computeBoundingBox();geometry.computeBoundingSphere();ownedGeometries.push(geometry);return geometry;
    }
    function rides(parent){
      if(!amusementAsset)return;
      rideMaterial=material('amusement-rides','#ffffff',null,{vertexColors:true,roughness:.72,metalness:.06,emissive:new THREE.Color('#c7a679'),emissiveIntensity:0});
      var bases=new Map();
      rideSpecs.forEach(function(spec){
        part(bases,rideGeometry(spec.base),rideMaterial,spec.local.x,.30,spec.local.z,1,1,1);
        var rotor=new THREE.InstancedMesh(rideGeometry(spec.rotor),rideMaterial,1);rotor.name='amusement-'+spec.kind+'-rotor';
        rotor.position.set(spec.local.x,.30,spec.local.z);rotor.castShadow=true;rotor.receiveShadow=true;
        parent.add(rotor);meshes.push(rotor);rideRecords.push({spec:spec,mesh:rotor,angle:0});
      });
      var base=new THREE.InstancedMesh(bake(bases.values().next().value),rideMaterial,1);base.name='amusement-rides-base';
      base.castShadow=true;base.receiveShadow=true;parent.add(base);meshes.push(base);
    }
    function parkLights(parent,structures){
      var lamps=[[-18,8],[18,-8],[-18,-18],[18,18],[-6.8,22],[6.8,22]],heads=new Map();
      var glow=luminousMaterial('amusement-path-glow','#ffdfab');
      lamps.forEach(function(lamp){
        box(structures,silver,lamp[0],1.68,lamp[1],.13,2.76,.13);
        box(structures,pale,lamp[0],3.1,lamp[1],.56,.48,.56);
        box(heads,glow,lamp[0],3.12,lamp[1],.585,.36,.585,0,false);
      });
      box(heads,glow,0,4.43,20.8,12.2,.13,.7,0,false);
      box(heads,glow,-13.8,5.32,17.3,5.8,.09,5.7,0,false);
      var decorationStart=heads.values().next().value.positions.length/3;
      if(amusementAsset){
        // Thin vertical bands stand just outside the authored fascia and plinth;
        // a horizontal annulus at these heights would disappear inside them.
        var band=new THREE.CylinderGeometry(4.22,4.22,.14,32,1,true);
        part(heads,band,glow,-11,5.9,6,1,1,1,0,0,0,false);band.dispose();
        var tea=new THREE.CylinderGeometry(2.76,2.76,.1,24,1,true);
        part(heads,tea,glow,-6.5,.4,-15,1,1,1,0,0,0,false);tea.dispose();
      }
      pathLightMesh=luminousMesh(heads,parent,'amusement-path-lights',glow);
      // Ride trims use the decoration channel within the same draw call. Deep
      // night keeps only the path lamps; no geometry or material batch is added.
      var decorationMask=new Float32Array(pathLightMesh.geometry.getAttribute('position').count);
      decorationMask.fill(1,decorationStart);
      pathLightMesh.geometry.setAttribute('amusementDecoration',new THREE.BufferAttribute(decorationMask,1));
      glow.onBeforeCompile=function(shader){
        shader.uniforms.amusementDecorationRatio=decorationRatio;
        shader.vertexShader='attribute float amusementDecoration; varying float vAmusementDecoration;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvAmusementDecoration=amusementDecoration;');
        shader.fragmentShader='uniform float amusementDecorationRatio; varying float vAmusementDecoration;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= mix(1.0,amusementDecorationRatio,vAmusementDecoration);');
      };
      glow.customProgramCacheKey=function(){return 'amusement-path-decoration-v1';};
      var poolMap=kit.lightPoolMap;
      if(!poolMap){
        var data=new Uint8Array(16*16*4);
        for(var py=0;py<16;py++)for(var px=0;px<16;px++){
          var k=(py*16+px)*4,d=Math.hypot((px-7.5)/7.5,(py-7.5)/7.5);
          data[k]=data[k+1]=data[k+2]=255;data[k+3]=Math.round(255*Math.pow(Math.max(0,1-d),1.6));
        }
        poolMap=new THREE.DataTexture(data,16,16);poolMap.needsUpdate=true;ownedTextures.push(poolMap);
      }
      var poolMat=luminousMaterial('amusement-path-pools','#ffd19a');poolMat.map=poolMap;poolMat.blending=THREE.AdditiveBlending;
      var poolParts=new Map(),plane=new THREE.PlaneGeometry(1,1);
      lamps.concat([[0,20],[-11,6],[-6.5,-15]]).forEach(function(lamp,i){
        part(poolParts,plane,poolMat,lamp[0],.318+i*.0002,lamp[1],i<6?10.5:15,i<6?9.5:12,1,-Math.PI/2,0,0,false);
      });
      plane.dispose();pathPoolMesh=luminousMesh(poolParts,parent,'amusement-light-pools',poolMat);
    }
    function ferrisLights(rotor){
      // Continuous strips replace sparse spheres; two faces keep distant views readable.
      bulbMaterial=luminousMaterial('ferris-rim-bulbs','#ffffff');bulbMaterial.vertexColors=true;
      var points=[],normals=[],colors=[],phases=[],tint=new THREE.Color();
      function triangle(a,b,c,color){tint.set(color);[a,b,c].forEach(function(p){
        points.push(p[0],p[1],p[2]);normals.push(0,0,1);colors.push(tint.r,tint.g,tint.b);
        phases.push(Math.atan2(p[1],p[0])*3+Math.hypot(p[0],p[1])*.08);
      });}
      function quad(a,b,c,d,color){triangle(a,b,c,color);triangle(a,c,d,color);}
      [-2.16,2.16].forEach(function(z){
        for(var i=0;i<64;i++){
          var a=i*TAU/64,b=(i+1)*TAU/64,inner=19.81,outer=20.19;
          quad([Math.cos(a)*inner,Math.sin(a)*inner,z],[Math.cos(a)*outer,Math.sin(a)*outer,z],
            [Math.cos(b)*outer,Math.sin(b)*outer,z],[Math.cos(b)*inner,Math.sin(b)*inner,z],i%16<8?'#ffe1a3':'#edaf98');
        }
        for(var spoke=0;spoke<8;spoke++){
          var a=spoke*TAU/8,c=Math.cos(a),s=Math.sin(a),w=.14;
          quad([c*1.8-s*w,s*1.8+c*w,z],[c*19.81-s*w,s*19.81+c*w,z],
            [c*19.81+s*w,s*19.81-c*w,z],[c*1.8+s*w,s*1.8-c*w,z],spoke%2?'#a8d9c1':'#ffe1a3');
        }
        // The axle passes through the centre, so a visible hub light is an
        // annulus outside its 1.45-radius cap, never a disk hidden behind it.
        for(var hub=0;hub<24;hub++){
          var a=hub*TAU/24,b=(hub+1)*TAU/24;
          quad([Math.cos(a)*1.5,Math.sin(a)*1.5,z],[Math.cos(a)*1.8,Math.sin(a)*1.8,z],
            [Math.cos(b)*1.8,Math.sin(b)*1.8,z],[Math.cos(b)*1.5,Math.sin(b)*1.5,z],'#fff0cd');
        }
      });
      var geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
      geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
      geo.setAttribute('amusementArc',new THREE.Float32BufferAttribute(phases,1));geo.computeBoundingBox();geo.computeBoundingSphere();ownedGeometries.push(geo);
      bulbMaterial.onBeforeCompile=function(shader){
        shader.uniforms.amusementPhase=lightPhase;
        shader.vertexShader='attribute float amusementArc; varying float vAmusementPhase;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvAmusementPhase=amusementArc;');
        shader.fragmentShader='uniform float amusementPhase; varying float vAmusementPhase;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb *= .78 + .22 * (.5 + .5 * sin(vAmusementPhase-amusementPhase));');
      };
      bulbMaterial.customProgramCacheKey=function(){return 'amusement-soft-chase-v1';};
      bulbMesh=new THREE.Mesh(geo,bulbMaterial);bulbMesh.name='ferris-rim-bulbs';bulbMesh.visible=false;rotor.add(bulbMesh);meshes.push(bulbMesh);
    }
    function refreshParkLighting(time){
      parkLighting=amusementLighting(time,currentLighting,currentTownView);lightPhase.value=parkLighting.chasePhase;
      decorationRatio.value=parkLighting.pathIntensity>0?parkLighting.outlineIntensity/parkLighting.pathIntensity:0;
      if(bulbMesh){bulbMesh.visible=parkLighting.outlineIntensity>0;bulbMaterial.opacity=parkLighting.outlineIntensity;}
      if(cabinLightMesh){cabinLightMesh.visible=parkLighting.cabinIntensity>0;cabinLightMesh.material.opacity=parkLighting.cabinIntensity;}
      glazing.emissiveIntensity=parkLighting.cabinIntensity*1.15;
      if(pathLightMesh){pathLightMesh.visible=parkLighting.pathIntensity>0;pathLightMesh.material.opacity=parkLighting.pathIntensity;}
      if(pathPoolMesh){pathPoolMesh.visible=parkLighting.pathIntensity>0;pathPoolMesh.material.opacity=parkLighting.pathIntensity*(parkLighting.operating||parkLighting.decoration>0?.82:.55);}
      if(rideMaterial)rideMaterial.emissiveIntensity=parkLighting.outlineIntensity*.38;
    }
    function siteGroup(site) {
      var parent = new THREE.Group(); parent.name = 'landmark-site-' + site.kind;
      parent.position.set(site.x, 0, site.z); parent.userData.kind = site.kind;
      parent.userData.site = Object.assign({}, site); group.add(parent); return parent;
    }
    function amusementPark(site) {
      amusement = Object.assign({}, site);
      var parent = siteGroup(site), ground = new Map(), structures = new Map();
      box(ground, paving, 0, .23, 0, site.w - .6, .08, site.d - .6, 0, false);
      ring(ground, pale, 0, 20.2, .282);
      ring(ground, shells[2], 19.78, 20.12, .291);
      ring(ground, gold, 17.6, 17.74, .293);
      ring(ground, paving, 5.8, 6.15, .294);
      [-1, 1].forEach(function (side) {
        for (var dot = 0; dot < 5; dot++) {
          cylinder(ground, shells[dot % 3], side * (7 + dot * 1.45), .298, 13.6, .36, .016, false);
        }
      });
      // The boarding station shares these two batches, so a plan adds no batch of its
      // own in a headless build; in the page it adds the one sign mesh.
      flush(ground, parent, 'amusement-paving');

      // Gate, ticket booth and fences stay inside the 2.8-unit perimeter paths.
      [-1, 1].forEach(function (side) {
        box(structures, pale, side * 6, 2.54, 20.8, .7, 4.55, .7);
        for (var post = 0; post < 8; post++) cylinder(structures, silver, side * 19.4, 1.13, -20.2 + post * 5.9, .1, 1.7);
        [1, 1.78].forEach(function (y) {
          rod(structures, silver, [side * 19.4, y, -20.2], [side * 19.4, y, 21.1], .065);
          rod(structures, silver, [side * 6.4, y, 21.1], [side * 19.4, y, 21.1], .065);
        });
      });
      box(structures, shells[2], 0, 4.77, 20.8, 13.1, .62, .8);
      for (var rear = 0; rear < 9; rear++) cylinder(structures, silver, -19.4 + rear * 4.85, 1.13, -20.2, .1, 1.7);
      [1, 1.78].forEach(function (y) { rod(structures, silver, [-19.4, y, -20.2], [19.4, y, -20.2], .065); });
      box(structures, pale, -13.8, 2.7, 17.3, 5.4, 4.85, 5.3);
      box(structures, shells[0], -13.8, 5.19, 17.3, 6, .22, 5.9);
      box(structures, dark, -13.8, 3.1, 19.98, 4.15, 2.05, .08);
      box(structures, gold, -13.8, 2.05, 20.22, 4.4, .16, .6);
      box(structures, silver, -13.8, 3.1, 20.04, .1, 2.06, .06);
      bench(structures, 12.6, 17, 0);
      planter(structures, -14.3, -14.7, 2.1); planter(structures, 14.3, -14.7, 2.1);
      rides(parent);parkLights(parent,structures);
      flush(structures, parent, 'amusement-details');
      sign(parent, '星光乐园', 0, 4.78, 21.215, 9.8, .5, '#38524b', '#8ebfac', 'landmark-sign-amusement');

      var mechanism = new THREE.Group(); mechanism.name = 'ferris-mechanism'; mechanism.rotation.y = WHEEL_YAW; parent.add(mechanism);
      // Both A frames are one template instanced into the front and rear depth
      // planes, so the pair still costs a single draw call and stays clear of the
      // full upright cabin depth.
      var supports = new Map();
      rod(supports, silver, [-9.2, .8, -4.3], [0, AXLE_Y, -4.3], .43);
      rod(supports, silver, [9.2, .8, -4.3], [0, AXLE_Y, -4.3], .43);
      rod(supports, silver, [-6.8, 8.4, -4.3], [6.8, 8.4, -4.3], .24);
      [-1, 1].forEach(function (foot) { box(supports, silver, foot * 9.2, .56, -4.3, 2.05, .62, 1.8); });
      var frames = new THREE.InstancedMesh(bake(supports.values().next().value), silver, 2);
      frames.name = 'ferris-support-frames';
      for (var frame = 0; frame < 2; frame++) { matrix.makeTranslation(0, 0, frame * 8.6); frames.setMatrixAt(frame, matrix); }
      frames.castShadow = true; frames.receiveShadow = true;
      mechanism.add(frames); meshes.push(frames);
      var axle = new Map();
      rod(axle, gold, [0, AXLE_Y, -4.8], [0, AXLE_Y, 4.8], .74);
      flush(axle, mechanism, 'ferris-axle');
      wheel = new THREE.Group(); wheel.name = 'ferris-rotor'; wheel.position.y = AXLE_Y; mechanism.add(wheel);
      var rotor = new Map(), rim = new THREE.TorusGeometry(RADIUS, .31, 6, 96);
      // Thin spokes need eight radial sides, while the silhouette rims retain
      // their original 96-segment arcs. This saves 768 hidden-side triangles.
      var spokeGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
      [-1, 1].forEach(function (side) {
        part(rotor, rim, silver, 0, 0, side * 1.78, 1, 1, 1);
        for (var spoke = 0; spoke < 24; spoke++) {
          var phase = spoke * TAU / 24;
          rod(rotor, silver, [0, 0, side * 1.78], [Math.cos(phase) * RADIUS, Math.sin(phase) * RADIUS, side * 1.78], spoke % 2 ? .095 : .14, spokeGeometry);
        }
      });
      rim.dispose(); spokeGeometry.dispose();
      for (var join = 0; join < 12; join++) {
        var theta = join * TAU / 12, px = Math.cos(theta) * RADIUS, py = Math.sin(theta) * RADIUS;
        rod(rotor, silver, [px, py, -1.78], [px, py, 1.78], .16);
      }
      part(rotor, cylinderGeometry, gold, 0, 0, 0, 1.45, 3.9, 1.45, Math.PI / 2);
      flush(rotor, wheel, 'ferris-wheel');

      ferrisLights(wheel);

      var cabinFrame = new Map(), cabinShell = new Map(), cabinGlass = new Map();
      box(cabinFrame, silver, 0, -.43, 0, .22, .86, .22);
      box(cabinFrame, silver, 0, -3.97, 0, 3.24, .17, 2.68);
      [-1, 1].forEach(function (x) { [-1, 1].forEach(function (z) {
        box(cabinFrame, silver, x * 1.49, -2.45, z * 1.16, .12, 2.95, .12);
      }); });
      [-1, 1].forEach(function (z) {
        box(cabinFrame, silver, 0, -1.02, z * 1.18, 3.14, .14, .12);
        box(cabinFrame, silver, 0, -2.84, z * 1.18, 3.14, .1, .12);
        box(cabinFrame, silver, 0, -2.02, z * 1.21, .1, 1.55, .1);
        box(cabinFrame, silver, 0, -3.27, z * .76, 2.65, .16, .52);
      });
      box(cabinShell, cabinPaint, 0, -.9, 0, 3.28, .24, 2.72);
      box(cabinShell, cabinPaint, 0, -3.43, 0, 3.15, .96, 2.58);
      box(cabinGlass, glazing, 0, -2.04, 0, 2.89, 2.02, 2.24);
      function cabinInstances(parts, name, mat, tinted) {
        var batch = parts.values().next().value, geometry = bake(batch);
        geometry.scale(CABIN_SCALE, CABIN_SCALE, CABIN_SCALE);
        var ids = [], mesh = new THREE.InstancedMesh(geometry, mat, 12);
        mesh.name = 'ferris-cabin-' + name;
        for (var id = 0; id < 12; id++) {
          ids.push(id);
          if (tinted) mesh.setColorAt(id, new THREE.Color(colors[id % 3]));
        }
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.castShadow = name !== 'glass'; mesh.receiveShadow = true;
        // Bounds are refreshed after absolute transforms, with no clock accumulation.
        mechanism.add(mesh); meshes.push(mesh); cabinBatches.push({ mesh: mesh, ids: ids });
      }
      cabinInstances(cabinFrame, 'frames', silver, false);
      cabinInstances(cabinShell, 'shells', cabinPaint, true);
      cabinInstances(cabinGlass, 'glass', glazing, true);
      var cabinLamps=new Map(),cabinGlow=luminousMaterial('ferris-cabin-warmth','#ffe3b3'),lampPlane=new THREE.PlaneGeometry(1,1);
      [-1,1].forEach(function(side){
        part(cabinLamps,lampPlane,cabinGlow,0,-.72,side*1.365,3.14,.20,1,0,side<0?Math.PI:0,0,false);
        part(cabinLamps,lampPlane,cabinGlow,side*1.635,-.72,0,2.7,.20,1,0,side*Math.PI/2,0,false);
      });
      // The ceiling light sits below the roof and shares the existing twelve-instance batch.
      part(cabinLamps,lampPlane,cabinGlow,0,-1.10,0,1.05,.70,1,Math.PI/2,0,0,false);
      lampPlane.dispose();cabinInstances(cabinLamps,'lights',cabinGlow,false);
      cabinLightMesh=cabinBatches[cabinBatches.length-1].mesh;
      cabinLightMesh.castShadow=false;cabinLightMesh.receiveShadow=false;cabinLightMesh.visible=false;
      // Doors: a sliding leaf pair per cabin on the apron-facing side, authored at
      // the cabin centre so they ride the same translation-only anchor.
      [-1, 1].forEach(function (side) {
        var leaf = new Map();
        box(leaf, cabinPaint, side * .74, -2.45, -1.335, 1.34, 2.6, .09);
        var doorGeometry = bake(leaf.values().next().value);
        doorGeometry.scale(CABIN_SCALE, CABIN_SCALE, CABIN_SCALE);
        var mesh = new THREE.InstancedMesh(doorGeometry, cabinPaint, 12);
        mesh.name = 'ferris-cabin-doors';
        for (var id = 0; id < 12; id += 1) mesh.setColorAt(id, new THREE.Color(colors[id % 3]));
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.instanceColor.needsUpdate = true;
        mesh.castShadow = false; mesh.receiveShadow = true;
        mechanism.add(mesh); meshes.push(mesh);
        if (side < 0) doorLeafL = mesh; else doorLeafR = mesh;
      });
      fares(mechanism);
    }

    // Two fares ride in each cabin. They follow the cabin rule exactly: only the
    // anchor translates, so a figure stays upright and inside its window band at
    // the top and the bottom of the turn. One instanced unit box carries every
    // part of all twenty-four fares, tinted per instance.
    function fares(mechanism) {
      var rides = [];
      for (var pair = 0; pair < 24; pair++) rides.push({
        cabin: Math.floor(pair / 2), side: pair % 2 ? 1 : -1,
        clothes: CLOTHES[pair % CLOTHES.length], skin: SKINS[pair % SKINS.length]
      });
      rides.forEach(function (ride) {
        SEATED.forEach(function (part) {
          fareParts.push({
            part: part, cabin: ride.cabin, side: ride.side,
            tint: part.kind === 1 ? ride.skin : part.kind === 2 ? HAIR : ride.clothes
          });
        });
      });
      fareBatch = new THREE.InstancedMesh(boxGeometry, paint, fareParts.length);
      fareBatch.name = 'ferris-passengers';
      fareParts.forEach(function (fare, index) { fareBatch.setColorAt(index, new THREE.Color(fare.tint)); });
      fareBatch.instanceColor.needsUpdate = true;
      fareBatch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      fareBatch.castShadow = true; fareBatch.receiveShadow = true;
      mechanism.add(fareBatch); meshes.push(fareBatch);
    }

    function doorEase(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
    function monumentPlaza(site) {
      plaza = Object.assign({}, site);
      var parent = siteGroup(site), ground = new Map(), details = new Map();
      box(ground, paving, 0, .23, 0, site.w - .6, .08, site.d - .6, 0, false);
      ring(ground, pale, 0, 18.25, .281);
      [5.8, 11.8, 17.75].forEach(function (radius) { ring(ground, stone, radius, radius + .14, .293); });
      ring(ground, gold, 7.7, 7.86, .299);
      // Subtle radial joints read as stone paving rather than a second playing field.
      for (var joint = 0; joint < 16; joint++) {
        var phase = joint * TAU / 16;
        box(ground, stone, Math.sin(phase) * 12.05, .298, Math.cos(phase) * 12.05, .055, .012, 11.8, phase, false);
      }
      flush(ground, parent, 'plaza-paving');
      if (refinedPlaza) {
        part(details, monumentGeometry, landscapeMaterial, 0, 0, 0, 1, 1, 1);
        [-1, 1].forEach(function (x) { [-1, 1].forEach(function (z) {
          part(details, planterGeometry, landscapeMaterial, x * 13.5, 0, z * 16.2, 1, 1, 1);
          part(details, benchGeometry, landscapeMaterial, x * 14.8, 0, z * 6.8, 1, 1, 1, 0, x * Math.PI / 2);
        }); });
      } else {
      box(details, pale, 0, .54, 0, 11.4, .5, 11.4);
      box(details, pale, 0, 1, 0, 9.1, .42, 9.1);
      box(details, pale, 0, 1.42, 0, 7.2, .42, 7.2);
      box(details, stone, 0, 2.76, 0, 5.8, 2.26, 5.8);
      box(details, gold, 0, 3.87, 0, 6.05, .18, 6.05);
      var shaft = new THREE.CylinderGeometry(1.8, 2.7, 16.7, 4);
      part(details, shaft, stone, 0, 12.28, 0, 1, 1, 1, 0, Math.PI / 4); shaft.dispose();
      // An abstract brass crystal and halo provide a recognizable, non-political crown.
      var crystal = new THREE.OctahedronGeometry(1, 0);
      part(details, crystal, gold, 0, 22.3, 0, 1.63, 2.55, 1.63); crystal.dispose();
      var halo = new THREE.TorusGeometry(2.5, .13, 6, 64);
      part(details, halo, gold, 0, 20.93, 0, 1, 1, 1, Math.PI / 2); halo.dispose();
      box(details, gold, 0, 2.65, 2.932, 4.8, .95, .075);
      [-1, 1].forEach(function (x) { [-1, 1].forEach(function (z) {
        planter(details, x * 13.5, z * 16.2, 2.25);
        bench(details, x * 14.8, z * 6.8, x * Math.PI / 2);
      }); });
      }
      flush(details, parent, 'plaza-details');
      sign(parent, '城市之光', 0, 2.65, 2.977, 4.65, .82, '#545b5b', '#cdb78f', 'landmark-sign-plaza');
      // 纪念碑泛光 + 环形草坪灯（亮化第三批 #10）：碑座一片暖色 additive 光池、
      // 广场一圈六盏低杆草坪灯（发光头独立 flush），广场夜里不再只是轮廓。
      if (kit.lightPoolMap) {
        plazaFlood = new THREE.MeshBasicMaterial({ color: '#ffd9a0', map: kit.lightPoolMap,
          transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
        plazaFlood.name = 'plaza-flood-pool'; ownedMaterials.push(plazaFlood);
        var floodGeometry = new THREE.PlaneGeometry(1, 1); ownedGeometries.push(floodGeometry);
        var floodMesh = new THREE.Mesh(floodGeometry, plazaFlood);
        floodMesh.name = 'plaza-flood-pool'; floodMesh.rotation.x = -Math.PI / 2;
        floodMesh.position.set(0, .31, 0); floodMesh.scale.set(17, 15, 1); floodMesh.visible = false;
        plazaFloodMesh = floodMesh;
        parent.add(floodMesh); meshes.push(floodMesh);
      }
      var lampPoleParts = new Map(), lampHeadParts = new Map();
      plazaLampHeads = material('plaza-lamp-head', '#ffe2ae', null, { emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0 });
      for (var lamp = 0; lamp < 6; lamp++) {
        var pa = lamp * TAU / 6 + Math.PI / 6, lx = Math.sin(pa) * 15.2, lz = Math.cos(pa) * 15.2;
        box(lampPoleParts, silver, lx, .9, lz, .13, 1.5, .13, 0, true);
        part(lampHeadParts, boxGeometry, plazaLampHeads, lx, 1.72, lz, .42, .3, .42, 0, 0, 0, false);
      }
      flush(lampPoleParts, parent, 'plaza-lamp-poles');
      flush(lampHeadParts, parent, 'plaza-lamp-heads');
    }

    // Balloon carts are planned data from CityPlaces.balloonStands. A cart is drawn
    // only while its rectangle still sits inside the live amusement lot and clear of
    // the wheel, so a swapped layout drops the carts instead of stranding them.
    // Cart, vendor and strings share one instanced unit box; the cluster above them
    // is a second, time-driven batch, so the pair costs two draw calls.
    function balloonCarts(planned) {
      if (!amusement || !planned.length) return;
      var lot = amusement;
      drawnStands = planned.filter(function (stand) {
        return Math.abs(stand.x - lot.x) + stand.w / 2 <= lot.w / 2 + 1e-6 &&
          Math.abs(stand.z - lot.z) + stand.d / 2 <= lot.d / 2 + 1e-6 &&
          Math.hypot(stand.x - lot.x, stand.z - lot.z) >= WHEEL_CLEARANCE;
      });
      if (!drawnStands.length) return;
      var parent = siteGroup({ kind: 'balloon', label: '气球摊', name: '气球摊', x: lot.x, z: lot.z, w: 0, d: 0, height: 0 });
      var cart = [], ballGeometry = new THREE.IcosahedronGeometry(1, 0);
      ownedGeometries.push(ballGeometry);
      drawnStands.forEach(function (stand, index) {
        var yaw = stand.facing || 0, cos = Math.cos(yaw), sin = Math.sin(yaw);
        var ox = stand.x - lot.x, oz = stand.z - lot.z;
        var lead = CANOPY_LEADS[index % CANOPY_LEADS.length], apron = CANOPY_LEADS[(index + 1) % CANOPY_LEADS.length];
        // Draws in the stand's own frame (+z faces the block walk), then yaws the
        // whole cart into the site group's frame.
        function at(x, y, z, w, h, d, tint) {
          cart.push({ x: ox + x * cos + z * sin, y: y, z: oz - x * sin + z * cos, w: w, h: h, d: d, yaw: yaw, tint: tint });
        }
        // Counter toward the walk, wheels at the rear, canopy on four posts, the
        // vendor behind the counter, and a hook over the rear corner for the gas.
        at(0, 1, .7, 3.9, 1.45, 2.6, CART_WOOD);
        at(0, 1.85, .7, 4.1, .24, 2.5, CART_TOP);
        at(-1.15, 2.16, .8, .5, .38, .5, lead);
        at(1.15, 2.16, .8, .5, .38, .5, CART_TOP);
        [-1, 1].forEach(function (side) { at(side * 2, .82, 1.35, .22, 1.1, 1.1, CART_WHEEL); });
        [-1, 1].forEach(function (side) { [-1, 1].forEach(function (depth) { at(side * 2, 2.85, depth * 2.35, .14, 5.1, .14, CART_FRAME); }); });
        for (var stripe = 0; stripe < 6; stripe++) at(-1.875 + stripe * .75, 5.48, 0, .75, .16, 5.1, stripe % 2 ? CART_TOP : lead);
        at(0, 5.13, 2.5, 4.5, .5, .1, apron);
        at(.85, .95, -1.3, .52, 1.35, .44, CART_FRAME);
        at(.85, 2.2, -1.3, .74, 1.15, .46, apron);
        at(.85, 3.02, -1.3, .52, .5, .5, SKINS[0]);
        at(.85, 3.36, -1.3, .56, .16, .54, HAIR);
        at(-1.3, 5.45, -1.6, .1, .9, .1, CART_FRAME);
        // Seven balloons on strings, spread around the hook. A string stops at the
        // balloon's resting centre, which the gentle bob keeps hidden inside the ball.
        for (var ball = 0; ball < 7; ball++) {
          var ring = ball ? (ball - 1) * TAU / 6 : 0, radius = ball ? .5 : 0;
          var bx = -1.3 + Math.cos(ring) * radius, bz = -1.6 + Math.sin(ring) * radius;
          var by = (ball ? 6.52 : 6.9) + ball % 3 * .12, size = .34 + ball % 3 * .02;
          at(bx, (5.9 + by) / 2, bz, .04, by - 5.9, .04, CART_STRING);
          balloonParts.push({
            x: ox + bx * cos + bz * sin, y: by, z: oz - bx * sin + bz * cos, phase: ball * TAU / 7,
            sx: size, sy: size * 1.16, sz: size, tint: colors[(index + ball) % colors.length]
          });
        }
      });
      cartBatch = new THREE.InstancedMesh(boxGeometry, paint, cart.length);
      cartBatch.name = 'balloon-stand-parts';
      cart.forEach(function (piece, index) {
        position.set(piece.x, piece.y, piece.z); scale.set(piece.w, piece.h, piece.d);
        quaternion.setFromEuler(new THREE.Euler(0, piece.yaw, 0));
        matrix.compose(position, quaternion, scale); cartBatch.setMatrixAt(index, matrix);
        cartBatch.setColorAt(index, new THREE.Color(piece.tint));
      });
      cartBatch.instanceMatrix.needsUpdate = true; cartBatch.instanceColor.needsUpdate = true;
      cartBatch.castShadow = true; cartBatch.receiveShadow = true;
      parent.add(cartBatch); meshes.push(cartBatch);
      balloonBatch = new THREE.InstancedMesh(ballGeometry, latex, balloonParts.length);
      balloonBatch.name = 'balloon-cluster';
      balloonParts.forEach(function (balloon, index) { balloonBatch.setColorAt(index, new THREE.Color(balloon.tint)); });
      balloonBatch.instanceColor.needsUpdate = true;
      balloonBatch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      balloonBatch.castShadow = true; balloonBatch.receiveShadow = true;
      parent.add(balloonBatch); meshes.push(balloonBatch);
    }
    // A slow sway from the shared clock: the cluster returns to the same pose every
    // 12 seconds, so a pause or a rewind lands on an exact state.
    function bobBalloons(time) {
      if (!balloonBatch) return;
      var phase = ((time % BOB_PERIOD) + BOB_PERIOD) % BOB_PERIOD / BOB_PERIOD * TAU;
      balloonParts.forEach(function (balloon, index) {
        var sway = phase + balloon.phase;
        position.set(balloon.x + Math.cos(sway) * BOB_SWAY, balloon.y + Math.sin(sway) * BOB_HEIGHT, balloon.z + Math.sin(sway) * BOB_SWAY);
        scale.set(balloon.sx, balloon.sy, balloon.sz); quaternion.identity();
        matrix.compose(position, quaternion, scale); balloonBatch.setMatrixAt(index, matrix);
      });
      balloonBatch.instanceMatrix.needsUpdate = true;
      balloonBatch.computeBoundingBox(); balloonBatch.computeBoundingSphere();
    }

    var places = city && Array.isArray(city.places) ? city.places : [];
    places.forEach(function (site) {
      if (site.kind === 'amusement' && !amusement) amusementPark(site);
      if (site.kind === 'plaza' && !plaza) monumentPlaza(site);
    });
    balloonCarts(city && Array.isArray(city.balloonStands) ? city.balloonStands : []);
    cylinderGeometry.dispose(); sphereGeometry.dispose();
    meshes.forEach(function (mesh) {
      drawCalls++;
      var count = mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.getAttribute('position').count;
      triangles += count / 3 * (mesh.isInstancedMesh ? mesh.count : 1);
    });

    function update(time, lighting) {
      if (disposed) return;
      time = Number.isFinite(time) ? time : 0;
      if(lighting)currentLighting=lighting;
      refreshParkLighting(time);
      rideRecords.forEach(function(ride){ride.angle=((time%ride.spec.period+ride.spec.period)%ride.spec.period)/ride.spec.period*TAU;ride.mesh.rotation.y=ride.angle;});
      if (time === lastTime) return;
      lastTime = time; angle = ((time % PERIOD + PERIOD) % PERIOD) / PERIOD * TAU;
      bobBalloons(time);
      if (!wheel) return;
      wheel.rotation.z = angle;
      cabinPositions = []; passengerPositions = [];
      for (var id = 0; id < 12; id++) {
        var phase = angle + id * TAU / 12, x = Math.cos(phase) * RADIUS, y = AXLE_Y + Math.sin(phase) * RADIUS;
        cabinPositions.push({ x: amusement.x + x * Math.cos(WHEEL_YAW), y: y - 2.45, z: amusement.z - x * Math.sin(WHEEL_YAW) });
        // Seat anchors use the same world convention, one to each side of the cabin.
        [-1, 1].forEach(function (side) {
          var seat = x + side * SEAT_X;
          passengerPositions.push({
            x: amusement.x + seat * Math.cos(WHEEL_YAW), y: y + SEAT_Y,
            z: amusement.z - seat * Math.sin(WHEEL_YAW), cabin: id, side: side
          });
        });
      }
      cabinBatches.forEach(function (batch) {
        batch.ids.forEach(function (id, index) {
          var phase = angle + id * TAU / 12;
          // Only the anchor translates. Keeping the local rotation at identity
          // counteracts the rotor's tilt and holds cabin floors level at all times.
          matrix.makeTranslation(Math.cos(phase) * RADIUS, AXLE_Y + Math.sin(phase) * RADIUS, 0);
          batch.mesh.setMatrixAt(index, matrix);
        });
        batch.mesh.instanceMatrix.needsUpdate = true;
        batch.mesh.computeBoundingBox(); batch.mesh.computeBoundingSphere();
      });
      // Doors stay shut on the ride and slide open only through the boarding arc
      // at the bottom. Pure time: rewind and pause keep the leaves exact.
      if (doorLeafL) {
        // Everything here is mechanism-local: the cabin anchor sits at
        // (cos·R, axle+sin·R, 0), and each leaf slides along the cabin's local x —
        // the rim tangent — by its own width when the door opens.
        for (var id = 0; id < 12; id += 1) {
          var doorPhase = angle + id * TAU / 12;
          var fromBottom = 1 + Math.sin(doorPhase);          // 0 at the very bottom
          // +-6 degrees of arc: about six seconds at the boarding point, matching
          // the four-second step-in the riders take, and shut everywhere else.
          var open = fromBottom < .006 ? doorEase(1 - fromBottom / .006) : 0;
          doorOpen[id] = open;
          var rimX = Math.cos(doorPhase) * RADIUS, rimY = AXLE_Y + Math.sin(doorPhase) * RADIUS;
          var slide = open * .62 * CABIN_SCALE;
          matrix.makeTranslation(rimX - slide, rimY, 0); doorLeafL.setMatrixAt(id, matrix);
          matrix.makeTranslation(rimX + slide, rimY, 0); doorLeafR.setMatrixAt(id, matrix);
        }
        doorLeafL.instanceMatrix.needsUpdate = true; doorLeafR.instanceMatrix.needsUpdate = true;
        doorLeafL.computeBoundingBox(); doorLeafL.computeBoundingSphere();
        doorLeafR.computeBoundingBox(); doorLeafR.computeBoundingSphere();
      }
      // The fares ride by the same rule: the offset from the rim anchor never
      // rotates, so both figures stay upright and seated through the whole turn.
      fareParts.forEach(function (fare, index) {
        var phase = angle + fare.cabin * TAU / 12;
        position.set(Math.cos(phase) * RADIUS + fare.side * SEAT_X + fare.part.dx,
          AXLE_Y + Math.sin(phase) * RADIUS + SEAT_Y + fare.part.dy, fare.part.dz);
        scale.set(fare.part.w, fare.part.h, fare.part.d); quaternion.identity();
        matrix.compose(position, quaternion, scale); fareBatch.setMatrixAt(index, matrix);
      });
      fareBatch.instanceMatrix.needsUpdate = true;
      fareBatch.computeBoundingBox(); fareBatch.computeBoundingSphere();
    }
    function setTownView(view) {
      if (disposed) return;
      var lifeApi = CityLife || (root && root.CityLife);
      passengerCount = view && view.demand && lifeApi ? lifeApi.demandBudget(view.demand).staticPassengers : 24;
      passengerCount = amusement ? Math.min(24, passengerCount) : 0;
      if (fareBatch) { fareBatch.count = passengerCount * SEATED.length; fareBatch.visible = passengerCount > 0; }
      // 亮化第三批（#10/#11）：广场泛光与草坪灯走街灯同一 lamps 口径（二值，与
      // city-ground 的 setTownView 一致）；摩天轮彩灯挂游乐场 open——闭园即灭。
      var minute = view ? ((Number(view.minute) || 0) % 1440 + 1440) % 1440 : 0;
      var lamps = minute >= 1110 || minute < 360 ? 1 : 0;
      if (plazaFloodMesh) { plazaFlood.opacity = lamps * .5; plazaFloodMesh.visible = lamps > 0; }
      if (plazaLampHeads) plazaLampHeads.emissiveIntensity = lamps * 1.5;
      amusementOpen = !!(view && view.byBuilding && view.byBuilding['c-amusement'] && view.byBuilding['c-amusement'].open);
      currentTownView=view;
      if(!view||currentLighting&&currentLighting.minute!==view.minute)currentLighting=null;
      refreshParkLighting(lastTime);
    }
    function getInfo() {
      return {
        ready: !disposed, time: lastTime, drawCalls: disposed ? 0 : drawCalls, triangles: disposed ? 0 : triangles,
        amusement: amusement ? { cabins: 12, passengers: passengerCount, angle: angle, site: Object.assign({}, amusement), radius: RADIUS,
          lit: bulbMesh ? bulbMesh.visible : false,
          lighting:Object.assign({},parkLighting),
          rides:rideRecords.map(function(ride){return {kind:ride.spec.kind,local:Object.assign({},ride.spec.local),radius:ride.spec.radius,height:ride.spec.height,angle:ride.angle,assetId:amusementAsset.meta.assetId};}),
          axleHeight: AXLE_Y, yaw: WHEEL_YAW, period: PERIOD, cabinScale: CABIN_SCALE,
          cabinPositions: cabinPositions.map(function (p) { return Object.assign({}, p); }),
          passengerPositions: passengerPositions.slice(0, passengerCount).map(function (p) { return Object.assign({}, p); }),
          doors: { count: doorLeafL ? 24 : 0, open: doorOpen.slice() },
          platform: station ? { x: station.x, z: station.z, w: station.w, d: station.d, height: station.height,
            boardHeight: station.boardHeight, deckTop: station.deckTop, along: Object.assign({}, station.along),
            across: Object.assign({}, station.across), ramp: Object.assign({}, station.ramp),
            parts: stationParts.map(function (piece) { return Object.assign({}, piece); }) } : null } : null,
        balloonStands: {
          count: disposed ? 0 : drawnStands.length, balloons: disposed || !balloonBatch ? 0 : balloonParts.length,
          stands: disposed ? [] : drawnStands.map(function (stand) { return { id: stand.id, x: stand.x, z: stand.z }; })
        },
        plaza: plaza ? { assetId: refinedPlaza ? landscape.meta.assetId : null, x: plaza.x, z: plaza.z, height: plaza.height, title: '城市之光', site: Object.assign({}, plaza) } : null
      };
    }
    function dispose() {
      if (disposed) return;
      disposed = true; group.visible = false; group.removeFromParent();
      doorLeafL = null; doorLeafR = null;
      meshes.forEach(function (mesh) { if (mesh.isInstancedMesh) mesh.dispose(); });
      ownedGeometries.forEach(function (geometry) { geometry.dispose(); });
      ownedMaterials.forEach(function (mat) { mat.dispose(); });
      ownedTextures.forEach(function (texture) { texture.dispose(); });
      group.clear(); meshes.length = 0; cabinBatches.length = 0; cabinPositions.length = 0;
      ownedGeometries.length = 0; ownedMaterials.length = 0; ownedTextures.length = 0;
      wheel = null; amusement = null; plaza = null;
      rideRecords.length=0;pathLightMesh=null;pathPoolMesh=null;cabinLightMesh=null;bulbMesh=null;rideMaterial=null;currentTownView=null;currentLighting=null;
      station = null; stationParts.length = 0;
      fareBatch = null; fareParts.length = 0; passengerPositions.length = 0;
      cartBatch = null; balloonBatch = null; balloonParts.length = 0; drawnStands.length = 0;
    }
    update(0);
    return { group: group, update: update, setTownView: setTownView, getInfo: getInfo, dispose: dispose };
  }
  return { create: create, amusementLighting: amusementLighting, isAmusementAssetValid: validAmusementAsset };
});
