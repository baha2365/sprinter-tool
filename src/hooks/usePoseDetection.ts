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

// Lowered from a stricter default: fast motion blurs keypoints and drags
// their confidence down, so a high threshold quietly drops the exact
// frames that matter most (the ones right at the line).
const CONFIDENCE_THRESHOLD = 0.35;
// How reactive the tracked x-position is to each new reading. Higher =
// snappier / less lag behind fast motion, lower = smoother but slower to
// respond. 0.35 (the old value) visibly lagged a fast sprinter.
const SMOOTHING = 0.55;
const MIN_BODY_WIDTH_RATIO = 0.04;

// A crossing is confirmed once the tracked point has been continuously on
// the far side of the line for at least this long...
const CONFIRM_WINDOW_MS = 70;
// ...OR, if tracking is lost entirely (motion blur, or the athlete has
// simply left the frame) this long after they first appeared on the far
// side. This is what catches sprinters moving fast enough to blur past or
// exit the camera's view right at the line, before 30fps-style
// frame-counting would ever have caught up.
const LOST_TRACK_GRACE_MS = 300;

/**
 * Loads a MoveNet pose model and continuously scans the video feed for a
 * person, tracking the smoothed horizontal position of their torso. The
 * camera is assumed to be placed at the finish line facing across the
 * track, so "crossing" means the tracked point moving from one side of the
 * frame's vertical center to the other and staying there — confirmed
 * either by a short run of continued detections, or by losing track of
 * them shortly after (which for a sprinter usually means they were moving
 * too fast to keep resolving).
 */
export function usePoseDetection({ videoRef, onCrossing, active }: UsePoseDetectionOptions) {
  const [status, setStatus] = useState<DetectorStatus>('idle');
  const [debugPoint, setDebugPoint] = useState<TrackPoint | null>(null);

  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const rafRef = useRef<number | null>(null);

  const smoothedXRef = useRef<number | null>(null);
  const startSideRef = useRef<number | null>(null);
  // Timestamp of the first confident reading on the far side of the line
  // since it was last on the starting side. Doubles as the recorded
  // crossing instant once confirmed, so confirmation delay never gets
  // added to the measured time.
  const farSideEnteredAtRef = useRef<number | null>(null);
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
    farSideEnteredAtRef.current = null;
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
        // The model's own cross-frame smoothing filter trades responsiveness
        // for steadiness — great for a still subject, but it visibly lags
        // behind a sprinter. We do our own lighter-weight smoothing above
        // instead, tuned for speed over silkiness.
        enableSmoothing: false,
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

    function confirmCrossing(timestamp: number) {
      hasCrossedRef.current = true;
      onCrossingRef.current(timestamp);
    }

    /** Handles the case where tracking drops out shortly after reaching the far side. */
    function maybeConfirmFromLostTrack(now: number) {
      if (!activeRef.current || hasCrossedRef.current) return;
      if (farSideEnteredAtRef.current === null) return;
      if (now - farSideEnteredAtRef.current >= LOST_TRACK_GRACE_MS) {
        confirmCrossing(farSideEnteredAtRef.current);
      }
    }

    function evaluatePose(pose: poseDetection.Pose, video: HTMLVideoElement, now: number) {
      const allConfident = pose.keypoints.filter((k) => (k.score ?? 0) >= CONFIDENCE_THRESHOLD);
      const torso = allConfident.filter((k) => TORSO_KEYPOINTS.includes(k.name ?? ''));

      if (torso.length < 2) {
        setDebugPoint(null);
        maybeConfirmFromLostTrack(now);
        return;
      }

      const avgX = torso.reduce((sum, k) => sum + k.x, 0) / torso.length;
      const avgY = torso.reduce((sum, k) => sum + k.y, 0) / torso.length;
      const avgConfidence = torso.reduce((sum, k) => sum + (k.score ?? 0), 0) / torso.length;
      setDebugPoint({ x: avgX, y: avgY, confidence: avgConfidence });

      if (!activeRef.current || hasCrossedRef.current) return;

      // Reject detections too small to plausibly be the sprinter right at
      // the line — filters out distant background people. Doesn't reset
      // any pending far-side state; a single too-small reading shouldn't
      // cancel a real pending crossing.
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
        farSideEnteredAtRef.current = null;
        return;
      }

      if (side !== startSideRef.current) {
        if (farSideEnteredAtRef.current === null) {
          farSideEnteredAtRef.current = now;
        } else if (now - farSideEnteredAtRef.current >= CONFIRM_WINDOW_MS) {
          confirmCrossing(farSideEnteredAtRef.current);
        }
      } else {
        // Back on the starting side — treat any prior far-side reading as
        // noise/jitter and cancel it.
        farSideEnteredAtRef.current = null;
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
          const now = performance.now();
          if (poses[0]) {
            evaluatePose(poses[0], video, now);
          } else {
            setDebugPoint(null);
            maybeConfirmFromLostTrack(now);
          }
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