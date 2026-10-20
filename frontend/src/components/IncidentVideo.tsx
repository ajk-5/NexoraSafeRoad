import { useState } from "react";

export function IncidentVideo({ url, cameraId }: { url: string | null; cameraId: string }) {
  const [unplayable, setUnplayable] = useState(false);

  return (
    <div className="video-panel">
      <div className="video-frame">
        {url === null ? (
          <div className="video-message">The clip is being uploaded…</div>
        ) : unplayable ? (
          // Clips recorded with the mp4v codec (OpenCV's fallback) do not play in browsers.
          <div className="video-message">
            This clip can't be played in the browser.
            <a href={url} download>
              Download the clip
            </a>
          </div>
        ) : (
          <video key={url} src={url} controls muted preload="metadata" onError={() => setUnplayable(true)} />
        )}
      </div>
      <div className="video-caption">Camera {cameraId} · 10-second clip around the detection</div>
    </div>
  );
}
