import {
  Engine, Scene, Vector3, FollowCamera, ShadowGenerator, DirectionalLight,
  CubeTexture, Color3, StandardMaterial, Texture, MeshBuilder,
  Matrix, HemisphericLight, ParticleSystem, Color4, Viewport
} from '@babylonjs/core';

import {
  createMixMapGround, createDepartureLine, createCheckpoint,
  createCheckpointMaterial, createPitComplex
} from '../scripts/object.js';
import {
  CONTROLS, stepVehicle, mergeSoloScheme, getWorldPosition, spinWheels, followPitPath,
  resolveCarCollision, getDraftBoost
} from '../scripts/car.js';
import { createF1Car, TEAM_COLORS } from '../scripts/f1car.js';
import {
  CHECKPOINT_LAYOUT, CHECKPOINT_RADIUS, CHECKPOINT_WIDTH, TOTAL_CHECKPOINTS,
  START_ROT, getStartPositions, isInsidePitLane, isInsidePitEntry,
  separatePitCars,
  PIT_LANE, GROUND_SIZE, getPitPathsForPlayer
} from '../scripts/track.js';
import {
  DEFAULT_COMPOUND, getCompound, computeTireWear, getTirePerformance,
  applyWheelCompoundColor, PIT_SELECT_KEYS
} from '../scripts/tires.js';

const canvas = document.getElementById('renderCanvas');
const engine = new Engine(canvas, true, { adaptToDeviceRatio: true });
const keysPressed = new Set();

const BEST_TIME_KEY = 'gp_silverstone_best';

const ui = {
  loading: document.getElementById('loading'),
  overlay: document.getElementById('overlay'),
  finish: document.getElementById('finish-screen'),
  countdown: document.getElementById('countdown'),
  countdownText: document.getElementById('countdown-text'),
  timer: document.getElementById('timer'),
  lapGlobal: document.getElementById('lap-global'),
  statusPill: document.getElementById('status-pill'),
  pitPill: document.getElementById('pit-pill'),
  finishTime: document.getElementById('finish-time'),
  finishBest: document.getElementById('finish-best'),
  finishTitle: document.getElementById('finish-title'),
  flash: document.getElementById('flash'),
  startBtn: document.getElementById('start-btn'),
  restartBtn: document.getElementById('restart-btn'),
  menuBtn: document.getElementById('menu-btn'),
  hudP2: document.getElementById('hud-p2'),
};

const settings = {
  players: 1,
  laps: 3,
  tiresP1: DEFAULT_COMPOUND,
  tiresP2: DEFAULT_COMPOUND,
};

function bindChips(groupId, key, asString = false) {
  const group = document.getElementById(groupId);
  group?.querySelectorAll('.chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('.chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      settings[key] = asString ? btn.dataset.value : Number(btn.dataset.value);
      updateLobbyHints();
    });
  });
}
bindChips('opt-players', 'players');
bindChips('opt-laps', 'laps');
bindChips('opt-tires-p1', 'tiresP1', true);
bindChips('opt-tires-p2', 'tiresP2', true);

function updateLobbyHints() {
  ui.lapGlobal.textContent = `Tour 1 / ${settings.laps}`;
  document.body.classList.toggle('duel', settings.players === 2);
  ui.hudP2.classList.toggle('hidden', settings.players !== 2);
  document.getElementById('row-tires-p2')?.classList.toggle('hidden', settings.players !== 2);
}

updateLobbyHints();

function formatTime(ms) {
  const minutes = Math.floor(ms / 60000).toString().padStart(2, '0');
  const seconds = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
  const centiseconds = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
  return `${minutes}:${seconds}:${centiseconds}`;
}

function createStopwatch() {
  let startTime = 0;
  let elapsed = 0;
  let running = false;
  return {
    stop() { if (running) { elapsed += Date.now() - startTime; running = false; } },
    start() { if (!running) { startTime = Date.now(); running = true; } },
    reset() { startTime = 0; elapsed = 0; running = false; },
    getTime() { return running ? elapsed + (Date.now() - startTime) : elapsed; },
    getTimeString() { return formatTime(this.getTime()); },
  };
}

function flashScreen() {
  ui.flash.classList.add('show');
  setTimeout(() => ui.flash.classList.remove('show'), 160);
}

function cloneCheckpoints(template) {
  return template.map((cp) => ({
    p1: cp.p1.clone(),
    p2: cp.p2.clone(),
    passed: false,
    type: cp.type,
    mesh: cp.mesh,
  }));
}

