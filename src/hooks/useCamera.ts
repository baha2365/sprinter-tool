import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'error';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setError('This browser does not support camera access.');
      return;
    }

    setStatus('requesting');
    setError(null);
    try {
      // Prefer the rear/environment camera — the device is placed facing
      // across the finish line, not held up to the athlete's own face.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          // Lower than "full HD" on purpose: every frame has to be
          // preprocessed before the pose model can run on it, and a
          // smaller frame means more inferences per second — which is
          // what actually determines whether a fast sprinter gets caught.
          // Raise this if your device handles the model comfortably and
          // you want a sharper preview.
          width: { ideal: 960 },
          height: { ideal: 540 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {
          // Some browsers require a subsequent user gesture to actually
          // start playback even after getUserMedia succeeds; ignore here,
          // the <video> element will still start once autoplay resolves.
        });
      }
      setStatus('granted');
    } catch (err) {
      console.error('Camera access failed', err);
      setStatus('denied');
      setError(
        err instanceof Error
          ? err.message
          : 'Camera permission was denied or no camera is available.'
      );
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { videoRef, status, error, start, stop };
}