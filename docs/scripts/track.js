import { Vector3 } from '@babylonjs/core';

export const WORLD_SCALE = 2.5;
export const GROUND_SIZE = 150 * WORLD_SCALE;
export const HALF_GROUND = GROUND_SIZE / 2;
export const TOTAL_CHECKPOINTS = 9;
export const CHECKPOINT_RADIUS = 2.5 * WORLD_SCALE;
export const CHECKPOINT_WIDTH = 2.4 * WORLD_SCALE;

export const START_ROT = new Vector3(0, -2.4, 0);

export function getForwardDir() {
  const y = START_ROT.y;
  return new Vector3(Math.cos(y), 0, -Math.sin(y)).normalize();
}

export function getRightDir() {
  const y = START_ROT.y;
  return new Vector3(Math.sin(y), 0, Math.cos(y)).normalize();
}

/** Easy-access side of the finish (pit offset). */
export function getPitSideDir() {
  return getRightDir();
}

export function getInfieldDir() {
  return getPitSideDir();
}

export function getStartPositions(playerCount = 1) {
  const base = new Vector3(18.86 * WORLD_SCALE, 1.15, -38.8 * WORLD_SCALE);
  if (playerCount === 1) return [base];
  const right = getRightDir();
  const offset = 2.2;
  return [
    base.add(right.scale(-offset)),
    base.add(right.scale(offset)),
  ];
}

export const CHECKPOINT_LAYOUT = [
  { position: new Vector3(0, 1.2, 0), rotation: new Vector3(4.82, 0, 0) },
  { position: new Vector3(-3.6, 1.2, 30.1), rotation: new Vector3(4.82, 0, 2.2) },
  { position: new Vector3(-44.1, 1.2, -26.9), rotation: new Vector3(4.82, 0, 14.5) },
  { position: new Vector3(-35.8, 1.2, -34.37), rotation: new Vector3(4.82, 0, 0.5) },
  { position: new Vector3(-60.4, 1.2, 31.06), rotation: new Vector3(4.82, 0, 45) },
  { position: new Vector3(2.55, 1.2, 48.25), rotation: new Vector3(4.82, 0, 30) },
  { position: new Vector3(64.08, 1.2, -2.27), rotation: new Vector3(4.82, 0, 0) },
  { position: new Vector3(41.58, 1.2, -36.29), rotation: new Vector3(4.82, 0, 0) },
  { position: new Vector3(33, 1.2, -48.95), rotation: new Vector3(4.82, 0, 5) },
].map((cp) => ({
  position: new Vector3(cp.position.x * WORLD_SCALE, cp.position.y, cp.position.z * WORLD_SCALE),
  rotation: cp.rotation.clone(),
}));

export const DEPARTURE = {
  cone1: new Vector3(14 * WORLD_SCALE, 1.2, -36 * WORLD_SCALE),
  cone2: new Vector3(18 * WORLD_SCALE, 1.2, -32 * WORLD_SCALE),
  flag: new Vector3(16 * WORLD_SCALE, 2.8, -34 * WORLD_SCALE),
};

function yawFromDir(dir) {
  return Math.atan2(-dir.z, dir.x);
}

/**
 * Orthogonal pit: 90° in → long parallel straight → 90° out onto track.
 * Waypoints drive the locked animation on the centerline.
 */
