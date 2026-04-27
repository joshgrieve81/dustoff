export const WORLD = {
  carrier: { x: 0, y: 5, z: 0 },
  extraction: { x: -90, y: 2, z: -430 },
  oceanSize: 1400,
};

export const HELI = {
  maxHealth: 180,
  speed: 42,
  reverseSpeed: 21,
  strafeSpeed: 24,
  climbSpeed: 18,
  yawSpeed: 1.7,
  minAltitude: 3,
  maxAltitude: 105,
  rotorSpeed: 22,
  collectiveRate: 0.38,
  hoverCollective: 0.52,
  liftPower: 26,
  cyclicAccel: 20,
  horizontalDrag: 0.95,
  verticalDrag: 1.9,
  yawAccel: 1.65,
  yawDrag: 2.65,
  maxAirSpeed: 44,
  maxBank: 0.24,
  maxPitch: 0.2,
};

export const MISSION = {
  soldierCount: 5,
  lzRadius: 34,
  landingAltitude: 9,
  carrierLandingRadius: 34,
  gunHeatMax: 100,
  gunHeatPerShot: 5,
  gunCoolRate: 42,
  enemySpawnEvery: 6.5,
  enemyMax: 12,
};

export const COLORS = {
  olive: "#576044",
  darkOlive: "#343a2e",
  sand: "#8d7351",
  dirt: "#5e4937",
  concrete: "#4c4f4b",
  carrier: "#3d4549",
  deck: "#2f383d",
  enemy: "#7b3f35",
  friendly: "#7a8560",
  tracer: "#f7e08a",
};
