// ================= Configuration & State =================
const config = {
    shadows: true,
    flashlight: true,
    candelabras: false,
    viewBobbing: true,
    isModern: false
};

// Game State
let mazeData;
let playerObj, playerHead; // Three.js objects
let camera, scene, renderer;
let flashLight, ambientLight, candleLights = [];
let mapCanvas, mapCtx;

// Bot State
let botObj;
let botPath = [];
let botCurrentIndex = 0;
let botState = 'IDLE'; // IDLE, ROTATING, MOVING, FINISHED
let botTargetAngle = 0;
let botCountdown = 4.0;
let botRunning = false;

// Movement & Logic
let playerGridPos = { x: 1, y: 1 };
let playerAngle = 0; // Degrees
let moveSpeed = 10.0;
let turnSpeed = 120.0;
let keysDown = {};
let isThirdPerson = false;
let mapVisible = false;
let bobbingTime = 0;

// Maze Params
const mazeWidth = 41; 
const mazeHeight = 41;
const cellSize = 4; 

// Textures
const loader = new THREE.TextureLoader();
const texWall = createPlaceholderTexture('#555'); 
const texFloor = createPlaceholderTexture('#222');

// ================= Initialization =================

function init() {
    // 1. Setup Three.js Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.03); 

    camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 100);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game-container').appendChild(renderer.domElement);

    // 2. Generate Maze Logic
    mazeData = createMap(mazeWidth, mazeHeight);

    // 3. Build 3D World
    buildMazeMesh(mazeData);

    // 4. Player Setup
    createPlayer();

    // 5. Bot Setup (A*)
    initBot();

    // 6. Lighting
    setupLights();

    // 7. 2D Map Canvas
    mapCanvas = document.getElementById("mazeCanvas");
    mapCanvas.width = window.innerWidth;
    mapCanvas.height = window.innerHeight;
    mapCtx = mapCanvas.getContext("2d");

    // 8. Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('keydown', (e) => { keysDown[e.key.toLowerCase()] = true; onKeyDown(e); });
    window.addEventListener('keyup', (e) => keysDown[e.key.toLowerCase()] = false);
    
    // 9. Setup UI
    setupUI();
    updateCheckboxes();

    // Start Loop
    animate();
}

// ================= Maze Generation (DFS Algorithm) =================
function createMap(w, h) {
    let map = [];
    for(let y=0; y<h; y++) {
        let row = [];
        for(let x=0; x<w; x++) row.push('#');
        map.push(row);
    }
    
    let stack = [{x:1, y:1}];
    map[1][1] = ' ';
    
    const dirs = [[0,2], [0,-2], [2,0], [-2,0]];
    
    while(stack.length > 0) {
        let current = stack[stack.length-1];
        let neighbors = [];
        
        dirs.forEach(d => {
            let nx = current.x + d[0];
            let ny = current.y + d[1];
            if(nx > 0 && nx < w-1 && ny > 0 && ny < h-1 && map[ny][nx] === '#') {
                neighbors.push({x:nx, y:ny, dx:d[0]/2, dy:d[1]/2});
            }
        });
        
        if(neighbors.length > 0) {
            let next = neighbors[Math.floor(Math.random() * neighbors.length)];
            map[next.y][next.x] = ' ';
            map[current.y + next.dy][current.x + next.dx] = ' '; 
            stack.push({x: next.x, y: next.y});
        } else {
            stack.pop();
        }
    }
    
    // Exit
    map[h-2][w-2] = 'E';
    
    // Candelabras
    let candles = [];
    for(let y=1; y<h-1; y++){
        for(let x=1; x<w-1; x++){
            if(map[y][x] === ' ' && Math.random() < 0.05) { 
                candles.push({x, y});
            }
        }
    }

    return { grid: map, candles: candles };
}

// ================= A* Algorithm & Bot =================

