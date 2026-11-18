/* Qamar — concept 02 Premium : « Maison Aurane », joaillerie fictive.
   Bijoux modélisés en code (aucun fichier 3D), métal et pierres en matériaux physiques,
   vitrine qui glisse sur le côté au défilement. */
import * as THREE from 'three';
import { studio, ombre } from './exp-studio.js';

var Q = window.Qexp;
var reduit = Q.reduit();

var PIECES = [
  { id: 'eclipse', nom: 'Éclipse', type: 'Bague solitaire', texte: "Un anneau tendu comme une orbite, une pierre suspendue au-dessus du doigt : la lumière la traverse de toutes parts.", pierre: true, prix: { or: 2480, argent: 1290 } },
  { id: 'croissant', nom: 'Croissant', type: 'Pendentif', texte: "Un croissant de lune poli miroir, une pierre à sa pointe. Il pivote au moindre mouvement et attrape chaque reflet.", pierre: true, prix: { or: 1640, argent: 780 } },
  { id: 'perle', nom: "Perle d'aube", type: "Boucles d'oreilles", texte: "Deux perles aux reflets nacrés, montées sur un crochet fin. Une asymétrie volontaire, pour un regard qui ne se fige pas.", pierre: false, prix: { or: 920, argent: 540 } },
  { id: 'orbite', nom: 'Orbite', type: 'Jonc ouvert', texte: "Un jonc ouvert, terminé par deux pierres qui se font face sans se toucher. Il se glisse au poignet d'un seul geste.", pierre: true, prix: { or: 3150, argent: 1480 } }
];
var euro = function (n) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n); };

var etat = { piece: 'eclipse', metal: 'or', pierre: 'diamant', progression: 0, gx: 0, gy: 0, etroit: false };
var selection = [];

function $(s) { return document.querySelector(s); }
function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }

/* ---------- Vitrine ---------- */
var panneau = $('.pr-vitrine');
function rendre() {
  var p = PIECES.find(function (x) { return x.id === etat.piece; });
  $$('.pr-piece').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-piece') === etat.piece ? 'true' : 'false'); });
  $$('[data-metal]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-metal') === etat.metal ? 'true' : 'false'); });
  $$('[data-pierre]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-pierre') === etat.pierre ? 'true' : 'false'); });
  $('.pr-pierres').hidden = !p.pierre;
  $('.pr-prix').textContent = euro(p.prix[etat.metal]);
  var coeur = $('.pr-coeur');
  var garde = selection.indexOf(p.id) >= 0;
  coeur.setAttribute('aria-pressed', garde ? 'true' : 'false');
  coeur.setAttribute('aria-label', garde ? 'Retirer de ma sélection' : 'Ajouter à ma sélection');
  var s = $('.pr-selection');
  s.hidden = !selection.length;
  s.textContent = 'Ma sélection : ' + selection.map(function (id) { return PIECES.find(function (x) { return x.id === id; }).nom; }).join(', ');
}
function rendrePiece() {
  var p = PIECES.find(function (x) { return x.id === etat.piece; });
  var bloc = $('.pr-fiche');
  bloc.classList.remove('montre');
  void bloc.offsetWidth;
  bloc.classList.add('montre');
  $('.pr-type').textContent = p.type;
  $('.pr-nom').textContent = p.nom;
  $('.pr-texte').textContent = p.texte;
}
$$('.pr-piece').forEach(function (b) { b.addEventListener('click', function () { etat.piece = b.getAttribute('data-piece'); rendre(); rendrePiece(); }); });
$$('[data-metal]').forEach(function (b) { b.addEventListener('click', function () { etat.metal = b.getAttribute('data-metal'); rendre(); }); });
$$('[data-pierre]').forEach(function (b) { b.addEventListener('click', function () { etat.pierre = b.getAttribute('data-pierre'); rendre(); }); });
$('.pr-coeur').addEventListener('click', function () {
  var i = selection.indexOf(etat.piece);
  if (i >= 0) selection.splice(i, 1); else selection.push(etat.piece);
  rendre();
});
$('.pr-essai').addEventListener('click', function () { $('.pr-note').hidden = false; });
$('.pr-note button').addEventListener('click', function () { $('.pr-note').hidden = true; });
rendre();
rendrePiece();

