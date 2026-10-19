(function (root) {
  'use strict';

  // All surface and sky variation is baked once from fixed seeds.
  function hash(x, y, seed) {
    var h = Math.imul(x ^ seed, 374761393) ^ Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function noise(u, v, cells, seed) {
    var x = u * cells, y = v * cells;
    var ix = Math.floor(x), iy = Math.floor(y);
    var tx = x - ix, ty = y - iy;
    tx = tx * tx * (3 - 2 * tx);
    ty = ty * ty * (3 - 2 * ty);
    function at(dx, dy) {
      return hash(((ix + dx) % cells + cells) % cells,
        ((iy + dy) % cells + cells) % cells, seed);
    }
    var a = at(0, 0) * (1 - tx) + at(1, 0) * tx;
    var b = at(0, 1) * (1 - tx) + at(1, 1) * tx;
    return a * (1 - ty) + b * ty;
  }

  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function canvas(width, height) {
    var image = document.createElement('canvas');
    image.width = width;
    image.height = height;
    return image;
  }


  // One deterministic sky catalogue serves both renderers; it is independent of residents.
  var skyCache = null;
  function galaxyLatitude(u, phase) {
    return .5 + .24 * Math.sin((u + phase) * Math.PI * 2) + .025 * Math.sin((u + phase) * Math.PI * 6);
  }
  function skyPattern(seed) {
    seed = Number(seed) >>> 0;
    if (skyCache && skyCache.seed === seed) return skyCache;
    var clouds = [], stars = [], galaxy = { phase: .855 + hash(0, 61, seed) * .04, lobes: [] };
    for (var i = 0; i < 28; i++) {
      var u = (i + hash(i, 0, seed)) / 28;
      var v = .5 - (.19 + hash(i, 1, seed) * .93) / Math.PI;
      var width = .014 + hash(i, 2, seed) * .021;
      var height = .007 + hash(i, 3, seed) * .012;
      var lobes = [];
      for (var j = 0; j < 7; j++) lobes.push({
        du: (j / 6 - .5) * width * 1.65,
        dv: (hash(i, j + 5, seed) - .5) * height * .48,
        rx: width * (.27 + hash(i, j + 15, seed) * .24),
        ry: height * (.56 + hash(i, j + 25, seed) * .52),
        opacity: .63 + hash(i, j + 35, seed) * .28
      });
      clouds.push({ u: u, v: v, width: width, height: height, lobes: lobes });
    }
    // Uniform solid-angle stars surround the entire town. A denser tilted band
    // supplies the distant galaxy without allocating a particle or mesh per star.
    for (var s = 0; s < 6200; s++) {
      var su = hash(s, 52, seed), up = -.997 + hash(s, 51, seed) * 1.994;
      var sv = s < 4800 ? .5 - Math.asin(up) / Math.PI :
        galaxyLatitude(su, galaxy.phase) + (hash(s, 55, seed) - .5) * .13;
      stars.push({ u: su, v: clamp(sv, .015, .985),
        brightness: s % 211 === 0 ? 1 : .16 + Math.pow(hash(s, 53, seed), 3) * .84,
        radius: s % 211 === 0 ? .9 : .24 + Math.pow(hash(s, 54, seed), 6) * .55 });
    }
    for (var g = 0; g < 96; g++) {
      var gu = g / 96;
      galaxy.lobes.push({ u: gu, v: galaxyLatitude(gu, galaxy.phase) + (hash(g, 62, seed) - .5) * .028,
        rx: .035 + hash(g, 63, seed) * .015, ry: .04 + hash(g, 64, seed) * .025,
        opacity: .07 + hash(g, 65, seed) * .08 });
    }
    skyCache = { seed: seed, clouds: clouds, stars: stars, galaxy: galaxy };
    return skyCache;
  }

  function skyState(daySeconds, dusk) {
    var clock = root.CityDailyClock;
    var hasDay = clock && Number.isFinite(daySeconds);
    var seconds = hasDay ? Math.max(0, daySeconds) : 720 * .625;
    var minute = hasDay ? clock.minuteOfDay(seconds) : 720;
    var daylight = hasDay ? clock.daylight(minute) : 1;
    dusk = clamp(Number(dusk) || 0, 0, 1);
    // Sky motion is sub-minute smooth; residents retain the existing daily clock.
    var visualMinute = (seconds / (clock ? clock.SECONDS_PER_SIM_MINUTE : .625)) % 1440;
    function ramp(a,b,x){var t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
    var dawn=ramp(300,335,visualMinute)*(1-ramp(390,480,visualMinute));
    // The 19:00 sunset fades with the shared daylight; all afterglow is gone by 19:30.
    var sunset=ramp(1020,1090,visualMinute)*(1-ramp(1140,1170,visualMinute));
    var goldenHour=Math.max(dawn,sunset);
    var cloudSea=ramp(300,340,visualMinute)*(1-ramp(1140,1170,visualMinute));
    var sunVisibility=ramp(305,330,visualMinute)*(1-ramp(1140,1170,visualMinute));
    // Map east is +x, west -x, south +z. Keep the hidden half orbit continuous too.
    function orbit(rise,visibleMinutes,altitude){
      var elapsed=(visualMinute-rise+1440)%1440;
      var angle=elapsed<=visibleMinutes?Math.PI*elapsed/visibleMinutes:
        Math.PI+Math.PI*(elapsed-visibleMinutes)/(1440-visibleMinutes);
      return {x:500*Math.cos(angle),y:500*Math.sin(angle)*Math.sin(altitude),
        z:500*Math.sin(angle)*Math.cos(altitude)};
    }
    // Moon rises at 19:00, sets at 05:30 and reaches 38 degrees above the southern horizon.
    var sunPosition=orbit(330,810,.78),moonPosition=orbit(1140,630,.66);
    var moonVisibility=ramp(0,.06,moonPosition.y/500);
    function normalized(x, y, z) { var length = Math.hypot(x, y, z); return { x: x / length, y: y / length, z: z / length }; }
    var twilight = Math.max(0, 1 - Math.abs(daylight - .28) / .28);
    // Haze thickens as the sun sinks: nil overhead at noon, strongest in the last
    // few degrees before it sets, and gone once the disc is down (no moonlit smog).
    var sunElevation = normalized(sunPosition.x, sunPosition.y, sunPosition.z).y;
    var lowSunHaze = clamp((.34 - sunElevation) / .34, 0, 1) * goldenHour;
    return { minute: minute, daylight: daylight, night: 1 - daylight, cloudSea: cloudSea,
      goldenHour:goldenHour,sunsetBlend:sunset,sunVisibility:sunVisibility,lowSunHaze:lowSunHaze,
      sunRadius:mix(.0105,.031,goldenHour),moonRadius:.052,moonPosition:moonPosition,moonVisibility:moonVisibility,
      dusk: Math.max(dusk, twilight * .5), daySeconds: seconds,
      // One revolution per three town days (45 minutes at 1x), framed for the evening skyline.
      spaceAngle: ((seconds - 1240 * .625) * Math.PI / 1350) % (Math.PI * 2),
      cloudShift: (seconds * .00012) % 1, sunPosition: sunPosition,
      sunDirection: normalized(sunPosition.x, sunPosition.y, sunPosition.z),
      moonDirection: normalized(moonPosition.x,moonPosition.y,moonPosition.z) };
  }

  function skyDirection(u, v) {
    var longitude = (u - .5) * Math.PI * 2, latitude = (.5 - v) * Math.PI;
    return { x: Math.cos(latitude) * Math.cos(longitude), y: Math.sin(latitude),
      z: Math.cos(latitude) * Math.sin(longitude) };
  }
  function projectSky(direction, w, h, yaw, pitch) {
    var s = Math.sin(yaw), c = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
    var depth = -s * cp * direction.x - sp * direction.y - c * cp * direction.z;
    if (depth <= .12) return null;
    var focal = h / (2 * Math.tan(Math.PI / 12));
    return { x: w / 2 + (c * direction.x - s * direction.z) * focal / depth,
      y: h / 2 - (-s * sp * direction.x + cp * direction.y - c * sp * direction.z) * focal / depth,
      scale: focal / depth };
  }

  function skyAtlas(pattern) {
    var image = canvas(4096, 2048), ctx = image.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, image.width, image.height);
    pattern.clouds.forEach(function (cloud) {
      cloud.lobes.forEach(function (lobe) {
        for (var wrap = -1; wrap <= 1; wrap++) {
          ctx.save(); ctx.translate((cloud.u + lobe.du + wrap) * image.width,
            (cloud.v + lobe.dv) * image.height);
          ctx.scale(lobe.rx * image.width, lobe.ry * image.height);
          var gradient = ctx.createRadialGradient(0, 0, .22, 0, 0, 1);
          gradient.addColorStop(0, 'rgba(255,0,0,' + lobe.opacity + ')');
          gradient.addColorStop(.62, 'rgba(255,0,0,' + lobe.opacity * .84 + ')');
          gradient.addColorStop(1, 'rgba(255,0,0,0)');
          ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      });
    });
    // Fine fallback stars are ready immediately; the photographic galaxy loads asynchronously.
    ctx.globalCompositeOperation = 'lighter';
    pattern.stars.forEach(function (star) {
      ctx.fillStyle = 'rgb(0,' + Math.round(star.brightness * 255) + ',0)';
      ctx.beginPath(); ctx.arc(star.u * image.width, star.v * image.height, star.radius, 0, Math.PI * 2); ctx.fill();
    });
    // The spare blue channel stores periodic noise for the cloud sea: no extra texture.
    // Wrapped border keeps interpolation continuous across the noise tile seams.
    var tile=canvas(130,130),tileContext=tile.getContext('2d'),pixels=tileContext.createImageData(130,130);
    for(var y=0;y<130;y++)for(var x=0;x<130;x++){
      var index=(y*130+x)*4;pixels.data[index+2]=Math.round(hash((x+127)%128,(y+127)%128,pattern.seed)*255);pixels.data[index+3]=255;
    }
    tileContext.putImageData(pixels,0,0);ctx.imageSmoothingEnabled=true;
    ctx.drawImage(tile,-image.width/128,-image.height/128,image.width*130/128,image.height*130/128);
    return image;
  }

  function createSky(T, seed, onReady) {
    var pattern = skyPattern(seed), map = new T.CanvasTexture(skyAtlas(pattern));
    map.name = 'city-sky-clouds-stars'; map.colorSpace = T.NoColorSpace;
    map.wrapS = T.RepeatWrapping; map.wrapT = T.RepeatWrapping;
    map.generateMipmaps = false; map.minFilter = T.LinearFilter; map.magFilter = T.LinearFilter;
    // A full-sphere photo is sampled directly, never rebaked into a low-resolution cube.
    var galaxyMap = new T.Texture();
    galaxyMap.name = 'city-sky-eso-milky-way'; galaxyMap.colorSpace = T.SRGBColorSpace;
    galaxyMap.wrapS = T.RepeatWrapping; galaxyMap.wrapT = T.ClampToEdgeWrapping;
    galaxyMap.minFilter = T.LinearMipmapLinearFilter; galaxyMap.magFilter = T.LinearFilter;
    var galaxyRotation = new T.Matrix3().setFromMatrix4(new T.Matrix4().makeRotationFromEuler(
      new T.Euler(-.6108652382, 2.2207963268, -.2168184589, 'YZX'))).transpose();
    var uniforms = { atlas: { value: map }, galaxyMap: { value: galaxyMap }, galaxyReady: { value: 0 },
      galaxyRotation: { value: galaxyRotation }, spaceSpin: { value: new T.Vector2(1,0) }, daylight: { value: 1 }, dusk: { value: 0 },
      cloudShift: { value: 0 }, seconds: { value: 0 }, intensity: { value: 1 },
      cloudSea: { value: 1 }, cloudEye: { value: new T.Vector3() }, cloudClip: { value: new T.Vector4(0,0,0,1) },
      goldenHour:{value:0},sunsetBlend:{value:0},sunVisibility:{value:1},sunRadius:{value:.0105},moonRadius:{value:.052},moonVisibility:{value:0},lowSunHaze:{value:0},
      screenOutput: { value: 1 }, toneMappingExposure: { value: 1 },
      sunDirection: { value: new T.Vector3() }, moonDirection: { value: new T.Vector3() } };
    var material = new T.RawShaderMaterial({
      name: 'city-sky', glslVersion: T.GLSL3, side: T.BackSide, depthWrite: false, depthTest: true,
      uniforms: uniforms,
      vertexShader: [
        'precision highp float;',
        'uniform mat4 viewMatrix,projectionMatrix;',
        'in vec3 position;',
        'out vec3 skyDirection;',
        'void main(){',
        ' skyDirection=position;',
        ' vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*position,1.0);',
        ' gl_Position=p.xyww;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'precision highp float;',
        'uniform sampler2D atlas,galaxyMap;',
        'uniform float galaxyReady;',
        'uniform mat3 galaxyRotation;',
        'uniform vec2 spaceSpin;',
        'uniform float daylight,dusk,cloudShift,seconds,intensity;',
        'uniform vec3 sunDirection,moonDirection,cloudEye;',
        'uniform float cloudSea; uniform vec4 cloudClip;',
        'uniform float goldenHour,sunsetBlend,sunVisibility,sunRadius,moonRadius,moonVisibility;',
        // Low-sun haze. Rises as the sun drops toward the horizon so the raking
        // light has air to be seen in; the medium is the sky sphere itself, which
        // keeps this free of extra draw calls and shader programs.
        'uniform float lowSunHaze;',
        'in vec3 skyDirection;',
        'out vec4 fragColor;',
        'uniform float screenOutput;',
        '#include <tonemapping_pars_fragment>',
        '#include <colorspace_pars_fragment>',
        // Source-pixel rank filtering suppresses enlarged photographic star blobs while
        // preserving the original dust structure. Reference: solar-observatory/engine.js.
        'vec3 galaxyAt(vec3 direction){',
        ' vec3 g=galaxyRotation*direction;',
        ' vec2 uv=vec2(atan(g.z,g.x)/6.28318530718+0.5,asin(clamp(g.y,-1.0,1.0))/3.14159265359+0.5);',
        ' vec2 px=vec2(1.0/6000.0,1.0/3000.0);',
        ' vec3 raw=textureLod(galaxyMap,uv,0.0).rgb;',
        ' vec3 low0=vec3(10000.0),low1=low0,low2=low0;',
        ' float l0=10000.0,l1=l0,l2=l0;',
        ' for(int i=0;i<9;i++){',
        '  float angle=float(i)*0.78539816339;',
        '  vec2 offset=i==8?vec2(0.0):vec2(cos(angle),sin(angle))*2.6*px;',
        '  vec3 sampleColor=textureLod(galaxyMap,uv+offset,1.0).rgb;',
        '  float lum=dot(sampleColor,vec3(0.2126,0.7152,0.0722));',
        '  if(lum<l0){low2=low1;l2=l1;low1=low0;l1=l0;low0=sampleColor;l0=lum;}',
        '  else if(lum<l1){low2=low1;l2=l1;low1=sampleColor;l1=lum;}',
        '  else if(lum<l2){low2=sampleColor;l2=lum;}',
        ' }',
        ' float rawLum=dot(raw,vec3(0.2126,0.7152,0.0722));',
        ' vec3 limited=raw*min(1.0,(l2*1.08+0.002)/max(rawLum,0.00001));',
        ' vec3 detail=mix(low2,limited,0.55)+(raw-limited)*0.10;',
        ' float gray=dot(detail,vec3(0.2126,0.7152,0.0722));',
        ' return mix(vec3(gray),detail,0.38)*vec3(0.98,1.0,1.035)*0.272;',
        '}',
        "float seaNoise(vec3 p){",
        " vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);",
        " vec2 uv=(i.xy+vec2(37.0,17.0)*i.z+f.xy+0.5)/128.0;",
        " return mix(texture(atlas,fract(uv)).b,texture(atlas,fract(uv+vec2(37.0,17.0)/128.0)).b,f.z);",
        "}",
        "float seaDensity(vec3 p){",
        " vec3 q=mat3(0.0,.8,.6,-.8,.36,-.48,-.6,-.48,.64)*p;",
        " float n=seaNoise(q*.007)*.72+seaNoise(q*.021+vec3(19.0,43.0,11.0))*.28;",
        " return clamp((n-.32)*3.8-max(0.0,(p.y+110.0)/80.0),0.0,1.0)*smoothstep(-164.0,-132.0,p.y)*(1.0-smoothstep(-42.0,-24.0,p.y));",
        "}",
        "vec3 horizonAt(vec3 d){",
        " float facing=.28+.72*pow(max(dot(normalize(d.xz),normalize(sunDirection.xz)),0.0),4.0);",
        " vec3 base=mix(vec3(.016,.027,.060),vec3(.72,.85,.91),daylight);",
        " vec3 warm=mix(vec3(1.65,.48,.12),vec3(1.45,.27,.09),sunsetBlend);",
        " return mix(base,warm,goldenHour*facing);",
        "}",
        "vec4 seaAt(vec3 direction,vec3 background){",
        " float rayY=abs(direction.y)<0.001?(direction.y<0.0?-0.001:0.001):direction.y;",
        " float a=(-164.0-cloudEye.y)/rayY,b=(-24.0-cloudEye.y)/rayY;",
        " float start=max(0.0,min(a,b)),finish=max(a,b);",
        " float clipRate=dot(cloudClip.xyz,direction),clipOrigin=dot(cloudClip.xyz,cloudEye)+cloudClip.w;",
        " if(abs(clipRate)>.00001){float t=-clipOrigin/clipRate;if(clipRate>0.0)start=max(start,t);else finish=min(finish,t);}",
        " else if(clipOrigin<0.0)return vec4(0.0);",
        " if(finish<=start)return vec4(0.0);",
        " float fog=1.0-exp(-start/1400.0),stepSize=min(finish-start,600.0)/12.0;",
        " vec3 sum=vec3(0.0);float opacity=0.0;",
        " float jitter=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));",
        " for(int i=0;i<12;i++){",
        "  vec3 p=cloudEye+direction*(start+(float(i)+.35+jitter*.3)*stepSize);",
        "  p.xz+=vec2(seconds*.72,seconds*.24);",
        "  float density=seaDensity(p);",
        "  float alpha=1.0-exp(-density*stepSize*.055);if(alpha<.002)continue;",
        "  float light=clamp(mix(.56,.10+.78*smoothstep(-138.0,-44.0,p.y),goldenHour)+mix(1.6,2.0,goldenHour)*(density-seaDensity(p+sunDirection*38.0)),0.0,1.0);",
        "  vec3 tint=mix(vec3(.13,.23,.37),vec3(1.45,1.46,1.48),light);",
        "  vec3 warm=mix(vec3(2.65,1.10,.32),vec3(2.15,.62,.18),sunsetBlend);",
        "  float forwardGlow=pow(max(dot(direction,sunDirection),0.0),12.0);",
        "  vec3 sunsetCloud=mix(vec3(.035,.065,.12),warm,clamp(light*.94+forwardGlow*.20*pow(1.0-density,2.0),0.0,1.0));",
        "  tint=mix(tint,sunsetCloud,goldenHour*.93);",
        "  sum+=(1.0-opacity)*alpha*tint;opacity+=(1.0-opacity)*alpha;",
        "  if(opacity>.995)break;",
        " }",
        " vec3 color=sum/max(opacity,.0001);",
        " color=mix(color,background,fog);",
        " return vec4(color,mix(opacity,1.0,fog));",
        "}",
        'void main(){',
        ' vec3 d=normalize(skyDirection);',
        ' float up=max(0.0,d.y), height=pow(up,0.55);',
        ' vec2 uv=vec2(atan(d.z,d.x)/6.28318530718+0.5,asin(clamp(d.y,-1.0,1.0))/3.14159265359+0.5);',
        ' float cloud=texture(atlas,vec2(uv.x-cloudShift,uv.y)).r*smoothstep(0.02,0.13,d.y);',
        ' vec3 q=vec3(spaceSpin.x*d.x+spaceSpin.y*d.z,d.y,-spaceSpin.y*d.x+spaceSpin.x*d.z);',
        ' vec2 starUV=vec2(atan(q.z,q.x)/6.28318530718+0.5,asin(clamp(q.y,-1.0,1.0))/3.14159265359+0.5);',
        ' float star=texture(atlas,starUV).g;',
        ' vec3 day=mix(vec3(0.72,0.85,0.91),vec3(0.16,0.42,0.73),height);',
        ' vec3 night=mix(vec3(0.0004,0.0008,0.0023),vec3(0.0002,0.0004,0.0011),abs(d.y));',
        ' vec3 color=mix(night,day,daylight);',
        ' color=mix(color,mix(horizonAt(d),vec3(.026,.075,.18),smoothstep(.008,.20,up)),goldenHour);',
        ' float sunDot=dot(d,sunDirection);',
        // Distant cloud banks obscure the setting/rising disc with a soft, uneven edge.
        ' float bankCover=0.0;',
        ' if(goldenHour*cloudSea>.001){',
        '  vec3 bankPoint=vec3(d.x*74.0,9.0,d.z*74.0)+vec3(seconds*.002,0.0,seconds*.0007);',
        '  float bankNoise=seaNoise(bankPoint)*.7+seaNoise(bankPoint*2.7+vec3(13.0))*.3;',
        '  float bankTop=(bankNoise-.5)*.026-.002;',
        '  bankCover=(1.0-smoothstep(bankTop-.014,bankTop+.010,d.y))*cloudSea;',
        '  color=mix(color,horizonAt(d)*(.90+bankNoise*.12),bankCover*goldenHour*.72);',
        ' }',
        ' float sunDisc=smoothstep(cos(sunRadius*1.03),cos(sunRadius*.97),sunDot)*(1.0-bankCover);',
        // Raking sun only reads when there is air in front of it. A warm band hugs
        // the horizon and thickens toward the sun, strongest while the disc is low.
        // Without it the low sun is only a flat wash of colour with no volume.
        ' if(lowSunHaze>0.001){',
        '  float towardSun=pow(max(dot(normalize(vec3(d.x,0.0,d.z)),normalize(vec3(sunDirection.x,0.0,sunDirection.z))),0.0),1.6);',
        '  float band=exp(-max(up,0.0)/0.085)*(0.30+0.70*towardSun);',
        '  vec3 hazeTint=mix(vec3(0.62,0.70,0.82),vec3(1.06,0.62,0.30),goldenHour);',
        '  color=mix(color,hazeTint*mix(0.9,1.25,goldenHour),clamp(band*lowSunHaze,0.0,0.86));',
        ' }',
        ' float sunHalo=exp((sunDot-1.0)/mix(.002,.012,goldenHour))*.8;',
        ' vec3 sunRight=normalize(cross(vec3(0.0,1.0,0.0),sunDirection));',
        ' vec3 sunUp=cross(sunDirection,sunRight);',
        ' float angle=atan(dot(d,sunUp),dot(d,sunRight));',
        ' float rays=pow(.5+.5*sin(angle*13.0+sin(angle*5.0)*1.8),10.0);',
        ' sunHalo+=rays*exp((sunDot-1.0)/.040)*goldenHour*.12;',
        ' vec3 sunTint=mix(vec3(1.0,.82,.53),vec3(1.0,.32,.055),goldenHour*.75);',
        ' vec3 discTint=mix(vec3(1.0,.20,.025),vec3(1.0,.72,.30),smoothstep(-sunRadius,sunRadius,d.y-sunDirection.y));',
        ' color+=(sunTint*sunHalo+mix(vec3(1.0,.82,.53),discTint,goldenHour)*sunDisc*3.6)*sunVisibility*(1.0-cloud*.45);',
        ' vec3 cloudColor=mix(vec3(0.043,0.062,0.104),vec3(1.12,1.14,1.13),daylight);',
        ' cloudColor=mix(cloudColor,vec3(1.60,.65,.24),goldenHour*.8);',
        ' color=mix(color,cloudColor,cloud*(0.76+daylight*0.18)*daylight);',
        ' float nightAmount=pow(1.0-daylight,2.0);',
        ' float starsVisible=nightAmount*(1.0-goldenHour*.97);',
        ' if(galaxyReady>0.5&&nightAmount>0.0001) color+=galaxyAt(q)*starsVisible;',
        ' vec3 starTint=mix(vec3(0.82,0.88,1.0),vec3(1.0,0.92,0.82),0.5+0.5*sin(uv.x*137.0+uv.y*79.0));',
        ' color+=starTint*pow(star,1.2)*starsVisible*0.85;',
        ' float moonAmount=nightAmount*moonVisibility;',
        ' float moonDot=dot(d,moonDirection);',
        ' float moonDisc=smoothstep(cos(moonRadius*1.012),cos(moonRadius*.988),moonDot);',
        ' vec3 right=normalize(cross(vec3(0.0,1.0,0.0),moonDirection));',
        ' vec3 top=cross(moonDirection,right);',
        ' float halo=exp((moonDot-1.0)/.007)*.09+exp((moonDot-1.0)/.0018)*.08;',
        ' color+=vec3(.68,.77,1.0)*halo*moonAmount;',
        ' if(moonDisc>0.0){',
        '  vec2 moonUV=vec2(dot(d,right),dot(d,top))/sin(moonRadius);',
        '  float depth=sqrt(max(0.0,1.0-dot(moonUV,moonUV)));vec3 surface=vec3(moonUV,depth);',
        '  vec2 mareUV=moonUV+sin(moonUV.yx*7.0+vec2(3.0,1.0))*.055;',
        '  vec2 q0=(mareUV-vec2(-.27,.25))*vec2(2.8,2.3),q1=(mareUV-vec2(.23,.40))*vec2(4.0,3.1);',
        '  vec2 q2=(moonUV-vec2(-.37,-.15))*vec2(4.1,3.3),q3=(moonUV-vec2(.38,-.03))*vec2(4.2,5.0);',
        '  float maria=clamp(exp(-dot(q0,q0))*1.1+exp(-dot(q1,q1))*.78+exp(-dot(q2,q2))*.80+exp(-dot(q3,q3))*.65,0.0,1.5);',
        '  float detail=(seaNoise(surface*17.0)+seaNoise(surface*43.0))*.10-.08;',
        '  float relief=0.0;',
        '  for(int j=0;j<14;j++){',
        '   float k=float(j);vec2 center=vec2(sin(k*19.13),cos(k*37.7))*.69;',
        '   float radius=.025+.065*fract(k*.371);',
        '   float r=length(moonUV-center)/radius;',
        '   relief+=.08*exp(-pow((r-1.0)*9.0,2.0))-.16*exp(-r*r*2.0);',
        '  }',
        '  float albedo=(.83-maria*.38+detail+relief)*(.85+.15*pow(depth,.5));',
        '  color=mix(color,vec3(1.08,1.09,1.06)*albedo,moonDisc*moonAmount);',
        ' }',
        ' if(cloudSea>0.0001){vec4 sea=seaAt(d,color);color=mix(color,sea.rgb,sea.a*cloudSea);}',
        ' color*=intensity;',
        ' fragColor=screenOutput>0.5?sRGBTransferOETF(vec4(ACESFilmicToneMapping(color),1.0)):vec4(color,1.0);',
        '}'
      ].join('\n')
    });
    var geometry = new T.BoxGeometry(2, 2, 2), mesh = new T.Mesh(geometry, material);
    // Existing opaque depth rejects hidden galaxy fragments; transparent water/glass still render afterwards.
    mesh.name = 'city-sky'; mesh.frustumCulled = false; mesh.renderOrder = 1000;
    mesh.castShadow = false; mesh.receiveShadow = false; mesh.raycast = function () {};
    // Raw shader shares one program across screen, water and facade passes. Each
    // pass still receives the appropriate linear HDR or ACES + sRGB output.
    var cloudViewProjection=new T.Matrix4();
    mesh.onBeforeRender = function (renderer, scene, camera) {
      if(camera&&camera.matrixWorld){
        uniforms.cloudEye.value.setFromMatrixPosition(camera.matrixWorld);
        // Respect the reflection camera's oblique near plane: clouds below water
        // must not leak into a reflection that only sees the world above it.
        var m=cloudViewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements;
        uniforms.cloudClip.value.set(m[3]+m[2],m[7]+m[6],m[11]+m[10],m[15]+m[14]);
      }
      uniforms.intensity.value = scene.backgroundIntensity;
      uniforms.screenOutput.value = renderer.getRenderTarget() === null ? 1 : 0;
      uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
      material.uniformsNeedUpdate = true;
    };
    var disposed = false, request = null, retryTimer = null, attempts = 0;
    function loadGalaxy() {
      retryTimer = null;
      if (disposed || typeof root.Image !== 'function') return;
      var image = request = new root.Image(); attempts++;
      image.decoding = 'async';
      image.onload = function () {
        if (disposed || request !== image) return;
        request = null; image.onload = null; image.onerror = null;
        galaxyMap.image = image; galaxyMap.needsUpdate = true;
        uniforms.galaxyReady.value = 1;
        // The owner invalidates paused screen and reflected-sky captures together.
        if (typeof onReady === 'function') onReady();
      };
      image.onerror = function () {
        if (disposed || request !== image) return;
        request = null; image.onload = null; image.onerror = null;
        if (attempts < 3 && typeof root.setTimeout === 'function')
          retryTimer = root.setTimeout(loadGalaxy, attempts * 500);
      };
      image.src = 'assets/eso-milky-way.jpg';
    }
    function update(frame) {
      if (disposed) return;
      uniforms.daylight.value = frame.daylight; uniforms.dusk.value = frame.dusk;uniforms.cloudSea.value=frame.cloudSea;
      uniforms.goldenHour.value=frame.goldenHour;uniforms.sunsetBlend.value=frame.sunsetBlend;
      uniforms.sunVisibility.value=frame.sunVisibility;uniforms.sunRadius.value=frame.sunRadius;uniforms.moonRadius.value=frame.moonRadius;uniforms.moonVisibility.value=frame.moonVisibility;
      uniforms.lowSunHaze.value=frame.lowSunHaze;
      uniforms.cloudShift.value = frame.cloudShift; uniforms.seconds.value = frame.daySeconds;
      uniforms.spaceSpin.value.set(Math.cos(frame.spaceAngle),Math.sin(frame.spaceAngle));
      uniforms.sunDirection.value.set(frame.sunDirection.x, frame.sunDirection.y, frame.sunDirection.z);
      uniforms.moonDirection.value.set(frame.moonDirection.x, frame.moonDirection.y, frame.moonDirection.z);
    }
    update(skyState()); loadGalaxy();
    return { mesh: mesh, pattern: pattern, update: update, dispose: function () {
      if (disposed) return; disposed = true;
      if (retryTimer !== null) root.clearTimeout(retryTimer);
      if (request) { request.onload = null; request.onerror = null; request.removeAttribute('src'); request = null; }
      geometry.dispose(); material.dispose(); map.dispose(); galaxyMap.dispose(); galaxyMap.image = null;
    }};
  }

  function paintSky(ctx, w, h, state, seed) {
    var frame = skyState(state.daySeconds, state.lighting ? state.lighting.dusk : 0);
    var yaw = state.yaw + (state.cameraYaw || 0), pitch = state.pitch + (state.cameraPitch || 0);
    var focal = h / (2 * Math.tan(Math.PI / 12)), horizon = h / 2 - Math.tan(pitch) * focal;
    var gradient = ctx.createLinearGradient(0, Math.min(-1, horizon - h * 1.8), 0, horizon);
    function rgb(day, night) { return 'rgb(' + day.map(function (n, i) { return Math.round(mix(night[i], n, frame.daylight)); }).join(',') + ')'; }
    gradient.addColorStop(0, rgb([102,174,224],[13,24,48]));
    gradient.addColorStop(.82, rgb([185,218,236],[24,38,64]));
    gradient.addColorStop(1, rgb([228,236,231],[31,45,67]));
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    if (frame.goldenHour > 0) {
      var warm = ctx.createLinearGradient(0, horizon - h * .55, 0, horizon);
      warm.addColorStop(0, 'rgba(236,149,102,0)'); warm.addColorStop(1, 'rgba(245,115,48,' + frame.goldenHour * .9 + ')');
      ctx.fillStyle = warm; ctx.fillRect(0, 0, w, h);
      // The same low-sun medium the GPU sky draws, so the fallback canvas and the
      // WebGL sky do not drift apart at dusk.
      if (frame.lowSunHaze > 0.001) {
        var haze = ctx.createLinearGradient(0, horizon - h * .16, 0, horizon + h * .04);
        haze.addColorStop(0, 'rgba(214,132,74,0)');
        haze.addColorStop(1, 'rgba(226,142,78,' + frame.lowSunHaze * .62 + ')');
        ctx.fillStyle = haze; ctx.fillRect(0, horizon - h * .16, w, h * .2);
      }
    }
    var pattern = skyPattern(seed), starsVisible=frame.night*frame.night*(1-frame.goldenHour*.97);
    function projected(u, v) { return projectSky(skyDirection(u, v), w, h, yaw, pitch); }
    var spinC=Math.cos(frame.spaceAngle),spinS=Math.sin(frame.spaceAngle);
    function spaceProjected(u,v){var d=skyDirection(u,v);return projectSky({x:spinC*d.x-spinS*d.z,y:d.y,z:spinS*d.x+spinC*d.z},w,h,yaw,pitch);}
    if (frame.night > 0) {
      ctx.save(); ctx.globalAlpha = starsVisible;
      var space = ctx.createLinearGradient(0, 0, w, h);
      space.addColorStop(0, '#02040a'); space.addColorStop(.5, '#03050b'); space.addColorStop(1, '#010308');
      ctx.fillStyle = space; ctx.fillRect(0, 0, w, h); ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      pattern.galaxy.lobes.forEach(function (lobe) {
        var p = spaceProjected(lobe.u, lobe.v);
        if (!p) return;
        var rx = lobe.rx * Math.PI * 2 * Math.cos((.5-lobe.v)*Math.PI) * p.scale, ry = lobe.ry * Math.PI * p.scale;
        if (p.x < -rx || p.x > w+rx || p.y < -ry || p.y > h+ry) return;
        var tint = Math.sin(lobe.u * Math.PI * 6) > 0 ? '97,102,112' : '92,100,111';
        ctx.save(); ctx.translate(p.x,p.y); ctx.scale(rx,ry);
        var gas = ctx.createRadialGradient(0,0,0,0,0,1), alpha = lobe.opacity * starsVisible * .55;
        gas.addColorStop(0,'rgba('+tint+','+alpha+')'); gas.addColorStop(.45,'rgba('+tint+','+alpha*.4+')'); gas.addColorStop(1,'rgba('+tint+',0)');
        ctx.fillStyle=gas;ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.fill();ctx.restore();
      });
      ctx.restore();
    }
    if (frame.night > 0) pattern.stars.forEach(function (star) {
      var point = spaceProjected(star.u, star.v);
      if (!point || point.x < -4 || point.x > w + 4 || point.y < -4 || point.y > h + 4) return;
      ctx.fillStyle = 'rgba(225,233,245,' + star.brightness * starsVisible * .8 + ')';
      ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(.4, star.radius * point.scale * Math.PI * 2 / 4096), 0, Math.PI * 2); ctx.fill();
    });
    function body(direction, radius, sun) {
      var p = projectSky(direction, w, h, yaw, pitch), alpha = sun ? frame.sunVisibility : frame.night * frame.night * frame.moonVisibility;
      if (!p || !alpha) return;
      var r = radius * p.scale;
      ctx.save(); ctx.globalAlpha = alpha;
      var halo = ctx.createRadialGradient(p.x, p.y, r * .8, p.x, p.y, r * 6);
      halo.addColorStop(0, sun ? 'rgba(255,233,179,.36)' : 'rgba(198,219,255,.16)');
      halo.addColorStop(1, sun ? 'rgba(255,233,179,0)' : 'rgba(198,219,255,0)');
      ctx.fillStyle = halo; ctx.fillRect(p.x-r*6,p.y-r*6,r*12,r*12);
      ctx.fillStyle = sun ? '#fff6d5' : '#f3f3de'; ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
      if (!sun) {
        ctx.fillStyle = 'rgba(164,181,174,.22)';
        [[-.3,-.25,.21],[.32,.1,.14],[-.12,.44,.13]].forEach(function (crater) {
          ctx.beginPath();ctx.arc(p.x+crater[0]*r,p.y+crater[1]*r,crater[2]*r,0,Math.PI*2);ctx.fill();
        });
      }
      ctx.restore();
    }
    body(frame.sunDirection,frame.sunRadius,true); body(frame.moonDirection,frame.moonRadius,false);
    if(frame.cloudSea>0){
      ctx.save();ctx.globalAlpha=frame.cloudSea;
      var sea=ctx.createLinearGradient(0,horizon-h*.06,0,horizon+h*.75);
      function seaColor(day,warm,alpha){return 'rgba('+day.map(function(n,i){return Math.round(mix(n,warm[i],frame.goldenHour));}).join(',')+','+alpha+')';}
      sea.addColorStop(0,seaColor([217,235,247],[243,171,102],0));
      sea.addColorStop(.16,seaColor([225,237,247],[243,171,102],.96));sea.addColorStop(1,seaColor([196,214,229],[127,137,159],1));
      ctx.fillStyle=sea;ctx.fillRect(0,0,w,h);
      for(var c=0;c<80;c++){
        var band=Math.floor(c/16),u=c/16+frame.cloudShift*.4,v=.525+band*.076+hash(c,9,seed)*.03;
        var p=projected(u,v);if(!p)continue;
        var rx=(.13+hash(c,10,seed)*.06)*p.scale,ry=rx*(.28+hash(c,11,seed)*.18);
        if(p.x<-rx||p.x>w+rx||p.y<-ry||p.y>h+ry)continue;
        ctx.save();ctx.translate(p.x,p.y);ctx.scale(rx,ry);
        var puff=ctx.createRadialGradient(-.2,-.3,0,0,0,1);
        puff.addColorStop(0,'rgba(255,'+Math.round(255-frame.goldenHour*50)+','+Math.round(255-frame.goldenHour*118)+',.95)');
        puff.addColorStop(.48,'rgba(248,'+Math.round(252-frame.goldenHour*86)+','+Math.round(255-frame.goldenHour*145)+',.90)');
        puff.addColorStop(.82,'rgba(185,205,225,.40)');puff.addColorStop(1,'rgba(185,205,225,0)');
        ctx.fillStyle=puff;ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.fill();ctx.restore();
      }ctx.restore();
    }
    pattern.clouds.forEach(function (cloud) {
      cloud.lobes.forEach(function (lobe) {
        var v = cloud.v + lobe.dv, p = projected(cloud.u + lobe.du + frame.cloudShift, v);
        if (!p) return;
        var rx = lobe.rx * Math.PI * 2 * Math.cos((.5-v)*Math.PI) * p.scale;
        var ry = lobe.ry * Math.PI * p.scale;
        if (p.x < -rx || p.x > w+rx || p.y < -ry || p.y > h+ry) return;
        ctx.save();ctx.translate(p.x,p.y);ctx.scale(rx,ry);
        var cloudGradient=ctx.createRadialGradient(0,0,.22,0,0,1);
        var opacity=lobe.opacity*.78*frame.daylight;
        var tint=rgb([255,255,248],[63,84,120]).slice(4,-1);
        cloudGradient.addColorStop(0,'rgba('+tint+','+opacity+')');
        cloudGradient.addColorStop(.62,'rgba('+tint+','+opacity*.84+')');
        cloudGradient.addColorStop(1,'rgba('+tint+',0)');
        ctx.fillStyle=cloudGradient;ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.fill();ctx.restore();
      });
    });
  }

  function create(THREE, renderer, settings) {
    settings = settings || {};
    var textures = [], materials = [], environmentTarget = null;
    var disposed = false;
    var anisotropy = Math.max(1, Math.min(8, renderer.capabilities.getMaxAnisotropy()));

    function texture(image, color, repeat, name) {
      var map = new THREE.CanvasTexture(image);
      map.name = name;
      map.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(repeat || 1, repeat || 1);
      map.anisotropy = anisotropy;
      textures.push(map);
      return map;
    }

    function surface(kind, seed, repeats) {
      var size = 256;
      var images = [canvas(size, size), canvas(size, size), canvas(size, size)];
      var contexts = images.map(function (image) { return image.getContext('2d'); });
      var pixels = contexts.map(function (context) { return context.createImageData(size, size); });
      for (var y = 0; y < size; y++) {
        for (var x = 0; x < size; x++) {
          var u = x / size, v = y / size;
          var grain = hash(x, y, seed);
          var broad = noise(u, v, 8, seed + 17);
          var fine = noise(u, v, 32, seed + 31);
          var color, rough, bump;
          if (kind === 'road') {
            color = 236 + (broad - .5) * 16 + (grain - .5) * 24;
            rough = 235 + (fine - .5) * 18 + (grain - .5) * 13;
            bump = 128 + (grain - .5) * 46 + (fine - .5) * 21;
          } else if (kind === 'grass') {
            color = 231 + (broad - .5) * 29 + (fine - .5) * 20 + (grain - .5) * 15;
            rough = 235 + (grain - .5) * 18;
            bump = 128 + (fine - .5) * 32 + (grain - .5) * 30;
          } else {
            var pore = grain < .023 ? -14 : 0;
            color = 247 + (broad - .5) * 6 + (grain - .5) * 8 + pore;
            rough = 220 + (broad - .5) * 15 + (grain - .5) * 19;
            bump = 128 + (fine - .5) * 16 + (grain - .5) * 16 + pore;
          }
          var values = [color, rough, bump];
          var offset = (y * size + x) * 4;
          for (var layer = 0; layer < 3; layer++) {
            var value = Math.round(clamp(values[layer], 0, 255));
            var data = pixels[layer].data;
            data[offset] = value;
            data[offset + 1] = value;
            data[offset + 2] = value;
            data[offset + 3] = 255;
          }
        }
      }
      contexts.forEach(function (context, i) { context.putImageData(pixels[i], 0, 0); });
      return {
        map: texture(images[0], true, repeats, kind + '-color'),
        roughnessMap: texture(images[1], false, repeats, kind + '-roughness'),
        bumpMap: texture(images[2], false, repeats, kind + '-bump')
      };
    }

    function waterBump() {
      var size = 256, image = canvas(size, size), context = image.getContext('2d');
      var pixels = context.createImageData(size, size);
      for (var y = 0; y < size; y++) {
        for (var x = 0; x < size; x++) {
          var u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
          // Integer frequencies keep both texture edges seamless.
          var wave = Math.sin(u * 7 + v * 3 + Math.sin(v * 2) * .5) * .47 +
            Math.sin(v * 13 - u * 2) * .28 + Math.sin(u * 19 + v * 8) * .15;
          var value = Math.round(128 + wave * 17);
          var offset = (y * size + x) * 4;
          pixels.data[offset] = value;
          pixels.data[offset + 1] = value;
          pixels.data[offset + 2] = value;
          pixels.data[offset + 3] = 255;
        }
      }
      context.putImageData(pixels, 0, 0);
      var map = texture(image, false, 5, 'water-ripple-bump');
      map.repeat.set(3, 12);
      return map;
    }

    function environment() {
      var width = 1024, height = 512;
      var pixels = new Uint16Array(width * height * 4);
      var toHalf = THREE.DataUtils.toHalfFloat;
      // Linear radiance retains bright clouds and sunlight through PMREM filtering.
      // This direction must agree with the scene's directional daylight.
      var sunLength = Math.sqrt(300 * 300 + 330 * 330 + 150 * 150);
      var sunX = -300 / sunLength, sunY = 330 / sunLength, sunZ = -150 / sunLength;
      var cosLongitude = new Float32Array(width), sinLongitude = new Float32Array(width);
      var cloudBandA = new Float32Array(width), cloudBandB = new Float32Array(width);
      var ridgeHeight = new Float32Array(width);
      for (var column = 0; column < width; column++) {
        var longitude = ((column + .5) / width - .5) * Math.PI * 2;
        cosLongitude[column] = Math.cos(longitude);
        sinLongitude[column] = Math.sin(longitude);
        cloudBandA[column] = .31 + Math.sin(longitude * 2 + .7) * .065 +
          Math.sin(longitude * 5 - .4) * .025;
        cloudBandB[column] = .65 + Math.sin(longitude * 3 - 1.2) * .06;
        ridgeHeight[column] = .008 + noise((column + .5) / width, .2, 32, 13841) * .012;
      }
      for (var y = 0; y < height; y++) {
        // DataTexture has flipY=false: bottom row is the south pole, unlike CanvasTexture.
        var latitude = ((y + .5) / height - .5) * Math.PI;
        var up = Math.sin(latitude), horizontal = Math.cos(latitude);
        var skyBlend = Math.pow(Math.max(0, up), .55);
        var skyR = mix(1.02, .24, skyBlend);
        var skyG = mix(1.16, .46, skyBlend);
        var skyB = mix(1.20, .78, skyBlend);
        var haze = Math.exp(-Math.max(0, up) * 6);
        for (var x = 0; x < width; x++) {
          var u = (x + .5) / width;
          var directionX = horizontal * cosLongitude[x], directionZ = horizontal * sinLongitude[x];
          var sunDot = clamp(directionX * sunX + up * sunY + directionZ * sunZ, -1, 1);
          var r = skyR, g = skyG, b = skyB;
          if (up > 0) {
            var forward = Math.exp((sunDot - 1) / .19);
            // Long, broken cloud banks leave clear blue areas between luminous edges.
            var broad = noise(u, up * .5, 12, 18403);
            var detail = noise(u, up * .5, 32, 89123);
            var warp = (broad - .5) * .11 + (detail - .5) * .025;
            var bandA = (up - cloudBandA[x] + warp) / .075;
            var bandB = (up - cloudBandB[x] + warp * .7) / .058;
            var bands = Math.exp(-bandA * bandA) + Math.exp(-bandB * bandB) * .7;
            var cloud = clamp(bands * clamp((broad * .72 + detail * .28 - .30) * 3.3, 0, 1), 0, .94);
            cloud *= clamp(up / .09, 0, 1) * clamp((.96 - up) / .15, 0, 1);
            var cloudLight = 1.38 + forward * 1.8 + detail * .23;
            r = mix(r, cloudLight * 1.025, cloud);
            g = mix(g, cloudLight * 1.01, cloud);
            b = mix(b, cloudLight, cloud);
            // A broad aureole and finite soft sun stay stable on rough glass and water.
            // The scene light supplies shadows; this source supplies specular direction.
            var halo = forward * .45 + Math.exp((sunDot - 1) / .025) * .8;
            var sun = Math.exp((sunDot - 1) / .00065) * 14;
            r += halo * 1.10 + sun * 1.06 + haze * forward * .18;
            g += halo * 1.01 + sun;
            b += halo * .84 + sun * .86;
          }
          // A narrow, softly irregular horizon separates the bright sky from a muted
          // landscape. The lower hemisphere keeps reflected ground dark, never black.
          var edge = clamp((up - ridgeHeight[x] + .014) / .028, 0, 1);
          edge = edge * edge * (3 - 2 * edge);
          if (edge < 1) {
            var distanceToHorizon = Math.exp(-Math.max(0, -up) * 13);
            var landscape = (noise(u, (up + 1) * .25, 12, 7193) - .5) * .045 * horizontal;
            var facingSun = clamp(directionX * sunX + directionZ * sunZ, 0, 1);
            var groundR = .12 + distanceToHorizon * (.12 + facingSun * .05) + landscape;
            var groundG = .145 + distanceToHorizon * (.13 + facingSun * .04) + landscape;
            var groundB = .12 + distanceToHorizon * (.115 + facingSun * .025) + landscape;
            r = mix(groundR, r, edge);
            g = mix(groundG, g, edge);
            b = mix(groundB, b, edge);
          }
          var offset = (y * width + x) * 4;
          pixels[offset] = toHalf(r);
          pixels[offset + 1] = toHalf(g);
          pixels[offset + 2] = toHalf(b);
          pixels[offset + 3] = toHalf(1);
        }
      }
      var source = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
      source.name = 'daylight-hdr-equirectangular';
      source.colorSpace = THREE.LinearSRGBColorSpace;
      source.mapping = THREE.EquirectangularReflectionMapping;
      source.wrapS = THREE.RepeatWrapping;
      source.wrapT = THREE.ClampToEdgeWrapping;
      source.generateMipmaps = false;
      source.minFilter = THREE.LinearFilter;
      source.magFilter = THREE.LinearFilter;
      source.needsUpdate = true;
      var generator = new THREE.PMREMGenerator(renderer);
      try {
        generator.compileEquirectangularShader();
        environmentTarget = generator.fromEquirectangular(source);
        environmentTarget.texture.name = 'daylight-hdr-pmrem';
        return environmentTarget.texture;
      } finally {
        // Only the filtered environment survives; do not retain a second GPU sky map.
        source.dispose();
        generator.dispose();
      }
    }

    function standard(name, parameters) {
      var material = new THREE.MeshStandardMaterial(parameters);
      material.name = 'city-' + name;
      materials.push(material);
      return material;
    }
    function physical(name, parameters) {
      var material = new THREE.MeshPhysicalMaterial(parameters);
      material.name = 'city-' + name;
      materials.push(material);
      return material;
    }

    var concrete = surface('concrete', 61357, 2);
    var asphalt = surface('road', 97531, 4);
    var turf = surface('grass', 48271, 4);
    var kit = {
      stone: standard('stone', Object.assign({ color: '#ece5d9', roughness: .9, metalness: 0, bumpScale: .12 }, concrete)),
      sand: standard('sand', Object.assign({ color: '#d2c6b4', roughness: .94, metalness: 0, bumpScale: .1 }, concrete)),
      glass: physical('glass', { color: '#8fa9ab', metalness: .18, roughness: .24,
        transmission: 0, transparent: false, opacity: 1, clearcoat: .35,
        clearcoatRoughness: .14, ior: 1.5, envMapIntensity: 1.05 }),
      vehicleGlass: standard('vehicle-glass', {color:'#c3d5d3',roughness:.26,metalness:.05,transparent:true,opacity:.28,depthWrite:false,depthTest:true}),
      road: standard('road', Object.assign({ color: '#485657', roughness: .98, metalness: 0, bumpScale: .16 }, asphalt)),
      pavement: standard('pavement', Object.assign({ color: '#e3ddd1', roughness: .94, metalness: 0, bumpScale: .07 }, concrete)),
      ground: standard('ground', Object.assign({ color: '#d8d2c7', roughness: .96, metalness: 0, bumpScale: .1 }, concrete)),
      grass: standard('grass', Object.assign({ color: '#81956d', roughness: .98, metalness: 0, bumpScale: .15 }, turf)),
      water: physical('water', { color: '#688f92', metalness: .12, roughness: .3,
        clearcoat: .8, clearcoatRoughness: .18, transmission: 0, transparent: false,
        ior: 1.333, bumpMap: waterBump(), bumpScale: .18, envMapIntensity: 1.1 }),
      metal: standard('metal', { color: '#b3beb6', metalness: .68, roughness: .42 }),
      dark: standard('dark', { color: '#354646', metalness: .08, roughness: .8 }),
      solar: physical('solar', { color: '#46616a', metalness: .32, roughness: .28,
        clearcoat: .45, clearcoatRoughness: .2 }),
      trunk: standard('trunk', { color: '#9d7d59', metalness: 0, roughness: .98 }),
      leaf: standard('leaf', { color: '#6f8567', metalness: 0, roughness: .95 }),
      skin: standard('skin', { color: '#c99977', metalness: 0, roughness: .84 })
    };

    const poolPixels=new Uint8Array(32*32*4);
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){
      const r=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5),i=(y*32+x)*4;
      poolPixels[i]=poolPixels[i+1]=poolPixels[i+2]=255;
      poolPixels[i+3]=Math.round(255*Math.pow(Math.max(0,1-r*r),2));
    }
    kit.lightPoolMap=new THREE.DataTexture(poolPixels,32,32);kit.lightPoolMap.needsUpdate=true;
    kit.lightPoolMap.magFilter=THREE.LinearFilter;kit.lightPoolMap.minFilter=THREE.LinearFilter;textures.push(kit.lightPoolMap);
    kit.update = function (next) {
      if (disposed || !next) return;
      ['stone', 'glass', 'ground'].forEach(function (name) {
        if (next[name] !== undefined && next[name] !== null) kit[name].color.set(next[name]);
      });
    };
    kit.dispose = function () {
      if (disposed) return;
      disposed = true;
      materials.forEach(function (material) { material.dispose(); });
      textures.forEach(function (map) { map.dispose(); });
      if (environmentTarget) environmentTarget.dispose();
      environmentTarget = null;
      kit.environment = null;
      materials.length = 0;
      textures.length = 0;
    };
    try {
      kit.environment = environment();
      kit.update(settings);
    } catch (error) {
      kit.dispose();
      throw error;
    }
    return kit;
  }

  var api = { create: create, skyState: skyState, skyPattern: skyPattern,
    createSky: createSky, paintSky: paintSky, skyDirection: skyDirection, projectSky: projectSky };
  root.CityMaterials = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
