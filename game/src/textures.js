// Procedural canvas textures: the arena floor (dark plating, concentric range
// rings, the painted words SHEPHERD'S RING), a soft radial glow sprite used by
// every light in the game, and a hard red eye sprite for the Hollow. No image
// files, no network — everything is drawn once at boot.

import * as THREE from 'three';

/** Soft radial falloff sprite: gold light, mote cores, particle sparks. */
export function glowTexture(inner = 'rgba(255,225,160,1)', outer = 'rgba(255,160,40,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, inner.replace('1)', '0.55)'));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A hunter's eye: a small hard disc of red with a bright core. */
export function eyeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,240,230,1)');
  grad.addColorStop(0.25, 'rgba(255,70,50,0.95)');
  grad.addColorStop(1, 'rgba(160,10,10,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * The arena floor, drawn at 1024²: near-black blue plating with a faint panel
 * grid, three concentric range rings, gate ticks at the rim where the Hollow
 * enter, and the arena's name painted under the centre.
 */
export function floorTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#081020';
  g.fillRect(0, 0, S, S);

  // A breath of light at the centre, so the middle of the ring never reads
  // as flat black when the whole frame shrinks to a contact sheet.
  const heart = g.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S * 0.52);
  heart.addColorStop(0, 'rgba(64,96,170,0.20)');
  heart.addColorStop(0.6, 'rgba(40,64,120,0.10)');
  heart.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = heart;
  g.fillRect(0, 0, S, S);

  // Panel grid.
  g.strokeStyle = 'rgba(70,110,180,0.16)';
  g.lineWidth = 1;
  for (let i = 0; i <= 16; i += 1) {
    const p = (i / 16) * S;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(S, p); g.stroke();
  }
  // Scattered plating wear.
  for (let i = 0; i < 260; i += 1) {
    g.fillStyle = `rgba(120,160,220,${0.03 + Math.random() * 0.05})`;
    g.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 8, 1 + Math.random() * 3);
  }
  const cx = S / 2, cy = S / 2;
  // Radial spokes from the centre to each gate: the ring's steering marks.
  g.strokeStyle = 'rgba(96,160,255,0.13)';
  g.lineWidth = 2;
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * S * 0.1, cy + Math.sin(a) * S * 0.1);
    g.lineTo(cx + Math.cos(a) * S * 0.485, cy + Math.sin(a) * S * 0.485);
    g.stroke();
  }
  // Range rings.
  for (const [r, a] of [[0.32, 0.34], [0.58, 0.27], [0.84, 0.36]]) {
    g.strokeStyle = `rgba(96,180,255,${a})`;
    g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, r * S * 0.5, 0, Math.PI * 2); g.stroke();
  }
  // Gate ticks at the rim (the Hollow enter here).
  g.strokeStyle = 'rgba(255,90,70,0.5)';
  g.lineWidth = 6;
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * S * 0.47, cy + Math.sin(a) * S * 0.47);
    g.lineTo(cx + Math.cos(a) * S * 0.5, cy + Math.sin(a) * S * 0.5);
    g.stroke();
  }
  // Painted name under the centre.
  g.fillStyle = 'rgba(150,200,255,0.22)';
  g.font = '700 44px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText("SHEPHERD'S RING", cx, cy + 118);
  g.font = '600 21px system-ui, sans-serif';
  g.fillStyle = 'rgba(150,200,255,0.17)';
  g.fillText('KEEP THE LIGHT MOVING', cx, cy + 148);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
