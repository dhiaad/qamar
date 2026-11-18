// Qamar — comportements communs à toutes les pages
document.documentElement.classList.add('js');
const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
const parParams = new URLSearchParams(location.search);

// ---------- Apparitions au défilement ----------
const cibles = document.querySelectorAll('.carte-pq, .garanties li, .engagements-liste li, .colonne, .option, .etape, .manifeste, .apparait-auto');
cibles.forEach((el) => el.classList.add('apparait'));
const apparition = new IntersectionObserver((entrees) => {
  for (const e of entrees) {
    if (e.isIntersecting) { e.target.classList.add('visible'); apparition.unobserve(e.target); }
  }
}, { threshold: .15 });
cibles.forEach((el) => apparition.observe(el));

// ---------- Méthodes : les chiffres n'apparaissent que s'ils sont tous renseignés ----------
// Aucun chiffre n'est inventé : chaque valeur se règle dans methode.html (data-valeur).
// Avec ?apercu dans l'adresse, le bloc s'affiche et signale les valeurs manquantes.
document.querySelectorAll('[data-chiffres]').forEach((bloc) => {
  const items = [...bloc.querySelectorAll('li')];
  const vides = items.filter((li) => !li.dataset.valeur.trim());
  items.forEach((li) => {
    const v = li.dataset.valeur.trim();
    li.querySelector('b').textContent = v || 'À renseigner';
    li.classList.toggle('a-renseigner', !v);
  });
  bloc.hidden = vides.length > 0 && !parParams.has('apercu');
});

// ---------- Formules en colonnes : la colonne survolée (ou touchée) s'ouvre ----------
const colonnes = document.querySelectorAll('.colonne');
function ouvrirColonne(c) { colonnes.forEach((o) => o.classList.toggle('ouverte', o === c)); }
colonnes.forEach((c) => {
  c.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') ouvrirColonne(c); });
  c.addEventListener('click', (e) => { if (!e.target.closest('a')) ouvrirColonne(c); });
  c.addEventListener('focusin', () => ouvrirColonne(c));
});

// ---------- Carrousel de la méthode : flèches, glisser à la souris avec élan, progression ----------
const carrousel = document.querySelector('.carrousel');
if (carrousel) {
  document.querySelectorAll('.fleche').forEach((b) => b.addEventListener('click', () => {
    const pas = carrousel.querySelector('.etape').offsetWidth + 16;
    carrousel.scrollBy({ left: pas * Number(b.dataset.sens), behavior: 'smooth' });
  }));

  let tire = false, x0 = 0, depart = 0, vitesse = 0, dernierX = 0, dernierT = 0, deplace = 0, inertie = 0;
  carrousel.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return; // au doigt, le défilement natif suffit
    tire = true; deplace = 0; vitesse = 0;
    x0 = dernierX = e.clientX; dernierT = performance.now();
    depart = carrousel.scrollLeft;
    cancelAnimationFrame(inertie);
    carrousel.classList.add('tire');
    carrousel.setPointerCapture(e.pointerId);
  });
  carrousel.addEventListener('pointermove', (e) => {
    if (!tire) return;
    const dx = e.clientX - x0;
    deplace = Math.max(deplace, Math.abs(dx));
    carrousel.scrollLeft = depart - dx;
    const t = performance.now();
    if (t > dernierT) vitesse = (e.clientX - dernierX) / (t - dernierT);
    dernierX = e.clientX; dernierT = t;
  });
  const lacher = () => {
    if (!tire) return;
    tire = false;
    if (calme) { carrousel.classList.remove('tire'); return; }
    // l'élan continue un peu, puis l'aimantation reprend la main
    (function glisser() {
      carrousel.scrollLeft -= vitesse * 16;
      vitesse *= 0.92;
      if (Math.abs(vitesse) > 0.02) inertie = requestAnimationFrame(glisser);
      else carrousel.classList.remove('tire');
    })();
  };
  carrousel.addEventListener('pointerup', lacher);
  carrousel.addEventListener('pointercancel', lacher);
  // un glissé n'est pas un clic
  carrousel.addEventListener('click', (e) => { if (deplace > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
  carrousel.addEventListener('dragstart', (e) => e.preventDefault());

  const barre = document.querySelector('.carrousel-progres i');
  const majBarre = () => {
    if (!barre) return;
    const max = carrousel.scrollWidth - carrousel.clientWidth;
    const part = carrousel.clientWidth / carrousel.scrollWidth;
    barre.style.width = `${part * 100}%`;
    barre.style.transform = `translateX(${max > 0 ? (carrousel.scrollLeft / max) * (1 / part - 1) * 100 : 0}%)`;
  };
  carrousel.addEventListener('scroll', majBarre, { passive: true });
  addEventListener('resize', majBarre);
  majBarre();
}

// ---------- Menu ----------
const boutonMenu = document.querySelector('.nav-grille');
const menu = document.getElementById('menu');
if (boutonMenu && menu) {
  const fermer = menu.querySelector('.menu-fermer');
  const ouvrir = () => { menu.hidden = false; boutonMenu.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; fermer.focus(); };
  const refermer = () => { menu.hidden = true; boutonMenu.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; boutonMenu.focus(); };
  boutonMenu.addEventListener('click', ouvrir);
  fermer.addEventListener('click', refermer);
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) refermer(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) refermer(); });
}

