import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, FollowCamera, ShadowGenerator, DirectionalLight, CubeTexture, Color3, StandardMaterial, Texture, MeshBuilder, PhysicsShapeType, TransformNode, GizmoManager, Matrix } from '@babylonjs/core';
import { DeviceSourceManager, DeviceType, HavokPlugin, PhysicsAggregate} from '@babylonjs/core';
import * as GUI from "@babylonjs/gui";


// Import your existing functions
import { createMixMapGround, createHeightGround, createDepartureLine, createCheckpoint } from '../scripts/object.js';
import { applyTexture } from '../scripts/texture.js';
import { createGlbObject, controlCar, getWorldPosition } from '../scripts/car.js'
import { workerFunction } from '@babylonjs/core/Misc/khronosTextureContainer2Worker.js';

const canvas = document.getElementById("renderCanvas");
const engine = new Engine(canvas, true);
const deviceSourceManager = new DeviceSourceManager(engine);
const keysPressed = new Set();

function checkCheckpointsArea(car, checkpoints, width = 2) {
    const carPos = car.position;
    let nbcheck = 0;

    checkpoints.forEach(cp => {
        if (cp[2] === true) {
            nbcheck ++; 
            return; // already passed
        }
        const p1 = cp[0]; // left side
        const p2 = cp[1]; // right side

        // Direction along the segment
        const seg = p2.subtract(p1);
        const segLen = seg.length();
        const segDir = seg.normalize();

        // Vector perpendicular to the segment in XZ plane (normal)
        const normal = new Vector3(-segDir.z, 0, segDir.x);

        // Project car vector relative to p1
        const carVec = carPos.subtract(p1);

        // Get car position along the segment
        const along = Vector3.Dot(carVec, segDir);

        // Get car position perpendicular to segment
        const across = Vector3.Dot(carVec, normal);

        // Check if car is inside rectangle area
        if ((along >= 0 && along <= segLen && Math.abs(across) <= width / 2) && cp[3] != "start") {
            cp[2] = true; // mark as passed
            console.log("Checkpoint passed!", cp, nbcheck);
        }
        if ((along >= 0 && along <= segLen && Math.abs(across) <= width / 2) && (cp[3] == "start" && nbcheck == 9)) { //We can check the last because last in the list
            cp[3] = true;
            console.log("RUN FINISH");
        }
    });
    return checkpoints;
}

function createStopwatch() {
    let startTime = Date.now();
    let elapsed = 0;
    let running = true;

    return {
        stop: () => {
            if (running) {
                elapsed += Date.now() - startTime;
                running = false;
            }
        },
        start: () => {
            if (!running) {
                startTime = Date.now();
                running = true;
            }
        },
        reset: () => {
            startTime = Date.now();
            elapsed = 0;
            running = true;
        },
        getTime: () => {
            if (running) {
                return elapsed + (Date.now() - startTime);
            } else {
                return elapsed;
            }
        },
        getTimeString: () => {
            const time = running ? elapsed + (Date.now() - startTime) : elapsed;
            const minutes = Math.floor(time / 60000).toString().padStart(2, '0');
            const seconds = Math.floor((time % 60000) / 1000).toString().padStart(2, '0');
            const centiseconds = Math.floor((time % 1000) / 10).toString().padStart(2, '0');
            return `${minutes}:${seconds}:${centiseconds}`;
        }
    };
}

function createTopRightLabel(scene, text, color = "white", fontSize = 24, pos = "right") {
    // Create GUI if not already created
    if (!scene._uiLayer) {
        scene._uiLayer = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
    }
    
    const gui = scene._uiLayer;

    // Create a text block
    const label = new GUI.TextBlock();
    label.text = text;
    label.color = color;
    label.fontSize = fontSize;
    if(pos == "right") {
        label.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        label.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    }
    else if (pos == "center") {
        label.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        label.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    }
    label.paddingRight = 20;
    label.paddingTop = 20;

    gui.addControl(label);

    return label;
}



