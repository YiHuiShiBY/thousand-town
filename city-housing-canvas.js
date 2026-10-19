/* Canvas fallback for the same local residential wings used by CityHousing. */
(function (root, factory) {
  'use strict';
  var api = factory(root.CityHousing || (typeof require === 'function' ? require('./city-housing.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CityHousingCanvas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Housing) {
  'use strict';
  var BASE = 1.4, FLOOR = 6;
  function volumes(b) { return b && b.housing && Array.isArray(b.housing.volumes) ? b.housing.volumes : []; }
  function palette(b) {
    if (Housing) return Housing.paletteFor(b);
    return Object.assign({ wall: '#eee5d5', trim: '#f7f1e8', accent: '#bb8c72', glass: '#789da3', green: '#729761', wood: '#a3815b', metal: '#718080' }, b.housing.palette);
  }
  function center(b, v, angle) {
    var c = Math.cos(angle || 0), s = Math.sin(angle || 0);
    return { x: b.x + v.x * c - v.z * s, z: b.z + v.x * s + v.z * c, w: v.w, d: v.d };
  }
  function localBox(api, site, angle, x, z, w, d, y, h, color) {
    var c = Math.cos(angle), s = Math.sin(angle);
    api.cuboid(site.x + x * c - z * s, site.z + x * s + z * c, w, d, y, h, color, angle, true);
  }

  function drawGround(b, api) {
    if (!volumes(b).length) return;
    api.plane(b.x, b.z, b.w, b.d, .26, '#e2ddd1');
    volumes(b).forEach(function (v) {
      api.cuboid(b.x + v.x, b.z + v.z, v.w + .7, v.d + .7, .25, 1.14, '#d6cfc2');
    });
    var garden = b.housing.courtyard;
    if (!garden) return;
    var x = b.x + garden.x, z = b.z + garden.z, alongX = garden.w >= garden.d;
    api.plane(x, z, garden.w, garden.d, .32, '#90a574');
    api.plane(x, z, alongX ? garden.w : 1.25, alongX ? 1.25 : garden.d, .335, '#e7dfcf');
    api.plane(x, z, alongX ? 1.1 : garden.w * .66, alongX ? garden.d * .66 : 1.1, .34, '#e7dfcf');
  }

  function facade(b, v, site, count, firstFloor, y, angle, api, settled) {
    var p = palette(b), c = Math.cos(angle), s = Math.sin(angle), detail = Housing.detailsFor(b);
    var lightLevel = Housing && settled ? Housing.lightFor(b, api.townView, api.bindings) : 0;
    ['x', 'z'].forEach(function (axis) {
      var onX = axis === 'x', span = onX ? v.d : v.w, face = (onX ? v.w : v.d) / 2;
      var columns = Math.max(1, Math.floor((span - 2) / 4.7)), spacing = (span - 2) / columns;
      [-1, 1].forEach(function (sign) {
        var nx = onX ? sign * c : -sign * s, nz = onX ? sign * s : sign * c;
        if (nx * api.view.s + nz * api.view.c < -.0001) return;
        function facing(u, out, w, d, bottom, height, color) {
          localBox(api, site, angle, onX ? sign * (face + out) : u, onX ? u : sign * (face + out),
            onX ? d : w, onX ? w : d, bottom, height, color);
        }
        for (var level = 0; level < count; level++) {
          var floor = firstFloor + level, floorY = y + level * FLOOR;
          for (var col = 0; col < columns; col++) {
            var u = (col - (columns - 1) / 2) * spacing;
            if (!onX && sign < 0 && (Math.abs(u + v.w * .32) < 1.8 || (floor === 0 && Math.abs(u - v.w * .15) < 2.1))) continue;
            var balcony = floor > 0 && (v.balconies === 'both' || v.balconies === axis) && (col + floor % 2) % 2 === 0;
            var width = Math.min(balcony ? 2.4 : 1.95, spacing - .8), height = balcony ? 3.5 : 2.55, cy = balcony ? 2.1 : 3.05;
            // Near landing, rectangular wall helpers remain a good projection;
            // at larger yaw the physical balcony silhouettes carry the detail.
            if (Math.abs(angle) < .015) {
              api.wall(site, axis, u - width / 2 - detail.frame / 2, u + width / 2 + detail.frame / 2, floorY + cy - height / 2 - detail.frame / 2, floorY + cy + height / 2 + detail.frame / 2, p.trim);
              api.wall(site, axis, u - width / 2, u + width / 2, floorY + cy - height / 2, floorY + cy + height / 2, Housing && Housing.windowRank(b, v, floor, axis, sign, col) < lightLevel ? '#ffd69a' : p.glass);
              api.wall(site, axis, u - .0275, u + .0275, floorY + cy - height / 2, floorY + cy + height / 2, p.trim);
            }
            if (!balcony) continue;
            var bw = Math.min(3.4, spacing - .3);
            facing(u, .86, bw, 1.7, floorY + .14, .16, p.trim);
            facing(u, 1.63, bw - .2, .12, floorY + .41, 1.28, (floor + col) % 3 ? p.glass : p.accent);
            facing(u, 1.64, bw, .13, floorY + 1.7, .075, p.metal);
            [-1, 1].forEach(function (edge) { facing(u + edge * (bw / 2 - .08), .83, .1, 1.5, floorY + .3, 1.2, p[detail.cheek]); });
            if ((floor + col) % 4 === 0) {
              facing(u + bw * .22, 1.27, .75, .42, floorY + .35, .55, p.accent);
              facing(u + bw * .22, 1.27, .85, .46, floorY + .81, .34, p.green);
            }
            if (b.housing.type === 'terrace' && (floor + col) % 5 === 1) {
              facing(u - bw * .22, 1.18, .82, .04, floorY + 1.09, .78, '#dfbd8b');
              facing(u + bw * .2, .62, .86, .46, floorY + .31, .56, '#c5ccc0');
            }
          }
        }
      });
    });
    // A continuous stair window strip and a sheltered entry on the north face.
    if (Math.abs(angle) < .015 && api.view.c < 0) {
      var core = -v.w * .32;
      api.wall(site, 'z', core - .775, core + .775, y, y + count * FLOOR, p[detail.core]);
      for (var level = 0; level < count; level++) api.wall(site, 'z', core - .345, core + .345, y + level * FLOOR + 1.55, y + level * FLOOR + 5.35, p.glass);
      if (firstFloor === 0) {
        var entrance = v.w * .15;
        var travel = typeof api.doorTravel === 'function' ? api.doorTravel() : 0;
        api.wall(site, 'z', entrance - 1.58, entrance + 1.58, y, y + 4, p.accent);
        // Daylight hours leave the unit door open: the glazed leaf narrows toward
        // the hinge stile and a warm doorway shows behind it.
        var leafHalf = 1.05 * (1 - Math.max(0, Math.min(1, travel)) * .88);
        if (travel > 0) api.wall(site, 'z', entrance - 1.05, entrance + 1.05, y + .55, y + 3.35, '#f2dcae');
        api.wall(site, 'z', entrance - 1.05, entrance - 1.05 + leafHalf * 2, y + .55, y + 3.35, p.glass);
      }
    }
    if (firstFloor === 0) {
      localBox(api, site, angle, v.w * .15, -v.d / 2 - .87, 1.24, .34, y + 3.91, .12, p.trim);
      if (settled && api.entryLevel > 0) {
        api.ctx.save();
        try { api.ctx.globalAlpha *= Math.min(1, api.entryLevel); localBox(api, site, angle, v.w * .15, -v.d / 2 - .87, 1.24, .34, y + 3.91, .12, '#ffe0a4'); }
        finally { api.ctx.restore(); }
      }
      localBox(api, site, angle, v.w * .15, -v.d / 2 - .87, detail.canopyWidth, 1.7, y + 4.05, .22, p[detail.canopy]);
      if (b.housing.type === 'terrace') {
        [-1, 1].forEach(function (edge) {
          localBox(api, site, angle, v.w * .15, -v.d / 2 - .86 + edge * .78, 4.1, .18, y + 4.34, .2, p.wood);
          localBox(api, site, angle, v.w * .15 + edge * 1.68, -v.d / 2 - .58, .18, .25, y + .125, 4.05, p.wood);
        });
        for (var rafter = -3; rafter <= 3; rafter++) localBox(api, site, angle, v.w * .15 + rafter * .58, -v.d / 2 - .86, .12, 1.8, y + 4.45, .16, p.wood);
        localBox(api, site, angle, v.w * .15 + 2.5, -v.d / 2 - .27, 1.25, .22, y + 1.5, 1.7, p.accent);
      }
    }
  }

  function roof(b, v, site, index, y, api) {
    var p = palette(b), detail = Housing.detailsFor(b);
    api.cuboid(site.x, site.z, v.w + .65, v.d + .65, y, .28, p.trim);
    api.plane(site.x, site.z, v.w - .7, v.d - .7, y + .34, '#cdc4b3');
    [-1, 1].forEach(function (sign) {
      api.cuboid(site.x, site.z + sign * (v.d / 2 - .12), v.w, .25, y + .3, detail.parapet, p[detail.roofRole]);
      api.cuboid(site.x + sign * (v.w / 2 - .12), site.z, .25, v.d, y + .3, detail.parapet, p[detail.roofRole]);
      if (b.housing.type === 'terrace' || v.floors < b.floors) {
        var x = site.x + sign * v.w * .27, z = site.z + v.d * .27, width = Math.min(5, v.w * .3);
        api.cuboid(x, z, width, 1.3, y + .39, .7, p.accent);
        api.cuboid(x, z, width * .92, 1.17, y + .99, .45, p.green);
      }
    });
    if (b.housing.type === 'terrace') {
      var serviceZ = site.z - v.d * .22, serviceW = Math.min(v.w - 1.8, 8.8);
      api.cuboid(site.x, serviceZ, serviceW, 5.8, y + .38, .2, p.trim);
      api.cuboid(site.x, serviceZ - 2.65, serviceW, .12, y + .625, .85, p.wood);
      if (index === 0) {
        api.cuboid(site.x - serviceW * .26, serviceZ, 2.7, 3.5, y + .575, 1.35, p.wall);
        [-1, 1].forEach(function (sign) { api.cuboid(site.x + serviceW * .21, serviceZ + sign * 1.27, 2.9, 2.3, y + 1.02, .12, p.solar); });
      } else if (index === 1) {
        api.cuboid(site.x, serviceZ, 2.44, 2.44, y + .6, 2.1, '#aeb9b2');
      } else {
        [-1, 1].forEach(function (sign) { api.line([[site.x + sign * 2, serviceZ, y + .6], [site.x + sign * 2, serviceZ, y + 2.4]], p.metal, Math.max(.4, api.view.scale * .1)); });
        api.line([[site.x - 2.08, serviceZ, y + 2.4], [site.x + 2.08, serviceZ, y + 2.4]], p.metal, Math.max(.4, api.view.scale * .1));
        for (var linen = -1; linen <= 1; linen++) api.cuboid(site.x + linen, serviceZ, .72, .045, y + 1.3, 1, p.trim);
      }
      return;
    }
    if (index % 3 === 0) {
      api.cuboid(site.x - v.w * .23, site.z - v.d * .18, Math.min(3.6, v.w * .24), Math.min(3, v.d * .24), y + .3, 2.1, p.wall);
      for (var panel = 0; panel < 2; panel++) api.cuboid(site.x + v.w * .2, site.z + (panel - .5) * Math.min(3, v.d * .25), Math.min(3.2, v.w * .27), Math.min(2.6, v.d * .23), y + .85, .17, p.solar);
    } else if (index % 3 === 1) {
      api.cuboid(site.x - v.w * .22, site.z - v.d * .16, 2.44, 2.44, y + .4, 2.3, '#aab5b3');
    } else {
      var width = Math.min(4.4, v.w * .46), z = site.z - v.d * .12;
      [-1, 1].forEach(function (sign) { api.line([[site.x + sign * width / 2, z, y + .36], [site.x + sign * width / 2, z, y + 2.36]], p.metal, Math.max(.4, api.view.scale * .1)); });
      api.line([[site.x - width / 2, z, y + 2.36], [site.x + width / 2, z, y + 2.36]], p.metal, Math.max(.4, api.view.scale * .1));
      for (var cloth = 0; cloth < 3; cloth++) api.cuboid(site.x + (cloth - 1) * width * .25, z, width * .18, .045, y + 1.15, 1.1, cloth % 2 ? p.accent : p.trim);
    }
  }

  function addObjects(objects, b, sample, api) {
    if (!volumes(b).length) return;
    var p = palette(b), detail = Housing.detailsFor(b);
    volumes(b).forEach(function (v, index) {
      var site = center(b, v, 0), count = Math.min(sample.builtFloors, v.floors), base = BASE + (v.y || 0);
      if (count > 0) objects.push({ x: site.x, z: site.z, kind: 'housing-wing', buildingId: b.id, volumeIndex: index, paint: function () {
        api.cuboid(site.x, site.z, v.w, v.d, base, count * FLOOR - .17, p.wall, 0, true);
        for (var floor = 0; floor < count; floor++) api.cuboid(site.x, site.z, v.w + detail.band, v.d + detail.band, base + floor * FLOOR + (5.91 - detail.bandHeight / 2), detail.bandHeight, p.trim);
        facade(b, v, site, count, 0, base, 0, api, true);
        if (count === v.floors) roof(b, v, site, index, base + count * FLOOR, api);
      } });
      (sample.falling || []).forEach(function (module) {
        if (module.floor >= v.floors) return;
        var angle = module.rotation || 0, fallingSite = center(b, v, angle), y = BASE + (v.y || 0) + module.y;
        objects.push({ x: fallingSite.x, z: fallingSite.z, kind: 'housing-falling', buildingId: b.id, volumeIndex: index, floor: module.floor, paint: function () {
          api.ctx.save();
          try {
            api.ctx.globalAlpha *= Number.isFinite(module.opacity) ? module.opacity : 1;
            api.cuboid(fallingSite.x, fallingSite.z, v.w, v.d, y, 5.83, p.wall, angle, true);
            facade(b, v, fallingSite, 1, module.floor, y, angle, api, false);
            api.cuboid(fallingSite.x, fallingSite.z, v.w + detail.band, v.d + detail.band, y + (5.91 - detail.bandHeight / 2), detail.bandHeight, p.trim, angle);
          } finally { api.ctx.restore(); }
        } });
      });
    });
    var garden = b.housing.courtyard;
    if (!garden) return;
    var alongX = garden.w >= garden.d, radius = Math.min(1.5, Math.min(2.8, garden.w - .8) / 2, Math.min(2.8, garden.d - .8) / 2);
    [-1, 1].forEach(function (sign) {
      var x = b.x + garden.x + (alongX ? sign * garden.w * .31 : 0), z = b.z + garden.z + (alongX ? 0 : sign * garden.d * .31);
      objects.push({ x: x, z: z, kind: 'housing-tree', buildingId: b.id, paint: function () { api.miniTree(x, z, .32, radius, 2.33); } });
    });
    var bx = b.x + garden.x + (alongX ? 0 : Math.min(3, garden.w * .28)), bz = b.z + garden.z + (alongX ? Math.min(2, garden.d * .26) : 0);
    objects.push({ x: bx, z: bz, kind: 'housing-bench', buildingId: b.id, paint: function () {
      var width = Math.min(3.4, garden.w * .45);
      api.cuboid(bx, bz, width, 1, .81, .18, p.wood);
      api.cuboid(bx, bz + .45, width, .15, 1, .8, p.wood);
      [-1, 1].forEach(function (sign) { api.cuboid(bx + sign * Math.min(1.25, garden.w * .16), bz, .16, .85, .25, .63, p.metal); });
    } });
  }

  function shadowVolumes(b, sample) {
    return volumes(b).filter(function (v) { return Math.min(sample.builtFloors, v.floors) > 0; }).map(function (v) {
      var site = center(b, v, 0), count = Math.min(sample.builtFloors, v.floors);
      return Object.assign(site, { height: BASE + (v.y || 0) + count * FLOOR + (count === v.floors ? 2.7 : 0) });
    });
  }
  return { drawGround: drawGround, addObjects: addObjects, shadowVolumes: shadowVolumes };
});
