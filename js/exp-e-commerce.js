/* Qamar — concept 04 E-commerce : « Atelier Séléné », boutique fictive.
   La pièce choisie au centre, les autres en orbite (3D), grille filtrable, fiche produit et panier. */
import * as THREE from 'three';
import { studio, ombre } from './exp-studio.js';

var Q = window.Qexp;
var reduit = Q.reduit();

var PRODUITS = [
  { id: 'p1', nom: 'Bougie Mer de la Sérénité', cat: 'Lumière', prix: 48, forme: 'bougie', teintes: [['Nuit', '#3F4B5E'], ['Sable', '#C8B79A']], desc: 'Cire végétale, mèche en coton, verre soufflé. 50 heures de lumière douce.' },
  { id: 'p2', nom: 'Vase Croissant', cat: 'Table', prix: 120, forme: 'vase', teintes: [['Grès', '#B9A27F'], ['Basalte', '#4A4744']], desc: "Grès émaillé à la main, silhouette inspirée d'un premier quartier." },
  { id: 'p3', nom: 'Eau de parfum Clair-Obscur', cat: 'Parfum', prix: 95, forme: 'flacon', teintes: [['Ambre', '#C8A46A'], ['Fumée', '#7D7F86']], desc: "Notes d'iris, de bois blond et de musc lumineux. 50 ml." },
  { id: 'p4', nom: 'Bol Orbite', cat: 'Table', prix: 36, forme: 'bol', teintes: [['Lait', '#E7DFD2'], ['Encre', '#263A55']], desc: 'Porcelaine fine, liseré doré. Pour les petits rituels du quotidien.' },
  { id: 'p5', nom: 'Lampe Pleine Lune', cat: 'Lumière', prix: 210, forme: 'lampe', teintes: [['Opale', '#EFE6D6'], ['Miel', '#E3C48F']], desc: 'Globe en verre opalin, socle laiton brossé. Variateur tactile.' },
  { id: 'p6', nom: 'Carafe Marée', cat: 'Table', prix: 64, forme: 'carafe', teintes: [['Cristal', '#CFD8DF'], ['Fumé', '#8C8780']], desc: 'Verre borosilicate, bouchon en laiton. Un litre.' }
];
var CLE = 'qamar-demo-panier';
var euro = function (n) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n); };

var vedette = 0;
var teinteChoisie = {};
var panier = [];
try { panier = JSON.parse(sessionStorage.getItem(CLE) || '[]'); } catch (e) { panier = []; }
var orbite = { selection: 0, couleurs: {}, glisse: 0 };
PRODUITS.forEach(function (p) { orbite.couleurs[p.id] = p.teintes[0][1]; });

function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

