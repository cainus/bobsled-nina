import * as THREE from 'three';
import { Game } from './Game';
import type { Season } from './SeasonManager';

const loadingText = document.getElementById('loading-text')!;
const loadingBar = document.getElementById('loading-bar')!;
const loadingBarBg = document.getElementById('loading-bar-bg')!;
const controlsHint = document.getElementById('controls-hint')!;
const seasonPicker = document.getElementById('season-picker')!;
const characterScreen = document.getElementById('character-screen')!;
const characterVehicleName = document.getElementById('character-vehicle-name')!;

const game = new Game();

let hasPlayed = false;

// --- Character viewer ---
const ALL_VEHICLES = ['skis', 'rainbowSkis', 'bobsled', 'snowboard', 'mountainBike', 'motorbike', 'kayak', 'rainbowKayak', 'canoe', 'jetski'] as const;
type VehicleType = typeof ALL_VEHICLES[number];
const VEHICLE_LABELS: Record<VehicleType, string> = {
  skis: 'Skis', rainbowSkis: 'Rainbow Skis', bobsled: 'Bobsled', snowboard: 'Snowboard',
  mountainBike: 'Mountain Bike', motorbike: 'Motorbike', kayak: 'Kayak',
  rainbowKayak: 'Rainbow Kayak', canoe: 'Canoe', jetski: 'Jet Ski',
};
let charViewActive = false;
let charViewIndex = 0;
let charViewScene: THREE.Scene | null = null;
let charViewCamera: THREE.PerspectiveCamera | null = null;
let charViewGroup: THREE.Group | null = null;
let charViewRafId = 0;
let charViewLoaded = false;

function openCharacterViewer() {
  if (!charViewLoaded) return;
  charViewActive = true;
  document.getElementById('start-screen')!.style.display = 'none';
  characterScreen.style.display = 'flex';

  charViewScene = new THREE.Scene();
  charViewScene.background = new THREE.Color(0x1a1a2e);

  charViewCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  charViewCamera.position.set(0, 2.5, 6);
  charViewCamera.lookAt(0, 1.5, 0);

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  charViewScene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(3, 5, 4);
  charViewScene.add(dir);

  charViewGroup = new THREE.Group();
  charViewScene.add(charViewGroup);

  charViewIndex = ALL_VEHICLES.indexOf(game.player.currentVehicle);
  if (charViewIndex < 0) charViewIndex = 0;
  showCharViewVehicle();

  let charViewTime = 0;
  function animate() {
    charViewRafId = requestAnimationFrame(animate);
    charViewTime += 0.016;
    if (charViewGroup) {
      charViewGroup.rotation.y += 0.01;
      // Animate paddle, crank, and pedaling legs
      charViewGroup.traverse((child) => {
        if (child.userData.animPaddle) {
          child.rotation.z = Math.sin(charViewTime * 3) * 0.5;
          child.rotation.x = Math.sin(charViewTime * 6) * 0.15;
        }
        if (child.userData.animCrank) {
          child.rotation.x = charViewTime * 3;
        }
        if (child.userData.animLeg === 'left') {
          child.rotation.x = Math.sin(charViewTime * 3) * 0.6;
        }
        if (child.userData.animLeg === 'right') {
          child.rotation.x = Math.sin(charViewTime * 3 + Math.PI) * 0.6;
        }
      });
    }
    game.renderer.render(charViewScene!, charViewCamera!);
  }
  animate();
}

function showCharViewVehicle() {
  if (!charViewGroup) return;
  while (charViewGroup.children.length) charViewGroup.remove(charViewGroup.children[0]);

  const vehicleType = ALL_VEHICLES[charViewIndex];
  // Build a temporary player to extract the mesh
  const tempGroup = new THREE.Group();
  const tempPlayer = Object.create(game.player);
  tempPlayer.group = tempGroup;
  tempPlayer.currentVehicle = 'skis';
  // Use the real buildVehicle + buildCharacter by calling switchVehicle on a clone
  // Simpler: just use game.player.switchVehicle temporarily
  game.player.group.visible = false;
  game.player.switchVehicle(vehicleType);
  // Clone the player group contents into the viewer
  for (const child of game.player.group.children) {
    charViewGroup.add(child.clone());
  }

  characterVehicleName.textContent = VEHICLE_LABELS[vehicleType];
}

