import * as THREE from "three";
import { Helicopter } from "../entities/helicopter.js";
import { Enemy, enemyFirePosition, randomEnemySpawn, Soldier } from "../entities/actors.js";
import { COLORS, HELI, MISSION, WORLD } from "./constants.js";
import { distanceXZ, flatDirection, randRange, rightVector, yawVector, clamp } from "./math.js";
import { DustoffWorld } from "./world.js";
import { SoundDesign } from "./audio.js";

const BLACKHAWK_MODEL_URL = new URL(
  "../../models/Meshy_AI_Black_Hawk_in_Flight_0426234111_texture.glb",
  import.meta.url
).href;

const MODE = {
  pilot: "Auto Pilot",
  gunner: "Gunner",
};

const PHASE = {
  flyToLz: "flyToLz",
  orbitLz: "orbitLz",
  extract: "extract",
  returnCarrier: "returnCarrier",
  complete: "complete",
  failed: "failed",
};

const GUNNER_STATION = {
  camera: new THREE.Vector3(4.45, 1.25, 0.95),
  sightForward: 72,
  sightLift: -0.55,
};

export class DustoffGame {
  constructor(root) {
    this.root = root;
    this.clock = new THREE.Clock();
    this.keys = new Set();
    this.pointerLocked = false;
    this.started = false;
    this.mode = MODE.pilot;
    this.phase = PHASE.flyToLz;
    this.health = HELI.maxHealth;
    this.gunHeat = 0;
    this.soldiersRescued = 0;
    this.time = 0;
    this.enemySpawnTimer = 1;
    this.approachWave = 0;
    this.orbitTimer = 0;
    this.orbitAngle = 0;
    this.orbitDuration = 34;
    this.triggerHeld = false;
    this.fireTimer = 0;
    this.gunnerSide = -1;
    this.auto = { speed: 0, bank: 0, pitch: 0 };
    this.extractionStarted = false;
    this.message = "Click deploy, then click the canvas for mouse control.";

    this.heliPosition = new THREE.Vector3(WORLD.carrier.x, WORLD.carrier.y + 4, WORLD.carrier.z + 48);
    this.heliYaw = Math.PI;
    this.look = { yawOffset: 0, pitch: -0.08, gunYaw: 0, gunPitch: -0.04 };
    this.mouseSensitivity = 0.0019;

    this.soldiers = [];
    this.enemies = [];
    this.tracers = [];
    this.muzzleFlashTimer = 0;
    this.lastHeliPosition = this.heliPosition.clone();
    this.heliSpeed = 0;
    this.escortFireTimer = 2.2;
    this.audio = new SoundDesign();

    this.buildDom();
    this.initThree();
    this.registerEvents();
    this.resetMission();
  }

  buildDom() {
    this.root.innerHTML = `
      <main class="game-shell">
        <div class="hud">
          <div class="hud-block title">
            <span>DUSTOFF</span>
            <strong>Carrier Run</strong>
          </div>
          <div class="hud-block">
            <span>Mode</span>
            <strong data-mode>Pilot</strong>
          </div>
          <div class="hud-block objective">
            <span>Objective</span>
            <strong data-objective>Fly to the extraction zone</strong>
          </div>
          <div class="hud-block">
            <span>Hull</span>
            <div class="meter"><i data-health></i></div>
          </div>
          <div class="hud-block">
            <span>Rescued</span>
            <strong data-rescued>0 / 5</strong>
          </div>
          <div class="hud-block">
            <span>Gun Heat</span>
            <div class="meter heat"><i data-heat></i></div>
          </div>
        </div>
        <div class="pilot-nav" data-pilot-nav>
          <div><span>ALT</span><strong data-altitude>000</strong></div>
          <div><span>NAV DIST</span><strong data-lz-distance>0000</strong></div>
          <div><span>HDG</span><strong data-heading>000</strong></div>
          <div><span>BRG</span><strong data-bearing>000</strong></div>
          <div><span>AUTO</span><strong data-collective>ON</strong></div>
          <div><span>V/S</span><strong data-vertical-speed>+00</strong></div>
          <div><span>SPD</span><strong data-air-speed>000</strong></div>
        </div>
        <div class="mini-map" data-mini-map>
          <div class="map-title">TAC MAP</div>
          <div class="map-grid">
            <i class="map-dot carrier" data-map-carrier></i>
            <i class="map-dot lz" data-map-lz></i>
            <i class="map-dot heli" data-map-heli></i>
          </div>
        </div>
        <div class="reticle" data-reticle></div>
        <div class="side-label" data-side-label>PORT GUN</div>
        <div class="message" data-message></div>
        <div class="overlay" data-overlay>
          <section class="briefing">
            <p>90s Arcade Sortie</p>
            <h1>Dustoff: Carrier Run</h1>
            <ul>
              <li>Autopilot flies the helicopter to the LZ and back</li>
              <li>Mouse aims the side gun, hold left click to fire</li>
              <li>Q or E swaps gunner side</li>
              <li>Bring all five soldiers home and land on the carrier</li>
              <li>Audio starts after Deploy or first click</li>
            </ul>
            <button data-start>Deploy</button>
          </section>
        </div>
      </main>
    `;

    this.shell = this.root.querySelector(".game-shell");
    this.modeNode = this.root.querySelector("[data-mode]");
    this.objectiveNode = this.root.querySelector("[data-objective]");
    this.healthNode = this.root.querySelector("[data-health]");
    this.heatNode = this.root.querySelector("[data-heat]");
    this.rescuedNode = this.root.querySelector("[data-rescued]");
    this.messageNode = this.root.querySelector("[data-message]");
    this.overlay = this.root.querySelector("[data-overlay]");
    this.startButton = this.root.querySelector("[data-start]");
    this.reticle = this.root.querySelector("[data-reticle]");
    this.sideLabel = this.root.querySelector("[data-side-label]");
    this.pilotNavNode = this.root.querySelector("[data-pilot-nav]");
    this.altitudeNode = this.root.querySelector("[data-altitude]");
    this.lzDistanceNode = this.root.querySelector("[data-lz-distance]");
    this.headingNode = this.root.querySelector("[data-heading]");
    this.bearingNode = this.root.querySelector("[data-bearing]");
    this.collectiveNode = this.root.querySelector("[data-collective]");
    this.verticalSpeedNode = this.root.querySelector("[data-vertical-speed]");
    this.airSpeedNode = this.root.querySelector("[data-air-speed]");
    this.mapHeliNode = this.root.querySelector("[data-map-heli]");
    this.mapCarrierNode = this.root.querySelector("[data-map-carrier]");
    this.mapLzNode = this.root.querySelector("[data-map-lz]");
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.1, 620);
    this.gunnerViewModel = this.buildGunnerViewModel();
    this.camera.add(this.gunnerViewModel);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.domElement.className = "game-canvas";
    this.shell.prepend(this.renderer.domElement);