function checkPlayerProgress(car, checkpoints, width = CHECKPOINT_WIDTH) {
  const carPos = car.position;
  let passedCount = 0;
  let justLapped = false;

  for (const cp of checkpoints) {
    if (cp.passed) {
      passedCount++;
      continue;
    }

    const seg = cp.p2.subtract(cp.p1);
    const segLen = seg.length();
    const segDir = seg.normalize();
    const normal = new Vector3(-segDir.z, 0, segDir.x);
    const carVec = carPos.subtract(cp.p1);
    const along = Vector3.Dot(carVec, segDir);
    const across = Vector3.Dot(carVec, normal);
    const inside = along >= 0 && along <= segLen && Math.abs(across) <= width / 2;
    if (!inside) continue;

    if (cp.type === 'check') {
      cp.passed = true;
      passedCount++;
      if (cp.mesh) {
        cp.mesh.material = createCheckpointMaterial(cp.mesh.getScene(), new Color3(0.1, 1.0, 0.55), 1.1);
      }
    } else if (cp.type === 'finish') {
      const checksDone = checkpoints.filter((c) => c.type === 'check' && c.passed).length;
      if (checksDone >= TOTAL_CHECKPOINTS) {
        cp.passed = true;
        justLapped = true;
      }
    }
  }

  return {
    passedCount: checkpoints.filter((c) => c.type === 'check' && c.passed).length,
    justLapped,
  };
}

function createDustSystem(scene, emitter) {
  const dust = new ParticleSystem('dust', 350, scene);
  dust.particleTexture = new Texture('models/flop.png', scene);
  dust.emitter = emitter;
  dust.minEmitBox = new Vector3(-0.5, 0, -0.5);
  dust.maxEmitBox = new Vector3(0.5, 0.1, 0.5);
  dust.color1 = new Color4(0.55, 0.45, 0.25, 0.3);
  dust.color2 = new Color4(0.35, 0.28, 0.15, 0.12);
  dust.colorDead = new Color4(0.2, 0.16, 0.1, 0);
  dust.minSize = 0.2;
  dust.maxSize = 0.7;
  dust.minLifeTime = 0.2;
  dust.maxLifeTime = 0.65;
  dust.emitRate = 0;
  dust.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  dust.gravity = new Vector3(0, 0.5, 0);
  dust.direction1 = new Vector3(-0.5, 0.5, -0.5);
  dust.direction2 = new Vector3(0.5, 1.1, 0.5);
  dust.minEmitPower = 0.5;
  dust.maxEmitPower = 1.4;
  dust.updateSpeed = 0.02;
  dust.start();
  return dust;
}

function makeFollowCamera(name, scene) {
  const camera = new FollowCamera(name, new Vector3(-8, 3, 12), scene);
  camera.heightOffset = 3.4;
  camera.radius = 8.5;
  camera.rotationOffset = -90;
  camera.cameraAcceleration = 0.09;
  camera.maxCameraSpeed = 18;
  camera.lowerHeightOffsetLimit = 2.2;
  camera.upperHeightOffsetLimit = 9;
  camera.minZ = 0.4;
  camera.maxZ = GROUND_SIZE * 2;
  return camera;
}

function buildCheckpointGates(scene) {
  const meshes = CHECKPOINT_LAYOUT.map((layout, index) => {
    const mesh = createCheckpoint(scene);
    mesh.name = 'checkpoint' + index;
    mesh.position = layout.position.clone();
    mesh.rotation = layout.rotation.clone();
    return mesh;
  });

  const gates = [];
  meshes.forEach((cp) => {
    const right = new Vector3(1, 0, 0);
    const rotMatrix = new Matrix();
    Matrix.RotationYawPitchRollToRef(cp.rotation.y, cp.rotation.x, cp.rotation.z, rotMatrix);
    const dir = Vector3.TransformNormal(right, rotMatrix).normalize();
    gates.push({
      p1: cp.position.subtract(dir.scale(CHECKPOINT_RADIUS)),
      p2: cp.position.add(dir.scale(CHECKPOINT_RADIUS)),
      passed: false,
      type: 'check',
      mesh: cp,
    });
  });

  return { meshes, gates };
}

