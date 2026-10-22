import React, { useEffect, useRef, useState } from 'react';
import type { Config } from '../types';
import type { Simulation, SimStatus } from '../sim/simulation';
import { canExport, downloadBlob, exportVideo, supportedMime } from '../export/recorder';
import { AudioEngine } from '../audio/engine';
import { Num, Sel, Section } from './fields';

interface Props {
  cfg: Config; sim: Simulation | null; status: SimStatus; audio: AudioEngine;
  canvasRef: React.RefObject<HTMLCanvasElement>; set: (path: (string | number)[], v: unknown) => void;
}

export function Preview({ cfg, sim, status, audio, canvasRef, set }: Props) {
  const [muted, setMuted] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; ext: string; size: number; name: string } | null>(null);
  const [error, setError] = useState('');
  const cancel = useRef({ cancelled: false });
  const fmt = supportedMime(cfg.export.format);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const doExport = async () => {
    if (!sim || !canvasRef.current) return;
    setError(''); setResult(null); setExporting(true); setProgress(0); cancel.current = { cancelled: false };
    try {
      const r = await exportVideo(sim, canvasRef.current, audio, cfg.export, (t) => setProgress(t), cancel.current);
      const name = (cfg.name || 'bounce').replace(/[^\w-]+/g, '_') + '-' + cfg.seed + '.' + r.ext;
      setResult({ url: URL.createObjectURL(r.blob), ext: r.ext, size: r.blob.size, name });
    } catch (e) { setError((e as Error).message); }
    setExporting(false);
  };

  const playing = status.state === 'playing';
  return (
    <div className="center">
      <div className="stage"><canvas ref={canvasRef} aria-label="Simulation preview" /></div>
      <div className="transport">
        <button className="btn btn-primary" onClick={() => (playing ? sim?.pause() : sim?.play())} disabled={!sim || exporting}>{playing ? '⏸ Pause' : status.state === 'finished' ? '↻ Replay' : '▶ Play'}</button>
        <button className="btn" onClick={() => sim?.reset()} disabled={!sim || exporting}>⏮ Reset</button>
        <button className="btn" onClick={() => sim?.stepOnce()} disabled={!sim || exporting} title="Advance one physics step">⏭ Step</button>
        <button className="btn" onClick={() => { audio.setMuted(!muted); setMuted(!muted); }} title="Mute preview (exports keep the audio)">{muted ? '🔇' : '🔊'}</button>
        <span className="time">{status.time.toFixed(2)} / {cfg.duration}s {status.state === 'finished' ? '· done' : ''}</span>
        <div className="counts">
          {cfg.categories.map((k) => <span className="count" key={k.id}><i className="dot" style={{ background: k.color }} />{k.name}: <b>{status.counts[k.id] ?? 0}</b></span>)}
        </div>
      </div>
      <div style={{ padding: '0 10px 10px', background: 'var(--panel)' }}>
        <Section title="Export video" open>
          <div className="row-3">
            <Sel label="Format" value={cfg.export.format} onChange={(v) => set(['export', 'format'], v)} options={[{ value: 'auto', label: 'Auto (MP4 if possible)' }, { value: 'mp4', label: 'MP4' }, { value: 'webm', label: 'WebM' }]} />
            <Num label="Frame rate" unit="fps" value={cfg.export.fps} onChange={(v) => set(['export', 'fps'], Math.min(60, Math.max(24, Math.round(v))))} min={24} max={60} />
            <Num label="Bitrate" unit="Mbps" value={cfg.export.bitrateMbps} onChange={(v) => set(['export', 'bitrateMbps'], Math.min(50, Math.max(1, v)))} min={1} max={50} />
          </div>
          <div className="toolbar">
            {!exporting ? <button className="btn btn-accent" onClick={doExport} disabled={!sim || !canExport()}>⏺ Record {cfg.duration}s video {fmt ? `(${fmt.ext.toUpperCase()})` : ''}</button>
              : <button className="btn btn-danger" onClick={() => { cancel.current.cancelled = true; }}>■ Cancel</button>}
            {result ? <a className="btn btn-primary" href={result.url} download={result.name} onClick={(e) => { e.preventDefault(); fetch(result.url).then((r) => r.blob()).then((b) => downloadBlob(b, result.name)); }}>⬇ Download {result.name} ({(result.size / 1e6).toFixed(1)} MB)</a> : null}
          </div>
          {exporting ? <div><div className="progress"><div style={{ width: `${Math.min(100, (progress / cfg.duration) * 100)}%` }} /></div><p className="hint">Recording in real time: {progress.toFixed(1)} / {cfg.duration}s. Keep this tab visible.</p></div> : null}
          {error ? <p className="hint" style={{ color: 'var(--danger)' }}>{error}</p> : null}
          <p className="hint">
            {canExport() ? (fmt?.ext === 'mp4' ? 'This browser records MP4 directly.' : 'This browser records WebM (VP9/Opus). TikTok, Instagram and YouTube accept WebM uploads; for MP4 use Chrome/Edge or convert: ffmpeg -i video.webm -c:v libx264 -pix_fmt yuv420p -c:a aac video.mp4')
              : 'Video recording is not supported in this browser.'} The export is 1080×1920 with background music and every collision sound, locked to the simulation clock.
          </p>
        </Section>
      </div>
    </div>
  );
}