// ---------- Grille de points : une case survolée s'allume, puis s'éteint d'elle-même après 4 secondes ----------
const grille = document.querySelector('.grille-points');
if (grille) {
  const LIGNES = 5, EXTINCTION = 4000;
  const minuteries = new WeakMap();
  const allumer = (c) => {
    c.classList.add('allume');
    clearTimeout(minuteries.get(c));
    minuteries.set(c, setTimeout(() => c.classList.remove('allume'), EXTINCTION));
  };
  function construire() {
    const pas = innerWidth < 760 ? 44 : 71;
    grille.style.setProperty('--case', `${pas}px`);
    const nb = Math.max(6, Math.floor((grille.clientWidth || innerWidth) / pas));
    grille.style.setProperty('--colonnes', nb);
    const total = nb * LIGNES;
    for (let i = grille.children.length; i < total; i++) {
      const c = document.createElement('span');
      c.className = 'case';
      grille.appendChild(c);
      if (Math.random() < 0.035) allumer(c);
    }
    while (grille.children.length > total) grille.lastChild.remove();
  }
  construire();
  let attente;
  addEventListener('resize', () => { clearTimeout(attente); attente = setTimeout(construire, 150); });

  grille.addEventListener('mouseover', (e) => { if (e.target.classList.contains('case')) allumer(e.target); });
  // au doigt : glisser sur la grille allume aussi les cases
  grille.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') return;
    const c = document.elementFromPoint(e.clientX, e.clientY);
    if (c && c.classList.contains('case')) allumer(c);
  }, { passive: true });

  // de temps en temps, une case s'allume toute seule
  if (!calme) {
    setInterval(() => {
      if (grille.matches(':hover')) return;
      const cases = grille.children;
      allumer(cases[Math.floor(Math.random() * cases.length)]);
    }, 1400);
  }
}

// ---------- Rangée de marques : défilement lent, accéléré par le défilement de la page ----------
const bandeauLogos = document.querySelector('.logos');
if (bandeauLogos) {
  new IntersectionObserver((entrees, obs) => {
    if (entrees[0].isIntersecting) { bandeauLogos.classList.add('visible'); obs.disconnect(); }
  }, { threshold: .4 }).observe(bandeauLogos);

  const pisteLogos = bandeauLogos.querySelector('.logos-piste');
  let x = 0, elan = 0, sens = 1, dernierY = scrollY, avant = performance.now();
  addEventListener('scroll', () => {
    const d = scrollY - dernierY;
    dernierY = scrollY;
    if (d) sens = Math.sign(d);
    elan = Math.min(elan + Math.abs(d) * 0.6, 900);
  }, { passive: true });
  (function avancer(maintenant) {
    const dt = Math.min((maintenant - avant) / 1000, 0.05);
    avant = maintenant;
    if (!calme) {
      const moitie = pisteLogos.scrollWidth / 2;
      x -= sens * (34 + elan) * dt;
      elan *= Math.pow(0.04, dt); // l'élan retombe en douceur
      if (x <= -moitie) x += moitie;
      if (x > 0) x -= moitie;
      pisteLogos.style.transform = `translate3d(${x}px, 0, 0)`;
    }
    requestAnimationFrame(avancer);
  })(avant);
}

