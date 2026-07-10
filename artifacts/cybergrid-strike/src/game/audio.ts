let audioCtx: AudioContext | null = null;
let muted = false;
let musicInterval: ReturnType<typeof setInterval> | null = null;

export function setMuted(val: boolean) {
  muted = val;
  if (muted && audioCtx) audioCtx.suspend();
  else if (!muted) ensureAudio();
}

export function ensureAudio(): AudioContext | null {
  if (muted) return null;
  if (!audioCtx) {
    const AC = (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext ||
               (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(freq: number, duration: number, type: OscillatorType, volume: number) {
  const ac = ensureAudio();
  if (!ac) return;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export function playShot()       { tone(640, 0.07, 'square', 0.03); }
export function playHit()        { tone(180, 0.16, 'sawtooth', 0.05); }
export function playScore()      { tone(880, 0.08, 'triangle', 0.04); }
export function playGameOver()   { tone(120, 0.4, 'sawtooth', 0.06); }
export function playMove()       { tone(420, 0.05, 'triangle', 0.025); }
export function playAutoToggle() { tone(520, 0.06, 'triangle', 0.03); }
export function playCardReady()  {
  tone(740, 0.12, 'triangle', 0.04);
  setTimeout(() => tone(980, 0.18, 'triangle', 0.04), 120);
}

export function playAbility(type: string) {
  switch (type) {
    // ── Existing ──────────────────────────────────────────────────────────────
    case 'shotgun':
      tone(420, 0.08, 'square', 0.05);
      setTimeout(() => tone(320, 0.08, 'square', 0.04), 60);
      break;
    case 'heal':
      tone(660, 0.12, 'triangle', 0.04);
      setTimeout(() => tone(880, 0.18, 'triangle', 0.04), 100);
      break;
    case 'time':
      tone(300, 0.10, 'sine', 0.04);
      setTimeout(() => tone(240, 0.18, 'sine', 0.035), 90);
      break;
    case 'pierce':
      tone(540, 0.08, 'square', 0.045);
      break;
    case 'bomb':
      tone(220, 0.12, 'sawtooth', 0.05);
      break;
    case 'shield':
      tone(760, 0.12, 'triangle', 0.04);
      break;
    case 'overclock':
      tone(900, 0.08, 'square', 0.04);
      setTimeout(() => tone(1080, 0.12, 'square', 0.035), 70);
      break;
    case 'mirror':
      tone(500, 0.09, 'triangle', 0.04);
      break;
    case 'scramble':
      tone(260, 0.10, 'sine', 0.045);
      break;

    // ── Instant / no new state ─────────────────────────────────────────────────
    case 'nuke':
      tone(160, 0.18, 'sawtooth', 0.07);
      setTimeout(() => tone(100, 0.35, 'sawtooth', 0.065), 160);
      break;
    case 'barrage':
      for (let i = 0; i < 4; i++) setTimeout(() => tone(540, 0.06, 'square', 0.035), i * 50);
      break;
    case 'warpback':
      tone(440, 0.08, 'sine', 0.04);
      setTimeout(() => tone(620, 0.14, 'sine', 0.04), 80);
      break;
    case 'purge':
      tone(700, 0.10, 'triangle', 0.04);
      setTimeout(() => tone(840, 0.12, 'triangle', 0.035), 80);
      break;
    case 'armor':
      tone(800, 0.10, 'triangle', 0.05);
      setTimeout(() => tone(1000, 0.16, 'triangle', 0.04), 90);
      break;
    case 'surge':
      tone(480, 0.07, 'square', 0.04);
      setTimeout(() => tone(560, 0.07, 'square', 0.035), 65);
      setTimeout(() => tone(640, 0.07, 'square', 0.03), 130);
      break;
    case 'backdash':
      tone(320, 0.08, 'sine', 0.04);
      setTimeout(() => tone(260, 0.12, 'sine', 0.035), 80);
      break;
    case 'megabomb':
      tone(180, 0.20, 'sawtooth', 0.08);
      setTimeout(() => tone(130, 0.30, 'sawtooth', 0.07), 180);
      setTimeout(() => tone(90,  0.40, 'sawtooth', 0.055), 380);
      break;
    case 'cardflood':
      tone(850, 0.10, 'triangle', 0.04);
      setTimeout(() => tone(1100, 0.20, 'triangle', 0.04), 100);
      break;

    // ── Timer-based ────────────────────────────────────────────────────────────
    case 'freeze':
      tone(280, 0.15, 'sine', 0.04);
      setTimeout(() => tone(220, 0.22, 'sine', 0.035), 130);
      break;
    case 'blizzard':
      tone(260, 0.12, 'sine', 0.04);
      setTimeout(() => tone(200, 0.18, 'sine', 0.035), 110);
      setTimeout(() => tone(150, 0.28, 'sine', 0.030), 230);
      break;
    case 'double':
      tone(720, 0.08, 'square', 0.04);
      setTimeout(() => tone(960, 0.12, 'square', 0.035), 70);
      break;
    case 'multishot':
      tone(550, 0.06, 'square', 0.04);
      setTimeout(() => tone(650, 0.06, 'square', 0.04), 55);
      break;
    case 'regen':
      tone(620, 0.14, 'triangle', 0.04);
      setTimeout(() => tone(740, 0.20, 'triangle', 0.04), 120);
      break;
    case 'drain':
      tone(400, 0.10, 'sine', 0.04);
      setTimeout(() => tone(320, 0.16, 'sine', 0.035), 90);
      break;
    case 'voltage':
      tone(980, 0.08, 'square', 0.05);
      setTimeout(() => tone(1200, 0.12, 'square', 0.04), 65);
      break;
  }
}

function playMusicPulse(running: boolean) {
  if (muted || !running) return;
  tone(220, 0.18, 'triangle', 0.015);
  setTimeout(() => { if (!muted && running) tone(330, 0.18, 'triangle', 0.012); }, 180);
}

export function startMusic(isRunning: () => boolean) {
  if (musicInterval) clearInterval(musicInterval);
  musicInterval = setInterval(() => playMusicPulse(isRunning()), 720);
}

export function stopMusic() {
  if (musicInterval) clearInterval(musicInterval);
  musicInterval = null;
}
