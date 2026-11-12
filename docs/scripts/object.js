import {
  Color3, MeshBuilder, StandardMaterial, Texture, Vector3
} from '@babylonjs/core';
import { TerrainMaterial } from '@babylonjs/materials';
import { createTexture } from './texture';
import { DEPARTURE, GROUND_SIZE, PIT_LANE, WORLD_SCALE, getPitStall } from './track.js';

import mixMapUrl from '../models/mixmapcircuit.png';
import roadUrl from '../models/road2.png';
import grassUrl from '../models/grass2.png';
import heightMapUrl from '../models/silverstoneCircuit.png';
import flagTexture from '../models/flag.png';
import outdoorTexture from '../models/outdoor.png';

export function createHeightGround(fileName, width, height, subdivisions, minHeight, maxHeight, scene) {
  return MeshBuilder.CreateGroundFromHeightMap(
    'ground',
    fileName,
    { width, height, subdivisions, minHeight, maxHeight },
    scene
  );
}

export function createMixMapGround(scene, size = GROUND_SIZE) {
  const terrainMaterial = new TerrainMaterial('terrainMaterial', scene);

  terrainMaterial.mixTexture = new Texture(mixMapUrl, scene);

  const tile = 10 * (size / 150);
  terrainMaterial.diffuseTexture1 = new Texture(roadUrl, scene);
  terrainMaterial.diffuseTexture1.uScale = terrainMaterial.diffuseTexture1.vScale = tile;

  terrainMaterial.diffuseTexture2 = new Texture(grassUrl, scene);
  terrainMaterial.diffuseTexture2.uScale = terrainMaterial.diffuseTexture2.vScale = tile;

  terrainMaterial.diffuseTexture3 = new Texture(grassUrl, scene);
  terrainMaterial.diffuseTexture3.uScale = terrainMaterial.diffuseTexture3.vScale = tile;

  const ground = createHeightGround(heightMapUrl, size, size, 1, 0, 0, scene);
  ground.material = terrainMaterial;
  return ground;
}

export function createDepartureLine(scene) {
  const cone1 = MeshBuilder.CreateCylinder('cone1', { height: 3.5, diameter: 0.6 * WORLD_SCALE }, scene);
  const cone2 = MeshBuilder.CreateCylinder('cone2', { height: 3.5, diameter: 0.6 * WORLD_SCALE }, scene);

  cone1.position = DEPARTURE.cone1.clone();
  cone2.position = DEPARTURE.cone2.clone();

  const texture = createTexture(flagTexture);
  const outTexture = createTexture(outdoorTexture);

  const flag = MeshBuilder.CreateBox('flag', {
    width: 6 * WORLD_SCALE, height: 0.6, depth: 0.12
  }, scene);
  flag.position = DEPARTURE.flag.clone();
  flag.rotation = new Vector3(9.75, -0.8, 0);
  flag.material = texture;
  cone1.material = outTexture;
  cone2.material = outTexture;

  return [cone1, cone2, flag];
}

export function createCheckpointMaterial(scene, color, emissiveIntensity = 0.85) {
  const material = new StandardMaterial('checkpointMat', scene);
  material.diffuseColor = color;
  material.emissiveColor = color.scale(emissiveIntensity);
  material.specularColor = new Color3(0.2, 0.2, 0.2);
  material.alpha = 0.9;
  return material;
}

export function createCheckpoint(scene, diameter = 5 * WORLD_SCALE) {
  const checkpoint = MeshBuilder.CreateTorus('checkpoint', {
    thickness: 0.28 * WORLD_SCALE,
    diameter,
  }, scene);
  checkpoint.material = createCheckpointMaterial(scene, new Color3(0.15, 0.55, 1.0));
  checkpoint.position = new Vector3(0, 1.4, 0);
  checkpoint.rotation = new Vector3(4.82, 0, 0);
  return checkpoint;
}

