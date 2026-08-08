import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as poseDetection from '@tensorflow-models/pose-detection';

export type DetectorStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface TrackPoint {
  x: number;
  y: number;
  confidence: number;
}

interface UsePoseDetectionOptions {
  videoRef: RefObject<HTMLVideoElement>;
  /** Called once, with a high-resolution timestamp, the moment a crossing is confirmed. */
  onCrossing: (timestamp: number) => void;
  /** Only evaluate finish-line crossings while true (i.e. during the "running" phase). */
  active: boolean;
}

// Torso keypoints are the most stable signal for "where is the athlete",
// far less noisy frame-to-frame than hands/feet and present even when the
// head is turned or arms are pumping.
const TORSO_KEYPOINTS = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'];

const CONFIDENCE_THRESHOLD = 0.45;
const CROSS_CONFIRM_FRAMES = 3; // consecutive frames past the line before we trust it
const SMOOTHING = 0.35; // exponential smoothing applied to the tracked x position
const MIN_BODY_WIDTH_RATIO = 0.05; // ignore detections too small to be the sprinter up close

/**
 * Loads a MoveNet pose model and continuously scans the video feed for a
 * person, tracking the smoothed horizontal position of their torso. The
 * camera is assumed to be placed at the finish line facing across the
 * track, so "crossing" means the tracked point moving from one side of the
 * frame's vertical center to the other and staying there for a few frames
 * (to reject shadows, wind-blown objects, and other momentary noise).
 */
export function usePoseDetection({ videoRef, onCrossing, active }: UsePoseDetectionOptions) {
  const [status, setStatus] = useState<DetectorStatus>('idle');
  const [debugPoint, setDebugPoint] = useState<TrackPoint | null>(null);

  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const rafRef = useRef<number | null>(null);

  const smoothedXRef = useRef<number | null>(null);
  const startSideRef = useRef<number | null>(null);
  const framesPastLineRef = useRef(0);
  const hasCrossedRef = useRef(false);

  const activeRef = useRef(active);
  const onCrossingRef = useRef(onCrossing);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    onCrossingRef.current = onCrossing;
  }, [onCrossing]);

  const resetCrossingState = useCallback(() => {
    smoothedXRef.current = null;
    startSideRef.current = null;
    framesPastLineRef.current = 0;
    hasCrossedRef.current = false;
  }, []);

  // Reset tracking state at the start (and end) of every race so a
  // detection carried over from setup/preparation can't trigger early.
  useEffect(() => {
    resetCrossingState();
  }, [active, resetCrossingState]);

  const load = useCallback(async () => {
    if (detectorRef.current) {
      setStatus('ready');
      return;
    }
    setStatus('loading');
    try {
      await tf.setBackend('webgl');
      await tf.ready();
      const detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      });
      detectorRef.current = detector;
      setStatus('ready');
    } catch (err) {
      console.error('Failed to load pose detection model', err);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    function evaluatePose(pose: poseDetection.Pose, video: HTMLVideoElement) {
      const allConfident = pose.keypoints.filter((k) => (k.score ?? 0) >= CONFIDENCE_THRESHOLD);
      const torso = allConfident.filter((k) => TORSO_KEYPOINTS.includes(k.name ?? ''));

      if (torso.length < 2) {
        setDebugPoint(null);
        return;
      }

      const avgX = torso.reduce((sum, k) => sum + k.x, 0) / torso.length;
      const avgY = torso.reduce((sum, k) => sum + k.y, 0) / torso.length;
      const avgConfidence = torso.reduce((sum, k) => sum + (k.score ?? 0), 0) / torso.length;
      setDebugPoint({ x: avgX, y: avgY, confidence: avgConfidence });

      if (!activeRef.current || hasCrossedRef.current) return;

      // Reject detections that are too small to plausibly be the sprinter
      // right at the line — helps filter out distant background people.
      const xs = allConfident.map((k) => k.x);
      const bodyWidth = xs.length > 1 ? Math.max(...xs) - Math.min(...xs) : 0;
      const videoWidth = video.videoWidth || 1;
      if (bodyWidth / videoWidth < MIN_BODY_WIDTH_RATIO) return;

      smoothedXRef.current =
        smoothedXRef.current === null
          ? avgX
          : smoothedXRef.current + SMOOTHING * (avgX - smoothedXRef.current);

      const centerX = videoWidth / 2;
      const side = Math.sign(smoothedXRef.current - centerX) || 1;

      if (startSideRef.current === null) {
        // First confident reading during this race — remember which half
        // of the frame the athlete started on, so we know which direction
        // counts as "crossing".
        startSideRef.current = side;
        framesPastLineRef.current = 0;
        return;
      }

      if (side !== startSideRef.current) {
        framesPastLineRef.current += 1;
      } else {
        framesPastLineRef.current = 0;
      }

      if (framesPastLineRef.current >= CROSS_CONFIRM_FRAMES) {
        hasCrossedRef.current = true;
        onCrossingRef.current(performance.now());
      }
    }

    async function loop() {
      if (cancelled) return;
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (video && detector && video.readyState >= 2) {
        try {
          const poses = await detector.estimatePoses(video, {
            maxPoses: 1,
            flipHorizontal: false,
          });
          if (poses[0]) evaluatePose(poses[0], video);
        } catch (err) {
          // Skip this frame; a single failed inference shouldn't stop the loop.
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [videoRef]);

  return { status, load, debugPoint, resetCrossingState };
}
