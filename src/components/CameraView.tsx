import { useEffect, useRef, type RefObject } from 'react';
import type { TrackPoint } from '../hooks/usePoseDetection';

interface CameraViewProps {
  videoRef: RefObject<HTMLVideoElement>;
  trackPoint: TrackPoint | null;
  cameraReady: boolean;
}

export function CameraView({ videoRef, trackPoint, cameraReady }: CameraViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draws the live tracking dot in its own rAF loop, decoupled from React
  // render cycles, so it stays perfectly in sync with the video frame.
  useEffect(() => {
    let raf: number;
    function draw() {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas && video && video.videoWidth) {
        if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (trackPoint) {
            ctx.beginPath();
            ctx.arc(trackPoint.x, trackPoint.y, 12, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(43, 217, 124, ${Math.min(1, trackPoint.confidence + 0.25)})`;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(245, 243, 238, 0.8)';
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [videoRef, trackPoint]);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-3xl bg-graphite-900 border border-steel/15">
      <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Timing-strip ticks along the top and bottom edges */}
      <div className="pointer-events-none absolute top-0 inset-x-0 h-3 ticks-bar opacity-70" />
      <div className="pointer-events-none absolute bottom-0 inset-x-0 h-3 ticks-bar opacity-70" />

      {/* Vertical finish-line beam, dead center */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-px flex flex-col items-center">
        <div className="w-[3px] h-full bg-gradient-to-b from-track/0 via-track to-track/0 shadow-[0_0_18px_rgba(255,74,46,0.65)]" />
      </div>

      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] font-body font-semibold tracking-[0.25em] text-track uppercase bg-graphite-950/70 border border-track/30 px-3 py-1 rounded-full">
        Finish Line
      </div>

      {!cameraReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-graphite-950/85 text-steel text-sm font-body px-6 text-center">
          Camera preview will appear here once access is granted.
        </div>
      )}
    </div>
  );
}
