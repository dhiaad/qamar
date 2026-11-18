/* Qamar — page « Explorer » : une Lune réaliste, calculée pixel par pixel (WebGL, sans image).
   Relief : plusieurs générations de cratères (cuvette, rebord, éjectas) ; mers sombres ;
   éclairage lunaire (Lommel-Seeliger) qui fait ressortir le relief au terminateur ;
   lumière cendrée sur la face nocturne. Elle tourne très lentement et suit un peu le pointeur.
   Sans WebGL, ou si le rendu échoue, un disque en CSS prend le relais (.lune-repli). */
(function () {
  var hote = document.querySelector('.explorer-lune');
  var toile = hote && hote.querySelector('.lune-3d');
  if (!toile) return;
  var calme = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gl = toile.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  if (!gl) return;

  var VS = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }';
  var FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 uRes; uniform float uAngle; uniform vec2 uTilt; uniform vec3 uSoleil;',
    'vec3 hash33(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }',
    'float hash13(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }',
    'float bruit(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3. - 2. * f);',
    '  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),',
    '             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z); }',
    'float fbm(vec3 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += a * bruit(p); p = p * 2.03 + 17.1; a *= .5; } return s; }',
    // une génération de cratères : renvoie (hauteur, pente xyz) et l'éclat des cratères jeunes
    'vec4 crateres(vec3 p, float graine, float densite, out float eclat){',
    '  vec4 r = vec4(0.); eclat = 0.;',
    '  vec3 base = floor(p - .5);',
    '  for (int i = 0; i < 2; i++) for (int j = 0; j < 2; j++) for (int k = 0; k < 2; k++){',
    '    vec3 c = base + vec3(float(i), float(j), float(k));',
    '    vec3 h = hash33(c + graine);',
    '    if (h.x > densite) continue;',
    '    vec3 centre = c + .25 + .5 * hash33(c * 1.7 + graine + 4.1);',
    '    float rayon = mix(.13, .42, h.y * h.y);',
    '    vec3 v = p - centre; float dist = length(v); float d = dist / rayon;',
    '    if (d > 1.75) continue;',
    '    float creux = .42 * rayon, rebord = .13 * rayon;',
    '    float dh = 0.;',
    '    if (d < 1.){ float fond = smoothstep(.0, .55, d); r.x += creux * (d * d - 1.) * mix(.82, 1., fond); dh += creux * 2. * d * mix(.82, 1., fond); }',
    '    float e = exp(-(d - 1.) * (d - 1.) / .06); float w = 1. - smoothstep(1.3, 1.75, d);',
    '    r.x += rebord * e * w; dh += rebord * e * w * (-2. * (d - 1.) / .06);',
    '    r.yzw += dh * v / (dist * rayon + 1e-5);',
    '    if (h.z > .9) eclat += (1. - smoothstep(.0, 1.6, d)) * (h.z - .9) * 10.;',
    '  }',
    '  return r;',
    '}',
    'mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }',
    'mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }',
    'void main(){',
    '  float rpx = .47 * min(uRes.x, uRes.y);',
    '  vec2 q = (gl_FragCoord.xy - .5 * uRes) / rpx;',
    '  float r2 = dot(q, q);',
    '  float lim = 1. - smoothstep(1. - 1.6 / rpx, 1., sqrt(r2));',
    '  if (r2 >= 1.){ gl_FragColor = vec4(0.); return; }',
    '  vec3 nv = vec3(q, sqrt(1. - r2));',
    '  mat3 M = rotX(.32 + uTilt.y) * rotY(uAngle + uTilt.x);',
    '  vec3 s = M * nv; vec3 L = M * uSoleil; vec3 V = M * vec3(0., 0., 1.);',
    // les mers : de grandes plaques sombres et lisses
    '  float mer = smoothstep(.47, .56, fbm(s * 1.1 + 3.7) + .12 * fbm(s * 4.3 + 9.1));',
    '  vec4 relief = vec4(0.); float eclat = 0., ec;',
    '  for (int o = 0; o < 6; o++){',
    '    float fo = float(o); float fr = 2.4 * pow(2.12, fo);',
    '    float dens = mix(.26, .62, fo / 5.) * (o > 0 ? mix(1., .22, mer) : 1.);',
    '    vec4 c = crateres(s * fr, fo * 13.7, dens, ec);',
    '    relief += vec4(c.x / fr, c.yzw);',
    '    eclat += ec * (o < 3 ? 1. : .35);',
    '  }',
    '  vec3 g = relief.yzw; g -= dot(g, s) * s;',
    '  vec3 n = normalize(s - g * .7);',
    '  float ci = dot(n, L), ce = max(dot(n, V), .02);',
    '  float ls = max(ci, 0.) / (max(ci, 0.) + ce);',
    '  float lumiere = mix(max(ci, 0.), 1.75 * ls, .72) * smoothstep(-.1, .08, dot(s, L));',
    '  float albedo = mix(.8, .36, mer) * (.86 + .28 * fbm(s * 3.1 + 1.3));',
    '  albedo *= .9 + .2 * bruit(s * 60.) + .08 * (fbm(s * 9.) - .5);',
    '  albedo = mix(albedo, .98, clamp(eclat, 0., 1.) * .55);',
    '  albedo *= .94 + .5 * clamp(relief.x * 6., -.12, .1);',
    '  vec3 teinte = vec3(1., .975, .94);',
    '  vec3 col = teinte * albedo * lumiere * 1.18;',
    // lumière cendrée (la Terre éclaire faiblement la face nocturne)
    '  col += vec3(.55, .64, .8) * albedo * .028 * ce;',
    '  col = 1. - exp(-col * 1.35);',
    '  col = pow(col, vec3(1. / 2.2));',
    '  gl_FragColor = vec4(col * lim, lim);',
    '}'
  ].join('\n');

  function shader(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(sh)); return null; }
    return sh;
  }
  var vs = shader(gl.VERTEX_SHADER, VS), fs = shader(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return;
  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var a = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  var uRes = gl.getUniformLocation(prog, 'uRes'), uAngle = gl.getUniformLocation(prog, 'uAngle');
  var uTilt = gl.getUniformLocation(prog, 'uTilt'), uSoleil = gl.getUniformLocation(prog, 'uSoleil');
  // le Soleil vient de droite et un peu de derrière : une Lune gibbeuse, le relief ressort au terminateur
  var soleil = [0.86, 0.3, 0.26], n = Math.hypot.apply(null, soleil);
  gl.uniform3f(uSoleil, soleil[0] / n, soleil[1] / n, soleil[2] / n);

  var angle = 2.1, tx = 0, ty = 0, cx = 0, cy = 0;
  function taille() {
    var r = hote.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var c = Math.max(64, Math.min(1000, Math.round(Math.max(r.width, r.height) * dpr)));
    if (toile.width !== c) { toile.width = c; toile.height = c; }
    gl.viewport(0, 0, c, c);
    gl.uniform2f(uRes, c, c);
  }
  function dessiner() {
    gl.uniform1f(uAngle, angle);
    gl.uniform2f(uTilt, cx, cy);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  taille();
  dessiner();
  hote.classList.add('prete');
  addEventListener('resize', function () { taille(); dessiner(); });
  if (calme) return;

  // le pointeur incline légèrement la Lune
  addEventListener('pointermove', function (e) {
    tx = (e.clientX / innerWidth - 0.5) * 0.22;
    ty = (e.clientY / innerHeight - 0.5) * 0.12;
  }, { passive: true });

  var visible = true, dernier = 0, avant = performance.now();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      visible = e[0].isIntersecting;
      if (visible) { avant = performance.now(); requestAnimationFrame(boucle); }
    }).observe(hote);
  }
  function boucle(t) {
    if (!visible || document.hidden) return;
    requestAnimationFrame(boucle);
    if (t - dernier < 32) return;   // 30 images par seconde suffisent à une rotation si lente
    var dt = Math.min(0.1, (t - avant) / 1000);
    avant = t; dernier = t;
    angle += dt * 0.012;
    cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
    dessiner();
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && visible) { avant = performance.now(); requestAnimationFrame(boucle); }
  });
  requestAnimationFrame(boucle);
})();
