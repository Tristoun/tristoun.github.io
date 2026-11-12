import { Vector3, Matrix } from '@babylonjs/core';
import { worldToMixmap } from './track.js';

export const CONTROLS = {
  p1: {
    accel: ['z'],
    brake: ['s'],
    left: ['q'],
    right: ['d'],
    soloExtra: {
      accel: ['ArrowUp'],
      brake: ['ArrowDown'],
      left: ['ArrowLeft'],
      right: ['ArrowRight'],
    },
  },
  p2: {
    accel: ['ArrowUp'],
    brake: ['ArrowDown'],
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
  },
};

function hasAny(keysPressed, list) {
  return list.some((k) => keysPressed.has(k));
}

function determineSpeed(velocity, time, force) {
  return velocity + force * time;
}

function getTurnFactor(velocity, maxVelocity) {
  const speedRatio = Math.min(Math.abs(velocity) / Math.max(maxVelocity, 0.01), 1);
  if (speedRatio < 0.12) return 0.28;
  if (speedRatio < 0.5) return 1.0;
  return 0.68 + (1 - speedRatio) * 0.35;
}

export function mergeSoloScheme(base) {
  if (!base.soloExtra) return { ...base };
  return {
    accel: [...base.accel, ...base.soloExtra.accel],
    brake: [...base.brake, ...base.soloExtra.brake],
    left: [...base.left, ...base.soloExtra.left],
    right: [...base.right, ...base.soloExtra.right],
  };
}

/**
 * @param {{ speedMul?: number, turnMul?: number, gripMul?: number }} perf
 * @param {{ locked?: boolean, autoVelocity?: number|null }} opts
 */