const createScene = async function () {
    const world = new Scene(engine);

    //Rotate camera
    // const camera = new ArcRotateCamera("Camera", Math.PI / 2, Math.PI / 2, 4, Vector3.Zero(), world);
    // camera.attachControl(canvas, true);
    
    // Camera
    const camera = new FollowCamera("camera", new Vector3(-6,0,10), world);
    camera.heightOffset = 3;
    camera.radius = 5;
    camera.rotationOffset = -90;
    camera.cameraAcceleration = 0.1;
    camera.maxCameraSpeed = 10;

    // Physics - Initialize Havok
    // const gravity = new Vector3(0, -9.81, 0);
    // const hk = await HavokPhysics();
    // const babylonPlugin = new HavokPlugin(true, hk);
    // world.enablePhysics(gravity, babylonPlugin);

    // Light - Fixed variable name
    const light = new DirectionalLight("dirLight", new Vector3(-1, -2, -1), world);
    light.position = new Vector3(20, 40, 20);
    light.intensity = 2;

    // Ground with proper physics
    let ground = createMixMapGround(world);
    ground.position = new Vector3(0, 0, 0);

    // Load car and setup physics
    const meshes = await createGlbObject(world);
    const car = meshes[0];
    
    // Create parent transform node for physics
    const carParent = new TransformNode("carParent", world);
    car.parent = carParent;
    // car.position = Vector3.Zero(); // Reset to local origin
    
    // Position the parent (which moves the car)
    carParent.position = new Vector3(18.86, 1.2, -38.8); // Start above ground
    carParent.rotation = new Vector3(0, -2.4, 0);
    carParent.scaling = new Vector3(0.4, 0.4, 0.4);

    const checkpoint = createCheckpoint();
    let lstCheckpoints = [checkpoint];
    for (let i = 1; i<= 8; i++ ) {
        lstCheckpoints[i] = checkpoint.createInstance("checkpoint" + i);
    } 

    lstCheckpoints[1].position = new Vector3(-3.6, 1.2, 30.1);
    lstCheckpoints[1].rotation = new Vector3(4.82, 0, 2.2);


    lstCheckpoints[2].position = new Vector3(-44.1, 1.2, -26.9);
    lstCheckpoints[2].rotation = new Vector3(4.82, 0, 14.5);


    lstCheckpoints[3].position = new Vector3(-35.8, 1.2, -34.37);
    lstCheckpoints[3].rotation = new Vector3(4.82, 0, 0.5);


    lstCheckpoints[4].position = new Vector3(-60.4, 1.2, 31.06);
    lstCheckpoints[4].rotation = new Vector3(4.82, 0, 45);


    lstCheckpoints[5].position = new Vector3(2.55, 1.2, 48.25);
    lstCheckpoints[5].rotation = new Vector3(4.82, 0, 30);


    lstCheckpoints[6].position = new Vector3(64.080, 1.2, -2.27);
    lstCheckpoints[6].rotation = new Vector3(4.82, 0, 0);


    lstCheckpoints[7].position = new Vector3(41.58, 1.2, -36.29);
    lstCheckpoints[7].rotation = new Vector3(4.82, 0, 0);


    lstCheckpoints[8].position = new Vector3(33, 1.2, -48.95);
    lstCheckpoints[8].rotation = new Vector3(4.82, 0, 5);

    const radius = 5 / 2; // diameter / 2 = 2.5

    let lstCheckpointsPass = [] //POS TO PASS TO COMPLETE THE TRACK

    lstCheckpoints.forEach(cp => {
        const center = cp.position;
        const rotation = cp.rotation;

        // Take the local "right" vector (x-axis) and rotate it by checkpoint's rotation
        const right = new Vector3(1, 0, 0);
        const rotMatrix = new Matrix();
        cp.rotationQuaternion
            ? cp.rotationQuaternion.toRotationMatrix(rotMatrix)
            : Matrix.RotationYawPitchRoll(rotation.y, rotation.x, rotation.z).multiplyToRef(Matrix.Identity(), rotMatrix);

        const dir = Vector3.TransformNormal(right, rotMatrix).normalize();

        // Now compute left/right edge points
        const pMin = center.subtract(dir.scale(radius));
        const pMax = center.add(dir.scale(radius));

        lstCheckpointsPass.push([pMin, pMax, false, "check"]);
    });



    //Be able to move an object
    // const posManager = new GizmoManager(world);
    // posManager.positionGizmoEnabled = true;
    // posManager.rotationGizmoEnabled = true;
    // posManager.scaleGizmoEnabled = true;
    // posManager.boundingBoxGizmoEnabled = true;
    // posManager.attachableMeshes = [testCheckpoint];
    // posManager.updateGizmoRotationToMatchAttachedMesh = false;
    // posManager.attachToMesh(testCheckpoint);
    
    
    // Setup camera target
    camera.lockedTarget = carParent;

    // Create physics aggregate for the car
    // const carPhysics = new PhysicsAggregate(
        // carParent,
        // PhysicsShapeType.BOX,
        // { mass: 1, restitution: 0.3, friction: 0.8 },
        // world
    // );

    // Shadows
    const shadow = new ShadowGenerator(1024, light);
    shadow.getShadowMap().renderList.push(car);
    ground.receiveShadows = true;

    // Skybox
    const skybox = MeshBuilder.CreateBox("skyBox", { size: 150 }, world);
    const skyboxMaterial = new StandardMaterial("skyBoxMaterial", world);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = new CubeTexture(
        "/models/", 
        world,
        ["px.png", "py.png", "pz.png", "nx.png", "ny.png", "nz.png"]
    );
    skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
    skyboxMaterial.specularColor = new Color3(0, 0, 0);
    skybox.material = skyboxMaterial;

    const doubleCone = createDepartureLine(world);
    const cylinder1 = doubleCone[0];
    const cynlinder2 = doubleCone[1];
    // console.log(cylinder1);

    lstCheckpointsPass.push([cylinder1.position, cynlinder2.position, false, "start"]);


    // Keyboard input handling
    deviceSourceManager.onDeviceConnectedObservable.add((device) => {
        if (device.deviceType === DeviceType.Keyboard) {
            device.onInputChangedObservable.add((eventData) => {
                const key = eventData.key;
                if (eventData.type == "keydown") {
                    keysPressed.add(key);
                } else if (eventData.type == "keyup") {
                    keysPressed.delete(key);
                }
            });
        }
    })
    return [world, carParent, lstCheckpointsPass]; // Return physics aggregate too
};





