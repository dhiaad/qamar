/* Qamar — galerie « Nos expériences » : chaque concept est un lien vers son expérience ;
   le survol (ou le focus clavier) montre un aperçu vivant, le clic lance le travelling d'entrée. */
(function () {
  var Q = window.Qexp;
  var EXP = Q.EXPERIENCES;
  var scene = document.querySelector('.showroom-scene');
  if (!scene) return;
  var onglets = Array.prototype.slice.call(document.querySelectorAll('.showroom-onglet'));
  var infos = document.querySelector('.showroom-infos');
  var entrer = document.querySelector('.showroom-entrer');
  var actif = -1;
  var minuteurs = [];

  function etoiles() {
    var s = '';
    for (var i = 0; i < 50; i++) {
      s += '<span style="left:' + ((i * 37) % 100) + '%;top:' + ((i * 53) % 60) + '%;opacity:' + (0.3 + ((i * 7) % 10) / 15).toFixed(2) + '"></span>';
    }
    return s;
  }

  function apercu(slug) {
    var d = document.createElement('div');
    d.className = 'apercu apercu-' + slug;
    if (slug === 'immersif') {
      d.innerHTML = '<div class="ap-etoiles">' + etoiles() + '</div><div class="ap-terre"></div>' +
        '<svg class="ap-reliefs" viewBox="0 0 800 260" preserveAspectRatio="none" aria-hidden="true">' +
        '<path class="r1" d="' + Q.RELIEFS.loin + '"/><path class="r2" d="' + Q.RELIEFS.milieu + '"/><path class="r3" d="' + Q.RELIEFS.pres + '"/></svg>' +
        '<div class="ap-ombre"></div><p class="ap-titre">Mare Tranquillitatis</p>';
    } else if (slug === 'premium') {
      d.innerHTML = '<div class="ap-filet"></div>' +
        '<svg class="ap-bague" viewBox="0 0 200 200" aria-hidden="true"><defs>' +
        '<linearGradient id="apOr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe7a6"/><stop offset=".45" stop-color="#c99a3c"/><stop offset=".7" stop-color="#fff1c7"/><stop offset="1" stop-color="#8a6420"/></linearGradient>' +
        '<linearGradient id="apGemme" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#d9e2ea"/><stop offset="1" stop-color="#9fb0c0"/></linearGradient></defs>' +
        '<ellipse cx="100" cy="120" rx="58" ry="64" fill="none" stroke="url(#apOr)" stroke-width="11"/>' +
        '<path d="M100 30 L122 52 L100 74 L78 52 Z" fill="url(#apGemme)" stroke="#fff" stroke-width="1"/>' +
        '<path d="M78 52 H122 M100 30 V74" stroke="#fff" stroke-opacity=".7" stroke-width=".8"/></svg>' +
        '<p class="ap-marque">Maison Aurane</p><p class="ap-titre">La lumière, taillée pour durer.</p>';
    } else if (slug === 'evenementiel') {
      d.innerHTML = '<div class="ap-cone"></div><p class="ap-defile">NOCTURNE · NOCTURNE · NOCTURNE · NOCTURNE ·</p>' +
        '<div class="ap-bas"><div class="ap-compte">' +
        ['j', 'h', 'min', 's'].map(function (u) { return '<div><b data-u="' + u + '">00</b><span>' + u + '</span></div>'; }).join('') +
        '</div><p class="ap-fictif">Festival fictif</p></div>';
      var cible = Q.dateEvenement();
      var maj = function () {
        var s = Math.max(0, Math.floor((cible - Date.now()) / 1000));
        var v = { j: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), min: Math.floor((s % 3600) / 60), s: s % 60 };
        d.querySelectorAll('b[data-u]').forEach(function (b) { b.textContent = String(v[b.getAttribute('data-u')]).padStart(2, '0'); });
      };
      maj();
      minuteurs.push(setInterval(maj, 1000));
    } else if (slug === 'e-commerce') {
      var objets = [['vase', '#B9A27F'], ['bougie', '#3F4B5E'], ['flacon', '#C8B79A']];
      d.innerHTML = '<p class="ap-marque">Atelier Séléné</p><p class="ap-panier">Panier · 2</p><div class="ap-grille">' +
        objets.map(function (o, i) {
          return '<div class="ap-objet" style="--i:' + i + '">' + Q.artProduit(o[0], o[1]) + '<p><span>Objet n°' + (i + 1) + '</span><span>—</span></p></div>';
        }).join('') + '</div>';
    } else {
      d.innerHTML = '<div class="ap-tourne"></div><div class="ap-halo"></div><p class="ap-marque">Maison Halo</p>' +
        '<p class="ap-titre">Une galerie <i>vivante</i>.</p>';
    }
    return d;
  }

  function choisir(i, sansAnim) {
    if (i === actif) return;
    actif = i;
    var e = EXP[i];
    onglets.forEach(function (o, k) { o.classList.toggle('est-actif', k === i); });

    // nouvel aperçu révélé en cercle par-dessus l'ancien
    var vieux = scene.querySelectorAll('.apercu');
    var neuf = apercu(e.slug);
    if (!sansAnim) neuf.classList.add('entre');
    scene.insertBefore(neuf, scene.querySelector('.showroom-badge'));
    vieux.forEach(function (v) {
      v.classList.add('sort');
      setTimeout(function () { v.remove(); }, sansAnim ? 0 : 900);
    });
    if (minuteurs.length > 1) clearInterval(minuteurs.shift());

    infos.classList.remove('montre');
    void infos.offsetWidth;
    infos.querySelector('h3').textContent = e.title;
    infos.querySelector('p').textContent = e.summary;
    infos.querySelector('ul').innerHTML = e.skills.map(function (s) { return '<li>' + s + '</li>'; }).join('');
    infos.classList.add('montre');
    entrer.setAttribute('href', Q.lien(e.slug));
  }

  onglets.forEach(function (o, i) {
    o.addEventListener('click', function (ev) { choisir(i, true); travelling(ev); });
    o.addEventListener('focus', function () { choisir(i); });
    o.addEventListener('mouseenter', function () { if (window.matchMedia('(hover: hover)').matches) choisir(i); });
    o.addEventListener('keydown', function (ev) {
      var k = ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowUp' ? -1 : 0;
      if (!k) return;
      ev.preventDefault();
      onglets[(i + k + onglets.length) % onglets.length].focus();
    });
  });

  // parallaxe au pointeur
  scene.addEventListener('pointermove', function (ev) {
    var r = scene.getBoundingClientRect();
    scene.style.setProperty('--px', ((ev.clientX - r.left) / r.width - 0.5).toFixed(3));
    scene.style.setProperty('--py', ((ev.clientY - r.top) / r.height - 0.5).toFixed(3));
  });
  scene.addEventListener('pointerleave', function () {
    scene.style.setProperty('--px', 0);
    scene.style.setProperty('--py', 0);
  });

  // travelling : la scène s'agrandit jusqu'à remplir l'écran, puis on change de page
  function travelling(ev) {
    var e = EXP[actif];
    if (Q.reduit() || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button === 1) return;
    ev.preventDefault();
    var r = scene.getBoundingClientRect();
    var t = document.createElement('div');
    t.className = 'travelling';
    t.setAttribute('aria-hidden', 'true');
    t.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;background:' + e.ambient;
    var ap = apercu(e.slug);
    ap.classList.add('travelling-apercu');
    t.appendChild(ap);
    document.body.appendChild(t);
    void t.offsetWidth;
    t.classList.add('plein');
    setTimeout(function () { location.href = Q.lien(e.slug); }, 850);
  }
  entrer.addEventListener('click', travelling);
  scene.addEventListener('click', function (ev) {
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey) { window.open(Q.lien(EXP[actif].slug), '_blank'); return; }
    travelling(ev);
    if (Q.reduit()) location.href = Q.lien(EXP[actif].slug);
  });
  // retour arrière (cache de page) : on retire le travelling resté affiché
  window.addEventListener('pageshow', function (ev) {
    if (ev.persisted) document.querySelectorAll('.travelling').forEach(function (t) { t.remove(); });
  });

  var depart = Math.max(0, EXP.findIndex(function (e) { return location.hash === '#' + e.slug; }));
  choisir(depart, true);
})();