export function stepVehicle(car, keysPressed, state, onRoad, scheme, perf = {}, opts = {}) {
  let { velocity, time_acc, time_decc, reverseHold = 0 } = state;

  if (opts.locked) {
    // Scripted pit motion: optional crawl velocity along current heading
    if (opts.autoVelocity != null) {
      velocity = opts.autoVelocity;
      const rotationMatrix = Matrix.RotationYawPitchRoll(car.rotation.y, car.rotation.x, car.rotation.z);
      const movement = new Vector3(velocity, 0, 0);
      car.position.addInPlace(Vector3.TransformCoordinates(movement, rotationMatrix).scale(0.22));
      return { velocity, time_acc: 0, time_decc: 0, reverseHold: 0 };
    }
    return { velocity: 0, time_acc: 0, time_decc: 0, reverseHold: 0 };
  }

  const speed = 0.22;
  const baseTurnSpeed = 0.022;
  const speedMul = perf.speedMul ?? 1;
  const turnMul = perf.turnMul ?? 1;
  const gripMul = Math.max(0.35, Math.min(1.2, perf.gripMul ?? 1));

  const maxForward = (onRoad ? 1.55 : 0.42) * speedMul * Math.min(1, gripMul + 0.15);
  const maxReverse = 0.28 * speedMul; // clearly slower than forward

  const accelerating = hasAny(keysPressed, scheme.accel);
  const braking = hasAny(keysPressed, scheme.brake);
  const turningLeft = hasAny(keysPressed, scheme.left);
  const turningRight = hasAny(keysPressed, scheme.right);

  const turnSpeed = baseTurnSpeed
    * getTurnFactor(velocity, maxForward)
    * (onRoad ? 1 : 0.55)
    * turnMul
    * gripMul;

  const rotationMatrix = Matrix.RotationYawPitchRoll(car.rotation.y, car.rotation.x, car.rotation.z);

  if (accelerating && !braking) {
    reverseHold = 0;
    if (velocity < 0) {
      // From reverse: first brake to stop with inertia, don't snap to forward
      if (time_acc > 0) time_acc = 0;
      time_decc += 0.008;
      velocity = determineSpeed(velocity, time_decc, 0.1);
      if (velocity > 0) velocity = 0;
    } else {
      if (time_decc > 0) time_decc = 0;
      // Heavier accel inertia
      const force = (onRoad ? 0.085 : 0.035) * speedMul;
      velocity = determineSpeed(velocity, time_acc, force);
      if (velocity > maxForward) velocity = maxForward;
      else time_acc += onRoad ? 0.0032 : 0.0014;
    }
  } else if (braking) {
    if (time_acc > 0) time_acc = 0;

    if (velocity > 0.04) {
      // Brake only — never cross into reverse in one go
      reverseHold = 0;
      time_decc += 0.007;
      velocity = determineSpeed(velocity, time_decc, -0.1);
      if (velocity < 0) velocity = 0;
    } else {
      // Must hold brake while nearly stopped before reverse engages
      reverseHold += 1;
      if (reverseHold > 18) {
        time_decc += 0.005;
        velocity = determineSpeed(velocity, time_decc, -0.035);
        if (velocity < -maxReverse) velocity = -maxReverse;
      } else {
        velocity = 0;
      }
    }
  } else {
    // Coast only while actually moving — never accumulate decc at rest
    reverseHold = 0;
    if (time_acc > 0) time_acc = 0;

    if (Math.abs(velocity) < 0.01) {
      velocity = 0;
      time_decc = 0;
    } else {
      time_decc = Math.min(time_decc + 0.006, 0.35);
      const force = velocity > 0
        ? (onRoad ? -0.035 : -0.07)
        : 0.045;
      velocity = determineSpeed(velocity, time_decc, force);
      if (velocity > 0 && force < 0 && velocity < 0.01) {
        velocity = 0;
        time_decc = 0;
      }
      if (velocity < 0 && force > 0 && velocity > -0.01) {
        velocity = 0;
        time_decc = 0;
      }
      if (velocity > maxForward) velocity = maxForward;
      if (velocity < -maxReverse) velocity = -maxReverse;
    }
  }

  if (turningLeft !== turningRight && Math.abs(velocity) > 0.015) {
    const dir = turningLeft ? -1 : 1;
    const reverse = velocity >= 0 ? 1 : -1;
    car.rotation.y += dir * reverse * turnSpeed;
  }

  // Kill idle micro-drift only when no drive input — never while accelerating
  const driving = accelerating || braking;
  if (!driving && Math.abs(velocity) < 0.015) {
    velocity = 0;
    time_decc = 0;
  }

  if (Math.abs(velocity) > 0.0005) {
    const movement = new Vector3(velocity, 0, 0);
    const worldMove = Vector3.TransformCoordinates(movement, rotationMatrix);
    car.position.addInPlace(worldMove.scale(speed));
  }

  return { velocity, time_acc, time_decc, reverseHold };
}

/** Local +X is forward (same basis as stepVehicle movement). */
export function getCarForward(car) {
  const m = Matrix.RotationYawPitchRoll(car.rotation.y, car.rotation.x, car.rotation.z);
  return Vector3.TransformCoordinates(new Vector3(1, 0, 0), m);
}

/** World units travelled per second at velocity=1 (step scale 0.22 @ ~80 fps). */
export const VELOCITY_UNITS_PER_SEC = 0.22 * 80;

/**
 * Solid 2P bumper collision: separate overlap + bounce velocity along contact normal.
 * Skips cars currently in a pit procedure.
 */
