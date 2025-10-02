// Import BabylonJS modules
import { Mesh, MeshBuilder, Texture, Vector3, Vector4 } from '@babylonjs/core';
import { TerrainMaterial } from '@babylonjs/materials';
import { createTexture } from './texture';

// Import textures as modules
import mixMapUrl from '../models/mixmapcircuit.png';
import roadUrl from '../models/road2.png';
import grassUrl from '../models/grass2.png';
import heightMapUrl from '../models/silverstoneCircuit.png';
import flagTexture from '../models/flag.png';
import outdoorTexture from '../models/outdoor.png'
import blueTexture from '../models/blue.png'


export function createHeightGround(fileName, width = 150, height = 150, subdivisions = 150, minHeight = 0, maxHeight = 10, scene) {
    const ground = MeshBuilder.CreateGroundFromHeightMap(
        "ground",
        fileName,
        { width, height, subdivisions, minHeight, maxHeight },
        scene
    );
    return ground;
}

export function createMixMapGround(scene) {
    const terrainMaterial = new TerrainMaterial("terrainMaterial", scene);

    // Set mix map (controls blending via RGB)
    terrainMaterial.mixTexture = new Texture(mixMapUrl, scene);

    // Red channel → road
    terrainMaterial.diffuseTexture1 = new Texture(roadUrl, scene);
    terrainMaterial.diffuseTexture1.uScale = terrainMaterial.diffuseTexture1.vScale = 10;

    // Green channel → grass
    terrainMaterial.diffuseTexture2 = new Texture(grassUrl, scene);
    terrainMaterial.diffuseTexture2.uScale = terrainMaterial.diffuseTexture2.vScale = 10;

    // Blue channel fallback (same as grass here)
    terrainMaterial.diffuseTexture3 = new Texture(grassUrl, scene);
    terrainMaterial.diffuseTexture3.uScale = terrainMaterial.diffuseTexture3.vScale = 10;

    // Create ground using height map
    const groundheight = createHeightGround(heightMapUrl, 150, 150, 1, 0, 0, scene);

    // Apply terrain material
    groundheight.material = terrainMaterial;


    return groundheight;
}


export function createDepartureLine(scene) {
    const cone1 = MeshBuilder.CreateCylinder("cone1", {height: 3, diameter:0.5});
    const cone2 = MeshBuilder.CreateCylinder("cone1", {height: 3, diameter:0.5});

    cone1.position = new Vector3(14, 1.2, -36);
    cone2.position = new Vector3(18, 1.2, -32);

    const texture = createTexture(flagTexture);
    const outTexture = createTexture(outdoorTexture)

    let flag = MeshBuilder.CreateBox("flag", {width: 6, height: 0.5, depth:0.1});
    flag.position = new Vector3(16 , 2.4, -34);
    flag.rotation = new Vector3(9.75, -0.8, 0);
    flag.material = texture;
    cone1.material = outTexture;
    cone2.material = outTexture;
    

    return [cone1, cone2];
}


export function createCheckpoint() {
    const checkpoint = MeshBuilder.CreateTorus("checkpoint", {thickness:0.25, diameter:5});
    const material = createTexture(blueTexture);
    checkpoint.material = material;

    checkpoint.position = new Vector3(0, 1.2, 0);
    checkpoint.rotation = new Vector3(4.82, 0, 0);

    return checkpoint;
}