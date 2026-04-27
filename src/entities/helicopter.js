import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { COLORS } from "../systems/constants.js";
import { mat } from "../systems/materials.js";

function part(geometry, material, position, scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export class Helicopter {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "CH-53 Placeholder Helicopter";
    this.exterior = new THREE.Group();
    this.weapons = new THREE.Group();
    this.proceduralExterior = new THREE.Group();
    this.modelRoot = new THREE.Group();
    this.cockpit = new THREE.Group();
    this.gunnerInterior = new THREE.Group();
    this.gunnerDoorLeft = null;
    this.gunnerDoorRight = null;
    this.rotor = null;
    this.tailRotor = null;
    this.machineGunLeft = null;
    this.machineGunRight = null;
    this.machineGun = null;
    this.muzzleLeft = null;
    this.muzzleRight = null;
    this.muzzle = null;
    this.loadedModel = null;
    this.build();
  }

  build() {
    const olive = mat(COLORS.olive);
    const dark = mat(COLORS.darkOlive);
    const glass = mat("#1d2a2c", {
      emissive: "#111b1d",
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.28,
    });
    const black = mat("#151713");

    const body = part(new THREE.BoxGeometry(14, 5, 31), olive, [0, 0, 0]);
    const nose = part(new THREE.ConeGeometry(4.1, 8, 6), olive, [0, 0, 18]);
    nose.rotation.x = Math.PI / 2;
    const cabin = part(new THREE.BoxGeometry(10, 4, 8), glass, [0, 2.1, 12]);
    const tail = part(new THREE.BoxGeometry(3.2, 2.2, 28), dark, [0, 0.6, -27]);
    const tailFin = part(new THREE.BoxGeometry(0.8, 7, 5), dark, [0, 4.2, -42]);
    this.proceduralExterior.add(body, nose, cabin, tail, tailFin);

    const skidLeft = part(new THREE.BoxGeometry(1.1, 0.8, 30), black, [-6.1, -4, 0]);
    const skidRight = skidLeft.clone();
    skidRight.position.x = 6.1;
    this.proceduralExterior.add(skidLeft, skidRight);

    for (const x of [-6.1, 6.1]) {
      for (const z of [-9, 9]) {
        const strut = part(new THREE.BoxGeometry(0.45, 5, 0.45), black, [x, -1.8, z]);
        strut.rotation.z = x < 0 ? -0.18 : 0.18;
        this.proceduralExterior.add(strut);
      }
    }

    this.rotor = new THREE.Group();
    this.rotor.position.set(0, 5, 0);
    for (let i = 0; i < 4; i += 1) {
      const blade = part(new THREE.BoxGeometry(2, 0.18, 31), black, [0, 0, 15]);
      blade.rotation.y = (i * Math.PI) / 2;
      this.rotor.add(blade);
    }
    this.proceduralExterior.add(this.rotor);

    this.tailRotor = new THREE.Group();
    this.tailRotor.position.set(0, 3.8, -44.5);
    this.tailRotor.rotation.z = Math.PI / 2;
    for (let i = 0; i < 3; i += 1) {
      const blade = part(new THREE.BoxGeometry(0.5, 0.12, 6), black, [0, 0, 2.5]);
      blade.rotation.x = (i * Math.PI * 2) / 3;
      this.tailRotor.add(blade);
    }
    this.proceduralExterior.add(this.tailRotor);

    this.machineGunLeft = this.createMachineGun(-1, olive, dark, black);
    this.machineGunRight = this.createMachineGun(1, olive, dark, black);
    this.machineGun = this.machineGunLeft;
    this.muzzle = this.muzzleLeft;
    this.exterior.add(this.modelRoot, this.proceduralExterior);
    this.weapons.add(this.machineGunLeft, this.machineGunRight);

    this.buildCockpitInterior(olive, dark, black, glass);
    this.buildGunnerInterior(olive, dark, black);
    this.group.add(this.exterior, this.weapons, this.cockpit, this.gunnerInterior);
  }

  async loadBlackhawkModel(url) {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    const model = gltf.scene;
    model.name = "Blackhawk GLB";

    model.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) {
          node.material.roughness = Math.max(node.material.roughness ?? 0.8, 0.85);
        }
      }
    });

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);

    const longest = Math.max(size.x, size.z);
    const targetLength = 22;
    const scale = longest > 0 ? targetLength / longest : 1;
    model.scale.setScalar(scale);

    if (size.x > size.z) {
      model.rotation.y = Math.PI / 2;
    }

    model.position.y = -0.45;
    this.modelRoot.clear();
    this.modelRoot.add(model);
    this.proceduralExterior.visible = false;
    this.loadedModel = model;
  }

  createMachineGun(side, olive, dark, black) {
    const gun = new THREE.Group();
    // Door gun is calibrated for the imported Blackhawk scale. It sits just outside
    // the side door while the camera stays tucked into the cabin.
    gun.position.set(side * 4.05, 0.35, 0.85);
    gun.rotation.y = side * Math.PI * 0.5;
    gun.scale.setScalar(0.38);

    const yoke = part(new THREE.BoxGeometry(1.2, 1.1, 1), black, [0, 0, 0]);
    const receiver = part(new THREE.BoxGeometry(1, 0.8, 2.2), dark, [0, 0, 1.2]);
    const ammoBox = part(new THREE.BoxGeometry(1.2, 1, 1.5), olive, [-side * 1.1, -0.15, 0.5]);
    const grip = part(new THREE.BoxGeometry(0.35, 1.2, 0.35), black, [side * 0.55, -0.9, 0.25]);
    gun.add(yoke, receiver, ammoBox, grip);

    const barrelMat = mat("#20221d");
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      const barrel = part(new THREE.CylinderGeometry(0.08, 0.08, 4.2, 6), barrelMat, [
        Math.cos(angle) * 0.28,
        Math.sin(angle) * 0.28,
        3.8,
      ]);
      barrel.rotation.x = Math.PI / 2;
      gun.add(barrel);
    }

    const flashSuppressor = part(new THREE.CylinderGeometry(0.34, 0.22, 0.8, 6), black, [0, 0, 6.1]);
    flashSuppressor.rotation.x = Math.PI / 2;
    gun.add(flashSuppressor);

    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0, 6.8);
    gun.add(muzzle);
    if (side < 0) this.muzzleLeft = muzzle;
    if (side > 0) this.muzzleRight = muzzle;
    return gun;
  }

  buildCockpitInterior(olive, dark, black, glass) {
    this.cockpit.name = "Pilot Cockpit Interior";

    const dash = part(new THREE.BoxGeometry(9.6, 0.75, 1.75), black, [0, 0.2, 19.2]);
    dash.rotation.x = -0.12;
    const glareShield = part(new THREE.BoxGeometry(8.6, 0.25, 1.4), dark, [0, 0.95, 19.3]);
    glareShield.rotation.x = -0.22;
    const nose = part(new THREE.BoxGeometry(3.8, 0.32, 7.2), olive, [0, -0.35, 24.3]);
    nose.rotation.x = -0.08;
    this.cockpit.add(dash, glareShield, nose);

    for (const x of [-5.15, 5.15]) {
      const sideFrame = part(new THREE.BoxGeometry(0.26, 4.1, 0.26), black, [x, 2.55, 20.5]);
      sideFrame.rotation.z = x < 0 ? -0.16 : 0.16;
      const frontFrame = part(new THREE.BoxGeometry(0.24, 4.1, 0.24), black, [x * 0.48, 2.8, 24.2]);
      frontFrame.rotation.z = x < 0 ? 0.08 : -0.08;
      this.cockpit.add(sideFrame, frontFrame);
    }

    const topFrame = part(new THREE.BoxGeometry(8.6, 0.28, 0.28), black, [0, 4.85, 22.4]);
    const bottomFrame = part(new THREE.BoxGeometry(9.2, 0.22, 0.22), black, [0, 1.05, 21.8]);
    this.cockpit.add(topFrame, bottomFrame);

    const paneMat = glass.clone();
    paneMat.opacity = 0.07;
    const pane = part(new THREE.BoxGeometry(8.8, 2.75, 0.06), paneMat, [0, 3.1, 23.15]);
    pane.rotation.x = 0.05;
    this.cockpit.add(pane);

    const dialMat = mat("#0b0d09", { emissive: "#26351d", emissiveIntensity: 0.2 });
    for (let i = 0; i < 5; i += 1) {
      const dial = part(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 10), dialMat, [-3.1 + i * 1.55, 0.8, 18.05]);
      dial.rotation.x = Math.PI / 2;
      this.cockpit.add(dial);
    }

    const stick = part(new THREE.BoxGeometry(0.2, 1.65, 0.2), black, [-1.2, -0.1, 16.2]);
    stick.rotation.x = -0.35;
    const collective = part(new THREE.BoxGeometry(0.16, 2.2, 0.16), dark, [3.35, -0.15, 16.4]);
    collective.rotation.z = -0.9;
    this.cockpit.add(stick, collective);
  }

  buildGunnerInterior(olive, dark, black) {
    this.gunnerInterior.name = "Door Gunner Interior";
    this.gunnerDoorLeft = this.createDoorFrame(-1, olive, dark, black);
    this.gunnerDoorRight = this.createDoorFrame(1, olive, dark, black);
    this.gunnerInterior.add(this.gunnerDoorLeft, this.gunnerDoorRight);
    this.gunnerInterior.visible = false;
  }

  createDoorFrame(side, olive, dark, black) {
    const door = new THREE.Group();
    door.name = side < 0 ? "Port Door Gunner Frame" : "Starboard Door Gunner Frame";

    const cabinWall = part(new THREE.BoxGeometry(0.28, 3.5, 6.2), dark, [side * 3.25, 0.35, 0.15]);
    const floor = part(new THREE.BoxGeometry(3.4, 0.22, 4.8), olive, [side * 2.25, -0.82, 0.05]);
    const topRail = part(new THREE.BoxGeometry(0.42, 0.28, 6.4), black, [side * 4.45, 2.48, 0.15]);
    const bottomRail = part(new THREE.BoxGeometry(0.48, 0.32, 6.4), black, [side * 4.42, -0.58, 0.15]);
    door.add(cabinWall, floor, topRail, bottomRail);

    for (const z of [-2.75, 3.05]) {
      const post = part(new THREE.BoxGeometry(0.5, 3.25, 0.34), black, [side * 4.42, 0.92, z]);
      post.rotation.z = side * 0.04;
      door.add(post);
    }

    const foldedSeat = part(new THREE.BoxGeometry(1.25, 0.28, 1.35), dark, [side * 2.25, -0.15, -1.7]);
    foldedSeat.rotation.z = side * 0.12;
    const ammoCan = part(new THREE.BoxGeometry(1, 0.75, 1.05), olive, [side * 3.25, -0.25, 2.2]);
    door.add(foldedSeat, ammoCan);

    return door;
  }

  setPilotView(enabled) {
    this.exterior.visible = !enabled;
    this.weapons.visible = !enabled;
    this.cockpit.visible = enabled;
    this.gunnerInterior.visible = false;
  }

  setViewMode(mode, side = -1) {
    const pilot = mode === "pilot";
    const gunner = mode === "gunner";
    this.exterior.visible = !pilot && !gunner;
    this.weapons.visible = !pilot && !gunner;
    this.cockpit.visible = pilot;
    this.gunnerInterior.visible = gunner;
    if (this.gunnerDoorLeft) this.gunnerDoorLeft.visible = side < 0;
    if (this.gunnerDoorRight) this.gunnerDoorRight.visible = side > 0;
  }

  setGunnerSide(side) {
    this.machineGun = side < 0 ? this.machineGunLeft : this.machineGunRight;
    this.muzzle = side < 0 ? this.muzzleLeft : this.muzzleRight;
  }

  update(delta, rotorSpeed) {
    this.rotor.rotation.y += delta * rotorSpeed;
    this.tailRotor.rotation.x += delta * rotorSpeed * 2;
  }
}
