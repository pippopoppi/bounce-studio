import React, { useEffect, useRef, useState } from 'react';
import type { SoundSlot } from '../types';
import type { AudioEngine } from '../audio/engine';
import { Num } from './fields';

type Clip = { start: number; end: number };
const H = 72;

// Waveform with two draggable handles that choose which part of the sound plays.
export function ClipEditor({ slot, audio, onChange }: { slot: SoundSlot; audio: AudioEngine; onChange: (clip: Clip | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState<null | (() => void)>(null);
  const drag = useRef<'start' | 'end' | null>(null);
  const id = slot.assetId;

  useEffect(() => {
    let cancelled = false;
    setPeaks(null); setDuration(0);
    if (!id) return;
    void audio.getBuffer(id).then((buf) => {
      if (cancelled || !buf) return;
      const n = 600, data = buf.getChannelData(0), per = Math.max(1, Math.floor(data.length / n)), out = new Float32Array(n);
      for (let i = 0; i < n; i++) { let m = 0; const o = i * per; for (let j = 0; j < per && o + j < data.length; j++) { const v = Math.abs(data[o + j]); if (v > m) m = v; } out[i] = m; }
      setPeaks(out); setDuration(buf.duration);
    });
    return () => { cancelled = true; };
  }, [id, audio]);

  const start = slot.clip ? Math.min(slot.clip.start, duration || slot.clip.start) : 0;
  const end = slot.clip && slot.clip.end > 0 ? Math.min(slot.clip.end, duration || slot.clip.end) : duration;

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const W = c.clientWidth || 300; c.width = W * 2; c.height = H * 2;
    const g = c.getContext('2d'); if (!g) return;
    g.scale(2, 2);
    g.fillStyle = '#0a0d11'; g.fillRect(0, 0, W, H);
    if (!peaks || !duration) { g.fillStyle = '#6b7684'; g.font = '12px system-ui'; g.fillText(id ? 'Loading waveform…' : 'No sound selected', 10, H / 2 + 4); return; }
    const x0 = (start / duration) * W, x1 = (end / duration) * W;
    g.fillStyle = 'rgba(77,166,255,0.18)'; g.fillRect(x0, 0, x1 - x0, H);
    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * W, h = Math.max(1, peaks[i] * (H - 8));
      const t = (i / peaks.length) * duration;
      g.fillStyle = t >= start && t <= end ? '#4da6ff' : '#3a4350';
      g.fillRect(x, H / 2 - h / 2, Math.max(1, W / peaks.length), h);
    }
    g.fillStyle = '#ffd93d';
    g.fillRect(x0 - 1, 0, 2, H); g.fillRect(x1 - 1, 0, 2, H);
    g.fillRect(x0 - 6, 0, 12, 8); g.fillRect(x1 - 6, H - 8, 12, 8);
    g.font = '11px system-ui'; g.textBaseline = 'top';
    const label = `${start.toFixed(2)} s – ${end.toFixed(2)} s  (${(end - start).toFixed(2)} s of ${duration.toFixed(2)} s)`;
    const tw = g.measureText(label).width;
    g.fillStyle = 'rgba(10,13,17,0.8)'; g.fillRect(W - tw - 14, H - 20, tw + 10, 16);
    g.fillStyle = '#e6ebf2'; g.fillText(label, W - tw - 9, H - 18);
  }, [peaks, duration, start, end, id]);

  const timeAt = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return Math.min(duration, Math.max(0, ((e.clientX - r.left) / r.width) * duration));
  };
  const commit = (s: number, e: number) => {
    s = Math.max(0, Math.min(s, duration)); e = Math.max(s, Math.min(e, duration));
    const whole = s <= 0.005 && e >= duration - 0.005;
    onChange(whole ? null : { start: Math.round(s * 1000) / 1000, end: Math.round(e * 1000) / 1000 });
  };
  const onDown = (e: React.PointerEvent) => {
    if (!duration) return;
    const t = timeAt(e);
    drag.current = Math.abs(t - start) <= Math.abs(t - end) ? 'start' : 'end';
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onMove(e);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !duration) return;
    const t = timeAt(e);
    if (drag.current === 'start') commit(Math.min(t, end - 0.01), end); else commit(start, Math.max(t, start + 0.01));
  };
  const onUp = () => { drag.current = null; };

  const preview = async () => {
    if (playing) { playing(); setPlaying(null); return; }
    const stop = await audio.preview(slot);
    setPlaying(() => stop);
    window.setTimeout(() => setPlaying((p) => (p === stop ? null : p)), Math.max(0, (end - start) / Math.pow(2, slot.pitch / 12)) * 1000 + 100);
  };

  if (!id) return null;
  return (
    <div className="clip">
      <span className="field-label">Clip: drag the yellow handles (top = start, bottom = end) to choose the part that plays</span>
      <canvas ref={canvasRef} style={{ width: '100%', height: H }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
      <div className="row-3">
        <Num label="Start" unit="s" value={Math.round(start * 100) / 100} onChange={(v) => commit(v, end)} min={0} max={Math.max(0, duration)} step={0.05} />
        <Num label="End" unit="s" value={Math.round(end * 100) / 100} onChange={(v) => commit(start, v)} min={0} max={Math.max(0, duration)} step={0.05} />
        <div className="field"><span className="field-label">&nbsp;</span><div className="toolbar" style={{ margin: 0 }}>
          <button className="btn btn-sm" onClick={() => void preview()} disabled={!duration}>{playing ? '⏹ Stop' : '▶ Preview clip'}</button>
          <button className="btn btn-sm" onClick={() => onChange(null)} disabled={!slot.clip}>Whole file</button>
        </div></div>
      </div>
    </div>
  );
}
