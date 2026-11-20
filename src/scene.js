// Static world geometry for the three nights, built from the same data the simulation uses (maps.js).
import * as THREE from 'three';
import { NIGHTS, ISLANDS, BRIDGE, RAMPS } from './maps.js';
import { TUNING } from './tuning.js';

// Standard palette (TICKET-02). Details not in the table use tints of these.
export const PAL = {
  sky: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  lampLit: 0xffb347, lampCore: 0xffe9b0, lampOff: 0x5b5f6e, moteCore: 0xfff6c2, moteHalo: 0xffe58a,
  shade: 0x120a1a, shadeRim: 0x7a3cff, shadeStun: 0x3a3450, may: 0xe8e2d0, scarf: 0xc8102e, gold: 0xf2c14e,
  drifter: 0x8fa3b8, danger: 0xff5a5f, text: 0xf5f1e6,
};
const std = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

// Starfield + moon shared by all nights. Returned so the client can animate them.
export function buildSky() {
  const g = new THREE.Group();
  // stars as a Points cloud
  const starGeo = new THREE.BufferGeometry();
  const N = 600;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 180 + Math.random() * 40;
    const y = 40 + Math.random() * 80;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = Math.sin(a) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, sizeAttenuation: true, transparent: true, opacity: 0.9 }));
  // moon
  const moon = new THREE.Mesh(new THREE.SphereGeometry(4, 20, 16), new THREE.MeshBasicMaterial({ color: 0xfff6c2 }));
  moon.position.set(60, 70, -80);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(6, 20, 16), new THREE.MeshBasicMaterial({ color: 0xfff6c2, transparent: true, opacity: 0.18 }));
  halo.position.copy(moon.position);
  g.add(stars, moon, halo);
  g.userData = { stars, moon, halo };
  return g;
}

function islandDisc(cx, cz, r) {
  const g = new THREE.Group();
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(r, r - 3, 9, 64), std(PAL.sand));
  sand.position.set(cx, -4.5, cz);
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(r - 1.8, r - 1.8, 9.02, 64), std(PAL.grass));
  grass.position.set(cx, -4.5, cz);
  g.add(sand, grass);
  return g;
}

