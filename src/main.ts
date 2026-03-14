import { Game } from './Game';

const game = new Game();

document.getElementById('start-btn')!.addEventListener('click', () => {
  document.getElementById('start-screen')!.style.display = 'none';
  game.start();
});

document.getElementById('restart-btn')!.addEventListener('click', () => {
  document.getElementById('game-over-screen')!.style.display = 'none';
  game.restart();
});
