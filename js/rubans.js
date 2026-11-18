// Qamar — scène 3D de la page d'accueil (three.js)
// Au repos : de grandes bandes orange presque droites qui ondulent en diagonale sur l'accueil,
// quelques étoiles filantes discrètes et un ciel en profondeur.
// Cliquer et maintenir (9 s) : les bandes s'ouvrent, filent vers le haut de plus en plus vite,
// fusionnent une à une en un rayon de lumière qui va frapper la lune grise et la rend orange.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const lisse = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const toile = document.getElementById('scene-rubans');
const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;

let rendu;
try {
  rendu = new THREE.WebGLRenderer({ canvas: toile, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  toile.remove();
  throw e;
}
rendu.setClearColor(0x000000, 1);
rendu.outputColorSpace = THREE.SRGBColorSpace;
rendu.toneMapping = THREE.NeutralToneMapping;
rendu.toneMappingExposure = 1;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 140);
camera.position.set(0, 0, 16);
scene.fog = new THREE.Fog(0x000000, 13, 31); // les bandes lointaines se fondent dans le noir

const pmrem = new THREE.PMREMGenerator(rendu);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ---------- Lumières ----------
scene.add(new THREE.HemisphereLight(0xff7a30, 0x000000, 0.12));
const cle = new THREE.DirectionalLight(0xff8a40, 0.7);
cle.position.set(-7, 6, 5);
scene.add(cle);
const contre = new THREE.DirectionalLight(0xff5a10, 2.6);
contre.position.set(8, -2, -6);
scene.add(contre);
const lisere = new THREE.DirectionalLight(0xffa060, 1.9);
lisere.position.set(5, 9, -7);
scene.add(lisere);
// reflet discret sur la tranche des bandes (la lune a son propre éclairage, dans son shader)
const soleil = new THREE.DirectionalLight(0xff9a50, 0.6);
soleil.position.set(9, 4, -3);
scene.add(soleil);

// ---------- Le chemin commun : toutes les bandes vont du bas de l'écran vers la lune ----------
const RAYON_LUNE = 2.6;
const DEPART = new THREE.Vector3(-7, -13, 3);     // sous l'accueil, à gauche
const LUNE = new THREE.Vector3(15, 27, -16);      // la lune attend tout en haut à droite, hors du cadre
const TRAVERS = new THREE.Vector3(-40, 22, 0).normalize(); // perpendiculaire au chemin, dans le plan de l'écran
const FIN_REPOS = 0.62;                            // au repos, les bandes s'arrêtent hors du cadre, en haut
const S_LUNE = 1 - RAYON_LUNE / DEPART.distanceTo(LUNE); // là où le rayon touche la surface de la lune

// ---------- Géométrie : une bande droite (section rectangle aux arêtes arrondies) ----------
// Elle est tordue, ondulée et déplacée dans le shader : la même géométrie sert au repos, à l'envol et au rayon.
function profil({ epaisseur, largeur, coin = 0.1, pas = 5 }) {
  const hr = epaisseur / 2, hz = largeur / 2, c = Math.min(coin, hr * 0.9);
  const centres = [[hr - c, hz - c], [-(hr - c), hz - c], [-(hr - c), -(hz - c)], [hr - c, -(hz - c)]];
  const points = [];
  centres.forEach(([cr, cz], k) => {
    for (let j = 0; j <= pas; j++) {
      const t = (k + j / pas) * Math.PI / 2;
      points.push({ r: cr + c * Math.cos(t), z: cz + c * Math.sin(t), nr: Math.cos(t), nz: Math.sin(t) });
    }
  });
  return points;
}
function ruban({ epaisseur, largeur, segments = 480 }) {
  const P = profil({ epaisseur, largeur });
  const n = P.length;
  const pos = [], nor = [], prof = [], u = [], idx = [];
  for (let i = 0; i <= segments; i++) {
    for (const q of P) {
      pos.push(0, q.r, q.z);
      nor.push(0, q.nr, q.nz);
      prof.push(q.nr, q.nz);
      u.push(i / segments);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * n + j, b = i * n + (j + 1) % n, c = (i + 1) * n + j, d = (i + 1) * n + (j + 1) % n;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aProfil', new THREE.Float32BufferAttribute(prof, 2));
  g.setAttribute('aU', new THREE.Float32BufferAttribute(u, 1));
  g.setIndex(idx);
  return g;
}

// ---------- Matière : satin orange, liserés lumineux ; en rayon, elle devient lumière ----------
const uTemps = { value: 0 };
const uDefile = { value: 0 }; // avancée des impulsions de lumière le long des bandes
const VERTEX_RUBAN = `
  attribute vec2 aProfil; attribute float aU;
  varying vec2 vProfil; varying float vU; varying float vV;
  uniform float uTemps, uDecal, uProf, uPhase, uTorsion, uOuvre, uFusion, uDebut, uFin, uLargeur, uChaleur;
  uniform vec3 uDepart, uLune, uTravers;
  // ligne centrale de la bande : le chemin commun, écarté sur le côté, courbé et ondulé
  vec3 centreRuban(float s){
    float libre = 1.0 - uFusion;
    vec3 p = mix(uDepart, uLune, s);
    float ecart = uDecal * (0.8 + 0.55 * s) * (1.0 + 0.55 * uOuvre);
    float onde = sin(s * 6.0 + uPhase + uTemps * 0.2) * 0.42 + sin(s * 2.6 - uPhase * 1.3 + uTemps * 0.12) * 0.6;
    // un grand arc : la bande monte, puis se courbe vers la droite (au-delà, elle continue tout droit)
    float sc = min(s, 0.62);
    float courbe = -26.0 * (sc - 0.27) * (sc - 0.27) - 2.0 * 26.0 * (0.62 - 0.27) * max(s - 0.62, 0.0) + 1.6;
    p += uTravers * (ecart + courbe + onde * (1.0 + 0.8 * uOuvre)) * libre;
    p.z += (uProf + onde * 0.7) * libre;
    return p;
  }`;
function matiereRuban(couleur, r) {
  const u = {
    uTemps, uDefile,
    uDecal: { value: r.decal }, uProf: { value: r.prof }, uPhase: { value: r.phase }, uTorsion: { value: r.torsion },
    uOuvre: { value: 0 }, uFusion: { value: 0 }, uDebut: { value: 0 }, uFin: { value: FIN_REPOS },
    uLargeur: { value: 1 }, uChaleur: { value: 0 }, uEclair: { value: -1 }, uEclairForce: { value: 0 },
    uDepart: { value: DEPART }, uLune: { value: LUNE }, uTravers: { value: TRAVERS },
  };
  const m = new THREE.MeshPhysicalMaterial({
    color: couleur,
    roughness: 0.62,
    metalness: 0.0,
    clearcoat: 0.0,
    clearcoatRoughness: 0.45,
    sheen: 0.1,
    sheenColor: new THREE.Color(0xff6a20),
    sheenRoughness: 0.5,
    envMapIntensity: 0.05,
    side: THREE.DoubleSide,
  });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERTEX_RUBAN)
      .replace('#include <beginnormal_vertex>', `
        float rS = mix(uDebut, uFin, aU);
        vec3 rC = centreRuban(rS);
        vec3 rT = normalize(centreRuban(rS + 0.002) - centreRuban(rS - 0.002));
        vec3 rW = normalize(cross(rT, vec3(0.0, 0.0, 1.0)));   // largeur : dans le plan de l'écran
        vec3 rN = normalize(cross(rW, rT));                    // épaisseur : vers la caméra
        float rA = uTorsion + 0.35 * sin(rS * 4.0 + uPhase) + uOuvre * 0.7;
        vec3 rW2 = cos(rA) * rW + sin(rA) * rN;
        vec3 rN2 = cos(rA) * rN - sin(rA) * rW;
        // bouts refermés ; en rayon, la queue s'affine comme celle d'une étoile filante
        float rTaille = smoothstep(0.0, 0.012, aU) * smoothstep(1.0, 0.988, aU) * mix(1.0, pow(aU, 1.6), uChaleur);
        vec3 rDeforme = rC + (rN2 * position.y + rW2 * position.z * uLargeur) * rTaille;
        vec3 objectNormal = normalize(rN2 * normal.y + rW2 * normal.z);
        vProfil = aProfil; vU = rS; vV = aU;`)
      .replace('#include <begin_vertex>', 'vec3 transformed = rDeforme;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTemps; uniform float uDefile; uniform float uPhase; uniform float uChaleur; uniform float uEclair; uniform float uEclairForce; varying vec2 vProfil; varying float vU; varying float vV;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float arete = smoothstep(0.2, 0.46, abs(vProfil.x * vProfil.y));
        float avant = step(0.0, vProfil.x) * step(0.0, vProfil.y);
        // des impulsions de lumière filent vers le haut ; pendant le maintien elles accélèrent
        float flux = 1.0 - smoothstep(0.0, 0.05, abs(fract(vU * 2.4 - uDefile + uPhase) - 0.5));
        totalEmissiveRadiance += vec3(1.0, 0.42, 0.12) * arete * (0.25 + 0.9 * avant) * (0.7 + 2.6 * flux) * (1.0 - uChaleur);
        float rim = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 3.0);
        totalEmissiveRadiance += vec3(0.9, 0.22, 0.03) * rim * 0.35;
        // éclair : un trait blanc électrique file le long des arêtes, avec une traînée qui grésille
        float de = uEclair - vU;
        float trainee = de > 0.0 ? exp(-de * 22.0) : exp(de * 260.0);
        float gresil = 0.65 + 0.35 * sin(uTemps * 95.0 + vU * 140.0);
        totalEmissiveRadiance += vec3(1.0, 0.93, 0.86) * uEclairForce * trainee * gresil * (0.15 + 3.2 * arete);
        // en rayon : de la lumière pure, blanche à la tête, orange dans la queue
        float tete = pow(vV, 3.0);
        totalEmissiveRadiance += mix(vec3(1.0, 0.32, 0.04), vec3(1.0, 0.9, 0.78), tete) * uChaleur * (0.8 + 9.0 * tete);`);
  };
  m.userData.u = u;
  return m;
}

// ---------- La lune ----------
function texturesLune() {
  const L = 2048, H = 1024;
  const creer = () => { const c = document.createElement('canvas'); c.width = L; c.height = H; return [c, c.getContext('2d')]; };
  const [cAlb, a] = creer();
  const [cRel, r] = creer();
  a.fillStyle = '#e2703a'; a.fillRect(0, 0, L, H);
  r.fillStyle = '#808080'; r.fillRect(0, 0, L, H);
  let graine = 11;
  const alea = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647; };
  const rond = (ctx, x, y, rr, arrets) => {
    for (const dx of [-L, 0, L]) {
      const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, rr);
      for (const [o, c] of arrets) g.addColorStop(o, c);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x + dx, y, rr, 0, Math.PI * 2); ctx.fill();
    }
  };
  // mers sombres
  for (let i = 0; i < 18; i++) {
    const x = alea() * L, y = H * (0.22 + alea() * 0.56), rr = 70 + alea() * 230;
    rond(a, x, y, rr, [[0, 'rgba(110,34,8,.55)'], [0.7, 'rgba(110,34,8,.3)'], [1, 'rgba(110,34,8,0)']]);
    rond(r, x, y, rr, [[0, 'rgba(100,100,100,.35)'], [1, 'rgba(100,100,100,0)']]);
  }
  // cratères : creux sombre, rebord clair
  for (let i = 0; i < 1400; i++) {
    const x = alea() * L, y = H * (0.06 + alea() * 0.88), rr = 2 + Math.pow(alea(), 4.5) * 46;
    rond(r, x, y, rr, [[0, 'rgba(70,70,70,.6)'], [0.72, 'rgba(105,105,105,.4)'], [0.9, 'rgba(180,180,180,.45)'], [1, 'rgba(128,128,128,0)']]);
    rond(a, x, y, rr, [[0, 'rgba(120,40,10,.25)'], [0.85, 'rgba(255,170,120,.18)'], [1, 'rgba(0,0,0,0)']]);
  }
  // grain fin
  for (let i = 0; i < 60000; i++) {
    const v = Math.floor(alea() * 255);
    r.fillStyle = `rgba(${v},${v},${v},.18)`;
    r.fillRect(alea() * L, alea() * H, 1.5, 1.5);
  }
  const tAlb = new THREE.CanvasTexture(cAlb);
  tAlb.colorSpace = THREE.SRGBColorSpace;
  const tRel = new THREE.CanvasTexture(cRel);
  for (const t of [tAlb, tRel]) { t.anisotropy = rendu.capabilities.getMaxAnisotropy(); t.wrapS = THREE.RepeatWrapping; }
  return [tAlb, tRel];
}
const [albedoLune, reliefLune] = texturesLune();
const lune = new THREE.Group();
// la lune a son propre éclairage : un soleil de côté, toujours en croissant, comme le nom Qamar
// le soleil est placé pour que, vue depuis la fin de la séquence, la lune montre un large croissant éclairé à droite
const CAMERA_FIN = new THREE.Vector3(8, 23, -6.5);
const versCamera = CAMERA_FIN.clone().sub(LUNE).normalize();
const droite = new THREE.Vector3().crossVectors(versCamera, new THREE.Vector3(0, 1, 0)).normalize().negate();
const SOLEIL = versCamera.clone().multiplyScalar(0.45).add(droite.multiplyScalar(0.9)).add(new THREE.Vector3(0, 0.25, 0)).normalize();
const sphereLune = new THREE.Mesh(
  new THREE.SphereGeometry(1, 160, 120),
  new THREE.ShaderMaterial({
    uniforms: { uAlb: { value: albedoLune }, uRel: { value: reliefLune }, uSoleil: { value: SOLEIL }, uRelief: { value: 0.18 }, uImpact: { value: DEPART.clone().sub(LUNE).normalize() }, uFront: { value: 1.6 }, uBraise: { value: 0 } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      void main(){
        vUv = uv;
        vec4 p = modelMatrix * vec4(position, 1.);
        vP = p.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * p;
      }`,
    fragmentShader: `
      uniform sampler2D uAlb; uniform sampler2D uRel; uniform vec3 uSoleil; uniform float uRelief; uniform vec3 uImpact; uniform float uFront; uniform float uBraise;
      varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      void main(){
        vec3 n = normalize(vN);
        // relief des cratères à partir de la carte de hauteur
        float h = texture2D(uRel, vUv).r;
        vec3 dx = dFdx(vP), dy = dFdy(vP);
        vec3 r1 = cross(dy, n), r2 = cross(n, dx);
        float det = dot(dx, r1);
        vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
        n = normalize(abs(det) * n - grad * uRelief);
        vec3 alb = texture2D(uAlb, vUv).rgb;
        float ndl = dot(n, uSoleil);
        float lumiere = smoothstep(-0.04, 0.5, ndl) * (0.35 + 0.65 * max(ndl, 0.0));
        vec3 vue = normalize(cameraPosition - vP);
        float bord = pow(1.0 - max(dot(normalize(vN), vue), 0.0), 3.0);
        // grise au départ ; l'orange se répand depuis le point d'impact du rayon
        vec3 gris = vec3(dot(alb, vec3(0.3, 0.59, 0.11))) * vec3(0.92, 0.95, 1.04) * 1.15;
        float d = dot(normalize(vN), uImpact);
        float o = smoothstep(uFront - 0.45, uFront, d);
        // orange : des tons chauds nuancés (ombres rouge profond, lumière orange doré) au lieu d'un aplat
        vec3 chaud = mix(alb * vec3(0.75, 0.55, 0.45), alb * vec3(1.15, 1.05, 0.9), smoothstep(0.0, 0.8, ndl));
        vec3 base = mix(gris, chaud, o);
        vec3 c = base * (lumiere * 2.1 + 0.025);
        // braise le long du terminateur, très fine, puis une fine atmosphère sur le bord éclairé
        c += vec3(1.0, 0.33, 0.04) * smoothstep(0.18, 0.0, abs(ndl + 0.02)) * 0.22 * o * uBraise;
        c += mix(vec3(0.5, 0.56, 0.68), vec3(1.0, 0.5, 0.15), o) * pow(bord, 2.5) * (0.12 + 0.5 * smoothstep(-0.2, 0.6, ndl));
        // côté nuit : une très légère lueur orange une fois la lune allumée
        c += alb * 0.025 * o * uBraise;
        // un front de braise avance sur la surface
        float front = smoothstep(0.22, 0.0, abs(d - uFront + 0.12)) * step(-1.35, uFront) * step(uFront, 1.05);
        c += vec3(1.0, 0.45, 0.1) * front * 1.6;
        gl_FragColor = vec4(c, 1.0);
      }`,
    extensions: { derivatives: true },
  }),
);
lune.add(sphereLune);
// halo doux autour de la lune
const toileHalo = document.createElement('canvas');
toileHalo.width = toileHalo.height = 256;
{
  const g = toileHalo.getContext('2d');
  const d = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  // le disque de la lune occupe 1 / 1.6 du sprite : rien devant lui, une couronne juste autour
  const bordLune = 1 / 1.6;
  d.addColorStop(0, 'rgba(255,120,50,0)');
  d.addColorStop(bordLune - 0.02, 'rgba(255,120,50,0)');
  // une lueur fine collée au bord, qui s'éteint vite (pas d'anneau épais)
  d.addColorStop(bordLune, 'rgba(255,140,70,.26)');
  d.addColorStop(bordLune + 0.03, 'rgba(255,100,35,.12)');
  d.addColorStop(bordLune + 0.12, 'rgba(255,80,20,.04)');
  d.addColorStop(1, 'rgba(255,70,10,0)');
  g.fillStyle = d; g.fillRect(0, 0, 256, 256);
}
const texHalo = new THREE.CanvasTexture(toileHalo);
texHalo.colorSpace = THREE.SRGBColorSpace;
const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHalo, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
halo.scale.setScalar(3.2);
lune.add(halo);
lune.position.copy(LUNE);
lune.scale.setScalar(RAYON_LUNE);
scene.add(lune);
const GRIS_HALO = new THREE.Color(0.35, 0.4, 0.5), BLANC = new THREE.Color(1, 1, 1);
function poserLune(t) {
  const allume = t < 0 ? 0 : lisse(7.0, 8.3, t);
  const m = sphereLune.material.uniforms;
  m.uFront.value = 1.6 - 3.0 * allume;
  m.uBraise.value = t < 0 ? 0 : 0.5 * lisse(7.0, 8.6, t);
  halo.material.color.copy(GRIS_HALO).lerp(BLANC, allume);
  halo.material.opacity = 0.2 + 0.5 * allume;
}

