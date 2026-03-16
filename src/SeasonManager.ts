export type Season = 'winter' | 'spring' | 'summer' | 'autumn';
export type TimeOfDay = 'morning' | 'sunset' | 'night';

const PHASE_DURATION = 2000; // points per time-of-day phase
const PHASES_PER_DAY = 3; // morning, sunset, night
const DAYS_PER_SEASON = 2;
const SEASON_DURATION = PHASE_DURATION * PHASES_PER_DAY * DAYS_PER_SEASON; // 12000
const SEASONS: Season[] = ['winter', 'spring', 'summer', 'autumn'];
const TIMES: TimeOfDay[] = ['morning', 'sunset', 'night'];

export interface SeasonConfig {
  skyColor: number;
  fogColor: number;
  groundColor: number;
  laneColors: number[];
  wallColor: number;
  ambientIntensity: number;
  sunIntensity: number;
  sunColor: number;
  showStars: boolean;
  showSnow: boolean;
}

const CONFIGS: Record<Season, Record<TimeOfDay, SeasonConfig>> = {
  winter: {
    morning: {
      skyColor: 0x87ceeb, fogColor: 0x87ceeb, groundColor: 0xf0f0f0,
      laneColors: [0xf2f7fb, 0xf8fbfd, 0xf2f7fb], wallColor: 0xeeeeee,
      ambientIntensity: 0.6, sunIntensity: 1.0, sunColor: 0xffffff,
      showStars: false, showSnow: true,
    },
    sunset: {
      skyColor: 0xf4845f, fogColor: 0xe8a087, groundColor: 0xeedddd,
      laneColors: [0xf5ede8, 0xfaf2ee, 0xf5ede8], wallColor: 0xeedddd,
      ambientIntensity: 0.45, sunIntensity: 0.8, sunColor: 0xff9955,
      showStars: false, showSnow: true,
    },
    night: {
      skyColor: 0x0a1628, fogColor: 0x0a1628, groundColor: 0xaabbcc,
      laneColors: [0xc0cdd8, 0xc8d5e0, 0xc0cdd8], wallColor: 0xaabbcc,
      ambientIntensity: 0.25, sunIntensity: 0.3, sunColor: 0x8888cc,
      showStars: true, showSnow: false,
    },
  },
  spring: {
    morning: {
      skyColor: 0x7ec8e3, fogColor: 0x7ec8e3, groundColor: 0x5a9a4a,
      laneColors: [0x3388bb, 0x4499cc, 0x3388bb], wallColor: 0x887766,
      ambientIntensity: 0.65, sunIntensity: 1.0, sunColor: 0xffffff,
      showStars: false, showSnow: false,
    },
    sunset: {
      skyColor: 0xee8855, fogColor: 0xd8946a, groundColor: 0x4a7a3a,
      laneColors: [0x2a7099, 0x3388aa, 0x2a7099], wallColor: 0x776655,
      ambientIntensity: 0.45, sunIntensity: 0.8, sunColor: 0xff9944,
      showStars: false, showSnow: false,
    },
    night: {
      skyColor: 0x0a1830, fogColor: 0x0a1830, groundColor: 0x3a5a3a,
      laneColors: [0x1a4466, 0x225577, 0x1a4466], wallColor: 0x554433,
      ambientIntensity: 0.25, sunIntensity: 0.3, sunColor: 0x8888cc,
      showStars: true, showSnow: false,
    },
  },
  summer: {
    morning: {
      skyColor: 0x4fc3f7, fogColor: 0x4fc3f7, groundColor: 0xf5deb3,
      laneColors: [0x1188cc, 0x22aadd, 0x1188cc], wallColor: 0xccaa77,
      ambientIntensity: 0.7, sunIntensity: 1.2, sunColor: 0xfffff0,
      showStars: false, showSnow: false,
    },
    sunset: {
      skyColor: 0xff8a65, fogColor: 0xf4a87c, groundColor: 0xe8c89a,
      laneColors: [0x0e6699, 0x1a88bb, 0x0e6699], wallColor: 0xd4b080,
      ambientIntensity: 0.5, sunIntensity: 0.9, sunColor: 0xff7733,
      showStars: false, showSnow: false,
    },
    night: {
      skyColor: 0x0c1445, fogColor: 0x0c1445, groundColor: 0x9aa8b8,
      laneColors: [0x0a3355, 0x104466, 0x0a3355], wallColor: 0x9aa0a8,
      ambientIntensity: 0.35, sunIntensity: 0.5, sunColor: 0xccccff,
      showStars: true, showSnow: false,
    },
  },
  autumn: {
    morning: {
      skyColor: 0x8ec8e8, fogColor: 0x8ec8e8, groundColor: 0x8B7355,
      laneColors: [0xa09070, 0xa89878, 0xa09070], wallColor: 0x9a8a6a,
      ambientIntensity: 0.55, sunIntensity: 0.9, sunColor: 0xfff8e0,
      showStars: false, showSnow: false,
    },
    sunset: {
      skyColor: 0xe65100, fogColor: 0xd4793a, groundColor: 0x7a6040,
      laneColors: [0x8a7050, 0x907858, 0x8a7050], wallColor: 0x806848,
      ambientIntensity: 0.4, sunIntensity: 0.7, sunColor: 0xff6600,
      showStars: false, showSnow: false,
    },
    night: {
      skyColor: 0x1a1030, fogColor: 0x1a1030, groundColor: 0x6a6a78,
      laneColors: [0x807060, 0x887868, 0x807060], wallColor: 0x706858,
      ambientIntensity: 0.25, sunIntensity: 0.35, sunColor: 0x9999cc,
      showStars: true, showSnow: false,
    },
  },
};

export class SeasonManager {
  season: Season = 'winter';
  timeOfDay: TimeOfDay = 'morning';
  private scoreOffset = 0;

  setStartSeason(season: Season) {
    const index = SEASONS.indexOf(season);
    this.scoreOffset = index * SEASON_DURATION;
    this.season = season;
    this.timeOfDay = 'morning';
  }

  update(score: number) {
    const adjusted = score + this.scoreOffset;
    const cycleScore = adjusted % (SEASON_DURATION * SEASONS.length);
    const seasonIndex = Math.floor(cycleScore / SEASON_DURATION);
    this.season = SEASONS[seasonIndex % SEASONS.length];

    const withinSeason = cycleScore % SEASON_DURATION;
    const phaseIndex = Math.floor(withinSeason / PHASE_DURATION) % PHASES_PER_DAY;
    this.timeOfDay = TIMES[phaseIndex];
  }

  getConfig(): SeasonConfig {
    return CONFIGS[this.season][this.timeOfDay];
  }

  getPhaseProgress(score: number): number {
    return (score % PHASE_DURATION) / PHASE_DURATION;
  }
}
