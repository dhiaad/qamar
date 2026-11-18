/* Qamar — une Lune réaliste, rendue en WebGL à partir des cartes de la NASA
   (CGI Moon Kit, LRO : couleur LROC WAC et relief LOLA, domaine public).
   Elle s'affiche dans tout élément .lune-vivante qui contient un <canvas> :
     data-suivre="curseur" → elle tourne selon la position du curseur (page Explorer) ;
     sans attribut          → elle tourne très lentement sur elle-même (accueil).
   L'élément reçoit el.qamarLune.orange(0…1) pour se teinter d'orange (séquence de l'accueil).
   Sans WebGL, le disque CSS de repli (.lune-repli) reste affiché. */
(function () {
  var hotes = Array.prototype.slice.call(document.querySelectorAll('.lune-vivante'));
  if (!hotes.length) return;
  var calme = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var VS = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }';
  var FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 uRes; uniform float uAngle, uTilt, uOrange; uniform vec3 uSoleil;',
    'uniform sampler2D uCouleur, uRelief; uniform vec2 uTexel; uniform float uRelief3;',
    'const float PI = 3.14159265;',
    'mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }',
    'mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }',
    'float h(vec2 uv){ return texture2D(uRelief, uv).r; }',
    'void main(){',
    '  float rpx = .47 * min(uRes.x, uRes.y);',
    '  vec2 q = (gl_FragCoord.xy - .5 * uRes) / rpx;',
    '  float r2 = dot(q, q);',
    '  if (r2 >= 1.){ gl_FragColor = vec4(0.); return; }',
    '  float bord = 1. - smoothstep(1. - 1.8 / rpx, 1., sqrt(r2));',
    '  vec3 nv = vec3(q, sqrt(1. - r2));',
    '  mat3 M = rotX(uTilt) * rotY(uAngle);',
    '  vec3 s = M * nv; vec3 L = M * uSoleil; vec3 V = M * vec3(0., 0., 1.);',
    '  float lon = atan(s.x, s.z), lat = asin(clamp(s.y, -1., 1.));',
    '  vec2 uv = vec2(.5 + lon / (2. * PI), .5 - lat / PI);',
    // le relief : pentes lues dans la carte d'altitude, appliquées le long des méridiens et parallèles
    '  vec2 du = vec2(uTexel.x, 0.), dv = vec2(0., uTexel.y);',
    '  float gx = (h(uv + du) - h(uv - du)), gy = (h(uv - dv) - h(uv + dv));',
    '  vec3 est = normalize(vec3(cos(lon), 0., -sin(lon)));',
    '  vec3 nord = vec3(-sin(lat) * sin(lon), cos(lat), -sin(lat) * cos(lon));',
    '  vec2 pente = clamp(vec2(gx, gy), -.08, .08) * smoothstep(.0, .3, nv.z);',
    '  vec3 n = normalize(s - uRelief3 * (pente.x * est + pente.y * nord));',
    '  vec3 alb = texture2D(uCouleur, uv).rgb;',
    '  alb = pow(alb, vec3(2.7)) * 1.5;',
    '  float ci = dot(n, L), ce = max(dot(n, V), .02);',
    '  float ls = max(ci, 0.) / (max(ci, 0.) + ce);',
    '  float lumiere = mix(max(ci, 0.), 2. * ls, .6) * smoothstep(-.08, .06, dot(s, L));',
    '  vec3 col = alb * lumiere * 1.25;',
    '  col += alb * vec3(.55, .64, .8) * .03 * ce;',                 // lumière cendrée
    // la teinte orange : la Lune s'embrase en gardant son relief
    '  float lum = dot(col, vec3(.3, .55, .15));',
    '  vec3 orange = vec3(1., .31, 0.) * (lum * 2.4) + vec3(1., .55, .25) * lum * lum * 1.6;',
    '  col = mix(col, orange, uOrange);',
    '  col = col / (1. + .3 * col);',
    '  col = pow(col, vec3(1. / 2.2));',
    '  gl_FragColor = vec4(col * bord, bord);',
    '}'
  ].join('\n');

  var images = {};
  function charger(src) {
    if (!images[src]) {
      images[src] = new Promise(function (ok, ko) {
        var i = new Image();
        i.onload = function () { ok(i); };
        i.onerror = ko;
        i.src = src;
      });
    }
    return images[src];
  }
  var COULEUR = 'images/lune/lune-couleur-2k.jpg', RELIEF = 'images/lune/lune-relief-1k.jpg';

  hotes.forEach(function (hote) {
    var toile = hote.querySelector('canvas');
    var gl = toile && toile.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
    hote.qamarLune = { orange: function () {} };
    if (!gl) return;
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
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var a = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ['uRes', 'uAngle', 'uTilt', 'uOrange', 'uSoleil', 'uCouleur', 'uRelief', 'uTexel', 'uRelief3'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    var suivre = hote.getAttribute('data-suivre') === 'curseur';
    // le Soleil vient de droite et légèrement de face : une Lune presque pleine, relief visible sur le bord
    var sol = suivre ? [0.78, 0.32, 0.54] : [0.55, 0.22, 0.8];
    var ns = Math.hypot(sol[0], sol[1], sol[2]);
    gl.uniform3f(U.uSoleil, sol[0] / ns, sol[1] / ns, sol[2] / ns);
    gl.uniform1i(U.uCouleur, 0);
    gl.uniform1i(U.uRelief, 1);
    gl.uniform1f(U.uRelief3, 3.5);

    var etat = { angle: 0, tilt: 0.08, cibleA: 0, cibleT: 0.08, orange: 0, pret: false };

    function texture(unite, img) {
      var t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unite);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
    function taille() {
      var r = hote.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      var c = Math.max(64, Math.min(1100, Math.round(Math.max(r.width, r.height) * dpr)));
      if (toile.width !== c) { toile.width = c; toile.height = c; }
      gl.viewport(0, 0, c, c);
      gl.uniform2f(U.uRes, c, c);
    }
    function dessiner() {
      if (!etat.pret) return;
      gl.uniform1f(U.uAngle, etat.angle);
      gl.uniform1f(U.uTilt, etat.tilt);
      gl.uniform1f(U.uOrange, etat.orange);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    hote.qamarLune.orange = function (v) { etat.orange = Math.max(0, Math.min(1, v)); if (calme) dessiner(); };

    Promise.all([charger(COULEUR), charger(RELIEF)]).then(function (im) {
      texture(0, im[0]);
      texture(1, im[1]);
      gl.uniform2f(U.uTexel, 1 / im[1].width, 1 / im[1].height);
      etat.pret = true;
      taille();
      dessiner();
      hote.classList.add('prete');
    }).catch(function () { /* le disque de repli reste affiché */ });
    addEventListener('resize', function () { taille(); dessiner(); });
    if (calme) return;

    if (suivre) {
      // la Lune tourne avec le curseur : de gauche à droite, elle montre ses deux faces
      addEventListener('pointermove', function (e) {
        etat.cibleA = (e.clientX / innerWidth - 0.5) * 2.4;
        etat.cibleT = 0.08 + (e.clientY / innerHeight - 0.5) * 0.7;
      }, { passive: true });
    }
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
      // une Lune qui tourne lentement n'a pas besoin de 30 images par seconde, sauf quand elle change de couleur
      if (t - dernier < (suivre || etat.orange !== etat.dessineOrange ? 30 : 160)) return;
      etat.dessineOrange = etat.orange;
      var dt = Math.min(0.1, (t - avant) / 1000);
      avant = t; dernier = t;
      if (suivre) {
        etat.angle += (etat.cibleA - etat.angle) * Math.min(1, dt * 3);
        etat.tilt += (etat.cibleT - etat.tilt) * Math.min(1, dt * 3);
      } else {
        etat.angle += dt * 0.01;
      }
      dessiner();
    }
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && visible) { avant = performance.now(); requestAnimationFrame(boucle); }
    });
    requestAnimationFrame(boucle);
  });
})();