// ---------- Les bandes ----------
// six bandes côte à côte, à des profondeurs différentes : un éventail en diagonale sur tout l'accueil
const COULEURS = [0x7a2500, 0x541700, 0x922f00];
const reglages = [
  { decal: -7.4, prof: 0.8, phase: 0.0, torsion: 0.55, c: 1 },
  { decal: -5.0, prof: -0.6, phase: 1.3, torsion: 0.70, c: 0 },
  { decal: -2.6, prof: 1.0, phase: 2.1, torsion: 0.50, c: 2 },
  { decal: -0.2, prof: -1.0, phase: 3.4, torsion: 0.75, c: 0 },
  { decal: 2.2, prof: 0.4, phase: 4.2, torsion: 0.60, c: 1 },
  { decal: 4.6, prof: -1.6, phase: 5.5, torsion: 0.65, c: 2 },
];
const geoRuban = ruban({ epaisseur: 0.28, largeur: 2.0 });
const bandes = reglages.map((r) => {
  const mesh = new THREE.Mesh(geoRuban, matiereRuban(COULEURS[r.c], r));
  mesh.frustumCulled = false; // la forme est calculée dans le shader
  scene.add(mesh);
  return { mesh, u: mesh.material.userData.u };
});

// éclairs : de temps en temps, une bande au hasard est parcourue par un trait de lumière blanche
const eclair = { bande: null, t: 0, attente: 1.8 };
function animerEclairs(dt, permis) {
  if (eclair.bande) {
    eclair.t += dt / 0.75;
    const u = eclair.bande.u;
    u.uEclair.value = 0.08 + eclair.t * 0.62;
    u.uEclairForce.value = Math.sin(Math.min(eclair.t, 1) * Math.PI) ** 0.6;
    if (eclair.t >= 1) { u.uEclairForce.value = 0; eclair.bande = null; eclair.attente = 2.2 + Math.random() * 3.5; }
  } else if (permis && !reduit) {
    eclair.attente -= dt;
    if (eclair.attente <= 0) { eclair.bande = bandes[Math.floor(Math.random() * bandes.length)]; eclair.t = 0; }
  }
}