/* ---------- Panier ---------- */
var boutonPanier = $('.ec-panier-bouton');
function sauver() { try { sessionStorage.setItem(CLE, JSON.stringify(panier)); } catch (e) { /* stockage indisponible */ } }
function compte() { return panier.reduce(function (n, l) { return n + l.qte; }, 0); }
function trouver(id) { return PRODUITS.find(function (p) { return p.id === id; }); }
function ajouter(p, teinte, q) {
  var cle = p.id + '-' + teinte;
  var l = panier.find(function (x) { return x.cle === cle; });
  if (l) l.qte = Math.min(9, l.qte + (q || 1));
  else panier.push({ cle: cle, id: p.id, teinte: teinte, qte: q || 1 });
  sauver();
  majPanier();
  boutonPanier.classList.remove('rebond');
  void boutonPanier.offsetWidth;
  boutonPanier.classList.add('rebond');
}
function quantite(cle, q) {
  panier = q <= 0 ? panier.filter(function (l) { return l.cle !== cle; }) : panier.map(function (l) { if (l.cle === cle) l.qte = Math.min(9, q); return l; });
  sauver();
  majPanier();
}
function majPanier() {
  var n = compte();
  $('.ec-panier-bouton b').textContent = n;
  boutonPanier.setAttribute('aria-label', 'Ouvrir le panier, ' + n + ' article' + (n > 1 ? 's' : ''));
  var liste = $('.ec-lignes');
  if (!panier.length) liste.innerHTML = '<p class="ec-vide">Votre panier est vide.</p>';
  else liste.innerHTML = '<ul>' + panier.map(function (l) {
    var p = trouver(l.id);
    var hex = (p.teintes.find(function (t) { return t[0] === l.teinte; }) || p.teintes[0])[1];
    return '<li><div class="ec-ligne-art">' + Q.artProduit(p.forme, hex) + '</div><div class="ec-ligne-corps"><p class="ec-ligne-nom">' + p.nom + '</p><p class="ec-ligne-teinte">' + l.teinte + '</p>' +
      '<div class="ec-ligne-bas"><div class="ec-qte-mini"><button type="button" data-q="-1" data-cle="' + l.cle + '" aria-label="Retirer un exemplaire">−</button><span>' + l.qte + '</span><button type="button" data-q="1" data-cle="' + l.cle + '" aria-label="Ajouter un exemplaire">+</button></div><span>' + euro(p.prix * l.qte) + '</span></div></div></li>';
  }).join('') + '</ul>';
  var total = panier.reduce(function (s, l) { return s + trouver(l.id).prix * l.qte; }, 0);
  $('.ec-total').textContent = euro(total);
  $('.ec-commander').disabled = !panier.length;
}
$('.ec-lignes').addEventListener('click', function (e) {
  var b = e.target.closest('button[data-cle]');
  if (!b) return;
  var l = panier.find(function (x) { return x.cle === b.getAttribute('data-cle'); });
  if (l) quantite(l.cle, l.qte + +b.getAttribute('data-q'));
});

var tiroir = $('.ec-tiroir');
function ouvrirTiroir() { tiroir.hidden = false; requestAnimationFrame(function () { tiroir.classList.add('ouvert'); }); $('.ec-tiroir-fermer').focus(); }
function fermer(el) { el.classList.remove('ouvert'); setTimeout(function () { el.hidden = true; }, 450); }
boutonPanier.addEventListener('click', ouvrirTiroir);
$('.ec-tiroir-fermer').addEventListener('click', function () { fermer(tiroir); });
tiroir.addEventListener('click', function (e) { if (e.target === tiroir) fermer(tiroir); });
$('.ec-commander').addEventListener('click', function () { $('.ec-avis').hidden = false; });

/* ---------- Fiche produit ---------- */
var fiche = $('.ec-fiche');
var ficheEtat = { p: null, t: 0, q: 1 };
function rendreFiche() {
  var p = ficheEtat.p;
  $('.ec-fiche-art').innerHTML = '<div class="ec-fiche-objet">' + Q.artProduit(p.forme, p.teintes[ficheEtat.t][1]) + '</div>';
  $('.ec-fiche-cat').textContent = p.cat;
  $('.ec-fiche-nom').textContent = p.nom;
  $('.ec-fiche-prix').textContent = euro(p.prix);
  $('.ec-fiche-desc').textContent = p.desc;
  $('.ec-fiche-teinte').textContent = 'Teinte : ' + p.teintes[ficheEtat.t][0];
  $('.ec-fiche-teintes').innerHTML = p.teintes.map(function (t, i) {
    return '<button type="button" class="ec-pastille" style="background:' + t[1] + '" aria-label="' + t[0] + '" aria-pressed="' + (i === ficheEtat.t) + '" data-t="' + i + '"></button>';
  }).join('');
  $('.ec-qte span').textContent = ficheEtat.q;
  $('.ec-fiche-ajouter').textContent = 'Ajouter · ' + euro(p.prix * ficheEtat.q);
  fiche.querySelector('[role=dialog]').setAttribute('aria-label', p.nom);
}
function ouvrirFiche(p) {
  ficheEtat = { p: p, t: 0, q: 1 };
  rendreFiche();
  fiche.hidden = false;
  requestAnimationFrame(function () { fiche.classList.add('ouvert'); });
  $('.ec-fiche-fermer').focus();
}
$('.ec-fiche-teintes').addEventListener('click', function (e) {
  var b = e.target.closest('[data-t]');
  if (b) { ficheEtat.t = +b.getAttribute('data-t'); rendreFiche(); }
});
$$('.ec-qte button').forEach(function (b) {
  b.addEventListener('click', function () { ficheEtat.q = Math.max(1, Math.min(9, ficheEtat.q + +b.getAttribute('data-q'))); rendreFiche(); });
});
$('.ec-fiche-ajouter').addEventListener('click', function () {
  ajouter(ficheEtat.p, ficheEtat.p.teintes[ficheEtat.t][0], ficheEtat.q);
  fermer(fiche);
  setTimeout(ouvrirTiroir, 200);
});
$('.ec-fiche-fermer').addEventListener('click', function () { fermer(fiche); });
fiche.addEventListener('click', function (e) { if (e.target === fiche) fermer(fiche); });
window.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  if (!fiche.hidden) fermer(fiche);
  if (!tiroir.hidden) fermer(tiroir);
});

