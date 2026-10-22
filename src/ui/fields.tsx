import React, { useId } from 'react';

export function Num({ label, value, onChange, min, max, step = 1, unit }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}{unit ? <small> {unit}</small> : null}</span>
      <input id={id} type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step}
        onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) onChange(v); }} />
    </label>
  );
}

export function Range({ label, value, onChange, min, max, step = 0.01 }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  const id = useId();
  return (
    <label className="field field-range" htmlFor={id}>
      <span className="field-label">{label} <small>{Math.round(value * 100) / 100}</small></span>
      <input id={id} type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="field field-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Sel<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <label className="field field-color" htmlFor={id}>
      <span className="field-label">{label}</span>
      <span className="color-wrap"><input id={id} type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'} onChange={(e) => onChange(e.target.value)} /><code>{value}</code></span>
    </label>
  );
}

export function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <input id={id} type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Section({ title, children, open = false, badge }: { title: string; children: React.ReactNode; open?: boolean; badge?: string }) {
  return (
    <details className="section" open={open}>
      <summary>{title}{badge ? <span className="badge">{badge}</span> : null}</summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

export function Row({ children }: { children: React.ReactNode }) { return <div className="row">{children}</div>; }

export function FileBtn({ label, accept, onFile, className }: { label: string; accept: string; onFile: (f: File) => void; className?: string }) {
  const id = useId();
  return (
    <label className={'btn btn-file ' + (className ?? '')} htmlFor={id}>
      {label}
      <input id={id} type="file" accept={accept} style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </label>
  );
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
}
