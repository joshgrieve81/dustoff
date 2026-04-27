import * as THREE from "three";
import { COLORS, WORLD } from "./constants.js";
import { mat, texturedMat } from "./materials.js";
import { randRange } from "./math.js";

function box(width, height, depth, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cone(radius, height, sides, material) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, sides), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export class DustoffWorld {
  constructor(scene) {
    this.scene = scene;
    this.enemyTargets = [];
    this.beaconLight = null;
    this.smokePuffs = [];
    this.build();
  }

  build() {
    this.createLighting();
    this.createOcean();
    this.createCarrier();
    this.createExtractionZone();
    this.createSkyDebris();
  }

  createLighting() {
    this.scene.background = new THREE.Color("#665f52");
    this.scene.fog = new THREE.FogExp2("#665f52", 0.0045);

    const hemi = new THREE.HemisphereLight("#a79d82", "#242820", 1.45);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight("#d5c39a", 1.5);
    sun.position.set(-90, 120, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -180;
    sun.shadow.camera.right = 180;
    sun.shadow.camera.top = 180;
    sun.shadow.camera.bottom = -180;
    this.scene.add(sun);
  }

  createOcean() {
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.oceanSize, WORLD.oceanSize, 24, 24),
      texturedMat("#31484d", "#182326", 24)
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.receiveShadow = true;
    this.scene.add(ocean);
  }

  createCarrier() {
    const carrier = new THREE.Group();
    carrier.name = "Aircraft Carrier";
    carrier.position.set(WORLD.carrier.x, 0, WORLD.carrier.z);

    const hullMat = mat(COLORS.carrier);
    const deckMat = texturedMat(COLORS.deck, "#677077", 5);
    const stripeMat = mat("#d8cfac");
    const redMat = mat("#804541");

    const hull = box(76, 9, 150, hullMat);
    hull.position.y = 3.4;
    carrier.add(hull);

    const bow = cone(38, 42, 4, hullMat);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.z = Math.PI / 4;
    bow.position.set(0, 3.4, -91);
    bow.scale.y = 0.78;
    carrier.add(bow);

    const deck = box(94, 1.4, 174, deckMat);
    deck.position.y = WORLD.carrier.y;
    carrier.add(deck);

    const runway = box(7, 0.08, 154, stripeMat);
    runway.position.set(0, WORLD.carrier.y + 0.75, -2);
    carrier.add(runway);

    for (let z = -65; z <= 62; z += 18) {
      const tick = box(22, 0.1, 1.2, stripeMat);
      tick.position.set(0, WORLD.carrier.y + 0.82, z);
      carrier.add(tick);
    }

    const tower = box(18, 24, 18, mat("#50595b"));
    tower.position.set(34, 18, 18);
    carrier.add(tower);

    const bridge = box(24, 8, 15, mat("#687173"));
    bridge.position.set(30, 32, 10);
    carrier.add(bridge);

    const radar = cone(7, 2, 6, redMat);
    radar.position.set(30, 38, 10);
    carrier.add(radar);

    const pad = new THREE.Mesh(
      new THREE.RingGeometry(13, 15, 18),
      mat("#d7d1ac", { side: THREE.DoubleSide })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, WORLD.carrier.y + 0.9, 48);
    carrier.add(pad);

    this.scene.add(carrier);
  }

  createExtractionZone() {
    const base = new THREE.Group();
    base.name = "Extraction Zone";
    base.position.set(WORLD.extraction.x, 0.03, WORLD.extraction.z);

    const desert = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 220, 8, 8),
      texturedMat(COLORS.sand, "#564535", 8)
    );
    desert.rotation.x = -Math.PI / 2;
    desert.receiveShadow = true;
    base.add(desert);

    const roadMat = texturedMat("#363b39", "#6b665d", 3);
    const roadA = box(18, 0.16, 210, roadMat);
    roadA.position.set(-34, 0.06, 0);
    base.add(roadA);
    const roadB = box(210, 0.16, 14, roadMat);
    roadB.position.set(10, 0.07, 22);
    base.add(roadB);

    const ruinMat = texturedMat("#6a6256", "#2e302d", 2);
    const buildings = [
      [-78, -46, 22, 14, 20],
      [-4, -58, 28, 18, 14],
      [62, -34, 18, 16, 28],
      [74, 42, 28, 18, 14],
      [-64, 54, 24, 14, 18],
      [6, 68, 32, 18, 16],
    ];

    for (const [x, z, w, h, d] of buildings) {
      const b = box(w, h, d, ruinMat);
      b.position.set(x, h / 2, z);
      base.add(b);

      if (Math.random() > 0.4) {
        const bite = box(w * 0.45, h * 0.5, d * 0.5, texturedMat("#1f211f", "#111", 1));
        bite.position.set(x + w * 0.18, h * 0.76, z - d * 0.14);
        base.add(bite);
      }
    }

    const marker = new THREE.Mesh(
      new THREE.RingGeometry(24, 28, 20),
      mat("#d7be68", { side: THREE.DoubleSide })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(0, 0.4, 0);
    base.add(marker);

    const beacon = cone(4, 28, 6, mat("#b54e3f", { emissive: "#63271e", emissiveIntensity: 0.6 }));
    beacon.position.set(0, 14, 0);
    base.add(beacon);

    this.beaconLight = new THREE.PointLight("#d88d45", 18, 95, 2);
    this.beaconLight.position.set(WORLD.extraction.x, 20, WORLD.extraction.z);
    this.scene.add(this.beaconLight);

    for (let i = 0; i < 9; i += 1) {
      const puff = new THREE.Mesh(
        new THREE.IcosahedronGeometry(randRange(1.5, 3.4), 0),
        mat("#4b4740", { transparent: true, opacity: 0.42 })
      );
      puff.position.set(randRange(-5, 5), 18 + i * 5, randRange(-5, 5));
      base.add(puff);
      this.smokePuffs.push(puff);
    }

    this.scene.add(base);
  }

  createSkyDebris() {
    const matCloud = mat("#5d584d", { transparent: true, opacity: 0.22 });
    for (let i = 0; i < 28; i += 1) {
      const cloud = new THREE.Mesh(new THREE.IcosahedronGeometry(randRange(8, 22), 0), matCloud);
      cloud.position.set(randRange(-380, 360), randRange(65, 135), randRange(-620, 160));
      cloud.scale.y = randRange(0.15, 0.35);
      this.scene.add(cloud);
    }
  }

  update(time, delta) {
    if (this.beaconLight) {
      this.beaconLight.intensity = 13 + Math.sin(time * 5) * 5;
    }

    for (let i = 0; i < this.smokePuffs.length; i += 1) {
      const puff = this.smokePuffs[i];
      puff.position.y += delta * (4 + i * 0.25);
      puff.position.x += Math.sin(time + i) * delta * 1.2;
      puff.rotation.y += delta * 0.5;
      if (puff.position.y > 70) {
        puff.position.y = 14;
      }
    }
  }
}