// état des bandes à l'instant t de la séquence (t < 0 : au repos)
const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
function poserBandes(t) {
  bandes.forEach((b, i) => {
    const u = b.u;
    if (t < 0) {
      u.uOuvre.value = 0; u.uFusion.value = 0; u.uDebut.value = 0; u.uFin.value = FIN_REPOS;
      u.uLargeur.value = 1; u.uChaleur.value = 0;
      b.mesh.visible = true;
      return;
    }
    const fusion = lisse(2.6 + i * 0.4, 3.8 + i * 0.4, t);               // une à une, elles rejoignent le chemin commun
    const montee = Math.pow(clamp01((t - 1.0) / 6.0), 2.6);               // la tête file vers la lune, de plus en plus vite
    // la tête s'allonge d'abord hors du cadre (on ne voit jamais un bout coupé), puis file vers la lune
    const fin = Math.min(FIN_REPOS + 0.16 * lisse(0, 2.2, t) + (S_LUNE - FIN_REPOS - 0.16) * montee, S_LUNE);
    const longueur = FIN_REPOS - (FIN_REPOS - 0.09) * Math.pow(clamp01((t - 0.5 - i * 0.08) / 5.5), 1.4); // la queue remonte
    let debut = Math.max(0, fin - longueur);
    debut += (fin - debut) * lisse(7.0, 7.35, t);                          // le rayon entre dans la lune
    u.uOuvre.value = lisse(0, 1.3, t) * (1 - fusion);
    u.uFusion.value = fusion;
    u.uDebut.value = debut;
    u.uFin.value = fin;
    u.uLargeur.value = 1 - 0.92 * fusion;
    u.uChaleur.value = lisse(2.3 + i * 0.4, 4.3 + i * 0.4, t);
    b.mesh.visible = fin - debut > 0.002; // une fois entré dans la lune, le rayon disparaît
  });
}

