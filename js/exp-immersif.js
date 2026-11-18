/* Qamar — concept 01 Immersif : marche lunaire à la première personne.
   Gravité lunaire réelle (1,62 m/s²), foulée bondissante, empreintes qui restent,
   poussière balistique (pas d'air, donc pas de nuage), horizon proche et Terre dans le ciel. */
import * as THREE from 'three';

var Q = window.Qexp;
var reduit = Q.reduit();

/* ================================================================ Relief */

var MONDE = 520, RAYON_MARCHE = 150, COURBE = 1 / 9000, G_LUNE = 1.62, OEIL = 1.65;

function mulberry32(g) {
  return function () {
    g |= 0; g = (g + 0x6d2b79f5) | 0;
    var t = Math.imul(g ^ (g >>> 15), 1 | g);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
var PERM = (function () {
  var r = mulberry32(1969), p = [];
  for (var i = 0; i < 256; i++) p.push(i);
  for (i = 255; i > 0; i--) { var j = Math.floor(r() * (i + 1)), x = p[i]; p[i] = p[j]; p[j] = x; }
  return p.concat(p);
})();
function hash(x, y) { return PERM[(PERM[x & 255] + y) & 255] / 255; }
function lisse(t) { return t * t * (3 - 2 * t); }
function vbruit(x, y) {
  var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  var u = lisse(xf), v = lisse(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) {
  var s = 0, amp = 1, f = 1;
  for (var o = 0; o < 5; o++) { s += (vbruit(x * f, y * f) - 0.5) * amp; amp *= 0.5; f *= 2.03; }
  return s;
}

var REPERES = { grandCratere: { x: 46, z: -88, r: 30, depth: 7.5 }, rocher: { x: -58, z: -112 }, balise: { x: 12, z: -138 } };
var ETAPES = [
  { x: 30, z: -64, titre: 'Le cratère Qamar', texte: "Trente mètres de rayon, creusé il y a des millions d'années. Sans air ni pluie, ses bords n'ont presque pas bougé depuis." },
  { x: -52, z: -104, titre: 'Le rocher sentinelle', texte: "Un bloc éjecté lors d'un impact lointain. Sa longue ombre trace l'heure du jour lunaire, qui dure près de quinze jours terrestres." },
  { x: 12, z: -134, titre: 'La balise', texte: "Fin de la marche. Ici, une empreinte peut rester intacte pendant des millions d'années.", fin: true }
];

var CRATERES = (function () {
  var r = mulberry32(42), l = [REPERES.grandCratere], demi = MONDE / 2;
  for (var i = 0; i < 260; i++) {
    var rad = 1.2 + Math.pow(r(), 3.2) * 26;
    var x = (r() * 2 - 1) * demi, z = (r() * 2 - 1) * demi;
    if (Math.hypot(x, z) < 10 + rad) continue;
    l.push({ x: x, z: z, r: rad, depth: rad * (0.18 + r() * 0.12) });
  }
  return l;
})();
var CASE = 32, GRILLE = new Map();
CRATERES.forEach(function (c) {
  var portee = c.r * 1.7;
  for (var gx = Math.floor((c.x - portee) / CASE); gx <= Math.floor((c.x + portee) / CASE); gx++)
    for (var gz = Math.floor((c.z - portee) / CASE); gz <= Math.floor((c.z + portee) / CASE); gz++) {
      var k = gx + ',' + gz;
      if (GRILLE.has(k)) GRILLE.get(k).push(c); else GRILLE.set(k, [c]);
    }
});
function profil(d) {
  if (d < 1) return d * d - 1 + 0.18 * Math.exp(-((d - 1) * (d - 1)) / 0.02);
  return 0.18 * Math.exp(-((d - 1) * (d - 1)) / 0.06) + 0.04 * Math.exp(-(d - 1) * 2.2);
}
function hauteur(x, z) {
  var h = fbm(x * 0.012, z * 0.012) * 9 + fbm(x * 0.09 + 31, z * 0.09 - 17) * 0.7;
  h += Math.sin(x * 0.006 + 1.3) * Math.cos(z * 0.005) * 6;
  var l = GRILLE.get(Math.floor(x / CASE) + ',' + Math.floor(z / CASE));
  if (l) for (var i = 0; i < l.length; i++) {
    var c = l[i], d = Math.hypot(x - c.x, z - c.z) / c.r;
    if (d < 1.7) h += profil(d) * c.depth;
  }
  return h;
}

/* ================================================================ État */

function etatNeuf() {
  return {
    x: 0, z: 6, y: hauteur(0, 6), vy: 0, vx: 0, vz: 0, yaw: 0, pitch: -0.04, sol: true,
    distance: 0, pas: 0, enLair: 0, suivante: 0, wpDist: 0, wpCap: 0, reception: 0
  };
}
var M = { parti: false, entree: { av: 0, cote: 0, tourne: 0, dx: 0, dy: 0, saut: false, auto: false }, s: etatNeuf(), surEtape: null };

/* ================================================================ Interface */

function $(s) { return document.querySelector(s); }
var section = $('.im-scene');
var hoteCanvas = $('.im-3d');
var mode = Q.modeScene(820);
var tactile = window.matchMedia('(pointer: coarse)').matches;
var fmt = function (n) { return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n); };

var boutonDebut = $('.im-commencer');
var aide = $('.im-aide');
if (mode === 'photo') {
  boutonDebut.querySelector('span').textContent = 'Découvrir le concept';
  aide.textContent = "Votre navigateur n'affiche pas la 3D : voici le concept en images et en mots.";
} else {
  aide.textContent = tactile ? 'Manette à gauche pour avancer · glissez pour regarder' : 'ZQSD ou flèches pour avancer · glisser pour regarder · Espace pour bondir';
}
var hud = $('.im-hud');
var carte = $('.im-carte');
var minuteurCarte = 0;

function commencer() {
  if (mode === 'photo') { $('.im-notes').scrollIntoView({ behavior: reduit ? 'auto' : 'smooth' }); return; }
  M.parti = true;
  section.classList.add('partie');
  hud.hidden = false;
  section.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth', block: 'start' });
}
boutonDebut.addEventListener('click', commencer);

function marcheGuidee(on) {
  M.entree.auto = on;
  var b = $('.im-guide');
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.textContent = on ? 'Marche guidée activée' : 'Marche guidée';
}
$('.im-guide').addEventListener('click', function () { marcheGuidee(!M.entree.auto); });
$('.im-bondir').addEventListener('click', function () { M.entree.saut = true; });
$('.im-pause').addEventListener('click', function () {
  M.parti = false;
  section.classList.remove('partie');
  hud.hidden = true;
});

function montrerCarte(i) {
  var e = ETAPES[i];
  clearTimeout(minuteurCarte);
  carte.querySelector('.im-carte-etape').textContent = 'Étape ' + (i + 1) + ' / ' + ETAPES.length;
  carte.querySelector('h2').textContent = e.titre;
  carte.querySelector('.im-carte-texte').textContent = e.texte;
  var fin = carte.querySelector('.im-carte-fin');
  fin.hidden = !e.fin;
  if (e.fin) {
    fin.querySelector('.im-bilan').textContent = fmt(M.s.distance) + ' mètres parcourus en ' + fmt(M.s.pas) + ' pas.';
    $('.im-boussole').hidden = true;
  }
  carte.hidden = false;
  carte.classList.remove('montre');
  void carte.offsetWidth;
  carte.classList.add('montre');
  if (!e.fin) minuteurCarte = setTimeout(function () { carte.hidden = true; }, 7500);
}
M.surEtape = function (i) {
  montrerCarte(i);
  if (ETAPES[i].fin) marcheGuidee(false);
};
$('.im-recommencer').addEventListener('click', function () {
  M.s = etatNeuf();
  M.entree.av = M.entree.cote = M.entree.tourne = 0;
  marcheGuidee(false);
  carte.hidden = true;
  $('.im-boussole').hidden = false;
});

// tableau de bord, 5 fois par seconde
setInterval(function () {
  if (!M.parti) return;
  var s = M.s, w = ETAPES[Math.min(s.suivante, ETAPES.length - 1)];
  $('.im-parcouru').textContent = fmt(s.distance) + ' m';
  $('.im-pas').textContent = fmt(s.pas);
  $('.im-fleche').style.transform = 'rotate(' + (-s.wpCap) + 'rad)';
  $('.im-cap').textContent = w.titre + ' · ' + fmt(s.wpDist) + ' m';
}, 200);

// clavier : ZQSD / WASD / flèches (position physique des touches), espace pour bondir
var touches = new Set();
function appliquer() {
  var f = (touches.has('KeyW') || touches.has('ArrowUp') ? 1 : 0) - (touches.has('KeyS') || touches.has('ArrowDown') ? 1 : 0);
  var c = (touches.has('KeyD') ? 1 : 0) - (touches.has('KeyA') ? 1 : 0);
  var t = (touches.has('ArrowRight') ? 1 : 0) - (touches.has('ArrowLeft') ? 1 : 0);
  M.entree.av = f; M.entree.cote = c; M.entree.tourne = t;
  if ((f || c || t) && M.entree.auto) marcheGuidee(false);
}
window.addEventListener('keydown', function (e) {
  if (!M.parti || e.altKey || e.metaKey || e.ctrlKey || (e.target.closest && e.target.closest('input, textarea, select'))) return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) < 0) return;
  var r = section.getBoundingClientRect();
  if (r.bottom < 80 || r.top > window.innerHeight * 0.5) return;
  e.preventDefault();
  if (e.code === 'Space') M.entree.saut = true; else touches.add(e.code);
  appliquer();
});
window.addEventListener('keyup', function (e) { touches.delete(e.code); appliquer(); });

