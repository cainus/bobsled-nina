interface FloatingTextOptions {
  text: string;
  color: string;
  top?: string;
  targetTop?: string;
  fontSize?: string;
  durationMs?: number;
}

export class Hud {
  private readonly score = document.getElementById('score')!;
  private readonly coins = document.getElementById('coins-display')!;
  private readonly pauseScreen = document.getElementById('pause-screen')!;
  private readonly gameOverScreen = document.getElementById('game-over-screen')!;
  private readonly finalScore = document.getElementById('final-score')!;
  private readonly finalCoins = document.getElementById('final-coins')!;
  private readonly shieldDisplay = document.getElementById('shield-display')!;
  private readonly metalDisplay = document.getElementById('metal-display')!;
  private readonly overlay = document.getElementById('ui-overlay')!;
  private readonly body = document.body;

  updateScore(score: number) {
    this.score.textContent = score.toString();
  }

  updateCoins(coins: number) {
    this.coins.textContent = `Snowflakes: ${coins}`;
  }

  showPause() {
    this.pauseScreen.style.display = 'flex';
  }

  hidePause() {
    this.pauseScreen.style.display = 'none';
  }

  showGameOver(score: number, coins: number) {
    this.gameOverScreen.style.display = 'flex';
    this.finalScore.textContent = score.toString();
    this.finalCoins.textContent = `Snowflakes: ${coins}`;
  }

  setPrimaryStatus(text: string) {
    this.shieldDisplay.style.display = 'block';
    this.shieldDisplay.textContent = text;
  }

  hidePrimaryStatus() {
    this.shieldDisplay.style.display = 'none';
  }

  showMetalStatus() {
    this.metalDisplay.style.display = 'block';
  }

  hideMetalStatus() {
    this.metalDisplay.style.display = 'none';
  }

  resetTransientStatus() {
    this.hidePrimaryStatus();
    this.hideMetalStatus();
  }

  showFloatingText({
    text,
    color,
    top = '45%',
    targetTop = '35%',
    fontSize = '32px',
    durationMs = 600,
  }: FloatingTextOptions) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `position:absolute;top:${top};left:50%;transform:translate(-50%,-50%);color:${color};font-size:${fontSize};font-weight:bold;text-shadow:2px 2px 4px rgba(0,0,0,0.7);pointer-events:none;transition:all 0.6s ease-out;opacity:1;`;
    this.overlay.appendChild(el);
    requestAnimationFrame(() => {
      el.style.top = targetTop;
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), durationMs);
  }

  createCameraDrop(size: number, xPercent: number, yPercent: number): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed;
      left: ${xPercent}%;
      top: ${yPercent}%;
      width: ${size}px;
      height: ${size * 1.3}px;
      border-radius: 50%;
      background: radial-gradient(ellipse, rgba(180,200,220,0.3) 0%, rgba(180,200,220,0.1) 40%, transparent 70%);
      pointer-events: none;
      z-index: 10;
    `;
    this.body.appendChild(el);
    return el;
  }
}