function initBot() {
    // Create Bot Mesh (Red Cylinder)
    const geo = new THREE.CylinderGeometry(0.3, 0.3, 1.6, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    botObj = new THREE.Mesh(geo, mat);
    botObj.castShadow = true;
    
    // Start at same position as player (1,1)
    const halfCell = cellSize / 2;
    botObj.position.set((1 * cellSize) + halfCell, 1, (1 * cellSize) + halfCell);
    scene.add(botObj);

    // Solve Path
    const startNode = { x: 1, y: 1 };
    const endNode = { x: mazeWidth - 2, y: mazeHeight - 2 };
    botPath = solveAStar(mazeData.grid, startNode, endNode);
    botCurrentIndex = 0;
    botState = 'IDLE';
}

function solveAStar(grid, start, end) {
    let openSet = [];
    let closedSet = new Set();
    let cameFrom = {};
    let gScore = {};
    let fScore = {};

    function key(n) { return `${n.x},${n.y}`; }

    openSet.push(start);
    gScore[key(start)] = 0;
    fScore[key(start)] = Math.abs(start.x - end.x) + Math.abs(start.y - end.y);

    while (openSet.length > 0) {
        // Get lowest fScore
        let current = openSet.reduce((a, b) => (fScore[key(a)] < fScore[key(b)] ? a : b));

        if (current.x === end.x && current.y === end.y) {
            return reconstructPath(cameFrom, current);
        }

        openSet = openSet.filter(n => n !== current);
        closedSet.add(key(current));

        const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}]; // 4-way
        
        for (let d of dirs) {
            let neighbor = { x: current.x + d.x, y: current.y + d.y };
            let nKey = key(neighbor);

            if (grid[neighbor.y][neighbor.x] === '#') continue; // Wall
            if (closedSet.has(nKey)) continue;

            let tentativeG = gScore[key(current)] + 1;

            if (!openSet.some(n => n.x === neighbor.x && n.y === neighbor.y)) {
                openSet.push(neighbor);
            } else if (tentativeG >= (gScore[nKey] || Infinity)) {
                continue;
            }

            cameFrom[nKey] = current;
            gScore[nKey] = tentativeG;
            fScore[nKey] = gScore[nKey] + (Math.abs(neighbor.x - end.x) + Math.abs(neighbor.y - end.y));
        }
    }
    return []; // No path found
}

function reconstructPath(cameFrom, current) {
    let totalPath = [current];
    let k = `${current.x},${current.y}`;
    while (cameFrom[k]) {
        current = cameFrom[k];
        k = `${current.x},${current.y}`;
        totalPath.unshift(current);
    }
    return totalPath;
}

function updateBot(dt) {
    // 1. Handle Countdown
    if (!botRunning) {
        botCountdown -= dt;
        const ui = document.getElementById('cnt-val');
        if (ui) ui.innerText = Math.ceil(botCountdown);
        
        if (botCountdown <= 0) {
            botRunning = true;
            document.getElementById('countdown-layer').style.display = 'none';
            if (botPath.length > 0) botState = 'NEXT_NODE';
        }
        return;
    }

    // 2. State Machine
    if (botState === 'FINISHED') return;

    const halfCell = cellSize / 2;
    const speed = 6.0; // Units per second
    const rotSpeed = 5.0; // Radians per second

    if (botState === 'NEXT_NODE') {
        botCurrentIndex++;
        if (botCurrentIndex >= botPath.length) {
            botState = 'FINISHED';
            return;
        }
        // Calculate target rotation
        const nextNode = botPath[botCurrentIndex];
        const worldX = (nextNode.x * cellSize) + halfCell;
        const worldZ = (nextNode.y * cellSize) + halfCell;
        
        const dx = worldX - botObj.position.x;
        const dz = worldZ - botObj.position.z;
        
        // Determine angle (0, -PI/2, PI, PI/2)
        botTargetAngle = Math.atan2(dx, dz); // Using (x,z) logic for rotationY
        
        botState = 'ROTATING';
    }

    if (botState === 'ROTATING') {
        // Smoothly rotate towards target angle
        let currentRot = botObj.rotation.y;
        
        // Wrap angles to ensure shortest turn
        let diff = botTargetAngle - currentRot;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        if (Math.abs(diff) < 0.05) {
            botObj.rotation.y = botTargetAngle;
            botState = 'MOVING';
        } else {
            botObj.rotation.y += Math.sign(diff) * rotSpeed * dt;
        }
    }

    if (botState === 'MOVING') {
        const nextNode = botPath[botCurrentIndex];
        const worldTargetX = (nextNode.x * cellSize) + halfCell;
        const worldTargetZ = (nextNode.y * cellSize) + halfCell;

        const dir = new THREE.Vector3(worldTargetX - botObj.position.x, 0, worldTargetZ - botObj.position.z);
        const dist = dir.length();

        if (dist < 0.1) {
            // Snap to middle
            botObj.position.x = worldTargetX;
            botObj.position.z = worldTargetZ;
            botState = 'NEXT_NODE';
        } else {
            dir.normalize();
            botObj.position.x += dir.x * speed * dt;
            botObj.position.z += dir.z * speed * dt;
        }
    }
}

