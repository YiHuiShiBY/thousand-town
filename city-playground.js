/* Optional, compact neighbourhood sports ground. Dimensions are model units. */
(function (root) {
  'use strict';
  function create(T, site, kit) {
    var group = new T.Group(); group.name = 'experimental-playground';
    var owned = [], geometries = [], batches = new Map();
    function material(color, base) {
      var m = base ? base.clone() : new T.MeshStandardMaterial({ roughness: .94, metalness: 0 });
      m.color.set(color); owned.push(m); return m;
    }
    var track = material('#be604e'), turf = material('#5f9448', kit.grass);
    var stripe = material('#73a257', kit.grass), chalk = material('#f3f1e4');
    var boxGeometry = new T.BoxGeometry(1, 1, 1);
    var transform = new T.Matrix4(), q = new T.Quaternion(), pos = new T.Vector3(), scale = new T.Vector3();
    function append(geometry, mat, matrix, casts) {
      var key = mat.uuid + '/' + !!casts;
      if (!batches.has(key)) batches.set(key, { mat: mat, casts: !!casts, points: [], uv: [] });
      var batch = batches.get(key), points = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
      var index = geometry.index, count = index ? index.count : points.count, v = new T.Vector3();
      for (var i = 0; i < count; i++) {
        var at = index ? index.getX(i) : i;
        v.fromBufferAttribute(points, at).applyMatrix4(matrix);
        batch.points.push(v.x, v.y, v.z);
        batch.uv.push(uv ? uv.getX(at) : 0, uv ? uv.getY(at) : 0);
      }
    }
    function box(x, z, w, d, top, height, mat, casts) {
      pos.set(site.x + x, top - height / 2, site.z + z); scale.set(w, height, d); q.identity();
      transform.compose(pos, q, scale); append(boxGeometry, mat, transform, casts);
    }
    function outline(radius) {
      var shape = new T.Shape(), a = site.trackHalfStraight;
      shape.moveTo(radius, -a); shape.lineTo(radius, a);
      shape.absarc(0, a, radius, 0, Math.PI, false); shape.lineTo(-radius, -a);
      shape.absarc(0, -a, radius, Math.PI, Math.PI * 2, false); shape.closePath();
      return shape;
    }
    function stadium(radius, inner, y, mat) {
      var shape = outline(radius);
      if (inner > 0) shape.holes.push(outline(inner));
      var geo = new T.ShapeGeometry(shape, 40);
      transform.makeRotationX(-Math.PI / 2); transform.setPosition(site.x, y, site.z);
      append(geo, mat, transform, false); geo.dispose();
    }
    function rectangleLine(x, z, w, d, y) {
      box(x, z - d / 2, w, .09, y, .016, chalk, false);
      box(x, z + d / 2, w, .09, y, .016, chalk, false);
      box(x - w / 2, z, .09, d, y, .016, chalk, false);
      box(x + w / 2, z, .09, d, y, .016, chalk, false);
    }
    var radius = site.trackRadius, inner = radius - site.lanes * site.laneWidth;
    stadium(radius + .65, 0, .28, kit.pavement);
    stadium(radius, inner, .30, track);
    stadium(inner, 0, .305, turf);
    for (var band = 0; band < 8; band += 2) {
      box(0, -site.pitchD / 2 + (band + .5) * site.pitchD / 8,
        site.pitchW, site.pitchD / 8, .321, .012, stripe, false);
    }
    // Painted lanes sit above the rubber surface; nothing is coplanar.
    for (var lane = 0; lane <= site.lanes; lane++) {
      stadium(inner + lane * site.laneWidth + .035, inner + lane * site.laneWidth - .035, .33, chalk);
    }
    box(inner + (radius - inner) / 2, -2, radius - inner, .11, .335, .012, chalk, false);
    for (var start = 0; start < site.lanes; start++) {
      box(inner + start + .5, -2.5 - start * .65, .65, .08, .336, .012, chalk, false);
    }
    rectangleLine(0, 0, site.pitchW, site.pitchD, .35);
    box(0, 0, site.pitchW, .09, .35, .016, chalk, false);
    var circle = new T.RingGeometry(2.35, 2.44, 64);
    transform.makeRotationX(-Math.PI / 2); transform.setPosition(site.x, .352, site.z);
    append(circle, chalk, transform, false); circle.dispose();
    box(0, 0, .17, .17, .352, .012, chalk, false);
    [-1, 1].forEach(function (side) {
      rectangleLine(0, side * (site.pitchD / 2 - 2), 8.4, 4, .35);
      rectangleLine(0, side * (site.pitchD / 2 - .9), 5.2, 1.8, .351);
      var front = side * (site.pitchD / 2 + .18), back = front + side * 1.55;
      [-1, 1].forEach(function (post) {
        box(post * 2.5, front, .16, .16, 2.95, 2.6, chalk, true);
        box(post * 2.5, back, .1, .1, 2.95, 2.6, chalk, false);
        box(post * 2.5, (front + back) / 2, .12, 1.55, 2.95, .12, chalk, true);
      });
      box(0, front, 5.16, .16, 2.95, .16, chalk, true);
      for (var netX = -2.5; netX <= 2.51; netX += .5) box(netX, back, .025, .025, 2.89, 2.5, chalk, false);
      for (var netY = .4; netY < 2.95; netY += .42) box(0, back, 5, .025, netY, .025, chalk, false);
    });
    // Three low bleacher steps leave the perimeter footpath clear.
    for (var step = 0; step < 3; step++) {
      box(-19.65 + step * .64, 0, .64, 11.6, 1.7 - step * .48, 1.43 - step * .48, kit.pavement, true);
      box(-19.65 + step * .64, 0, .58, 11.4, 1.77 - step * .48, .07, kit.stone, true);
    }
    boxGeometry.dispose();
    batches.forEach(function (batch) {
      var geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(batch.points, 3));
      geometry.setAttribute('uv', new T.Float32BufferAttribute(batch.uv, 2));
      geometry.computeVertexNormals(); geometry.computeBoundingSphere(); geometries.push(geometry);
      var mesh = new T.InstancedMesh(geometry, batch.mat, 1); mesh.castShadow = batch.casts; mesh.receiveShadow = true;
      group.add(mesh);
    });
    group.userData.playground = { ...site, goals: 2, bleacherRows: 3, experimental: true };
    return { group: group, dispose: function () {
      group.children.forEach(function (mesh) { mesh.dispose(); });
      geometries.forEach(function (g) { g.dispose(); }); owned.forEach(function (m) { m.dispose(); }); group.clear();
    } };
  }
  root.CityPlayground = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);
