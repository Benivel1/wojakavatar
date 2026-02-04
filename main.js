import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/GLTFLoader.js";

const canvas = document.querySelector("#game");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const jumpButton = document.querySelector("#jump");
const restartButton = document.querySelector("#restart");
const overlay = document.querySelector("#overlay");
const finalScoreEl = document.querySelector("#final-score");
const playAgainButton = document.querySelector("#play-again");

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x05070d, 18, 60);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  120
);
camera.position.set(0, 4.5, 12);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const ambient = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
keyLight.position.set(6, 12, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x6f7dff, 0.4);
fillLight.position.set(-6, 6, 6);
scene.add(fillLight);

const groundGeometry = new THREE.PlaneGeometry(120, 120);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x101622 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);

const laneMarkers = new THREE.GridHelper(120, 60, 0x22283a, 0x151a28);
laneMarkers.position.y = 0.001;
scene.add(laneMarkers);

const playerGroup = new THREE.Group();
scene.add(playerGroup);

let player = null;
const loader = new GLTFLoader();
loader.load(
  "./wojakmodel.glb",
  (gltf) => {
    player = gltf.scene;
    player.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
      }
    });
    player.scale.set(1.3, 1.3, 1.3);
    player.position.set(0, 0, 0);
    playerGroup.add(player);
  },
  undefined,
  () => {
    const fallbackGeometry = new THREE.BoxGeometry(1.5, 2.4, 1.2);
    const fallbackMaterial = new THREE.MeshStandardMaterial({ color: 0x8fa8ff });
    player = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
    player.castShadow = true;
    player.position.set(0, 1.2, 0);
    playerGroup.add(player);
  }
);

const obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0xff8a5c });
const obstacles = [];
const obstaclePool = [];

let lastSpawn = 0;
let spawnInterval = 1800;
let speed = 0.16;
let score = 0;
let best = Number(localStorage.getItem("wojak-best-score") || 0);
let isRunning = true;
let jumpVelocity = 0;
let isJumping = false;
const gravity = -0.018;
const jumpStrength = 0.42;

bestEl.textContent = best;

function spawnObstacle() {
  const geometry = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  const obstacle = obstaclePool.pop() || new THREE.Mesh(geometry, obstacleMaterial);
  obstacle.position.set((Math.random() - 0.5) * 3, 0.7, -40);
  obstacle.castShadow = true;
  obstacle.receiveShadow = true;
  scene.add(obstacle);
  obstacles.push(obstacle);
}

function resetGame() {
  obstacles.forEach((obstacle) => {
    scene.remove(obstacle);
    obstaclePool.push(obstacle);
  });
  obstacles.length = 0;
  score = 0;
  speed = 0.16;
  spawnInterval = 1800;
  lastSpawn = 0;
  jumpVelocity = 0;
  isJumping = false;
  isRunning = true;
  overlay.classList.remove("show");
  scoreEl.textContent = score;
  if (playerGroup) {
    playerGroup.position.y = 0;
  }
}

function endGame() {
  isRunning = false;
  finalScoreEl.textContent = score;
  overlay.classList.add("show");
  if (score > best) {
    best = score;
    bestEl.textContent = best;
    localStorage.setItem("wojak-best-score", best);
  }
}

function handleJump() {
  if (!isRunning) return;
  if (isJumping) return;
  isJumping = true;
  jumpVelocity = jumpStrength;
}

function updatePlayer() {
  if (!isJumping) return;
  playerGroup.position.y += jumpVelocity;
  jumpVelocity += gravity;
  if (playerGroup.position.y <= 0) {
    playerGroup.position.y = 0;
    isJumping = false;
  }
}

function updateObstacles(delta) {
  obstacles.forEach((obstacle) => {
    obstacle.position.z += speed * delta;
  });

  while (obstacles.length && obstacles[0].position.z > 12) {
    const obstacle = obstacles.shift();
    scene.remove(obstacle);
    obstaclePool.push(obstacle);
    score += 1;
    scoreEl.textContent = score;
    if (score % 5 === 0) {
      speed += 0.015;
      spawnInterval = Math.max(900, spawnInterval - 120);
    }
  }
}

const playerBox = new THREE.Box3();
const obstacleBox = new THREE.Box3();

function checkCollisions() {
  if (!player) return;
  playerBox.setFromObject(playerGroup);
  obstacles.forEach((obstacle) => {
    obstacleBox.setFromObject(obstacle);
    if (playerBox.intersectsBox(obstacleBox)) {
      endGame();
    }
  });
}

const clock = new THREE.Clock();

function animate() {
  const delta = clock.getDelta() * 60;
  requestAnimationFrame(animate);

  if (isRunning) {
    updatePlayer();
    updateObstacles(delta);
    checkCollisions();
  }

  renderer.render(scene, camera);
}

function updateCamera() {
  camera.lookAt(0, 1.2, 0);
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", updateCamera);
window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    handleJump();
  }
});

jumpButton.addEventListener("click", handleJump);
restartButton.addEventListener("click", resetGame);
playAgainButton.addEventListener("click", resetGame);

function loopSpawn(timestamp) {
  if (isRunning && timestamp - lastSpawn > spawnInterval) {
    spawnObstacle();
    lastSpawn = timestamp;
  }
  requestAnimationFrame(loopSpawn);
}

updateCamera();
requestAnimationFrame(loopSpawn);
animate();