async function createScene(playerCount) {
  const world = new Scene(engine);
  world.clearColor = new Color4(0.03, 0.06, 0.09, 1);

  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), world);
  hemi.intensity = 0.5;
  hemi.groundColor = new Color3(0.1, 0.14, 0.1);

  const light = new DirectionalLight('dirLight', new Vector3(-1, -2.2, -0.8), world);
  light.position = new Vector3(40, 80, 30);
  light.intensity = 1.65;

  const ground = createMixMapGround(world, GROUND_SIZE);
  ground.position = Vector3.Zero();

  createPitComplex(world);

  const starts = getStartPositions(playerCount);
  const players = [];

  for (let i = 0; i < playerCount; i++) {
    const team = i === 0 ? TEAM_COLORS.p1 : TEAM_COLORS.p2;
    const f1 = createF1Car(world, {
      name: 'f1_p' + (i + 1),
      ...team,
    });
    f1.root.position = starts[i].clone();
    f1.root.rotation = START_ROT.clone();

    const camera = makeFollowCamera('cam' + i, world);
    camera.lockedTarget = f1.root;

    if (playerCount === 2) {
      // Top / bottom split
      camera.viewport = new Viewport(0, i === 0 ? 0.5 : 0, 1, 0.5);
    } else {
      camera.viewport = new Viewport(0, 0, 1, 1);
    }

    const compound = getCompound(DEFAULT_COMPOUND);
    applyWheelCompoundColor(f1.wheels, compound);

    players.push({
      id: i + 1,
      car: f1.root,
      wheels: f1.wheels,
      camera,
      dust: createDustSystem(world, f1.root),
      scheme: i === 0
        ? (playerCount === 1 ? mergeSoloScheme(CONTROLS.p1) : {
            accel: CONTROLS.p1.accel,
            brake: CONTROLS.p1.brake,
            left: CONTROLS.p1.left,
            right: CONTROLS.p1.right,
          })
        : { ...CONTROLS.p2 },
      velocity: 0,
      time_acc: 0,
      time_decc: 0,
      reverseHold: 0,
      compoundId: DEFAULT_COMPOUND,
      lapsOnTires: 0,
      tireWear: 0,
      lap: 1,
      finished: false,
      finishTime: null,
      // none | entering | servicing | waiting | exiting
      pitState: 'none',
      pitProgress: 0,
      pitTargetCompound: null,
      pitEntryArmed: true,
      pitPathIndex: 0,
      pitTurning: false,
      pitTurnDone: false,
      checkpoints: null,
    });
  }

  world.activeCameras = players.map((p) => p.camera);

  const { meshes: checkpointMeshes, gates } = buildCheckpointGates(world);
  const departure = createDepartureLine(world);

  gates.push({
    p1: departure[0].position.clone(),
    p2: departure[1].position.clone(),
    passed: false,
    type: 'finish',
    mesh: null,
  });

  players.forEach((p) => {
    p.checkpoints = cloneCheckpoints(gates);
  });

  const shadow = new ShadowGenerator(1024, light);
  shadow.useBlurExponentialShadowMap = true;
  shadow.blurKernel = 24;
  players.forEach((p) => {
    p.car.getChildMeshes().forEach((m) => shadow.getShadowMap().renderList.push(m));
  });
  ground.receiveShadows = true;

  const skybox = MeshBuilder.CreateBox('skyBox', { size: GROUND_SIZE * 1.2 }, world);
  const skyboxMaterial = new StandardMaterial('skyBoxMaterial', world);
  skyboxMaterial.backFaceCulling = false;
  skyboxMaterial.reflectionTexture = new CubeTexture(
    'models/',
    world,
    ['px.png', 'py.png', 'pz.png', 'nx.png', 'ny.png', 'nz.png']
  );
  skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
  skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
  skyboxMaterial.specularColor = new Color3(0, 0, 0);
  skybox.material = skyboxMaterial;

  return { world, players, checkpointMeshes, gateTemplate: gates };
}