function makeLantern(pos, id) {
  const g = new THREE.Group();
  g.position.set(pos[0], pos[1], pos[2]);
  // sturdy post with base ring
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 3.2, 10), std(PAL.wood));
  post.position.y = 1.6;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.2, 12), std(0x4a3420));
  base.position.y = 0.1;
  // lamp cage: now TRANSPARENT when lit so the flame shows through brightly
  const lampMat = new THREE.MeshLambertMaterial({ color: PAL.lampOff, emissive: 0x000000, transparent: true, opacity: 1 });
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1, 12), lampMat);
  lamp.position.y = 3.6;
  // vertical bars on lamp
  const barMat = std(0x3a2818);
  for (let i = 0; i < 4; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.02, 0.04), barMat);
    const a = i * Math.PI / 2;
    bar.position.set(Math.cos(a) * 0.6, 3.6, Math.sin(a) * 0.6);
    g.add(bar);
  }
  // inner FLAME (big emissive sphere) - super bright when lit
  const flameMat = new THREE.MeshBasicMaterial({ color: PAL.lampCore, transparent: true, opacity: 0 });
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), flameMat);
  flame.position.y = 3.6;
  // bright white-hot core inside flame
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), coreMat);
  core.position.y = 3.6;
  // flame "tongue" rising above
  const tongueMat = new THREE.MeshBasicMaterial({ color: PAL.lampLit, transparent: true, opacity: 0 });
  const tongue = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 8), tongueMat);
  tongue.position.y = 3.95;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.55, 12), std(PAL.scarf));
  roof.position.y = 4.35;
  // decorative finial
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), std(PAL.gold, { emissive: 0x6b5010 }));
  finial.position.y = 4.75;
  // MUCH stronger point light
  const light = new THREE.PointLight(PAL.lampLit, 0, 38, 1.4);
  light.position.y = 3.6;
  // multi-layer outer glow spheres for lamp bloom effect
  const glow1Mat = new THREE.MeshBasicMaterial({ color: PAL.lampLit, transparent: true, opacity: 0, depthWrite: false });
  const glow1 = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), glow1Mat); glow1.position.y = 3.6;
  const glow2Mat = new THREE.MeshBasicMaterial({ color: PAL.lampCore, transparent: true, opacity: 0, depthWrite: false });
  const glow2 = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12), glow2Mat); glow2.position.y = 3.6;
  const glow3Mat = new THREE.MeshBasicMaterial({ color: 0xffd97a, transparent: true, opacity: 0, depthWrite: false });
  const glow3 = new THREE.Mesh(new THREE.SphereGeometry(3.5, 16, 12), glow3Mat); glow3.position.y = 3.6;
  // VERTICAL LIGHT BEAM going up (visible from far)
  const beamMat = new THREE.MeshBasicMaterial({ color: PAL.lampCore, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(2.5, 15, 16, 1, true), beamMat); beam.position.y = 11; beam.rotation.x = Math.PI;
  // ground halo disc (light pool)
  const haloDiscMat = new THREE.MeshBasicMaterial({ color: PAL.lampLit, transparent: true, opacity: 0, depthWrite: false });
  const haloDisc = new THREE.Mesh(new THREE.CircleGeometry(4, 32), haloDiscMat);
  haloDisc.rotation.x = -Math.PI / 2; haloDisc.position.y = 0.04;
  // safe-zone ring
  const ringMat = new THREE.MeshBasicMaterial({ color: PAL.lampLit, transparent: true, opacity: 0, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.1, TUNING.safe_radius, 64), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
  // progress ring
  const progMat = new THREE.MeshBasicMaterial({ color: PAL.lampCore, transparent: true, opacity: 0, side: THREE.DoubleSide });
  const prog = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.68, 32), progMat);
  prog.rotation.x = -Math.PI / 2; prog.position.y = 3.1;
  g.add(base, post, lamp, flame, core, tongue, roof, finial, light, glow1, glow2, glow3, beam, haloDisc, ring, prog);
  g.userData = { id, lampMat, flameMat, coreMat, tongueMat, light, ringMat, glow1Mat, glow2Mat, glow3Mat, beamMat, haloDiscMat, progMat, tongue, lit: false };
  return g;
}

function makeCharm() {
  const g = new THREE.Group();
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.05), new THREE.MeshBasicMaterial({ color: PAL.gold }));
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.12, 0.07), new THREE.MeshBasicMaterial({ color: PAL.scarf }));
  const glow = new THREE.PointLight(PAL.scarf, 0.8, 5);
  g.add(border, paper, glow);
  return g;
}

