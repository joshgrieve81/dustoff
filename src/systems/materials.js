import * as THREE from "three";

export function makePixelTexture(base, accent = "#000000", size = 64, noise = 0.18) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 4) {
    for (let x = 0; x < size; x += 4) {
      ctx.globalAlpha = Math.random() * noise;
      ctx.fillStyle = Math.random() > 0.5 ? accent : "#ffffff";
      ctx.fillRect(x, y, 4, 4);
    }
  }

  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = accent;
  for (let i = 0; i < 9; i += 1) {
    ctx.beginPath();
    ctx.moveTo(0, Math.random() * size);
    ctx.lineTo(size, Math.random() * size);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function mat(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 1,
    metalness: 0,
    flatShading: true,
    ...options,
  });
}

export function texturedMat(color, accent, repeat = 1) {
  const map = makePixelTexture(color, accent);
  map.repeat.set(repeat, repeat);
  return mat(color, { map });
}