function buildPitGeometry() {
  const forward = getForwardDir();
  const sideOff = getPitSideDir();

  const merge = new Vector3(72.602, 1.15, -115.27);
  const entry = new Vector3(49.805, 1.15, -140.157);
  const box = new Vector3(21.600, 1.15, -114.321);
  const exitCorner = new Vector3(-12.873, 1.15, -82.743);
  const rejoin = new Vector3(9.924, 1.15, -57.856);

  const laneDir = forward.clone(); // parallel to track
  const accessDir = entry.subtract(merge).normalize(); // into pits (≈ sideOff)
  const exitDir = rejoin.subtract(exitCorner).normalize(); // back to track

  const side = new Vector3(-laneDir.z, 0, laneDir.x);
  const laneHalfWidth = 8.0;

  // Walls only on the long straight, mouths open for the 90° corners
  const wallInset = 0.45;
  const wallHalf = laneHalfWidth - wallInset;
  const trim = 5.5;
  const wallA = entry.add(laneDir.scale(trim));
  const wallB = exitCorner.subtract(laneDir.scale(trim));
  const walls = [
    { a: wallA.add(side.scale(wallHalf)), b: wallB.add(side.scale(wallHalf)) },
    { a: wallA.add(side.scale(-wallHalf)), b: wallB.add(side.scale(-wallHalf)) },
  ];

  /**
   * Entry path: merge → entry (turn 90°) → box
   * Exit path: box → exitCorner → rejoin (turn 90°, end on track)
   */
  const enterPath = [
    { pos: merge.clone(), yaw: yawFromDir(accessDir), turn: false },
    { pos: entry.clone(), yaw: yawFromDir(accessDir), turn: true, faceYaw: yawFromDir(laneDir) },
    { pos: box.clone(), yaw: yawFromDir(laneDir), turn: false },
  ];
  const exitPath = [
    { pos: box.clone(), yaw: yawFromDir(laneDir), turn: false },
    { pos: exitCorner.clone(), yaw: yawFromDir(laneDir), turn: true, faceYaw: yawFromDir(exitDir) },
    { pos: rejoin.clone(), yaw: yawFromDir(exitDir), turn: true, faceYaw: yawFromDir(forward) },
  ];

  return {
    merge,
    entry,
    exit: exitCorner,
    exitCorner,
    box,
    rejoin,
    forward: forward.clone(),
    infield: sideOff.clone(),
    left: sideOff.clone(),
    laneDir,
    accessDir,
    exitDir,
    side,
    entryHalfWidth: laneHalfWidth * 0.8,
    laneHalfWidth,
    walls,
    enterPath,
    exitPath,
    crawlSpeed: 0.62,
    turnSpeed: 0.055,
    serviceTimeMs: 3500,
    arriveDist: 1.6,
    carRadius: 1.35,
  };
}

export const PIT_LANE = buildPitGeometry();
PIT_LANE.p1 = PIT_LANE.entry;
PIT_LANE.p2 = PIT_LANE.exitCorner;
PIT_LANE.halfWidth = PIT_LANE.laneHalfWidth;

/** Dual-box offsets so both cars can stop without overlapping. */
const STALL_ALONG = 3.6;   // further / less far along the lane
const STALL_LATERAL = 2.7; // left / right of centerline (+side = left when facing laneDir)

/**
 * Box stall for a player. In 2P: P1 further + left, P2 shorter + right.
 * Solo keeps the center box.
 */
export function getPitStall(playerId, playerCount = 2) {
  if (playerCount < 2) return PIT_LANE.box.clone();
  const along = playerId === 2 ? -STALL_ALONG : STALL_ALONG;
  const across = playerId === 2 ? -STALL_LATERAL : STALL_LATERAL;
  return PIT_LANE.box
    .add(PIT_LANE.laneDir.scale(along))
    .add(PIT_LANE.side.scale(across));
}

/** Enter/exit waypoint paths ending/starting on that player's stall. */
export function getPitPathsForPlayer(playerId, playerCount = 2) {
  const stall = getPitStall(playerId, playerCount);
  const { merge, entry, exitCorner, rejoin, accessDir, laneDir, exitDir, forward } = PIT_LANE;
  return {
    stall,
    enterPath: [
      { pos: merge.clone(), yaw: yawFromDir(accessDir), turn: false },
      { pos: entry.clone(), yaw: yawFromDir(accessDir), turn: true, faceYaw: yawFromDir(laneDir) },
      { pos: stall.clone(), yaw: yawFromDir(laneDir), turn: false },
    ],
    exitPath: [
      { pos: stall.clone(), yaw: yawFromDir(laneDir), turn: false },
      { pos: exitCorner.clone(), yaw: yawFromDir(laneDir), turn: true, faceYaw: yawFromDir(exitDir) },
      { pos: rejoin.clone(), yaw: yawFromDir(exitDir), turn: true, faceYaw: yawFromDir(forward) },
    ],
  };
}

