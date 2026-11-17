type SfxKind = "tap" | "enter" | "coin" | "level";

let ctx: AudioContext | null = null;
let muted = true;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (muted) return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function beep(
  freq: number,
  durationMs: number,
  type: OscillatorType = "sine",
  gain = 0.04,
  when = 0,
) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000 + 0.02);
}

export function setOfficeSfxMuted(next: boolean) {
  muted = next;
  if (next && ctx) void ctx.suspend();
}

export function getOfficeSfxMuted() {
  return muted;
}

export function playOfficeSfx(kind: SfxKind) {
  if (muted) return;
  switch (kind) {
    case "tap":
      beep(660, 60, "triangle", 0.03);
      break;
    case "enter":
      beep(392, 90, "sine", 0.035);
      beep(523, 110, "sine", 0.03, 0.08);
      break;
    case "coin":
      beep(880, 70, "square", 0.025);
      beep(1175, 120, "square", 0.03, 0.07);
      break;
    case "level":
      beep(523, 80, "sine", 0.035);
      beep(659, 90, "sine", 0.035, 0.09);
      beep(784, 140, "sine", 0.04, 0.18);
      break;
    default:
      break;
  }
}
