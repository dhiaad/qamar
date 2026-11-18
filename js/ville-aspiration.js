// Qamar — accueil : la ville aux néons orange (image fournie par Qamar).
// Au repos, les néons vivent : la lumière file dans les rues.
// Cliquer et maintenir (9 s) : les néons glissent comme des serpents le long des rues jusqu'au pied de la tour
// du fond, où toute la lumière se rassemble ; elle monte au ciel en un rayon, la caméra le suit, quitte la ville,
// et le rayon frappe la Lune qui s'embrase. Au relâchement, on retrouve d'un coup l'accueil du début.
(function () {
  const racine = document.documentElement;
  const toile = document.querySelector('.ville-scene');
  if (!toile) return;
  const gl = toile.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) { toile.remove(); return; }

  const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const etroit = innerWidth < 760;
  const POINT = [0.5039, 0.1653];  // juste derrière la grande tour du fond, à hauteur de l'horizon (proportion de l'image)
  const IMAGE = [1920, 1512];

  const vs = 'attribute vec2 p; varying vec2 vUv; void main(){ vUv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }';
  const fs = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uBase, uLit, uCarte, uLune;
uniform vec2 uEcran, uImage, uP;
uniform float uDecal, uFront, uFlux, uFluxForce, uPoint, uRayon, uRayonForce, uOrange, uImpact, uTemps;
const float PI = 3.14159265;
float hasard(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// silhouette de la grande tour du fond (en pixels de l'image 3840 × 3024) : ce qui est derrière elle est caché
float tour(vec2 ip){
  float antenne = (1. - smoothstep(2.5, 4., abs(ip.x - 1937.))) * step(200., ip.y) * step(ip.y, 292.);
  float t = clamp((ip.y - 290.) / 410., 0., 1.);
  float g = mix(1910., 1895., t), d = mix(1962., 1980., t);
  float corps = smoothstep(g - 1.5, g + 1.5, ip.x) * (1. - smoothstep(d - 1.5, d + 1.5, ip.x)) * smoothstep(288., 292., ip.y) * step(ip.y, 760.);
  return max(antenne, corps);
}
void main(){
  vec2 px = vUv * uEcran;
  float H = uEcran.y;
  float s = max(uEcran.x / uImage.x, H / uImage.y);
  // téléphone : le bas de la photo est noir, on agrandit pour que la ville remplisse tout l'écran
  if (H > uEcran.x) s = max(s, H / (uImage.y * .58));
  vec2 taille = uImage * s;
  vec2 orig = vec2((uEcran.x - taille.x) * .5, uDecal * H);
  vec2 iuv = (px - orig) / taille;
  vec3 col = vec3(0.);

  // ciel : des étoiles fixes, qui défilent moins vite que la ville
  vec2 sp = vec2(px.x, px.y - orig.y * .45);
  vec2 cel = floor(sp / 3.);
  float h = hasard(cel);
  float etoile = step(.9965, h) * (.45 + .55 * sin(uTemps * (1. + h * 3.) + h * 40.));
  float ciel = iuv.y < 0. ? 1. : 1. - smoothstep(0., .12, iuv.y);
  col += vec3(.85, .88, 1.) * max(etoile, 0.) * ciel * .8;

  if (iuv.y >= 0. && iuv.y <= 1.) {
    vec3 base = texture2D(uBase, iuv).rgb;
    vec3 lit = texture2D(uLit, iuv).rgb;
    vec3 c = texture2D(uCarte, iuv).rgb;
    base *= 1. - .45 * smoothstep(.04, .35, c.b);           // rues éteintes : sombres, sans trace orange
    float d = (c.r * 65280. + c.g * 255.) / 65535.;          // distance le long des rues jusqu'à la tour
    float vis = 1. - smoothstep(uFront - .03, uFront + .004, d);
    vec3 ville = mix(base, lit, vis);
    float neon = clamp((lit.r - base.r) * 2.2, 0., 1.);
    float flux = pow(.5 + .5 * sin(d * 110. + uFlux), 7.);   // la lumière file vers la tour
    ville += vec3(1., .62, .3) * flux * neon * vis * uFluxForce;
    float bout = exp(-pow((d - uFront) / .014, 2.)) * neon * step(.001, uFront) * step(uFront, 1.);
    ville += vec3(1., .66, .38) * bout * .9;
    ville *= smoothstep(0., .06, iuv.y);                    // le haut de l'image se fond dans le ciel
    col = max(col, ville);
  }

  // la Lune, au-dessus de la ville : on la découvre en montant
  vec2 lc = vec2(uEcran.x * .5, orig.y - .72 * H);
  float lr = (etroit() ? .13 : .17) * H;
  vec2 q = (px - lc) / lr;
  float r2 = dot(q, q);
  if (r2 < 1.) {
    vec3 n = vec3(q.x, -q.y, sqrt(1. - r2));
    float lon = atan(n.x, n.z) + uTemps * .02, lat = asin(n.y);
    vec3 sol = texture2D(uLune, vec2(lon / (2. * PI) + .5, .5 - lat / PI)).rgb;
    float jour = clamp(dot(n, normalize(vec3(.85, .25, .5))) * 1.2 + .05, 0., 1.);
    vec3 grise = sol * (jour * 1.1 + .03);
    vec3 orange = sol * vec3(1.7, .72, .28) * (.55 + .7 * jour) + vec3(.25, .07, 0.) * (1. - r2);
    vec3 lune = mix(grise, orange, uOrange);
    col = mix(col, lune, smoothstep(1., .985, r2));
  }
  float dl = length(px - lc) / lr;
  col += vec3(1., .45, .12) * (uOrange * .55 + uImpact * 1.4) * exp(-max(dl - 1., 0.) * 2.6) * step(1., dl);
  col += vec3(.5, .52, .6) * .06 * exp(-max(dl - 1., 0.) * 4.) * step(1., dl) * (1. - uOrange);

  // l'énergie se rassemble derrière la grande tour (la tour la cache), puis elle est envoyée vers la Lune : un long trait de lumière qui voyage
  // (la tête devant, la traîne qui s'efface derrière), touche la Lune et s'y absorbe — pas un rayon continu
  vec2 pe = orig + uP * taille;
  float devant = 1. - tour(iuv * uImage * 2.);
  float r = length(px - pe) / H;
  vec3 energie = vec3(1., .5, .16) * uPoint * (.006 / (r + .006)) * .9;
  energie += vec3(1., .85, .7) * uPoint * exp(-r / .004) * .8;
  energie += vec3(1., .45, .12) * uPoint * exp(-r / .035) * .35;          // contre-jour autour de la tour
  float dx = abs(px.x - pe.x) / H;
  float cible = lc.y + lr * .98;
  float tete = mix(pe.y, cible, clamp(uRayon, 0., 1.));
  float queue = mix(pe.y, cible, clamp(uRayon - .38, 0., 1.));
  float dans = step(tete, px.y) * step(px.y, queue) * step(.0001, queue - tete);
  float f = clamp((px.y - tete) / max(queue - tete, 1.), 0., 1.);       // 0 à la tête, 1 au bout de la traîne
  float coeur = exp(-dx / .0013) + .35 * exp(-dx / .011);
  energie += vec3(1., .62, .3) * coeur * dans * pow(1. - f, 1.6) * 1.3 * uRayonForce;
  float enVol = step(.001, uRayon) * (1. - step(1., uRayon));
  energie += vec3(1., .8, .55) * enVol * exp(-length(px - vec2(pe.x, tete)) / (.012 * H)) * .9;
  col += energie * devant;
  col += vec3(1., .9, .75) * uImpact * exp(-length(px - vec2(lc.x, cible)) / (.05 * H));

  // le bas de l'accueil reste sombre, sous le titre
  col *= 1. - .7 * smoothstep(.8, 1., vUv.y) * (1. - smoothstep(.0, .6, uDecal));
  gl_FragColor = vec4(col, 1.);
}`.replace('etroit()', etroit ? 'true' : 'false');

  function shader(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aP = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(aP);
  gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  ['uBase', 'uLit', 'uCarte', 'uLune', 'uEcran', 'uImage', 'uP', 'uDecal', 'uFront', 'uFlux', 'uFluxForce', 'uPoint', 'uRayon', 'uRayonForce', 'uOrange', 'uImpact', 'uTemps']
    .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
  gl.uniform2f(U.uImage, IMAGE[0], IMAGE[1]);
  gl.uniform2f(U.uP, POINT[0], POINT[1]);

  // ---------- Images ----------
  // sur téléphone la ville est agrandie : on prend la grande image pour qu'elle reste nette
  const grand = innerWidth * Math.min(devicePixelRatio, 2) > 2200 || innerHeight > innerWidth;
  const V = '?v=20261119b';
  const sources = [
    'images/ville/ville-eteinte-' + (grand ? 3840 : 1920) + '.webp' + V,
    'images/ville/neons2-' + (grand ? 3840 : 1920) + '.webp' + V,
    'images/ville/ville-aspiration.png' + V,
    'images/lune/lune-couleur-2k.jpg' + V,
  ];
  const charger = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
  function texture(unite, img, nette, boucle) {
    gl.activeTexture(gl.TEXTURE0 + unite);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    const f = nette ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, boucle ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  // ---------- Taille ----------
  let L = 0, H = 0;
  function redimensionner() {
    const l = innerWidth, h = innerHeight;
    if (l === L && h === H) return;
    L = l; H = h;
    const ratio = Math.min(devicePixelRatio, etroit ? 1.25 : 1.5);
    toile.width = Math.round(l * ratio);
    toile.height = Math.round(h * ratio);
    gl.viewport(0, 0, toile.width, toile.height);
    gl.uniform2f(U.uEcran, toile.width, toile.height);
  }

  // ---------- Mots révélés pendant le maintien (repris de la scène d'origine) ----------
  const MOTS_DEBUT = [0.45, 2.3, 4.3, 7.15]; // Imaginer, Créer, Affiner… et « Briller » quand la Lune s'allume
  const PAS = 0.022, APPARITION = 0.08, CLIGNE = 0.03, ATTENTE = 0.6;
  const melange = (n) => { const t = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; } return t; };
  const mots = [...document.querySelectorAll('.maintien-mot')].map((el) => {
    const texte = el.textContent.trim();
    el.textContent = '';
    return { lettres: [...texte].map((c) => { const sp = document.createElement('span'); sp.textContent = c; el.appendChild(sp); return sp; }), cles: [] };
  });
  function preparerMots() {
    mots.forEach((m, w) => {
      const n = m.lettres.length, s = MOTS_DEBUT[w];
      const A = s + (n - 1) * PAS + APPARITION, A2 = A + (n - 1) * PAS + CLIGNE, X = A2 + (n - 1) * PAS + CLIGNE + ATTENTE;
      const o1 = melange(n), o2 = melange(n), o3 = melange(n);
      m.cles = m.lettres.map((_, i) => [[s + i * PAS, 0], [s + i * PAS + APPARITION, 1], [A + o1[i] * PAS, 1], [A + o1[i] * PAS + CLIGNE, 0.12],
        [A2 + o2[i] * PAS, 0.12], [A2 + o2[i] * PAS + CLIGNE, 1], [X + o3[i] * PAS, 1], [X + o3[i] * PAS + CLIGNE, 0]]);
    });
  }
  function valeur(cles, t) {
    if (t <= cles[0][0]) return 0;
    for (let i = 1; i < cles.length; i++) if (t <= cles[i][0]) { const [t0, v0] = cles[i - 1], [t1, v1] = cles[i]; return v0 + (v1 - v0) * ((t - t0) / Math.max(t1 - t0, 1e-4)); }
    return cles[cles.length - 1][1];
  }
  const dessinerMots = (t) => { for (const m of mots) m.lettres.forEach((l, i) => { l.style.opacity = t < 0 || !m.cles.length ? 0 : valeur(m.cles[i], t).toFixed(3); }); };

  // ---------- Séquence du maintien (9 secondes) ----------
  const DUREE = 9;
  const lisse = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
  let T = 0, flux = 0, temps = 0;
  function poser(dt) {
    // les néons glissent vers la tour, de plus en plus vite, puis il n'en reste qu'un point au pied de la tour
    gl.uniform1f(U.uFront, 1.06 * (1 - Math.pow(lisse(0.3, 4.6, T), 1.35)));
    flux += dt * (1.6 + 11 * lisse(0.2, 3.2, T));
    gl.uniform1f(U.uFlux, flux);
    gl.uniform1f(U.uFluxForce, 0.55 + 0.6 * lisse(0.2, 2, T));
    gl.uniform1f(U.uPoint, lisse(2.8, 4.6, T) * (1 - 0.85 * lisse(4.7, 5.4, T)));
    // l'énergie part de la tour (4,7 s), accélère, touche la Lune vers 7,1 s puis sa traîne s'y absorbe ;
    // la caméra la suit et quitte la ville
    const x = Math.min(Math.max((T - 4.7) / 3.1, 0), 1);
    gl.uniform1f(U.uRayon, 1.38 * Math.pow(x, 1.35));
    gl.uniform1f(U.uRayonForce, 1);
    gl.uniform1f(U.uDecal, 1.15 * lisse(4.8, 7.4, T) - scrollY / innerHeight);
    gl.uniform1f(U.uOrange, lisse(7.15, 8.0, T));
    gl.uniform1f(U.uImpact, lisse(7.1, 7.25, T) * (1 - lisse(7.3, 8.3, T)));
    gl.uniform1f(U.uTemps, temps);
  }

  // ---------- Interaction ----------
  const zone = document.querySelector('.accueil-ville .hero');
  const curseur = document.querySelector('.curseur-maintien');
  const progres = curseur?.querySelector('.progres');
  const CIRCONF = progres ? 2 * Math.PI * progres.r.baseVal.value : 0;
  if (progres) progres.style.strokeDasharray = CIRCONF;
  const INTERACTIF = 'a, button, [role="button"], input, select, textarea, label';
  const souris = { px: 0, py: 0, kx: 0, ky: 0, bouge: false };
  let tenu = false, fige = null;
  addEventListener('pointermove', (e) => {
    souris.px = e.clientX; souris.py = e.clientY;
    if (!souris.bouge) { souris.kx = e.clientX; souris.ky = e.clientY; souris.bouge = true; }
  }, { passive: true });
  function commencer() {
    if (scrollY > innerHeight * 0.5) return;
    tenu = true;
    preparerMots();
    racine.classList.add('maintien-actif');
    curseur?.classList.add('appuye');
    curseur?.classList.remove('cache');
  }
  function finir() {
    tenu = false;
    racine.classList.remove('maintien-actif');
    curseur?.classList.remove('appuye');
    dessinerMots(-1);
  }
  if (zone && !reduit) {
    zone.addEventListener('pointerover', (e) => { curseur?.classList.add('visible'); curseur?.classList.toggle('cache', !tenu && !!e.target.closest(INTERACTIF)); });
    zone.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !e.isPrimary || e.target.closest(INTERACTIF)) return;
      e.preventDefault();
      commencer();
    });
    addEventListener('pointerup', () => tenu && finir());
    addEventListener('pointercancel', () => tenu && finir());
    addEventListener('blur', () => tenu && finir());
    zone.addEventListener('pointerleave', () => { if (tenu) finir(); curseur?.classList.remove('visible'); });
  }

  // ---------- Boucle ----------
  let avant = 0;
  function image(maintenant) {
    const dt = Math.min((maintenant - avant) / 1000 || 0, 0.05);
    avant = maintenant;
    redimensionner();
    if (tenu) T = Math.min(T + dt, DUREE);
    else T = 0;                                      // au relâchement, retour immédiat à l'accueil, sans retour en arrière
    if (fige !== null) T = fige;
    if (progres) progres.style.strokeDashoffset = CIRCONF * (1 - T / DUREE);
    if (tenu) dessinerMots(T);
    souris.kx += (souris.px - souris.kx) * 0.2;
    souris.ky += (souris.py - souris.ky) * 0.2;
    if (curseur) curseur.style.transform = `translate(${souris.kx}px, ${souris.ky}px)`;
    // on ne dessine que si l'accueil est à l'écran
    if (scrollY < innerHeight * 1.2) {
      temps += reduit ? 0 : dt;
      poser(reduit ? 0 : dt);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    requestAnimationFrame(image);
  }

  Promise.all(sources.map(charger)).then(([base, lit, carte, lune]) => {
    texture(0, base); texture(1, lit); texture(2, carte, true); texture(3, lune, false, true);
    gl.uniform1i(U.uBase, 0); gl.uniform1i(U.uLit, 1); gl.uniform1i(U.uCarte, 2); gl.uniform1i(U.uLune, 3);
    redimensionner();
    racine.classList.add('aspiration-prete', 'rubans-prets');
    requestAnimationFrame((m) => { avant = m; image(m); });
  }).catch(() => { toile.remove(); });

  // réglage : ?reglage puis qamarInstant(5) pour figer la séquence à un instant, qamarRelacher() pour relâcher
  if (location.search.includes('reglage')) {
    window.qamarInstant = (x) => { if (!tenu) commencer(); fige = x; };
    window.qamarRelacher = () => { fige = null; finir(); };
  }
})();
