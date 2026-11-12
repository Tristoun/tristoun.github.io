import { Color3 } from '@babylonjs/core';

/** Soft > Medium > Hard en vitesse ; durée de vie inverse. */
export const TIRE_COMPOUNDS = {
  soft: {
    id: 'soft',
    label: 'SOFT',
    short: 'S',
    lifeLaps: 4,
    speedMul: 1.14,
    turnMul: 1.1,
    color: new Color3(0.95, 0.12, 0.22),
    css: '#ff4d6a',
  },
  medium: {
    id: 'medium',
    label: 'MEDIUM',
    short: 'M',
    lifeLaps: 8,
    speedMul: 1.0,
    turnMul: 1.0,
    color: new Color3(1.0, 0.72, 0.08),
    css: '#ffb020',
  },
  hard: {
    id: 'hard',
    label: 'HARD',
    short: 'H',
    lifeLaps: 12,
    speedMul: 0.88,
    turnMul: 0.9,
    color: new Color3(0.88, 0.9, 0.92),
    css: '#dfe6ea',
  },
};

export const DEFAULT_COMPOUND = 'medium';

/** Keys to pick compound while stopped in pits. */
export const PIT_SELECT_KEYS = {
  1: {
    soft: ['1', '&'],
    medium: ['2', 'é'],
    hard: ['3', '"'],
  },
  2: {
    soft: ['8'],
    medium: ['9'],
    hard: ['0'],
  },
};

export function getCompound(id) {
  return TIRE_COMPOUNDS[id] || TIRE_COMPOUNDS[DEFAULT_COMPOUND];
}

/**
 * Wear 0..1 from laps driven on this set (+ fraction via checkpoints).
 * Soft dies after lifeLaps (4), etc.
 */
export function computeTireWear(lapsOnTires, checkpointFraction, compound) {
  const life = compound.lifeLaps;
  const progress = lapsOnTires + Math.max(0, Math.min(1, checkpointFraction));
  return Math.max(0, Math.min(1, progress / life));
}

/**
 * Performance multipliers after wear.
 * Worn tires: slower + harder to turn (cliff near end of life).
 */
export function getTirePerformance(compound, wear) {
  const w = Math.max(0, Math.min(1, wear));
  // Mild loss early, sharp drop after ~80%
  const wearPenalty = w < 0.8 ? w * 0.35 : 0.28 + (w - 0.8) * 2.2;
  const clampedPenalty = Math.min(0.72, wearPenalty);

  return {
    speedMul: compound.speedMul * (1 - clampedPenalty),
    turnMul: compound.turnMul * (1 - clampedPenalty * 1.15),
    gripMul: Math.max(0.35, 1 - clampedPenalty),
  };
}

export function applyWheelCompoundColor(wheels, compound) {
  if (!wheels) return;
  const c = compound.color;
  wheels.forEach((hub) => {
    const meshes = hub.getChildMeshes ? hub.getChildMeshes() : [hub];
    meshes.forEach((mesh) => {
      if (!mesh.material || !mesh.name.includes('_w')) return;
      if (mesh.material.diffuseColor) {
        // Dark rubber with compound-colored sidewall tint
        mesh.material.diffuseColor = new Color3(
          0.08 + c.r * 0.35,
          0.08 + c.g * 0.35,
          0.08 + c.b * 0.35
        );
        mesh.material.emissiveColor = new Color3(c.r * 0.15, c.g * 0.15, c.b * 0.15);
      }
    });
  });
}
