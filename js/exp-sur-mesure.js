/* Qamar — concept 05 Sur-mesure : « Maison Halo », galerie d'art génératif.
   Une toile plein écran (un seul shader) dont les salles se fondent l'une dans l'autre ;
   le pointeur remue la matière, l'atelier laisse composer et télécharger son œuvre. */
import * as THREE from 'three';

var Q = window.Qexp;
var reduit = Q.reduit();

var PALETTES = [
  { nom: 'Encre', c: ['#0b1026', '#1f3a8a', '#d9d2c3', '#f2b84b'] },
  { nom: 'Aube', c: ['#2a0f24', '#c2416b', '#f39a6b', '#f8e3c8'] },
  { nom: 'Jardin', c: ['#0d1f17', '#2f6b4f', '#b8c98a', '#e9d38a'] },
  { nom: 'Brasier', c: ['#120707', '#7a1610', '#e0542a', '#f6c453'] }
];
var PAL_SALLE = [0, 2, 1];

var etat = { salle: 0, palette: PALETTES[0].c.slice(), chaos: 0.4, lignes: 0.3, graine: 0.37, souris: { x: 0, y: 0, actif: false } };
var choix = { pal: 0, graine: 4821 };

var toile = document.querySelector('.sm-toile');
var mode = Q.modeScene(820);
var canvas = null;

/* ---------- Salles : celle qui occupe le milieu de l'écran ---------- */
var salles = Array.prototype.slice.call(document.querySelectorAll('[data-salle]'));
function fondRepli() {
  var pi = etat.salle < 3 ? PAL_SALLE[etat.salle] : choix.pal;
  var c = PALETTES[pi].c;
  toile.style.background = 'radial-gradient(80% 60% at 30% 30%, ' + c[2] + ', transparent), radial-gradient(70% 70% at 70% 70%, ' + c[1] + ', ' + c[0] + ')';
}
var io = new IntersectionObserver(function (entrees) {
  entrees.forEach(function (e) {
    if (!e.isIntersecting) return;
    var i = +e.target.getAttribute('data-salle');
    etat.salle = i;
    etat.palette = PALETTES[i < 3 ? PAL_SALLE[i] : choix.pal].c.slice();
    if (!canvas) fondRepli();
  });
}, { rootMargin: '-45% 0px -45% 0px' });
salles.forEach(function (s) { io.observe(s); });

var zone = document.querySelector('.sm-page');
zone.addEventListener('pointermove', function (e) {
  etat.souris.x = (e.clientX / window.innerWidth) * 2 - 1;
  etat.souris.y = -((e.clientY / window.innerHeight) * 2 - 1);
  etat.souris.actif = true;
});
zone.addEventListener('pointerleave', function () { etat.souris.actif = false; });

