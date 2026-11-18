/* Qamar — outils partagés des vitrines 3D (Premium, E-commerce) :
   reflets de studio générés localement et ombre de contact douce. */
import * as THREE from 'three';

/* Environnement de reflets : des panneaux lumineux autour d'un fond coloré,
   capturés une fois dans une carte d'environnement (aucune image HDR externe). */
export function studio(rendu, fond, panneaux) {
  var s = new THREE.Scene();
  s.background = new THREE.Color(fond);
  panneaux.forEach(function (p) {
    var geo = p.forme === 'anneau' ? new THREE.RingGeometry(0.5, 1, 48) : new THREE.PlaneGeometry(1, 1);
    var c = new THREE.Color(p.couleur || '#ffffff').multiplyScalar(p.intensite);
    var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, toneMapped: false }));
    m.position.fromArray(p.position);
    var e = p.echelle;
    if (typeof e === 'number') m.scale.setScalar(e); else m.scale.set(e[0], e[1], 1);
    if (p.rotation) m.rotation.set(p.rotation[0] || 0, p.rotation[1] || 0, 0);
    if (p.forme === 'anneau') m.lookAt(0, 0, 0);
    s.add(m);
  });
  var pm = new THREE.PMREMGenerator(rendu);
  var env = pm.fromScene(s, 0.02).texture;
  pm.dispose();
  return env;
}

/* Ombre de contact : un dégradé radial posé au sol */
export function ombre(taille, couleur, opacite) {
  var c = document.createElement('canvas');
  c.width = c.height = 128;
  var x = c.getContext('2d');
  var g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  // la transparence est lue dans la luminosité (canal vert) : fond noir opaque, centre blanc
  g.addColorStop(0, '#fff');
  g.addColorStop(0.35, '#8c8c8c');
  g.addColorStop(1, '#000');
  x.fillStyle = '#000';
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  var t = new THREE.CanvasTexture(c);
  var m = new THREE.Mesh(
    new THREE.PlaneGeometry(taille, taille * 0.55),
    new THREE.MeshBasicMaterial({ color: couleur, alphaMap: t, transparent: true, opacity: opacite, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}