// regard à la souris ou au doigt
var glisse = null;
hoteCanvas.addEventListener('pointerdown', function (e) {
  if (!M.parti) return;
  glisse = { x: e.clientX, y: e.clientY, id: e.pointerId };
  hoteCanvas.setPointerCapture(e.pointerId);
});
hoteCanvas.addEventListener('pointermove', function (e) {
  if (!glisse || glisse.id !== e.pointerId) return;
  M.entree.dx += e.clientX - glisse.x;
  M.entree.dy += e.clientY - glisse.y;
  glisse.x = e.clientX; glisse.y = e.clientY;
});
['pointerup', 'pointercancel'].forEach(function (n) { hoteCanvas.addEventListener(n, function () { glisse = null; }); });

// manette tactile
var manette = $('.im-manette');
if (tactile && manette) {
  manette.hidden = false;
  var bouton = manette.querySelector('span'), origine = null, RM = 46;
  var bouger = function (e) {
    if (!origine || e.pointerId !== origine.id) return;
    var dx = e.clientX - origine.x, dy = e.clientY - origine.y, d = Math.hypot(dx, dy);
    if (d > RM) { dx *= RM / d; dy *= RM / d; }
    bouton.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
    M.entree.cote = dx / RM;
    M.entree.av = -dy / RM;
  };
  var fin = function () {
    origine = null;
    bouton.style.transform = '';
    M.entree.cote = 0; M.entree.av = 0;
  };
  manette.addEventListener('pointerdown', function (e) {
    e.stopPropagation();
    var r = manette.getBoundingClientRect();
    origine = { x: r.left + r.width / 2, y: r.top + r.height / 2, id: e.pointerId };
    manette.setPointerCapture(e.pointerId);
    marcheGuidee(false);
    bouger(e);
  });
  manette.addEventListener('pointermove', bouger);
  manette.addEventListener('pointerup', fin);
  manette.addEventListener('pointercancel', fin);
}

