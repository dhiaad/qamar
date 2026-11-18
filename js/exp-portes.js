/* Qamar — page « Explorer » : cinq portes (quatre sur mobile), cinq expériences.
   Chaque porte est le lien. Derrière le battant, un aperçu vivant de l'univers ;
   au survol la porte s'entrouvre et la lumière passe, au clic elle s'ouvre en grand
   et l'on traverse jusqu'à l'expérience. */
(function () {
  var Q = window.Qexp;
  var portes = Array.prototype.slice.call(document.querySelectorAll('.porte'));
  if (!Q || !portes.length) return;
  var minuteurs = [];

  function etoiles() {
    var s = '';
    for (var i = 0; i < 40; i++) {
      s += '<span style="left:' + ((i * 37) % 100) + '%;top:' + ((i * 53) % 60) + '%;opacity:' + (0.3 + ((i * 7) % 10) / 15).toFixed(2) + '"></span>';
    }
    return s;
  }

  // l'aperçu de chaque univers (mêmes visuels que l'ancienne galerie)
  function apercu(slug) {
    var d = document.createElement('div');
    d.className = 'apercu apercu-' + slug;
    if (slug === 'immersif') {
      d.innerHTML = '<div class="ap-etoiles">' + etoiles() + '</div><div class="ap-terre"></div>' +
        '<svg class="ap-reliefs" viewBox="0 0 800 260" preserveAspectRatio="none" aria-hidden="true">' +
        '<path class="r1" d="' + Q.RELIEFS.loin + '"/><path class="r2" d="' + Q.RELIEFS.milieu + '"/><path class="r3" d="' + Q.RELIEFS.pres + '"/></svg>' +
        '<div class="ap-ombre"></div>';
    } else if (slug === 'premium') {
      var id = 'apOr' + Math.random().toString(36).slice(2, 7);
      d.innerHTML = '<div class="ap-filet"></div>' +
        '<svg class="ap-bague" viewBox="0 0 200 200" aria-hidden="true"><defs>' +
        '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe7a6"/><stop offset=".45" stop-color="#c99a3c"/><stop offset=".7" stop-color="#fff1c7"/><stop offset="1" stop-color="#8a6420"/></linearGradient>' +
        '<linearGradient id="g' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#d9e2ea"/><stop offset="1" stop-color="#9fb0c0"/></linearGradient></defs>' +
        '<ellipse cx="100" cy="120" rx="58" ry="64" fill="none" stroke="url(#' + id + ')" stroke-width="11"/>' +
        '<path d="M100 30 L122 52 L100 74 L78 52 Z" fill="url(#g' + id + ')" stroke="#fff" stroke-width="1"/>' +
        '<path d="M78 52 H122 M100 30 V74" stroke="#fff" stroke-opacity=".7" stroke-width=".8"/></svg>' +
        '<p class="ap-marque">Maison Aurane</p>';
    } else if (slug === 'evenementiel') {
      d.innerHTML = '<div class="ap-cone"></div><p class="ap-defile">NOCTURNE · NOCTURNE · NOCTURNE · NOCTURNE ·</p>' +
        '<div class="ap-bas"><div class="ap-compte">' +
        ['j', 'h', 'min', 's'].map(function (u) { return '<div><b data-u="' + u + '">00</b><span>' + u + '</span></div>'; }).join('') +
        '</div></div>';
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
      d.innerHTML = '<p class="ap-marque">Atelier Séléné</p><div class="ap-grille">' +
        objets.map(function (o, i) {
          return '<div class="ap-objet" style="--i:' + i + '">' + Q.artProduit(o[0], o[1]) + '</div>';
        }).join('') + '</div>';
    } else if (slug === 'sur-mesure') {
      d.innerHTML = '<div class="ap-tourne"></div><div class="ap-halo"></div><p class="ap-marque">Maison Halo</p>';
    }
    return d;
  }

  var survol = window.matchMedia('(hover: hover)').matches;

  portes.forEach(function (porte) {
    var slug = porte.getAttribute('data-slug');
    var salle = porte.querySelector('.porte-salle');
    salle.appendChild(apercu(slug));

    // profondeur : la porte suit légèrement le pointeur
    if (survol) {
      porte.addEventListener('pointermove', function (ev) {
        var r = porte.getBoundingClientRect();
        porte.style.setProperty('--px', ((ev.clientX - r.left) / r.width - 0.5).toFixed(3));
        porte.style.setProperty('--py', ((ev.clientY - r.top) / r.height - 0.5).toFixed(3));
      });
      porte.addEventListener('pointerleave', function () {
        porte.style.setProperty('--px', 0);
        porte.style.setProperty('--py', 0);
      });
    }

    porte.addEventListener('click', function (ev) { traverser(ev, porte, slug); });
  });

  // le clic : la porte s'ouvre en grand, puis la pièce derrière remplit l'écran
  var enCours = false;
  function traverser(ev, porte, slug) {
    if (Q.reduit() || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button === 1) return;
    ev.preventDefault();
    if (enCours) return;
    enCours = true;
    var e = Q.EXPERIENCES.filter(function (x) { return x.slug === slug; })[0];
    porte.classList.add('ouverte');
    document.documentElement.classList.add('portes-traversee');
    setTimeout(function () {
      var r = porte.querySelector('.porte-salle').getBoundingClientRect();
      var t = document.createElement('div');
      t.className = 'travelling';
      t.setAttribute('aria-hidden', 'true');
      t.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;border-radius:6px;background:' + (e ? e.ambient : '#000');
      var ap = apercu(slug);
      ap.classList.add('travelling-apercu');
      t.appendChild(ap);
      document.body.appendChild(t);
      void t.offsetWidth;
      t.classList.add('plein');
      setTimeout(function () { location.href = Q.lien(slug); }, 820);
    }, 520);
  }

  // retour arrière (cache de page) : on referme tout
  window.addEventListener('pageshow', function (ev) {
    if (!ev.persisted) return;
    enCours = false;
    document.querySelectorAll('.travelling').forEach(function (t) { t.remove(); });
    portes.forEach(function (p) { p.classList.remove('ouverte'); });
    document.documentElement.classList.remove('portes-traversee');
  });

  // en revenant d'une expérience (experiences.html#premium), la porte quittée est mise en avant
  var h = location.hash.slice(1);
  var vise = portes.filter(function (p) { return p.id === h; })[0];
  if (vise) {
    vise.classList.add('revenue');
    setTimeout(function () { vise.classList.remove('revenue'); }, 2600);
  }
})();
