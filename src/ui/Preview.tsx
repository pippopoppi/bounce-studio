import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Config } from '../types';
import { CANVAS_SIZES } from '../types';
import type { Simulation, SimStatus } from '../sim/simulation';
import { canExport, downloadBlob, exportVideo, supportedMime } from '../export/recorder';
import { AudioEngine } from '../audio/engine';
import { Num, Sel, Section } from './fields';

interface Props {
  cfg: Config; sim: Simulation | null; status: SimStatus; audio: AudioEngine;
  canvasRef: React.RefObject<HTMLCanvasElement>; set: (path: (string | number)[], v: unknown) => void;
}

export function Preview({ cfg, sim, status, audio, canvasRef, set }: Props) {
  // Preview zoom: 1 = whole frame fits the stage; above 1 the stage scrolls. Display only, the video is unaffected.
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 400, h: 700 });
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const el = stageRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth - 20, h: el.clientHeight - 20 }));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const fit = Math.max(0.01, Math.min(box.w / cfg.canvas.width, box.h / cfg.canvas.height));
  const scale = fit * zoom;
  // Keep the point under the cursor (or the stage centre) in place while zooming: remember it, restore after the resize renders.
  const anchor = useRef<{ fx: number; fy: number; px: number; py: number } | null>(null);
  const zoomTo = (z: number, at?: { x: number; y: number }) => {
    const el = stageRef.current; const nz = Math.min(8, Math.max(1, Math.round(z * 100) / 100));
    if (!el || nz === zoom) return;
    const px = at ? at.x : el.clientWidth / 2, py = at ? at.y : el.clientHeight / 2;
    anchor.current = { fx: (el.scrollLeft + px) / Math.max(1, el.scrollWidth), fy: (el.scrollTop + py) / Math.max(1, el.scrollHeight), px, py };
    setZoom(nz);
  };
  useLayoutEffect(() => {
    const el = stageRef.current, a = anchor.current; if (!el || !a) return;
    anchor.current = null;
    el.scrollLeft = a.fx * el.scrollWidth - a.px; el.scrollTop = a.fy * el.scrollHeight - a.py;
  }, [zoom]);
  // Drag to pan while zoomed in.
  const pan = useRef<{ x: number; y: number; l: number; t: number } | null>(null);
  const onPanStart = (e: React.PointerEvent) => {
    const el = stageRef.current; if (!el || zoom <= 1 || e.button !== 0) return;
    pan.current = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop };
    el.setPointerCapture(e.pointerId);
  };
  const onPanMove = (e: React.PointerEvent) => {
    const el = stageRef.current, p = pan.current; if (!el || !p) return;
    el.scrollLeft = p.l - (e.clientX - p.x); el.scrollTop = p.t - (e.clientY - p.y);
  };
  const onPanEnd = () => { pan.current = null; };
  // Native listener: React's wheel handlers are passive, so they cannot stop the browser's own Ctrl+wheel page zoom.
  const zoomRef = useRef(zoomTo); zoomRef.current = zoomTo;
  const zoomVal = useRef(zoom); zoomVal.current = zoom;
  useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomRef.current(zoomVal.current * (e.deltaY < 0 ? 1.15 : 1 / 1.15), { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  const sizeKey = CANVAS_SIZES.some((o) => o.width === cfg.canvas.width && o.height === cfg.canvas.height) ? `${cfg.canvas.width}x${cfg.canvas.height}` : 'custom';
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
      <div className="stage-wrap">
        <div className={'stage' + (zoom > 1 ? ' stage-zoomed' : '')} ref={stageRef} onPointerDown={onPanStart} onPointerMove={onPanMove} onPointerUp={onPanEnd} onPointerCancel={onPanEnd}>
          <canvas ref={canvasRef} aria-label="Simulation preview" style={{ width: Math.round(cfg.canvas.width * scale), height: Math.round(cfg.canvas.height * scale) }} />
        </div>
        <div className="zoom" title="Preview zoom (only the view, not the video). Ctrl/⌘ + mouse wheel also zooms.">
          <button className="btn btn-sm" onClick={() => zoomTo(zoom / 1.25)} disabled={zoom <= 1} aria-label="Zoom out">−</button>
          <button className="btn btn-sm zoom-label" onClick={() => zoomTo(1)} title="Back to fit">{zoom === 1 ? 'Fit' : `${Math.round(zoom * 100)}%`}</button>
          <button className="btn btn-sm" onClick={() => zoomTo(zoom * 1.25)} disabled={zoom >= 8} aria-label="Zoom in">+</button>
        </div>
      </div>
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
            <Sel label="Video size" value={sizeKey} onChange={(v) => { const s = CANVAS_SIZES.find((o) => `${o.width}x${o.height}` === v); if (s) set(['canvas'], { width: s.width, height: s.height }); }}
              options={[...CANVAS_SIZES.map((o) => ({ value: `${o.width}x${o.height}`, label: o.label })), ...(sizeKey === 'custom' ? [{ value: 'custom', label: `Custom (${cfg.canvas.width}×${cfg.canvas.height})` }] : [])]} />
            <Num label="Width" unit="px" value={cfg.canvas.width} onChange={(v) => set(['canvas', 'width'], Math.min(4096, Math.max(16, Math.round(v))))} min={16} max={4096} step={10} />
            <Num label="Height" unit="px" value={cfg.canvas.height} onChange={(v) => set(['canvas', 'height'], Math.min(4096, Math.max(16, Math.round(v))))} min={16} max={4096} step={10} />
          </div>
          <p className="hint">The arena keeps its own size in pixels, so after switching the video size check Settings → Arena (e.g. a 470 px circle fits a 1080-wide frame, a 1500 px tall rectangle does not fit landscape).</p>
          <div className="row-3">
            <Sel label="Format" value={cfg.export.format} onChange={(v) => set(['export', 'format'], v)} options={[{ value: 'auto', label: 'Auto (MP4 if possible)' }, { value: 'mp4', label: 'MP4' }, { value: 'webm', label: 'WebM' }]} />
            <Num label="Hold last frame" unit="s" value={cfg.export.endHold} onChange={(v) => set(['export', 'endHold'], Math.min(10, Math.max(0, v)))} min={0} max={10} step={0.5} />
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
              : 'Video recording is not supported in this browser.'} The export is {cfg.canvas.width}×{cfg.canvas.height} with background music and every collision sound, locked to the simulation clock.
          </p>
        </Section>
      </div>
    </div>
  );
}