// ---------- Trait de lumière ----------
// chaque étoile file le long d'un segment droit (axe X local) ; on la replace au hasard à chaque passage
const geoFilante = new THREE.TubeGeometry(
  new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)), 64, 1, 6, false,
);
function nouvelleFilante() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTete: { value: -1 }, uForce: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `
      varying vec2 vUv; uniform float uTete; uniform float uForce;
      void main(){
        float d = uTete - vUv.x;
        float queue = smoothstep(0.32, 0.0, d) * step(0.0, d);
        float tete = smoothstep(0.012, 0.0, abs(d));
        vec3 c = mix(vec3(1.0,0.5,0.2), vec3(1.0,0.96,0.92), queue*queue);
        gl_FragColor = vec4(c, (queue * 0.55 + tete * 0.9) * uForce);
      }`,
  });
}
const filantes = [];
const groupeFilantes = new THREE.Group();
for (let i = 0; i < 4; i++) {
  const m = new THREE.Mesh(geoFilante, nouvelleFilante());
  m.frustumCulled = false;
  // décalage de départ pour qu'elles ne passent jamais ensemble
  filantes.push({ m, t: 0, duree: 1, attente: 1.5 + i * 2.6 + Math.random() * 2 });
  groupeFilantes.add(m);
}
scene.add(groupeFilantes);
function lancerFilante(f) {
  const z = -14 + Math.random() * 12;             // de très loin à mi-distance : la profondeur fait varier taille et vitesse apparentes
  const loin = (16 - z) / 16;
  const longueur = (5 + Math.random() * 5) * loin;
  const angle = THREE.MathUtils.degToRad(195 + Math.random() * 30); // vers le bas-gauche
  f.m.position.set((Math.random() * 1.2 - 0.1) * 9 * loin, (Math.random() * 0.8 + 0.1) * 6 * loin, z);
  f.m.rotation.set(0, 0, angle);
  f.m.scale.set(longueur, 0.028 * loin, 0.028 * loin);
  f.t = 0;
  f.duree = 0.9 + Math.random() * 0.8;
  f.attente = 0; // elle part tout de suite ; la prochaine attente est tirée à l'arrivée
}
function animerFilantes(dt, force) {
  for (const f of filantes) {
    if (f.attente > 0) { f.attente -= dt; f.m.material.uniforms.uForce.value = 0; if (f.attente <= 0) lancerFilante(f); continue; }
    f.t += dt / f.duree;
    const u = f.m.material.uniforms;
    u.uTete.value = f.t * 1.35;
    u.uForce.value = force * Math.sin(Math.min(f.t, 1) * Math.PI) * 0.9;
    if (f.t >= 1) f.attente = 4 + Math.random() * 7;
  }
}

// ---------- Ciel lointain : un voile d'étoiles fixes, très loin, pour donner de la profondeur ----------
const NB_CIEL = 1400;
const posCiel = new Float32Array(NB_CIEL * 3);
const taillesCiel = new Float32Array(NB_CIEL);
for (let i = 0; i < NB_CIEL; i++) {
  posCiel[i * 3] = (Math.random() - 0.5) * 120;
  posCiel[i * 3 + 1] = (Math.random() - 0.5) * 80;
  posCiel[i * 3 + 2] = -40 - Math.random() * 40;
  taillesCiel[i] = Math.random() < 0.07 ? 3.2 : 1.2 + Math.random() * 1.4;
}
const geoCiel = new THREE.BufferGeometry();
geoCiel.setAttribute('position', new THREE.BufferAttribute(posCiel, 3));
geoCiel.setAttribute('aTaille', new THREE.BufferAttribute(taillesCiel, 1));
const ciel = new THREE.Points(geoCiel, new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: { uTemps: { value: 0 }, uForce: { value: 1 }, uPixel: { value: 1 } },
  vertexShader: `
    attribute float aTaille; uniform float uTemps; uniform float uPixel; varying float vEclat;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.);
      gl_Position = projectionMatrix * mv;
      // scintillement lent, différent pour chaque étoile
      vEclat = 0.55 + 0.45 * sin(uTemps * (0.4 + fract(position.x * 0.37) * 0.9) + position.y * 3.1);
      gl_PointSize = aTaille * uPixel;
    }`,
  fragmentShader: `
    uniform float uForce; varying float vEclat;
    void main(){
      float r = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, r);
      gl_FragColor = vec4(vec3(1.0, 0.86, 0.76), a * vEclat * 0.85 * uForce);
    }`,
}));
scene.add(ciel);

// ---------- Poussières lumineuses ----------
const NB = 520;
const posPoussiere = new Float32Array(NB * 3);
for (let i = 0; i < NB; i++) {
  posPoussiere[i * 3] = (Math.random() - 0.5) * 30;
  posPoussiere[i * 3 + 1] = (Math.random() - 0.5) * 22;
  posPoussiere[i * 3 + 2] = -12 + Math.random() * 16;
}
const geoPoussiere = new THREE.BufferGeometry();
geoPoussiere.setAttribute('position', new THREE.BufferAttribute(posPoussiere, 3));
const poussiere = new THREE.Points(geoPoussiere, new THREE.PointsMaterial({
  color: 0xff8a50, size: 0.045, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
}));
scene.add(poussiere);


