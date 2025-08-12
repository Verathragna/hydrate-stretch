import React, { useEffect, useMemo, useState } from 'react';
import './force-dark.css';

document.documentElement.classList.add('dark');

type Prefs = {
  hydrationMin: number;
  stretchMin: number;
  hydrationText: string;
  stretchText: string;
  weekdaysOnly: boolean;
  workHoursOnly: boolean;
  workStart: string;
  workEnd: string;
  hydrationOn: boolean;
  stretchOn: boolean;
};

const minutesToMs = (m: number) => Math.max(1, Math.round(m)) * 60_000;
const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
};

export default function App() {
  const [prefs, setPrefs] = useState<Prefs>({
    hydrationMin: 30,
    stretchMin: 45,
    hydrationText: 'Grab some water ✨',
    stretchText: 'Stand up, loosen shoulders & hips 🧘',
    weekdaysOnly: false,
    workHoursOnly: false,
    workStart: '09:00',
    workEnd: '17:00',
    hydrationOn: true,
    stretchOn: true,
  });

  const [launchAtLogin, setLaunchAtLogin] = useState(false);

  // Baselines for next-due math
  const [lastHydrationTs, setLastHydrationTs] = useState<number>(Date.now());
  const [lastStretchTs, setLastStretchTs] = useState<number>(Date.now());

  // 1s ticker for countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) & 0x7fffffff), 1000);
    return () => clearInterval(id);
  }, []);

  // Due timestamps from baseline + interval
  const dueHydrate = useMemo(
    () => lastHydrationTs + minutesToMs(prefs.hydrationMin),
    [lastHydrationTs, prefs.hydrationMin]
  );
  const dueStretch = useMemo(
    () => lastStretchTs + minutesToMs(prefs.stretchMin),
    [lastStretchTs, prefs.stretchMin]
  );

  // Countdowns
  const hydrateDueIn = Math.max(0, dueHydrate - Date.now());
  const stretchDueIn = Math.max(0, dueStretch - Date.now());

  // Load saved prefs + autostart
  useEffect(() => {
    try {
      const raw = localStorage.getItem('hs-config');
      if (raw) setPrefs((p) => ({ ...p, ...JSON.parse(raw) }));
    } catch {}
    (async () => {
      try {
        const v = await (window as any).HS?.getLaunchAtLogin?.();
        if (typeof v === 'boolean') setLaunchAtLogin(v);
      } catch {}
    })();
  }, []);

  // Persist prefs
  useEffect(() => {
    try { localStorage.setItem('hs-config', JSON.stringify(prefs)); } catch {}
  }, [prefs]);

  // Sync prefs to main
  useEffect(() => {
    const t = setTimeout(() => (window as any).HS?.setPrefs?.(prefs), 150);
    return () => clearTimeout(t);
  }, [prefs]);

  // Keep main’s schedule aligned with these due times
  useEffect(() => { (window as any).HS?.setNextDue?.('hydrate', dueHydrate); }, [dueHydrate]);
  useEffect(() => { (window as any).HS?.setNextDue?.('stretch', dueStretch); }, [dueStretch]);

  // When countdown crosses zero, ask main to fire now
  useEffect(() => {
    if (prefs.hydrationOn && hydrateDueIn <= 0) {
      (window as any).HS?.triggerNow?.('hydrate');
      // reset baseline so countdown restarts immediately in UI
      setLastHydrationTs(Date.now());
    }
  }, [hydrateDueIn, prefs.hydrationOn]);
  useEffect(() => {
    if (prefs.stretchOn && stretchDueIn <= 0) {
      (window as any).HS?.triggerNow?.('stretch');
      setLastStretchTs(Date.now());
    }
  }, [stretchDueIn, prefs.stretchOn]);

  // Helpers
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));
  const resetTimers = () => {
    const now = Date.now();
    setLastHydrationTs(now);
    setLastStretchTs(now);
  };

  // Test buttons (main will show toast; no renderer notification/sound)
  const testHydration = () => (window as any).HS?.testNotification?.('hydrate');
  const testStretch   = () => (window as any).HS?.testNotification?.('stretch');

  async function toggleLaunch(checked: boolean) {
    try {
      await (window as any).HS?.setLaunchAtLogin?.(checked);
      setLaunchAtLogin(checked);
    } catch {}
  }

  return (
    <div className="wrap">
      {/* Header */}
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="title">Hydrate & Stretch</div>
            <div className="small">Native notifications • Dark theme • Tray + Autostart</div>
          </div>
        </div>
      </div>

      {/* Main cards */}
      <div className="grid">
        <div className="card">
          <div className="title">Hydration</div>
          <div className="row">
            <label>Enable</label>
            <input className="switch" type="checkbox" checked={prefs.hydrationOn}
              onChange={(e) => set('hydrationOn', e.target.checked)} />
          </div>
          <div className="row">
            <label>Interval (min)</label>
            <input type="number" min={1} value={prefs.hydrationMin}
              onChange={(e) => set('hydrationMin', Number(e.target.value || 0))} />
          </div>
          <div className="row">
            <label>Message</label>
            <input type="text" value={prefs.hydrationText}
              onChange={(e) => set('hydrationText', e.target.value)} />
          </div>
          <div className="small">Next in: <b>{fmt(hydrateDueIn)}</b></div>
        </div>

        <div className="card">
          <div className="title">Stretch</div>
          <div className="row">
            <label>Enable</label>
            <input className="switch" type="checkbox" checked={prefs.stretchOn}
              onChange={(e) => set('stretchOn', e.target.checked)} />
          </div>
          <div className="row">
            <label>Interval (min)</label>
            <input type="number" min={1} value={prefs.stretchMin}
              onChange={(e) => set('stretchMin', Number(e.target.value || 0))} />
          </div>
          <div className="row">
            <label>Message</label>
            <input type="text" value={prefs.stretchText}
              onChange={(e) => set('stretchText', e.target.value)} />
          </div>
          <div className="small">Next in: <b>{fmt(stretchDueIn)}</b></div>
        </div>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="title">Controls</div>
        <div className="row">
          <button onClick={testHydration}>Test hydration toast</button>
          <button className="outline" onClick={testStretch}>Test stretch toast</button>
          <button className="outline" onClick={resetTimers}>Reset timers</button>
          <label style={{ marginLeft: 12 }}>
            <input
              type="checkbox"
              checked={launchAtLogin}
              onChange={(e) => toggleLaunch(e.target.checked)}
            />
            &nbsp;Launch at login (run in tray)
          </label>
        </div>
      </div>

      {/* Config */}
      <div className="card">
        <div className="title">Config</div>
        <div className="grid">
          <div className="row">
            <label>Weekdays only</label>
            <input className="switch" type="checkbox" checked={prefs.weekdaysOnly}
              onChange={(e) => set('weekdaysOnly', e.target.checked)} />
          </div>
          <div className="row">
            <label>Only during work hours</label>
            <input className="switch" type="checkbox" checked={prefs.workHoursOnly}
              onChange={(e) => set('workHoursOnly', e.target.checked)} />
          </div>
          <div className="row">
            <label>Start</label>
            <input type="time" value={prefs.workStart}
              onChange={(e) => set('workStart', e.target.value)} />
          </div>
          <div className="row">
            <label>End</label>
            <input type="time" value={prefs.workEnd}
              onChange={(e) => set('workEnd', e.target.value)} />
          </div>
        </div>
        <div className="small">Close the window to keep it running in the tray.</div>
      </div>
    </div>
  );
}