// ---------- Page Formules : le sommaire suit la fiche lue ----------
const sommaire = document.querySelectorAll('.sommaire a');
if (sommaire.length) {
  const lecture = new IntersectionObserver((entrees) => {
    for (const e of entrees) {
      if (!e.isIntersecting) continue;
      sommaire.forEach((a) => a.classList.toggle('actif', a.getAttribute('href') === `#${e.target.id}`));
    }
  }, { rootMargin: '-40% 0px -55% 0px' });
  document.querySelectorAll('.fiche').forEach((f) => lecture.observe(f));
}

// ---------- Page Marketing : les six étapes en orbite ----------
// survol : le trait part vers l'étape et l'affiche · clic : l'étape reste affichée (épinglée)
// tant que personne n'y touche, les étapes défilent seules quand le schéma est à l'écran
const orbite = document.querySelector('.orbite');
if (orbite) {
  const onglets = [...orbite.querySelectorAll('.noeud')];
  const compteur = document.querySelector('.oa-n');
  let garde = 0;      // l'étape épinglée
  let affiche = 0;    // l'étape visible
  let auto = null;
  const afficher = (i) => {
    affiche = i;
    onglets.forEach((o, k) => {
      const sel = k === i;
      o.setAttribute('aria-selected', sel);
      o.tabIndex = sel ? 0 : -1;
      const p = document.getElementById(o.getAttribute('aria-controls'));
      if (p.hidden === sel) p.hidden = !sel;
    });
    if (compteur) compteur.textContent = i + 1;
    // le rayon tourne vers l'étape, par le chemin le plus court
    const cible = -90 + i * 60;
    const actuel = parseFloat(orbite.style.getPropertyValue('--sel')) || -90;
    const d = ((cible - actuel) % 360 + 540) % 360 - 180;
    orbite.style.setProperty('--sel', `${actuel + d}deg`);
  };
  const epingler = (i, focus) => {
    garde = i;
    orbite.classList.add('epingle');
    onglets.forEach((o, k) => o.classList.toggle('garde', k === i));
    afficher(i);
    if (focus) onglets[i].focus();
  };
  const arreterAuto = () => { clearInterval(auto); auto = null; };
  onglets.forEach((o, i) => {
    o.addEventListener('click', () => { arreterAuto(); epingler(i); });
    o.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'mouse') return; arreterAuto(); afficher(i); });
  });
  // en quittant le schéma, on revient à l'étape épinglée
  orbite.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') afficher(garde); });
  document.querySelectorAll('.orbite-fleche').forEach((f) => f.addEventListener('click', () => {
    arreterAuto();
    epingler((affiche + Number(f.dataset.pas) + onglets.length) % onglets.length);
  }));
  orbite.addEventListener('keydown', (e) => {
    const i = onglets.indexOf(document.activeElement);
    if (i < 0) return;
    const pas = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let n = null;
    if (pas) n = (i + pas + onglets.length) % onglets.length;
    if (e.key === 'Home') n = 0;
    if (e.key === 'End') n = onglets.length - 1;
    if (n !== null) { e.preventDefault(); arreterAuto(); epingler(n, true); }
  });
  if (!calme && 'IntersectionObserver' in window) {
    let lance = false;
    new IntersectionObserver(([v], obs) => {
      if (!v.isIntersecting || lance) return;
      lance = true; obs.disconnect();
      auto = setInterval(() => { garde = (affiche + 1) % onglets.length; afficher(garde); }, 3200);
    }, { threshold: .5 }).observe(orbite);
  }
}

