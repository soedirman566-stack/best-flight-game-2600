// audio.js — every sound in Kestrel Ridge is synthesised with WebAudio:
// an engine whose note follows the throttle, wind that follows the airspeed,
// and small bright bleeps for rings, drops, warnings and touchdowns.
// No audio files, nothing downloaded. Sound starts on the first gesture,
// as browsers require, and M mutes it.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let windGain = null;
  let muted = false;
  let stallBeepAt = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    // Engine: two detuned saws through a low-pass, gain kept low.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    const sub = ctx.createOscillator();
    sub.type = 'square';
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    engineOsc.connect(engineFilter);
    sub.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.frequency.value = 62;
    sub.frequency.value = 31;
    engineOsc.start();
    sub.start();
    engineOsc._sub = sub;

    // Wind: looped noise through a band-pass, gain follows airspeed.
    const len = ctx.sampleRate * 1.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 700;
    band.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0.0;
    noise.connect(band);
    band.connect(windGain);
    windGain.connect(ctx.destination);
    noise.start();
    return true;
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  return {
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      if (windGain) windGain.gain.value = 0;
      return muted;
    },
    get muted() { return muted; },
    // Called every frame with the flight state; keeps engine and wind honest.
    update(flight, running) {
      if (!ctx || muted) return;
      const rpm = 0.35 + flight.throttle * 0.9 + flight.speed * 0.004;
      const f = 52 * rpm + 14;
      engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
      engineOsc._sub.frequency.setTargetAtTime(f / 2, ctx.currentTime, 0.08);
      engineFilter.frequency.setTargetAtTime(300 + flight.throttle * 700, ctx.currentTime, 0.1);
      engineGain.gain.setTargetAtTime(running ? 0.028 + flight.throttle * 0.05 : 0, ctx.currentTime, 0.12);
      const wind = Math.max(0, (flight.speed - 22) / 70);
      windGain.gain.setTargetAtTime(running ? wind * wind * 0.16 : 0, ctx.currentTime, 0.15);
    },
    ring() { tone(880, 0.16, 'sine', 0.16); tone(1318, 0.22, 'sine', 0.14, 0.07); },
    clip() { tone(196, 0.2, 'square', 0.1); },
    drop() { tone(320, 0.18, 'triangle', 0.18, 0, 90); },
    goodDrop() { tone(659, 0.12, 'sine', 0.15); tone(784, 0.12, 'sine', 0.15, 0.09); tone(1046, 0.2, 'sine', 0.15, 0.18); },
    poorDrop() { tone(233, 0.25, 'triangle', 0.12); },
    gear() { tone(440, 0.07, 'square', 0.06); tone(440, 0.07, 'square', 0.06, 0.11); },
    touchdown() { tone(140, 0.3, 'sine', 0.2, 0, 60); tone(523, 0.14, 'sine', 0.1, 0.05); },
    crash() {
      tone(90, 0.7, 'sawtooth', 0.22, 0, 34);
      tone(55, 0.9, 'square', 0.16, 0.05, 28);
    },
    stallWarn(now) {
      if (!ctx || muted) return;
      if (now - stallBeepAt > 420) {
        stallBeepAt = now;
        tone(1174, 0.09, 'square', 0.07);
      }
    },
  };
}
