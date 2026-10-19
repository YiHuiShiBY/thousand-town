/* Shared Blender modules, instanced across an entire deterministically sampled city. */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CityDistrict = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var MODULES = ['Floor_Glass', 'Floor_Stone', 'Floor_Sand', 'Roof_Solar', 'Roof_Garden', 'Roof_Service'];
  var PALETTES = [
    { wall: '#e6eef3', glass: '#63a8bb' }, // silver and ice cyan
    { wall: '#b8c9d7', glass: '#407fa2' }, // brushed steel
    { wall: '#526d80', glass: '#68bac8' }, // graphite with cyan glazing
    { wall: '#d7e4ea', glass: '#438eab' }, // cool ceramic
    { wall: '#95b4c4', glass: '#35677f' }, // blue titanium
    { wall: '#f0f5f5', glass: '#5f9dac' }  // pearl white
  ];
  var ROOF_COLORS = { District_Roof: '#6a8192', District_Leaf: '#6b9044',
    District_Timber: '#9caea9', District_Solar: '#23475f', District_Trim: '#7593a7' };
  var phase = 'idle', lastError = null, loading = null, asset = null;
  var districts = new Set(), activeBuildings = 0, pendingColors = {};

  // The generator's IDs encode source lots. Layout changes move the host, not
  // this architectural identity; neither array order nor world position is used.
  var OFFICE_PROFILES = {
    'b-3-0': { id: 't-one', style: 'fins', label: '冰蓝翼冠', wall: '#69a9df', glass: '#3f95cf', trim: '#b4d5ee' },
    'b-5-0': { id: 't-two', style: 'bands', label: '暖石横带', wall: '#d9cbb7', glass: '#8b9f9d', trim: '#e4dac8' },
    'b-6-0': { id: 't-three', style: 'ribs', label: '深蓝竖脊', wall: '#386da8', glass: '#397fc0', trim: '#8eb4db' },
    'b-9-0': { id: 't-four', style: 'terraces', label: '砂陶绿台', wall: '#e1d1b9', glass: '#8fa29c', trim: '#b48b74' }
  };
  function officeProfile(building) {
    var profile = building && building.kind === 'glass' && !building.facility && !building.housing && OFFICE_PROFILES[building.id];
    return profile ? Object.assign({}, profile) : null;
  }

  // Shared by the GLB overlay, basic Three scene and Canvas. Every box is local
  // to its host. floor is zero-based; roof boxes appear only after completion.
  function officeParts(building) {
    var profile = officeProfile(building), parts = [];
    if (!profile) return parts;
    var floors = building.floors, step = positive(building.floorHeight, 6);
    var cut = floors >= 15 ? Math.floor(floors * .74) : floors;
    function add(kind, x, y, z, w, h, d, color, floor, roof, material) {
      parts.push({ kind: kind, x: x, y: y, z: z, w: w, h: h, d: d,
        color: color, floor: floor, roof: !!roof, material: material || 'cladding' });
    }
    function ring(kind, width, depth, y, h, thickness, color, floor, roof, material) {
      [-1, 1].forEach(function (sign) {
        add(kind, 0, y, sign * (depth / 2 - thickness / 2), width, h, thickness, color, floor, roof, material);
        add(kind, sign * (width / 2 - thickness / 2), y, 0, thickness, h, depth - 2 * thickness, color, floor, roof, material);
      });
    }
    for (var floor = profile.id === 't-two' ? 3 : 0; floor < floors; floor++) {
      var w = building.w * (floor >= cut ? .8 : 1), d = building.d * (floor >= cut ? .86 : 1);
      var base = 1.4 + floor * step;
      ['x', 'z'].forEach(function (axis) {
        var onX = axis === 'x', span = onX ? d : w, across = onX ? w : d;
        var lightSpan = onX ? building.d : building.w;
        var columns = Math.max(2, Math.floor(lightSpan / 7)), spacing = lightSpan / columns * .8;
        function facade(kind, u, y, width, height, projection, color, material) {
          [-1, 1].forEach(function (sign) {
            // The existing GLB trim reaches .37 beyond its module. All new
            // details start at the wall and extend at most 1.0 beyond it.
            var edge = sign * (across / 2 + projection / 2);
            add(kind, onX ? edge : u, y, onX ? u : edge,
              onX ? projection : width, height, onX ? width : projection,
              color, floor, false, material);
          });
        }
        if (profile.style === 'fins') {
          for (var gap = 0; gap < columns - 1; gap++) {
            var u = (gap - (columns - 2) / 2) * spacing;
            if (Math.abs(u) < span / 2 - .7) facade('vertical-fin', u, base + step / 2, .26, step, .62, profile.trim);
          }
          [-1, 1].forEach(function (sign) { facade('vertical-fin', sign * (span / 2 - .28), base + step / 2, .26, step, .62, profile.trim); });
        } else if (profile.style === 'bands') {
          facade('stone-band', 0, base + step - .3, span + .45, .5, .55, profile.trim);
          if (floor % 3 === 0) facade('bronze-inlay', 0, base + step - .66, span, .1, .58, '#8d785a', 'metal');
        } else if (profile.style === 'ribs') {
          // Place the spine between actual occupancy panes, including odd
          // column counts where the centre is itself a lit window.
          var center = columns % 2 ? spacing / 2 : 0;
          facade('central-rib', center, base + step / 2, Math.min(1.2, spacing - 3.15), step, .72, profile.wall);
          if (floor % 3 === 0 || floor === floors - 1) facade('rib-cap', center, base + step - .15, 1.6, .3, .76, profile.trim, 'metal');
        } else {
          [-1, 1].forEach(function (sign) {
            facade('terracotta-panel', sign * span * .26, base + step - .4, span * .44, .8, .5, profile.trim);
            facade('terracotta-pier', sign * (span / 2 - .35), base + step / 2, .4, step, .5, profile.wall);
          });
        }
      });
    }
    var topW = building.w * (cut < floors ? .8 : 1), topD = building.d * (cut < floors ? .86 : 1);
    var roofY = 1.4 + floors * step;
    if (profile.style === 'fins') {
      [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sz) {
        add('crown', sx * (topW / 2 - .4), roofY + 1.7, sz * (topD / 2 - .4), .55, 3.4, .55, profile.trim, floors - 1, true);
      }); });
      ring('crown', topW, topD, roofY + 3.25, .3, .5, profile.trim, floors - 1, true);
    } else if (profile.style === 'bands') {
      ring('stone-cornice', topW + .8, topD + .8, roofY + 1.2, .45, .6, profile.trim, floors - 1, true);
      ring('stone-cornice', topW, topD, roofY + 2.1, .25, .45, '#8d785a', floors - 1, true, 'metal');
    } else if (profile.style === 'ribs') {
      // Perimeter screens keep the central helicopter pad completely clear.
      for (var slat = 0; slat < 4; slat++) {
        add('equipment-screen', 0, roofY + .65 + slat * .72, -topD / 2 + .4,
          topW, .35, .45, profile.wall, floors - 1, true, 'metal');
        add('equipment-screen', topW / 2 - .4, roofY + .65 + slat * .72, 0,
          .45, .35, topD, profile.trim, floors - 1, true, 'metal');
      }
    } else {
      function planters(width, depth, y, atFloor, roof) {
        [-1, 1].forEach(function (sign) {
          add('terrace-planter', sign * (width / 2 - .65), y + .4, 0, 1.3, .8, depth - 2,
            profile.trim, atFloor, roof);
          add('terrace-plant', sign * (width / 2 - .65), y + 1.15, 0, 1.1, .75, depth - 2.4,
            '#72856a', atFloor, roof, 'plant');
          add('terrace-planter', 0, y + .4, sign * (depth / 2 - .65), width - 3, .8, 1.3,
            profile.trim, atFloor, roof);
          add('terrace-plant', 0, y + 1.15, sign * (depth / 2 - .65), width - 3.4, .75, 1.1,
            '#7d906f', atFloor, roof, 'plant');
        });
      }
      if (cut < floors) planters(building.w, building.d, 1.4 + cut * step, cut - 1, false);
      planters(topW, topD, roofY + .6, floors - 1, true);
    }
    return parts;
  }

  function createOfficeArchitecture(THREE, city) {
    var group = new THREE.Group(); group.name = 'office-architecture';
    var records = (city.buildings || []).filter(officeProfile).map(function (building) {
      return { building: building, parts: officeParts(building), built: -1, complete: null, x: null, z: null };
    });
    var geometry = new THREE.BoxGeometry(1, 1, 1), slots = {}, disposed = false, visible = 0;
    var matrix = new THREE.Matrix4(), color = new THREE.Color();
    ['cladding', 'metal', 'plant'].forEach(function (name) {
      var count = records.reduce(function (n, record) { return n + record.parts.filter(function (part) { return part.material === name; }).length; }, 0);
      var material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: name === 'metal' ? .4 : .8, metalness: name === 'metal' ? .4 : 0 });
      var mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, count));
      mesh.name = 'office-' + name; mesh.count = 0; mesh.visible = false;
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, count) * 3), 3);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      slots[name] = mesh; group.add(mesh);
    });
    function update(time) {
      if (disposed) return;
      var changed = false;
      records.forEach(function (record) {
        var b = record.building, sample = root.CityModel.sampleBuilding(b, time);
        if (record.built !== sample.builtFloors || record.complete !== sample.complete || record.x !== b.x || record.z !== b.z) changed = true;
        record.built = sample.builtFloors; record.complete = sample.complete; record.x = b.x; record.z = b.z;
      });
      if (!changed) return;
      visible = 0;
      Object.keys(slots).forEach(function (name) { slots[name].count = 0; });
      records.forEach(function (record) {
        record.parts.forEach(function (part) {
          if (part.roof ? !record.complete : part.floor >= record.built) return;
          var mesh = slots[part.material], index = mesh.count++;
          matrix.makeScale(part.w, part.h, part.d).setPosition(record.x + part.x, part.y, record.z + part.z);
          mesh.setMatrixAt(index, matrix); mesh.setColorAt(index, color.set(part.color)); visible++;
        });
      });
      Object.keys(slots).forEach(function (name) {
        var mesh = slots[name]; mesh.visible = mesh.count > 0;
        mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
      });
    }
    function getInfo() {
      return { buildings: disposed ? 0 : records.length, visibleParts: visible, batches: disposed ? 0 : 3,
        drawCalls: disposed ? 0 : Object.keys(slots).filter(function (name) { return slots[name].count > 0; }).length,
        triangles: visible * 12, profiles: disposed ? [] : records.map(function (record) { return officeProfile(record.building); }) };
    }
    function dispose() {
      if (disposed) return;
      disposed = true; visible = 0; group.removeFromParent();
      Object.keys(slots).forEach(function (name) { slots[name].dispose(); slots[name].material.dispose(); });
      geometry.dispose(); group.clear(); records.length = 0;
    }
    var controller = { group: group, update: update, getInfo: getInfo, dispose: dispose };
    try { update(0); } catch (error) { dispose(); throw error; }
    return controller;
  }

  function positive(value, fallback) { return Number.isFinite(value) && value > 0 ? value : fallback; }
  function role(material) { return (material.name || '').replace(/\.\d+$/, ''); }
  function castsShadow(material) {
    return !/^District_Glass/i.test(role(material)) && !/^District_(Trim|Dark)(?:_|$)/i.test(role(material));
  }
  function schema(geometry) {
    return Object.keys(geometry.attributes).sort().map(function (name) {
      var a = geometry.attributes[name], array = a.isInterleavedBufferAttribute ? a.data.array : a.array;
      return [name, a.itemSize, a.normalized, array.constructor.name].join(':');
    }).join('|');
  }

  function primitive(source, range, transform) {
    var copy = source.clone();
    if (range) {
      var count = source.index ? source.index.count : source.attributes.position.count;
      var end = Math.min(count, range.start + range.count), indices = [];
      for (var i = Math.max(0, range.start); i < end; i++) indices.push(source.index ? source.index.getX(i) : i);
      copy.setIndex(indices);
    }
    if (copy.index) {
      var expanded = copy.toNonIndexed(); copy.dispose(); copy = expanded;
    }
    copy.clearGroups();
    copy.applyMatrix4(transform);
    if (!copy.getAttribute('normal')) copy.computeVertexNormals();
    return copy;
  }

  function moduleBatches(THREE, node, mergeGeometries) {
    var origin = new THREE.Vector3().setFromMatrixPosition(node.matrixWorld);
    var fromOrigin = new THREE.Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z);
    var transform = new THREE.Matrix4(), buckets = new Map(), baked = [], merged = [];
    try {
      node.traverse(function (part) {
        if (!part.isMesh) return;
        if (part.isSkinnedMesh || Object.keys(part.geometry.morphAttributes).length) {
          throw new Error('District modules must contain static geometry: ' + node.name);
        }
        transform.multiplyMatrices(fromOrigin, part.matrixWorld);
        var materials = Array.isArray(part.material) ? part.material : [part.material];
        var ranges = Array.isArray(part.material) ? part.geometry.groups : [null];
        if (!ranges.length) throw new Error('A district mesh has no material groups: ' + part.name);
        ranges.forEach(function (range) {
          var material = materials[range ? range.materialIndex : 0];
          if (!material) throw new Error('A district primitive is missing its material.');
          var geometry = primitive(part.geometry, range, transform);
          baked.push(geometry);
          var key = material.uuid + '|' + schema(geometry);
          if (!buckets.has(key)) buckets.set(key, { material: material, geometries: [] });
          buckets.get(key).geometries.push(geometry);
        });
      });
      if (!buckets.size) throw new Error('The district module is empty: ' + node.name);
      buckets.forEach(function (bucket) {
        var geometry = mergeGeometries(bucket.geometries, false);
        if (!geometry) throw new Error('Cannot merge district module ' + node.name + ' / ' + bucket.material.name);
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        merged.push({ geometry: geometry, material: bucket.material, casts: castsShadow(bucket.material),
          triangles: geometry.attributes.position.count / 3 });
      });
      return merged;
    } catch (error) {
      merged.forEach(function (batch) { batch.geometry.dispose(); });
      throw error;
    } finally {
      baked.forEach(function (geometry) { geometry.dispose(); });
    }
  }

  function releaseMaterials(materials) {
    var textures = new Set(), images = new Set();
    materials.forEach(function (material) {
      Object.keys(material).forEach(function (name) {
        var value = material[name];
        if (value && value.isTexture) textures.add(value);
      });
      material.dispose();
    });
    textures.forEach(function (texture) {
      var image = texture.source && texture.source.data;
      if (image && typeof image.close === 'function') images.add(image);
      texture.dispose();
    });
    images.forEach(function (image) { image.close(); });
  }

  function prepare(THREE, gltf, meta) {
    var sourceGeometries = new Set(), materials = new Set(), modules = {}, moduleStats = {}, roofLight = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(function (node) {
      if (!node.isMesh) return;
      sourceGeometries.add(node.geometry);
      (Array.isArray(node.material) ? node.material : [node.material]).forEach(function (mat) { materials.add(mat); });
    });
    try {
      MODULES.forEach(function (name) {
        var node = gltf.scene.getObjectByName(name);
        if (!node) throw new Error('The district GLB must contain the exact root node ' + name + '.');
        modules[name] = moduleBatches(THREE, node, root.CityGLTFLoader.mergeGeometries);
        // Reuse the modeled parapet caps and roof hardware as slim luminous insets.
        // One roof-only material keeps facade mullions metallic and the batch count fixed.
        if (/^Roof_/.test(name)) modules[name].forEach(function (batch) {
          if (role(batch.material) !== 'District_Trim') return;
          if (!roofLight) {
            roofLight = batch.material.clone(); roofLight.name = 'District_Trim_RoofLight';
            roofLight.color.set('#89d9e2'); roofLight.emissive.set('#37bcd6');
            roofLight.emissiveIntensity = 1.65; roofLight.metalness = .32; roofLight.roughness = .3;
            materials.add(roofLight);
          }
          batch.material = roofLight;
        });
        var bounds = new THREE.Box3(), triangles = 0;
        modules[name].forEach(function (batch) { bounds.union(batch.geometry.boundingBox); triangles += batch.triangles; });
        moduleStats[name] = { batches: modules[name].length, triangles: triangles,
          bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() } };
      });
      var glass = Array.from(materials).filter(function (mat) { return /^District_Glass/i.test(role(mat)); });
      var baseline = glass.find(function (mat) { return role(mat) === 'District_Glass'; }) || glass[0];
      var glassTints = new Map(), baseFactors = new Map();
      materials.forEach(function (mat) { if (mat.color) baseFactors.set(mat, mat.color.clone()); });
      glass.forEach(function (mat) {
        glassTints.set(mat, new THREE.Color().setRGB(
          mat.color.r / Math.max(.0001, baseline.color.r),
          mat.color.g / Math.max(.0001, baseline.color.g),
          mat.color.b / Math.max(.0001, baseline.color.b)));
      });
      return {
        THREE: THREE, modules: modules, materials: materials, glass: glass, glassTints: glassTints, baseFactors: baseFactors,
        width: positive(meta.width, 36), depth: positive(meta.depth, 32),
        floorHeight: positive(meta.floorHeight, 6), meta: Object.assign({}, meta), colors: '',
        stats: { modules: moduleStats, materials: materials.size, glassMaterials: glass.length,
          batches: MODULES.reduce(function (n, name) { return n + moduleStats[name].batches; }, 0),
          triangles: MODULES.reduce(function (n, name) { return n + moduleStats[name].triangles; }, 0) }
      };
    } catch (error) {
      Object.keys(modules).forEach(function (name) { modules[name].forEach(function (batch) { batch.geometry.dispose(); }); });
      releaseMaterials(materials);
      throw error;
    } finally {
      sourceGeometries.forEach(function (geometry) { geometry.dispose(); });
    }
  }

  function getStatus() {
    var activeTriangles = 0;
    districts.forEach(function (district) { activeTriangles += district.getInfo().triangles; });
    return {
      ready: phase === 'ready', status: phase, error: lastError,
      meta: asset ? Object.assign({}, asset.meta) : null,
      stats: Object.assign({ triangles: 0, batches: 0, materials: 0 }, asset ? asset.stats : {}, {
        activeDistricts: districts.size, activeBuildings: activeBuildings, activeTriangles: activeTriangles
      })
    };
  }

  function updateColors(settings) {
    if (settings && typeof settings === 'object') {
      ['stone', 'sand', 'glass'].forEach(function (name) {
        if (typeof settings[name] === 'string') pendingColors[name] = settings[name];
      });
    }
    if (!asset) return;
    var signature = ['stone', 'sand', 'glass'].map(function (name) { return pendingColors[name] || ''; }).join('|');
    if (signature === asset.colors) return;
    var glassColor = pendingColors.glass ? new asset.THREE.Color(pendingColors.glass) : null;
    var stoneColor = pendingColors.stone ? new asset.THREE.Color(pendingColors.stone) : null;
    var sandColor = new asset.THREE.Color(pendingColors.sand || '#b8c9d7');
    // The packed PNG stores the authored channel values as sRGB samples.
    // Match their decoded values before tinting, so silver does not inherit beige.
    var stoneBaseline = new asset.THREE.Color().setRGB(.89, .865, .81).convertSRGBToLinear();
    var sandBaseline = new asset.THREE.Color().setRGB(.76, .65, .50).convertSRGBToLinear();
    function mineralColor(material, target, baseline) {
      if (!material.map) { material.color.copy(target); return; }
      // Normalize the baked colour while preserving its fine surface variation.
      var factor = asset.baseFactors.get(material);
      material.color.setRGB(target.r / baseline.r * factor.r,
        target.g / baseline.g * factor.g, target.b / baseline.b * factor.b);
    }
    asset.materials.forEach(function (material) {
      var name = role(material);
      if (!material.color) return;
      if (/^District_Stone(?:_|$)/i.test(name) && stoneColor) mineralColor(material, stoneColor, stoneBaseline);
      if (/^District_Sand(?:_|$)/i.test(name) && sandColor) mineralColor(material, sandColor, sandBaseline);
      if (glassColor && asset.glassTints.has(material)) material.color.copy(glassColor).multiply(asset.glassTints.get(material));
      if (ROOF_COLORS[name]) material.color.set(ROOF_COLORS[name]);
      if (name === 'District_Stone' || name === 'District_Sand') {
        material.roughness = name === 'District_Stone' ? .66 : .48;
        material.metalness = name === 'District_Stone' ? .12 : .38;
      }
    });
    asset.colors = signature;
  }

  function load() {
    if (loading) return loading;
    phase = 'loading'; lastError = null;
    loading = Promise.resolve().then(function () {
      if (!root.THREE) throw new Error('Three.js must be loaded before CityDistrict.load().');
      if (!root.CityGLTFLoader || !root.CityGLTFLoader.GLTFLoader || !root.CityGLTFLoader.mergeGeometries) {
        throw new Error('Load the local CityGLTFLoader bundle before CityDistrict.load().');
      }
      var supplied = root.CityDistrictAsset;
      if (!supplied || typeof supplied.base64 !== 'string' || !supplied.base64.length) {
        throw new Error('The local CityDistrictAsset script has not been loaded.');
      }
      var encoded = supplied.base64.replace(/^data:[^,]*,/, '').replace(/\s/g, '');
      var binary = root.atob(encoded), bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      var THREE = root.THREE;
      var decoded = supplied.compression === 'gzip' ? new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer() : Promise.resolve(bytes.buffer);
      return decoded.then(function (buffer) { return new root.CityGLTFLoader.GLTFLoader().parseAsync(buffer, ''); }).then(function (gltf) {
        asset = prepare(THREE, gltf, supplied.meta || {});
        phase = 'ready'; updateColors();
        return getStatus();
      });
    }).catch(function (error) {
      phase = 'error'; lastError = error && error.message ? error.message : String(error);
      loading = null;
      throw error;
    });
    return loading;
  }

  function create(THREE, city, settings) {
    if (!asset || phase !== 'ready') throw new Error('Await CityDistrict.load() before creating a district.');
    if (THREE !== asset.THREE) throw new Error('CityDistrict and its GLTFLoader must use the same THREE instance.');
    if (!root.CityModel || typeof root.CityModel.sampleBuilding !== 'function') throw new Error('CityModel.sampleBuilding is required.');
    if (!city || !Array.isArray(city.buildings)) throw new Error('CityDistrict.create requires a city with buildings.');
    updateColors(settings);
    var group = new THREE.Group(); group.name = 'blender-district-' + city.seed;
    var records = [], slots = {}, meshes = [], disposed = false, enabled = true;
    var excluded = null, lastTime = null, revision = 0, lastRevision = -1;
    var completionTime = Number.isFinite(city.duration) ? city.duration : Infinity;
    var matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3();
    var quaternion = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    var current = { floors: 0, fallers: 0, roofs: 0, buildings: 0, triangles: 0, drawCalls: 0 };
    var capacities = {};
    MODULES.forEach(function (name) { capacities[name] = 0; });

    function buildingTints(building) {
      // Identity, never instance position or animation time, chooses a building's palette.
      var hash = (city.seed >>> 0) ^ 2166136261, id = String(building.id);
      for (var i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
      var theme = officeProfile(building) || PALETTES[(hash >>> 0) % PALETTES.length];
      function relative(color, baseline) {
        var target = new THREE.Color(color), base = new THREE.Color(baseline);
        return [target.r / base.r, target.g / base.g, target.b / base.b];
      }
      return { mineral: relative(theme.wall, building.kind === 'sand' ? '#b8c9d7' : '#e6eef3'),
        glass: relative(theme.glass, '#63a8bb') };
    }

    city.buildings.forEach(function (building) {
      if (building.facility || building.housing) return;
      var floors = Math.max(1, Math.floor(positive(building.floors, 1)));
      var floorHeight = positive(building.floorHeight, 6);
      var kind = building.kind === 'glass' ? 'Glass' : building.kind === 'sand' ? 'Sand' : 'Stone';
      // A 'plain' roof lays no module at all, so the top storey is the roof.
      var roofKind = building.roof === 'plain' ? null :
        building.roof === 'solar' ? 'Solar' : building.roof === 'garden' ? 'Garden' : 'Service';
      var floorName = 'Floor_' + kind, roofName = roofKind ? 'Roof_' + roofKind : null;
      var setback = kind === 'Glass' && floors >= 15;
      var cut = setback ? Math.floor(floors * .74) : floors;
      var record = { building: building, floors: floors, cut: cut, floorName: floorName, roofName: roofName,
        tints: buildingTints(building),
        width: positive(building.w, asset.width) / asset.width,
        depth: positive(building.d, asset.depth) / asset.depth,
        height: floorHeight / asset.floorHeight, fixed: new Float32Array(floors * 16), roof: new Float32Array(16) };
      quaternion.identity();
      for (var floor = 0; floor < floors; floor++) {
        var upper = floor >= cut;
        position.set(building.x, 1.4 + floor * floorHeight, building.z);
        scale.set(record.width * (upper ? .8 : 1), record.height, record.depth * (upper ? .86 : 1));
        matrix.compose(position, quaternion, scale).toArray(record.fixed, floor * 16);
      }
      position.set(building.x, 1.4 + floors * floorHeight, building.z);
      scale.set(record.width * (setback ? .8 : 1), record.height, record.depth * (setback ? .86 : 1));
      matrix.compose(position, quaternion, scale).toArray(record.roof);
      capacities[floorName] += floors;
      if (roofName) capacities[roofName]++;
      records.push(record);
    });

    // 航空障碍灯：全镇最高的玻璃塔顶一盏红色双闪灯。常驻几何、自持材质（+1 绘制调用，
    // 预算内），相位由 update 的 time 驱动；挑选规则按高度、再按 x/z 字典序，确定性。
    var beacon = null, beaconMat = null;
    var tallest = records.filter(function (r) { return r.building.kind === 'glass'; })
      .reduce(function (best, r) {
        if (!best) return r;
        var h = r.floors * positive(r.building.floorHeight, 6), bh = best.floors * positive(best.building.floorHeight, 6);
        return h > bh || (h === bh && (r.building.x < best.building.x ||
          (r.building.x === best.building.x && r.building.z < best.building.z))) ? r : best;
      }, null);
    if (tallest) {
      beaconMat = new THREE.MeshStandardMaterial({ color: '#3a0d10', emissive: '#ff2a2a', emissiveIntensity: 0, roughness: .4 });
      beacon = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), beaconMat, 1);
      beacon.name = 'aviation-beacon';
      beacon.position.set(tallest.building.x, 1.4 + tallest.floors * positive(tallest.building.floorHeight, 6) + 3.4, tallest.building.z);
      beacon.castShadow = false; beacon.receiveShadow = false;
      group.add(beacon);
    }

    MODULES.forEach(function (name) {
      var capacity = capacities[name];
      if (!capacity) return;
      // All materials in one module reuse exactly one per-district matrix buffer.
      var matrices = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 16), 16);
      matrices.setUsage(THREE.DynamicDrawUsage);
      var slot = { matrices: matrices, colors: {}, count: 0, meshes: [], triangles: 0 };
      asset.modules[name].forEach(function (batch) {
        var mesh = new THREE.InstancedMesh(batch.geometry, batch.material, capacity);
        mesh.name = 'district-' + name + '-' + role(batch.material);
        mesh.instanceMatrix = matrices;
        var colorRole = /^Floor_/.test(name) ? (/^District_Glass/.test(role(batch.material)) ? 'glass' :
          /^District_(Stone|Sand)$/.test(role(batch.material)) ? 'mineral' : null) : null;
        if (colorRole) {
          if (!slot.colors[colorRole]) {
            slot.colors[colorRole] = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
            slot.colors[colorRole].setUsage(THREE.DynamicDrawUsage);
          }
          mesh.instanceColor = slot.colors[colorRole];
        }
        mesh.count = 0; mesh.castShadow = batch.casts; mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        slot.meshes.push(mesh); slot.triangles += batch.triangles;
        meshes.push(mesh); group.add(mesh);
      });
      slots[name] = slot;
    });

    function copyInto(target, offset, source, length) {
      for (var i = 0; i < length; i++) target[offset + i] = source[i];
    }
    function colorInstances(slot, record, start, count) {
      Object.keys(slot.colors).forEach(function (name) {
        var tint = record.tints[name], array = slot.colors[name].array;
        for (var i = start; i < start + count; i++) {
          array[i * 3] = tint[0]; array[i * 3 + 1] = tint[1]; array[i * 3 + 2] = tint[2];
        }
      });
    }
    function update(time) {
      if (disposed) return;
      time = typeof time === 'number' && !Number.isNaN(time) ? time : 0;
      // The beacon blinks on its own phase, even on the settled exhibit where the
      // static district matrices below take the early return.
      if (beaconMat) { var phase = time % 1.7; beaconMat.emissiveIntensity = (phase < .11 || (phase >= .22 && phase < .33)) ? 2.2 : .05; }
      if (time === lastTime && revision === lastRevision) return;
      // Vehicles and pedestrians may keep the shared clock running after the
      // final roof is placed; static district matrices need no further upload.
      if (lastTime !== null && lastTime >= completionTime && time >= completionTime && revision === lastRevision) {
        lastTime = time;
        return;
      }
      lastTime = time; lastRevision = revision;
      current.floors = 0; current.fallers = 0; current.roofs = 0; current.buildings = 0;
      current.triangles = 0; current.drawCalls = 0;
      Object.keys(slots).forEach(function (name) { slots[name].count = 0; });
      records.forEach(function (record) {
        var building = record.building;
        if (building.id === excluded) return;
        var sample = root.CityModel.sampleBuilding(building, time);
        var built = Math.max(0, Math.min(record.floors, Math.floor(sample.builtFloors || 0)));
        var floorSlot = slots[record.floorName], written = 0;
        copyInto(floorSlot.matrices.array, floorSlot.count * 16, record.fixed, built * 16);
        colorInstances(floorSlot, record, floorSlot.count, built);
        floorSlot.count += built; current.floors += built;
        var falling = sample.falling || [];
        for (var i = 0; i < Math.min(2, falling.length); i++) {
          var module = falling[i];
          if (module.floor < built || module.floor >= record.floors) continue;
          var upper = module.floor >= record.cut;
          position.set(building.x, 1.4 + module.y, building.z);
          scale.set(record.width * (upper ? .8 : 1), record.height, record.depth * (upper ? .86 : 1));
          quaternion.setFromAxisAngle(up, -module.rotation);
          matrix.compose(position, quaternion, scale).toArray(floorSlot.matrices.array, floorSlot.count * 16);
          colorInstances(floorSlot, record, floorSlot.count, 1);
          floorSlot.count++; current.fallers++; written++;
        }
        if (sample.complete && record.roofName) {
          var roofSlot = slots[record.roofName];
          copyInto(roofSlot.matrices.array, roofSlot.count * 16, record.roof, 16);
          roofSlot.count++; current.roofs++;
        }
        if (built || written || sample.complete) current.buildings++;
      });
      Object.keys(slots).forEach(function (name) {
        var slot = slots[name];
        slot.matrices.clearUpdateRanges();
        if (slot.count) slot.matrices.addUpdateRange(0, slot.count * 16);
        slot.matrices.needsUpdate = true;
        Object.keys(slot.colors).forEach(function (name) {
          var colors = slot.colors[name]; colors.clearUpdateRanges();
          if (slot.count) colors.addUpdateRange(0, slot.count * 3);
          colors.needsUpdate = true;
        });
        slot.meshes.forEach(function (mesh) { mesh.count = slot.count; mesh.visible = slot.count > 0; });
        current.triangles += slot.count * slot.triangles;
        if (slot.count) current.drawCalls += slot.meshes.length;
      });
    }

    function setEnabled(value) {
      if (disposed) return;
      enabled = !!value; group.visible = enabled;
    }
    function setExcludedBuilding(id) {
      if (disposed) return;
      var next = id === undefined || id === null ? null : id;
      if (next === excluded) return;
      excluded = next; revision++;
      update(lastTime === null ? 0 : lastTime);
    }
    function getLightAnchors(){
      const anchors=[];
      records.filter(r=>r.building.kind==='glass').forEach(r=>{
        // 门厅灯带：塔身四面的底部一条透亮玻璃，走 entry 通道（policy.entry），
        // 楼里有没有人都亮——它是建筑物的门面，不是占用统计。
        const halfW=positive(r.building.w,asset.width)/2,halfD=positive(r.building.d,asset.depth)/2;
        for(let side=0;side<4;side++){
          const alongX=side%2===0,sign=side<2?1:-1;
          anchors.push({building:r.building,ledgerId:r.building.ledgerId,floor:0,layer:'entry',
            local:[alongX?0:sign*halfD,1.05,alongX?sign*halfW:0,
              alongX?Math.min(16,halfW*1.05):.16,2.4,alongX?.16:Math.min(16,halfD*1.05)]});
        }
        for(let floor=0;floor<r.floors;floor++)for(let side=0;side<4;side++){
          const alongX=side%2===0,sign=side<2?1:-1,span=alongX?36:32,depth=alongX?16:18;
          const count=alongX?7:6,step=(span-.68)/count,upper=floor>=r.cut;
          const sx=r.width*(upper?.8:1),sz=r.depth*(upper?.86:1);
          for(let i=0;i<count;i++){
            const u=(i-(count-1)/2)*step;
            anchors.push({building:r.building,ledgerId:r.building.ledgerId,floor,
              local:[(alongX?u:sign*(depth-.155))*sx,3.3*r.height,(alongX?sign*(depth-.155):u)*sz,
                (alongX?step-.23:.03)*sx,4.05*r.height,(alongX?.03:step-.23)*sz]});
          }
        }
      });return anchors;
    }
    function getGlassMaterials() { return disposed ? [] : asset.glass.slice(); }
    function getInfo() {
      return { ready: !disposed, enabled: enabled && !disposed, time: lastTime,
        buildings: disposed ? 0 : records.length, visibleBuildings: enabled && !disposed ? current.buildings : 0,
        floorInstances: current.floors, fallingInstances: current.fallers, roofInstances: current.roofs,
        batches: disposed ? 0 : meshes.length, drawCalls: enabled && !disposed ? current.drawCalls : 0,
        triangles: enabled && !disposed ? current.triangles : 0, excludedBuilding: excluded };
    }
    function dispose() {
      if (disposed) return;
      disposed = true; enabled = false; group.visible = false; group.removeFromParent();
      meshes.forEach(function (mesh) { mesh.dispose(); });
      if (beacon) { beacon.dispose(); beacon.geometry.dispose(); beaconMat.dispose(); beacon = null; beaconMat = null; }
      group.clear(); districts.delete(controller); activeBuildings -= records.length;
      meshes.length = 0; records.length = 0; slots = {};
      current.floors = 0; current.fallers = 0; current.roofs = 0; current.buildings = 0;
      current.triangles = 0; current.drawCalls = 0;
    }
    var controller = { group: group, update: update, setEnabled: setEnabled,
      setLighting:function(l){asset.materials.forEach(function(m){if(m.emissiveIntensity>0&&m.name&&/roof/i.test(m.name))m.emissiveIntensity=.08+l.lamps*(l.minute>=1110&&l.minute<1415?1.2:0);});},
      setExcludedBuilding: setExcludedBuilding, getLightAnchors: getLightAnchors, getGlassMaterials: getGlassMaterials,
      dispose: dispose, getInfo: getInfo };
    try { update(0); }
    catch (error) {
      meshes.forEach(function (mesh) { mesh.dispose(); });
      if (beacon) { beacon.dispose(); beacon.geometry.dispose(); beaconMat.dispose(); }
      group.clear(); throw error;
    }
    districts.add(controller); activeBuildings += records.length;
    return controller;
  }

  return { load: load, getStatus: getStatus, create: create, updateColors: updateColors,
    officeProfile: officeProfile, officeParts: officeParts, createOfficeArchitecture: createOfficeArchitecture };
});
