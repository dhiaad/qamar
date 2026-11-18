/* Qamar — concept 03 Événementiel : festival fictif « Nocturne ».
   Récit d'une nuit piloté par le défilement (Canvas 2D), compte à rebours, programme. */
(function () {
  var Q = window.Qexp;
  var reduit = Q.reduit();
  var cible = Q.dateEvenement();

  /* ---------- Date du hero ---------- */
  var dateEl = document.querySelector('[data-date-evt]');
  if (dateEl) dateEl.textContent = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(cible);

  /* ---------- Compte à rebours à volets ---------- */
  var chiffres = document.querySelectorAll('.evt-chiffre');
  function poser(el, valeur) {
    var v = String(valeur).padStart(2, '0');
    var cases = el.querySelectorAll('.evt-case');
    for (var i = 0; i < 2; i++) {
      var c = cases[i];
      var cour = c.querySelector('span:last-child');
      if (cour && cour.textContent === v[i]) continue;
      var neuf = document.createElement('span');
      neuf.textContent = v[i];
      if (cour && !reduit) {
        neuf.className = 'entre';
        cour.className = 'sort';
        setTimeout(function (x) { return function () { x.remove(); }; }(cour), 650);
      } else if (cour) cour.remove();
      c.appendChild(neuf);
    }
  }
  function tic() {
    var s = Math.max(0, Math.floor((cible - Date.now()) / 1000));
    var v = [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
    chiffres.forEach(function (el, i) { poser(el, v[i]); });
  }
  tic();
  setInterval(tic, 1000);

  /* ---------- Programme à onglets ---------- */
  var jours = document.querySelectorAll('.evt-jour');
  var listes = document.querySelectorAll('.evt-liste');
  jours.forEach(function (b, i) {
    b.addEventListener('click', function () {
      jours.forEach(function (x, k) { x.setAttribute('aria-selected', k === i ? 'true' : 'false'); x.tabIndex = k === i ? 0 : -1; });
      listes.forEach(function (l, k) { l.hidden = k !== i; });
    });
    b.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      var n = jours[(i + d + jours.length) % jours.length];
      n.focus(); n.click();
    });
  });

  /* ---------- Réserver ---------- */
  var resa = document.querySelector('.evt-reserver');
  if (resa) resa.addEventListener('click', function () { document.querySelector('.evt-avis').hidden = false; });

  /* ---------- Récit de la nuit ---------- */
  var recit = document.querySelector('.evt-recit');
  var cv = recit && recit.querySelector('canvas');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var chapitres = recit.querySelectorAll('.evt-chapitre');
  var horloge = recit.querySelector('.evt-horloge');

  var CHAP = [[0, 0.17], [0.19, 0.38], [0.4, 0.57], [0.59, 0.74], [0.76, 0.9], [0.92, 1]];
  var CIEL = [
    { p: 0, haut: [46, 28, 72], bas: [255, 142, 84] },
    { p: 0.16, haut: [22, 14, 44], bas: [120, 52, 92] },
    { p: 0.32, haut: [7, 6, 18], bas: [30, 18, 56] },
    { p: 0.88, haut: [6, 5, 16], bas: [24, 14, 46] },
    { p: 1, haut: [52, 60, 112], bas: [250, 186, 140] }
  ];
  var HEURES = [[0, 1140], [0.19, 1230], [0.4, 1320], [0.59, 1410], [0.76, 1440], [0.92, 1812], [1, 1812]];

  function melange(a, b, t) { return a + (b - a) * t; }
  function borne(v) { return Math.max(0, Math.min(1, v)); }
  function plage(p, a, b, bord) { bord = bord || 0.04; return borne(Math.min((p - a) / bord, (b - p) / bord)); }
  function cielA(p) {
    var i = 0;
    while (i < CIEL.length - 2 && p > CIEL[i + 1].p) i++;
    var a = CIEL[i], b = CIEL[i + 1], t = borne((p - a.p) / (b.p - a.p));
    function c(k) { return a[k].map(function (v, j) { return Math.round(melange(v, b[k][j], t)); }); }
    return { haut: c('haut'), bas: c('bas') };
  }
  function heureA(p) {
    var i = 0;
    while (i < HEURES.length - 2 && p > HEURES[i + 1][0]) i++;
    var a = HEURES[i], b = HEURES[i + 1];
    var m = Math.round(a[1] + (b[1] - a[1]) * borne((p - a[0]) / (b[0] - a[0])));
    return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }
  function alea(g) { return function () { g = (g * 16807) % 2147483647; return (g - 1) / 2147483646; }; }

  var R = alea(11);
  var immeubles = [];
  for (var i = 0; i < 34; i++) {
    var fen = [];
    for (var k = 0; k < 24; k++) fen.push(R());
    immeubles.push({ x: i / 34, w: 0.02 + R() * 0.035, h: 0.07 + Math.pow(R(), 1.6) * 0.22, fen: fen });
  }
  var etoiles = [];
  for (i = 0; i < 220; i++) etoiles.push({ x: R(), y: R() * 0.7, s: R() * 1.4 + 0.3, t: R() * 6 });

  var M = { lanternes: [], etincelles: [], fusees: [], dernierAuto: 0, derniereLanterne: 0 };
  var w = 0, h = 0, dpr = 1, visible = true, dernier = performance.now();

  function taille() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = cv.clientWidth; h = cv.clientHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  }
  taille();
  window.addEventListener('resize', taille);
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(recit);

  function progression() {
    var r = recit.getBoundingClientRect();
    return borne(-r.top / Math.max(1, r.height - window.innerHeight));
  }

  function dessiner(maintenant) {
    requestAnimationFrame(dessiner);
    if (!visible) { dernier = maintenant; return; }
    var dt = Math.min(0.05, (maintenant - dernier) / 1000);
    dernier = maintenant;
    var t = maintenant / 1000;
    var p = progression();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // chapitres et horloge
    chapitres.forEach(function (c, n) {
      var a = CHAP[n][0], b = CHAP[n][1];
      var o = n === 0 ? (p < b - 0.03 ? 1 : borne((b - p) / 0.03)) : Math.min(borne((p - a) / 0.03), borne((b - p) / 0.03));
      if (n === CHAP.length - 1 && p >= 0.999) o = 1;
      c.style.opacity = o.toFixed(3);
      c.style.transform = 'translateY(' + (40 - 80 * borne((p - a) / (b - a))).toFixed(1) + 'px)';
      c.style.visibility = o > 0.01 ? 'visible' : 'hidden';
    });
    horloge.textContent = heureA(p);

    // ciel
    var ciel = cielA(p);
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgb(' + ciel.haut + ')');
    g.addColorStop(1, 'rgb(' + ciel.bas + ')');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // soleil couchant puis levant
    var coucher = borne(p / 0.16);
    if (coucher < 1 || p > 0.93) {
      var lever = borne((p - 0.93) / 0.07);
      var sy = p > 0.93 ? h * (0.95 - lever * 0.2) : h * (0.62 + coucher * 0.4);
      var sg = ctx.createRadialGradient(w * 0.68, sy, 0, w * 0.68, sy, h * 0.4);
      sg.addColorStop(0, 'rgba(255,214,150,0.95)');
      sg.addColorStop(0.08, 'rgba(255,170,90,0.55)');
      sg.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, w, h);
    }

    // étoiles
    var nuit = borne((p - 0.12) / 0.15) * (1 - borne((p - 0.93) / 0.06));
    if (nuit > 0) {
      etoiles.forEach(function (s) {
        var sc = reduit ? 1 : 0.6 + Math.sin(t * 2 + s.t) * 0.4;
        ctx.fillStyle = 'rgba(255,255,255,' + (nuit * sc * 0.85) + ')';
        ctx.fillRect(s.x * w, s.y * h, s.s, s.s);
      });
    }

    // faisceaux du dôme
    var faisceaux = plage(p, 0.4, 0.6, 0.05);
    if (faisceaux > 0) {
      ctx.globalCompositeOperation = 'lighter';
      for (var n = 0; n < 6; n++) {
        var ang = -Math.PI / 2 + Math.sin(t * (reduit ? 0 : 0.6) + n * 1.3) * 0.55;
        var ox = w * (0.5 + (n - 2.5) * 0.03), oy = h * 0.86, lg = h * 1.1, ec = 0.05;
        var bg = ctx.createLinearGradient(ox, oy, ox + Math.cos(ang) * lg, oy + Math.sin(ang) * lg);
        var teinte = n % 2 ? '255,179,71' : '190,120,255';
        bg.addColorStop(0, 'rgba(' + teinte + ',' + (0.35 * faisceaux) + ')');
        bg.addColorStop(1, 'rgba(' + teinte + ',0)');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(ang - ec) * lg, oy + Math.sin(ang - ec) * lg);
        ctx.lineTo(ox + Math.cos(ang + ec) * lg, oy + Math.sin(ang + ec) * lg);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // ville
    var allume = borne((p - 0.12) / 0.2) * (1 - borne((p - 0.95) / 0.05));
    var sol = h * 0.86;
    ctx.fillStyle = 'rgb(' + Math.round(melange(40, 8, nuit)) + ',' + Math.round(melange(22, 6, nuit)) + ',' + Math.round(melange(40, 18, nuit)) + ')';
    immeubles.forEach(function (b) { ctx.fillRect(b.x * w, sol - b.h * h, b.w * w + 6, b.h * h + h); });
    ctx.beginPath();
    ctx.ellipse(w * 0.5, sol, w * 0.09, h * 0.09, 0, Math.PI, 0);
    ctx.fill();
    var fx = w * 0.3, fw = w * 0.12, fh = h * 0.3;
    ctx.fillRect(fx, sol - fh, fw, fh);
    if (allume > 0) {
      immeubles.forEach(function (b) {
        var rangs = Math.floor((b.h * h) / 14);
        for (var r = 0; r < rangs; r++) for (var c = 0; c < 3; c++) {
          var v = b.fen[(r * 3 + c) % b.fen.length];
          if (v > 0.55 + (1 - allume) * 0.45) {
            ctx.fillStyle = 'rgba(255,' + (190 + Math.round(v * 40)) + ',120,' + (0.75 * allume) + ')';
            ctx.fillRect(b.x * w + 3 + c * ((b.w * w) / 3), sol - b.h * h + 6 + r * 14, 3, 5);
          }
        }
      });
    }
    // projection sur la façade
    var proj = plage(p, 0.59, 0.75, 0.04);
    if (proj > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(fx, sol - fh, fw, fh);
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      for (n = 0; n < 9; n++) {
        var yy = sol - fh + ((t * (reduit ? 0 : 40) + n * (fh / 9)) % fh);
        ctx.fillStyle = 'hsla(' + ((n * 40 + t * 30) % 360) + ',90%,60%,' + (0.28 * proj) + ')';
        ctx.fillRect(fx, yy, fw, fh / 18);
      }
      ctx.fillStyle = 'rgba(255,236,200,' + (0.9 * proj) + ')';
      ctx.font = '600 ' + Math.round(fw / 5.4) + 'px Geist, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NOCTURNE', fx + fw / 2, sol - fh / 2);
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      var pg = ctx.createRadialGradient(fx + fw / 2, sol - fh / 2, 0, fx + fw / 2, sol - fh / 2, fw);
      pg.addColorStop(0, 'rgba(255,200,140,' + (0.18 * proj) + ')');
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pg;
      ctx.fillRect(fx - fw, sol - fh * 1.5, fw * 3, fh * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = '#07050c';
    ctx.fillRect(0, sol, w, h - sol);

    // lanternes
    if (plage(p, 0.19, 0.4, 0.03) > 0 && !reduit && t - M.derniereLanterne > 0.35 && M.lanternes.length < 90) {
      M.derniereLanterne = t;
      M.lanternes.push({ x: Math.random() * w, y: sol, vy: 22 + Math.random() * 26, sway: 6 + Math.random() * 10, phase: Math.random() * 6, s: 0.6 + Math.random() * 0.8, vie: 1 });
    }
    ctx.globalCompositeOperation = 'lighter';
    M.lanternes.forEach(function (L) {
      L.y -= L.vy * dt;
      L.vie -= dt * 0.05;
      var lx = L.x + Math.sin(t * 0.8 + L.phase) * L.sway;
      var a = borne(L.vie) * borne(L.y / (h * 0.15));
      var gr = ctx.createRadialGradient(lx, L.y, 0, lx, L.y, 22 * L.s);
      gr.addColorStop(0, 'rgba(255,190,110,' + (0.9 * a) + ')');
      gr.addColorStop(0.25, 'rgba(255,140,60,' + (0.45 * a) + ')');
      gr.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(lx - 24 * L.s, L.y - 24 * L.s, 48 * L.s, 48 * L.s);
      ctx.fillStyle = 'rgba(255,214,160,' + a + ')';
      ctx.fillRect(lx - 3 * L.s, L.y - 4 * L.s, 6 * L.s, 8 * L.s);
    });
    M.lanternes = M.lanternes.filter(function (L) { return L.vie > 0 && L.y > -40; });

    // feu d'artifice
    if (plage(p, 0.76, 0.92, 0.03) > 0 && !reduit && t - M.dernierAuto > 0.75) {
      M.dernierAuto = t;
      M.fusees.push({ x: w * (0.2 + Math.random() * 0.6), y: sol, vy: -(h * 0.75), ty: h * (0.15 + Math.random() * 0.3), teinte: Math.random() * 360 });
    }
    M.fusees.forEach(function (f) {
      f.y += f.vy * dt;
      f.vy *= 0.985;
      ctx.fillStyle = 'hsla(' + f.teinte + ',100%,80%,0.9)';
      ctx.fillRect(f.x - 1, f.y, 2, 8);
      if (f.y <= f.ty) {
        for (var k = 0; k < 70; k++) {
          var an = (k / 70) * Math.PI * 2;
          var v = (60 + Math.random() * 120) * (w < 700 ? 0.7 : 1);
          M.etincelles.push({ x: f.x, y: f.y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, vie: 1, teinte: f.teinte + Math.random() * 30 });
        }
        f.y = -9999;
      }
    });
    M.fusees = M.fusees.filter(function (f) { return f.y > -9000; });
    M.etincelles.forEach(function (s) {
      s.vy += 90 * dt; s.vx *= 0.985; s.vy *= 0.985;
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.vie -= dt * 0.55;
      ctx.fillStyle = 'hsla(' + s.teinte + ',100%,' + (60 + s.vie * 25) + '%,' + borne(s.vie) + ')';
      ctx.fillRect(s.x, s.y, 2.2, 2.2);
    });
    M.etincelles = M.etincelles.filter(function (s) { return s.vie > 0; });
    ctx.globalCompositeOperation = 'source-over';
  }
  requestAnimationFrame(dessiner);

  // toucher le ciel : une lanterne, ou une fusée à partir de minuit
  cv.addEventListener('pointerdown', function (e) {
    var r = cv.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    if (progression() > 0.7) M.fusees.push({ x: x, y: r.height * 0.86, vy: -(r.height * 0.8), ty: Math.min(y, r.height * 0.7), teinte: Math.random() * 360 });
    else M.lanternes.push({ x: x, y: Math.max(y, r.height * 0.5), vy: 26, sway: 8, phase: 0, s: 1.2, vie: 1 });
  });
})();