/* ---------- Défilement : ouverture puis vitrine ---------- */
var scene3d = $('.pr-scene');
var ouverture = $$('.pr-ouverture');
function defile() {
  var r = scene3d.getBoundingClientRect();
  var v = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - window.innerHeight)));
  etat.progression = Math.max(0, Math.min(1, (v - 0.08) / 0.4));
  var o = Math.max(0, 1 - v / 0.22);
  ouverture.forEach(function (el, i) {
    el.style.opacity = o.toFixed(3);
    if (i === 0 && !reduit) el.style.transform = 'translateY(' + (-80 * Math.min(1, v / 0.3)).toFixed(1) + 'px)';
  });
  var po = Math.max(0, Math.min(1, (v - 0.28) / 0.17));
  panneau.style.opacity = po.toFixed(3);
  panneau.style.setProperty('--decale', (reduit ? 0 : 60 * (1 - Math.max(0, Math.min(1, (v - 0.28) / 0.22)))).toFixed(1) + 'px');
  panneau.style.pointerEvents = v > 0.3 ? 'auto' : 'none';
  panneau.setAttribute('aria-hidden', v > 0.3 ? 'false' : 'true');
}
window.addEventListener('scroll', defile, { passive: true });
window.addEventListener('resize', function () { etat.etroit = window.innerWidth < 900; defile(); });
etat.etroit = window.innerWidth < 900;
defile();

/* ---------- Atelier : traits qui se dessinent ---------- */
var traits = $$('.pr-trait');
traits.forEach(function (t) {
  var L = t.getTotalLength ? t.getTotalLength() : 300;
  t.style.strokeDasharray = L;
  t.style.strokeDashoffset = reduit ? 0 : L;
});
if (!reduit && 'IntersectionObserver' in window) {
  var io = new IntersectionObserver(function (e) {
    e.forEach(function (x) {
      if (!x.isIntersecting) return;
      x.target.querySelectorAll('.pr-trait').forEach(function (t) { t.style.strokeDashoffset = 0; });
      io.unobserve(x.target);
    });
  }, { rootMargin: '-20% 0px -20% 0px' });
  $$('.pr-geste svg').forEach(function (s) { io.observe(s); });
}

