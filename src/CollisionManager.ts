import * as THREE from 'three';
import type { Game } from './Game';

export class CollisionManager {
  game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  checkCollisions() {
    const playerBox = this.game.player.getCollisionBox();

    // Check obstacles
    for (const obstacle of this.game.obstacleManager.obstacles) {
      if (!obstacle.active) continue;
      obstacle.mesh.updateMatrixWorld(true);
      const colliderObj = obstacle.collider ?? obstacle.mesh;
      const obstacleBox = new THREE.Box3().setFromObject(colliderObj);
      obstacleBox.expandByScalar(-0.15);
      if (playerBox.intersectsBox(obstacleBox)) {
        if (obstacle.isBonus) {
          // Leaf piles give bonus points
          obstacle.active = false;
          this.game.scene.remove(obstacle.mesh);
          this.game.score += 100;
          this.game.particleManager.spawnCollectBurst(obstacle.mesh.position);
          this.game.soundManager.playCollect();
          this.showBonus('+100', '#ff8800');
          continue;
        }
        const result = this.game.powerupManager.handleObstacleHit(obstacle);
        if (result === 'endGame') {
          this.game.endGame();
          return;
        }
        continue;
      }

      // Jump bonus
      if (this.game.player.isJumping && !obstacle.jumpScored) {
        const obsZ = obstacle.mesh.position.z;
        const playerX = this.game.player.group.position.x;
        const obsX = obstacle.mesh.position.x;
        if (Math.abs(obsX - playerX) < this.game.laneWidth * 0.7 &&
            obsZ < 1 && obsZ > -3) {
          obstacle.jumpScored = true;
          this.game.score += 50;
          this.showJumpBonus();
        }
      }
    }

    // Check snowflake collectibles
    for (const coin of this.game.coinManager.coins) {
      if (!coin.active) continue;
      const coinBox = new THREE.Box3().setFromObject(coin.mesh);
      if (playerBox.intersectsBox(coinBox)) {
        coin.active = false;
        this.game.scene.remove(coin.mesh);
        this.game.coins++;
        this.game.particleManager.spawnCollectBurst(coin.mesh.position);
        this.game.soundManager.playCollect();
      }
    }
  }

  private showBonus(text: string, color: string) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);color:${color};font-size:36px;font-weight:bold;text-shadow:2px 2px 4px rgba(0,0,0,0.7);pointer-events:none;transition:all 0.6s ease-out;opacity:1;`;
    document.getElementById('ui-overlay')!.appendChild(el);
    requestAnimationFrame(() => {
      el.style.top = '30%';
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 700);
  }

  private showJumpBonus() {
    const el = document.createElement('div');
    el.textContent = '+50';
    el.style.cssText = 'position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);color:#ffd700;font-size:36px;font-weight:bold;text-shadow:2px 2px 4px rgba(0,0,0,0.7);pointer-events:none;transition:all 0.6s ease-out;opacity:1;';
    document.getElementById('ui-overlay')!.appendChild(el);
    requestAnimationFrame(() => {
      el.style.top = '30%';
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 700);
  }
}
