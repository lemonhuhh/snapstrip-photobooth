/* ===========================================================
   SOUNDS
   All sound effects are synthesized in real time with the Web
   Audio API. This avoids shipping binary audio assets, keeps
   the app tiny, and guarantees sounds work offline immediately
   — no network fetch, no decoding, no missing-file risk.
   =========================================================== */

const Sounds = (() => {
  let ctx = null;
  let enabled = true;

  function init() {
    // AudioContext must be created/resumed from a real user gesture
    // on iOS Safari and Chrome's autoplay policies — callers trigger
    // this from the Start button and other early taps.
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      ctx = new AudioCtx();
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  function setEnabled(value) {
    enabled = value;
  }

  function tone({ freq = 440, duration = 0.12, type = "sine", gain = 0.18, glideTo = null, delay = 0 }) {
    if (!enabled || !ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + duration);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function noiseBurst({ duration = 0.06, gain = 0.35, delay = 0 } = {}) {
    if (!enabled || !ctx) return;
    const t0 = ctx.currentTime + delay;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // decaying white noise
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(amp).connect(ctx.destination);
    src.start(t0);
  }

  /** Camera shutter "click" — a sharp noise burst plus a short low click. */
  function shutter() {
    noiseBurst({ duration: 0.045, gain: 0.4 });
    tone({ freq: 1400, duration: 0.04, type: "square", gain: 0.08, delay: 0.01 });
  }

  /** Short tick for each countdown second. */
  function tick() {
    tone({ freq: 880, duration: 0.08, type: "sine", gain: 0.14 });
  }

  /** Slightly higher/longer tone on the final countdown beat. */
  function tickFinal() {
    tone({ freq: 1320, duration: 0.16, type: "sine", gain: 0.2 });
  }

  /** Soft tap for general UI confirmation (sticker added, etc). */
  function tap() {
    tone({ freq: 600, duration: 0.05, type: "triangle", gain: 0.1 });
  }

  /** Cheerful ascending chime once a strip finishes developing. */
  function success() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      tone({ freq, duration: 0.22, type: "sine", gain: 0.16, delay: i * 0.09 });
    });
  }

  return { init, setEnabled, shutter, tick, tickFinal, tap, success };
})();
