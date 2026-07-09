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

export function playShot()     { tone(640, 0.07, 'square', 0.03); }
export function playHit()      { tone(180, 0.16, 'sawtooth', 0.05); }
export function playScore()    { tone(880, 0.08, 'triangle', 0.04); }
export function playGameOver() { tone(120, 0.4, 'sawtooth', 0.06); }
export function playMove()     { tone(420, 0.05, 'triangle', 0.025); }
export function playAutoToggle() { tone(520, 0.06, 'triangle', 0.03); }
export function playCardReady() {
  tone(740, 0.12, 'triangle', 0.04);
  setTimeout(() => tone(980, 0.18, 'triangle', 0.04), 120);
}

export function playAbility(type: string) {
  switch (type) {
    case 'shotgun':   tone(420, 0.08, 'square', 0.05); setTimeout(() => tone(320, 0.08, 'square', 0.04), 60); break;
    case 'heal':      tone(660, 0.12, 'triangle', 0.04); setTimeout(() => tone(880, 0.18, 'triangle', 0.04), 100); break;
    case 'time':      tone(300, 0.1, 'sine', 0.04); setTimeout(() => tone(240, 0.18, 'sine', 0.035), 90); break;
    case 'pierce':    tone(540, 0.08, 'square', 0.045); break;
    case 'bomb':      tone(220, 0.12, 'sawtooth', 0.05); break;
    case 'shield':    tone(760, 0.12, 'triangle', 0.04); break;
    case 'overclock': tone(900, 0.08, 'square', 0.04); setTimeout(() => tone(1080, 0.12, 'square', 0.035), 70); break;
    case 'mirror':    tone(500, 0.09, 'triangle', 0.04); break;
    case 'scramble':  tone(260, 0.1, 'sine', 0.045); break;
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