export function createPitComplex(scene) {
  const rootParts = [];

  const asphalt = new StandardMaterial('pitAsphalt', scene);
  asphalt.diffuseColor = new Color3(0.22, 0.22, 0.24);
  asphalt.specularColor = new Color3(0.04, 0.04, 0.04);

  const garageMat = new StandardMaterial('garageMat', scene);
  garageMat.diffuseColor = new Color3(0.48, 0.5, 0.54);
  garageMat.emissiveColor = new Color3(0.05, 0.05, 0.07);

  const accentMat = new StandardMaterial('pitAccent', scene);
  accentMat.diffuseColor = new Color3(1.0, 0.75, 0.1);
  accentMat.emissiveColor = new Color3(0.35, 0.22, 0.02);

  const entryMat = new StandardMaterial('pitEntryMat', scene);
  entryMat.diffuseColor = new Color3(0.1, 0.85, 0.45);
  entryMat.emissiveColor = new Color3(0.05, 0.35, 0.18);

  const wallMat = new StandardMaterial('pitWallMat', scene);
  wallMat.diffuseColor = new Color3(0.72, 0.75, 0.8);
  wallMat.emissiveColor = new Color3(0.07, 0.08, 0.09);

  const {
    entry, exitCorner, box, merge, rejoin, left, laneHalfWidth, walls, laneDir
  } = PIT_LANE;

  const exit = exitCorner;
  const dir = exit.subtract(entry);
  const len = dir.length();
  const yaw = Math.atan2(dir.x, dir.z);
  const mid = entry.add(exit).scale(0.5);
  const accessDir = entry.subtract(merge);
  const accessLen = accessDir.length();
  const accessYaw = Math.atan2(accessDir.x, accessDir.z);
  const exitAccess = rejoin.subtract(exit);
  const exitAccessYaw = Math.atan2(exitAccess.x, exitAccess.z);

  // Soft overlays (real grip comes from painted mixmap)
  const lane = MeshBuilder.CreateBox('pitLaneOverlay', {
    width: laneHalfWidth * 1.9,
    height: 0.05,
    depth: len + 1,
  }, scene);
  lane.position = new Vector3(mid.x, 0.03, mid.z);
  lane.rotation.y = yaw;
  lane.material = asphalt;
  lane.visibility = 0.3;
  rootParts.push(lane);

  const accessMid = merge.add(entry).scale(0.5);
  const access = MeshBuilder.CreateBox('pitAccessOverlay', {
    width: laneHalfWidth * 1.55,
    height: 0.045,
    depth: accessLen,
  }, scene);
  access.position = new Vector3(accessMid.x, 0.025, accessMid.z);
  access.rotation.y = accessYaw;
  access.material = asphalt;
  access.visibility = 0.3;
  rootParts.push(access);

  const exitMid = exit.add(rejoin).scale(0.5);
  const exitOverlay = MeshBuilder.CreateBox('pitExitOverlay', {
    width: laneHalfWidth * 1.55,
    height: 0.045,
    depth: exitAccess.length(),
  }, scene);
  exitOverlay.position = new Vector3(exitMid.x, 0.025, exitMid.z);
  exitOverlay.rotation.y = exitAccessYaw;
  exitOverlay.material = asphalt;
  exitOverlay.visibility = 0.3;
  rootParts.push(exitOverlay);

  // Corridor walls ONLY on main lane, mouths open (no access walls)
  walls.forEach((wall, idx) => {
    const wdir = wall.b.subtract(wall.a);
    const wlen = wdir.length();
    if (wlen < 2) return;
    const wyaw = Math.atan2(wdir.x, wdir.z);
    const wmid = wall.a.add(wall.b).scale(0.5);
    const barrier = MeshBuilder.CreateBox('pitWall' + idx, {
      width: 0.5,
      height: 1.25,
      depth: wlen,
    }, scene);
    barrier.position = new Vector3(wmid.x, 0.65, wmid.z);
    barrier.rotation.y = wyaw;
    barrier.material = wallMat;
    rootParts.push(barrier);
  });

  // Green entry markers tight to the pit access mouth
  const accessSide = new Vector3(-accessDir.normalize().z, 0, accessDir.normalize().x);
  [-1, 1].forEach((s, idx) => {
    const pole = MeshBuilder.CreateCylinder('pitEntryPole' + idx, {
      height: 3.2, diameter: 0.26
    }, scene);
    // Flank the entry mouth (not out on the racing line)
    const mouth = merge.add(entry.subtract(merge).scale(0.85));
    pole.position = mouth.add(accessSide.scale(s * (laneHalfWidth * 0.55 + 0.35)));
    pole.position.y = 1.6;
    pole.material = entryMat;
    rootParts.push(pole);

    const board = MeshBuilder.CreateBox('pitEntryBoard' + idx, {
      width: 0.14, height: 1.0, depth: 1.6
    }, scene);
    board.position = pole.position.clone();
    board.position.y = 2.7;
    board.rotation.y = accessYaw;
    board.material = entryMat;
    rootParts.push(board);
  });

  // Dual box pads (P1 further/left, P2 shorter/right) + faint center mark
  const stallPads = [
    { id: 1, stall: getPitStall(1, 2) },
    { id: 2, stall: getPitStall(2, 2) },
  ];
  stallPads.forEach(({ id, stall }) => {
    const pad = MeshBuilder.CreateBox('pitBoxP' + id, {
      width: 4.2,
      height: 0.1,
      depth: 5.4,
    }, scene);
    pad.position = new Vector3(stall.x, 0.06, stall.z);
    pad.rotation.y = yaw;
    pad.material = accentMat;
    rootParts.push(pad);
  });
  const boxPad = MeshBuilder.CreateBox('pitBox', {
    width: laneHalfWidth * 1.2,
    height: 0.05,
    depth: 10.5,
  }, scene);
  boxPad.position = new Vector3(box.x, 0.04, box.z);
  boxPad.rotation.y = yaw;
  boxPad.material = asphalt;
  rootParts.push(boxPad);

  // Garages further off the pit side (away from racing line)
  const garageCenter = mid.add(left.scale(laneHalfWidth + 7.5));
  const alongDir = laneDir;
  for (let i = 0; i < 5; i++) {
    const t = (i / 4) - 0.5;
    const along = alongDir.scale(t * (len - 14));
    const g = MeshBuilder.CreateBox('garage' + i, {
      width: 5.0, height: 2.9, depth: 5.8
    }, scene);
    g.position = garageCenter.add(along);
    g.position.y = 1.45;
    g.rotation.y = yaw;
    g.material = garageMat;
    rootParts.push(g);

    const door = MeshBuilder.CreateBox('door' + i, {
      width: 3.8, height: 2.1, depth: 0.12
    }, scene);
    door.position = g.position.subtract(left.scale(2.9));
    door.position.y = 1.05;
    door.rotation.y = yaw;
    door.material = accentMat;
    rootParts.push(door);
  }

  const exitMat = new StandardMaterial('pitExitMat', scene);
  exitMat.diffuseColor = new Color3(0.9, 0.2, 0.15);
  exitMat.emissiveColor = new Color3(0.4, 0.08, 0.05);

  // Orange exit cones tight to the pitlane mouth (not out on the main track)
  const side = new Vector3(-laneDir.z, 0, laneDir.x).normalize();
  [-1, 1].forEach((s, idx) => {
    const cone = MeshBuilder.CreateCylinder('pitExit' + idx, {
      height: 2.0, diameterTop: 0.12, diameterBottom: 0.38
    }, scene);
    cone.position = exit
      .add(side.scale(s * (laneHalfWidth + 0.3)))
      .add(laneDir.scale(-2.0)); // slightly inside the pit mouth
    cone.position.y = 1.0;
    cone.material = exitMat;
    rootParts.push(cone);
  });

  // Matching cones at the exit→rejoin mouth
  const exitAccessDir = rejoin.subtract(exit).normalize();
  const exitAccessSide = new Vector3(-exitAccessDir.z, 0, exitAccessDir.x);
  [-1, 1].forEach((s, idx) => {
    const cone = MeshBuilder.CreateCylinder('pitRejoin' + idx, {
      height: 1.8, diameterTop: 0.1, diameterBottom: 0.34
    }, scene);
    const mouth = exit.add(exitAccessDir.scale(1.2));
    cone.position = mouth.add(exitAccessSide.scale(s * (laneHalfWidth * 0.5 + 0.25)));
    cone.position.y = 0.9;
    cone.material = exitMat;
    rootParts.push(cone);
  });

  return rootParts;
}