export function resolveCarCollision(playerA, playerB) {
  if (!playerA || !playerB) return;
  if (playerA.pitState !== 'none' || playerB.pitState !== 'none') return;
  if (playerA.finished || playerB.finished) return;

  const a = playerA.car.position;
  const b = playerB.car.position;
  const delta = a.subtract(b);
  delta.y = 0;
  let dist = delta.length();
  const minDist = 2.65;
  if (dist >= minDist) return;

  if (dist < 0.05) {
    delta.copyFromFloats(1, 0, 0);
    dist = 0.05;
  }
  const normal = delta.scale(1 / dist);

  // Strong positional separation so cars don't sink into each other
  const overlap = minDist - dist;
  const push = normal.scale(overlap * 0.62);
  a.addInPlace(push);
  b.addInPlace(push.scale(-1));

  const fwdA = getCarForward(playerA.car);
  const fwdB = getCarForward(playerB.car);
  const velA = fwdA.scale(playerA.velocity);
  const velB = fwdB.scale(playerB.velocity);
  const relVel = velA.subtract(velB);
  const closing = Vector3.Dot(relVel, normal);

  // Only bounce when moving into each other
  if (closing >= -0.02) return;

  const restitution = 0.42;
  const impulse = (-(1 + restitution) * closing) / 2;
  const impulseVec = normal.scale(impulse);
  const newVelA = velA.add(impulseVec);
  const newVelB = velB.subtract(impulseVec);

  playerA.velocity = Vector3.Dot(newVelA, fwdA);
  playerB.velocity = Vector3.Dot(newVelB, fwdB);
  playerA.velocity = Math.max(-0.35, Math.min(1.65, playerA.velocity));
  playerB.velocity = Math.max(-0.35, Math.min(1.65, playerB.velocity));

  // Hard hit kills accel buildup (feels like a real contact)
  if (Math.abs(closing) > 0.22) {
    playerA.time_acc = 0;
    playerB.time_acc = 0;
    playerA.time_decc = Math.min(playerA.time_decc + 0.04, 0.3);
    playerB.time_decc = Math.min(playerB.time_decc + 0.04, 0.3);
  }
}

/**
 * Slipstream: trailing car within <1s gap in the leader's wake gets a speed boost.
 * @returns {{ mul: number, active: boolean }}
 */
export function getDraftBoost(chaser, leader) {
  const none = { mul: 1, active: false };
  if (!chaser || !leader) return none;
  if (chaser.pitState !== 'none' || leader.pitState !== 'none') return none;
  if (chaser.finished || leader.finished) return none;

  const delta = chaser.car.position.subtract(leader.car.position);
  delta.y = 0;
  const dist = delta.length();
  if (dist < 1.2 || dist > 28) return none;

  const leadFwd = getCarForward(leader.car);
  const along = Vector3.Dot(delta, leadFwd); // negative ⇒ chaser is behind
  if (along > -1.2) return none;

  const lateral = Math.sqrt(Math.max(0, dist * dist - along * along));
  if (lateral > 3.6) return none;

  // Must roughly share the same heading (not side-by-side oncoming)
  const chaseFwd = getCarForward(chaser.car);
  if (Vector3.Dot(chaseFwd, leadFwd) < 0.55) return none;

  const leadSpeed = Math.max(Math.abs(leader.velocity), 0.14);
  const timeGap = dist / (leadSpeed * VELOCITY_UNITS_PER_SEC);
  if (timeGap >= 1) return none;

  const wake = 1 - Math.min(1, lateral / 3.6);
  const proximity = 1 - timeGap;
  // Up to ~14% top-speed draft when glued to the gearbox
  const mul = 1 + 0.14 * proximity * wake;
  return { mul, active: mul > 1.01 };
}

function shortestAngleDelta(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  let dy = to - from;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  return dy;
}

/**
 * Legacy helper — prefer followPitPath for stands.
 */
export function driveToward(car, target, crawlSpeed = 0.55) {
  const pos = car.position;
  const to = new Vector3(target.x - pos.x, 0, target.z - pos.z);
  const dist = to.length();
  if (dist < 0.05) return { arrived: true, velocity: 0 };

  const desiredYaw = Math.atan2(-to.z, to.x);
  const dy = shortestAngleDelta(car.rotation.y, desiredYaw);
  car.rotation.y += Math.max(-0.06, Math.min(0.06, dy));

  const speed = Math.min(crawlSpeed, dist * 0.35 + 0.15);
  const rotationMatrix = Matrix.RotationYawPitchRoll(car.rotation.y, car.rotation.x, car.rotation.z);
  car.position.addInPlace(
    Vector3.TransformCoordinates(new Vector3(speed, 0, 0), rotationMatrix).scale(0.22)
  );
  return { arrived: dist <= 1.6, velocity: speed };
}