async function run_game() {
    
    const outputScene = await createScene();
    const scene = outputScene[0];
    const car = outputScene[1];
    let checkpoints = outputScene[2];
    console.log(checkpoints);
    let velocity = 0.0;
    let time_acc = 0.0;
    let time_decc = 0.0;
    let result;

    const keyUnlocked = ["z", "q", "d", "s"];


    const mapImage = new Image();
    mapImage.src = "../dist/models/mixmapcircuit.png";

    let pixelData;
    const stopwatch = createStopwatch();
    let textChrono = createTopRightLabel(scene, stopwatch.getTimeString(), "white", 42);
    stopwatch.stop();

    let textStart = createTopRightLabel(scene, "Press Space to start", "white", 60, "center");
    let stateGame = 0 // 0 for waiting to start and 1 to run

    mapImage.onload = () => {
        // Offscreen canvas
        const canvas = document.createElement("canvas");
        canvas.width = mapImage.width;
        canvas.height = mapImage.height;
        const ctx = canvas.getContext("2d");

        // Draw image once
        ctx.drawImage(mapImage, 0, 0);

        // Read entire pixel data once
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        pixelData = imageData.data; // Uint8ClampedArray
    };
        
    engine.runRenderLoop(() => {
        
        // console.log(keysPressed.size, car.position);
        // console.log(keysPressed, stateGame);
        // console.log(car.position.x , car.position.z, Vector3.TransformCoordinates(car.position, car.getWorldMatrix()));
        // console.log(getWorldPosition(car.position));
        // console.log(car.position.x, car.position.z);
        // console.log(testCheckpoint.position, testCheckpoint.rotation);
        if (!pixelData) return; // wait until it's loaded

        const imagePosCar = getWorldPosition(car.position);
        const x = Math.floor(imagePosCar[0]);
        const y = Math.floor(imagePosCar[1]);

        const width = 2048; // image width
        const index = (y * width + x) * 4; // 4 bytes per pixel
        const red = pixelData[index];

        if(keysPressed.size == 0) {
            result = controlCar(scene, deviceSourceManager, car, "", keysPressed, velocity, time_acc, time_decc, red);
            velocity = result[0];
            time_acc = result[1];
            time_decc = result[2];
        }
        else {
            
            keysPressed.forEach((key) => {
                if(keyUnlocked.includes(key) && stateGame == 1) {
                    result = controlCar(scene, deviceSourceManager, car, key, keysPressed, velocity, time_acc, time_decc, red);
                    velocity = result[0];
                    time_acc = result[1];
                    time_decc = result[2];
                }
                
                else if (key == " " && stateGame == 0) {
                    stateGame = 1;
                    textStart.dispose()
                    stopwatch.start();
                }
            });
        }

        checkpoints = checkCheckpointsArea(car, checkpoints);
        if(checkpoints[9][2] == true) {
            stopwatch.stop();
            // console.log(stopwatch.getTimeString());
        }

        textChrono.text = stopwatch.getTimeString();


        scene.render();
    });

    window.addEventListener("resize", () => {
        engine.resize();
    });
}

run_game(); 