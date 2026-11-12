import {
  Color3, MeshBuilder, StandardMaterial, TransformNode, Vector3
} from '@babylonjs/core';

function mat(scene, name, color, emissive = null) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.specularColor = new Color3(0.35, 0.35, 0.35);
  if (emissive) m.emissiveColor = emissive;
  return m;
}

/**
 * Procedural open-wheel F1-style car.
 * Local +X is forward (matches existing control math).
 */
export function createF1Car(scene, options = {}) {
  const {
    name = 'f1',
    primary = new Color3(0.85, 0.05, 0.12),
    secondary = new Color3(0.08, 0.08, 0.1),
    accent = new Color3(0.95, 0.95, 0.95),
  } = options;

  const root = new TransformNode(name, scene);
  const bodyMat = mat(scene, name + '_body', primary);
  const darkMat = mat(scene, name + '_dark', secondary);
  const accentMat = mat(scene, name + '_accent', accent);
  const tireMat = mat(scene, name + '_tire', new Color3(0.05, 0.05, 0.05));
  const wingMat = mat(scene, name + '_wing', new Color3(0.12, 0.12, 0.14));
  const haloMat = mat(scene, name + '_halo', new Color3(0.75, 0.75, 0.78));

  const parts = [];

  const chassis = MeshBuilder.CreateBox(name + '_chassis', {
    width: 2.4, height: 0.28, depth: 0.72
  }, scene);
  chassis.position = new Vector3(0.1, 0.32, 0);
  chassis.material = bodyMat;
  parts.push(chassis);

  const nose = MeshBuilder.CreateBox(name + '_nose', {
    width: 1.1, height: 0.16, depth: 0.28
  }, scene);
  nose.position = new Vector3(1.55, 0.28, 0);
  nose.scaling = new Vector3(1, 1, 1);
  nose.material = bodyMat;
  parts.push(nose);

  const noseTip = MeshBuilder.CreateCylinder(name + '_tip', {
    height: 0.55, diameterTop: 0.06, diameterBottom: 0.22, tessellation: 10
  }, scene);
  noseTip.rotation.z = Math.PI / 2;
  noseTip.position = new Vector3(2.2, 0.26, 0);
  noseTip.material = bodyMat;
  parts.push(noseTip);

  const cockpit = MeshBuilder.CreateBox(name + '_cockpit', {
    width: 0.7, height: 0.34, depth: 0.5
  }, scene);
  cockpit.position = new Vector3(-0.15, 0.52, 0);
  cockpit.material = darkMat;
  parts.push(cockpit);

  const halo = MeshBuilder.CreateTorus(name + '_halo', {
    diameter: 0.55, thickness: 0.045, tessellation: 20
  }, scene);
  halo.rotation.x = Math.PI / 2;
  halo.position = new Vector3(-0.05, 0.72, 0);
  halo.scaling = new Vector3(1.1, 0.7, 1);
  halo.material = haloMat;
  parts.push(halo);

  const engineCover = MeshBuilder.CreateBox(name + '_engine', {
    width: 1.0, height: 0.38, depth: 0.55
  }, scene);
  engineCover.position = new Vector3(-1.0, 0.48, 0);
  engineCover.material = bodyMat;
  parts.push(engineCover);

  const airbox = MeshBuilder.CreateBox(name + '_airbox', {
    width: 0.28, height: 0.32, depth: 0.22
  }, scene);
  airbox.position = new Vector3(-0.55, 0.78, 0);
  airbox.material = darkMat;
  parts.push(airbox);

  // Sidepods
  [-1, 1].forEach((side) => {
    const pod = MeshBuilder.CreateBox(name + '_pod' + side, {
      width: 1.3, height: 0.32, depth: 0.32
    }, scene);
    pod.position = new Vector3(-0.2, 0.3, side * 0.55);
    pod.material = bodyMat;
    parts.push(pod);
  });

  // Front wing
  const frontWing = MeshBuilder.CreateBox(name + '_fwing', {
    width: 0.18, height: 0.05, depth: 1.7
  }, scene);
  frontWing.position = new Vector3(2.05, 0.14, 0);
  frontWing.material = wingMat;
  parts.push(frontWing);

  [-1, 1].forEach((side) => {
    const endplate = MeshBuilder.CreateBox(name + '_fend' + side, {
      width: 0.28, height: 0.22, depth: 0.05
    }, scene);
    endplate.position = new Vector3(2.0, 0.2, side * 0.85);
    endplate.material = accentMat;
    parts.push(endplate);
  });

  // Rear wing
  const rearWing = MeshBuilder.CreateBox(name + '_rwing', {
    width: 0.16, height: 0.05, depth: 1.35
  }, scene);
  rearWing.position = new Vector3(-1.75, 0.85, 0);
  rearWing.material = wingMat;
  parts.push(rearWing);

  const rearWingLow = MeshBuilder.CreateBox(name + '_rwing2', {
    width: 0.12, height: 0.04, depth: 1.2
  }, scene);
  rearWingLow.position = new Vector3(-1.75, 0.68, 0);
  rearWingLow.material = wingMat;
  parts.push(rearWingLow);

  [-1, 1].forEach((side) => {
    const pillar = MeshBuilder.CreateBox(name + '_rp' + side, {
      width: 0.08, height: 0.55, depth: 0.05
    }, scene);
    pillar.position = new Vector3(-1.72, 0.55, side * 0.55);
    pillar.material = darkMat;
    parts.push(pillar);

    const endplate = MeshBuilder.CreateBox(name + '_rend' + side, {
      width: 0.35, height: 0.55, depth: 0.05
    }, scene);
    endplate.position = new Vector3(-1.72, 0.62, side * 0.7);
    endplate.material = accentMat;
    parts.push(endplate);
  });

  // Wheels — hub pivots spin around Z (axle); mesh stays vertically oriented
  const wheelPositions = [
    new Vector3(1.15, 0.28, 0.78),
    new Vector3(1.15, 0.28, -0.78),
    new Vector3(-1.15, 0.28, 0.78),
    new Vector3(-1.15, 0.28, -0.78),
  ];
  const wheels = [];
  wheelPositions.forEach((pos, i) => {
    const hub = new TransformNode(name + '_hub' + i, scene);
    hub.position = pos.clone();
    hub.parent = root;
    wheels.push(hub);

    const wheel = MeshBuilder.CreateCylinder(name + '_w' + i, {
      height: 0.28, diameter: 0.56, tessellation: 16
    }, scene);
    // Cylinder height (Y) → axle along Z after this rotation
    wheel.rotation.x = Math.PI / 2;
    wheel.material = tireMat;
    wheel.parent = hub;
    wheel.receiveShadows = true;

    const rim = MeshBuilder.CreateCylinder(name + '_rim' + i, {
      height: 0.3, diameter: 0.28, tessellation: 12
    }, scene);
    rim.rotation.x = Math.PI / 2;
    rim.material = accentMat;
    rim.parent = hub;
    rim.receiveShadows = true;
  });

  // Number plate accent
  const stripe = MeshBuilder.CreateBox(name + '_stripe', {
    width: 2.0, height: 0.03, depth: 0.12
  }, scene);
  stripe.position = new Vector3(0.2, 0.48, 0);
  stripe.material = accentMat;
  parts.push(stripe);

  // Mirrors
  [-1, 1].forEach((side) => {
    const mirror = MeshBuilder.CreateBox(name + '_mirror' + side, {
      width: 0.12, height: 0.08, depth: 0.18
    }, scene);
    mirror.position = new Vector3(0.35, 0.62, side * 0.42);
    mirror.material = darkMat;
    parts.push(mirror);
  });

  // Diffuser
  const diffuser = MeshBuilder.CreateBox(name + '_diff', {
    width: 0.35, height: 0.12, depth: 0.85
  }, scene);
  diffuser.position = new Vector3(-1.55, 0.18, 0);
  diffuser.material = darkMat;
  parts.push(diffuser);

  parts.forEach((p) => {
    p.parent = root;
    p.receiveShadows = true;
  });

  root.scaling = new Vector3(0.9, 0.9, 0.9);

  return { root, wheels, primaryMesh: chassis, tireMat };
}

export const TEAM_COLORS = {
  p1: {
    primary: new Color3(0.9, 0.08, 0.14),
    secondary: new Color3(0.06, 0.06, 0.08),
    accent: new Color3(0.95, 0.95, 0.95),
  },
  p2: {
    primary: new Color3(0.05, 0.35, 0.85),
    secondary: new Color3(0.05, 0.05, 0.08),
    accent: new Color3(0.15, 0.9, 0.85),
  },
};
