/* Small residential districts: shared instance batches, sampled from absolute city time. */
(function (root, factory) {
  'use strict';
  var model = root && root.CityModel;
  if (typeof module === 'object' && module.exports) model = require('./city-model.js');
  var api = factory(model, root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CityHousing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Model, root) {
  'use strict';
  var BASE = 1.4, FLOOR = 6;

  var asset = null, loading = null, phase = 'idle', lastError = null;
  function getStatus() { return { status:phase, ready:phase === 'ready', error:lastError, assetId:asset ? asset.meta.assetId : null, meta:asset ? asset.meta : null }; }
  function load() {
    if (loading) return loading;
    phase = 'loading'; lastError = null;
    loading = Promise.resolve().then(async function () {
      var supplied = root.CityHousingAsset, T = root.THREE, loader = root.CityGLTFLoader;
      if (!T || !loader || !supplied) throw new Error('The local housing GLB and loader are required.');
      if (supplied.meta.assetId !== 'housing-residential-v2' || supplied.meta.floorHeight !== FLOOR) throw new Error('Incompatible housing asset contract.');
      var required=['Window','Balcony','Entry','Cornice','RoofEdge','Planter','Service_A','Service_B','Service_C'];
      if (!Array.isArray(supplied.meta.modules) || supplied.meta.modules.length !== required.length || !required.every(n=>supplied.meta.modules.some(m=>m.name===n)) ||
          !supplied.meta.types || !['courtyard','slab','terrace','point'].every(type=>Array.isArray(supplied.meta.types[type])&&supplied.meta.types[type].length===(type==='courtyard'||type==='terrace'?3:2)&&supplied.meta.types[type].every(v=>Array.isArray(v)&&v.length===5&&v.every(Number.isFinite)))) throw new Error('Incomplete housing module manifest.');
      var binary = root.atob(supplied.base64), bytes = new Uint8Array(binary.length);
      for (var i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
      var data = supplied.compression === 'gzip' ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer() : bytes.buffer;
      var gltf = await new loader.GLTFLoader().parseAsync(data, ''), modules = {}, sourceGeometry = new Set(), sourceMaterials = new Set();
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse(function (n) { if(n.isMesh){sourceGeometry.add(n.geometry);(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>sourceMaterials.add(m));} });
      try {
        for (var definition of supplied.meta.modules) {
          var node = gltf.scene.getObjectByName(definition.node), chunks=[];
          if (!node) throw new Error('Missing housing module '+definition.node);
          var inverse = new T.Matrix4().copy(node.matrixWorld).invert();
          try {
            node.traverse(function (child) {
              if (!child.isMesh) return;
              if (Array.isArray(child.material) || child.material.map) throw new Error('Housing modules require untextured material primitives.');
              var geometry=child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
              geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,child.matrixWorld));
              var color=child.material.color, colors=new Float32Array(geometry.attributes.position.count*3), authored=geometry.getAttribute('color');
              for(var v=0;v<geometry.attributes.position.count;v++){colors[v*3]=color.r*(authored?authored.getX(v):1);colors[v*3+1]=color.g*(authored?authored.getY(v):1);colors[v*3+2]=color.b*(authored?authored.getZ(v):1);}
              for(var key of Object.keys(geometry.attributes))if(key!=='position'&&key!=='normal')geometry.deleteAttribute(key);
              geometry.setAttribute('color',new T.BufferAttribute(colors,3));chunks.push(geometry);
            });
            var merged=loader.mergeGeometries(chunks,false);
            if(!merged)throw new Error('Cannot batch housing module '+definition.name);
            merged.computeBoundingBox();merged.computeBoundingSphere();modules[definition.name]=merged;
            if (!Array.from(merged.attributes.position.array).every(Number.isFinite) || !merged.boundingBox.min.toArray().concat(merged.boundingBox.max.toArray()).every(Number.isFinite)) throw new Error('Non-finite housing geometry '+definition.name);
            if(merged.attributes.position.count/3!==definition.triangles)throw new Error('Housing triangle manifest mismatch '+definition.name);
          } finally { chunks.forEach(g=>g.dispose()); }
        }
        asset={THREE:T,modules:modules,meta:supplied.meta};phase='ready';return getStatus();
      } catch(error){Object.values(modules).forEach(g=>g.dispose());throw error;}
      finally {sourceGeometry.forEach(g=>g.dispose());sourceMaterials.forEach(m=>m.dispose());}
    }).catch(function(error){phase='error';lastError=error.message||String(error);loading=null;throw error;});
    return loading;
  }
  function canRefine(T,b,settings) {
    var expected=asset && asset.meta.types[b.housing.type];
    return !!expected && asset.THREE === T && settings.housingBlenderModel !== false &&
      b.housing.volumes.length === expected.length && b.housing.volumes.every(function(v,i){return v.x===expected[i][0]&&v.z===expected[i][1]&&v.w===expected[i][2]&&v.d===expected[i][3];});
  }


  // Window identity stays local to its wing; neither a new minute nor a moved lot
  // rerolls which households are awake. Canvas uses these same pure decisions.
  function windowRank(b, v, floor, axis, sign, col) {
    var key = [b.id, v.x, v.z, floor, axis, sign, col].join(':'), hash = 2166136261;
    for (var i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
    return ((hash >>> 0) + .5) / 4294967296;
  }
  function lightFor(b, view, bindings) {
    var id = bindings && bindings.byMapId && bindings.byMapId[b.id];
    var entry = view && view.byBuilding && view.byBuilding[id || b.id];
    return entry ? Math.max(0, Math.min(1, Number(entry.lightLevel) || 0)) : 0;
  }
  function paletteFor(b) {
    var type = b.housing.type;
    return Object.assign({}, b.housing.palette, { wall:type === 'slab' ? '#e3e6d9' : type === 'point' ? '#e1dacc' : '#ece5d9', trim:'#d2c6b4', accent:type === 'slab' ? '#7f8c75' : '#b48b74', glass:'#8fa9ab', dark:'#465657', metal:'#718078', green:'#7d906f', wood:'#a58460', solar:'#46616a' });
  }
  // Both painters read these proportions; type changes finish, never the plan.
  function detailsFor(b) {
    var type = b.housing.type, court = type === 'courtyard', slab = type === 'slab', point = type === 'point';
    return { band: court ? .06 : slab ? .22 : point ? .08 : .12, bandHeight: court ? .08 : .1,
      frame: court ? .26 : .22, core: court ? 'wood' : slab ? 'accent' : point ? 'metal' : 'trim',
      cheek: court ? 'wood' : point ? 'metal' : 'trim', canopy: court ? 'wood' : slab ? 'trim' : 'metal',
      canopyWidth: court ? 4.05 : slab ? 4.6 : point ? 3.2 : 3.6,
      parapet: court ? .42 : slab ? .6 : point ? .7 : .9, roofRole: court ? 'wood' : point ? 'metal' : 'trim' };
  }

  function create(T, kit, city, settings) {
    kit = kit || {}; city = city || {}; settings = settings || {};
    var group = new T.Group(); group.name = 'city-housing';
    var buildings = [], batches = new Map(), materials = [], geometries = [], disposed = false, time = null;
    var lightAnchors = [];
    var townView = null, townBindings = null;
    var features = { windows: 0, balconies: 0, entrances: 0, stairCores: 0, planters: 0, courtyardTrees: 0, solarPanels: 0, dryingRacks: 0, waterTanks: 0 };
    var position = new T.Vector3(), scale = new T.Vector3(), quaternion = new T.Quaternion();
    var matrix = new T.Matrix4(), parentMatrix = new T.Matrix4(), hidden = new T.Matrix4().makeScale(0, 0, 0);
    var tint = new T.Color(), angles = new T.Euler(), roles = {}, shapes = {};
    var doorLeaves = [];
    var doorLocal = new T.Matrix4(), doorTmp = new T.Matrix4(), doorAxis = new T.Vector3(0, 1, 0);
    // Housing keeps `open` for entry lights but its unit doors close at night;
    // travel comes from the town view snapshot, never recomputed here.
    function doorTravelFor(record) {
      var id = townBindings && townBindings.byMapId && townBindings.byMapId[record.b.id];
      var entry = townView && townView.byBuilding && townView.byBuilding[id || record.b.ledgerId || 'h-' + record.b.housing.type];
      return entry ? Math.max(0, Math.min(1, Number(entry.doorOpen) || 0)) : 0;
    }
    // The leaf turns around its street-side stile; travel 0 leaves part.local untouched.
    function doorLocalFor(item, travel) {
      var hinge = item.door.hinge;
      doorLocal.makeTranslation(-hinge[0], -hinge[1], -hinge[2]);
      doorTmp.makeRotationAxis(doorAxis, item.door.angle * travel);
      doorLocal.premultiply(doorTmp);
      doorTmp.makeTranslation(hinge[0], hinge[1], hinge[2]);
      doorLocal.premultiply(doorTmp);
      return doorLocal;
    }

    function material(name, base, parameters) {
      var result = base && base.clone ? base.clone() : new T.MeshStandardMaterial();
      result.name = 'housing-' + name; result.color.set('#ffffff');
      Object.assign(result, { roughness: .83, metalness: .02, transparent: false, opacity: 1, depthWrite: true }, parameters || {});
      // Cloning borrows texture references; this renderer never releases shared kit textures.
      materials.push(result); return result;
    }
    function initialize() {
      roles.wall = material('wall', kit.sand || kit.stone);
      roles.trim = material('trim', kit.stone);
      roles.accent = material('accent', kit.stone);
      roles.dark = material('recess', kit.stone, { roughness: .95 });
      roles.glass = material('glass', kit.glass, { roughness: .24, metalness: .08, transparent: true, opacity: .82, depthWrite: false, transmission: 0 });
      roles.lit = material('lit', null, { color:new T.Color('#ffe0ad'), emissive:new T.Color('#ffd69a'), emissiveIntensity:1.45, roughness:.72, metalness:0 });
      roles.metal = material('metal', kit.metal, { roughness: .48, metalness: .48 });
      roles.green = material('planting', kit.leaf || kit.grass, { roughness: .98 });
      roles.wood = material('timber', null);
      roles.solar = material('solar', kit.metal, { roughness: .31, metalness: .38 });
      shapes.box = new T.BoxGeometry(1, 1, 1);
      shapes.leaf = new T.IcosahedronGeometry(1, 1);
      shapes.tank = new T.CylinderGeometry(1, 1, 1, 12);
      geometries.push(shapes.box, shapes.leaf, shapes.tank);
    }
    function refinedPart(owner, name, x, y, z, sx, sy, yaw) {
      if (!shapes[name]) {
        shapes[name]=asset.modules[name].clone(); geometries.push(shapes[name]);
        if (!roles.refined) roles.refined=material('blender-architecture', null, {vertexColors:true,roughness:.72,metalness:.05});
      }
      return part(owner,'refined','#ffffff',name,x,y,z,sx||1,sy||1,1,0,yaw||0,0);
    }
    function state(record, kind, floor, volume) {
      var entry = { record: record, kind: kind, floor: floor, volume: volume, parts: [], last: null,
        bounds: { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity } };
      record.states.push(entry); return entry;
    }
    function part(owner, role, color, shape, x, y, z, w, h, d, rx, ry, rz) {
      position.set(x, y, z); scale.set(w, h, d);
      quaternion.setFromEuler(angles.set(rx || 0, ry || 0, rz || 0));
      var local = new T.Matrix4().compose(position, quaternion, scale);
      var key = role + '/' + shape;
      if (!batches.has(key)) batches.set(key, { key: key, role: role, shape: shape, parts: [] });
      var batch = batches.get(key), item = { local: local, owner: owner, color: color, batch: batch, index: batch.parts.length };
      batch.parts.push(item); owner.parts.push(item);
      // Bounds include yaw/roof tilts and are used to retain falling details inside the lot.
      if (!shapes[shape].boundingBox) shapes[shape].computeBoundingBox();
      var box = shapes[shape].boundingBox.clone().applyMatrix4(local);
      owner.bounds.minX = Math.min(owner.bounds.minX, box.min.x); owner.bounds.maxX = Math.max(owner.bounds.maxX, box.max.x);
      owner.bounds.minZ = Math.min(owner.bounds.minZ, box.min.z); owner.bounds.maxZ = Math.max(owner.bounds.maxZ, box.max.z);
      return item;
    }
    function box(owner, role, color, x, y, z, w, h, d, yaw) { return part(owner, role, color, 'box', x, y, z, w, h, d, 0, yaw || 0, 0); }
    function occupied(record, volume, floor, x, z, clearance) {
      return record.volumes.some(function (other) {
        return other !== volume && other.floors > floor && Math.abs(x - other.x) < other.w / 2 + clearance && Math.abs(z - other.z) < other.d / 2 + clearance;
      });
    }
    // 'x' balconies face the +/-X sides; 'z' balconies face the +/-Z sides.
    function facade(record, owner, volume, floor, onX, sign) {
      var detail = record.detail;
      var span = onX ? volume.d : volume.w, cols = Math.max(1, Math.floor((span - 2) / 4.7));
      var spacing = (span - 2) / cols, face = (onX ? volume.w : volume.d) / 2;
      function facing(role, color, u, y, out, width, height, depth) {
        return box(owner, role, color, volume.x + (onX ? sign * (face + out) : u), y,
          volume.z + (onX ? u : sign * (face + out)), onX ? depth : width, height, onX ? width : depth);
      }
      for (var col = 0; col < cols; col++) {
        var u = (col - (cols - 1) / 2) * spacing;
        // Apartment windows leave one continuous stair strip and a proper entrance bay.
        if (!onX && sign < 0 && (Math.abs(u + volume.w * .32) < 1.8 || (floor === 0 && Math.abs(u - volume.w * .15) < 2.1))) continue;
        var px = volume.x + (onX ? sign * (face + 1) : u), pz = volume.z + (onX ? u : sign * (face + 1));
        if (occupied(record, volume, floor, px, pz, 1)) continue;
        var balcony = floor > 0 && (volume.balconies === 'both' || volume.balconies === (onX ? 'x' : 'z')) && (col + floor % 2) % 2 === 0;
        var width = Math.min(balcony ? 2.4 : 1.95, spacing - .8), height = balcony ? 3.5 : 2.55, center = balcony ? 2.1 : 3.05;
        // A dark reveal and pale surround give small household windows actual depth.
        if (record.refined) refinedPart(owner,'Window',volume.x+(onX?sign*face:u),center,volume.z+(onX?u:sign*face),width/1.95,height/2.55,onX?sign*Math.PI/2:sign<0?Math.PI:0);
        else {
          facing('trim', record.colors.trim, u, center, .09, width + detail.frame, height + detail.frame, .3);
          facing('dark', record.colors.dark, u, center, .25, width + .1, height + .08, .15);
        }
        facing('glass', record.colors.glass, u, center, .35, width, height, .09);
        lightAnchors.push({building:record.b,ledgerId:record.b.ledgerId||'h-'+record.b.housing.type,floor:floor,
          local:[volume.x+(onX?sign*(face+.405):u),center,volume.z+(onX?u:sign*(face+.405)),onX?.035:width,height,onX?width:.035]});
        var pane = facing('lit', '#ffffff', u, center, .409, width * .94, height * .96, .025);
        pane.rank = windowRank(record.b, volume, floor, onX ? 'x' : 'z', sign, col);
        record.lights.push(pane);
        if (!record.refined) {
          facing('trim', record.colors.trim, u, center, .415, .055, height, .1);
          facing('trim', record.colors.trim, u, center - height / 2 - .1, .26, width + .3, .1, .42);
        }
        features.windows++;
        if (!balcony) continue;
        var bw = Math.min(3.4, spacing - .3);
        if(record.refined){refinedPart(owner,'Balcony',volume.x+(onX?sign*face:u),0,volume.z+(onX?u:sign*face),bw/3.4,1,onX?sign*Math.PI/2:sign<0?Math.PI:0);features.balconies++;features.planters++;continue;}
        facing('trim', record.colors.trim, u, .22, .86, bw, .16, 1.7);
        // Alternating solid cheeks and tinted glass fronts make inhabited loggias.
        facing((floor + col) % 3 ? 'glass' : 'accent', record.colors[(floor + col) % 3 ? 'glass' : 'accent'], u, 1.05, 1.63, bw - .2, 1.28, .12);
        facing('metal', record.colors.metal, u, 1.75, 1.64, bw, .075, .13);
        for (var edge = -1; edge <= 1; edge += 2) {
          facing('metal', record.colors.metal, u + edge * (bw / 2 - .05), 1.02, 1.64, .09, 1.45, .11);
          facing(detail.cheek, record.colors[detail.cheek], u + edge * (bw / 2 - .08), .9, .83, .1, 1.2, 1.5);
        }
        if ((floor + col) % 4 === 0) {
          facing('accent', record.colors.accent, u + bw * .22, .63, 1.27, .75, .55, .42);
          facing('green', record.colors.green, u + bw * .22, .98, 1.27, .85, .34, .46);
          features.planters++;
        }
        if (record.b.housing.type === 'terrace' && (floor + col) % 5 === 1) {
          // Laundry and a small outdoor unit sit behind the existing balcony rail.
          facing('wood', '#dfbd8b', u - bw * .22, 1.48, 1.18, .82, .78, .04);
          facing('trim', '#c5ccc0', u + bw * .2, .59, .62, .86, .56, .46);
        }
        features.balconies++;
      }
    }
    function floorModule(record, owner, volume, floor) {
      var w = volume.w, d = volume.d, x = volume.x, z = volume.z, detail = record.detail;
      box(owner, 'wall', record.colors.wall, x, 3, z, w, 5.83, d);
      if(record.refined){for(var edge=-1;edge<=1;edge+=2){refinedPart(owner,'Cornice',x,5.91,z+edge*d/2,w,1,0);refinedPart(owner,'Cornice',x+edge*w/2,5.91,z,d,1,Math.PI/2);}}
      else box(owner, 'trim', record.colors.trim, x, 5.91, z, w + detail.band, detail.bandHeight, d + detail.band);
      for (var sign = -1; sign <= 1; sign += 2) {
        facade(record, owner, volume, floor, false, sign);
        facade(record, owner, volume, floor, true, sign);
      }
      // The same vertical stair bay aligns through every module and is visibly distinct from apartments.
      var coreX = x - w * .32;
      if (!occupied(record, volume, floor, coreX, z - d / 2 - .5, .5)) {
        box(owner, detail.core, record.colors[detail.core], coreX, 3, z - d / 2 - .16, 1.55, 6, .36);
        box(owner, 'glass', record.colors.glass, coreX, 3.45, z - d / 2 - .38, .69, 3.8, .1);
        box(owner, 'trim', record.colors.trim, coreX, 3.5, z - d / 2 - .46, .78, .16, .08);
        if (floor === 0) features.stairCores++;
      }
      if (floor === 0) {
        var entranceZ = z - d / 2, entranceX = x + w * .15;
        if (!occupied(record, volume, floor, entranceX, entranceZ - 1.4, 1.3)) {
          if(record.refined) refinedPart(owner,'Entry',entranceX,0,entranceZ,1,1,Math.PI);
          else box(owner, 'accent', record.colors.accent, entranceX, 2, entranceZ - .23, 3.15, 4, .5);
          // The leaf and its glazed panel swing together around the street-side
          // stile; the frame, canopy and steps are wall furniture and stay put.
          var doorHinge = [entranceX - 1.2, 1.8, entranceZ - .52];
          var doorPanel = box(owner, 'dark', record.colors.dark, entranceX, 1.8, entranceZ - .52, 2.4, 3.6, .12);
          var doorGlazing = box(owner, 'glass', record.colors.glass, entranceX, 1.95, entranceZ - .6, 2.08, 2.8, .08);
          doorPanel.door = doorGlazing.door = { hinge: doorHinge, angle: 1.45 };
          doorLeaves.push(doorPanel, doorGlazing);
          if(!record.refined) {
          box(owner, 'trim', record.colors.trim, entranceX, 1.8, entranceZ - .66, .09, 3.6, .1);
          box(owner, detail.canopy, record.colors[detail.canopy], entranceX, 4.16, entranceZ - .87, detail.canopyWidth, .22, 1.7);
          box(owner, 'accent', record.colors.accent, entranceX, 4.39, entranceZ - .45, 2.05, .3, .2);
          }
          // Three shallow entry steps meet the shared 0.25 pavement and the raised floor.
          box(record.ground, 'trim', record.colors.trim, entranceX, .425, entranceZ - 1.5, 3.4, .35, 1.1);
          box(record.ground, 'trim', record.colors.trim, entranceX, .6, entranceZ - 1.03, 3.2, .7, .85);
          box(record.ground, 'trim', record.colors.trim, entranceX, .825, entranceZ - .64, 3, 1.15, .5);
          if (record.b.housing.type === 'terrace' && !record.refined) {
            // Timber edge beams and spaced rafters keep a legible recess above the door.
            for (var edge = -1; edge <= 1; edge += 2) {
              box(owner, 'wood', record.colors.wood, entranceX, 4.44, entranceZ - .86 + edge * .78, 4.1, .2, .18);
              box(owner, 'wood', record.colors.wood, entranceX + edge * 1.68, 2.15, entranceZ - .58, .18, 4.05, .25);
            }
            for (var rafter = -3; rafter <= 3; rafter++) box(owner, 'wood', record.colors.wood, entranceX + rafter * .58, 4.53, entranceZ - .86, .12, .16, 1.8);
            box(owner, 'accent', '#667c6c', entranceX + 2.5, 2.35, entranceZ - .27, 1.25, 1.7, .22);
            for (var mail = 0; mail < 3; mail++) box(owner, 'trim', '#e4d8be', entranceX + 2.5, 1.94 + mail * .4, entranceZ - .41, .93, .06, .04);
          }
          var lamp = [entranceX, 3.97, entranceZ - .87, 1.24, .12, .34];
          box(owner, 'metal', record.colors.trim, lamp[0], lamp[1], lamp[2], lamp[3], lamp[4], lamp[5]);
          lightAnchors.push({building:record.b,ledgerId:record.b.ledgerId||'h-'+record.b.housing.type,floor:0,layer:'entry',local:lamp});
          features.entrances++;
        }
      }
    }
    function planter(owner, record, x, y, z, w, d) {
      box(owner, 'accent', record.colors.accent, x, y + .35, z, w, .7, d);
      box(owner, 'green', record.colors.green, x, y + .83, z, w * .92, .45, d * .9); features.planters++;
    }
    function roofModule(record, owner, volume, index) {
      var x = volume.x, z = volume.z, w = volume.w, d = volume.d, detail = record.detail;
      if(record.refined){
        box(owner,'trim',record.colors.trim,x,.14,z,w+.65,.28,d+.65);
        box(owner,'wall',record.colors.wall,x,.34,z,w-.7,.12,d-.7);
        for(var side=-1;side<=1;side+=2){
          refinedPart(owner,'RoofEdge',x,0,z+side*(d/2-.13),w,1,0);
          refinedPart(owner,'RoofEdge',x+side*(w/2-.13),0,z,d,1,Math.PI/2);
          refinedPart(owner,'Planter',x+side*w*.27,0,z+d*.27,Math.min(5,w*.3)/5,1,0);
        }
        refinedPart(owner,'Service_'+String.fromCharCode(65+index),x,0,z-d*.22,1,1,0);
        features.planters+=2;if(index===0)features.solarPanels+=2;else if(index===1)features.waterTanks++;else features.dryingRacks++;return;
      }
      box(owner, 'trim', record.colors.trim, x, .14, z, w + .65, .28, d + .65);
      box(owner, 'accent', '#cdc4b3', x, .33, z, w - .7, .1, d - .7);
      for (var sign = -1; sign <= 1; sign += 2) {
        box(owner, detail.roofRole, record.colors[detail.roofRole], x, .3 + detail.parapet / 2, z + sign * (d / 2 - .12), w, detail.parapet, .25);
        box(owner, detail.roofRole, record.colors[detail.roofRole], x + sign * (w / 2 - .12), .3 + detail.parapet / 2, z, .25, detail.parapet, d);
      }
      if (record.b.housing.type === 'terrace' || volume.floors < record.b.floors) {
        planter(owner, record, x - w * .27, .39, z + d * .27, Math.min(5, w * .3), 1.3);
        planter(owner, record, x + w * .27, .39, z + d * .27, Math.min(5, w * .3), 1.3);
      }
      if (record.b.housing.type === 'terrace') {
        // One service strip per roof; timber screening unifies tanks, racks and panels.
        var serviceZ = z - d * .22, serviceW = Math.min(w - 1.8, 8.8);
        box(owner, 'trim', record.colors.trim, x, .48, serviceZ, serviceW, .2, 5.8);
        box(owner, 'wood', record.colors.wood, x, 1.05, serviceZ - 2.65, serviceW, .85, .12);
        if (index === 0) {
          box(owner, 'wall', record.colors.wall, x - serviceW * .26, 1.25, serviceZ, 2.7, 1.35, 3.5);
          for (var panel = -1; panel <= 1; panel += 2) {
            box(owner, 'metal', record.colors.metal, x + serviceW * .21, .77, serviceZ + panel * 1.27, 2.8, .4, 2.25);
            part(owner, 'solar', record.colors.solar, 'box', x + serviceW * .21, 1.08, serviceZ + panel * 1.27, 2.9, .12, 2.3, -.17, 0, 0); features.solarPanels++;
          }
        } else if (index === 1) {
          part(owner, 'metal', '#aeb9b2', 'tank', x, 1.65, serviceZ, 1.22, 2.1, 1.22, 0, 0, 0); features.waterTanks++;
        } else {
          for (var side = -1; side <= 1; side += 2) box(owner, 'metal', record.colors.metal, x + side * 2, 1.5, serviceZ, .1, 1.8, .1);
          box(owner, 'metal', record.colors.metal, x, 2.4, serviceZ, 4.16, .1, .1);
          for (var linen = -1; linen <= 1; linen++) box(owner, 'trim', record.colors.trim, x + linen, 1.8, serviceZ, .72, 1, .045); features.dryingRacks++;
        }
        return;
      }
      if (index % 3 === 0) {
        // Low rooftop service room and two individual solar panels, away from parapets.
        box(owner, 'wall', record.colors.wall, x - w * .23, 1.35, z - d * .18, Math.min(3.6, w * .24), 2.1, Math.min(3, d * .24));
        for (var n = 0; n < 2; n++) {
          var panelX = x + w * .2, panelZ = z + (n - .5) * Math.min(3, d * .25);
          box(owner, 'metal', record.colors.metal, panelX, .72, panelZ, Math.min(3, w * .25), .5, Math.min(2.5, d * .22));
          part(owner, 'solar', record.colors.solar, 'box', panelX, 1.08, panelZ, Math.min(3.2, w * .27), .12, Math.min(2.6, d * .23), -.17, 0, 0);
          features.solarPanels++;
        }
      } else if (index % 3 === 1) {
        part(owner, 'metal', '#aab5b3', 'tank', x - w * .22, 1.55, z - d * .16, 1.22, 2.3, 1.22, 0, 0, 0);
        features.waterTanks++;
      } else {
        var rackWidth = Math.min(4.4, w * .46), rackZ = z - d * .12;
        for (var edge = -1; edge <= 1; edge += 2) box(owner, 'metal', record.colors.metal, x + edge * rackWidth / 2, 1.36, rackZ, .1, 2, .1);
        box(owner, 'metal', record.colors.metal, x, 2.36, rackZ, rackWidth + .16, .1, .1);
        for (var cloth = 0; cloth < 3; cloth++) box(owner, cloth % 2 ? 'accent' : 'trim', record.colors[cloth % 2 ? 'accent' : 'trim'], x + (cloth - 1) * rackWidth * .25, 1.7, rackZ, rackWidth * .18, 1.1, .045);
        features.dryingRacks++;
      }
    }
    function garden(record, owner) {
      var site = record.b.housing.courtyard; if (!site) return;
      box(owner, 'green', '#90a574', site.x, .285, site.z, site.w, .07, site.d);
      if (record.b.housing.type === 'terrace') {
        box(owner, 'trim', '#e0d4bd', site.x, .33, site.z, 1.35, .03, site.d);
        box(owner, 'trim', '#e0d4bd', site.x, .34, site.z, site.w * .72, .03, 1.25);
        planter(owner, record, site.x - site.w * .32, .29, site.z + site.d * .32, 2.2, 1.15);
      }
      var acrossX = site.w >= site.d, width = Math.min(2.8, site.w - .8), depth = Math.min(2.8, site.d - .8);
      for (var sign = -1; sign <= 1; sign += 2) {
        var x = site.x + (acrossX ? sign * site.w * .31 : 0), z = site.z + (acrossX ? 0 : sign * site.d * .31);
        var radius = Math.min(1.5, width / 2, depth / 2);
        box(owner, 'wood', record.colors.wood, x, 1.15, z, .27, 1.8, .27);
        part(owner, 'green', record.colors.green, 'leaf', x, 2.65, z, radius, 1.65, radius, 0, 0, 0);
        features.courtyardTrees++;
      }
      var bx = site.x + (acrossX ? 0 : Math.min(3, site.w * .28)), bz = site.z + (acrossX ? Math.min(2, site.d * .26) : 0);
      box(owner, 'wood', record.colors.wood, bx, .9, bz, Math.min(3.4, site.w * .45), .18, 1);
      box(owner, 'wood', record.colors.wood, bx, 1.4, bz + .45, Math.min(3.4, site.w * .45), .8, .15);
      for (var edge = -1; edge <= 1; edge += 2) box(owner, 'metal', record.colors.metal, bx + edge * Math.min(1.25, site.w * .16), .56, bz, .16, .63, .85);
    }
    (city.buildings || []).forEach(function (b, cityIndex) {
      if (b.kind !== 'housing' || !b.housing || !Array.isArray(b.housing.volumes) || !b.housing.volumes.length) return;
      if (!buildings.length) initialize();
      var record = { b: b, refined:canRefine(T,b,settings), colors: paletteFor(b), detail: detailsFor(b), cityIndex: cityIndex, states: [], lights: [], lightLevel:0, litWindows:0, lightKey:null, volumes: b.housing.volumes.map(function (v) { return Object.assign({}, v); }), sample: null };
      buildings.push(record);
      var ground = state(record, 'ground', -1, -1); record.ground = ground;
      garden(record, ground);
      record.volumes.forEach(function (v) { box(ground, 'trim', '#d6cfc2', v.x, .82, v.z, v.w + .7, 1.14, v.d + .7); });
      for (var floor = 0; floor < b.floors; floor++) {
        var module = state(record, 'floor', floor, -1);
        record.volumes.forEach(function (v) { if (v.floors > floor) floorModule(record, module, v, floor); });
      }
      record.volumes.forEach(function (volume, index) { roofModule(record, state(record, 'roof', volume.floors, index), volume, index); });
    });
    batches.forEach(function (batch) {
      var mesh = new T.InstancedMesh(shapes[batch.shape], roles[batch.role], batch.parts.length);
      mesh.name = 'housing-' + batch.key.replace('/', '-'); mesh.castShadow = batch.role !== 'glass' && batch.role !== 'lit'; mesh.receiveShadow = true;
      mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      mesh.userData.instances = batch.parts.map(function (item) { return { buildingId: item.owner.record.b.id, buildingIndex: item.owner.record.cityIndex, kind: item.owner.kind, floor: item.owner.floor, volume: item.owner.volume }; });
      mesh.userData.buildingIds = batch.parts.map(function(item){return item.owner.record.b.id;});
      batch.parts.forEach(function (item) { mesh.setMatrixAt(item.index, hidden); mesh.setColorAt(item.index, tint.set(item.color)); });
      mesh.instanceColor.needsUpdate = true; batch.mesh = mesh; group.add(mesh);
    });

    function refreshLights() {
      var batch = batches.get('lit/box'); if (!batch) return;
      var changed = false;
      buildings.forEach(function (record) {
        var level = lightFor(record.b, townView, townBindings), built = record.sample ? record.sample.builtFloors : 0;
        var key = [level, built, record.b.x, record.b.z].join('|'); if (record.lightKey === key) return;
        record.lightKey = key; record.lightLevel = level; record.litWindows = 0;
        record.lights.forEach(function (item) {
          var lit = item.rank < level && item.owner.floor < built;
          if (lit) { parentMatrix.makeTranslation(record.b.x, BASE + item.owner.floor * FLOOR, record.b.z); matrix.multiplyMatrices(parentMatrix, item.local); record.litWindows++; }
          batch.mesh.setMatrixAt(item.index, lit ? matrix : hidden);
        }); changed = true;
      });
      if (changed) { batch.mesh.instanceMatrix.needsUpdate = true; batch.mesh.boundingSphere = null; batch.mesh.boundingBox = null; }
    }
    function setTownView(view, bindings) {
      if (disposed) return;
      townView = view; townBindings = bindings; refreshLights(); refreshDoors();
    }
    // Minute ticks arrive through setTownView once construction has settled and
    // update() runs its early-out. Falling or unbuilt entrances keep their
    // update()-owned hidden/falling matrices and are skipped here.
    function refreshDoors() {
      if (!doorLeaves.length) return;
      doorLeaves.forEach(function (item) {
        var record = item.owner.record, sample = record.sample;
        if (!sample || sample.builtFloors < 1 || sample.falling.some(function (fall) { return fall.floor === 0; })) return;
        var travel = doorTravelFor(record);
        record.doorTravel = travel;
        parentMatrix.makeTranslation(record.b.x, BASE + item.owner.floor * FLOOR, record.b.z);
        item.batch.mesh.setMatrixAt(item.index, matrix.multiplyMatrices(parentMatrix, doorLocalFor(item, travel)));
        item.batch.mesh.instanceMatrix.needsUpdate = true;
        item.batch.mesh.boundingSphere = null; item.batch.mesh.boundingBox = null;
      });
    }
    function boundedYaw(owner, yaw) {
      var b = owner.record.b, bounds = owner.bounds;
      function fits(value) {
        var cos = Math.cos(value), sin = Math.sin(value);
        return [bounds.minX, bounds.maxX].every(function (x) { return [bounds.minZ, bounds.maxZ].every(function (z) {
          return Math.abs(cos * x + sin * z) <= b.w / 2 - .001 && Math.abs(-sin * x + cos * z) <= b.d / 2 - .001;
        }); });
      }
      if (fits(yaw)) return yaw;
      var low = 0, high = 1;
      for (var n = 0; n < 18; n++) { var mid = (low + high) / 2; if (fits(yaw * mid)) low = mid; else high = mid; }
      return yaw * low;
    }
    function update(nextTime) {
      if (disposed) return;
      nextTime = Number.isFinite(nextTime) ? nextTime : 0;
      if (nextTime === time && !buildings.some(function (r) { return r.locationKey !== r.b.x + '/' + r.b.z; })) return; time = nextTime;
      buildings.forEach(function (record) {
        var sampled = Model.sampleBuilding(record.b, time); record.sample = sampled;
        record.locationKey = record.b.x + '/' + record.b.z;
        record.doorTravel = doorTravelFor(record);
        record.states.forEach(function (owner) {
          var shown = owner.kind === 'ground', y = 0, yaw = 0, key = 'ground';
          if (owner.kind === 'roof') {
            shown = sampled.builtFloors >= owner.floor; y = BASE + owner.floor * FLOOR; key = shown ? 'roof' : 'hidden';
          } else if (owner.kind === 'floor') {
            shown = owner.floor < sampled.builtFloors; y = BASE + owner.floor * FLOOR; key = shown ? 'built' : 'hidden';
            if (!shown) {
              var falling = sampled.falling.find(function (item) { return item.floor === owner.floor; });
              if (falling) { shown = true; y = BASE + falling.y; yaw = boundedYaw(owner, -falling.rotation); key = y + '/' + yaw; }
            }
          }
          key += '/' + record.locationKey;
          // Leaf travel belongs to the floor-0 owners that carry entrances; without
          // it the settled-state cache would park every door shut after a minute tick.
          if (owner.kind === 'floor' && owner.floor === 0) key += '/door' + record.doorTravel;
          if (owner.last === key) return; owner.last = key;
          quaternion.setFromEuler(angles.set(0, yaw, 0)); position.set(record.b.x, y, record.b.z); scale.set(1, 1, 1);
          parentMatrix.compose(position, quaternion, scale);
          owner.parts.forEach(function (item) {
            if (item.batch.role === 'lit') return;
            var local = item.door ? doorLocalFor(item, record.doorTravel) : item.local;
            item.batch.mesh.setMatrixAt(item.index, shown ? matrix.multiplyMatrices(parentMatrix, local) : hidden);
            item.batch.mesh.instanceMatrix.needsUpdate = true;
            // Three also uses these cached bounds for render sorting and raycast.
            item.batch.mesh.boundingSphere = null; item.batch.mesh.boundingBox = null;
          });
        });
      });
      refreshLights();
    }
    function getInfo() {
      var typeCounts = {}, totalFloors = 0, totalVolumeFloors = 0, builtFloors = 0, builtVolumeFloors = 0, fallingFloorCount = 0, visibleRoofs = 0;
      var entries = buildings.map(function (record) {
        var b = record.b, sample = record.sample;
        typeCounts[b.housing.type] = (typeCounts[b.housing.type] || 0) + 1;
        totalFloors += b.floors; builtFloors += sample.builtFloors; fallingFloorCount += sample.falling.length;
        var volumes = record.volumes.map(function (volume) {
          var built = Math.min(volume.floors, sample.builtFloors), roofVisible = built === volume.floors;
          totalVolumeFloors += volume.floors; builtVolumeFloors += built; if (roofVisible) visibleRoofs++;
          return Object.assign({}, volume, { builtFloors: built, fallingFloors: sample.falling.filter(function (item) { return item.floor < volume.floors; }).map(function (item) { return item.floor; }), roofVisible: roofVisible });
        });
        return { id: b.id, x: b.x, z: b.z, w: b.w, d: b.d, type: b.housing.type, label: b.housing.label, floors: b.floors, floorHeight: FLOOR,
          builtFloors: sample.builtFloors, fallingFloors: sample.falling.map(function (item) { return item.floor; }), complete: sample.complete, volumes: volumes };
      });
      var instances = 0; batches.forEach(function (batch) { instances += batch.parts.length; });
      return { activeAssetId:buildings.some(r=>r.refined)?asset.meta.assetId:null, refinedBuildings:buildings.filter(r=>r.refined).map(r=>r.b.id), buildingCount: buildings.length, typeCounts: typeCounts, buildings: entries, time: time,
        totalFloors: totalFloors, totalVolumeFloors: totalVolumeFloors, builtFloors: builtFloors, builtVolumeFloors: builtVolumeFloors,
        fallingFloorCount: fallingFloorCount, visibleRoofs: visibleRoofs, features: Object.assign({}, features), lights: buildings.map(function(r){return {id:townBindings&&townBindings.byMapId&&townBindings.byMapId[r.b.id]||r.b.id,mapId:r.b.id,level:r.lightLevel,windows:r.lights.length,litWindows:r.litWindows};}),
        doors: doorLeaves.map(function (item) {
          var record = item.owner.record;
          return { ledger: townBindings && townBindings.byMapId && townBindings.byMapId[record.b.id] || record.b.ledgerId || 'h-' + record.b.housing.type,
            kind: 'swing', travel: record.doorTravel || 0,
            drawn: !!(record.sample && record.sample.builtFloors > 0) };
        }), drawCalls: batches.size, instances: instances };
    }
    function dispose() {
      if (disposed) return; disposed = true;
      batches.forEach(function (batch) { batch.mesh.dispose(); });
      geometries.forEach(function (geometry) { geometry.dispose(); }); materials.forEach(function (material) { material.dispose(); }); group.clear(); group.removeFromParent();
    }
    update(0);
    return { group: group, update: update, setTownView:setTownView, dispose: dispose, getInfo: getInfo,
      getLightAnchors: function () { return lightAnchors; },
      getGlassMaterials: function () { return roles.glass ? [roles.glass] : []; } };
  }
  return { create: create, load:load, getStatus:getStatus, paletteFor:paletteFor, detailsFor:detailsFor, windowRank:windowRank, lightFor:lightFor };
});
