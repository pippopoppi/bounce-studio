// Records the preview canvas + the audio engine's stream with MediaRecorder while the simulation runs
// locked to the AudioContext clock. WebM everywhere, MP4 where the browser supports it.
import type { ExportConfig } from '../types';
import type { Simulation } from '../sim/simulation';
import type { AudioEngine } from '../audio/engine';
import fixWebmDuration from 'fix-webm-duration';

export interface ExportResult { blob: Blob; ext: string; mime: string }

const MP4_TYPES = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'];
const WEBM_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

export function supportedMime(format: ExportConfig['format']): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const ok = (t: string) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } };
  const order = format === 'webm' ? [WEBM_TYPES] : format === 'mp4' ? [MP4_TYPES] : [MP4_TYPES, WEBM_TYPES];
  for (const list of order) for (const t of list) if (ok(t)) return { mime: t, ext: t.startsWith('video/mp4') ? 'mp4' : 'webm' };
  return null;
}

export function canExport(): boolean { return supportedMime('auto') !== null && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype; }

export async function exportVideo(sim: Simulation, canvas: HTMLCanvasElement, audio: AudioEngine, cfg: ExportConfig, onProgress: (t: number) => void, signal?: { cancelled: boolean }): Promise<ExportResult> {
  const pick = supportedMime(cfg.format);
  if (!pick) throw new Error('This browser cannot record video (MediaRecorder unsupported). Try Chrome, Edge or Firefox.');
  await audio.ensure();
  sim.reset();
  const stream = canvas.captureStream(cfg.fps);
  const astream = audio.stream;
  if (astream) for (const t of astream.getAudioTracks()) stream.addTrack(t);
  const chunks: Blob[] = [];
  const rec = new MediaRecorder(stream, { mimeType: pick.mime, videoBitsPerSecond: Math.round(cfg.bitrateMbps * 1e6), audioBitsPerSecond: 192000 });
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((res) => { rec.onstop = () => res(); });
  rec.start(250);
  const t0 = performance.now();
  const prev = sim.onStatus;
  sim.onStatus = (s) => { prev(s); onProgress(s.time); };
  const finished = sim.whenFinished();
  await sim.play('audio');
  const poll = setInterval(() => { if (signal?.cancelled) { sim.pause(); clearInterval(poll); } }, 100);
  await Promise.race([finished, new Promise<void>((res) => { const i = setInterval(() => { if (signal?.cancelled) { clearInterval(i); res(); } }, 100); })]);
  clearInterval(poll);
  await new Promise((r) => setTimeout(r, 400)); // let the last sounds/frames land in the recording
  rec.stop();
  await stopped;
  sim.onStatus = prev;
  for (const t of stream.getTracks()) t.stop();
  let blob = new Blob(chunks, { type: pick.mime });
  if (pick.ext === 'webm') { // MediaRecorder leaves the duration out of the WebM header; patch it in so players can seek
    try { blob = await fixWebmDuration(blob, performance.now() - t0, { logger: false }); } catch { /* keep the unpatched file */ }
  }
  return { blob, ext: pick.ext, mime: pick.mime };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}