/* ---------- Bijou 3D ---------- */
var mode = Q.modeScene(820);
if (mode === 'photo') {
  scene3d.classList.add('photo');
} else {
  var leger = mode === 'low';
  var hote = $('.pr-3d');
  var rendu = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, leger ? 1.25 : 2));
  rendu.toneMapping = THREE.ACESFilmicToneMapping;
  rendu.toneMappingExposure = 1.1;
  hote.appendChild(rendu.domElement);
  var scene = new THREE.Scene();
  var cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  cam.position.set(0, 0.4, 8.2);
  // fond chaud de l'écrin : le métal ne reflète jamais de noir
  scene.environment = studio(rendu, '#5e5546', [
    { intensite: 1.4, position: [0, 0, -6], echelle: [20, 6], couleur: '#fff7e8' },
    { intensite: 3, position: [0, 5, -2], echelle: [10, 3], rotation: [Math.PI / 2, 0] },
    { intensite: 2.2, position: [-5, 1, -1], echelle: [3, 8], rotation: [0, Math.PI / 2] },
    { intensite: 2.2, position: [5, 1, -1], echelle: [3, 8], rotation: [0, -Math.PI / 2] },
    { forme: 'anneau', intensite: 4, position: [2, 2, 4], echelle: 2, couleur: '#fff2d6' },
    { intensite: 0.8, position: [0, -3, 3], echelle: [8, 1], couleur: '#f4e7cf' }
  ]);
  var lum = new THREE.DirectionalLight(0xffffff, 1.2);
  lum.position.set(3, 5, 4);
  scene.add(lum, new THREE.AmbientLight(0xffffff, 0.15));
  var sol = ombre(9, '#4a3d24', 0.35);
  sol.position.y = -1.75;
  scene.add(sol);

  var METAUX = { or: new THREE.Color(1.0, 0.77, 0.36), argent: new THREE.Color(0.95, 0.94, 0.92) };
  var PIERRES = { diamant: new THREE.Color(1, 1, 1), saphir: new THREE.Color(0.18, 0.32, 0.95) };
  var mats = {
    metal: new THREE.MeshPhysicalMaterial({ color: METAUX.or.clone(), metalness: 1, roughness: 0.14, clearcoat: leger ? 0 : 0.4, clearcoatRoughness: 0.08, envMapIntensity: 1.25 }),
    pierre: leger
      ? new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0.1, roughness: 0, flatShading: true, envMapIntensity: 2.4, clearcoat: 1 })
      : new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 1, ior: 2.42, thickness: 0.6, roughness: 0, dispersion: 4, flatShading: true, envMapIntensity: 2, specularIntensity: 1 }),
    perle: new THREE.MeshPhysicalMaterial({ color: '#f3ece0', roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.15, iridescence: leger ? 0.3 : 0.75, iridescenceIOR: 1.4, sheen: 0.4, sheenColor: new THREE.Color('#ffe9f0') })
  };

  // taille brillant simplifiée : table, couronne, rondiste, pavillon, colette
  function brillant(r) {
    var pts = [[0.0001, r * 0.32], [r * 0.56, r * 0.32], [r, r * 0.02], [r, -r * 0.02], [0.0001, -r * 0.86]].map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    return new THREE.LatheGeometry(pts, 16).toNonIndexed();
  }
  var seg = leger ? 96 : 200;
  var anneau = new THREE.TorusGeometry(1, 0.1, leger ? 24 : 48, seg);
  anneau.scale(1, 1, 1.9);
  var griffe = new THREE.CylinderGeometry(0.022, 0.03, 0.34, 10);
  var gemme = brillant(0.3);
  var forme = new THREE.Shape();
  forme.absarc(0, 0, 0.9, Math.PI * 0.18, Math.PI * 1.82, false);
  forme.absarc(0.38, 0.05, 0.72, Math.PI * 1.7, Math.PI * 0.3, true);
  var croissant = new THREE.ExtrudeGeometry(forme, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: leger ? 3 : 8, curveSegments: leger ? 48 : 96 });
  croissant.center();
  var beliere = new THREE.TorusGeometry(0.12, 0.03, 16, 48);
  var pts = [[-0.02, 1.05, 0], [-0.5, 2.2, -0.15], [-1.2, 3.6, -0.4], [-1.9, 5.4, -0.8]];
  var chaine = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); })), 80, 0.018, 8, false);
  var chaine2 = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(function (p) { return new THREE.Vector3(-p[0], p[1], p[2]); })), 80, 0.018, 8, false);
  var perle = new THREE.SphereGeometry(0.42, 64, 48);
  var calotte = new THREE.SphereGeometry(0.16, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.2);
  var crochet = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, 0.55, 0], [0, 0.95, 0.05], [0.18, 1.25, 0.1], [0.42, 1.2, 0.05], [0.5, 0.9, 0]].map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); })), 64, 0.025, 10, false);
  var jonc = new THREE.TorusGeometry(1.25, 0.075, leger ? 20 : 36, seg, Math.PI * 2 - 0.55);
  jonc.rotateZ(0.275 + Math.PI / 2);
  jonc.scale(1, 0.86, 1);
  var bout = brillant(0.13);

  function m(geo, mat, pos, rot) {
    var x = new THREE.Mesh(geo, mat);
    if (pos) x.position.fromArray(pos);
    if (rot) x.rotation.set(rot[0], rot[1], rot[2]);
    return x;
  }
  var bijoux = {};
  // Éclipse
  var e = new THREE.Group();
  e.rotation.x = 0.35;
  e.add(m(anneau, mats.metal));
  var tete = new THREE.Group();
  tete.position.y = 1.18;
  for (var i = 0; i < 4; i++) {
    var a = (i * Math.PI) / 2 + Math.PI / 4;
    tete.add(m(griffe, mats.metal, [Math.cos(a) * 0.24, 0.02, Math.sin(a) * 0.24]));
  }
  tete.add(m(gemme, mats.pierre, [0, 0.12, 0]));
  e.add(tete);
  bijoux.eclipse = e;
  // Croissant
  var c = new THREE.Group();
  c.position.y = -0.3;
  c.add(m(croissant, mats.metal, null, [0, 0.4, 0.5]), m(beliere, mats.metal, [-0.02, 0.95, 0], [0, Math.PI / 2, 0]),
    m(chaine, mats.metal), m(chaine2, mats.metal), m(bout, mats.pierre, [0.62, -0.62, 0.1], [Math.PI / 2, 0, 0]));
  bijoux.croissant = c;
  // Perle d'aube
  var pe = new THREE.Group();
  [-0.75, 0.75].forEach(function (x, k) {
    var g = new THREE.Group();
    g.position.set(x, k ? -0.25 : 0.1, k ? -0.4 : 0);
    g.rotation.set(0, k ? -0.5 : 0.4, k ? 0.08 : -0.06);
    g.add(m(perle, mats.perle), m(calotte, mats.metal, [0, 0.36, 0]), m(crochet, mats.metal));
    pe.add(g);
  });
  bijoux.perle = pe;
  // Orbite
  var o = new THREE.Group();
  o.rotation.set(1.1, 0, 0.1);
  o.add(m(jonc, mats.metal));
  var a0 = Math.PI / 2 + 0.275;
  [a0, a0 - 0.55].forEach(function (ang, k) {
    o.add(m(bout, mats.pierre, [Math.cos(ang - 0.275) * 1.25, Math.sin(ang - 0.275) * 1.25 * 0.86, 0], [0, 0, k ? 0.5 : -0.5]));
  });
  bijoux.orbite = o;

  var pivot = new THREE.Group(), echange = new THREE.Group();
  Object.keys(bijoux).forEach(function (k) { bijoux[k].name = k; echange.add(bijoux[k]); });
  pivot.add(echange);
  scene.add(pivot);

  function taille() {
    var w = hote.clientWidth, h = hote.clientHeight;
    rendu.setSize(w, h, false);
    rendu.domElement.style.width = '100%';
    rendu.domElement.style.height = '100%';
    cam.aspect = w / Math.max(1, h);
    cam.updateProjectionMatrix();
  }
  taille();
  window.addEventListener('resize', taille);

  var glisse = null;
  hote.addEventListener('pointerdown', function (ev) { glisse = { x: ev.clientX, y: ev.clientY, id: ev.pointerId }; });
  hote.addEventListener('pointermove', function (ev) {
    if (!glisse || glisse.id !== ev.pointerId) return;
    etat.gx += ev.clientX - glisse.x;
    etat.gy += ev.clientY - glisse.y;
    glisse.x = ev.clientX;
    glisse.y = ev.clientY;
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) { hote.addEventListener(n, function () { glisse = null; }); });

  var visible = true;
  new IntersectionObserver(function (x) { visible = x[0].isIntersecting; }).observe(scene3d);

  var montre = etat.piece, ech = 1, rot = { x: 0, y: 0 }, horloge = new THREE.Clock();
  rendu.setAnimationLoop(function () {
    var dt = Math.min(horloge.getDelta(), 0.05);
    if (!visible) return;
    var t = horloge.elapsedTime;
    mats.metal.color.lerp(METAUX[etat.metal], 1 - Math.exp(-dt * 4));
    mats.pierre.color.lerp(PIERRES[etat.pierre], 1 - Math.exp(-dt * 4));
    if (!leger) mats.pierre.attenuationColor.copy(mats.pierre.color);
    // changement de pièce : elle s'efface, la suivante éclot
    if (etat.piece !== montre) {
      ech = Math.max(0, ech - dt * 4.5);
      if (ech === 0) montre = etat.piece;
    } else ech = Math.min(1, ech + dt * 2.2);
    var k = 1 - Math.pow(1 - ech, 3);
    echange.scale.setScalar(0.001 + k);
    echange.rotation.y = (1 - k) * 1.6;
    echange.children.forEach(function (g) { g.visible = g.name === montre; });
    // glisser pour tourner, sinon lente rotation de présentation
    rot.y += etat.gx * 0.008;
    rot.x = Math.max(-0.6, Math.min(0.6, rot.x + etat.gy * 0.006));
    etat.gx = etat.gy = 0;
    if (!reduit) rot.y += dt * 0.25;
    rot.x *= 1 - dt * 0.6;
    var p = etat.progression;
    var cote = etat.etroit ? 0 : -1.55 * p;
    var haut = etat.etroit ? -0.75 + 1.6 * p : -0.8 * (1 - p);
    pivot.position.set(cote, haut + Math.sin(t * 0.8) * 0.05, 0);
    pivot.rotation.set(rot.x, rot.y, 0);
    pivot.scale.setScalar(etat.etroit ? 0.7 : 0.8 + 0.1 * p);
    cam.position.x = Math.sin(t * 0.13) * 0.15;
    cam.lookAt(0, 0, 0);
    rendu.render(scene, cam);
  });
  requestAnimationFrame(function () { scene3d.classList.add('pret'); });
}