function pointInOrientedBand(pos, a, b, halfWidth) {
  const seg = b.subtract(a);
  const segLen = seg.length();
  const segDir = seg.normalize();
  const normal = new Vector3(-segDir.z, 0, segDir.x);
  const carVec = pos.subtract(a);
  const along = Vector3.Dot(carVec, segDir);
  const across = Vector3.Dot(carVec, normal);
  return {
    inside: along >= -0.5 && along <= segLen + 0.5 && Math.abs(across) <= halfWidth,
    along,
    segLen,
    across,
    normal,
    segDir,
  };
}

export function isInsidePitLane(pos) {
  return pointInOrientedBand(pos, PIT_LANE.entry, PIT_LANE.exitCorner, PIT_LANE.laneHalfWidth).inside;
}

export function isInsidePitEntry(pos) {
  const { entry, merge, entryHalfWidth } = PIT_LANE;
  const t = 0.5;
  const mid = merge.add(entry.subtract(merge).scale(t));
  const dir = entry.subtract(merge).normalize();
  const depth = 2.6;
  return pointInOrientedBand(
    pos,
    mid.add(dir.scale(-depth)),
    mid.add(dir.scale(depth)),
    entryHalfWidth
  ).inside;
}

export function isNearPitBox(pos) {
  return Vector3.Distance(
    new Vector3(pos.x, 0, pos.z),
    new Vector3(PIT_LANE.box.x, 0, PIT_LANE.box.z)
  ) <= PIT_LANE.arriveDist;
}

export function isNearPitExit(pos) {
  return Vector3.Distance(
    new Vector3(pos.x, 0, pos.z),
    new Vector3(PIT_LANE.rejoin.x, 0, PIT_LANE.rejoin.z)
  ) <= PIT_LANE.arriveDist * 1.2;
}

/** Keep car on main-lane centerline band (not during corner mouths). */
export function constrainToPitCorridor(car, radius = PIT_LANE.carRadius) {
  const pos = car.position;
  const band = pointInOrientedBand(pos, PIT_LANE.entry, PIT_LANE.exitCorner, PIT_LANE.laneHalfWidth);
  if (band.along < 6 || band.along > band.segLen - 6) return false;
  const limit = PIT_LANE.laneHalfWidth - radius;
  if (Math.abs(band.across) > limit) {
    const push = (Math.abs(band.across) - limit) * Math.sign(band.across);
    pos.x -= band.normal.x * push;
    pos.z -= band.normal.z * push;
    return true;
  }
  return false;
}

export function separatePitCars(players) {
  if (players.length < 2) return;
  const a = players[0];
  const b = players[1];
  const inPitA = a.pitState !== 'none' || isInsidePitLane(a.car.position);
  const inPitB = b.pitState !== 'none' || isInsidePitLane(b.car.position);
  if (!inPitA && !inPitB) return;

  const pa = a.car.position;
  const pb = b.car.position;
  const delta = pa.subtract(pb);
  delta.y = 0;
  const dist = delta.length();
  const minDist = PIT_LANE.carRadius * 2.15;
  if (dist > 0.001 && dist < minDist) {
    const push = delta.normalize().scale((minDist - dist) * 0.55);
    pa.addInPlace(push);
    pb.addInPlace(push.scale(-1));
  }
}

export function worldToMixmap(pos) {
  const x = (1024 / HALF_GROUND) * pos.x + 1024;
  const y = -(768 / HALF_GROUND) * pos.z + 768;
  return [x, y];
}
