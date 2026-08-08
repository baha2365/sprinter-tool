import { useCallback, useRef, useState } from 'react';

/**
 * Handles all race audio: spoken starter commands and the starting-gun
 * sound. If a real gunshot recording is loaded (see `loadGunSound`), it's
 * played through Web Audio for precise timing and volume control. If none
 * is loaded — or it fails to load — a synthesized crack is used instead,
 * so the app always works out of the box. The AudioContext is created/
 * resumed lazily and must be triggered from a user gesture (handled by
 * callers invoking `ensureContext` first).
 */
export function useRaceAudio() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Default above 1.0: the shared limiter below keeps this from clipping
  // harshly, which is what actually makes it sound louder outdoors rather
  // than just distorted.
  const [volume, setVolume] = useState(1.15);

  const gunBufferRef = useRef<AudioBuffer | null>(null);
  const gunLoadPromiseRef = useRef<Promise<void> | null>(null);

  const ensureContext = useCallback((): AudioContext | null => {
    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtor();
    }
    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  /**
   * Fetches and decodes a real gunshot recording so `playGunshot` uses it
   * instead of the synthesized fallback. Safe to call before any user
   * gesture (fetching/decoding doesn't require an active AudioContext) —
   * call it once on app load so the file is ready by race time. Silently
   * falls back to the synthesized sound if the file is missing or fails
   * to decode.
   */
  const loadGunSound = useCallback(
    (url: string) => {
      if (gunBufferRef.current || gunLoadPromiseRef.current) {
        return gunLoadPromiseRef.current ?? Promise.resolve();
      }
      const ctx = ensureContext();
      if (!ctx) return Promise.resolve();

      gunLoadPromiseRef.current = fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`Gunshot file not found at ${url} (${res.status})`);
          return res.arrayBuffer();
        })
        .then((arrayBuffer) => ctx.decodeAudioData(arrayBuffer))
        .then((buffer) => {
          gunBufferRef.current = buffer;
        })
        .catch((err) => {
          console.warn('No custom gunshot sound loaded, using the built-in one instead:', err);
        });

      return gunLoadPromiseRef.current;
    },
    [ensureContext]
  );

  const speak = useCallback(
    (text: string, rate = 1) => {
      return new Promise<void>((resolve) => {
        if (!('speechSynthesis' in window)) {
          resolve();
          return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate;
        utterance.pitch = 1;
        utterance.volume = Math.min(1, volume);
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      });
    },
    [volume]
  );

  const playGunshot = useCallback(() => {
    const ctx = ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Shared output stage for whichever source plays below: applies the
    // overall volume, then a limiter so pushing volume past 1.0 makes it
    // louder rather than harshly distorted.
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, now);
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-10, now);
    limiter.knee.setValueAtTime(8, now);
    limiter.ratio.setValueAtTime(10, now);
    limiter.attack.setValueAtTime(0.001, now);
    limiter.release.setValueAtTime(0.15, now);
    masterGain.connect(limiter).connect(ctx.destination);

    if (gunBufferRef.current) {
      const source = ctx.createBufferSource();
      source.buffer = gunBufferRef.current;
      source.connect(masterGain);
      source.start(now);
      return;
    }

    // Fallback: synthesized noise-burst gunshot, used until a real
    // recording is loaded. Each source gets its own envelope (1 -> ~0)
    // shaping the crack/thump shape; overall loudness comes from
    // masterGain above.
    const duration = 0.35;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const decay = Math.exp(-i / (bufferSize * 0.1));
      data[i] = (Math.random() * 2 - 1) * decay;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1800;
    bandpass.Q.value = 0.5;

    const noiseEnvelope = ctx.createGain();
    noiseEnvelope.gain.setValueAtTime(1, now);
    noiseEnvelope.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(bandpass).connect(noiseEnvelope).connect(masterGain);

    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(150, now);
    thump.frequency.exponentialRampToValueAtTime(40, now + 0.2);
    const thumpEnvelope = ctx.createGain();
    thumpEnvelope.gain.setValueAtTime(1, now);
    thumpEnvelope.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    thump.connect(thumpEnvelope).connect(masterGain);

    noise.start(now);
    noise.stop(now + duration);
    thump.start(now);
    thump.stop(now + 0.22);
  }, [ensureContext, volume]);

  const testSound = useCallback(async () => {
    ensureContext();
    await speak('Testing audio.');
    playGunshot();
  }, [ensureContext, speak, playGunshot]);

  return { volume, setVolume, ensureContext, loadGunSound, speak, playGunshot, testSound };
}