// ================= 3D Construction =================
function buildMazeMesh(data) {
    const wallGeo = new THREE.BoxGeometry(cellSize, cellSize * 2, cellSize);
    const wallMat = new THREE.MeshStandardMaterial({ map: texWall, roughness: 0.8 });
    const floorGeo = new THREE.PlaneGeometry(cellSize, cellSize);
    const floorMat = new THREE.MeshStandardMaterial({ map: texFloor, roughness: 0.8 });
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

    const wallGroup = new THREE.Group();

    // UPDATED: Calculate offset to center mesh within the grid cell
    // Grid 0,0 now corresponds to physical coordinates (2, 2) inside a 4x4 block
    const halfCell = cellSize / 2;

    for (let z = 0; z < mazeHeight; z++) {
        for (let x = 0; x < mazeWidth; x++) {
            let type = data.grid[z][x];
            
            // Align 3D position to the center of the logical grid cell
            let posX = (x * cellSize) + halfCell;
            let posZ = (z * cellSize) + halfCell;

            // Floor
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(posX, 0, posZ);
            floor.receiveShadow = true;
            scene.add(floor);

            // Ceiling
            const ceiling = new THREE.Mesh(floorGeo, ceilingMat);
            ceiling.rotation.x = Math.PI / 2;
            ceiling.position.set(posX, cellSize * 2, posZ);
            scene.add(ceiling);

            if (type === '#') {
                // Wall
                const wall = new THREE.Mesh(wallGeo, wallMat);
                wall.position.set(posX, cellSize, posZ);
                wall.castShadow = true;
                wall.receiveShadow = true;
                wallGroup.add(wall);
            } else if (type === 'E') {
                // Exit
                const exitGeo = new THREE.BoxGeometry(cellSize/2, cellSize, cellSize/2);
                const exitMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x550000 });
                const exitMesh = new THREE.Mesh(exitGeo, exitMat);
                exitMesh.position.set(posX, cellSize/2, posZ);
                scene.add(exitMesh);
            }
        }
    }
    scene.add(wallGroup);

    // Add Candelabras centered
    data.candles.forEach(pos => {
        createCandelabra((pos.x * cellSize) + halfCell, (pos.y * cellSize) + halfCell);
    });
}

function createCandelabra(x, z) {
    const standGeo = new THREE.CylinderGeometry(0.1, 0.2, 1.5, 8);
    const standMat = new THREE.MeshStandardMaterial({ color: 0x886600, metalness: 0.8 });
    const stand = new THREE.Mesh(standGeo, standMat);
    stand.position.set(x, 0.75, z);
    stand.castShadow = false; 
    scene.add(stand);

    const bulb = new THREE.PointLight(0xffaa00, 1, 12); 
    bulb.position.set(0, 0.8, 0);
    bulb.castShadow = false; 
    stand.add(bulb);
    
    candleLights.push({ light: bulb, baseInt: 1.0, seed: Math.random(), parent: stand });
}