/* ---------- Grille filtrable ---------- */
var grille = $('.ec-grille');
function rendreGrille(cat) {
  var liste = PRODUITS.filter(function (p) { return cat === 'Tous' || p.cat === cat; });
  grille.innerHTML = liste.map(function (p, i) {
    return '<article class="ec-carte" style="--i:' + i + '"><button type="button" class="ec-carte-visuel" data-ouvrir="' + p.id + '" aria-label="Voir ' + p.nom + '">' + Q.artProduit(p.forme, p.teintes[0][1]) + '<span>Découvrir</span></button>' +
      '<div class="ec-carte-haut"><div><h3>' + p.nom + '</h3><p>' + p.cat + '</p></div><p class="ec-carte-prix">' + euro(p.prix) + '</p></div>' +
      '<button type="button" class="ec-carte-ajouter" data-ajouter="' + p.id + '">Ajouter au panier</button></article>';
  }).join('');
}
grille.addEventListener('click', function (e) {
  var o = e.target.closest('[data-ouvrir]'), a = e.target.closest('[data-ajouter]');
  if (o) ouvrirFiche(trouver(o.getAttribute('data-ouvrir')));
  if (a) { var p = trouver(a.getAttribute('data-ajouter')); ajouter(p, p.teintes[0][0]); }
});
$$('.ec-cat').forEach(function (b) {
  b.addEventListener('click', function () {
    $$('.ec-cat').forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
    rendreGrille(b.textContent.trim());
  });
});
rendreGrille('Tous');
majPanier();