export function buildWorld(night) {
  const map = NIGHTS[night];
  const group = new THREE.Group();
  const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 48), new THREE.MeshLambertMaterial({ color: PAL.sea }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -8;
  group.add(sea);
  for (const i of ISLANDS[night]) group.add(islandDisc(i.cx, i.cz, i.r));

  if (night === 2) {
    const len = BRIDGE.x1 - BRIDGE.x0 + 4;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, BRIDGE.hz * 2), std(PAL.wood));
    deck.position.set((BRIDGE.x0 + BRIDGE.x1) / 2, -0.17, 0);
    group.add(deck);
    for (let x = BRIDGE.x0; x <= BRIDGE.x1; x += 2) { // planks
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, BRIDGE.hz * 2 + 0.1), std(0x4d3420));
      plank.position.set(x, 0.0, 0); group.add(plank);
    }
  }

  if (night === 3) {
    const sh = new THREE.Shape();
    sh.absarc(0, 0, 24, 0, Math.PI, false);
    sh.absarc(0, 0, 12, Math.PI, 0, true);
    const tier1 = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false, curveSegments: 48 }), std(PAL.grass));
    tier1.geometry.rotateX(Math.PI / 2); tier1.geometry.translate(0, 3, 0);
    const wall1 = tier1.clone(); wall1.scale.set(1.001, 1, 1.001); wall1.material = std(PAL.sand);
    group.add(wall1, tier1);
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), std(PAL.sand));
    tier2.position.y = 3;
    const top2 = new THREE.Mesh(new THREE.CylinderGeometry(7.6, 7.6, 6.02, 48), std(PAL.grass));
    top2.position.y = 3;
    group.add(tier2, top2);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 8, 20), std(PAL.wood));
    tower.position.y = 10;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.6, 20), std(PAL.scarf));
    roof.position.y = 14.8;
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), new THREE.MeshLambertMaterial({ color: PAL.gold, emissive: 0x6b5010 }));
    bell.position.y = 12.8;
    group.add(tower, roof, bell);
    for (const rp of RAMPS) {
      const len = Math.hypot(rp.s1 - rp.s0, 3);
      const pivot = new THREE.Group();
      pivot.position.set(((rp.s0 + rp.s1) / 2) * rp.dx, 1.5, ((rp.s0 + rp.s1) / 2) * rp.dz);
      pivot.rotation.y = -(rp.deg * Math.PI) / 180;
      const board = new THREE.Mesh(new THREE.BoxGeometry(len, 0.25, rp.width), std(PAL.wood));
      board.rotation.z = Math.atan2(3, rp.s1 - rp.s0);   // +x (outward) end is lower
      board.position.y = -0.12;
      pivot.add(board);
      group.add(pivot);
    }
  }

  for (const pad of map.platforms) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.12, 24), new THREE.MeshLambertMaterial({ color: PAL.gold, emissive: 0x5a4210 }));
    base.position.set(pad.pos[0], pad.pos[1] + 0.06, pad.pos[2]);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color: PAL.lampCore }));
    ring.rotation.x = Math.PI / 2; ring.position.set(pad.pos[0], pad.pos[1] + 0.14, pad.pos[2]);
    group.add(base, ring);
  }

  const lanterns = new Map();
  map.lanterns.forEach((p, i) => { const v = makeLantern(p, `L${i + 1}`); lanterns.set(v.userData.id, v); group.add(v); });
  const charms = new Map();
  map.charms.forEach((p, i) => { const v = makeCharm(); v.position.set(p[0], p[1] + 1.1, p[2]); charms.set(`C${i + 1}`, v); group.add(v); });

  // decorative bushes + grass tufts + flowers (fixed layout, no gameplay effect, instanced for perf)
  const bushGeo = new THREE.IcosahedronGeometry(0.7, 0);
  const grassGeo = new THREE.ConeGeometry(0.08, 0.4, 4);
  const flowerCore = new THREE.SphereGeometry(0.1, 6, 4);
  const flowerCols = [0xff9aa6, 0xffe9b0, 0xc8102e, 0xf2c14e];
  for (let i = 0; i < 36; i++) {
    const a = i * 2.39996, r = 6 + ((i * 37) % 22);
    const cx = night === 2 ? (i % 2 ? 70 : 0) : 0;
    const x = cx + r * Math.sin(a), z = r * Math.cos(a);
    const y = map.floorAt(x, z);
    if (y === null || (night === 3 && Math.abs(y - 0) > 0.01) || Math.hypot(x, z) < 4 && night === 3) continue;
    const b = new THREE.Mesh(bushGeo, std(0x23483e, { flatShading: true }));
    b.position.set(x, y + 0.3, z); b.scale.setScalar(0.7 + (i % 3) * 0.35);
    group.add(b);
    // scatter grass + flowers around each bush
    for (let j = 0; j < 4; j++) {
      const ja = j * 1.57 + i * 0.3, jr = 0.9 + (j * 0.3);
      const gx = x + Math.cos(ja) * jr, gz = z + Math.sin(ja) * jr;
      const gy = map.floorAt(gx, gz);
      if (gy === null || Math.abs(gy - y) > 0.1) continue;
      const tuft = new THREE.Mesh(grassGeo, std(0x4a7a5f));
      tuft.position.set(gx, gy + 0.2, gz); tuft.rotation.z = (i * 0.1 + j) * 0.3;
      group.add(tuft);
      if ((i + j) % 3 === 0) {
        const fc = flowerCols[(i + j) % flowerCols.length];
        const flo = new THREE.Mesh(flowerCore, new THREE.MeshBasicMaterial({ color: fc }));
        flo.position.set(gx + 0.1, gy + 0.3, gz + 0.1);
        group.add(flo);
      }
    }
  }
  return { group, lanterns, charms, map };
}

export { makeCharm };