function createPlayer() {
    const geo = new THREE.CylinderGeometry(0.3, 0.3, 1.6, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    playerObj = new THREE.Mesh(geo, mat);
    playerObj.castShadow = true;
    
    // UPDATED: Start player at (1.5 * cellSize) which is center of cell (1,1)
    playerObj.position.set(cellSize * 1.5, 1, cellSize * 1.5); 
    scene.add(playerObj);

    // Head
    playerHead = new THREE.Object3D();
    playerHead.position.set(0, 0.5, 0);
    playerObj.add(playerHead);

    // Flashlight
    flashLight = new THREE.SpotLight(0xffffff, 2);
    flashLight.position.set(0.2, 0, 0);
    flashLight.target.position.set(0, 0, -5);
    flashLight.angle = Math.PI / 3.5; 
    flashLight.penumbra = 0.3;
    flashLight.distance = 40;
    flashLight.castShadow = true; 
    playerHead.add(flashLight);
    playerHead.add(flashLight.target);
}

function setupLights() {
    ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
    scene.add(ambientLight);
}

// ================= Game Loop & Logic =================

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    let dt = clock.getDelta();
    if (dt > 0.1) dt = 0.1; 

    updateMovement(dt);
    updateBot(dt); // Update Bot Logic
    updateCamera();
    updateFlicker(dt);
    
    if(flashLight) flashLight.visible = config.flashlight;
    
    if (config.isModern) {
        ambientLight.intensity = 0.05; 
    } else {
        ambientLight.intensity = 0.6; 
    }

    renderer.shadowMap.enabled = config.shadows;
    candleLights.forEach(c => { c.parent.visible = config.candelabras; });

    renderer.render(scene, camera);
    draw2DMap();
}

function updateMovement(dt) {
    // Rotation
    if (keysDown['a'] || keysDown['arrowleft']) playerAngle += turnSpeed * dt;
    if (keysDown['d'] || keysDown['arrowright']) playerAngle -= turnSpeed * dt;
    playerAngle = playerAngle % 360;

    // Movement
    let speed = 0;
    if (keysDown['w'] || keysDown['arrowup']) speed = moveSpeed;
    if (keysDown['s'] || keysDown['arrowdown']) speed = -moveSpeed;

    if (speed !== 0) {
        const rad = THREE.MathUtils.degToRad(playerAngle);
        const dx = -Math.sin(rad) * speed * dt;
        const dz = -Math.cos(rad) * speed * dt;

        // NEW: Independent Axis Movement & Collision Check
        // Try X movement
        if (!checkCollision(playerObj.position.x + dx, playerObj.position.z)) {
            playerObj.position.x += dx;
        }

        // Try Z movement (allows wall sliding)
        if (!checkCollision(playerObj.position.x, playerObj.position.z + dz)) {
            playerObj.position.z += dz;
        }
        
        // Bobbing
        if(config.viewBobbing) bobbingTime += dt * 10;

    } else {
        bobbingTime = THREE.MathUtils.lerp(bobbingTime, 0, dt * 5);
    }

    // Apply rotation
    playerObj.rotation.y = THREE.MathUtils.degToRad(playerAngle);
    
    // Update Map Grid Pos
    playerGridPos.x = Math.floor(playerObj.position.x / cellSize);
    playerGridPos.y = Math.floor(playerObj.position.z / cellSize);
}

// Returns TRUE if a collision is detected (including padding radius)
function checkCollision(x, z) {
    // Padding radius: keeps the camera/player center away from wall edges
    const padding = 0.8; 
    
    // Check 4 points around the player center
    const points = [
        { x: x + padding, z: z },
        { x: x - padding, z: z },
        { x: x, z: z + padding },
        { x: x, z: z - padding }
    ];

    for (let p of points) {
        const gridX = Math.floor(p.x / cellSize);
        const gridZ = Math.floor(p.z / cellSize);

        // Bounds check
        if (gridX < 0 || gridX >= mazeWidth || gridZ < 0 || gridZ >= mazeHeight) return true;
        
        // Wall check
        if (mazeData.grid[gridZ][gridX] === '#') return true;
    }
    
    return false;
}

function updateCamera() {
    const rad = THREE.MathUtils.degToRad(playerAngle);
    const bobY = Math.sin(bobbingTime) * 0.15; 

    if (isThirdPerson) {
        const dist = 6.0; 
        const height = 4.0;
        const cx = playerObj.position.x + Math.sin(rad) * dist;
        const cz = playerObj.position.z + Math.cos(rad) * dist;
        
        camera.position.lerp(new THREE.Vector3(cx, height + bobY, cz), 0.1);
        camera.lookAt(playerObj.position.x, playerObj.position.y + 1, playerObj.position.z);
    } else {
        // 1st Person
        const headPos = new THREE.Vector3();
        playerHead.getWorldPosition(headPos);
        camera.position.copy(headPos);
        camera.position.y += bobY; 
        
        const lookX = camera.position.x - Math.sin(rad);
        const lookZ = camera.position.z - Math.cos(rad);
        camera.lookAt(lookX, camera.position.y, lookZ);
    }
}

