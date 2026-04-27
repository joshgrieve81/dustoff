import * as THREE from "three";

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

export function distanceXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function flatDirection(from, to) {
  const dir = new THREE.Vector3(to.x - from.x, 0, to.z - from.z);
  const length = dir.length();
  return length > 0.001 ? dir.divideScalar(length) : dir.set(0, 0, 1);
}

export function yawVector(yaw) {
  return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
}

export function rightVector(yaw) {
  return new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
}