function closeCharacterViewer() {
  charViewActive = false;
  cancelAnimationFrame(charViewRafId);
  characterScreen.style.display = 'none';
  document.getElementById('start-screen')!.style.display = 'flex';
  game.player.group.visible = true;
  charViewScene = null;
  charViewCamera = null;
  charViewGroup = null;
}

function startWithSeason(season: Season) {
  document.getElementById('start-screen')!.style.display = 'none';
  document.getElementById('game-over-screen')!.style.display = 'none';
  document.getElementById('pause-screen')!.style.display = 'none';
  game.seasonManager.setStartSeason(season);
  if (hasPlayed) {
    game.restart();
  } else {
    game.start();
    hasPlayed = true;
  }
}

game.load((pct) => {
  loadingText.textContent = `Loading... ${Math.round(pct)}%`;
  loadingBar.style.width = `${pct}%`;
}).then(() => {
  loadingText.style.display = 'none';
  loadingBarBg.style.display = 'none';
  seasonPicker.style.display = '';
  controlsHint.style.display = '';
  charViewLoaded = true;
  updateSeasonHighlight();
});

// Season buttons start the game directly
const seasonBtns = Array.from(document.querySelectorAll('.season-btn')) as HTMLElement[];
let selectedSeasonIndex = 0;

function updateSeasonHighlight() {
  for (let i = 0; i < seasonBtns.length; i++) {
    seasonBtns[i].style.borderColor = i === selectedSeasonIndex ? '#fff' : 'rgba(255,255,255,0.3)';
    seasonBtns[i].style.transform = i === selectedSeasonIndex ? 'scale(1.08)' : '';
  }
}

for (const btn of seasonBtns) {
  btn.addEventListener('click', () => {
    const season = btn.dataset.season as Season;
    startWithSeason(season);
  });
}

document.getElementById('restart-btn')!.addEventListener('click', () => {
  document.getElementById('game-over-screen')!.style.display = 'none';
  document.getElementById('start-screen')!.style.display = 'flex';
  seasonPicker.style.display = '';
  controlsHint.style.display = '';
});

// Pause menu, screenshot, and character viewer
window.addEventListener('keydown', (e) => {
  // Character viewer controls
  if (charViewActive) {
    if (e.key === 'Escape') {
      closeCharacterViewer();
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      charViewIndex = (charViewIndex + 1) % ALL_VEHICLES.length;
      showCharViewVehicle();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      charViewIndex = (charViewIndex - 1 + ALL_VEHICLES.length) % ALL_VEHICLES.length;
      showCharViewVehicle();
      return;
    }
    return;
  }

  // Season picker keyboard navigation
  const startScreenVisible = document.getElementById('start-screen')!.style.display !== 'none';
  const seasonPickerVisible = seasonPicker.style.display !== 'none';
  if (startScreenVisible && seasonPickerVisible) {
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      selectedSeasonIndex = (selectedSeasonIndex + 1) % seasonBtns.length;
      updateSeasonHighlight();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      selectedSeasonIndex = (selectedSeasonIndex - 1 + seasonBtns.length) % seasonBtns.length;
      updateSeasonHighlight();
      return;
    }
    if (e.key === 'Enter') {
      const season = seasonBtns[selectedSeasonIndex].dataset.season as Season;
      startWithSeason(season);
      return;
    }
  }

  // Open character viewer from start screen
  if ((e.key === 'c' || e.key === 'C') && startScreenVisible) {
    openCharacterViewer();
    return;
  }

  if (e.key === 'Escape' && game.running) {
    game.pause();
  }
  if (e.key === 'p' || e.key === 'P') {
    // Render one frame to ensure canvas has content, then save
    game.renderer.render(game.scene, game.camera);
    const dataUrl = game.renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `nanas-run-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }
});

document.getElementById('continue-btn')!.addEventListener('click', () => {
  game.resume();
});

document.getElementById('pause-restart-btn')!.addEventListener('click', () => {
  document.getElementById('pause-screen')!.style.display = 'none';
  document.getElementById('start-screen')!.style.display = 'flex';
  seasonPicker.style.display = '';
});
