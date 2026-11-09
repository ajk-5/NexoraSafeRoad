import { useEffect, useRef, useState, type CSSProperties } from "react";

import { formatTime, formatVideoTime } from "../../format";
import { Icon } from "../Icon";
import { Card } from "../ui";

interface Props {
  url: string | null;
  cameraId: string;
  detectedAt: string;
}

type LoadState = "loading" | "ready" | "error";

/** After this long without a clip, it is probably not coming. */
const CLIP_GRACE_MS = 3 * 60_000;

/**
 * The clip the AI recorded around the detection. Controls sit under the picture so they never
 * hide it. It never plays by itself and starts muted.
 */
export function VideoEvidencePlayer({ url, cameraId, detectedAt }: Props) {
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<LoadState>("loading");
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    setLoad("loading");
    setPlaying(false);
    setTime(0);
    setDuration(0);
  }, [url, attempt]);

  // React does not keep the `muted` property in sync after the first render.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted, load]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === playerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const caption = (
    <p className="video-caption">
      Camera <span className="mono">{cameraId}</span> · recorded around the detection at {formatTime(detectedAt)}
      {duration > 0 && ` · ${formatVideoTime(duration)} long`}
    </p>
  );

  if (url === null) {
    // The AI uploads the clip once it has recorded the seconds after the detection.
    const late = Date.now() - Date.parse(detectedAt) > CLIP_GRACE_MS;
    return (
      <Card title="Video evidence" icon="camera" className="video-card">
        <div className="video-frame">
          <div className="video-overlay">
            <Icon name={late ? "videoOff" : "clock"} size="lg" />
            <strong>{late ? "No clip received" : "Clip not uploaded yet"}</strong>
            <span>
              {late
                ? "The AI did not send a clip for this incident. Decide from the AI assessment and location, or check the camera directly."
                : "The AI sends the clip shortly after the detection. It appears here automatically."}
            </span>
          </div>
        </div>
        {caption}
      </Card>
    );
  }

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || load !== "ready") return;
    if (video.paused) void video.play().catch(() => setPlaying(false));
    else video.pause();
  };
  const replay = () => {
    const video = videoRef.current;
    if (!video || load !== "ready") return;
    video.currentTime = 0;
    void video.play().catch(() => setPlaying(false));
  };
  const seek = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setTime(value);
  };
  const toggleFullscreen = () => {
    const player = playerRef.current;
    if (!player) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void player.requestFullscreen?.().catch(() => {});
  };

  return (
    <Card title="Video evidence" icon="camera" className="video-card">
      <div className={`video-player${fullscreen ? " is-fullscreen" : ""}`} ref={playerRef}>
        <div className="video-frame">
          <video
            key={`${url}#${attempt}`}
            ref={videoRef}
            src={url}
            muted
            playsInline
            preload="metadata"
            aria-label={`Clip from camera ${cameraId}`}
            onClick={togglePlay}
            onLoadedMetadata={(event) => {
              setDuration(event.currentTarget.duration);
              setLoad("ready");
            }}
            onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={() => setLoad("error")}
          />
          {load === "loading" && (
            <div className="video-overlay" role="status">
              <span className="spinner" aria-hidden="true" />
              <span>Loading clip…</span>
            </div>
          )}
          {load === "error" && (
            <div className="video-overlay" role="alert">
              <Icon name="videoOff" size="lg" />
              <strong>Video unavailable</strong>
              <span>The clip could not be played in this browser.</span>
              <div className="video-overlay-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAttempt((n) => n + 1)}>
                  <Icon name="refresh" size="sm" />
                  Retry
                </button>
                <a className="btn btn-ghost btn-sm" href={url} download>
                  <Icon name="download" size="sm" />
                  Download clip
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="video-controls" role="group" aria-label="Video controls">
          <button type="button" className="btn btn-primary btn-icon" onClick={togglePlay} disabled={load !== "ready"} aria-label={playing ? "Pause" : "Play"}>
            <Icon name={playing ? "pause" : "play"} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={replay} disabled={load !== "ready"} aria-label="Replay from the start">
            <Icon name="replay" />
          </button>
          <span className="video-time num" aria-hidden="true">
            {formatVideoTime(time)} / {formatVideoTime(duration)}
          </span>
          <input
            className="video-scrubber"
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            onChange={(event) => seek(Number(event.target.value))}
            disabled={load !== "ready"}
            aria-label="Position in the clip"
            aria-valuetext={`${formatVideoTime(time)} of ${formatVideoTime(duration)}`}
            style={{ "--progress": `${duration ? (time / duration) * 100 : 0}%` } as CSSProperties}
          />
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => setMuted((value) => !value)}
            disabled={load !== "ready"}
            aria-label={muted ? "Unmute" : "Mute"}
            aria-pressed={!muted}
          >
            <Icon name={muted ? "mute" : "volume"} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={toggleFullscreen}
            disabled={load === "error"}
            aria-label={fullscreen ? "Exit full screen" : "Full screen"}
          >
            <Icon name={fullscreen ? "minimize" : "maximize"} />
          </button>
        </div>
      </div>
      {caption}
    </Card>
  );
}