/* ---------- Pièce en vedette ---------- */
var scene3d = $('.ec-orbite');
var info = $('.ec-vedette');
var repli = $('.ec-repli');
function rendreVedette() {
  var p = PRODUITS[vedette];
  var ti = teinteChoisie[p.id] || 0;
  var hex = p.teintes[ti][1];
  scene3d.style.setProperty('--teinte', hex);
  info.classList.remove('montre');
  void info.offsetWidth;
  info.classList.add('montre');
  $('.ec-vedette-cat').textContent = p.cat + ' · ' + (vedette + 1) + ' / ' + PRODUITS.length;
  $('.ec-vedette-nom').textContent = p.nom;
  $('.ec-vedette-prix').textContent = euro(p.prix);
  $('.ec-vedette-teintes').innerHTML = p.teintes.map(function (t, i) {
    return '<button type="button" role="radio" class="ec-pastille" style="background:' + t[1] + '" aria-label="' + t[0] + '" title="' + t[0] + '" aria-checked="' + (i === ti) + '" data-t="' + i + '"></button>';
  }).join('');
  if (repli) repli.innerHTML = Q.artProduit(p.forme, hex);
}
function choisir(i) { vedette = i; orbite.selection = i; rendreVedette(); }
$('.ec-vedette-teintes').addEventListener('click', function (e) {
  var b = e.target.closest('[data-t]');
  if (!b) return;
  var p = PRODUITS[vedette];
  teinteChoisie[p.id] = +b.getAttribute('data-t');
  orbite.couleurs[p.id] = p.teintes[teinteChoisie[p.id]][1];
  rendreVedette();
});
$('.ec-prec').addEventListener('click', function () { choisir((vedette - 1 + PRODUITS.length) % PRODUITS.length); });
$('.ec-suiv').addEventListener('click', function () { choisir((vedette + 1) % PRODUITS.length); });
$('.ec-voir').addEventListener('click', function () { ouvrirFiche(PRODUITS[vedette]); });
$('.ec-vedette-ajouter').addEventListener('click', function () {
  var p = PRODUITS[vedette];
  ajouter(p, p.teintes[teinteChoisie[p.id] || 0][0]);
});
scene3d.addEventListener('keydown', function (e) {
  if (e.target.closest('input, button')) return;
  if (e.key === 'ArrowRight') choisir((vedette + 1) % PRODUITS.length);
  if (e.key === 'ArrowLeft') choisir((vedette - 1 + PRODUITS.length) % PRODUITS.length);
});
rendreVedette();