// ---------- Page Fidélité : l'histoire racontée au défilement ----------
// Le téléphone est à l'écran dès l'arrivée. C'est le visiteur qui avance en faisant défiler :
// la carte à points se remplit, on glisse vers la carte à tampons, puis on recule jusqu'au plan
// du quartier, où la notification arrive. Une bulle posée contre le téléphone explique chaque étape.
const demo = document.querySelector('.demo-fidelite');
if (demo && demo.querySelector('.histoire-scene')) {
  const defile = demo.querySelector('.demo-defile');
  const zoneDemo = demo.querySelector('.demo-zone');
  const scene = demo.querySelector('.histoire-scene');
  const tel = demo.querySelector('.tel-hist');
  const plan = demo.querySelector('.plan');
  const piste = demo.querySelector('.cartes-piste');
  const points = demo.querySelector('.compteur-points');
  const jauge = demo.querySelector('.cw-jauge i');
  const tampons = demo.querySelectorAll('.carte-tampons .cw-tampons i');
  const compteTampons = demo.querySelector('.compteur-tampons');
  const navPoints = demo.querySelectorAll('.tel-points-nav i');
  const notif = demo.querySelector('.notif-hist');
  const bulles = [...demo.querySelectorAll('.bulle-demo')];
  const boutonsEtapes = demo.querySelectorAll('.demo-etapes button');
  const borne = (x) => Math.min(1, Math.max(0, x));
  const phase = (p, a, b) => borne((p - a) / (b - a));
  const doux = (x) => x * x * (3 - 2 * x);
  // le déroulé : [position dans le défilement (0 à 16,4), avancée de l'animation] ; les paliers laissent lire chaque bulle
  const DEROULE = [[0, 0], [1.2, 0.12], [4.2, 0.14], [6.6, 0.33], [7.8, 0.35], [8.8, 0.45], [11, 0.6], [12.4, 0.62], [14.8, 0.85], [15.6, 0.95], [16.4, 1]];
  const DEBUTS = [0, 4.2, 8.4, 12.4];   // début de chaque bulle
  const FIN = 16.4;
  let echelle = 1, decalX = 0, decalY = 0, t = 0, cible = 0, bulleActive = -1, enCours = false;

  const mesurer = () => {
    echelle = Math.min(1.1, scene.clientHeight / (tel.offsetHeight * 1.04), scene.clientWidth / (tel.offsetWidth * 1.05));
    const cote = Math.min(scene.clientWidth, scene.clientHeight);
    decalX = cote * 0.12; decalY = cote * 0.14;
  };
  const avancee = (s) => {
    for (let i = 1; i < DEROULE.length; i++) {
      const [t0, p0] = DEROULE[i - 1], [t1, p1] = DEROULE[i];
      if (s <= t1) return p0 + (p1 - p0) * doux(borne((s - t0) / (t1 - t0)));
    }
    return 1;
  };
  // la bulle se pose contre le téléphone, à gauche ou à droite (sur mobile : sur le bas du téléphone)
  const placerBulle = (b) => {
    const z = zoneDemo.getBoundingClientRect(), r = tel.getBoundingClientRect();
    const etroit = z.width < 760;
    if (etroit) {
      b.style.left = `${Math.max(0, r.left - z.left + r.width / 2 - b.offsetWidth / 2)}px`;
      b.style.top = `${Math.min(z.height - b.offsetHeight, r.bottom - z.top - b.offsetHeight * 0.55)}px`;
      return;
    }
    // à côté du téléphone, sans couvrir l'écran (elle touche seulement le bord du boîtier)
    const ecart = 18;
    const gauche = b.classList.contains('bulle-gauche');
    const x = gauche ? r.left - z.left - b.offsetWidth - ecart : r.right - z.left + ecart;
    b.style.left = `${Math.max(0, Math.min(z.width - b.offsetWidth, x))}px`;
    b.style.top = `${r.top - z.top + r.height * 0.42 - b.offsetHeight / 2}px`;
  };
  const dessiner = () => {
    const p = avancee(t);
    const approche = doux(phase(p, 0, 0.12));
    const recul = doux(phase(p, 0.62, 0.85));
    const s = echelle * (0.82 + 0.2 * approche) * (1 - 0.86 * recul);
    tel.style.transform = `translate(${recul * decalX}px, ${recul * decalY}px) scale(${s})`;
    plan.style.opacity = recul;
    plan.style.transform = `scale(${2.2 - 1.2 * recul})`;
    const pts = Math.round(120 * doux(phase(p, 0.14, 0.33)));
    points.textContent = pts;
    jauge.style.width = `${(pts / 150) * 100}%`;
    const glisse = doux(phase(p, 0.35, 0.45));
    piste.style.transform = `translateX(${-glisse * 100}%)`;
    navPoints.forEach((n, i) => n.classList.toggle('actif', (glisse > 0.5) === (i === 1)));
    const nb = Math.round(8 * phase(p, 0.46, 0.6));
    tampons.forEach((x, i) => x.classList.toggle('ok', i < nb));
    compteTampons.textContent = `${nb} / ${tampons.length}`;
    notif.classList.toggle('visible', p > 0.86);
    let b = 0;
    DEBUTS.forEach((d, i) => { if (t >= d) b = i; });
    if (b !== bulleActive) {
      bulleActive = b;
      bulles.forEach((x, i) => x.classList.toggle('actif', i === b));
      boutonsEtapes.forEach((x, i) => x.setAttribute('aria-current', i === b ? 'step' : 'false'));
    }
    placerBulle(bulles[b]);
  };
  // la position dans la section (0 en haut, FIN en bas), adoucie pour un mouvement fluide
  const lire = () => {
    const r = defile.getBoundingClientRect();
    const course = Math.max(1, r.height - innerHeight);
    cible = borne(-r.top / course) * FIN;
  };
  const image = () => {
    const ecart = cible - t;
    t = Math.abs(ecart) < 0.002 || calme ? cible : t + ecart * 0.16;
    dessiner();
    if (t !== cible) requestAnimationFrame(image); else enCours = false;
  };
  const suivre = () => { lire(); if (!enCours) { enCours = true; requestAnimationFrame(image); } };
  // les étapes : un clic fait défiler jusqu'à l'étape
  boutonsEtapes.forEach((x, i) => x.addEventListener('click', () => {
    const r = defile.getBoundingClientRect();
    const course = Math.max(1, r.height - innerHeight);
    scrollTo({ top: scrollY + r.top + ((DEBUTS[i] + (i === 0 ? 0 : 1)) / FIN) * course, behavior: calme ? 'auto' : 'smooth' });
  }));
  mesurer();
  lire();
  t = cible;
  dessiner();
  addEventListener('scroll', suivre, { passive: true });
  addEventListener('resize', () => { mesurer(); lire(); t = cible; dessiner(); });
}

