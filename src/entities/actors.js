import * as THREE from "three";
import { COLORS } from "../systems/constants.js";
import { mat } from "../systems/materials.js";
import { flatDirection, randRange } from "../systems/math.js";

function limb(width, height, depth, material, y) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.y = y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export class Soldier {
  constructor(position, index) {
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.name = `Friendly Soldier ${index + 1}`;
    this.boarded = false;
    this.dead = false;
    this.health = 100;
    this.speed = randRange(8.5, 11.5);
    this.anim = Math.random() * 10;
    this.build();
  }

  build() {
    const uniform = mat(COLORS.friendly);
    const skin = mat("#8c674f");
    const pack = mat("#3b3f2d");

    const torso = limb(1.5, 2.4, 0.8, uniform, 2.4);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), skin);
    head.position.y = 4.05;
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.35, 1.05), pack);
    helmet.position.y = 4.55;
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.45), pack);
    backpack.position.set(0, 2.45, -0.6);

    this.leftLeg = limb(0.42, 1.7, 0.42, uniform, 0.85);
    this.rightLeg = limb(0.42, 1.7, 0.42, uniform, 0.85);
    this.leftLeg.position.x = -0.38;
    this.rightLeg.position.x = 0.38;
    this.group.add(torso, head, helmet, backpack, this.leftLeg, this.rightLeg);
  }

  update(delta, target, canBoard) {
    if (this.dead || this.boarded) return;

    const dir = flatDirection(this.group.position, target);
    this.group.position.addScaledVector(dir, this.speed * delta);
    this.group.rotation.y = Math.atan2(dir.x, dir.z);

    this.anim += delta * 12;
    this.leftLeg.rotation.x = Math.sin(this.anim) * 0.55;
    this.rightLeg.rotation.x = -Math.sin(this.anim) * 0.55;

    if (canBoard && this.group.position.distanceTo(target) < 7.5) {
      this.boarded = true;
      this.group.visible = false;
    }
  }

  damage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.dead = true;
      this.group.rotation.z = Math.PI / 2;
      this.group.position.y = 0.4;
    }
  }
}

export class Enemy {
  constructor(position, options = {}) {
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.name = "Enemy Unit";
    this.dead = false;
    this.deathTimer = 0;
    this.speed = randRange(4.5, 6.5);
    this.shootTimer = randRange(0.5, 2.3);
    this.coverPosition = options.coverPosition?.clone() ?? position.clone();
    this.range = options.range ?? randRange(65, 135);
    this.accuracy = options.accuracy ?? randRange(0.35, 0.68);
    this.role = options.role ?? "rifle";
    this.inCover = false;
    this.build();
  }

  build() {
    const bodyMat = mat(COLORS.enemy);
    const dark = mat("#2b211e");

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.3, 1), bodyMat);
    body.position.y = 2.2;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.85), bodyMat);
    head.position.y = 3.85;
    head.castShadow = true;
    const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 3.2), dark);
    rifle.position.set(0.9, 2.7, 0.65);
    rifle.rotation.y = -0.65;
    rifle.castShadow = true;
    this.group.add(body, head, rifle);
  }

  update(delta, target) {
    if (this.dead) {
      this.deathTimer += delta;
      this.group.position.y = Math.max(0.2, this.group.position.y - delta * 6);
      this.group.rotation.z += delta * 2;
      return;
    }

    const coverDistance = this.group.position.distanceTo(this.coverPosition);
    if (coverDistance > 2.2) {
      const dir = flatDirection(this.group.position, this.coverPosition);
      this.group.position.addScaledVector(dir, this.speed * delta);
      this.group.rotation.y = Math.atan2(dir.x, dir.z);
    } else {
      this.inCover = true;
      const dir = flatDirection(this.group.position, target);
      this.group.rotation.y = Math.atan2(dir.x, dir.z);
    }
    this.shootTimer -= delta;
  }

  kill() {
    this.dead = true;
    this.deathTimer = 0;
  }
}

export function randomEnemySpawn(center) {
  const angle = randRange(0, Math.PI * 2);
  const radius = randRange(45, 96);
  return new THREE.Vector3(center.x + Math.sin(angle) * radius, 2, center.z + Math.cos(angle) * radius);
}

export function enemyFirePosition(center, angle, radius, jitter = 16) {
  return new THREE.Vector3(
    center.x + Math.sin(angle) * radius + randRange(-jitter, jitter),
    2,
    center.z + Math.cos(angle) * radius + randRange(-jitter, jitter)
  );
}