// ---------- Ouverture : une ville de nuit traversée par des fibres optiques ----------
// La caméra part au ras de l'avenue. Les fenêtres s'allument, les fibres orange filent dans les rues,
// se rejoignent puis montent vers le ciel, où elles deviennent les bandes de l'accueil.
const SOL = -60;
const ecranEtroit = innerWidth < 760;
const racineDoc = document.documentElement;
const introVoulue = racineDoc.classList.contains('intro-ville');
const uVille = {
  uBrume: { value: new THREE.Color(0x05070d) }, uBrumePres: { value: 25 }, uBrumeLoin: { value: 165 },
  uAllume: { value: 0 },
};
const ville = new THREE.Group();
ville.visible = false;
scene.add(ville);
const fibres = [];
function construireVille() {
  let graine = 7;
  const alea = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647; };
  // les immeubles : un pavé par bâtiment, les fenêtres sont dessinées dans le shader
  const rues = [-30, -75, -122];                       // rues transversales (z)
  const pas = ecranEtroit ? 7.5 : 5.6;
  const blocs = [];
  for (let x = -96; x <= 96; x += pas) {
    for (let z = -178; z <= 22; z += pas) {
      const l = pas * (0.62 + alea() * 0.3), p = pas * (0.62 + alea() * 0.3);
      const cx = x + (alea() - 0.5) * 0.8, cz = z + (alea() - 0.5) * 0.8;
      if (Math.abs(cx) - l / 2 < 7.2) continue;                         // l'avenue reste libre
      if (rues.some((r) => Math.abs(cz - r) - p / 2 < 3.6)) continue;  // les rues aussi
      const pres = Math.abs(cx) < 22 && cz > -90;
      let h = 5 + Math.pow(alea(), 1.8) * 16;
      if (alea() < (pres ? 0.16 : 0.08)) h = 24 + alea() * 20;           // quelques tours
      blocs.push([cx, cz, l, p, h, alea()]);
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const matiere = new THREE.ShaderMaterial({
    uniforms: uVille,
    vertexShader: `
      attribute float aGraine;
      varying vec3 vMonde; varying vec3 vNormale; varying float vGraine; varying float vHaut;
      void main(){
        vec4 m = modelMatrix * instanceMatrix * vec4(position, 1.);
        vMonde = m.xyz;
        vNormale = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vGraine = aGraine; vHaut = position.y;
        gl_Position = projectionMatrix * viewMatrix * m;
      }`,
    fragmentShader: `
      uniform vec3 uBrume; uniform float uBrumePres; uniform float uBrumeLoin; uniform float uAllume;
      varying vec3 vMonde; varying vec3 vNormale; varying float vGraine; varying float vHaut;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main(){
        vec3 n = normalize(vNormale);
        vec3 base = vec3(0.016, 0.02, 0.03);
        vec3 c = base * (0.45 + 0.7 * vHaut);
        if (abs(n.y) < 0.5) {
          vec2 f = abs(n.x) > 0.5 ? vec2(vMonde.z, vMonde.y) : vec2(vMonde.x, vMonde.y);
          vec2 cel = f / vec2(0.66, 0.82);
          vec2 id = floor(cel), g = fract(cel);
          float fen = step(0.2, g.x) * step(g.x, 0.8) * step(0.24, g.y) * step(g.y, 0.78);
          float r = h(vec3(id, vGraine * 91.7 + n.x * 3.0 + n.z * 7.0));
          float etage = h(vec3(id.y, vGraine * 13.1, n.x + 2.0 * n.z));
          float allume = clamp(step(0.87, r) + step(0.955, etage) * step(0.35, r), 0.0, 1.0);
          allume *= step(h(vec3(id, vGraine * 3.3)), uAllume);
          vec3 teinte = mix(vec3(1.0, 0.56, 0.24), vec3(1.0, 0.8, 0.58), h(vec3(id.yx, vGraine)));
          teinte = mix(teinte, vec3(0.62, 0.72, 1.0), step(0.94, h(vec3(id, vGraine + 4.0))));
          c += fen * vec3(0.025, 0.03, 0.045) * (0.4 + vHaut);
          c += fen * allume * teinte * (0.45 + 0.4 * h(vec3(id, 5.0)));
          // au pied des façades de l'avenue, la lueur orange des fibres
          c += vec3(0.4, 0.1, 0.015) * exp(-max(abs(vMonde.x) - 7.0, 0.0) * 0.5) * exp(-(vMonde.y + 60.0) * 0.45) * 0.5;
        } else {
          c = base * 0.7;
        }
        float d = length(vMonde - cameraPosition);
        c = mix(c, uBrume, smoothstep(uBrumePres, uBrumeLoin, d));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const immeubles = new THREE.InstancedMesh(geo, matiere, blocs.length);
  const graines = new Float32Array(blocs.length);
  const m4 = new THREE.Matrix4();
  blocs.forEach(([x, z, l, p, h, g], i) => {
    m4.makeScale(l, h, p).setPosition(x, SOL, z);
    immeubles.setMatrixAt(i, m4);
    graines[i] = g;
  });
  geo.setAttribute('aGraine', new THREE.InstancedBufferAttribute(graines, 1));
  immeubles.frustumCulled = false;
  ville.add(immeubles);

  // le sol : asphalte sombre, l'avenue réchauffée par les fibres
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(420, 420).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: uVille,
    vertexShader: 'varying vec3 vMonde; void main(){ vec4 m = modelMatrix * vec4(position,1.); vMonde = m.xyz; gl_Position = projectionMatrix * viewMatrix * m; }',
    fragmentShader: `
      uniform vec3 uBrume; uniform float uBrumePres; uniform float uBrumeLoin;
      varying vec3 vMonde;
      void main(){
        vec3 c = vec3(0.008, 0.009, 0.012);
        float trottoir = smoothstep(0.06, 0.0, abs(abs(vMonde.x) - 7.0));
        c += vec3(0.03, 0.03, 0.035) * trottoir;
        c += vec3(0.32, 0.08, 0.01) * exp(-max(abs(vMonde.x) - 2.6, 0.0) * 0.9) * step(vMonde.z, -4.0) * 0.4;
        float d = length(vMonde - cameraPosition);
        c = mix(c, uBrume, smoothstep(uBrumePres, uBrumeLoin, d));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  sol.position.y = SOL;
  ville.add(sol);

  // réverbères le long de l'avenue, et feux rouges au sommet des tours
  const toileLampe = document.createElement('canvas');
  toileLampe.width = toileLampe.height = 64;
  {
    const g = toileLampe.getContext('2d');
    const d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    d.addColorStop(0, 'rgba(255,230,200,1)'); d.addColorStop(0.25, 'rgba(255,160,80,.5)'); d.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = d; g.fillRect(0, 0, 64, 64);
  }
  const texLampe = new THREE.CanvasTexture(toileLampe);
  const lampes = [];
  for (let z = -170; z <= 20; z += 10) lampes.push(-7.6, SOL + 4.6, z, 7.6, SOL + 4.6, z + 5);
  const geoLampes = new THREE.BufferGeometry();
  geoLampes.setAttribute('position', new THREE.Float32BufferAttribute(lampes, 3));
  ville.add(new THREE.Points(geoLampes, new THREE.PointsMaterial({ map: texLampe, size: 1.6, color: 0xffb070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  const feux = [];
  blocs.forEach(([x, z, , , h]) => { if (h > 26) feux.push(x, SOL + h + 0.4, z); });
  const geoFeux = new THREE.BufferGeometry();
  geoFeux.setAttribute('position', new THREE.Float32BufferAttribute(feux, 3));
  const matFeux = new THREE.PointsMaterial({ map: texLampe, size: 1.1, color: 0xff3010, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  ville.add(new THREE.Points(geoFeux, matFeux));
  ville.userData.feux = matFeux;

  // les fibres : elles arrivent par les rues, se rejoignent dans l'avenue puis montent vers les bandes
  const matFibre = (phase) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTemps, uPhase: { value: phase }, uTrace: { value: 0 }, uForce: { value: 1 }, uBrumeLoin: uVille.uBrumeLoin },
    vertexShader: 'varying vec2 vUv; varying float vD; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `
      uniform float uTemps; uniform float uPhase; uniform float uTrace; uniform float uForce; uniform float uBrumeLoin;
      varying vec2 vUv; varying float vD;
      void main(){
        float u = vUv.x;
        float flux = pow(1.0 - abs(fract(u * 6.0 - uTemps * 0.7 + uPhase) - 0.5) * 2.0, 16.0);
        float trace = smoothstep(uTrace, uTrace - 0.04, u);
        float tete = smoothstep(0.03, 0.0, abs(u - uTrace)) * step(uTrace, 0.999);
        float bouts = smoothstep(1.0, 0.9, u) * smoothstep(0.0, 0.02, u);
        vec3 c = mix(vec3(1.0, 0.33, 0.04), vec3(1.0, 0.86, 0.68), flux);
        float a = ((0.75 + 2.4 * flux) * trace + 3.5 * tete) * bouts * uForce;
        a *= 1.0 - smoothstep(uBrumeLoin * 0.85, uBrumeLoin * 1.25, vD);
        gl_FragColor = vec4(c, a);
      }`,
  });
  reglages.forEach((r, i) => {
    // là où commence la bande correspondante (bas de l'écran, sous l'accueil)
    const k = r.decal * 0.8 - 0.3;
    const E = DEPART.clone().addScaledVector(TRAVERS, k); E.z += r.prof;
    const x = -2.5 + i, S = SOL + 0.3;
    const arrivee = i < 2
      ? [[-96, S, -30 + (i - 0.5) * 1.2], [-14, S, -30 + (i - 0.5) * 1.2], [x * 0.9, S, -22]]
      : i < 4
        ? [[x, S, -180], [x, S, -90], [x, S, -40]]
        : [[96, S, -75 + (i - 4.5) * 1.2], [14, S, -75 + (i - 4.5) * 1.2], [x * 0.9, S, -62], [x, S, -36]];
    const pts = [...arrivee, [x, S, -14], [x, S + 0.4, -9.5], [x * 0.9, S + 9, -7], [x + (E.x - x) * 0.45, -32, -2 + (E.z + 2) * 0.4], [E.x, E.y - 2.5, E.z], [E.x, E.y, E.z]]
      .map((q) => new THREE.Vector3(...q));
    const courbe = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const tube = new THREE.Mesh(new THREE.TubeGeometry(courbe, ecranEtroit ? 220 : 420, 0.085, 6, false), matFibre(i * 0.37));
    tube.frustumCulled = false;
    ville.add(tube);
    fibres.push({ u: tube.material.uniforms, retard: i * 0.12 });
  });
  ville.visible = true;
}
const intro = { active: false, t: 0, vitesse: 1 };
const DUREE_INTRO = 7.6;
const brumeVille = new THREE.Color(0x05070d), brumeNoire = new THREE.Color(0x000000);
const clesIntro = [
  { t: 0, p: [0, SOL + 1.9, 26], c: [0, SOL + 0.6, -60] },
  { t: 2.5, p: [0, SOL + 2.6, 12], c: [0, SOL + 8, -30] },
  { t: 4.2, p: [0.6, SOL + 12, 6], c: [-2, SOL + 34, -6] },
  { t: 5.9, p: [-1, -24, 16], c: [-4, -8, -1] },
  { t: DUREE_INTRO, p: [0, 0, 16], c: [0, 0, 0] },
];
const cheminIntroP = new THREE.CatmullRomCurve3(clesIntro.map((k) => new THREE.Vector3(...k.p)), false, 'centripetal');
const cheminIntroC = new THREE.CatmullRomCurve3(clesIntro.map((k) => new THREE.Vector3(...k.c)), false, 'centripetal');
function poseIntro(t, repos) {
  cheminIntroP.points[clesIntro.length - 1].copy(repos.p);
  cheminIntroC.points[clesIntro.length - 1].copy(repos.c);
  let i = 0;
  while (i < clesIntro.length - 2 && t > clesIntro[i + 1].t) i++;
  const a = clesIntro[i], b = clesIntro[i + 1];
  let f = THREE.MathUtils.clamp((t - a.t) / (b.t - a.t), 0, 1);
  f = f * f * (3 - 2 * f);
  const u = (i + f) / (clesIntro.length - 1);
  camera.position.copy(cheminIntroP.getPoint(u));
  camera.lookAt(cheminIntroC.getPoint(u));
}
function lancerIntro() {
  if (!introVoulue || reduit || scrollY > 40) { terminerIntro(true); return; }
  construireVille();
  camera.far = 260; camera.updateProjectionMatrix();
  intro.active = true;
  racineDoc.classList.add('intro-lancee');
  const accelerer = () => { if (intro.active) intro.vitesse = 4.5; };
  document.querySelector('.intro-passer')?.addEventListener('click', accelerer);
  addEventListener('wheel', accelerer, { passive: true });
  addEventListener('touchmove', accelerer, { passive: true });
  addEventListener('keydown', accelerer);
}
function terminerIntro(direct) {
  intro.active = false;
  racineDoc.classList.add('intro-texte');
  racineDoc.classList.remove('intro-ville');
  try { sessionStorage.setItem('qamar-intro-vue', '1'); } catch (e) { /* stockage indisponible */ }
  rendu.toneMappingExposure = 1;
  camera.far = 140; camera.updateProjectionMatrix();
  scene.fog.color.copy(brumeNoire);
  scene.fog.near = 13; scene.fog.far = 31;
  if (!direct) {
    // la ville ne sert plus : on libère la mémoire
    ville.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
  }
  scene.remove(ville);
}
function animerIntro(dt, repos) {
  intro.t += dt * intro.vitesse;
  const t = Math.min(intro.t, DUREE_INTRO);
  rendu.toneMappingExposure = lisse(0, 1.3, t);
  uVille.uAllume.value = lisse(0.2, 2.4, t);
  fibres.forEach((f) => { f.u.uTrace.value = (0.74 * lisse(0.2 + f.retard, 2.4 + f.retard, t) + 0.26 * lisse(2.4 + f.retard, 4.3 + f.retard, t)) * 1.001; f.u.uForce.value = 1 - lisse(6.6, 7.5, t); });
  // la brume bleu nuit de la ville laisse la place au noir de l'accueil
  const b = lisse(4.8, 7.2, t);
  scene.fog.color.copy(brumeVille).lerp(brumeNoire, b);
  scene.fog.near = THREE.MathUtils.lerp(25, 13, b);
  scene.fog.far = THREE.MathUtils.lerp(165, 31, b);
  uVille.uBrume.value.copy(scene.fog.color);
  uVille.uBrumePres.value = scene.fog.near;
  uVille.uBrumeLoin.value = scene.fog.far;
  ville.userData.feux.opacity = 0.5 + 0.5 * Math.sin(temps * 3.2);
  lueur.strength = 0.32 + 0.35 * (1 - b);
  if (t > 3.2) racineDoc.classList.add('intro-texte');
  poseIntro(t, repos);
  if (intro.t >= DUREE_INTRO) terminerIntro(false);
}

// ---------- Post-traitement ----------
const composeur = new EffectComposer(rendu);
composeur.addPass(new RenderPass(scene, camera));
const lueur = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.4, 0.9);
composeur.addPass(lueur);
// au relâchement : distorsion fisheye et aberration chromatique
const passeFisheye = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uForce: { value: 0 }, uRapport: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uForce; uniform float uRapport; varying vec2 vUv;
    vec2 deformer(vec2 uv, float k){
      vec2 c = uv - 0.5; c.x *= uRapport;
      float r2 = dot(c, c);
      c *= 1.0 - k * (1.0 - r2 * 1.6);
      c.x /= uRapport;
      return c + 0.5;
    }
    void main(){
      if (uForce < 0.001) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
      float k = uForce * 0.6;
      vec4 g = texture2D(tDiffuse, deformer(vUv, k));
      float r = texture2D(tDiffuse, deformer(vUv, k * 1.12)).r;
      float b = texture2D(tDiffuse, deformer(vUv, k * 0.86)).b;
      gl_FragColor = vec4(vec3(r, g.g, b) + uForce * 0.1, 1.0);
    }`,
});
composeur.addPass(passeFisheye);
composeur.addPass(new OutputPass());
// finition : grain de film et léger vignettage
const finition = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTemps: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTemps; varying vec2 vUv;
    float bruit(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = vUv - 0.5;
      c.rgb *= 1.0 - dot(q, q) * 0.55;
      c.rgb += (bruit(gl_FragCoord.xy + fract(uTemps * 7.0) * 97.0) - 0.5) * 0.035;
      gl_FragColor = c;
    }`,
});
composeur.addPass(finition);

// ---------- Mots révélés pendant le maintien ----------
// chaque mot : les lettres s'allument une à une, clignotent dans le désordre, restent, puis s'éteignent
const MOTS_DEBUT = [0.45, 2.3, 4.3, 7.0]; // Imaginer, Créer, Affiner… et « Briller » quand la lune s'allume
const PAS = 0.022, APPARITION = 0.08, CLIGNE = 0.03, ATTENTE = 0.6;
const melange = (n) => {
  const t = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
  return t;
};
const mots = [...document.querySelectorAll('.maintien-mot')].map((el) => {
  const texte = el.textContent.trim();
  el.textContent = '';
  const lettres = [...texte].map((c) => {
    const s = document.createElement('span');
    s.textContent = c;
    el.appendChild(s);
    return s;
  });
  return { lettres, cles: [] };
});
function preparerMots() {
  mots.forEach((m, w) => {
    const n = m.lettres.length, s = MOTS_DEBUT[w];
    const A = s + (n - 1) * PAS + APPARITION;
    const A2 = A + (n - 1) * PAS + CLIGNE;
    const X = A2 + (n - 1) * PAS + CLIGNE + ATTENTE;
    const o1 = melange(n), o2 = melange(n), o3 = melange(n);
    m.cles = m.lettres.map((_, i) => [
      [s + i * PAS, 0], [s + i * PAS + APPARITION, 1],
      [A + o1[i] * PAS, 1], [A + o1[i] * PAS + CLIGNE, 0.12],
      [A2 + o2[i] * PAS, 0.12], [A2 + o2[i] * PAS + CLIGNE, 1],
      [X + o3[i] * PAS, 1], [X + o3[i] * PAS + CLIGNE, 0],
    ]);
  });
}
function valeur(cles, t) {
  if (t <= cles[0][0]) return 0;
  for (let i = 1; i < cles.length; i++) {
    if (t <= cles[i][0]) {
      const [t0, v0] = cles[i - 1], [t1, v1] = cles[i];
      return v0 + (v1 - v0) * ((t - t0) / Math.max(t1 - t0, 1e-4));
    }
  }
  return cles[cles.length - 1][1];
}
function dessinerMots(t) {
  for (const m of mots) m.lettres.forEach((l, i) => { l.style.opacity = t < 0 ? 0 : valeur(m.cles[i], t).toFixed(3); });
}

// ---------- Séquence du maintien (9 secondes) ----------
const DUREE = 9;
// trajet de la caméra : elle suit les bandes qui montent, puis le rayon jusqu'à la lune
const cles = [
  { t: 0, p: [0, 0, 16], c: [0, 0, 0] },
  { t: 1.8, p: [-1, 1.5, 13], c: [1.5, 3, -4] },
  { t: 4.0, p: [-3, 7, 9], c: [5, 10, -8] },
  { t: 6.0, p: [-1, 15, 5], c: [12, 22, -14] },
  { t: 7.4, p: [4, 20, 1], c: [15, 27, -16] },
  { t: 9.0, p: [CAMERA_FIN.x, CAMERA_FIN.y, CAMERA_FIN.z], c: [15, 27, -16] },
];
const cheminP = new THREE.CatmullRomCurve3(cles.map((k) => new THREE.Vector3(...k.p)), false, 'centripetal');
const cheminC = new THREE.CatmullRomCurve3(cles.map((k) => new THREE.Vector3(...k.c)), false, 'centripetal');
const pose = { p: new THREE.Vector3(), c: new THREE.Vector3() };
function poseCamera(t) {
  let i = 0;
  while (i < cles.length - 2 && t > cles[i + 1].t) i++;
  const a = cles[i], b = cles[i + 1];
  let f = THREE.MathUtils.clamp((t - a.t) / (b.t - a.t), 0, 1);
  if (i === 0) f = f * f * (3 - 2 * f);
  if (i === cles.length - 2) f = 1 - (1 - f) * (1 - f);
  const u = (i + f) / (cles.length - 1);
  pose.p.copy(cheminP.getPoint(u));
  pose.c.copy(cheminC.getPoint(u));
}

// ---------- Interaction ----------
const racine = document.documentElement;
const zone = document.querySelector('.hero');
const curseur = document.querySelector('.curseur-maintien');
const progres = curseur?.querySelector('.progres');
const CIRCONF = progres ? 2 * Math.PI * progres.r.baseVal.value : 0;
if (progres) progres.style.strokeDasharray = CIRCONF;

const souris = { x: 0, y: 0, cx: 0, cy: 0, px: 0, py: 0, kx: 0, ky: 0, bouge: false };
let tenu = false, tMaintien = 0, flash = 0;
const INTERACTIF = 'a, button, [role="button"], input, select, textarea, label';

addEventListener('pointermove', (e) => {
  souris.x = e.clientX / innerWidth - 0.5;
  souris.y = e.clientY / innerHeight - 0.5;
  souris.px = e.clientX; souris.py = e.clientY;
  if (!souris.bouge) { souris.kx = e.clientX; souris.ky = e.clientY; souris.bouge = true; }
}, { passive: true });

zone.addEventListener('pointerover', (e) => {
  curseur?.classList.add('visible');
  curseur?.classList.toggle('cache', !tenu && !!e.target.closest(INTERACTIF));
});
zone.addEventListener('pointerdown', (e) => {
  if (reduit || e.button !== 0 || !e.isPrimary || e.target.closest(INTERACTIF)) return;
  e.preventDefault();
  commencer();
});
addEventListener('pointerup', () => tenu && finir());
addEventListener('pointercancel', () => tenu && finir());
addEventListener('blur', () => tenu && finir());
zone.addEventListener('pointerleave', () => { if (tenu) finir(); curseur?.classList.remove('visible'); });

function commencer() {
  if (scrollY > innerHeight * 0.5 || intro.active) return;
  tenu = true;
  tMaintien = 0;
  flash = 0;
  preparerMots();
  cles[0].p = [camera.position.x, camera.position.y, camera.position.z];
  cheminP.points[0].copy(camera.position);
  racine.classList.add('maintien-actif');
  curseur?.classList.add('appuye');
  curseur?.classList.remove('cache');
}
function finir() {
  tenu = false;
  flash = 1;
  racine.classList.remove('maintien-actif');
  curseur?.classList.remove('appuye');
  dessinerMots(-1);
}

// ---------- Taille ----------
let largeur = 0, hauteur = 0;
function redimensionner() {
  const l = innerWidth, h = innerHeight;
  if (l === largeur && h === hauteur) return;
  largeur = l; hauteur = h;
  const ratio = Math.min(devicePixelRatio, l < 760 ? 1.25 : 1.5);
  rendu.setPixelRatio(ratio);
  rendu.setSize(l, h, false);
  composeur.setPixelRatio(ratio);
  composeur.setSize(l, h);
  passeFisheye.uniforms.uRapport.value = l / h;
  camera.aspect = l / h;
  camera.zoom = Math.min(1, Math.pow(camera.aspect / 1.25, 0.75)); // portrait : champ plus large
  camera.updateProjectionMatrix();
}
redimensionner();
addEventListener('resize', redimensionner);

// ---------- Rendu seulement quand une zone transparente est à l'écran ----------
const horloge = new THREE.Clock();
let actif = true;
const visibles = new Set();
const veille = new IntersectionObserver((entrees) => {
  for (const e of entrees) e.isIntersecting ? visibles.add(e.target) : visibles.delete(e.target);
  const avant = actif;
  actif = visibles.size > 0;
  if (actif && !avant) { horloge.getDelta(); requestAnimationFrame(boucle); }
});
document.querySelectorAll('[data-rubans]').forEach((el) => veille.observe(el));

// ---------- Boucle ----------
let temps = 0;
const repos = { p: new THREE.Vector3(), c: new THREE.Vector3() };
function boucle() {
  if (!actif) return;
  redimensionner();
  const dt = Math.min(horloge.getDelta(), 0.05);
  temps += reduit ? 0 : dt;
  uTemps.value = temps;
  finition.uniforms.uTemps.value = temps;

  souris.kx += (souris.px - souris.kx) * 0.2;
  souris.ky += (souris.py - souris.ky) * 0.2;
  if (curseur) curseur.style.transform = `translate(${souris.kx}px, ${souris.ky}px)`;
  souris.cx += (souris.x - souris.cx) * Math.min(1, dt * 2.5);
  souris.cy += (souris.y - souris.cy) * Math.min(1, dt * 2.5);

  sphereLune.rotation.y = temps * 0.03;

  ciel.material.uniforms.uTemps.value = temps;
  ciel.material.uniforms.uPixel.value = rendu.getPixelRatio();
  {
    if (tenu) {
      tMaintien += dt;
      const t = Math.min(tMaintien, DUREE);
      if (progres) progres.style.strokeDashoffset = CIRCONF * (1 - t / DUREE);
      poserBandes(t);
      poserLune(t);
      // les impulsions de lumière accélèrent avec la montée
      uDefile.value += dt * (0.06 + 2.2 * lisse(0.5, 5, t));
      const impact = lisse(6.9, 7.05, t) * (1 - lisse(7.1, 8.2, t));
      lueur.strength = 0.32 + 0.3 * lisse(2.5, 5, t) * (1 - lisse(7.2, 8.5, t)) + 1.2 * impact - 0.17 * lisse(7.6, 8.6, t);
      lueur.threshold = 0.9 + 0.08 * lisse(7.6, 8.6, t);
      poussiere.material.opacity = 0.55 * (1 - lisse(0, 6, tMaintien));
      scene.fog.near = 13 + lisse(2, 6, t) * 30;
      scene.fog.far = 31 + lisse(2, 6, t) * 60;
      poseCamera(t);
      camera.position.copy(pose.p);
      camera.lookAt(pose.c);
      dessinerMots(tMaintien);
    } else {
      if (progres) progres.style.strokeDashoffset = CIRCONF;
      // au repos, les bandes restent en place et ondulent à peine ; la caméra suit un peu la souris
      poserBandes(-1);
      poserLune(-1);
      uDefile.value += dt * 0.06;
      if (!intro.active) lueur.strength = 0.32;
      lueur.threshold = 0.9;
      poussiere.material.opacity = 0.55;
      if (!intro.active) { scene.fog.near = 13; scene.fog.far = 31; }
      const defil = Math.min(scrollY / innerHeight, 1.5);
      repos.p.set(souris.cx * 0.6, -defil * 1.6 - souris.cy * 0.4, 16);
      repos.c.set(0, -defil * 1.6, 0);
      if (intro.active) animerIntro(dt, repos);
      else { camera.position.copy(repos.p); camera.lookAt(repos.c); }
    }
    // les poussières montent doucement
    const p = geoPoussiere.attributes.position;
    for (let i = 0; i < NB; i++) {
      let y = p.getY(i) + dt * (0.08 + (i % 7) * 0.02);
      if (y > 11) y = -11;
      p.setY(i, y);
    }
    p.needsUpdate = true;
  }

  animerEclairs(dt, !tenu);
  // étoiles filantes : discrètes au repos, elles s'effacent pendant la séquence
  const forceFilantes = reduit ? 0 : 1 - lisse(0, 1.2, tenu ? tMaintien : 0);
  animerFilantes(dt, forceFilantes);
  ciel.material.uniforms.uForce.value = 1 - 0.6 * lisse(0, 4, tenu ? tMaintien : 0);

  flash = Math.max(0, flash - dt / 0.9);
  passeFisheye.uniforms.uForce.value = flash * flash;
  composeur.render(dt);
  requestAnimationFrame(boucle);
}
lancerIntro();
requestAnimationFrame(boucle);
racine.classList.add('rubans-prets');

// réglage : ajouter ?reglage à l'adresse pour figer la séquence à un instant donné, ex. qamarInstant(4.2)
if (location.search.includes('reglage')) {
  window.qamarInstant = (t) => { if (!tenu) commencer(); tMaintien = t; };
  window.qamarRelacher = finir;
  window.qamarIntro = (t, v = 0) => { if (intro.active) { intro.t = t; intro.vitesse = v; } };
  window.qamarFilante = () => { const f = filantes.find((x) => x.attente > 0) || filantes[0]; lancerFilante(f); };
}