// ---------- Formulaires (contact et devis) : l'envoi réel ----------
// Le service d'envoi se règle dans js/config-formulaire.js (aucune clé secrète dans ce code).
// Le message de réussite n'apparaît QUE si le service a confirmé la réception.
// Sans service réglé : mode démonstration, le visiteur est prévenu que rien n'est parti.
const reglage = window.QAMAR_FORMULAIRE || { service: 'aucun', destinataire: 'qamar-conception@gmail.com' };
const ouvertureFormulaires = Date.now();

// les réponses du formulaire, en texte lisible (pour l'e-mail de secours)
const NOMS_CHAMPS = { formule: 'Type de site', options: 'Services en plus', budget: 'Budget', delai: 'Délai', sujet: 'Sujet', projet: 'Projet', message: 'Message', site: 'Site actuel', nom: 'Nom', entreprise: 'Entreprise', email: 'E-mail', telephone: 'Téléphone' };
const resume = (f) => {
  const lignes = [];
  const vus = new Set();
  for (const el of f.elements) {
    if (!el.name || el.name.startsWith('_') || el.name === 'accord' || vus.has(el.name)) continue;
    vus.add(el.name);
    let v;
    if (el.type === 'radio' || el.type === 'checkbox') {
      v = [...f.querySelectorAll(`[name="${el.name}"]:checked`)].map((x) => x.closest('label')?.querySelector('.choix-nom')?.textContent.trim() || x.value).join(', ');
    } else v = el.value.trim();
    if (!v) continue;
    const titre = NOMS_CHAMPS[el.name] || el.closest('label')?.querySelector('span')?.textContent.replace(/facultatif/i, '').trim() || el.name;
    lignes.push(`${titre} : ${v}`);
  }
  return lignes.join('\n');
};
const lienEmail = (f, sujet) => `mailto:${reglage.destinataire}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(resume(f))}`;

