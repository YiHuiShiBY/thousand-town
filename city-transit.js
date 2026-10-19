/* Compact interchange with shared, deterministic bus and taxi duty cycles. */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CityTransit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  var Motion = typeof module === 'object' && module.exports ? require('./city-transit-motion.js') : root.CityTransitMotion;

  function create(THREE, kit, city) {
    kit = kit || {};
    var site = city && (city.places || []).find(function (place) { return place.kind === 'station'; });
    var gateSide = site ? (site.gateSide === 1 || site.gateSide === -1 ? site.gateSide : (site.x < 0 ? 1 : -1)) : null;
    var roadX = site ? (Number.isFinite(site.roadX) ? site.roadX : (site.x < 0 ? -96 : 96)) : null;
    var group = new THREE.Group(); group.name = 'city-transit';
    var geometries = [], materials = [], textures = [], meshes = [], batches = new Map();
    var disposed = false, lastTime = null, lastClockKey = null, activeVehicle = null;
    var motion = Motion.create(city || {}), vehicleParts = [], fleet = [], lightPools=null,poolMat=null,platformPools=null;
    var details = { kind: 'station', label: '城市公交 · 出租换乘', present: !!site,
      buses: 0, taxis: 0, parkedVehicles: 0, shelters: 0, benches: 0, bays: [],
      vehicles: [], footprints: [], entrances: [], drawCalls: 0, triangles: 0, signs: 0 };
    group.userData.transit = details;
    function update(time,lighting,daySeconds) {
      if(disposed)return;
      time=Number.isFinite(time)?Math.max(0,time):0;
      if(lighting&&red){red.emissiveIntensity=lighting.lamps*1.5;}
      if(lighting&&canopyStrip){canopyStrip.emissiveIntensity=lighting.lamps*1.7;}
      if(lighting&&platformPools){platformPools.material.opacity=lighting.lamps*.42;platformPools.visible=lighting.lamps>0;}
      const clockKey=time+'/'+daySeconds+'/'+(lighting?lighting.minute:'');
      if(clockKey===lastClockKey)return;
      lastTime=time;lastClockKey=clockKey;fleet=Motion.sample(motion,time,daySeconds);
      var transform=new THREE.Matrix4(),rotation=new THREE.Matrix4(),origin=new THREE.Matrix4(),output=new THREE.Matrix4();
      vehicleParts.forEach(function(part){
        var v=fleet[part.owner],source=motion.vehicles[part.owner];
        transform.makeTranslation(v.localX,v.y,v.localZ);
        rotation.makeRotationY(-(v.localHeading+Math.PI/2));
        origin.makeTranslation(-source.x,0,-source.z);
        transform.multiply(rotation).multiply(origin);output.multiplyMatrices(transform,part.matrix);
        if((part.cabinLight&&(!v.moving||!lighting||!lighting.lamps))||(part.lamp&&lighting&&!v.moving))output.makeScale(0,0,0);
        part.batch.mesh.setMatrixAt(part.index,output);part.batch.mesh.instanceMatrix.needsUpdate=true;
      });
      if(lightPools&&lighting){
        poolMat.opacity=lighting.lamps*.42;lightPools.visible=lighting.lamps>0;
        const litMatrix=new THREE.Matrix4(),rot=new THREE.Quaternion(),upAxis=new THREE.Vector3(0,1,0),p=new THREE.Vector3();
        fleet.forEach(function(v,i){
          if(!v.moving){lightPools.setMatrixAt(i,new THREE.Matrix4().makeScale(0,0,0));return;}
          const length=v.bus?12.6:6.9,dx=Math.cos(v.localHeading)*(length/2+2.6),dz=Math.sin(v.localHeading)*(length/2+2.6);
          const x=v.x+Math.cos(v.heading)*(length/2+2.6),z=v.z+Math.sin(v.heading)*(length/2+2.6);
          const height=globalThis.CityLighting?globalThis.CityLighting.roadHeight(city,x,z):v.y+.25;
          p.set(v.localX+dx,height+.045,v.localZ+dz);rot.setFromAxisAngle(upAxis,-v.localHeading);
          litMatrix.compose(p,rot,new THREE.Vector3(5.8,1,3.6));lightPools.setMatrixAt(i,litMatrix);
        });lightPools.instanceMatrix.needsUpdate=true;
      }
      details.parkedVehicles=fleet.filter(function(v){return !v.moving;}).length;
    }
    function getInfo() {
      return Object.assign({}, details, { ready: !disposed, time: lastTime,
        gateSide: gateSide, roadX: roadX, fleet: fleet.map(function(v){return Object.assign({},v);}),
        operating: fleet.filter(function(v){return v.moving;}).length, maintenance: fleet.filter(function(v){return v.status==='整备维护';}).length,
        drawCalls: disposed ? 0 : details.drawCalls, triangles: disposed ? 0 : details.triangles,
        batches: disposed ? 0 : meshes.length, footprint: site ? { x: site.x, z: site.z, w: site.w, d: site.d } : null });
    }
    function dispose() {
      if (disposed) return;
      disposed = true; group.visible = false; group.removeFromParent();
      meshes.forEach(function (mesh) { if (mesh.isInstancedMesh) mesh.dispose(); });
      geometries.forEach(function (geometry) { geometry.dispose(); });
      materials.forEach(function (material) { material.dispose(); });
      textures.forEach(function (texture) { texture.dispose(); });
      group.clear(); batches.clear(); meshes.length = 0;
    }
    var controller = { group: group, update: update, dispose: dispose, getInfo: getInfo };
    if (!site) return controller;
    var sx = site.w / 52, sz = site.d / 58;
    group.position.set(site.x, 0, site.z); group.scale.set(sx, 1, sz);
    // Rotate the east-bank layout, including its labels, instead of reflecting it.
    // Both local ground axes reverse; entrances retain their entrance/exit roles.
    group.rotation.y = gateSide < 0 ? Math.PI : 0;

    function own(geometry) { geometries.push(geometry); return geometry; }
    function material(name, color, base, roughness, metalness) {
      var result = base ? base.clone() : new THREE.MeshStandardMaterial();
      result.name = 'transit-' + name; result.color.set(color);
      result.roughness = roughness === undefined ? .75 : roughness;
      result.metalness = metalness === undefined ? .04 : metalness;
      materials.push(result); return result;
    }
    var asphalt = material('asphalt', '#65736e', kit.road, .96, 0);
    var ivory = material('ivory', '#eee8d9', kit.stone, .77, .03);
    var teal = material('petrol-green', '#477d70', null, .59, .16);
    var yellow = material('taxi-yellow', '#ecc654', null, .38, .2);
    var glass = material('smoked-glass', '#b8dce2', kit.vehicleGlass||kit.glass, .2, .05);
    glass.transparent=true;glass.opacity=.28;glass.depthWrite=false;



    var metal = material('structure', '#586f69', kit.metal, .5, .48);
    var chalk = material('road-markings', '#f3edd8', null, .92, 0);
    var wood = material('bench-wood', '#927455', null, .85, 0);
    var rubber = material('rubber', '#283531', null, .94, 0);
    // 站场灯带（亮化第二批 #7）：雨棚底下的市政照明条，与街灯同一 lamps 时钟——
    // 车站夜里有人值班，站台不该是场站中央的一块黑。
    var canopyStrip = material('canopy-strip', '#ffe2ae', null, .6, 0);
    canopyStrip.emissive.set('#ffd9a0'); canopyStrip.emissiveIntensity = 0;
    var red = material('tail-lights', '#b4654d', null, .45, .05);red.color.set('#ffffff');red.emissive.set('#ffffff');
    red.onBeforeCompile=function(shader){shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor;\n#endif');};
    var headlamp={material:red,tint:'#fff0cc'},cabinLight={material:red,tint:'#ffd9a3',cabinLight:true};
    var skin={material:wood,tint:'#ffe4c5'},seatMaterial={material:teal,tint:'#687978'};
    var cube = own(new THREE.BoxGeometry(1, 1, 1));
    var wheel = own(new THREE.CylinderGeometry(1, 1, 1, 12));
    var matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion();
    var up = new THREE.Vector3(0, 1, 0), wheelTurn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    function append(geometry, mat, x, y, z, w, h, d, turn, wheels) {
      var lampCabin=!!mat.cabinLight,tint=mat.tint||((mat===red)?'#e63d24':'#ffffff');
      mat=mat.material||mat;
      var key = geometry.uuid + '/' + mat.uuid;
      if (!batches.has(key)) batches.set(key, { geometry: geometry, material: mat, matrices: [], colors: [] });
      quaternion.setFromAxisAngle(up, turn || 0);
      if (wheels) quaternion.multiply(wheelTurn);
      matrix.compose(new THREE.Vector3(x, y, z), quaternion, new THREE.Vector3(w, h, d));
      var batch=batches.get(key),original=matrix.clone();
      if(activeVehicle!==null)vehicleParts.push({batch:batch,index:batch.matrices.length,matrix:original,owner:activeVehicle,cabinLight:lampCabin,lamp:mat===red});
      batch.matrices.push(original);batch.colors.push(tint);
    }
    function box(x, y, z, w, h, d, mat, turn) { append(cube, mat, x, y, z, w, h, d, turn); }
    function footprint(x, z, w, d, kind, extra) {
      var rect = Object.assign({ x: site.x + gateSide * x * sx, z: site.z + gateSide * z * sz, w: w * sx, d: d * sz, kind: kind }, extra || {});
      if (Number.isFinite(rect.heading) && gateSide < 0) rect.heading += Math.PI;
      details.footprints.push(rect); return rect;
    }
    function line(x, z, w, d, color) { box(x, .279, z, w, .018, d, color || chalk); }
    function bay(x, z, w, d, kind) {
      [-1, 1].forEach(function (side) { line(x + side * w / 2, z, .13, d); });
      line(x, z + d / 2, w, .13);
      details.bays.push({ x: site.x + gateSide * x * sx, z: site.z + gateSide * z * sz, w: w * sx, d: d * sz, kind: kind });
    }
    function arrow(x, z, heading) {
      var c = Math.cos(heading), s = Math.sin(heading);
      line(x, z, Math.abs(c) > .5 ? 3.1 : .25, Math.abs(c) > .5 ? .25 : 3.1);
      [-1, 1].forEach(function (side) {
        var dx = .85, dz = side * .47;
        box(x + dx * c - dz * s, .286, z + dx * s + dz * c, 1.45, .025, .21, chalk, -heading + side * .68);
      });
    }

    // The entire pad stays inside its reserved lot. The inward openings end at
    // the boundary, where the host ground joins the neighbouring carriageway.
    box(0, .125, 0, 52, .25, 58, asphalt);
    box(-5, .33, -23, 40, .16, 9, ivory);
    box(-5, .33, 25.7, 40, .16, 3.8, ivory);
    box(-24.8, .33, -.3, 2.4, .16, 46.8, ivory);
    footprint(-5, -23, 40, 9, 'waiting-platform', { top: .41 });
    footprint(-5, 25.7, 40, 3.8, 'taxi-platform', { top: .41 });
    details.driveway = { x: site.x + gateSide * 21 * sx, z: site.z, w: 10 * sx, d: 54 * sz };
    [-13, 13].forEach(function (z, i) {
      details.entrances.push({ x: site.x + gateSide * 26 * sx, z: site.z + gateSide * z * sz,
        width: 8 * sz, kind: i === 0 ? 'entrance' : 'exit', connectsToRoadX: roadX });
      arrow(22, z, i === 0 ? Math.PI : 0);
    });
    for (var dash = -24; dash <= 24; dash += 6) line(17.2, dash, .13, 2.8, yellow);
    arrow(20.3, 1.5, Math.PI / 2);
    arrow(-4, 7.7, 0);
    // Crossing paint connects the waiting platform to the first bus positions.
    for (var stripe = -20; stripe <= 10; stripe += 2.2) line(stripe, -16.4, 1.1, 2.1);

    // One broad rain canopy with a ticket booth and three warm timber benches.
    box(-5, 8.16, -23, 40, .47, 8.8, ivory);
    box(-5, 7.85, -23, 39.2, .17, 8.1, wood);
    box(-5, 8.12, -18.56, 39.4, .24, .12, teal);
    // Canopy light strips (lighting pass two #7): two warm lines on the canopy
    // soffit, municipal lighting on the lamps clock like the street lamps.
    box(-5, 7.78, -25.4, 38, .08, .34, canopyStrip);
    box(-5, 7.78, -20.6, 38, .08, .34, canopyStrip);
    [-23, -11, 1, 13].forEach(function (x) {
      [-26, -20].forEach(function (z) {
        box(x, 4.06, z, .31, 7.3, .31, metal);
        box(x, .56, z, .7, .3, .7, ivory);
      });
    });
    box(-21, 2.72, -23.2, 5.8, 4.62, 4.2, ivory);
    box(-21, 3.0, -21.02, 4.7, 2.2, .16, glass);
    box(-21, 1.88, -20.75, 5.1, .2, .75, teal);
    [-12, 0, 11].forEach(function (x) {
      for (var plank = 0; plank < 3; plank++) {
        box(x, 1.49, -23.75 + plank * .41, 6.8, .18, .34, wood);
        box(x, 1.98 + plank * .26, -24.12, 6.8, .19, .13, wood);
      }
      [-1, 1].forEach(function (side) { box(x + side * 2.45, .96, -23.25, .25, 1.05, 1.35, metal); });
      details.benches++;
    });
    details.shelters = 1;
    footprint(-5, -23, 40, 8.8, 'canopy', { bottom: 7.58, top: 8.395 });
    footprint(-21, -23.2, 5.8, 4.2, 'ticket-booth', { top: 5.03 });

    function vehicle(x, z, bus, index) {
      activeVehicle=bus?index:index+3;
      var heading = -Math.PI / 2, c = Math.cos(heading), s = Math.sin(heading);
      var length = bus ? 12.6 : 6.9, width = bus ? 4.1 : 3.3;
      function part(dx, y, dz, w, h, d, mat) {
        box(x + dx * c - dz * s, y, z + dx * s + dz * c, w, h, d, mat, -heading);
      }
      part(0, bus ? 1.38 : 1.36, 0, length, bus ? 1.24 : 1.13, width, bus ? ivory : yellow);
      const seats=bus?6:2;
      for(let seat=0;seat<seats;seat++){
        const px=bus?4.7-Math.floor(seat/2)*3:seat?-.9:.9,pz=seat%2?.85:-.85;
        part(px,bus?2.1:1.84,pz,.85,.65,.8,seatMaterial);
        part(px+.08,bus?2.68:2.13,pz,.5,bus?.65:.38,.52,teal);
        part(px+.08,bus?3.17:2.47,pz,.4,.43,.4,skin);
      }
      part(bus?5.1:1.55,bus?2.68:2.03,-.85,.13,.22,.55,metal);
      if(bus)part(0,3.6,0,9,.045,.24,cabinLight);
      part(0, bus ? 1.63 : .9, 0, length + .06, bus ? .62 : .2, width + .04, bus ? teal : metal);
      if (bus) {
        // Long glazed side panels, window pillars, front screen and twin doors.
        [-1, 1].forEach(function (side) {
          part(-.15, 3.0, side * (width / 2 + .045), 11.5, 1.35, .11, glass);
          for (var pillar = -2; pillar <= 2; pillar++) part(pillar * 2.05, 3.0, side * (width / 2 + .11), .14, 1.4, .11, ivory);
        });
        part(length / 2 + .045, 2.97, 0, .1, 1.52, 3.4, glass);
        part(-length / 2 - .045, 3.0, 0, .1, 1.23, 3.35, glass);
        [3.7, -2.4].forEach(function (dx) {
          part(dx, 2.29, -width / 2 - .08, 1.5, 2.5, .13, glass);
          part(dx, 2.29, -width / 2 - .17, .1, 2.5, .09, metal);
        });
        part(0, 3.8, 0, 12.45, .25, 4.14, teal);
        part(-1.1, 4.08, 0, 3.5, .38, 2.2, ivory);
      } else {
        part(-.3, 2.23, 0, 3.5, 1.0, 2.9, glass);
        part(-.3, 2.8, 0, 3.64, .18, 3.02, yellow);
        [-1, 1].forEach(function (side) { part(-.25, 2.26, side * 1.48, .15, 1.04, .1, yellow); });
        part(-.1, 3.04, 0, 1.2, .32, .56, headlamp);
        part(-.1, 3.075, -.3, .75, .12, .025, yellow);
      }
      [-1, 1].forEach(function (side) {
        part(length / 2 + .04, bus ? 1.53 : 1.48, side * width * .31, .13, .3, bus ? .62 : .46, headlamp);
        part(-length / 2 - .04, bus ? 1.59 : 1.49, side * width * .31, .13, .34, .38, red);
        var radius = bus ? .7 : .58;
        [-1, 1].forEach(function (axle) {
          var dx = axle * length * .31, dz = side * (width / 2 + .035);
          var wx = x + dx * c - dz * s, wz = z + dx * s + dz * c;
          append(wheel, rubber, wx, .25 + radius, wz, radius, .34, radius, -heading, true);
          var outside = side * .18;
          append(wheel, metal, wx - outside * s, .25 + radius, wz + outside * c, radius * .44, .025, radius * .44, -heading, true);
        });
      });
      var rect = footprint(x, z, width + .46, length + .22, bus ? 'parked-bus' : 'parked-taxi',
        { id: (bus ? 'station-bus-' : 'station-taxi-') + index, heading: heading,
          bottom: .25, top: bus ? 4.27 : 3.2, color: bus ? '#477d70' : '#ecc654' });
      details.vehicles.push(rect); details.parkedVehicles++;
      if (bus) details.buses++; else details.taxis++;
      activeVehicle=null;
    }
    [-17, -5, 7].forEach(function (x, index) { bay(x, -7, 7, 16, 'bus'); vehicle(x, -7, true, index); });
    [-18, -8, 2, 12].forEach(function (x, index) { bay(x, 18, 6, 9, 'taxi'); vehicle(x, 18, false, index); });

    // All names and painted bay legends use one atlas and one merged sign mesh.
    box(-5, 9.87, -18.65, 32, 2.8, .38, ivory);
    [-17, 7].forEach(function (x) { box(x, 8.72, -18.65, .24, 1.7, .24, metal); });
    if (root.document && typeof root.document.createElement === 'function') {
      var canvas = root.document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
      var context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#eee8d9'; context.fillRect(0, 0, 1024, 256);
        context.fillStyle = '#335c51'; context.font = '600 82px "Microsoft YaHei", "PingFang SC", sans-serif';
        context.textAlign = 'center'; context.textBaseline = 'middle';
        context.fillText('城市公交 · 出租换乘', 512, 132);
        context.fillStyle = '#65736e'; context.fillRect(0, 256, 1024, 256);
        context.fillStyle = '#f3edd8'; context.font = '700 100px Arial, sans-serif';
        context.fillText('BUS', 256, 388); context.fillText('TAXI', 768, 388);
        var texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
        texture.name = 'transit-sign-atlas'; textures.push(texture);
        var signMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: .83, metalness: 0 });
        signMaterial.name = 'transit-signs'; materials.push(signMaterial);
        var points = [], uvs = [];
        function sign(x, y, z, w, h, part, ground, reverse) {
          var geometry = new THREE.PlaneGeometry(w, h), positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
          var v = new THREE.Vector3();
          matrix.makeRotationX(ground ? -Math.PI / 2 : 0);
          if (reverse) matrix.makeRotationY(Math.PI);
          matrix.setPosition(x, y, z);
          for (var i = 0; i < geometry.index.count; i++) {
            var at = geometry.index.getX(i); v.fromBufferAttribute(positions, at).applyMatrix4(matrix);
            points.push(v.x, v.y, v.z);
            uvs.push(part === 0 ? uv.getX(at) : uv.getX(at) * .5 + (part === 2 ? .5 : 0), uv.getY(at) * .5 + (part === 0 ? .5 : 0));
          }
          geometry.dispose(); details.signs++;
        }
        sign(-5, 9.87, -18.435, 31.6, 2.6, 0, false, false);
        sign(-5, 9.87, -18.865, 31.6, 2.6, 0, false, true);
        [-17, -5, 7].forEach(function (x) { sign(x, .294, 2.9, 5.4, 2.7, 1, true); });
        [-18, -8, 2, 12].forEach(function (x) { sign(x, .294, 11.75, 5.2, 2.2, 2, true); });
        var signGeometry = own(new THREE.BufferGeometry());
        signGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        signGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); signGeometry.computeVertexNormals();
        var signMesh = new THREE.InstancedMesh(signGeometry, signMaterial, 1); signMesh.name = 'transit-station-and-bay-signs';
        signMesh.receiveShadow = true; group.add(signMesh); meshes.push(signMesh); details.triangles += points.length / 9;
      }
    }
    batches.forEach(function (batch) {
      var mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
      batch.mesh=mesh;
      if(vehicleParts.some(function(part){return part.batch===batch;}))mesh.frustumCulled=false;
      mesh.name = 'station-batch-' + batch.material.name;
      batch.matrices.forEach(function (transform, index) { mesh.setMatrixAt(index, transform);mesh.setColorAt(index,new THREE.Color(batch.colors[index])); });
      mesh.instanceMatrix.needsUpdate = true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true; mesh.castShadow = batch.material !== asphalt && batch.material !== chalk && batch.material !== glass && batch.material !== red;
      mesh.receiveShadow = true; mesh.computeBoundingSphere(); group.add(mesh); meshes.push(mesh);
      var vertices = batch.geometry.index ? batch.geometry.index.count : batch.geometry.getAttribute('position').count;
      details.triangles += vertices / 3 * batch.matrices.length;
    });
    if(kit.lightPoolMap){
      poolMat=new THREE.MeshBasicMaterial({color:'#ffe0b0',map:kit.lightPoolMap,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});materials.push(poolMat);
      const poolGeo=own(new THREE.PlaneGeometry(1,1));poolGeo.rotateX(-Math.PI/2);
      lightPools=new THREE.InstancedMesh(poolGeo,poolMat,motion.vehicles.length);lightPools.name='station-headlight-pools';lightPools.visible=false;lightPools.frustumCulled=false;group.add(lightPools);meshes.push(lightPools);
      // 站台光池（#7）：候车站台与出租站台各一片，市政照明随 lamps——
      // 与灯带同一时钟，2 实例 1 个 InstancedMesh。
      platformPools=new THREE.InstancedMesh(poolGeo,poolMat,2);platformPools.name='station-platform-pools';platformPools.visible=false;platformPools.frustumCulled=false;
      const pm=new THREE.Matrix4(),pq=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2),pv=new THREE.Vector3(),ps=new THREE.Vector3();
      [[-5,-23,38,7],[-5,25.7,38,3]].forEach(function(a,i){
        pv.set(a[0],.45,a[1]);ps.set(a[2],a[3],1);pm.compose(pv,pq,ps);platformPools.setMatrixAt(i,pm);
      });
      platformPools.instanceMatrix.needsUpdate=true;group.add(platformPools);meshes.push(platformPools);
    }
    details.drawCalls = meshes.length; update(0);
    return controller;
  }
  return { create: create };
});
