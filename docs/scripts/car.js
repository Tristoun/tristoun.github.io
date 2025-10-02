import { LoadAssetContainerAsync } from '@babylonjs/core';
import {Vector3, Matrix} from '@babylonjs/core';
import "@babylonjs/loaders/glTF";


export async function createGlbObject(scene) {
  const container = await LoadAssetContainerAsync("../models/racing_car.glb", scene, {
    onProgress: (event) => {
      // Optional: handle progress here
      // console.log(`Loading progress: ${event.loaded / event.total * 100}%`);
    }
  });

  container.addAllToScene();

  return container.meshes;
}

function determineSpeed(velocity, time, force) {
  const mass = 1.0
  velocity = velocity + (force / mass) * time;

  return velocity;
}



export function controlCar(scene, dsm, car, dataKey, keysPressed, velocity, time_acc, time_decc, red) {
  const speed = 0.2;
  const turnSpeed = 0.025;
  let maxVelocity = 1.25
  if(red != 255) {
    maxVelocity = 0.5;
  }

  let force = 0.0;
  let straight = false;
  let movement;
  let bothDirection = false;

  switch (dataKey) {
    case "z": { // move forward
      straight = true;
      if(time_decc > 0) {
        time_decc = 0;
      }
      // get rotation matrix from car's rotation
      const rotationMatrix = Matrix.RotationYawPitchRoll(car.rotation.y, car.rotation.x, car.rotation.z);
      // const localForward = new Vector3(1, 0, 0);
      force = 0.15;
      velocity = determineSpeed(velocity, time_acc, force);
      
      if(velocity > maxVelocity) {
        velocity = maxVelocity;
      }
      else {
        time_acc += 0.005;
      }

      movement = new Vector3(velocity, 0,0);
      // const forward = Vector3.TransformCoordinates(localForward, rotationMatrix);
      const forward = Vector3.TransformCoordinates(movement, rotationMatrix);
      car.position.addInPlace(forward.scale(speed));
      break;
    }

    case "s": {  // move backward
      if(!keysPressed.has("z")) {
        const rotationMatrix = Matrix.RotationYawPitchRoll(car.rotation.y, car.rotation.x, car.rotation.z);
        // const localBackward = new Vector3(-1, 0, 0);
        // const backward = Vector3.TransformCoordinates(localBackward, rotationMatrix);
        if(time_acc > 0 ){
          time_acc = 0.0;
        }
        time_decc += 0.01;
        if(velocity <= 0) {
          velocity = 0.0
        }
        else {
          force = -0.2;

        }
        velocity = determineSpeed(velocity, time_decc, force)

       
        if (velocity > maxVelocity) {
          velocity = maxVelocity;
        }
        else if (velocity < -maxVelocity+0.5) {
          velocity = -maxVelocity+0.5
        }
        movement = new Vector3(velocity, 0,0);
        const backward = Vector3.TransformCoordinates(movement, rotationMatrix);

        car.position.addInPlace(backward.scale(speed));
        
      }
      break;
    }

    case "q": // turn left
      if(Array.from(keysPressed)[0] != "d") {
        car.rotation.y -= turnSpeed;
        bothDirection = false;
      }
      else {
        bothDirection = true;
      }
      break;
    case "d": // turn right
      if(Array.from(keysPressed)[0] != "q") {
        car.rotation.y += turnSpeed;
        bothDirection = false;
      }
      else {
        bothDirection = true;
      }
      break;     
  }
  if(!keysPressed.has("z") && !keysPressed.has("s") && bothDirection == false) {
    const rotationMatrix = Matrix.RotationYawPitchRoll(car.rotation.y, car.rotation.x, car.rotation.z);
    // const localBackward = new Vector3(-1, 0, 0);
    // const backward = Vector3.TransformCoordinates(localBackward, rotationMatrix);
    if(time_acc > 0 ){
      time_acc = 0.0;
    }
    time_decc += 0.01;
    force = -0.05;
    velocity = determineSpeed(velocity, time_decc, force)

    if(velocity < 0.0) {
      velocity = 0.0;
    }
    else if (velocity > maxVelocity) {
      velocity = maxVelocity;
    }
    movement = new Vector3(velocity, 0,0);
    const backward = Vector3.TransformCoordinates(movement, rotationMatrix);

    car.position.addInPlace(backward.scale(speed));
  }

  return [velocity, time_acc, time_decc]
}


export function getWorldPosition(pos) {
  //X=mx​⋅x+bx​,Y=my​⋅z+by​

  const x = 13.653333333333333 * pos.x + 1024;
  const y = -10.24 * pos.z + 768;
  return [x, y];
}