const envoyer = async (f, sujet) => {
  const donnees = new FormData(f);
  donnees.delete('accord');
  const objet = {};
  for (const [k, v] of donnees) objet[k] = k in objet ? `${objet[k]}, ${v}` : v;
  objet.formulaire = f.classList.contains('formulaire-devis') ? 'devis' : 'contact';
  objet._subject = sujet;
  const attendre = (ms) => new Promise((_, non) => setTimeout(() => non(new Error('délai dépassé')), ms));
  let rep;
  if (reglage.service === 'formsubmit') {
    objet._honey = objet._gotcha || '';
    delete objet._gotcha;
    objet._template = 'table';
    objet._replyto = objet.email || '';
    rep = await Promise.race([fetch(`https://formsubmit.co/ajax/${encodeURIComponent(reglage.destinataire)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(objet)
    }), attendre(20000)]);
    const json = await rep.json().catch(() => ({}));
    if (!rep.ok || !(json.success === true || json.success === 'true')) throw new Error(json.message || `FormSubmit ${rep.status}`);
  } else if (reglage.service === 'formspree') {
    if (!reglage.formspreeId) throw new Error('identifiant Formspree manquant');
    objet._replyto = objet.email || '';
    rep = await Promise.race([fetch(`https://formspree.io/f/${encodeURIComponent(reglage.formspreeId)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(objet)
    }), attendre(20000)]);
    if (!rep.ok) throw new Error(`Formspree ${rep.status}`);
  } else if (reglage.service === 'api') {
    if (!reglage.apiUrl) throw new Error('adresse du serveur manquante');
    rep = await Promise.race([fetch(reglage.apiUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(objet)
    }), attendre(20000)]);
    if (!rep.ok) throw new Error(`serveur ${rep.status}`);
  } else {
    return 'demo';
  }
  return 'envoye';
};

document.querySelectorAll('form[data-formulaire]').forEach((f) => {
  const bouton = f.querySelector('button[type="submit"]');
  const texteBouton = bouton.textContent;
  const merci = f.querySelector('.formulaire-merci');
  const erreur = f.querySelector('.formulaire-erreur');
  const demo = f.querySelector('.formulaire-demo');
  const sujet = f.classList.contains('formulaire-devis') ? 'Nouvelle demande de devis — site Qamar' : 'Nouveau message — site Qamar';
  const montrer = (zone, html) => {
    [merci, erreur, demo].forEach((z) => { if (z && z !== zone) z.hidden = true; });
    if (!zone) return;
    if (html !== undefined) zone.innerHTML = html;
    zone.hidden = false;
    zone.focus();
  };
  let enCours = false;

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enCours) return;
    if (!f.reportValidity()) return;
    // anti-spam : un champ invisible que seuls les robots remplissent, et un envoi trop rapide
    const pot = f.querySelector('[name="_gotcha"]');
    if ((pot && pot.value) || Date.now() - ouvertureFormulaires < 2500) {
      montrer(erreur, "L'envoi a été bloqué par notre protection anti-spam. Patientez quelques secondes puis réessayez.");
      return;
    }
    enCours = true;
    bouton.disabled = true;
    bouton.textContent = 'Envoi en cours…';
    f.setAttribute('aria-busy', 'true');
    try {
      const resultat = await envoyer(f, sujet);
      if (resultat === 'demo') {
        montrer(demo, `<b>Mode démonstration :</b> l'envoi en ligne n'est pas encore activé, votre demande <b>n'a pas été envoyée</b>. Pour nous la transmettre dès maintenant, <a href="${lienEmail(f, sujet)}">envoyez-la par e-mail</a> (vos réponses sont déjà recopiées) ou écrivez à <a href="mailto:${reglage.destinataire}">${reglage.destinataire}</a>.`);
      } else {
        f.classList.add('envoye');
        montrer(merci);
      }
    } catch (err) {
      console.warn('Formulaire non envoyé :', err);
      montrer(erreur, `<b>Votre demande n'a pas pu être envoyée.</b> Vérifiez votre connexion puis réessayez, ou <a href="${lienEmail(f, sujet)}">envoyez-la par e-mail</a> à ${reglage.destinataire}.`);
    } finally {
      enCours = false;
      f.removeAttribute('aria-busy');
      if (!f.classList.contains('envoye')) { bouton.disabled = false; bouton.textContent = texteBouton; }
    }
  });
});

// ---------- Devis : choix pré-rempli depuis l'adresse, récapitulatif en direct ----------
const devis = document.querySelector('.formulaire-devis');
if (devis) {
  const formule = parParams.get('formule');
  const option = parParams.get('option');
  if (formule) { const r = devis.querySelector(`input[name="formule"][value="${CSS.escape(formule)}"]`); if (r) r.checked = true; }
  if (option) { const c = devis.querySelector(`input[name="options"][value="${CSS.escape(option)}"]`); if (c) c.checked = true; }

  const recap = document.querySelector('.recap');
  const texte = (input) => input.closest('label')?.querySelector('.choix-nom')?.textContent.trim() || input.value;
  const majRecap = () => {
    if (!recap) return;
    const val = (nom) => { const i = devis.querySelector(`input[name="${nom}"]:checked`); return i ? texte(i) : '—'; };
    const opts = [...devis.querySelectorAll('input[name="options"]:checked')].map(texte);
    recap.querySelector('[data-recap="formule"]').textContent = val('formule');
    recap.querySelector('[data-recap="options"]').textContent = opts.length ? opts.join(', ') : 'Aucun';
    recap.querySelector('[data-recap="budget"]').textContent = val('budget');
    recap.querySelector('[data-recap="delai"]').textContent = val('delai');
  };
  devis.addEventListener('change', majRecap);
  majRecap();
}

