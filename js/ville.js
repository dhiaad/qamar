/* Qamar — accueil : la ville la nuit, traversée de néons.
   Au repos : de longs néons orange parcourent la ville, le long des avenues et au-dessus des tours.
   Cliquer et maintenir (9 s) : la caméra (sans zoom) survole la ville en suivant les rubans ; ils se décollent
   et montent dans l'espace, la caméra monte avec eux jusqu'à ne plus voir la ville ; un par un ils se resserrent
   en un seul rayon qui touche la Lune (hors champ au repos) et l'embrase en orange.
   Photo : Sergey Konstantinov, Unsplash (Chicago de nuit). Lune : NASA SVS, CGI Moon Kit (lune-vivante.js). */
(function () {
  var racine = document.documentElement;
  var zone = document.querySelector('.hero');
  var ville = document.querySelector('.ville');
  var camera = ville && ville.querySelector('.ville-camera');
  var toile = ville && ville.querySelector('.ville-flux');
  var cadre = ville && ville.querySelector('.ville-cadre');
  if (!zone || !toile || !toile.getContext) return;
  var ctx = toile.getContext('2d');
  var lune = ville.querySelector('.ville-lune');
  var calme = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Les néons : tracés en % de la photo (avenues qui filent vers l'horizon, et courbes au-dessus des tours) ----------
  // les rubans suivent les vraies rues de la photo (avenues qui filent vers le lac, rues transversales,
  // passages entre les tours du premier plan), en % de la photo
  var TRACES = [
    [[48, 100], [49, 82], [47, 66], [42, 56], [37, 47], [33, 40], [29, 34], [26.5, 30]],
    [[21, 100], [21.5, 84], [22.4, 68], [22.2, 52], [21.9, 40], [21.5, 30]],
    [[-2, 49], [10, 47], [22.3, 46], [27, 41], [29, 34], [29.5, 30]],
    [[2, 47], [8, 42], [13, 37], [18, 32], [21, 29]],
    [[0, 44], [6, 39], [12, 34], [17, 30]],
    [[38, 66], [35, 55], [32.5, 47], [30, 40], [28, 34], [26.5, 30]],
    [[46, 60], [41, 51], [37, 44], [33, 37], [31, 33]],
    [[-2, 64], [10, 65], [22.5, 65], [32, 63], [41, 63], [49, 66]],
    [[13, 100], [16, 86], [19, 74], [22.5, 66]]
  ];
  var COULEURS = [[252, 79, 0], [255, 112, 22], [255, 140, 52], [255, 96, 12], [255, 160, 82]];

  var L = 0, H = 0, CIEL = 0, BOITE = 0, MARGE = 0, LARGE = 0, dpr = 1, ech = 1;
  var neons = [];
  var G = { x: 0, y: 0 }, M = { x: 0, y: 0, r: 50 };

  function catmull(pts, n) {
    var out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (var k = 0; k < n; k++) {
        var t = k / n, t2 = t * t, t3 = t2 * t;
        out.push({
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
          d: p1.d + (p2.d - p1.d) * t
        });
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function mesurer() {
    L = Math.round(ville.getBoundingClientRect().width);
    H = Math.round(zone.getBoundingClientRect().height);
    CIEL = Math.round(H * 1.35);
    MARGE = Math.round(L * 0.12); LARGE = L + 2 * MARGE;   // de la place pour que la caméra survole la ville sans zoomer
    ville.style.setProperty('--ciel', CIEL + 'px');
    ville.style.setProperty('--marge', MARGE + 'px');
    BOITE = cadre.offsetHeight;
    ech = Math.max(0.6, Math.min(1.5, Math.hypot(L, H) / 1650));
    dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    toile.width = Math.round(LARGE * dpr);
    toile.height = Math.round((CIEL + BOITE) * dpr);
    // même cadrage que la photo : object-fit: cover ; object-position: 35% 40%
    var ratio = 1.5, iw, ih;
    if (LARGE / BOITE > ratio) { iw = LARGE; ih = LARGE / ratio; } else { ih = BOITE; iw = BOITE * ratio; }
    var ox = (LARGE - iw) * 0.35, oy = (BOITE - ih) * 0.4;
    neons = TRACES.map(function (tr, i) {
      var pts = catmull(tr.map(function (p) { return { x: ox + p[0] / 100 * iw, y: CIEL + oy + p[1] / 100 * ih, d: Math.max(0.18, Math.min(1.15, (p[1] - 27) / 38)) }; }), 8);
      var cumul = [0];
      for (var k = 1; k < pts.length; k++) cumul.push(cumul[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y));
      var ancien = neons[i];
      return {
        pts: pts, cumul: cumul, long: cumul[cumul.length - 1],
        s: ancien ? ancien.s : Math.random(),
        v: ancien ? ancien.v : 0.12 + Math.random() * 0.14,
        couleur: COULEURS[i % COULEURS.length],
        p: ancien ? ancien.p : 0, vu: pts.slice()
      };
    });
    G.x = LARGE / 2; G.y = CIEL * 0.62;
    if (lune) { M.x = LARGE / 2; M.y = CIEL * 0.32; M.r = lune.offsetWidth * 0.47; }
  }
  function point(n, f) {
    var d = Math.max(0, Math.min(1, f)) * n.long, c = n.cumul, i = 1;
    while (i < c.length - 1 && c[i] < d) i++;
    var a = n.vu[i - 1], b = n.vu[i], k = (d - c[i - 1]) / Math.max(1e-3, c[i] - c[i - 1]);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, d: a.d + (b.d - a.d) * k };
  }

  // ---------- Dessin : le fil discret du néon, et sa longue impulsion lumineuse ----------
  function traitProf(liste, largeur, c, alpha) {
    ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')';
    ctx.lineCap = 'butt';
    for (var i = 1; i < liste.length; i++) {
      ctx.beginPath(); ctx.moveTo(liste[i - 1].x, liste[i - 1].y); ctx.lineTo(liste[i].x, liste[i].y);
      ctx.lineWidth = largeur * (liste[i].d || 1); ctx.stroke();
    }
    ctx.lineCap = 'round';
  }
  function trait(liste, largeur, c, alpha) {
    ctx.beginPath();
    ctx.moveTo(liste[0].x, liste[0].y);
    for (var i = 1; i < liste.length; i++) ctx.lineTo(liste[i].x, liste[i].y);
    ctx.lineWidth = largeur;
    ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')';
    ctx.stroke();
  }
  function halo(x, y, r, a) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,240,225,' + a + ')');
    g.addColorStop(0.25, 'rgba(255,140,60,' + 0.6 * a + ')');
    g.addColorStop(1, 'rgba(252,79,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function impulsion(n, tete, longueur) {
    var seg = [];
    for (var k = 0; k <= 26; k++) {
      var f = tete - longueur + longueur * k / 26;
      if (f >= 0 && f <= 1) seg.push(point(n, f));
    }
    if (seg.length < 2) return;
    var a = seg[0], b = seg[seg.length - 1], c = n.couleur;
    var g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    g.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
    g.addColorStop(0.7, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',.8)');
    g.addColorStop(1, 'rgba(255,236,215,1)');
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.moveTo(seg[0].x, seg[0].y);
    for (var i = 1; i < seg.length; i++) ctx.lineTo(seg[i].x, seg[i].y);
    var pd = b.d || 1;
    ctx.globalAlpha = 0.18; ctx.lineWidth = 22 * ech * pd; ctx.stroke();
    ctx.globalAlpha = 0.4; ctx.lineWidth = 8 * ech * pd; ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = 2.6 * ech * pd; ctx.stroke();
    if (tete <= 1) halo(b.x, b.y, 26 * ech * pd, 1);
  }

  // ---------- Maintien du clic : même durée et mêmes mots qu'avant ----------
  var DUREE = 9, MOTS_DEBUT = [0.45, 2.3, 4.3, 7.0], PAS = 0.022, APPARITION = 0.08, CLIGNE = 0.03, ATTENTE = 0.6;
  function melange(n) { var t = []; for (var i = 0; i < n; i++) t.push(i); for (var j = n - 1; j > 0; j--) { var k = Math.floor(Math.random() * (j + 1)), x = t[j]; t[j] = t[k]; t[k] = x; } return t; }
  var mots = Array.prototype.map.call(document.querySelectorAll('.maintien-mot'), function (el) {
    var texte = el.textContent.trim(); el.textContent = '';
    return { lettres: Array.prototype.map.call(texte, function (c) { var s = document.createElement('span'); s.textContent = c; el.appendChild(s); return s; }), cles: [] };
  });
  function preparerMots() {
    mots.forEach(function (m, w) {
      var n = m.lettres.length, s = MOTS_DEBUT[w], A = s + (n - 1) * PAS + APPARITION, A2 = A + (n - 1) * PAS + CLIGNE, X = A2 + (n - 1) * PAS + CLIGNE + ATTENTE;
      var o1 = melange(n), o2 = melange(n), o3 = melange(n);
      m.cles = m.lettres.map(function (_, i) {
        return [[s + i * PAS, 0], [s + i * PAS + APPARITION, 1], [A + o1[i] * PAS, 1], [A + o1[i] * PAS + CLIGNE, 0.12], [A2 + o2[i] * PAS, 0.12], [A2 + o2[i] * PAS + CLIGNE, 1], [X + o3[i] * PAS, 1], [X + o3[i] * PAS + CLIGNE, 0]];
      });
    });
  }
  function valeur(c, t) {
    if (t <= c[0][0]) return 0;
    for (var i = 1; i < c.length; i++) if (t <= c[i][0]) return c[i - 1][1] + (c[i][1] - c[i - 1][1]) * ((t - c[i - 1][0]) / Math.max(c[i][0] - c[i - 1][0], 1e-4));
    return c[c.length - 1][1];
  }
  function dessinerMots(t) { mots.forEach(function (m) { m.lettres.forEach(function (l, i) { l.style.opacity = t < 0 ? 0 : valeur(m.cles[i], t).toFixed(3); }); }); }
  function lisse(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function mix(a, b, k) { return a + (b - a) * k; }

  var curseur = document.querySelector('.curseur-maintien');
  var progres = curseur && curseur.querySelector('.progres');
  var CIRCONF = progres ? 2 * Math.PI * progres.r.baseVal.value : 0;
  if (progres) progres.style.strokeDasharray = CIRCONF;
  var INTERACTIF = 'a, button, [role="button"], input, select, textarea, label';
  var souris = { px: 0, py: 0, kx: 0, ky: 0, bouge: false };
  var tenu = false, tM = 0, orange = 0;
  var cam = { fx: 0, fy: 0 };

  addEventListener('pointermove', function (e) {
    souris.px = e.clientX; souris.py = e.clientY;
    if (!souris.bouge) { souris.kx = e.clientX; souris.ky = e.clientY; souris.bouge = true; }
  }, { passive: true });
  zone.addEventListener('pointerover', function (e) { if (curseur) { curseur.classList.add('visible'); curseur.classList.toggle('cache', !tenu && !!e.target.closest(INTERACTIF)); } });
  zone.addEventListener('pointerdown', function (e) {
    if (calme || e.button !== 0 || !e.isPrimary || e.target.closest(INTERACTIF)) return;
    e.preventDefault();
    commencer();
  });
  addEventListener('pointerup', function () { if (tenu) finir(); });
  addEventListener('pointercancel', function () { if (tenu) finir(); });
  addEventListener('blur', function () { if (tenu) finir(); });
  zone.addEventListener('pointerleave', function () { if (tenu) finir(); if (curseur) curseur.classList.remove('visible'); });

  function commencer() {
    if (scrollY > innerHeight * 0.5) return;
    tenu = true; tM = 0;
    neons[0].s = 0.02;   // le néon de tête part du bord : la caméra le suit à travers la ville
    preparerMots();
    racine.classList.add('maintien-actif');
    if (curseur) { curseur.classList.add('appuye'); curseur.classList.remove('cache'); }
    reveiller();
  }
  function finir() {
    tenu = false;
    racine.classList.remove('maintien-actif');
    if (curseur) curseur.classList.remove('appuye');
    dessinerMots(-1);
  }

  // ---------- Mouvement ----------
  // Chaque ruban se décolle de la ville (la tête d'abord) et monte en bande vers le ciel ;
  // un par un, ils se resserrent en un seul rayon, qui s'allonge jusqu'à la Lune.
  var BAS = 0.93, HAUT = 0.5;   // la colonne de lumière, en fraction du ciel
  function animer(dt) {
    var t = tenu ? Math.min(tM, DUREE) : 0;
    var vitesse = 1 + (tenu ? 1.6 * lisse(0, 2.5, t) : 0);
    var rayon = lisse(7.3, 8.4, t);
    var yb = CIEL + H * 0.5, yt = mix(CIEL * HAUT, M.y + M.r * 0.85, rayon);
    var nb = 0, N = neons.length;
    neons.forEach(function (n, i) {
      n.s += n.v * vitesse * dt;
      if (n.s > 1.35) n.s -= 1.35;
      // tous ensemble : ils décollent au même moment, certains plus vite que d'autres
      var hasard = ((i * 37) % 10) / 10, vite = 1.7 + ((i * 53) % 10) / 10;
      var cible = tenu ? lisse(3.2 + hasard * 0.35, 3.2 + vite, t) : 0;
      n.p += (cible - n.p) * Math.min(1, dt * (tenu ? 5 : 1.6));
      // puis ils s'entremêlent et se fondent en un seul grand rayon
      var serre = tenu ? lisse(5.3 + hasard * 0.4, 6.9, t) : 0;
      if (serre > 0.95) nb++;
      var ecart = (i - (N - 1) / 2) * 22 * ech * (1 - serre) * Math.sin(tM * 2.2 + i * 1.7);
      for (var k = 0; k < n.pts.length; k++) {
        var f = k / (n.pts.length - 1), a = n.pts[k];
        var w = Math.max(0, Math.min(1, n.p * 1.6 - (1 - f) * 0.6));
        w = w * w * (3 - 2 * w);
        var cx = G.x + ecart + Math.sin(f * 7 + i * 2.1 + tM * 3) * 18 * ech * (1 - serre), cy = yb - f * (yb - yt);
        n.vu[k] = { x: mix(a.x, cx, w), y: mix(a.y, cy, w), d: mix(a.d, 1, w) };
      }
    });
    return nb;
  }

  function dessiner(t, rassembles) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, LARGE, CIEL + BOITE);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // les rubans : une lueur large, un corps orange, un cœur presque blanc (comme l'image d'inspiration)
    neons.forEach(function (n) {
      traitProf(n.vu, 30 * ech, n.couleur, 0.09);
      traitProf(n.vu, 9 * ech, n.couleur, 0.38);
      traitProf(n.vu, 2.8 * ech, [255, 200, 155], 0.9);
      impulsion(n, n.s, 0.28);
    });
    if (tenu) {
      var force = rassembles / neons.length;
      var rayon = lisse(7.3, 8.4, t);
      if (rayon > 0) {
        var yt = mix(CIEL * HAUT, M.y + M.r * 0.85, rayon);
        var g = ctx.createLinearGradient(G.x, CIEL + H * 0.5, G.x, yt);
        g.addColorStop(0, 'rgba(252,79,0,.2)');
        g.addColorStop(1, 'rgba(255,214,180,.95)');
        ctx.strokeStyle = g;
        ctx.beginPath(); ctx.moveTo(G.x, CIEL + H * 0.5); ctx.lineTo(G.x, yt);
        ctx.lineWidth = 40 * ech; ctx.globalAlpha = 0.25 * force; ctx.stroke();
        ctx.lineWidth = 9 * ech; ctx.globalAlpha = 0.9 * force; ctx.stroke();
        ctx.globalAlpha = 1;
        halo(G.x, yt, (40 + 40 * rayon) * ech, force);
      }
      var eclat = lisse(8.3, 8.7, t) * (1 - lisse(8.7, 9.6, tM));
      if (eclat > 0.01) halo(M.x, M.y, M.r * 3.2, 0.6 * eclat);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // la caméra (sans zoom) : elle survole la ville en suivant le néon de tête, puis monte avec les rubans jusqu'à la Lune
  function filmer(t, dt) {
    var V = Math.min(H, innerHeight);   // la hauteur réellement visible
    var fx = LARGE / 2, fy = CIEL + V / 2;
    if (tenu) {
      var tete = point(neons[0], Math.min(1, neons[0].s));
      var suivi = lisse(0.2, 1.2, t) * (1 - lisse(3.2, 4.6, t));
      fx = mix(fx, tete.x, suivi); fy = mix(fy, tete.y - H * 0.1, suivi * 0.35);
      fy = mix(fy, CIEL * 0.8, lisse(3.8, 6.6, t));
      fy = mix(fy, M.y + V * 0.12, lisse(7.0, 8.5, t));
    }
    var k = Math.min(1, dt * (tenu ? 2.4 : 1.8));
    cam.fx += (fx - cam.fx) * k; cam.fy += (fy - cam.fy) * k;
    var tx = MARGE + L / 2 - cam.fx, ty = V / 2 + CIEL - cam.fy;
    tx = Math.min(MARGE, Math.max(-MARGE, tx));
    ty = Math.min(CIEL, Math.max(H - BOITE, ty));
    camera.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,0)';
  }

  // ---------- Boucle ----------
  var visible = true, avant = 0, enMarche = false;
  function reveiller() { if (enMarche || calme) return; enMarche = true; avant = performance.now(); requestAnimationFrame(boucle); }
  function boucle(now) {
    if ((!visible && !tenu) || document.hidden) { enMarche = false; return; }
    requestAnimationFrame(boucle);
    var dt = Math.min(0.05, (now - avant) / 1000); avant = now;
    if (tenu) tM += dt;
    var t = Math.min(tM, DUREE);
    souris.kx += (souris.px - souris.kx) * 0.2; souris.ky += (souris.py - souris.ky) * 0.2;
    if (curseur) curseur.style.transform = 'translate(' + souris.kx + 'px,' + souris.ky + 'px)';
    if (progres) progres.style.strokeDashoffset = tenu ? CIRCONF * (1 - t / DUREE) : CIRCONF;
    var nb = animer(dt);
    filmer(t, dt);
    dessiner(t, nb);
    orange += ((tenu ? lisse(8.3, 8.8, t) : 0) - orange) * Math.min(1, dt * (tenu ? 6 : 1.2));
    if (lune && lune.qamarLune) lune.qamarLune.orange(orange);
    if (tenu) dessinerMots(tM);
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) reveiller(); }).observe(ville);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) reveiller(); });
  var minuteur;
  addEventListener('resize', function () { clearTimeout(minuteur); minuteur = setTimeout(function () { mesurer(); if (calme) dessiner(0, 0); }, 120); });

  var pret = false;
  function demarrer() {
    if (pret) return;
    pret = true;
    mesurer();
    cam.fx = LARGE / 2; cam.fy = CIEL + Math.min(H, innerHeight) / 2;
    filmer(0, 1);
    if (calme) dessiner(0, 0); else reveiller();
    racine.classList.add('rubans-prets');
  }
  var photo = cadre.querySelector('img');
  if (photo && !photo.complete) { photo.addEventListener('load', demarrer, { once: true }); setTimeout(demarrer, 1500); }
  else demarrer();

  if (new URLSearchParams(location.search).has('reglage')) {
    window.qamarInstant = function (t) { if (!tenu) commencer(); tM = t; };
    window.qamarRelacher = finir;
  }
})();