/* ================================================================ Scène 3D */

if (mode !== 'photo') demarrer();

function demarrer() {
  var haut = mode === 'high';
  var SOLEIL = new THREE.Vector3(0.86, 0.16, 0.22).normalize();
  var uCam = { value: new THREE.Vector3() };

  var rendu = new THREE.WebGLRenderer({ antialias: haut, powerPreference: 'high-performance' });
  rendu.setPixelRatio(haut ? Math.min(window.devicePixelRatio || 1, 1.6) : Math.min(window.devicePixelRatio || 1, 1));
  rendu.toneMapping = THREE.ACESFilmicToneMapping;
  rendu.toneMappingExposure = 0.95;
  rendu.setClearColor('#000000');
  if (haut) { rendu.shadowMap.enabled = true; rendu.shadowMap.type = THREE.PCFSoftShadowMap; }
  hoteCanvas.appendChild(rendu.domElement);

  var scene = new THREE.Scene();
  var cam = new THREE.PerspectiveCamera(62, 1, 0.08, 2000);
  cam.position.set(0, 3, 6);
  cam.rotation.order = 'YXZ';
  scene.add(new THREE.AmbientLight(0xffffff, 0.012), new THREE.HemisphereLight(0x6f8fbf, 0x000000, 0.05));

  // l'horizon lunaire est proche : on courbe le sol autour du marcheur
  function courbe(m) {
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uCam = uCam;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uCam;')
        .replace('#include <project_vertex>', [
          'vec4 mvPosition = vec4( transformed, 1.0 );',
          '#ifdef USE_INSTANCING',
          '  mvPosition = instanceMatrix * mvPosition;',
          '#endif',
          'vec4 wPos = modelMatrix * mvPosition;',
          'vec2 dd = wPos.xz - uCam.xz;',
          'wPos.y -= dot( dd, dd ) * ' + COURBE.toFixed(8) + ';',
          'mvPosition = viewMatrix * wPos;',
          'gl_Position = projectionMatrix * mvPosition;'
        ].join('\n'));
    };
    return m;
  }
  function chute(x, z, cx, cz) { return ((x - cx) * (x - cx) + (z - cz) * (z - cz)) * COURBE; }

  var chargeur = new THREE.TextureLoader();
  var aCharger = 4, charge = 0;
  function fini() { if (++charge >= aCharger) section.classList.add('prete'); }
  function texture(url, srgb) {
    var t = chargeur.load(url, fini, undefined, fini);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  var regolithe = texture('images/experiences/regolith.jpg', true);
  var relief = texture('images/experiences/regolith-bump.jpg', false);
  [regolithe, relief].forEach(function (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; });

  // --- sol
  var segs = haut ? 400 : 200;
  var geo = new THREE.PlaneGeometry(MONDE, MONDE, segs, segs);
  geo.rotateX(-Math.PI / 2);
  var pos = geo.attributes.position, couleurs = new Float32Array(pos.count * 3);
  for (var i = 0; i < pos.count; i++) {
    var x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, hauteur(x, z));
    var ton = 0.7 + Math.sin(x * 0.011 + 2) * Math.cos(z * 0.013) * 0.1 + Math.sin(x * 0.05 - z * 0.04) * 0.03;
    couleurs[i * 3] = ton; couleurs[i * 3 + 1] = ton * 0.985; couleurs[i * 3 + 2] = ton * 0.96;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(couleurs, 3));
  var uv = geo.attributes.uv;
  for (i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (MONDE / 5), uv.getY(i) * (MONDE / 5));
  geo.computeVertexNormals();
  var sol = new THREE.Mesh(geo, courbe(new THREE.MeshStandardMaterial({ map: regolithe, bumpMap: relief, bumpScale: 2.2, vertexColors: true, roughness: 1, metalness: 0, color: new THREE.Color(0.86, 0.85, 0.83) })));
  sol.receiveShadow = sol.castShadow = haut;
  scene.add(sol);

  // --- rochers
  var rg = new THREE.IcosahedronGeometry(1, 2), rp = rg.attributes.position, v = new THREE.Vector3();
  for (i = 0; i < rp.count; i++) {
    v.fromBufferAttribute(rp, i);
    var n = 1 + Math.sin(v.x * 5.1 + v.y * 2.3) * 0.12 + Math.sin(v.z * 7.7 - v.x * 3.1) * 0.08 + Math.sin(v.y * 11 + v.z * 4) * 0.04;
    v.multiplyScalar(n);
    rp.setXYZ(i, v.x, v.y * 0.72, v.z);
  }
  rg.computeVertexNormals();
  var r7 = mulberry32(7), liste = [], nb = haut ? 1600 : 600;
  for (i = 0; i < nb; i++) {
    var a = r7() * Math.PI * 2, d = 4 + Math.pow(r7(), 0.8) * (MONDE / 2 - 20), s = 0.14 + Math.pow(r7(), 3.5) * 1.9;
    liste.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, s: s, ry: r7() * Math.PI * 2, sq: 0.5 + r7() * 0.5 });
  }
  liste.push({ x: REPERES.rocher.x, z: REPERES.rocher.z, s: 4.2, ry: 0.6, sq: 0.85 });
  var rochers = new THREE.InstancedMesh(rg, courbe(new THREE.MeshStandardMaterial({ map: regolithe, color: new THREE.Color(0.62, 0.6, 0.58), roughness: 0.95, flatShading: true })), liste.length);
  var o3 = new THREE.Object3D();
  liste.forEach(function (r, k) {
    o3.position.set(r.x, hauteur(r.x, r.z) + r.s * 0.25, r.z);
    o3.rotation.set(r.ry * 0.3, r.ry, r.ry * 0.2);
    o3.scale.set(r.s, r.s * r.sq, r.s * (0.7 + r.sq * 0.4));
    o3.updateMatrix();
    rochers.setMatrixAt(k, o3.matrix);
  });
  rochers.castShadow = rochers.receiveShadow = haut;
  rochers.frustumCulled = false;
  scene.add(rochers);

  // --- étoiles
  var nbE = haut ? 3200 : 1400, ge = new THREE.BufferGeometry(), pe = new Float32Array(nbE * 3), se = new Float32Array(nbE), r24 = mulberry32(2024);
  for (i = 0; i < nbE; i++) {
    var u = r24() * 2 - 1, t = r24() * Math.PI * 2, rr = Math.sqrt(1 - u * u);
    pe.set([Math.cos(t) * rr * 900, Math.abs(u) * 900 - 60, Math.sin(t) * rr * 900], i * 3);
    se[i] = r24() < 0.04 ? 2.6 : 0.8 + r24() * 1.2;
  }
  ge.setAttribute('position', new THREE.BufferAttribute(pe, 3));
  ge.setAttribute('size', new THREE.BufferAttribute(se, 1));
  var etoiles = new THREE.Points(ge, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'attribute float size; varying float vS; void main(){ vS=size; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size*' + Math.min(window.devicePixelRatio || 1, 2).toFixed(2) + '; gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'varying float vS; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,d); gl_FragColor=vec4(vec3(.92,.94,1.),a*min(1.,vS*.5)); }'
  }));
  etoiles.frustumCulled = false;
  scene.add(etoiles);

  // --- Terre
  var terre = new THREE.Group();
  var tt = texture('images/experiences/earth-1k.jpg', true);
  var globe = new THREE.Mesh(new THREE.SphereGeometry(15, 64, 48), new THREE.MeshStandardMaterial({ map: tt, roughness: 0.9, metalness: 0, emissive: '#0a1a33', emissiveIntensity: 0.06 }));
  globe.rotation.set(0.35, 2.2, 0);
  var atmo = new THREE.Mesh(new THREE.SphereGeometry(15, 48, 32), new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
    uniforms: { uSun: { value: SOLEIL } },
    vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(mat3(modelMatrix)*normal); vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.); }',
    fragmentShader: 'uniform vec3 uSun; varying vec3 vN; varying vec3 vW; void main(){ vec3 v=normalize(cameraPosition-vW); float rim=pow(1.-abs(dot(vN,v)),2.5); float lit=smoothstep(-.3,.6,dot(vN,uSun)); gl_FragColor=vec4(vec3(.35,.6,1.)*rim*lit*1.6, rim*lit); }'
  }));
  atmo.scale.setScalar(1.06);
  terre.add(globe, atmo);
  scene.add(terre);

  // --- Soleil
  var cg = document.createElement('canvas');
  cg.width = cg.height = 256;
  var xg = cg.getContext('2d'), gr = xg.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,250,235,0.9)');
  gr.addColorStop(0.12, 'rgba(255,240,210,0.35)');
  gr.addColorStop(0.4, 'rgba(255,225,180,0.08)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  xg.fillStyle = gr;
  xg.fillRect(0, 0, 256, 256);
  var tHalo = new THREE.CanvasTexture(cg);
  tHalo.colorSpace = THREE.SRGBColorSpace;
  var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tHalo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  halo.scale.set(260, 260, 1);
  var astre = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture('images/experiences/sun.webp', true), transparent: true, depthWrite: false, toneMapped: false, color: '#fff6e8' }));
  astre.scale.set(26, 26, 1);
  scene.add(halo, astre);

  // --- balise (accent orange Qamar)
  var ORANGE = '#FC4F00';
  var balise = new THREE.Group(), by = hauteur(REPERES.balise.x, REPERES.balise.z);
  var mat = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.8, 12), new THREE.MeshStandardMaterial({ color: '#d8a07a', metalness: 0.9, roughness: 0.25 }));
  mat.position.y = 1.4;
  mat.castShadow = true;
  var feu = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), new THREE.MeshBasicMaterial({ color: '#ffb27a', toneMapped: false }));
  feu.position.y = 2.95;
  var matFaisceau = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uPulse: { value: 1 } },
    vertexShader: 'varying float vY; void main(){ vY=uv.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform float uPulse; varying float vY; void main(){ float a=pow(1.-vY,2.2)*.75*uPulse; gl_FragColor=vec4(vec3(1.,.55,.25)*a,a); }'
  });
  var faisceau = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 90, 16, 1, true), matFaisceau);
  faisceau.position.y = 45;
  var onde = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false }));
  onde.rotation.x = -Math.PI / 2;
  onde.position.y = 0.05;
  balise.add(mat, feu, faisceau, onde);
  balise.position.set(REPERES.balise.x, by, REPERES.balise.z);
  scene.add(balise);

  // --- repères des étapes
  var marques = ETAPES.map(function () {
    var mk = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), new THREE.MeshBasicMaterial({ color: ORANGE, toneMapped: false }));
    scene.add(mk);
    return mk;
  });

  // --- empreintes
  var EMPREINTES = 600;
  var cb = document.createElement('canvas');
  cb.width = 64; cb.height = 128;
  var xb = cb.getContext('2d');
  xb.fillStyle = '#000'; xb.fillRect(0, 0, 64, 128);
  xb.fillStyle = '#fff'; xb.beginPath();
  if (xb.roundRect) xb.roundRect(10, 6, 44, 116, 20); else xb.rect(10, 6, 44, 116);
  xb.fill();
  xb.fillStyle = '#000';
  for (i = 0; i < 9; i++) xb.fillRect(14, 16 + i * 11.5, 36, 3.5);
  var traces = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.32), courbe(new THREE.MeshStandardMaterial({
    color: '#2b2a28', alphaMap: new THREE.CanvasTexture(cb), transparent: true, opacity: 0.62, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2
  })), EMPREINTES);
  var cache = new THREE.Matrix4().makeScale(0, 0, 0);
  for (i = 0; i < EMPREINTES; i++) traces.setMatrixAt(i, cache);
  traces.frustumCulled = false;
  traces.receiveShadow = true;
  scene.add(traces);
  var idxTrace = 0, oT = new THREE.Object3D();
  oT.rotation.order = 'YXZ';
  function empreinte(x, z, yaw) {
    [-1, 1].forEach(function (cote) {
      var px = x + Math.cos(yaw) * 0.16 * cote, pz = z - Math.sin(yaw) * 0.16 * cote;
      oT.position.set(px, hauteur(px, pz) + 0.03, pz);
      oT.rotation.set(-Math.PI / 2, yaw, 0);
      oT.updateMatrix();
      traces.setMatrixAt(idxTrace++ % EMPREINTES, oT.matrix);
    });
    traces.instanceMatrix.needsUpdate = true;
  }

  // --- poussière balistique
  var POUSS = 420, dp = new Float32Array(POUSS * 3), dv = new Float32Array(POUSS * 3), dl = new Float32Array(POUSS), dn = 0;
  var gp = new THREE.BufferGeometry();
  gp.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  gp.setAttribute('life', new THREE.BufferAttribute(dl, 1));
  var poussiere = new THREE.Points(gp, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'attribute float life; varying float vL; void main(){ vL=life; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=life>0.? (34./-mv.z):0.; gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'varying float vL; void main(){ float d=length(gl_PointCoord-.5); gl_FragColor=vec4(vec3(.62,.6,.57), smoothstep(.5,.1,d)*clamp(vL,0.,1.)*.75); }'
  }));
  poussiere.frustumCulled = false;
  scene.add(poussiere);
  function soulever(x, z, force) {
    var nn = Math.round(14 * force);
    for (var k = 0; k < nn; k++) {
      var j = dn++ % POUSS, an = Math.random() * Math.PI * 2, sp = (0.4 + Math.random() * 1.2) * force;
      dp.set([x + Math.cos(an) * 0.2, hauteur(x, z) + 0.05, z + Math.sin(an) * 0.2], j * 3);
      dv.set([Math.cos(an) * sp, 0.4 + Math.random() * 1.1 * force, Math.sin(an) * sp], j * 3);
      dl[j] = 1.6;
    }
  }

  // --- lumière du soleil (suit le marcheur)
  var lum = new THREE.DirectionalLight(0xfff8ee, 6.2);
  if (haut) {
    lum.castShadow = true;
    lum.shadow.mapSize.set(2048, 2048);
    var sc = lum.shadow.camera;
    sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 220;
    lum.shadow.bias = -0.0004;
    lum.shadow.normalBias = 0.6;
  }
  scene.add(lum, lum.target);

  function taille() {
    var w = hoteCanvas.clientWidth, h = hoteCanvas.clientHeight;
    rendu.setSize(w, h, false);
    rendu.domElement.style.width = '100%';
    rendu.domElement.style.height = '100%';
    cam.aspect = w / Math.max(1, h);
    cam.updateProjectionMatrix();
  }
  taille();
  window.addEventListener('resize', taille);

  var visible = true;
  new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }, { threshold: 0.05 }).observe(section);
  document.addEventListener('visibilitychange', function () { visible = document.visibilityState === 'visible' && section.getBoundingClientRect().bottom > 0; });

  var intro = 0, horloge = new THREE.Clock(), tmp = new THREE.Vector3();
  rendu.setAnimationLoop(function () {
    var dt = Math.min(horloge.getDelta(), 0.05);
    if (!visible) return;
    var s = M.s, inp = M.entree, t = horloge.elapsedTime;

    if (!M.parti) {
      // attente : lente contemplation
      s.yaw = Math.sin(t * 0.07) * 0.35;
      s.pitch = -0.02 + Math.sin(t * 0.11) * 0.03;
    } else {
      intro = Math.min(1, intro + dt * 0.5);
      s.yaw -= inp.dx * 0.0032 + inp.tourne * dt * 1.6;
      s.pitch = Math.max(-1.15, Math.min(1.0, s.pitch - inp.dy * 0.0026));
      inp.dx = inp.dy = 0;

      var av = inp.av, cote = inp.cote;
      var wp = ETAPES[Math.min(s.suivante, ETAPES.length - 1)];
      if (inp.auto && s.suivante < ETAPES.length) {
        var cap = Math.atan2(-(wp.x - s.x), -(wp.z - s.z)), dif = cap - s.yaw;
        dif = Math.atan2(Math.sin(dif), Math.cos(dif));
        s.yaw += dif * Math.min(1, dt * 1.2);
        av = Math.abs(dif) < 0.8 ? 1 : 0.3;
        cote = 0;
      }
      var sn = Math.sin(s.yaw), cs = Math.cos(s.yaw), vit = 2.7;
      var tx = (-sn * av + cs * cote) * vit, tz = (-cs * av - sn * cote) * vit;
      // peu d'adhérence : on accélère et on freine lentement, presque rien en l'air
      var k = s.sol ? 2.4 : 0.25;
      s.vx += (tx - s.vx) * (1 - Math.exp(-dt * k));
      s.vz += (tz - s.vz) * (1 - Math.exp(-dt * k));
      var bouge = Math.hypot(s.vx, s.vz);
      if (s.sol) {
        if (inp.saut) { s.vy = 2.8; s.sol = false; soulever(s.x, s.z, 1.4); }
        else if (bouge > 0.6 && !reduit) { s.vy = 1.05; s.sol = false; }
      }
      inp.saut = false;

      var ox = s.x, oz = s.z;
      s.x += s.vx * dt; s.z += s.vz * dt;
      var r = Math.hypot(s.x, s.z);
      if (r > RAYON_MARCHE) { s.x *= RAYON_MARCHE / r; s.z *= RAYON_MARCHE / r; }
      s.distance += Math.hypot(s.x - ox, s.z - oz);

      var hs = hauteur(s.x, s.z);
      if (!s.sol) {
        s.vy -= G_LUNE * dt;
        s.y += s.vy * dt;
        s.enLair += dt;
        if (s.y <= hs) {
          s.y = hs; s.sol = true; s.reception = 1;
          if (s.enLair > 0.25) {
            s.pas += 2;
            empreinte(s.x, s.z, s.yaw);
            soulever(s.x, s.z, Math.min(1.6, 0.5 + s.enLair * 0.5));
          }
          s.enLair = 0;
        }
      } else s.y += (hs - s.y) * Math.min(1, dt * 12);
      s.reception = Math.max(0, s.reception - dt * 3);

      if (s.suivante < ETAPES.length) {
        var w = ETAPES[s.suivante];
        s.wpDist = Math.hypot(w.x - s.x, w.z - s.z);
        s.wpCap = Math.atan2(-(w.x - s.x), -(w.z - s.z)) - s.yaw;
        if (s.wpDist < 9) { var fait = s.suivante; s.suivante++; M.surEtape(fait); }
      }
    }

    // caméra : léger tassement à la réception, descente d'entrée
    var descente = M.parti ? Math.pow(1 - intro, 3) * 18 : 0;
    cam.position.set(s.x, s.y + OEIL - s.reception * 0.12 + descente, s.z);
    cam.rotation.set(s.pitch - descente * 0.02, s.yaw, 0);
    uCam.value.copy(cam.position);
    lum.position.set(s.x + SOLEIL.x * 90, s.y + SOLEIL.y * 90, s.z + SOLEIL.z * 90);
    lum.target.position.set(s.x, s.y, s.z);

    etoiles.position.copy(cam.position);
    terre.position.set(cam.position.x - 150, cam.position.y + 96, cam.position.z - 330);
    terre.rotation.y += dt * 0.004;
    tmp.copy(cam.position).addScaledVector(SOLEIL, 700);
    astre.position.copy(tmp);
    halo.position.copy(tmp);

    balise.position.y = by - chute(REPERES.balise.x, REPERES.balise.z, cam.position.x, cam.position.z);
    var ko = (t * 0.35) % 1;
    onde.scale.setScalar(1 + ko * 6);
    onde.material.opacity = 0.5 * (1 - ko);
    matFaisceau.uniforms.uPulse.value = 0.85 + Math.sin(t * 1.3) * 0.15;

    ETAPES.forEach(function (e, j) {
      var mk = marques[j];
      mk.visible = j === s.suivante && !e.fin;
      mk.position.set(e.x, hauteur(e.x, e.z) - chute(e.x, e.z, cam.position.x, cam.position.z) + 2.2 + Math.sin(t * 2) * 0.15, e.z);
      mk.rotation.y = t;
    });

    for (var q = 0; q < POUSS; q++) {
      if (dl[q] <= 0) continue;
      dv[q * 3 + 1] -= G_LUNE * dt; // aucune traînée : trajectoires paraboliques parfaites
      dp[q * 3] += dv[q * 3] * dt;
      dp[q * 3 + 1] += dv[q * 3 + 1] * dt;
      dp[q * 3 + 2] += dv[q * 3 + 2] * dt;
      if (dp[q * 3 + 1] < hauteur(dp[q * 3], dp[q * 3 + 2])) dl[q] = 0; else dl[q] -= dt * 0.25;
    }
    gp.attributes.position.needsUpdate = true;
    gp.attributes.life.needsUpdate = true;

    rendu.render(scene, cam);
  });
}