// Formules : bascule « avec / sans engagement » des abonnements de suivi
const bascule = document.querySelector('.abo-bascule');
if (bascule) {
  const boutons = [...bascule.querySelectorAll('button')];
  const zone = bascule.closest('.abonnements');
  const choisirMode = (mode) => {
    boutons.forEach((b) => {
      const actif = b.dataset.mode === mode;
      b.setAttribute('aria-checked', actif ? 'true' : 'false');
      b.tabIndex = actif ? 0 : -1;
    });
    zone.querySelectorAll('[data-avec]').forEach((el) => {
      const texte = el.dataset[mode];
      if (el.textContent === texte) return;
      el.textContent = texte;
      if (el.tagName === 'B') { el.classList.remove('change'); void el.offsetWidth; el.classList.add('change'); }
    });
  };
  boutons.forEach((b, i) => {
    b.addEventListener('click', () => choisirMode(b.dataset.mode));
    b.addEventListener('keydown', (ev) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
      ev.preventDefault();
      const suivant = boutons[(i + 1) % boutons.length];
      suivant.focus();
      choisirMode(suivant.dataset.mode);
    });
  });
  boutons[1].tabIndex = -1;
}

// Accueil : les trois façons de mettre votre marque en lumière (inclinaison au survol, tampon de fidélité)
document.querySelectorAll('.facon').forEach((carte) => {
  if (!calme) {
    carte.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = carte.getBoundingClientRect();
      carte.classList.add('incline');
      carte.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 8).toFixed(2) + 'deg');
      carte.style.setProperty('--rx', (((e.clientY - r.top) / r.height - 0.5) * -6).toFixed(2) + 'deg');
    });
    carte.addEventListener('pointerleave', () => {
      carte.classList.remove('incline');
      carte.style.setProperty('--rx', '0deg');
      carte.style.setProperty('--ry', '0deg');
    });
  }
  const tampons = carte.querySelector('[data-tampons]');
  if (tampons) {
    const cases = [...tampons.children];
    const texte = carte.querySelector('[data-tampons-texte]');
    const bas = carte.querySelector('.cw-bas');
    carte.addEventListener('pointerenter', () => {
      let n = cases.filter((c) => c.classList.contains('ok')).length;
      n = n >= cases.length ? 7 : n + 1;
      cases.forEach((c, i) => c.classList.toggle('ok', i < n));
      texte.textContent = n + ' / ' + cases.length;
      bas.textContent = n === cases.length ? 'Cadeau débloqué' : 'Plus que ' + (cases.length - n) + ' tampon' + (cases.length - n > 1 ? 's' : '');
    });
  }
});

// ---------- En-tête : toujours visible, sur fond sombre dès qu'on a défilé ----------
const entete = document.querySelector('.entete');
if (entete) {
  const majEntete = () => entete.classList.toggle('defile', scrollY > 30);
  addEventListener('scroll', majEntete, { passive: true });
  majEntete();
}

// ---------- Accueil : la lune des expériences s'agrandit jusqu'à remplir l'écran, puis on entre ----------
const portail = document.querySelector('.portail');
if (portail) {
  portail.addEventListener('click', (e) => {
    if (calme || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    const r = portail.querySelector('.pl-astre').getBoundingClientRect();
    const d = document.createElement('div');
    d.className = 'portail-plongee';
    d.setAttribute('aria-hidden', 'true');
    d.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
    document.body.appendChild(d);
    const echelle = (Math.hypot(innerWidth, innerHeight) * 2.2) / r.width;
    requestAnimationFrame(() => requestAnimationFrame(() => { d.style.transform = `scale(${echelle})`; }));
    setTimeout(() => { location.href = portail.href; }, 820);
  });
  addEventListener('pageshow', (e) => { if (e.persisted) document.querySelectorAll('.portail-plongee').forEach((d) => d.remove()); });
}
