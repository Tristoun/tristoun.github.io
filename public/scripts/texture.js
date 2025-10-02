
import { Texture, StandardMaterial } from '@babylonjs/core';

export function createTexture(texturePath) {
    const material = new StandardMaterial("material");
    material.diffuseTexture = new Texture(texturePath);
    // object.material = material;

    return material;
}