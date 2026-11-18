/* Qamar — « Explorer » : données des cinq concepts (le 5e, sur-mesure, seulement sur ordinateur) et cadre commun des pages d'expérience.
   Script classique (sans module), chargé avant les scènes : il expose window.Qexp. */
(function () {
  var EXPERIENCES = [
    { slug: 'immersif', index: '01', label: 'Immersif', title: "Entrez dans l'expérience.",
      summary: "Une marche sur la Lune en 3D : gravité réelle, cratères, empreintes et la Terre au-dessus de l'horizon.",
      skills: ['Monde 3D explorable', 'Physique lunaire', 'Récit en étapes'], ambient: '#000000', clair: false },
    { slug: 'premium', index: '02', label: 'Premium', title: "L'élégance dans chaque détail.",
      summary: 'Or jaune, argent et blanc cassé : une maison de joaillerie fictive, ses bijoux en 3D et son atelier.',
      skills: ['Bijoux en 3D', 'Vitrine interactive', 'Lumière et matière'], ambient: '#f4f0e8', clair: true },
    { slug: 'evenementiel', index: '03', label: 'Événementiel', title: 'Faites vivre votre événement.',
      summary: "Une énergie visuelle, un compte à rebours vivant et un programme qui donne envie d'y être.",
      skills: ['Typographie expressive', 'Compte à rebours', 'Programme interactif'], ambient: '#0d0712', clair: false },
    { slug: 'e-commerce', index: '04', label: 'E-commerce', title: "Transformez la découverte en achat.",
      summary: "Des produits mis en scène, des fiches qui donnent envie et un panier fluide jusqu'au dernier clic.",
      skills: ['Fiches produits', 'Panier interactif', 'Micro-interactions'], ambient: '#efe9df', clair: true },
    // la galerie d'art générative se pilote à la souris : sa porte n'apparaît que sur ordinateur
    { slug: 'sur-mesure', index: '05', label: 'Sur-mesure', title: 'Votre univers, sans limites.',
      summary: "Couleurs, formes, rythme, typographie : l'expérience se recompose selon l'identité de chaque marque.",
      skills: ['Direction artistique', 'Génératif', 'Identité modulable'], ambient: '#0a0b14', clair: false }
  ];

  function lien(slug) { return 'experience-' + slug + '.html'; }

  function reduit() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function webgl() {
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  }

  /* 3D complète, 3D allégée, ou image fixe sans WebGL */
  function modeScene(sousLargeur) {
    if (!webgl()) return 'photo';
    var faible = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
      (navigator.deviceMemory && navigator.deviceMemory <= 4);
    return faible || window.innerWidth < (sousLargeur || 820) ? 'low' : 'high';
  }

  /* Date fictive du festival : toujours 42 jours plus tard, à 21 h */
  function dateEvenement() {
    var d = new Date();
    d.setDate(d.getDate() + 42);
    d.setHours(21, 0, 0, 0);
    return d.getTime();
  }

  function euro(n) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  }

  /* Objets de la boutique fictive, dessinés en SVG */
  var nArt = 0;
  function artProduit(forme, couleur, accent) {
    accent = accent || '#C49A53';
    var id = 'pa' + (nArt++);
    var g = 'url(#' + id + ')';
    var corps = {
      bougie: '<rect x="34" y="58" width="52" height="68" rx="6" fill="' + g + '"/><rect x="34" y="58" width="52" height="10" rx="5" fill="#fff" opacity=".25"/><path d="M60 56 v-8" stroke="#2b2b2b" stroke-width="1.4"/><path d="M60 30 C66 38 64 46 60 48 C56 46 54 38 60 30 Z" fill="' + accent + '"><animate attributeName="d" dur="1.8s" repeatCount="indefinite" values="M60 30 C66 38 64 46 60 48 C56 46 54 38 60 30 Z;M61 28 C67 37 64 46 60 48 C56 46 55 37 61 28 Z;M60 30 C66 38 64 46 60 48 C56 46 54 38 60 30 Z"/></path><rect x="44" y="84" width="32" height="18" rx="2" fill="#fff" opacity=".18"/>',
      vase: '<path d="M50 22 h20 v10 c0 8 18 18 18 44 c0 26 -12 48 -28 48 c-16 0 -28 -22 -28 -48 c0 -26 18 -36 18 -44 z" fill="' + g + '"/>',
      flacon: '<rect x="52" y="20" width="16" height="16" rx="2" fill="' + accent + '"/><rect x="56" y="34" width="8" height="8" fill="' + accent + '" opacity=".7"/><rect x="32" y="42" width="56" height="84" rx="14" fill="' + g + '"/><rect x="40" y="50" width="6" height="66" rx="3" fill="#fff" opacity=".22"/><rect x="46" y="80" width="28" height="14" rx="1" fill="none" stroke="' + accent + '" stroke-width=".8"/>',
      bol: '<path d="M18 74 h84 c0 26 -18 50 -42 50 c-24 0 -42 -24 -42 -50 z" fill="' + g + '"/><ellipse cx="60" cy="74" rx="42" ry="8" fill="' + couleur + '"/><ellipse cx="60" cy="74" rx="38" ry="6" fill="#000" opacity=".25"/><path d="M26 86 c10 6 58 6 68 0" stroke="' + accent + '" stroke-width="1.2" fill="none"/>',
      lampe: '<circle cx="60" cy="60" r="34" fill="' + g + '"/><circle cx="60" cy="60" r="34" fill="#fff" opacity=".12"/><circle cx="48" cy="48" r="10" fill="#fff" opacity=".25"/><rect x="54" y="94" width="12" height="20" fill="' + accent + '"/><rect x="38" y="114" width="44" height="10" rx="5" fill="' + accent + '"/>',
      carafe: '<path d="M52 16 h16 v26 c14 8 22 24 22 44 c0 22 -12 38 -30 38 c-18 0 -30 -16 -30 -38 c0 -20 8 -36 22 -44 z" fill="' + g + '" opacity=".88"/><path d="M40 90 c6 4 34 4 40 0 v8 c-6 22 -34 22 -40 0 z" fill="' + accent + '" opacity=".45"/><rect x="50" y="10" width="20" height="8" rx="3" fill="' + accent + '"/>'
    }[forme];
    return '<svg viewBox="0 0 120 140" aria-hidden="true"><defs>' +
      '<linearGradient id="' + id + '" x1="0" x2="1"><stop offset="0" stop-color="' + couleur + '" stop-opacity=".75"/><stop offset=".35" stop-color="' + couleur + '"/><stop offset=".7" stop-color="' + couleur + '" stop-opacity=".9"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>' +
      '<radialGradient id="s' + id + '" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
      '</defs><ellipse cx="60" cy="128" rx="38" ry="6" fill="url(#s' + id + ')"/>' + corps + '</svg>';
  }

  var RELIEFS = {
    loin: 'M0 260 L0 190 C60 170 110 182 170 160 C230 140 260 168 330 150 C400 132 450 160 520 146 C590 132 640 150 700 140 C760 130 800 150 800 150 L800 260 Z',
    milieu: 'M0 260 L0 214 C70 196 120 220 200 200 C280 180 320 210 400 196 C480 182 540 214 620 198 C700 182 760 204 800 196 L800 260 Z',
    pres: 'M0 260 L0 236 C90 222 160 244 260 232 C360 220 420 246 520 234 C620 222 700 240 800 228 L800 260 Z'
  };

  /* Apparition au défilement (éléments .apparait) */
  function apparitions(racine) {
    var els = (racine || document).querySelectorAll('.apparait');
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('vu'); }); return; }
    var io = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('vu'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -12% 0px' });
    els.forEach(function (e) { io.observe(e); });
  }

  /* Cadre des pages d'expérience : raccourcis Alt+← / Alt+→ */
  function cadre() {
    var corps = document.body;
    var slug = corps.getAttribute('data-experience');
    if (!slug) return;
    var i = EXPERIENCES.findIndex(function (e) { return e.slug === slug; });
    var n = EXPERIENCES.length;
    var prec = EXPERIENCES[(i - 1 + n) % n], suiv = EXPERIENCES[(i + 1) % n];
    window.addEventListener('keydown', function (e) {
      if (!e.altKey || (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]'))) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); location.href = lien(suiv.slug); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); location.href = lien(prec.slug); }
    });
    // le voile d'entrée ne bloque jamais la page, même si l'animation ne joue pas
    var voile = document.querySelector('.exp-voile');
    if (voile) setTimeout(function () { voile.remove(); }, reduit() ? 500 : 2200);
    apparitions();
  }

  window.Qexp = {
    EXPERIENCES: EXPERIENCES, lien: lien, reduit: reduit, webgl: webgl, modeScene: modeScene,
    dateEvenement: dateEvenement, euro: euro, artProduit: artProduit, RELIEFS: RELIEFS, apparitions: apparitions
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cadre);
  else cadre();
})();