/* ---------- Orbite 3D ---------- */
var mode = Q.modeScene(820);
if (mode !== 'photo') {
  var leger = mode === 'low';
  var hote = $('.ec-orbite-3d');
  var rendu = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, leger ? 1.25 : 1.8));
  rendu.toneMapping = THREE.ACESFilmicToneMapping;
  hote.appendChild(rendu.domElement);
  var scene = new THREE.Scene();
  var cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  cam.position.set(0, 0.6, 9.5);
  cam.lookAt(0, -0.1, 0);
  scene.environment = studio(rendu, '#8f877b', [
    { intensite: 2.6, position: [0, 4, 2], echelle: [8, 3], rotation: [Math.PI / 2, 0] },
    { intensite: 1.6, position: [-5, 1, 0], echelle: [2, 6], rotation: [0, Math.PI / 2] },
    { intensite: 1.2, position: [5, 1, 0], echelle: [2, 6], rotation: [0, -Math.PI / 2], couleur: '#ffe9c8' }
  ]);
  var soleil = new THREE.DirectionalLight(0xffffff, 1.4);
  soleil.position.set(3, 6, 4);
  scene.add(soleil, new THREE.AmbientLight(0xffffff, 0.25));
  var sol = ombre(12, '#000000', 0.32);
  sol.position.y = -1.75;
  scene.add(sol);

  var s = leger ? 40 : 72;
  function tour(pts) { return new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), s); }
  var G = {
    vase: tour([[0.001, -1], [0.42, -1], [0.55, -0.7], [0.62, -0.2], [0.5, 0.35], [0.26, 0.72], [0.22, 0.95], [0.3, 1.05], [0.27, 1.07], [0.18, 0.95], [0.001, 0.9]]),
    bol: tour([[0.001, -0.42], [0.3, -0.42], [0.34, -0.36], [0.62, -0.08], [0.82, 0.32], [0.86, 0.36], [0.8, 0.36], [0.76, 0.3], [0.56, -0.02], [0.001, -0.3]]),
    carafe: tour([[0.001, -1], [0.5, -1], [0.56, -0.8], [0.58, -0.2], [0.4, 0.3], [0.17, 0.62], [0.15, 0.95], [0.2, 1.02], [0.001, 1.02]]),
    verre: tour([[0.001, -0.7], [0.48, -0.7], [0.5, -0.66], [0.5, 0.56], [0.46, 0.56], [0.46, -0.62], [0.001, -0.62]]),
    cire: new THREE.CylinderGeometry(0.45, 0.45, 0.9, s),
    meche: new THREE.CylinderGeometry(0.015, 0.015, 0.16, 6),
    bouteille: new THREE.BoxGeometry(0.9, 1.15, 0.5),
    bouchon: new THREE.CylinderGeometry(0.2, 0.2, 0.38, s),
    col: new THREE.CylinderGeometry(0.09, 0.09, 0.12, 24),
    globe: new THREE.SphereGeometry(0.62, s, s / 2),
    socle: tour([[0.001, -1], [0.42, -1], [0.44, -0.94], [0.2, -0.86], [0.08, -0.4], [0.1, -0.5], [0.001, -0.5]])
  };
  var laiton = new THREE.MeshStandardMaterial({ color: '#c9a25a', metalness: 1, roughness: 0.3 });
  var cireMat = new THREE.MeshPhysicalMaterial({ color: '#f3ead9', roughness: 0.6, sheen: 0.5, transmission: leger ? 0 : 0.2, thickness: 0.5 });

  function materiaux(couleur) {
    return {
      email: new THREE.MeshPhysicalMaterial({ color: couleur, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
      verre: leger
        ? new THREE.MeshPhysicalMaterial({ color: couleur, roughness: 0.05, transparent: true, opacity: 0.45, clearcoat: 1 })
        : new THREE.MeshPhysicalMaterial({ color: couleur, roughness: 0.04, transmission: 1, thickness: 0.4, ior: 1.5, attenuationColor: new THREE.Color(couleur), attenuationDistance: 1.4 }),
      opale: new THREE.MeshPhysicalMaterial({ color: couleur, roughness: 0.25, emissive: new THREE.Color(couleur), emissiveIntensity: 0.35, transmission: leger ? 0 : 0.4, thickness: 1 })
    };
  }
  function maille(geo, mat, pos, ech) {
    var m = new THREE.Mesh(geo, mat);
    if (pos) m.position.fromArray(pos);
    if (ech) m.scale.setScalar(ech);
    return m;
  }
  function modele(forme, couleur) {
    var g = new THREE.Group(), M = materiaux(couleur);
    g.userData.mats = M;
    if (forme === 'vase') g.add(maille(G.vase, M.email));
    if (forme === 'bol') g.add(maille(G.bol, M.email, [0, -0.4, 0], 1.15));
    if (forme === 'carafe') g.add(maille(G.carafe, M.verre), maille(G.col, laiton, [0, 1.08, 0]));
    if (forme === 'bougie') {
      var b = new THREE.Group();
      b.position.y = -0.25;
      var cire = maille(G.cire, cireMat, [0, -0.18, 0]);
      cire.scale.set(0.98, 0.95, 0.98);
      b.add(maille(G.verre, M.verre), cire, maille(G.meche, laiton, [0, 0.34, 0]));
      g.add(b);
    }
    if (forme === 'flacon') g.add(maille(G.bouteille, M.verre), maille(G.col, laiton, [0, 0.62, 0]), maille(G.bouchon, laiton, [0, 0.86, 0]));
    if (forme === 'lampe') g.add(maille(G.globe, M.opale, [0, 0.25, 0]), maille(G.socle, laiton));
    return g;
  }
  function teinter(g, couleur) {
    var M = g.userData.mats;
    [M.email, M.verre, M.opale].forEach(function (m) { m.color.set(couleur); });
    M.opale.emissive.set(couleur);
    if (M.verre.attenuationColor) M.verre.attenuationColor.set(couleur);
  }

  var objets = PRODUITS.map(function (p, i) {
    var g = modele(p.forme, orbite.couleurs[p.id]);
    g.userData.i = i;
    g.userData.couleur = orbite.couleurs[p.id];
    g.userData.pos = new THREE.Vector3();
    g.userData.ech = 0.5;
    g.traverse(function (o) { o.userData.objet = i; });
    scene.add(g);
    return g;
  });

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

  // survol et clic sur une pièce en orbite ; glisser pour tourner la pièce centrale
  var rayon = new THREE.Raycaster(), pt = new THREE.Vector2(), survol = null, glisse = null, bouge = 0;
  function viser(e) {
    var r = rendu.domElement.getBoundingClientRect();
    pt.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    rayon.setFromCamera(pt, cam);
    var t = rayon.intersectObjects(objets, true)[0];
    return t ? t.object.userData.objet : null;
  }
  hote.addEventListener('pointerdown', function (e) { glisse = { x: e.clientX, id: e.pointerId }; bouge = 0; });
  hote.addEventListener('pointermove', function (e) {
    if (glisse && glisse.id === e.pointerId) {
      orbite.glisse += e.clientX - glisse.x;
      bouge += Math.abs(e.clientX - glisse.x);
      glisse.x = e.clientX;
    }
    if (e.pointerType === 'mouse') {
      var i = viser(e);
      survol = i !== null && i !== orbite.selection ? i : null;
      hote.style.cursor = survol !== null ? 'pointer' : 'grab';
    }
  });
  function lacher(e) {
    if (glisse && bouge < 6 && e.type === 'pointerup') {
      var i = viser(e);
      if (i !== null && i !== orbite.selection) choisir(i);
    }
    glisse = null;
  }
  hote.addEventListener('pointerup', lacher);
  hote.addEventListener('pointerleave', lacher);
  hote.addEventListener('pointercancel', lacher);

  var visible = true;
  new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(scene3d);

  var phi = 0, horloge = new THREE.Clock(), cible = new THREE.Vector3();
  rendu.setAnimationLoop(function () {
    var dt = Math.min(horloge.getDelta(), 0.05);
    if (!visible) return;
    var t = horloge.elapsedTime;
    var portrait = hote.clientWidth < hote.clientHeight;
    cam.position.z += ((portrait ? 15 : 9.5) - cam.position.z) * Math.min(1, dt * 3);
    cam.lookAt(0, portrait ? -0.4 : -0.1, 0);
    var R = portrait ? 2.1 : 3.3;
    if (!reduit) phi += dt * 0.12;
    var tourne = orbite.glisse * 0.01;
    orbite.glisse = 0;
    var autres = objets.filter(function (g) { return g.userData.i !== orbite.selection; });
    objets.forEach(function (g) {
      var p = PRODUITS[g.userData.i];
      if (orbite.couleurs[p.id] !== g.userData.couleur) { g.userData.couleur = orbite.couleurs[p.id]; teinter(g, g.userData.couleur); }
      var ech;
      if (g.userData.i === orbite.selection) {
        cible.set(0, (portrait ? 0.1 : 0.55) + Math.sin(t * 0.9) * 0.06, 0);
        ech = 1.35;
        g.rotation.y += dt * 0.35 + tourne;
      } else {
        var k = autres.indexOf(g);
        var a = (k / autres.length) * Math.PI * 2 + phi;
        cible.set(Math.sin(a) * R, (portrait ? -1.7 : -1.25) + Math.cos(a) * 0.12, Math.cos(a) * 1.4 - 0.4);
        ech = (survol === g.userData.i ? 0.62 : 0.48) * (0.85 + (Math.cos(a) + 1) * 0.1);
        g.rotation.y += dt * 0.5;
      }
      g.userData.pos.lerp(cible, 1 - Math.exp(-dt * 3.2));
      g.userData.ech += (ech - g.userData.ech) * (1 - Math.exp(-dt * 4));
      g.position.copy(g.userData.pos);
      g.scale.setScalar(g.userData.ech);
    });
    rendu.render(scene, cam);
  });
  requestAnimationFrame(function () { scene3d.classList.add('pret'); });
} else {
  scene3d.classList.add('photo');
}