/* ---------- Atelier ---------- */
var signature = document.querySelector('.sm-signature');
function titre() { return 'Composition n° ' + choix.graine + ' — ' + PALETTES[choix.pal].nom; }
function atelier(o) {
  if (o.pal !== undefined) {
    choix.pal = o.pal;
    etat.palette = PALETTES[o.pal].c.slice();
    document.querySelectorAll('.sm-palette').forEach(function (b, i) { b.setAttribute('aria-pressed', i === o.pal ? 'true' : 'false'); });
  }
  if (o.chaos !== undefined) etat.chaos = o.chaos;
  if (o.lignes !== undefined) etat.lignes = o.lignes;
  if (o.graine !== undefined) { choix.graine = o.graine; etat.graine = (o.graine % 1000) / 1000; }
  signature.hidden = true;
  if (!canvas && etat.salle === 3) fondRepli();
}
document.querySelectorAll('.sm-palette').forEach(function (b, i) { b.addEventListener('click', function () { atelier({ pal: i }); }); });
document.querySelector('#sm-tumulte').addEventListener('input', function (e) { atelier({ chaos: +e.target.value }); });
document.querySelector('#sm-lignes').addEventListener('input', function (e) { atelier({ lignes: +e.target.value }); });
document.querySelector('.sm-graine').addEventListener('click', function () { atelier({ graine: 1000 + Math.floor(Math.random() * 8999) }); });
var boutonSigner = document.querySelector('.sm-signer');
boutonSigner.addEventListener('click', function () {
  signature.querySelector('b').textContent = '« ' + titre() + ' »';
  signature.hidden = false;
  if (!canvas) return;
  try {
    var a = document.createElement('a');
    a.download = 'maison-halo-composition-' + choix.graine + '.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  } catch (e) { /* l'œuvre reste signée à l'écran */ }
});

/* ---------- Toile WebGL ---------- */
var VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
function FRAG(oct) {
  return [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform float uTime, uAspect, uMix, uChaos, uLines, uSeed;',
    'uniform int uFrom, uTo;',
    'uniform vec2 uMouse;',
    'uniform float uMouseOn;',
    'uniform vec3 uP0, uP1, uP2, uP3;',
    'float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32+uSeed); return fract(p.x*p.y); }',
    'float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);',
    '  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }',
    'float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<' + oct + ';i++){ s+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }',
    'vec3 pal(float t){ t = clamp(t, 0., 1.);',
    '  if(t < .33) return mix(uP0, uP1, smoothstep(0., .33, t));',
    '  if(t < .66) return mix(uP1, uP2, smoothstep(.33, .66, t));',
    '  return mix(uP2, uP3, smoothstep(.66, 1., t)); }',
    'vec2 stir(vec2 p){ vec2 d = p - uMouse; float k = exp(-dot(d,d)*7.) * uMouseOn; float a = k * 2.4;',
    '  mat2 r = mat2(cos(a), -sin(a), sin(a), cos(a)); return uMouse + r*d; }',
    'vec3 matiere(vec2 p, float t, float chaos){',
    '  vec2 q = vec2(fbm(p*1.6 + t*.05), fbm(p*1.6 + vec2(5.2,1.3) - t*.04));',
    '  vec2 r = vec2(fbm(p*1.6 + (2.+chaos*4.)*q + vec2(1.7,9.2) + t*.08), fbm(p*1.6 + (2.+chaos*4.)*q + vec2(8.3,2.8)));',
    '  float f = fbm(p*1.6 + (2.5+chaos*3.)*r);',
    '  vec3 c = pal(f*1.15); c = mix(c, uP3, smoothstep(.55,.95, length(q))*.35); return c; }',
    'vec3 lignes(vec2 p, float t, float density){',
    '  float f = fbm(p*1.3 + vec2(t*.04, -t*.03)); float g = fbm(p*2.2 - f*1.4 + t*.02);',
    '  float v = f*1.2 + g*.6; float freq = 18. + density*42.;',
    '  float l = abs(fract(v*freq) - .5); float line = smoothstep(.06, .0, l*(1.0 + density));',
    '  vec3 base = mix(uP0, uP1, smoothstep(.2, .9, v)); return mix(base, uP3, line*.9); }',
    'vec3 couleur(vec2 p, float t){',
    '  vec2 u = vec2(p.x/uAspect*.5+.5, p.y*.5+.5); float wob = fbm(u*6. + t*.05)*.035;',
    '  float b1 = smoothstep(.07+wob, .1+wob, u.y) * smoothstep(.47-wob, .44-wob, u.y);',
    '  float b2 = smoothstep(.53+wob, .56+wob, u.y) * smoothstep(.93-wob, .9-wob, u.y);',
    '  float edgeX = smoothstep(.06+wob, .1+wob, u.x) * smoothstep(.94-wob, .9-wob, u.x);',
    '  float breathe = .5+.5*sin(t*.35); vec3 c = uP0;',
    '  c = mix(c, mix(uP1, uP2, breathe*.3), b2*edgeX); c = mix(c, mix(uP2, uP3, .2+breathe*.2), b1*edgeX);',
    '  c *= .92 + .16*fbm(u*40.); return c; }',
    'vec3 room(int i, vec2 p, float t){',
    '  if(i == 0) return matiere(p, t, .35); if(i == 1) return lignes(p, t, .35); if(i == 2) return couleur(p, t);',
    '  return mix(matiere(p, t, uChaos), lignes(p, t, uChaos), uLines); }',
    'void main(){ vec2 p = (vUv - .5) * 2.; p.x *= uAspect; p = stir(p); float t = uTime;',
    '  vec3 c = mix(room(uFrom, p, t), room(uTo, p, t), uMix);',
    '  c += (hash(vUv*1000. + t) - .5) * .035; c *= 1. - .25*pow(length(vUv-.5)*1.25, 2.5);',
    '  gl_FragColor = vec4(c, 1.); }'
  ].join('\n');
}

if (mode === 'photo') {
  fondRepli();
  boutonSigner.disabled = true;
} else {
  var leger = mode === 'low';
  var rendu = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  canvas = rendu.domElement;
  toile.appendChild(canvas);
  var cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  var scene = new THREE.Scene();
  var u = {
    uTime: { value: 0 }, uAspect: { value: 1 }, uMix: { value: 1 }, uFrom: { value: 0 }, uTo: { value: 0 },
    uChaos: { value: etat.chaos }, uLines: { value: etat.lignes }, uSeed: { value: etat.graine },
    uMouse: { value: new THREE.Vector2(10, 10) }, uMouseOn: { value: 0 },
    uP0: { value: new THREE.Color(etat.palette[0]) }, uP1: { value: new THREE.Color(etat.palette[1]) },
    uP2: { value: new THREE.Color(etat.palette[2]) }, uP3: { value: new THREE.Color(etat.palette[3]) }
  };
  var mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG(leger ? 4 : 6), uniforms: u, depthTest: false });
  var plan = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  plan.frustumCulled = false;
  scene.add(plan);

  function taille() {
    var dpr = Math.min(window.devicePixelRatio || 1, leger ? 0.8 : 1.4);
    rendu.setPixelRatio(dpr);
    rendu.setSize(toile.clientWidth, toile.clientHeight, false);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }
  taille();
  window.addEventListener('resize', taille);

  var visible = true;
  new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(zone);

  var cour = etat.salle;
  var cibles = [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()];
  var souris = new THREE.Vector2();
  var horloge = new THREE.Clock();
  rendu.setAnimationLoop(function () {
    var dt = Math.min(horloge.getDelta(), 0.05);
    if (!visible) return;
    u.uTime.value = reduit ? 12 : horloge.elapsedTime;
    var aspect = toile.clientWidth / Math.max(1, toile.clientHeight);
    u.uAspect.value = aspect;
    if (etat.salle !== cour && u.uMix.value >= 1) {
      u.uFrom.value = cour;
      u.uTo.value = etat.salle;
      u.uMix.value = 0;
      cour = etat.salle;
    }
    u.uMix.value = Math.min(1, u.uMix.value + dt * 0.8);
    u.uChaos.value += (etat.chaos - u.uChaos.value) * Math.min(1, dt * 4);
    u.uLines.value += (etat.lignes - u.uLines.value) * Math.min(1, dt * 4);
    u.uSeed.value = etat.graine;
    etat.palette.forEach(function (hx, i) { cibles[i].set(hx); u['uP' + i].value.lerp(cibles[i], Math.min(1, dt * 3)); });
    souris.set(etat.souris.x * aspect, etat.souris.y);
    u.uMouse.value.lerp(souris, Math.min(1, dt * 6));
    u.uMouseOn.value += ((etat.souris.actif ? 1 : 0) - u.uMouseOn.value) * Math.min(1, dt * 3);
    rendu.render(scene, cam);
  });
}