    this.world = new DustoffWorld(this.scene);
    this.helicopter = new Helicopter();
    this.scene.add(this.helicopter.group);
    this.helicopter.loadBlackhawkModel(BLACKHAWK_MODEL_URL).catch((error) => {
      console.warn("Blackhawk model failed to load; using procedural fallback.", error);
    });

    this.escort = new Helicopter();
    this.escort.group.name = "Escort Blackhawk";
    this.escort.group.position.set(WORLD.carrier.x + 34, WORLD.carrier.y + 16, WORLD.carrier.z + 18);
    this.escort.setPilotView(false);
    this.scene.add(this.escort.group);
    this.escort.loadBlackhawkModel(BLACKHAWK_MODEL_URL).catch((error) => {
      console.warn("Escort Blackhawk model failed to load; using procedural fallback.", error);
    });

    this.raycaster = new THREE.Raycaster();
    this.gunOrigin = new THREE.Vector3();
    this.gunDirection = new THREE.Vector3();

    this.muzzleFlash = new THREE.PointLight("#ffda7b", 0, 45, 2);
    this.scene.add(this.muzzleFlash);
  }

  buildGunnerViewModel() {
    const group = new THREE.Group();
    group.name = "First Person Door Gunner View";
    group.visible = false;

    const frameMat = new THREE.MeshBasicMaterial({ color: "#10120f" });
    const oliveMat = new THREE.MeshBasicMaterial({ color: "#3d442f" });
    const darkMat = new THREE.MeshBasicMaterial({ color: "#1a1d18" });
    const metalMat = new THREE.MeshBasicMaterial({ color: "#22251f" });

    const doorSill = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 1.45), frameMat);
    doorSill.position.set(0.58, -0.68, -1.35);
    doorSill.rotation.y = -0.08;
    group.add(doorSill);

    const gun = new THREE.Group();
    gun.name = "Viewmodel Chain Gun";
    gun.position.set(-0.08, -0.32, -1.36);
    gun.scale.setScalar(0.74);
    group.add(gun);
    this.gunnerViewGun = gun;

    const pintle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.52, 0.12), frameMat);
    pintle.position.set(-0.18, -0.18, 0.18);
    gun.add(pintle);

    const cradle = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.16, 0.18), frameMat);
    cradle.position.set(0.02, 0.02, -0.12);
    gun.add(cradle);

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.34, 0.72), darkMat);
    receiver.position.set(0, 0.08, -0.42);
    gun.add(receiver);

    const ammo = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.42), oliveMat);
    ammo.position.set(0.44, -0.03, -0.2);
    gun.add(ammo);

    const barrelCluster = new THREE.Group();
    barrelCluster.position.set(0, 0.08, -0.93);
    gun.add(barrelCluster);
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.32, 6), metalMat);
      barrel.position.set(Math.cos(angle) * 0.09, Math.sin(angle) * 0.09, -0.58);
      barrel.rotation.x = Math.PI / 2;
      barrelCluster.add(barrel);
    }

    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.72, 10, 1, true), metalMat);
    shroud.position.set(0, 0, -0.34);
    shroud.rotation.x = Math.PI / 2;
    barrelCluster.add(shroud);

    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.08, -2.14);
    gun.add(muzzle);
    this.gunnerViewMuzzle = muzzle;

    return group;
  }

  registerEvents() {
    window.addEventListener("resize", () => this.resize());
    document.addEventListener("keydown", (event) => {
      if (
        event.code === "Space" ||
        event.code === "ShiftLeft" ||
        event.code === "ShiftRight" ||
        event.code.startsWith("Arrow")
      ) {
        event.preventDefault();
      }
      this.keys.add(event.code);
      if ((event.code === "KeyQ" || event.code === "KeyE") && !event.repeat) {
        this.toggleGunnerSide();
      }
      if (
        (event.code === "KeyR" || event.code === "Enter" || event.code === "Space") &&
        !event.repeat &&
        (this.phase === PHASE.complete || this.phase === PHASE.failed)
      ) {
        this.restartMissionFromKeyboard();
      }
    });
    document.addEventListener("keyup", (event) => this.keys.delete(event.code));

    this.renderer.domElement.addEventListener("click", () => {
      this.audio.resume();
      this.renderer.domElement.requestPointerLock?.();
    });

    this.renderer.domElement.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      this.audio.resume();
      this.triggerHeld = true;
      if (this.mode === MODE.gunner) this.fireGun();
    });

    window.addEventListener("mouseup", (event) => {
      if (event.button === 0) this.triggerHeld = false;
    });

    window.addEventListener("blur", () => {
      this.triggerHeld = false;
    });

    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    });

    document.addEventListener("mousemove", (event) => {
      if (!this.pointerLocked || this.phase === PHASE.complete || this.phase === PHASE.failed) return;

      if (this.mode === MODE.pilot) {
        this.look.yawOffset = clamp(this.look.yawOffset - event.movementX * this.mouseSensitivity, -0.9, 0.9);
        this.look.pitch = clamp(this.look.pitch - event.movementY * this.mouseSensitivity, -0.75, 0.45);
      } else {
        this.look.gunYaw = clamp(this.look.gunYaw - event.movementX * this.mouseSensitivity, -3.05, 3.05);
        this.look.gunPitch = clamp(this.look.gunPitch - event.movementY * this.mouseSensitivity, -1.72, 0.78);
        this.aimMachineGun();
      }
    });

    this.startButton.addEventListener("click", () => {
      this.audio.resume();
      if (this.phase === PHASE.complete || this.phase === PHASE.failed) {
        this.resetMission();
      }
      this.deployMission();
    });
  }

  deployMission() {
    this.started = true;
    this.message = "Autopilot engaged. Cover the pickup from the side gun.";
    this.overlay.classList.add("hidden");
    this.audio.resume();
    this.renderer.domElement.requestPointerLock?.();
  }

  restartMissionFromKeyboard() {
    this.resetMission();
    this.deployMission();
  }

  start() {
    this.renderer.setAnimationLoop(() => this.update());
  }

  resetMission() {
    for (const soldier of this.soldiers) this.scene.remove(soldier.group);
    for (const enemy of this.enemies) this.scene.remove(enemy.group);
    for (const tracer of this.tracers) this.scene.remove(tracer.mesh);

    this.soldiers = [];
    this.enemies = [];
    this.tracers = [];
    this.mode = MODE.gunner;
    this.started = false;
    this.phase = PHASE.flyToLz;
    this.health = HELI.maxHealth;
    this.gunHeat = 0;
    this.triggerHeld = false;
    this.fireTimer = 0;
    this.gunnerSide = -1;
    this.soldiersRescued = 0;
    this.time = 0;
    this.enemySpawnTimer = 1;
    this.approachWave = 0;
    this.orbitTimer = 0;
    this.orbitAngle = 0;
    this.extractionStarted = false;
    this.heliPosition.set(WORLD.carrier.x, WORLD.carrier.y + 4, WORLD.carrier.z + 48);
    this.heliYaw = Math.PI;
    this.helicopter.group.position.copy(this.heliPosition);
    this.helicopter.group.rotation.y = this.heliYaw;
    this.escort.group.position.set(WORLD.carrier.x + 34, WORLD.carrier.y + 16, WORLD.carrier.z + 18);
    this.escort.group.rotation.y = this.heliYaw;
    this.flight = {
      velocity: new THREE.Vector3(),
      collective: HELI.hoverCollective,
      cyclicPitch: 0,
      cyclicRoll: 0,
      yawRate: 0,
      visualPitch: 0,
      visualRoll: 0,
      verticalSpeed: 0,
      airSpeed: 0,
    };
    this.auto.speed = 0;
    this.auto.bank = 0;
    this.auto.pitch = 0;
    this.look.yawOffset = 0;
    this.look.pitch = -0.08;
    this.look.gunYaw = 0;
    this.look.gunPitch = -0.04;
    this.helicopter.setGunnerSide(this.gunnerSide);
    this.lastHeliPosition.copy(this.heliPosition);
    this.heliSpeed = 0;
    this.message = "Autopilot engaged. Cover the pickup from the side gun.";
    this.overlay.classList.remove("complete", "failed");
    this.restoreBriefingOverlay();
    this.updateHud();
  }

  update() {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.time += delta;

    this.world.update(this.time, delta);
    this.updateAutopilot(delta);
    this.updateEscort(delta);
    this.updateMission(delta);
    this.updateActors(delta);
    this.updateCamera();
    this.updateGunTrigger(delta);
    this.updateEffects(delta);
    this.updateAudio(delta);
    this.updateHud();
    this.renderer.render(this.scene, this.camera);
  }

  handlePilotInput(delta) {
    if (this.mode !== MODE.pilot || this.phase === PHASE.complete || this.phase === PHASE.failed) {
      this.updateFlightPhysics(delta, false);
      return;
    }

    const targetPitch = (this.keys.has("ArrowUp") ? 1 : 0) + (this.keys.has("ArrowDown") ? -1 : 0);
    const targetRoll = (this.keys.has("ArrowLeft") ? 1 : 0) + (this.keys.has("ArrowRight") ? -1 : 0);
    const yawInput = (this.keys.has("KeyD") || this.keys.has("KeyB") ? 1 : 0) + (this.keys.has("KeyA") ? -1 : 0);

    if (this.keys.has("KeyW")) this.flight.collective += HELI.collectiveRate * delta;
    if (this.keys.has("KeyS")) this.flight.collective -= HELI.collectiveRate * delta;
    this.flight.collective = clamp(this.flight.collective, 0.05, 1);

    this.flight.cyclicPitch += (targetPitch - this.flight.cyclicPitch) * Math.min(1, delta * 4.5);
    this.flight.cyclicRoll += (targetRoll - this.flight.cyclicRoll) * Math.min(1, delta * 4.5);
    this.flight.yawRate += yawInput * HELI.yawAccel * delta;
    this.flight.yawRate -= this.flight.yawRate * HELI.yawDrag * delta;
    this.heliYaw -= this.flight.yawRate * delta;

    this.updateFlightPhysics(delta, true);
  }

  updateAutopilot(delta) {
    if (!this.started) {
      this.flight.airSpeed = 0;
      this.flight.verticalSpeed = 0;
      this.helicopter.group.position.copy(this.heliPosition);
      this.helicopter.group.rotation.y = this.heliYaw;
      this.helicopter.update(delta, HELI.rotorSpeed * 0.75);
      return;
    }

    if (this.phase === PHASE.complete || this.phase === PHASE.failed) {
      this.auto.speed += (0 - this.auto.speed) * Math.min(1, delta * 2);
      this.helicopter.update(delta, HELI.rotorSpeed * 0.8);
      return;
    }

    const target = this.getAutopilotTarget();
    const toTarget = new THREE.Vector3(target.x - this.heliPosition.x, 0, target.z - this.heliPosition.z);
    const distance = toTarget.length();
    const desiredYaw = distance > 0.01 ? Math.atan2(toTarget.x, toTarget.z) : this.heliYaw;
    const yawDelta = Math.atan2(Math.sin(desiredYaw - this.heliYaw), Math.cos(desiredYaw - this.heliYaw));
    const turn = clamp(yawDelta, -1.2, 1.2);
    this.heliYaw += turn * delta * 1.55;

    const slowRadius = this.phase === PHASE.extract ? 18 : 95;
    const targetSpeed = clamp(distance / slowRadius, 0, 1) * this.getAutopilotCruiseSpeed();
    this.auto.speed += (targetSpeed - this.auto.speed) * Math.min(1, delta * 1.25);

    const forward = yawVector(this.heliYaw);
    this.flight.velocity.x = forward.x * this.auto.speed;
    this.flight.velocity.z = forward.z * this.auto.speed;

    const ground = this.groundHeightAtHeli();
    const desiredY = ground + this.getAutopilotAltitude(distance);
    const verticalError = desiredY - this.heliPosition.y;
    this.flight.velocity.y += clamp(verticalError * 0.58, -10, 10) * delta;
    this.flight.velocity.y -= this.flight.velocity.y * 1.7 * delta;

    this.heliPosition.addScaledVector(this.flight.velocity, delta);
    this.heliPosition.y = clamp(this.heliPosition.y, ground + HELI.minAltitude, HELI.maxAltitude);
    this.flight.verticalSpeed = this.flight.velocity.y;
    this.flight.airSpeed = Math.hypot(this.flight.velocity.x, this.flight.velocity.z);
    this.flight.collective = clamp(HELI.hoverCollective + this.flight.verticalSpeed * 0.018, 0.25, 0.9);

    this.auto.bank += (clamp(-turn * 0.24, -0.28, 0.28) - this.auto.bank) * Math.min(1, delta * 3);
    this.auto.pitch += (clamp(this.auto.speed / 78, 0, 0.16) - this.auto.pitch) * Math.min(1, delta * 2.5);
    this.helicopter.group.position.copy(this.heliPosition);
    this.helicopter.group.rotation.y = this.heliYaw;
    this.helicopter.group.rotation.x = -this.auto.pitch;
    this.helicopter.group.rotation.z = this.auto.bank;
    this.helicopter.update(delta, HELI.rotorSpeed * (0.7 + this.flight.collective * 0.55));
  }

  updateEscort(delta) {
    if (!this.escort) return;

    const forward = yawVector(this.heliYaw);
    const right = rightVector(this.heliYaw);
    const visibleSide = this.gunnerSide < 0 ? -1 : 1;
    const formation = this.heliPosition
      .clone()
      .addScaledVector(right, visibleSide * 58)
      .addScaledVector(forward, this.phase === PHASE.orbitLz ? -38 : -20);
    formation.y += this.phase === PHASE.orbitLz ? 4 : 3;

    this.escort.group.position.lerp(formation, Math.min(1, delta * 1.6));
    this.escort.group.rotation.y += Math.atan2(
      Math.sin(this.heliYaw - this.escort.group.rotation.y),
      Math.cos(this.heliYaw - this.escort.group.rotation.y)
    ) * Math.min(1, delta * 2.2);
    this.escort.group.rotation.x = this.helicopter.group.rotation.x * 0.7;
    this.escort.group.rotation.z = -this.helicopter.group.rotation.z * 0.55;
    this.escort.update(delta, HELI.rotorSpeed * 1.05);

    this.escortFireTimer -= delta;
    if (!this.started || this.phase === PHASE.complete || this.phase === PHASE.failed || this.escortFireTimer > 0) return;

    const target = this.enemies.find(
      (enemy) => !enemy.dead && enemy.group.position.distanceTo(this.escort.group.position) < 210
    );
    if (!target) {
      this.escortFireTimer = 1.2;
      return;
    }

    const origin = this.escort.group.position
      .clone()
      .addScaledVector(right, this.gunnerSide < 0 ? -9 : 9)
      .add(new THREE.Vector3(0, -1.5, 4));
    const targetPoint = target.group.position.clone().add(new THREE.Vector3(0, 2.5, 0));
    this.spawnTracer(origin, targetPoint);
    if (Math.random() > 0.35) {
      target.kill();
      this.message = "Escort Blackhawk suppressing enemy positions.";
    }
    this.escortFireTimer = randRange(1.1, 1.9);
  }

  getAutopilotTarget() {
    if (this.phase === PHASE.orbitLz) {
      const radius = 72;
      return new THREE.Vector3(
        WORLD.extraction.x + Math.sin(this.orbitAngle) * radius,
        0,
        WORLD.extraction.z + Math.cos(this.orbitAngle) * radius
      );
    }
    if (this.phase === PHASE.returnCarrier) return new THREE.Vector3(WORLD.carrier.x, 0, WORLD.carrier.z + 48);
    return new THREE.Vector3(WORLD.extraction.x, 0, WORLD.extraction.z);
  }

  getAutopilotCruiseSpeed() {
    if (this.phase === PHASE.orbitLz) return 15;
    if (this.phase === PHASE.extract) return 4;
    return this.phase === PHASE.returnCarrier ? 34 : 38;
  }

  getAutopilotAltitude(distance) {
    if (this.phase === PHASE.orbitLz) return 48;
    if (this.phase === PHASE.extract) return HELI.minAltitude + 1.5;
    if (this.phase === PHASE.flyToLz && distance < 70) return HELI.minAltitude + 3.5;
    if (this.phase === PHASE.returnCarrier && distance < 80) return HELI.minAltitude + 4;
    return 42;
  }

  updateFlightPhysics(delta, pilotHasControl) {
    const forward = yawVector(this.heliYaw);
    const right = rightVector(this.heliYaw);
    const ground = this.groundHeightAtHeli();
    const altitude = this.heliPosition.y - ground;
    const groundEffect = altitude < 10 ? (1 - altitude / 10) * 1.5 * Math.max(0, this.flight.collective - HELI.hoverCollective) : 0;
    const liftAccel = (this.flight.collective - HELI.hoverCollective) * HELI.liftPower + groundEffect;
    const horizontalControl = pilotHasControl ? clamp(this.flight.collective * 1.3, 0.25, 1) : 0.18;

    this.flight.velocity.addScaledVector(forward, this.flight.cyclicPitch * HELI.cyclicAccel * horizontalControl * delta);
    this.flight.velocity.addScaledVector(right, this.flight.cyclicRoll * HELI.cyclicAccel * horizontalControl * delta);
    this.flight.velocity.y += liftAccel * delta;
    this.flight.velocity.y -= this.flight.velocity.y * HELI.verticalDrag * delta;
    this.flight.velocity.x -= this.flight.velocity.x * HELI.horizontalDrag * delta;
    this.flight.velocity.z -= this.flight.velocity.z * HELI.horizontalDrag * delta;

    const horizontalSpeed = Math.hypot(this.flight.velocity.x, this.flight.velocity.z);
    if (horizontalSpeed > HELI.maxAirSpeed) {
      const limit = HELI.maxAirSpeed / horizontalSpeed;
      this.flight.velocity.x *= limit;
      this.flight.velocity.z *= limit;
    }

    this.heliPosition.addScaledVector(this.flight.velocity, delta);
    if (this.heliPosition.y < ground + HELI.minAltitude) {
      this.heliPosition.y = ground + HELI.minAltitude;
      this.flight.velocity.y = Math.max(0, this.flight.velocity.y);
    }
    if (this.heliPosition.y > HELI.maxAltitude) {
      this.heliPosition.y = HELI.maxAltitude;
      this.flight.velocity.y = Math.min(0, this.flight.velocity.y);
    }

    this.flight.verticalSpeed = this.flight.velocity.y;
    this.flight.airSpeed = horizontalSpeed;
    this.flight.visualPitch += (-this.flight.cyclicPitch * HELI.maxPitch - this.flight.visualPitch) * Math.min(1, delta * 4);
    this.flight.visualRoll += (this.flight.cyclicRoll * HELI.maxBank - this.flight.visualRoll) * Math.min(1, delta * 4);

    this.helicopter.group.position.copy(this.heliPosition);
    this.helicopter.group.rotation.y = this.heliYaw;
    this.helicopter.group.rotation.x = this.flight.visualPitch;
    this.helicopter.group.rotation.z = this.flight.visualRoll;
    this.helicopter.update(delta, HELI.rotorSpeed * (0.65 + this.flight.collective * 0.55));
  }

  groundHeightAtHeli() {
    if (distanceXZ(this.heliPosition, WORLD.carrier) < 95 && Math.abs(this.heliPosition.z - WORLD.carrier.z) < 105) {
      return WORLD.carrier.y;
    }
    if (distanceXZ(this.heliPosition, WORLD.extraction) < 145) {
      return WORLD.extraction.y;
    }
    return 0;
  }

  toggleMode() {
    this.toggleGunnerSide();
  }

  toggleGunnerSide() {
    this.gunnerSide *= -1;
    this.look.gunYaw = 0;
    this.look.gunPitch = -0.04;
    this.helicopter.setGunnerSide(this.gunnerSide);
    this.message = `${this.gunnerSide < 0 ? "Port" : "Starboard"} gun selected.`;
  }

  fireGun() {
    if (this.mode !== MODE.gunner || this.gunHeat >= MISSION.gunHeatMax || this.phase === PHASE.complete) return;

    this.fireTimer = 0.075;
    this.gunHeat = Math.min(MISSION.gunHeatMax, this.gunHeat + MISSION.gunHeatPerShot);
    this.audio.fireGun();
    this.muzzleFlashTimer = 0.06;
    this.getPlayerGunMuzzle(this.gunOrigin);
    this.getGunDirection(this.gunDirection);
    const rayOrigin = this.mode === MODE.gunner ? this.camera.position : this.gunOrigin;
    this.raycaster.set(rayOrigin, this.gunDirection);
    this.raycaster.far = 620;

    const liveEnemies = this.enemies.filter((enemy) => !enemy.dead).map((enemy) => enemy.group);
    const hits = this.raycaster.intersectObjects(liveEnemies, true);
    if (hits.length > 0) {
      const hitGroup = this.findEnemyGroup(hits[0].object);
      const enemy = this.enemies.find((candidate) => candidate.group === hitGroup);
      enemy?.kill();
      this.audio.hit();
      this.message = "Enemy neutralized.";
      this.spawnTracer(this.gunOrigin, hits[0].point);
      return;
    }

    const end = rayOrigin.clone().addScaledVector(this.gunDirection, 520);
    this.spawnTracer(this.gunOrigin, end);
  }

  findEnemyGroup(object) {
    let node = object;
    while (node && node.parent) {
      if (this.enemies.some((enemy) => enemy.group === node)) return node;
      node = node.parent;
    }
    return null;
  }

  getGunDirection(target) {
    const yaw = this.heliYaw + this.gunnerSide * Math.PI * 0.5 + this.look.gunYaw;
    target.set(Math.sin(yaw), Math.sin(this.look.gunPitch), Math.cos(yaw)).normalize();
    return target;
  }

  spawnTracer(start, end) {
    const distance = start.distanceTo(end);
    const geometry = new THREE.BoxGeometry(0.22, 0.22, distance);
    const material = new THREE.MeshBasicMaterial({ color: COLORS.tracer, transparent: true });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(start).lerp(end, 0.5);
    mesh.lookAt(end);
    this.scene.add(mesh);
    this.tracers.push({ mesh, life: 0.07 });
  }

  getPlayerGunMuzzle(target) {
    if (this.mode === MODE.gunner && this.gunnerViewMuzzle) {
      this.gunnerViewMuzzle.getWorldPosition(target);
      return target;
    }
    this.helicopter.muzzle.getWorldPosition(target);
    return target;
  }

  updateMission(delta) {
    const nearLz = distanceXZ(this.heliPosition, WORLD.extraction) < MISSION.lzRadius;
    const lowAtLz = nearLz && this.heliPosition.y <= WORLD.extraction.y + MISSION.landingAltitude;
    const nearCarrier = distanceXZ(this.heliPosition, WORLD.carrier) < MISSION.carrierLandingRadius;
    const lowAtCarrier = nearCarrier && this.heliPosition.y <= WORLD.carrier.y + MISSION.landingAltitude;
    const lzDistance = distanceXZ(this.heliPosition, WORLD.extraction);

    if (this.phase === PHASE.flyToLz) {
      this.updateApproachAmbush(lzDistance);
    }

    if (this.phase === PHASE.flyToLz && lzDistance < 125) {
      this.beginOrbit();
    }

    if (this.phase === PHASE.orbitLz) {
      this.updateLzOrbit(delta);
    }

    if (this.phase === PHASE.flyToLz && lowAtLz) {
      this.beginExtraction();
    }

    if (this.phase === PHASE.extract) {
      this.enemySpawnTimer -= delta;
      if (this.enemySpawnTimer <= 0 && this.enemies.filter((enemy) => !enemy.dead).length < MISSION.enemyMax) {
        this.spawnEnemy();
        this.enemySpawnTimer = MISSION.enemySpawnEvery;
      }

      if (this.soldiersRescued >= MISSION.soldierCount) {
      this.phase = PHASE.returnCarrier;
      this.message = "Squad aboard. Autopilot returning to the carrier.";
      }

      const allLost = this.soldiers.length > 0 && this.soldiers.every((soldier) => soldier.dead || soldier.boarded);
      if (allLost && this.soldiersRescued < MISSION.soldierCount) {
        this.failMission("Extraction failed. Press R to reset.");
      }
    }

    if (this.phase === PHASE.returnCarrier && lowAtCarrier) {
      this.completeMission();
    }

    if (this.health <= 0 && this.phase !== PHASE.failed) {
      this.failMission("Helicopter destroyed. Press R to reset.");
    }
  }

  beginOrbit() {
    this.phase = PHASE.orbitLz;
    this.orbitTimer = 0;
    this.orbitAngle = Math.atan2(this.heliPosition.x - WORLD.extraction.x, this.heliPosition.z - WORLD.extraction.z);
    this.message = "Orbiting the LZ. Clear enemy positions before landing.";
    this.spawnAmbushWave(2);
  }

  updateLzOrbit(delta) {
    this.orbitTimer += delta;
    const inwardGunDirection = this.gunnerSide < 0 ? -1 : 1;
    this.orbitAngle += delta * 0.2 * inwardGunDirection;
    this.enemySpawnTimer -= delta;
    if (this.enemySpawnTimer <= 0 && this.enemies.filter((enemy) => !enemy.dead).length < MISSION.enemyMax) {
      this.spawnEnemy();
      this.enemySpawnTimer = MISSION.enemySpawnEvery;
    }
    if (this.orbitTimer >= this.orbitDuration) {
      this.beginExtraction();
    }
  }

  updateApproachAmbush(lzDistance) {
    const waveDistances = [340, 230, 135];
    if (this.approachWave >= waveDistances.length) return;
    if (lzDistance < waveDistances[this.approachWave]) {
      this.spawnAmbushWave(this.approachWave);
      this.approachWave += 1;
      this.message = "Contact ahead. Suppress enemy firing positions.";
    }
  }

  beginExtraction() {
    this.phase = PHASE.extract;
    this.extractionStarted = true;
    this.message = "Extraction started. Switch to gunner mode and cover the squad.";

    for (let i = 0; i < MISSION.soldierCount; i += 1) {
      const angle = -Math.PI * 0.2 + i * 0.28;
      const pos = new THREE.Vector3(
        WORLD.extraction.x + Math.sin(angle) * randRange(48, 68),
        WORLD.extraction.y,
        WORLD.extraction.z + Math.cos(angle) * randRange(44, 70)
      );
      const soldier = new Soldier(pos, i);
      this.soldiers.push(soldier);
      this.scene.add(soldier.group);
    }

    for (let i = 0; i < 5; i += 1) {
      const angle = -1.2 + i * 0.6;
      const cover = enemyFirePosition(WORLD.extraction, angle, randRange(36, 82), 10);
      this.spawnEnemy(cover.clone().add(new THREE.Vector3(randRange(-12, 12), 0, randRange(-12, 12))), {
        coverPosition: cover,
        range: randRange(65, 120),
        accuracy: randRange(0.38, 0.66),
        role: i === 0 ? "rpg" : "rifle",
      });
    }
  }

  spawnEnemy(position = null, options = {}) {
    const enemy = new Enemy(position ?? randomEnemySpawn(WORLD.extraction), options);
    this.enemies.push(enemy);
    this.scene.add(enemy.group);
  }

  spawnAmbushWave(waveIndex) {
    const routeT = [0.68, 0.78, 0.88][waveIndex] ?? 0.82;
    const routeCenter = new THREE.Vector3().lerpVectors(
      new THREE.Vector3(WORLD.carrier.x, 2, WORLD.carrier.z + 48),
      new THREE.Vector3(WORLD.extraction.x, 2, WORLD.extraction.z),
      routeT
    );
    const routeAngle = Math.atan2(WORLD.extraction.x - WORLD.carrier.x, WORLD.extraction.z - (WORLD.carrier.z + 48));
    const count = 3 + waveIndex;

    for (let i = 0; i < count; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const angle = routeAngle + side * (Math.PI / 2 + randRange(-0.26, 0.28));
      const cover = enemyFirePosition(routeCenter, angle, randRange(28, 68), 12);
      const spawn = cover.clone().add(new THREE.Vector3(randRange(-10, 10), 0, randRange(-10, 10)));
      this.spawnEnemy(spawn, {
        coverPosition: cover,
        range: randRange(60, 115),
        accuracy: randRange(0.28, 0.52),
        role: waveIndex > 1 && i === 0 ? "rpg" : "rifle",
      });
    }
  }

  updateActors(delta) {
    if (this.phase !== PHASE.flyToLz && this.phase !== PHASE.orbitLz && this.phase !== PHASE.extract && this.phase !== PHASE.returnCarrier) return;

    const canBoard =
      this.phase === PHASE.extract &&
      distanceXZ(this.heliPosition, WORLD.extraction) < MISSION.lzRadius + 12 &&
      this.heliPosition.y <= WORLD.extraction.y + MISSION.landingAltitude + 3;

    const before = this.soldiersRescued;
    for (const soldier of this.soldiers) {
      soldier.update(delta, this.heliPosition, canBoard);
    }
    this.soldiersRescued = this.soldiers.filter((soldier) => soldier.boarded).length;
    if (this.soldiersRescued > before) {
      this.audio.board();
      this.message = `Soldier aboard: ${this.soldiersRescued} / ${MISSION.soldierCount}.`;
    }

    for (const enemy of this.enemies) {
      const liveSoldier = this.soldiers.find(
        (soldier) => !soldier.dead && !soldier.boarded && soldier.group.position.distanceTo(enemy.group.position) < enemy.range
      );
      const enemyTarget = liveSoldier?.group.position ?? this.heliPosition;
      enemy.update(delta, enemyTarget);
      if (!enemy.dead && enemy.shootTimer <= 0) {
        this.enemyAttack(enemy);
        enemy.shootTimer = enemy.role === "rpg" ? randRange(3.2, 5.5) : randRange(1.2, 2.5);
      }
    }

    this.enemies = this.enemies.filter((enemy) => {
      if (enemy.dead && enemy.deathTimer > 1.4) {
        this.scene.remove(enemy.group);
        return false;
      }
      return true;
    });
  }

  enemyAttack(enemy) {
    if (!enemy.inCover) return;
    const distanceToHeli = enemy.group.position.distanceTo(this.heliPosition);
    const canHitHeli = distanceToHeli < enemy.range + 55;
    const targetSoldier = this.soldiers.find(
      (soldier) => !soldier.dead && !soldier.boarded && soldier.group.position.distanceTo(enemy.group.position) < enemy.range
    );

    if (targetSoldier && Math.random() < enemy.accuracy * 0.82) {
      targetSoldier.damage(enemy.role === "rpg" ? 38 : 18);
      this.message = "A soldier is taking fire.";
      this.spawnTracer(enemy.group.position.clone().add(new THREE.Vector3(0, 3, 0)), targetSoldier.group.position);
      return;
    }

    if (canHitHeli && Math.random() < enemy.accuracy) {
      const damage = enemy.role === "rpg" ? randRange(5, 9) : randRange(1.1, 2.8);
      this.health = Math.max(0, this.health - damage);
      if (this.health < 35) this.audio.warning();
      this.message = enemy.role === "rpg" ? "Heavy fire from a distant position." : "Incoming fire from enemy positions.";
      this.spawnTracer(enemy.group.position.clone().add(new THREE.Vector3(0, 3, 0)), this.heliPosition);
    } else if (canHitHeli) {
      const miss = this.heliPosition
        .clone()
        .add(new THREE.Vector3(randRange(-18, 18), randRange(-10, 10), randRange(-18, 18)));
      this.spawnTracer(enemy.group.position.clone().add(new THREE.Vector3(0, 3, 0)), miss);
    }
  }

  updateEffects(delta) {
    this.gunHeat = Math.max(0, this.gunHeat - MISSION.gunCoolRate * delta);
    this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - delta);
    this.muzzleFlash.intensity = this.muzzleFlashTimer > 0 ? 35 : 0;
    this.getPlayerGunMuzzle(this.muzzleFlash.position);

    this.tracers = this.tracers.filter((tracer) => {
      tracer.life -= delta;
      tracer.mesh.material.opacity = Math.max(0, tracer.life / 0.07);
      if (tracer.life <= 0) {
        this.scene.remove(tracer.mesh);
        return false;
      }
      return true;
    });
  }

  updateGunTrigger(delta) {
    this.fireTimer = Math.max(0, this.fireTimer - delta);
    if (!this.triggerHeld || this.mode !== MODE.gunner) return;
    if (this.gunHeat >= MISSION.gunHeatMax) {
      this.message = "Gun overheated. Release trigger and let it cool.";
      return;
    }
    if (this.fireTimer <= 0) {
      this.fireGun();
    }
  }

  updateAudio(delta) {
    this.heliSpeed = this.heliPosition.distanceTo(this.lastHeliPosition) / Math.max(delta, 0.001);
    this.lastHeliPosition.copy(this.heliPosition);
    this.audio.update({
      mode: this.mode,
      altitude: this.heliPosition.y - this.groundHeightAtHeli(),
      speed: this.heliSpeed,
      heat: this.gunHeat,
    });
  }

  updateCamera() {
    if (this.mode === MODE.pilot) {
      const cameraYaw = this.heliYaw + this.look.yawOffset;
      const forward = yawVector(cameraYaw);
      const cockpit = this.helicopter.group.localToWorld(new THREE.Vector3(0, 3.15, 15.15));
      const lookAt = cockpit.clone().addScaledVector(forward, 45);
      lookAt.y += Math.sin(this.look.pitch) * 28 + 2;
      this.camera.position.copy(cockpit);
      this.camera.lookAt(lookAt);
    } else {
      this.aimMachineGun();
      const sideSeat = new THREE.Vector3(
        this.gunnerSide * GUNNER_STATION.camera.x,
        GUNNER_STATION.camera.y,
        GUNNER_STATION.camera.z
      ).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heliYaw);
      const cameraPos = this.heliPosition.clone().add(sideSeat);
      this.getGunDirection(this.gunDirection);
      this.camera.position.copy(cameraPos);
      this.camera.lookAt(
        cameraPos
          .clone()
          .addScaledVector(this.gunDirection, GUNNER_STATION.sightForward)
          .add(new THREE.Vector3(0, GUNNER_STATION.sightLift, 0))
      );
    }
  }

  aimMachineGun() {
    if (!this.helicopter.machineGun) return;
    this.helicopter.machineGun.rotation.y = this.gunnerSide * Math.PI * 0.5 + this.look.gunYaw;
    this.helicopter.machineGun.rotation.x = -this.look.gunPitch;
    if (this.gunnerViewGun) {
      this.gunnerViewGun.rotation.y = 0;
      this.gunnerViewGun.rotation.x = 0;
    }
  }

  getObjective() {
    if (this.phase === PHASE.flyToLz) return "Fly to the extraction zone";
    if (this.phase === PHASE.orbitLz) return "Clear the LZ from orbit";
    if (this.phase === PHASE.extract) return "Cover soldiers until they board";
    if (this.phase === PHASE.returnCarrier) return "Return to the aircraft carrier";
    if (this.phase === PHASE.complete) return "Mission Complete";
    return "Mission Failed";
  }

  updateHud() {
    this.modeNode.textContent = this.mode;
    this.objectiveNode.textContent = this.getObjective();
    this.healthNode.style.width = `${this.health}%`;
    this.heatNode.style.width = `${this.gunHeat}%`;
    this.rescuedNode.textContent = `${this.soldiersRescued} / ${MISSION.soldierCount}`;
    this.messageNode.textContent = this.message;
    this.reticle.classList.toggle("gunner", this.mode === MODE.gunner);
    this.sideLabel.classList.toggle("visible", this.mode === MODE.gunner);
    this.sideLabel.textContent = this.gunnerSide < 0 ? "PORT GUN" : "STARBOARD GUN";
    this.gunnerViewModel.visible = this.mode === MODE.gunner;
    this.gunnerViewModel.scale.x = this.gunnerSide < 0 ? 1 : -1;
    this.pilotNavNode.classList.remove("hidden");
    this.helicopter.setViewMode(this.mode === MODE.pilot ? "pilot" : "gunner", this.gunnerSide);
    this.altitudeNode.textContent = String(Math.round(this.heliPosition.y - this.groundHeightAtHeli())).padStart(3, "0");
    const navTarget = this.phase === PHASE.returnCarrier ? WORLD.carrier : WORLD.extraction;
    this.lzDistanceNode.textContent = String(Math.round(distanceXZ(this.heliPosition, navTarget))).padStart(4, "0");
    const heading = Math.round(((Math.PI * 2 - this.heliYaw) * 180) / Math.PI);
    this.headingNode.textContent = String(((heading % 360) + 360) % 360).padStart(3, "0");
    this.bearingNode.textContent = String(this.bearingTo(navTarget)).padStart(3, "0");
    this.collectiveNode.textContent = "ON";
    const verticalSpeed = Math.round(this.flight.verticalSpeed);
    this.verticalSpeedNode.textContent = `${verticalSpeed >= 0 ? "+" : "-"}${String(Math.abs(verticalSpeed)).padStart(2, "0")}`;
    this.airSpeedNode.textContent = String(Math.round(this.flight.airSpeed)).padStart(3, "0");
    this.updateMiniMap();
  }

  updateMiniMap() {
    const setDot = (node, point) => {
      const x = clamp((point.x + 180) / 360, 0, 1) * 100;
      const y = clamp((point.z + 520) / 620, 0, 1) * 100;
      node.style.left = `${x}%`;
      node.style.top = `${y}%`;
    };
    setDot(this.mapCarrierNode, WORLD.carrier);
    setDot(this.mapLzNode, WORLD.extraction);
    setDot(this.mapHeliNode, this.heliPosition);
    this.mapHeliNode.style.transform = `translate(-50%, -50%) rotate(${this.heliYaw}rad)`;
  }

  bearingTo(target) {
    const dx = target.x - this.heliPosition.x;
    const dz = target.z - this.heliPosition.z;
    const bearing = Math.round((Math.atan2(dx, dz) * 180) / Math.PI);
    return ((bearing % 360) + 360) % 360;
  }

  completeMission() {
    this.phase = PHASE.complete;
    this.message = "Mission Complete";
    this.audio.missionComplete();
    this.overlay.classList.remove("hidden");
    this.overlay.classList.add("complete");
    this.overlay.querySelector("p").textContent = "Mission Complete";
    this.overlay.querySelector("h1").textContent = "Dustoff successful";
    this.overlay.querySelector("ul").innerHTML = `
      <li>All five soldiers extracted</li>
      <li>Carrier landing confirmed</li>
      <li>Press R, Enter, or Space to fly again</li>
    `;
  }

  failMission(reason) {
    this.phase = PHASE.failed;
    this.message = reason;
    this.audio.warning();
    this.overlay.classList.remove("hidden");
    this.overlay.classList.add("failed");
    this.overlay.querySelector("p").textContent = "Mission Failed";
    this.overlay.querySelector("h1").textContent = "Run aborted";
    this.overlay.querySelector("ul").innerHTML = `
      <li>${reason}</li>
      <li>Press R, Enter, or Space to reset the sortie</li>
    `;
  }

  restoreBriefingOverlay() {
    this.overlay.querySelector("p").textContent = "90s Arcade Sortie";
    this.overlay.querySelector("h1").textContent = "Dustoff: Carrier Run";
    this.overlay.querySelector("ul").innerHTML = `
      <li>Autopilot flies the helicopter to the LZ and back</li>
      <li>The helicopter orbits before landing so you can clear the LZ</li>
      <li>Mouse aims the side gun, hold left click to fire</li>
      <li>Q or E swaps gunner side</li>
      <li>Bring all five soldiers home and land on the carrier</li>
      <li>Audio starts after Deploy or first click</li>
    `;
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
