export interface PlayerInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  duck: boolean;
}

export class InputManager {
  private pending: PlayerInput = { left: false, right: false, jump: false, duck: false };
  private touchStartX = 0;
  private touchStartY = 0;

  constructor() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));

    // Touch/swipe support
    window.addEventListener('touchstart', (e) => {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - this.touchStartX;
      const dy = e.changedTouches[0].clientY - this.touchStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const threshold = 30;

      if (absDx > absDy && absDx > threshold) {
        if (dx > 0) this.pending.right = true;
        else this.pending.left = true;
      } else if (absDy > threshold) {
        if (dy < 0) this.pending.jump = true;
        else this.pending.duck = true;
      }
    }, { passive: true });
  }

  private onKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A':
        this.pending.left = true; break;
      case 'ArrowRight': case 'd': case 'D':
        this.pending.right = true; break;
      case 'ArrowUp': case 'w': case 'W': case ' ':
        this.pending.jump = true; break;
      case 'ArrowDown': case 's': case 'S':
        this.pending.duck = true; break;
    }
  }

  consume(): PlayerInput {
    const result = { ...this.pending };
    this.pending = { left: false, right: false, jump: false, duck: false };
    return result;
  }
}
