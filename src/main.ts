import { Game } from './Game';
import type { Season } from './SeasonManager';

const loadingText = document.getElementById('loading-text')!;
const loadingBar = document.getElementById('loading-bar')!;
const loadingBarBg = document.getElementById('loading-bar-bg')!;
const controlsHint = document.getElementById('controls-hint')!;
const seasonPicker = document.getElementById('season-picker')!;

const game = new Game();

let hasPlayed = false;

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
});

// Season buttons start the game directly
for (const btn of document.querySelectorAll('.season-btn')) {
  btn.addEventListener('click', () => {
    const season = (btn as HTMLElement).dataset.season as Season;
    startWithSeason(season);
  });
}

document.getElementById('restart-btn')!.addEventListener('click', () => {
  document.getElementById('game-over-screen')!.style.display = 'none';
  document.getElementById('start-screen')!.style.display = 'flex';
  seasonPicker.style.display = '';
  controlsHint.style.display = '';
});

// Pause menu
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && game.running) {
    game.pause();
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