async function run_game() {
  // Keyboard
  window.addEventListener('keydown', (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keysPressed.add(key);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    keysPressed.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    keysPressed.delete(e.key);
  });

  let sceneBundle = null;
  let stateGame = 'menu';
  let countdownValue = 3;
  let countdownEndsAt = 0;
  let finishedHandled = false;
  let pulseT = 0;

  const stopwatch = createStopwatch();
  const targetFPS = 80;
  const frameDuration = 1000 / targetFPS;
  let lastFrameTime = 0;

  const mapImage = new Image();
  mapImage.src = 'dist/models/mixmapcircuit.png';
  let pixelData = null;
  let mapWidth = 2048;
  let mapHeight = 1536;

  mapImage.onload = () => {
    const offscreen = document.createElement('canvas');
    offscreen.width = mapImage.width;
    offscreen.height = mapImage.height;
    mapWidth = mapImage.width;
    mapHeight = mapImage.height;
    const ctx = offscreen.getContext('2d');
    ctx.drawImage(mapImage, 0, 0);
    pixelData = ctx.getImageData(0, 0, offscreen.width, offscreen.height).data;
    ui.loading.classList.add('hidden');
  };
  mapImage.onerror = () => {
    pixelData = new Uint8ClampedArray(2048 * 1536 * 4).fill(255);
    ui.loading.classList.add('hidden');
  };

  function sampleRoad(pos) {
    const [ix, iy] = getWorldPosition(pos);
    const x = Math.min(mapWidth - 1, Math.max(0, Math.floor(ix)));
    const y = Math.min(mapHeight - 1, Math.max(0, Math.floor(iy)));
    const index = (y * mapWidth + x) * 4;
    return (pixelData[index] ?? 255) === 255;
  }

  function startingCompoundFor(playerId) {
    return playerId === 1 ? settings.tiresP1 : settings.tiresP2;
  }

  function resetPlayer(player, startPos) {
    const compoundId = startingCompoundFor(player.id);
    player.car.position = startPos.clone();
    player.car.rotation = START_ROT.clone();
    player.velocity = 0;
    player.time_acc = 0;
    player.time_decc = 0;
    player.reverseHold = 0;
    player.compoundId = compoundId;
    player.lapsOnTires = 0;
    player.tireWear = 0;
    player.lap = 1;
    player.finished = false;
    player.finishTime = null;
    player.pitState = 'none';
    player.pitProgress = 0;
    player.pitTargetCompound = null;
    player.pitEntryArmed = true;
    player.pitPathIndex = 0;
    player.pitTurning = false;
    player.pitTurnDone = false;
    player.camera.radius = 8.5;
    player.camera.heightOffset = 3.4;
    player.dust.emitRate = 0;
    applyWheelCompoundColor(player.wheels, getCompound(compoundId));
    updateCompoundHud(player);
  }

  function updateCompoundHud(player) {
    const el = document.getElementById('compound-p' + player.id);
    const compound = getCompound(player.compoundId);
    if (!el) return;
    el.textContent = compound.label;
    el.style.color = compound.css;
    const tireEl = document.getElementById('tire-p' + player.id);
    if (tireEl) tireEl.style.background = `linear-gradient(90deg, ${compound.css}, #7dffd8)`;
  }

  function pitMenuEl(playerId) {
    return document.getElementById('pit-menu-p' + playerId);
  }

  function hidePitMenu(playerId) {
    if (playerId == null) {
      hidePitMenu(1);
      hidePitMenu(2);
      document.body.classList.remove('dual-pit');
      return;
    }
    const el = pitMenuEl(playerId);
    el?.classList.remove('visible', 'changing', 'waiting');
    const progress = el?.querySelector('.pit-progress');
    if (progress) progress.style.width = '0%';
  }

  function showPitMenu(player, mode = 'servicing') {
    const el = pitMenuEl(player.id);
    if (!el) return;
    el.classList.add('visible');
    el.classList.toggle('changing', mode === 'waiting');
    el.classList.toggle('waiting', mode === 'waiting');

    el.querySelectorAll('.pit-choice').forEach((btn) => {
      const keyHint = btn.querySelector('.key-hint');
      if (!keyHint) return;
      if (player.id === 1) {
        keyHint.textContent = { soft: 'Touche 1', medium: 'Touche 2', hard: 'Touche 3' }[btn.dataset.compound] || '';
      } else {
        keyHint.textContent = { soft: 'Touche 8', medium: 'Touche 9', hard: 'Touche 0' }[btn.dataset.compound] || '';
      }
      btn.classList.toggle('selected', !!player.pitTargetCompound && btn.dataset.compound === player.pitTargetCompound);
    });

    const status = el.querySelector('.pit-status');
    const progress = el.querySelector('.pit-progress');
    if (mode === 'waiting' && player.pitTargetCompound) {
      const c = getCompound(player.pitTargetCompound);
      const pct = Math.min(100, (player.pitProgress / PIT_LANE.serviceTimeMs) * 100);
      if (progress) progress.style.width = pct + '%';
      if (status) {
        status.textContent = `Montage ${c.label}… ${Math.ceil((PIT_LANE.serviceTimeMs - player.pitProgress) / 1000)}s`;
      }
    } else if (status) {
      status.textContent = mode === 'entering'
        ? (player.id === 1
          ? 'Approche box — 1 Soft · 2 Medium · 3 Hard'
          : 'Approche box — 8 Soft · 9 Medium · 0 Hard')
        : (player.id === 1
          ? 'À l’arrêt — valide avec 1 / 2 / 3'
          : 'À l’arrêt — valide avec 8 / 9 / 0');
    }
  }

  function startTireWait(player, compoundId) {
    player.pitState = 'waiting';
    player.pitTargetCompound = compoundId;
    player.pitProgress = 0;
    player.velocity = 0;
    player.time_acc = 0;
    player.time_decc = 0;
    showPitMenu(player, 'waiting');
  }

  function finishPitService(player) {
    const compound = getCompound(player.pitTargetCompound || player.compoundId);
    player.compoundId = compound.id;
    player.lapsOnTires = 0;
    player.tireWear = 0;
    player.pitTargetCompound = null;
    player.pitProgress = 0;
    player.pitState = 'exiting';
    player.pitPathIndex = 0;
    player.pitTurning = false;
    player.pitTurnDone = false;
    applyWheelCompoundColor(player.wheels, compound);
    updateCompoundHud(player);
    hidePitMenu(player.id);
    flashScreen();
  }

  function readPitCompoundChoice(player) {
    const map = PIT_SELECT_KEYS[player.id];
    if (!map) return null;
    for (const [id, keys] of Object.entries(map)) {
      if (keys.some((k) => keysPressed.has(k))) return id;
    }
    return null;
  }

  /**
   * Count a lap if all checkpoints are done (finish line OR pit entry).
   * @param {{ allowFinish?: boolean }} opts — finish via pits is forbidden on last lap
   */
  function tryCompleteLap(player, scene, opts = {}) {
    const allowFinish = opts.allowFinish !== false;
    const checksDone = player.checkpoints.filter((c) => c.type === 'check' && c.passed).length;
    if (checksDone < TOTAL_CHECKPOINTS) return false;

    player.lapsOnTires += 1;
    if (player.lap >= settings.laps) {
      if (!allowFinish) {
        // Last-lap pit: undo wear tick, do not finish the race in the pits
        player.lapsOnTires = Math.max(0, player.lapsOnTires - 1);
        return false;
      }
      player.finished = true;
      player.finishTime = stopwatch.getTime();
      flashScreen();
      return true;
    }

    player.lap += 1;
    player.checkpoints.forEach((cp) => {
      cp.passed = false;
      if (cp.mesh) {
        cp.mesh.material = createCheckpointMaterial(scene, new Color3(0.15, 0.55, 1.0));
      }
    });
    flashScreen();
    return true;
  }

  function resetCheckpointVisuals(meshes) {
    meshes.forEach((mesh) => {
      mesh.material = createCheckpointMaterial(sceneBundle.world, new Color3(0.15, 0.55, 1.0));
      mesh.scaling.setAll(1);
    });
  }

  async function bootRaceScene() {
    if (sceneBundle) {
      sceneBundle.world.dispose();
      sceneBundle = null;
    }
    sceneBundle = await createScene(settings.players);
    updateLobbyHints();
  }

  // Preload a 1P scene so the menu has something behind it
  await bootRaceScene();

  function beginCountdown() {
    stateGame = 'countdown';
    finishedHandled = false;
    ui.overlay.classList.add('hidden');
    ui.finish.classList.remove('visible');
    hidePitMenu();

    const starts = getStartPositions(settings.players);
    sceneBundle.players.forEach((p, i) => {
      resetPlayer(p, starts[i]);
      p.checkpoints = cloneCheckpoints(sceneBundle.gateTemplate);
      p.scheme = p.id === 1
        ? (settings.players === 1 ? mergeSoloScheme(CONTROLS.p1) : {
            accel: CONTROLS.p1.accel,
            brake: CONTROLS.p1.brake,
            left: CONTROLS.p1.left,
            right: CONTROLS.p1.right,
          })
        : { ...CONTROLS.p2 };
    });
    resetCheckpointVisuals(sceneBundle.checkpointMeshes);

    stopwatch.reset();
    ui.timer.textContent = '00:00:00';
    ui.lapGlobal.textContent = `Tour 1 / ${settings.laps}`;
    countdownValue = 3;
    countdownEndsAt = performance.now() + 900;
    ui.countdown.classList.add('visible');
    ui.countdownText.textContent = '3';
  }

  function selectPitCompound(player, compoundId) {
    if (!player || !compoundId) return;
    if (player.pitState === 'entering') {
      player.pitTargetCompound = compoundId;
      const el = pitMenuEl(player.id);
      el?.querySelectorAll('.pit-choice').forEach((b) => {
        b.classList.toggle('selected', b.dataset.compound === compoundId);
      });
      const status = el?.querySelector('.pit-status');
      if (status) {
        status.textContent = `${getCompound(compoundId).label} sélectionné — montage à la box`;
      }
      return;
    }
    if (player.pitState === 'servicing') {
      startTireWait(player, compoundId);
    }
  }

  // Pit menu click choices (one panel per player)
  [1, 2].forEach((pid) => {
    pitMenuEl(pid)?.querySelectorAll('.pit-choice').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!sceneBundle || stateGame !== 'racing') return;
        const player = sceneBundle.players.find((p) => p.id === pid);
        selectPitCompound(player, btn.dataset.compound);
      });
    });
  });

  function syncSettingsFromUI() {
    const p = document.querySelector('#opt-players .chip.active');
    const l = document.querySelector('#opt-laps .chip.active');
    const t1 = document.querySelector('#opt-tires-p1 .chip.active');
    const t2 = document.querySelector('#opt-tires-p2 .chip.active');
    if (p) settings.players = Number(p.dataset.value);
    if (l) settings.laps = Number(l.dataset.value);
    if (t1) settings.tiresP1 = t1.dataset.value;
    if (t2) settings.tiresP2 = t2.dataset.value;
    updateLobbyHints();
  }

  async function startFromMenu() {
    syncSettingsFromUI();
    // Rebuild scene if player count mismatch
    if (!sceneBundle || sceneBundle.players.length !== settings.players) {
      ui.loading.classList.remove('hidden');
      await bootRaceScene();
      ui.loading.classList.add('hidden');
    }
    beginCountdown();
  }

  function beginRace() {
    stateGame = 'racing';
    ui.countdown.classList.remove('visible');
    stopwatch.start();
    flashScreen();
  }

  function finishRace(winnerText, detail) {
    if (finishedHandled) return;
    finishedHandled = true;
    stateGame = 'finished';
    stopwatch.stop();
    ui.finishTitle.textContent = winnerText;
    ui.finishTime.textContent = detail;
    const bestRaw = localStorage.getItem(BEST_TIME_KEY);
    const time = stopwatch.getTime();
    if (settings.players === 1) {
      const best = bestRaw ? Number(bestRaw) : null;
      if (best === null || time < best) {
        localStorage.setItem(BEST_TIME_KEY, String(time));
        ui.finishBest.textContent = 'Nouveau record !';
      } else {
        ui.finishBest.textContent = `Meilleur : ${formatTime(best)}`;
      }
    } else {
      ui.finishBest.textContent = `${settings.laps} tours · ${settings.players} joueurs`;
    }
    ui.finish.classList.add('visible');
    sceneBundle.players.forEach((p) => { p.dust.emitRate = 0; });
    flashScreen();
  }

  function backToMenu() {
    stateGame = 'menu';
    ui.finish.classList.remove('visible');
    ui.overlay.classList.remove('hidden');
    ui.countdown.classList.remove('visible');
    stopwatch.reset();
  }

  ui.startBtn?.addEventListener('click', () => { if (stateGame === 'menu') startFromMenu(); });
  ui.restartBtn?.addEventListener('click', () => startFromMenu());
  ui.menuBtn?.addEventListener('click', () => backToMenu());

  engine.runRenderLoop(() => {
    const now = performance.now();
    const delta = now - lastFrameTime;
    if (delta < frameDuration) return;
    lastFrameTime = now - (delta % frameDuration);

    if (!sceneBundle || !pixelData) return;
    const { world: scene, players, checkpointMeshes } = sceneBundle;

    if (keysPressed.has('r')) {
      keysPressed.delete('r');
      keysPressed.delete('R');
      if (stateGame === 'finished' || stateGame === 'racing') startFromMenu();
      else if (stateGame === 'menu') startFromMenu();
    }

    if (stateGame === 'menu') {
      if (keysPressed.has(' ') || keysPressed.has('Space')) {
        keysPressed.delete(' ');
        keysPressed.delete('Space');
        startFromMenu();
      }
      scene.render();
      return;
    }

    if (stateGame === 'countdown') {
      if (now >= countdownEndsAt) {
        countdownValue -= 1;
        if (countdownValue > 0) {
          ui.countdownText.textContent = String(countdownValue);
          countdownEndsAt = now + 900;
        } else if (countdownValue === 0) {
          ui.countdownText.textContent = 'GO';
          countdownEndsAt = now + 450;
          countdownValue = -1;
        } else {
          beginRace();
        }
      }
      scene.render();
      return;
    }

    let anyoneOffroad = false;
    const activePitMenus = new Set();
    let maxLapShown = 1;

    // Slipstream before movement so boost applies this frame
    const draftById = { 1: { mul: 1, active: false }, 2: { mul: 1, active: false } };
    if (stateGame === 'racing' && players.length === 2) {
      draftById[1] = getDraftBoost(players[0], players[1]);
      draftById[2] = getDraftBoost(players[1], players[0]);
    }

    players.forEach((player) => {
      if (player.finished) {
        player.dust.emitRate = 0;
        return;
      }

      const onRoad = sampleRoad(player.car.position);
      const inPit = isInsidePitLane(player.car.position);
      const atEntry = isInsidePitEntry(player.car.position);
      if (!onRoad && !inPit) anyoneOffroad = true;

      const compound = getCompound(player.compoundId);
      const checkpointFraction = player.checkpoints
        ? player.checkpoints.filter((c) => c.type === 'check' && c.passed).length / TOTAL_CHECKPOINTS
        : 0;
      player.tireWear = computeTireWear(player.lapsOnTires, checkpointFraction, compound);
      if (!onRoad && !inPit && Math.abs(player.velocity) > 0.15) {
        player.lapsOnTires += 0.0025;
        player.tireWear = computeTireWear(player.lapsOnTires, checkpointFraction, compound);
      }

      const perf = getTirePerformance(compound, player.tireWear);
      const draft = draftById[player.id] || { mul: 1, active: false };
      perf.speedMul *= draft.mul;
      player.drafting = draft.active;

      if (stateGame === 'racing') {
        // Re-arm entry once clear of the gate
        if (!atEntry) player.pitEntryArmed = true;

        // Trigger pit procedure when crossing the green entry gate
        // Last lap: pits closed — race must finish on the main finish line
        const pitsClosed = player.lap >= settings.laps;
        if (
          player.pitState === 'none'
          && player.pitEntryArmed
          && atEntry
          && !pitsClosed
        ) {
          player.pitState = 'entering';
          player.pitEntryArmed = false;
          player.velocity = 0;
          player.time_acc = 0;
          player.time_decc = 0;
          player.pitPathIndex = 0;
          player.pitTurning = false;
          player.pitTurnDone = false;
          // Snap onto access centerline start, face into the pits
          player.car.position.x = PIT_LANE.merge.x;
          player.car.position.z = PIT_LANE.merge.z;
          player.car.rotation.y = PIT_LANE.enterPath[0].yaw;
          tryCompleteLap(player, scene, { allowFinish: false });
          flashScreen();
        } else if (pitsClosed && atEntry && player.pitState === 'none') {
          player.pitEntryArmed = false;
        }

        let locked = false;

        const pitPaths = getPitPathsForPlayer(player.id, settings.players);
        const pitStall = pitPaths.stall;

        if (player.pitState === 'entering') {
          locked = true;
          activePitMenus.add(player.id);
          showPitMenu(player, 'entering');
          const earlyChoice = readPitCompoundChoice(player);
          if (earlyChoice) selectPitCompound(player, earlyChoice);

          let move;
          try {
            move = followPitPath(
              player.car,
              pitPaths.enterPath,
              {
                pathIndex: player.pitPathIndex,
                turning: player.pitTurning,
                turnDone: player.pitTurnDone,
              },
              {
                crawlSpeed: PIT_LANE.crawlSpeed,
                turnSpeed: PIT_LANE.turnSpeed,
              }
            );
          } catch (err) {
            console.error('pit enter path error', err);
            move = { done: true, velocity: 0, pathIndex: 99, turning: false, turnDone: true };
          }
          player.pitPathIndex = move.pathIndex;
          player.pitTurning = move.turning;
          player.pitTurnDone = move.turnDone;
          player.velocity = move.velocity;

          if (move.done) {
            player.car.position.x = pitStall.x;
            player.car.position.z = pitStall.z;
            player.velocity = 0;
            player.pitTurning = false;
            player.pitTurnDone = false;
            if (player.pitTargetCompound) {
              startTireWait(player, player.pitTargetCompound);
            } else {
              player.pitState = 'servicing';
            }
          }
        } else if (player.pitState === 'servicing') {
          locked = true;
          player.velocity = 0;
          player.car.position.x = pitStall.x;
          player.car.position.z = pitStall.z;
          activePitMenus.add(player.id);
          showPitMenu(player, 'servicing');
          const choice = readPitCompoundChoice(player);
          if (choice) startTireWait(player, choice);
        } else if (player.pitState === 'waiting') {
          locked = true;
          player.velocity = 0;
          player.car.position.x = pitStall.x;
          player.car.position.z = pitStall.z;
          player.pitProgress += frameDuration;
          activePitMenus.add(player.id);
          showPitMenu(player, 'waiting');
          if (player.pitProgress >= PIT_LANE.serviceTimeMs) {
            finishPitService(player);
          }
        } else if (player.pitState === 'exiting') {
          locked = true;
          let move;
          try {
            move = followPitPath(
              player.car,
              pitPaths.exitPath,
              {
                pathIndex: player.pitPathIndex,
                turning: player.pitTurning,
                turnDone: player.pitTurnDone,
              },
              {
                crawlSpeed: PIT_LANE.crawlSpeed * 1.05,
                turnSpeed: PIT_LANE.turnSpeed,
              }
            );
          } catch (err) {
            console.error('pit exit path error', err);
            move = { done: true, velocity: 0, pathIndex: 99, turning: false, turnDone: true };
          }
          player.pitPathIndex = move.pathIndex;
          player.pitTurning = move.turning;
          player.pitTurnDone = move.turnDone;
          player.velocity = move.velocity;

          if (move.done) {
            player.car.position.x = PIT_LANE.rejoin.x;
            player.car.position.z = PIT_LANE.rejoin.z;
            player.car.rotation.y = START_ROT.y;
            player.pitState = 'none';
            player.velocity = 0;
            player.pitPathIndex = 0;
            player.pitTurning = false;
            player.pitTurnDone = false;
          }
        }

        if (!locked) {
          const next = stepVehicle(
            player.car,
            keysPressed,
            player,
            onRoad || inPit,
            player.scheme,
            perf,
            { locked: false }
          );
          player.velocity = next.velocity;
          player.time_acc = next.time_acc;
          player.time_decc = next.time_decc;
          player.reverseHold = next.reverseHold ?? 0;
        }

        // Normal finish-line lap (only when not in a pit procedure)
        const progress = checkPlayerProgress(player.car, player.checkpoints);
        if (progress.justLapped && player.pitState === 'none') {
          tryCompleteLap(player, scene);
        }

        const speedEl = document.getElementById('speed-p' + player.id);
        const fillEl = document.getElementById('speed-fill-p' + player.id);
        const tireEl = document.getElementById('tire-p' + player.id);
        const metaEl = document.getElementById('meta-p' + player.id);
        const displaySpeed = Math.round(Math.abs(player.velocity) * 210);
        if (speedEl) speedEl.textContent = String(displaySpeed);
        if (fillEl) fillEl.style.width = `${Math.min(100, (Math.abs(player.velocity) / 1.55) * 100)}%`;
        if (tireEl) tireEl.style.width = `${Math.max(0, (1 - player.tireWear) * 100)}%`;
        updateCompoundHud(player);
        if (metaEl) {
          const lifeLeft = Math.max(0, compound.lifeLaps - player.lapsOnTires - checkpointFraction);
          const pitLabel = {
            entering: '→ box',
            servicing: 'box',
            waiting: 'montage',
            exiting: 'sortie',
          }[player.pitState];
          const draftTag = player.drafting ? ' · ASPIRATION' : '';
          metaEl.textContent = player.finished
            ? `Terminé · ${formatTime(player.finishTime)}`
            : pitLabel
              ? `PIT ${pitLabel} · Tour ${player.lap}/${settings.laps}`
              : `CP ${progress.passedCount}/9 · Tour ${player.lap}/${settings.laps} · ${lifeLeft.toFixed(1)}t${draftTag}`;
        }

        maxLapShown = Math.max(maxLapShown, player.lap);

        const targetRadius = 7.5 + Math.abs(player.velocity) * 2.2;
        const targetHeight = 3.0 + Math.abs(player.velocity) * 1.1;
        player.camera.radius += (targetRadius - player.camera.radius) * 0.1;
        player.camera.heightOffset += (targetHeight - player.camera.heightOffset) * 0.1;

        player.dust.emitRate = (!onRoad && !inPit && Math.abs(player.velocity) > 0.15 && player.pitState === 'none')
          ? 70 + Math.abs(player.velocity) * 100
          : 0;

        spinWheels(player.wheels, player.velocity);
      }
    });

    if (stateGame === 'racing' && players.length === 2) {
      resolveCarCollision(players[0], players[1]);
    }
    separatePitCars(players);

    [1, 2].forEach((id) => {
      if (!activePitMenus.has(id)) hidePitMenu(id);
    });
    document.body.classList.toggle('dual-pit', activePitMenus.has(1) && activePitMenus.has(2));

    const pitLabels = {
      entering: 'Procédure stands…',
      servicing: 'Choisis tes pneus',
      waiting: 'Montage des pneus…',
      exiting: 'Sortie de box…',
    };
    const anyPit = players.find((p) => p.pitState !== 'none');
    const pitCount = players.filter((p) => p.pitState !== 'none').length;
    ui.statusPill.classList.toggle('visible', anyoneOffroad && stateGame === 'racing' && settings.players === 1);
    ui.pitPill.classList.toggle('visible', !!anyPit && stateGame === 'racing' && settings.players === 1);
    ui.pitPill.textContent = anyPit
      ? (pitCount > 1 ? 'Double arrêt aux stands' : (pitLabels[anyPit.pitState] || 'Stands'))
      : '';
    ui.timer.textContent = stopwatch.getTimeString();
    ui.lapGlobal.textContent = `Tour ${Math.min(maxLapShown, settings.laps)} / ${settings.laps}`;

    // End conditions
    if (stateGame === 'racing') {
      const done = players.filter((p) => p.finished);
      if (settings.players === 1 && done.length === 1) {
        finishRace('Victoire', formatTime(done[0].finishTime));
      } else if (settings.players === 2 && done.length >= 1) {
        // First across wins; allow short delay feel by ending immediately on leader
        const winner = done.sort((a, b) => a.finishTime - b.finishTime)[0];
        finishRace(`P${winner.id} gagne !`, formatTime(winner.finishTime));
      }
    }

    // Pulse next shared visual checkpoint (from P1 progress if available)
    pulseT += 0.05;
    const lead = players[0];
    if (lead && !lead.finished) {
      const next = lead.checkpoints.find((c) => c.type === 'check' && !c.passed);
      checkpointMeshes.forEach((mesh) => {
        if (next && mesh === next.mesh) {
          const s = 1 + Math.sin(pulseT) * 0.07;
          mesh.scaling.set(s, s, s);
        } else if (!lead.checkpoints.find((c) => c.mesh === mesh && c.passed)) {
          mesh.scaling.setAll(1);
        }
      });
    }

    scene.render();
  });

  const onViewportResize = () => engine.resize();
  window.addEventListener('resize', onViewportResize);
  window.visualViewport?.addEventListener('resize', onViewportResize);
}

run_game().catch((err) => {
  console.error(err);
  if (ui.loading) {
    ui.loading.querySelector('.tagline').textContent = 'Erreur de chargement — vois la console';
  }
});