function updateFlicker(dt) {
    if (!config.candelabras) return;
    candleLights.forEach(c => {
        const flicker = Math.sin(Date.now() * 0.01 + c.seed * 100) * 0.1 + 
                        Math.cos(Date.now() * 0.05) * 0.1;
        c.light.intensity = c.baseInt + flicker;
    });
}

// ================= UI & 2D Map =================

function draw2DMap() {
    if (!mapCtx) return;
    mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    
    if (!mapVisible) return;

    mapCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
    mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);

    const size = 12; 
    const offsetX = (mapCanvas.width - mazeWidth * size) / 2;
    const offsetY = (mapCanvas.height - mazeHeight * size) / 2;

    for(let z=0; z<mazeHeight; z++){
        for(let x=0; x<mazeWidth; x++){
            let cell = mazeData.grid[z][x];
            if(cell === '#') mapCtx.fillStyle = "#444";
            else if(cell === 'E') mapCtx.fillStyle = "red";
            else mapCtx.fillStyle = "#222"; 
            
            // Highlight player
            if(z === playerGridPos.y && x === playerGridPos.x) mapCtx.fillStyle = "lime";
            
            // Highlight Bot
            if (botObj) {
                const bGx = Math.floor(botObj.position.x / cellSize);
                const bGy = Math.floor(botObj.position.z / cellSize);
                if (z === bGy && x === bGx) mapCtx.fillStyle = "magenta";
            }

            mapCtx.fillRect(offsetX + x*size, offsetY + z*size, size, size);
        }
    }
}

function onKeyDown(e) {
    const k = e.key.toLowerCase();
    if(k === 'm') mapVisible = !mapVisible;
    if(k === 'v') isThirdPerson = !isThirdPerson;
    if(k === 'f') {
        config.flashlight = !config.flashlight;
        document.getElementById('opt-flashlight').checked = config.flashlight;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    mapCanvas.width = window.innerWidth;
    mapCanvas.height = window.innerHeight;
}

function setupUI() {
    const bind = (id, prop) => {
        const el = document.getElementById(id);
        if(!el) return;
        el.addEventListener('change', () => config[prop] = el.checked);
    };
    bind('opt-shadows', 'shadows');
    bind('opt-flashlight', 'flashlight');
    bind('opt-candles', 'candelabras');
    bind('opt-bobbing', 'viewBobbing');

    const btnModern = document.getElementById('btn-modern');
    if(btnModern) {
        btnModern.addEventListener('click', () => {
            config.isModern = true;
            config.shadows = true;
            config.flashlight = true;
            config.candelabras = true;
            config.viewBobbing = true;
            updateCheckboxes();
        });
    }

    const btnClassic = document.getElementById('btn-classic');
    if(btnClassic) {
        btnClassic.addEventListener('click', () => {
            config.isModern = false;
            config.shadows = false;
            config.flashlight = false;
            config.candelabras = false;
            config.viewBobbing = false;
            updateCheckboxes();
        });
    }
}

function updateCheckboxes() {
    const setCheck = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.checked = val;
    };
    setCheck('opt-shadows', config.shadows);
    setCheck('opt-flashlight', config.flashlight);
    setCheck('opt-candles', config.candelabras);
    setCheck('opt-bobbing', config.viewBobbing);
}

function createPlaceholderTexture(color) {
    const cvs = document.createElement('canvas');
    cvs.width = 64; cvs.height = 64;
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0,0,64,64);
    for(let i=0; i<200; i++) {
        ctx.fillStyle = `rgba(255,255,255,0.1)`;
        ctx.fillRect(Math.random()*64, Math.random()*64, 2, 2);
    }
    const tex = new THREE.CanvasTexture(cvs);
    tex.magFilter = THREE.NearestFilter;
    return tex;
}

init();