/**
 * Follow a pit waypoint path on the centerline.
 * Corners: rotate in place once, then drive the next segment (no re-snap loop).
 *
 * state: { pathIndex, turning, turnDone }
 */
export function followPitPath(car, path, state, opts = {}) {
  const crawlSpeed = opts.crawlSpeed ?? 0.62;
  const turnSpeed = opts.turnSpeed ?? 0.055;

  let pathIndex = state.pathIndex ?? 0;
  let turning = !!state.turning;
  let turnDone = !!state.turnDone;

  if (!path || path.length < 2) {
    return { done: true, velocity: 0, pathIndex: 0, turning: false, turnDone: true };
  }

  // Finished all segments — optional final facing on last node
  if (pathIndex >= path.length - 1) {
    const last = path[path.length - 1];
    car.position.x = last.pos.x;
    car.position.z = last.pos.z;
    car.position.y = last.pos.y;
    const targetYaw = last.faceYaw ?? last.yaw;
    if (targetYaw != null) {
      const dy = shortestAngleDelta(car.rotation.y, targetYaw);
      if (Math.abs(dy) > 0.04) {
        car.rotation.y += Math.max(-turnSpeed, Math.min(turnSpeed, dy));
        return { done: false, velocity: 0, pathIndex, turning: true, turnDone: false };
      }
      car.rotation.y = targetYaw;
    }
    return { done: true, velocity: 0, pathIndex, turning: false, turnDone: true };
  }

  const from = path[pathIndex];
  const to = path[pathIndex + 1];

  // 90° corner: rotate once at `from`, never snap back after turnDone
  if (from.turn && from.faceYaw != null && !turnDone) {
    turning = true;
    car.position.x = from.pos.x;
    car.position.z = from.pos.z;
    car.position.y = from.pos.y;
    const dy = shortestAngleDelta(car.rotation.y, from.faceYaw);
    if (Math.abs(dy) > 0.04) {
      car.rotation.y += Math.max(-turnSpeed, Math.min(turnSpeed, dy));
      return { done: false, velocity: 0, pathIndex, turning: true, turnDone: false };
    }
    car.rotation.y = from.faceYaw;
    turning = false;
    turnDone = true;
  }

  // Drive along centerline from → to
  const seg = to.pos.subtract(from.pos);
  const segLen = Math.max(0.001, seg.length());
  const segDir = seg.scale(1 / segLen);

  const relX = car.position.x - from.pos.x;
  const relZ = car.position.z - from.pos.z;
  let along = relX * segDir.x + relZ * segDir.z;
  along = Math.max(0, Math.min(segLen, along));

  const segYaw = Math.atan2(-segDir.z, segDir.x);
  const dy = shortestAngleDelta(car.rotation.y, segYaw);
  car.rotation.y += Math.max(-turnSpeed * 1.4, Math.min(turnSpeed * 1.4, dy));

  const step = Math.min(crawlSpeed * 0.22, Math.max(0.05, segLen - along));
  along = Math.min(segLen, along + step);

  car.position.x = from.pos.x + segDir.x * along;
  car.position.z = from.pos.z + segDir.z * along;
  car.position.y = from.pos.y;

  if (along >= segLen - 0.08) {
    car.position.x = to.pos.x;
    car.position.z = to.pos.z;
    car.position.y = to.pos.y;
    pathIndex += 1;
    turning = !!(path[pathIndex]?.turn && path[pathIndex]?.faceYaw != null);
    turnDone = false;
  }

  return {
    done: false,
    velocity: crawlSpeed,
    pathIndex,
    turning,
    turnDone,
  };
}

export function getWorldPosition(pos) {
  return worldToMixmap(pos);
}

export function spinWheels(wheels, velocity) {
  if (!wheels) return;
  const ang = velocity * 0.4;
  wheels.forEach((hub) => {
    hub.rotation.z += ang;
  });
}
