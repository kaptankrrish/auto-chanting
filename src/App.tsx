import React, { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';
import './App.css';
import SacredMandala from './components/SacredMandala';
import CosmicDust from './components/CosmicDust';

interface SessionRecord {
  id: string;
  name: string;
  count: number;
  intervalSec: number;
  date: string;
  partial: boolean;
}

interface PresetMantra {
  id: string;
  name: string;
  icon: string;
}

interface BreathPreset {
  name: string;
  inhale: number;
  hold: number;
  exhale: number;
  holdExhale: number;
  description: string;
}

const PRESET_MANTRAS: PresetMantra[] = [
  { id: 'Om', name: 'Om', icon: '🕉️' },
  { id: 'Krishna', name: 'Krishna', icon: '📿' },
  { id: 'Ram', name: 'Ram', icon: '🙏' },
  { id: 'Shiva', name: 'Shiva', icon: '🔱' },
  { id: 'Buddha', name: 'Buddha', icon: '🧘' },
  { id: 'Amen', name: 'Amen', icon: '🕊️' },
];

const BREATH_PRESETS: BreathPreset[] = [
  { name: 'Box Breathing (4-4-4-4)', inhale: 4, hold: 4, exhale: 4, holdExhale: 4, description: 'Clear the mind, enhance concentration, and relieve stress.' },
  { name: 'Calm Breathing (4-7-8)', inhale: 4, hold: 7, exhale: 8, holdExhale: 0, description: 'Deeply tranquilize the nervous system and help sleep.' },
  { name: 'Coherent Breathing (5-5)', inhale: 5, hold: 0, exhale: 5, holdExhale: 0, description: 'Align heart rate variability, calm nerves, and improve breathing efficiency.' }
];

const FAQ_ITEMS = [
  {
    question: "How does the app stay awake on mobile screens or lock states?",
    answer: "ChantAura uses a background HTML5 silent audio track combined with Web Audio timeline lookahead. The mobile operating system recognizes it as an active media player (like a music app), preventing background processes from sleeping or pausing when your screen is locked."
  },
  {
    question: "Why does the counter keep ticking in the background?",
    answer: "ChantAura tracks absolute time differences since the session start using browser timestamps rather than typical javascript intervals. Even if your phone turns off or pauses scripts, the count immediately computes the correct number when reopened."
  },
  {
    question: "Where is my history saved?",
    answer: "All stats and session records are stored entirely on your device's browser `localStorage`. No data is ever sent to external servers, protecting your privacy completely."
  },
  {
    question: "Why do I need to enable the sound toggle manually?",
    answer: "Modern browsers prevent audio from playing automatically without a user gesture. Clicking 'Begin Journey' registers the permission so the Web Audio context can synthesize sounds freely."
  }
];

const ZEN_QUOTES = [
  "“Quiet the mind and the soul will speak.” — Buddha",
  "“The quieter you become, the more you are able to hear.” — Rumi",
  "“Feelings come and go like clouds in a windy sky. Conscious breathing is my anchor.” — Thich Nhat Hanh",
  "“Silence is a source of great strength.” — Lao Tzu",
  "“Within you, there is a stillness and a sanctuary to which you can retreat at any time.” — Hermann Hesse",
  "“Mindfulness isn't difficult, we just need to remember to do it.” — Sharon Salzberg",
  "“Quiet minds cannot be perplexed or frightened, but go on in fortune or misfortune at their own private pace, like a clock during a thunderstorm.” — Robert Louis Stevenson"
];

// Tiny base64 silent WAV file to trigger background Audio player mode on iOS/Android
const SILENT_WAV_BASE64 = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAGRhdGEAAAAA';

// External SacredMandala imported at top

const App: React.FC = () => {
  // Config State
  const [mantra, setMantra] = useState<string>('Om');
  const [customMantra, setCustomMantra] = useState<string>('');
  const [intervalSec, setIntervalSec] = useState<number>(1.0);
  
  // Audio Config
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [droneEnabled, setDroneEnabled] = useState<boolean>(false);
  
  // Custom theme
  const [theme, setTheme] = useState<string>('cosmic');

  // Advanced Synthesizer Config States
  const [chimeVolume, setChimeVolume] = useState<number>(0.5);
  const [chimePitch, setChimePitch] = useState<number>(1.0);
  const [droneVolume, setDroneVolume] = useState<number>(0.03);
  const [droneFrequency, setDroneFrequency] = useState<number>(55.0);
  const [droneWave, setDroneWave] = useState<'sawtooth' | 'sine' | 'triangle' | 'square'>('sawtooth');
  const [showAudioSettings, setShowAudioSettings] = useState<boolean>(false);

  // Session State
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [count, setCount] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<string>('00:00');
  
  // History & Metrics
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [pulse, setPulse] = useState<boolean>(false);
  const [bump, setBump] = useState<boolean>(false);

  // Breathing Trainer State
  const [breathActive, setBreathActive] = useState<boolean>(false);
  const [selectedBreathPreset, setSelectedBreathPreset] = useState<number>(0);
  const [breathPhase, setBreathPhase] = useState<'inhale' | 'hold' | 'exhale' | 'holdExhale'>('inhale');
  const [breathTimer, setBreathTimer] = useState<number>(4);

  // FAQ state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Quote state
  const [quote, setQuote] = useState<string>('');

  // Refs for tracking timestamps safely
  const sessionRef = useRef({
    startTimestamp: 0,
    accumulatedTime: 0,
    lastTickCount: 0,
    reqId: 0,
    scheduledTickIndex: 0
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const droneNodeRef = useRef<{
    osc1: OscillatorNode;
    osc2: OscillatorNode;
    gainNode: GainNode;
  } | null>(null);

  // Future scheduled oscillators to cancel on pause/stop
  const scheduledOscsRef = useRef<Array<{ oscillators: OscillatorNode[]; timeSec: number }>>([]);

  // Mount effects
  useEffect(() => {
    // Sync theme
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  // Load Preferences & History
  useEffect(() => {
    // Generate random quote
    const rand = ZEN_QUOTES[Math.floor(Math.random() * ZEN_QUOTES.length)];
    setQuote(rand);

    // Load data
    const savedPrefs = localStorage.getItem('chanting-prefs');
    if (savedPrefs) {
      try {
        const p = JSON.parse(savedPrefs);
        setIntervalSec(p.intervalSec ?? 1.0);
        setMantra(p.mantra || 'Om');
        setSoundEnabled(p.soundEnabled || false);
        setTheme(p.theme || 'cosmic');
        
        // Advanced sound preferences
        if (p.chimeVolume !== undefined) setChimeVolume(p.chimeVolume);
        if (p.chimePitch !== undefined) setChimePitch(p.chimePitch);
        if (p.droneVolume !== undefined) setDroneVolume(p.droneVolume);
        if (p.droneFrequency !== undefined) setDroneFrequency(p.droneFrequency);
        if (p.droneWave !== undefined) setDroneWave(p.droneWave);
      } catch (e) {}
    }
    
    const savedHistory = localStorage.getItem('chanting-history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {}
    }
  }, []);

  // Save preferences
  useEffect(() => {
    localStorage.setItem('chanting-prefs', JSON.stringify({
      intervalSec, mantra, soundEnabled, theme,
      chimeVolume, chimePitch, droneVolume, droneFrequency, droneWave
    }));
  }, [intervalSec, mantra, soundEnabled, theme, chimeVolume, chimePitch, droneVolume, droneFrequency, droneWave]);

  const activeName = mantra === 'custom' ? customMantra || 'Custom' : mantra;
  const totalChantsAllTime = history.reduce((sum, item) => sum + item.count, 0);
  const sessionCountAllTime = history.length;

  // Manual Trigger Chime Test
  const playTestChime = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    
    const now = ctx.currentTime;
    const frequencies = [293.66, 440.0, 659.25, 880.0, 1200.0];
    const gains = [0.15, 0.1, 0.08, 0.04, 0.02];
    const decays = [1.2, 0.8, 0.6, 0.4, 0.2];
    
    frequencies.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = index === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq * chimePitch, now);
      
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 6;
      lfoGain.gain.value = 1.5 * chimePitch;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(gains[index] * chimeVolume, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + decays[index]);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      lfo.start(now);
      lfo.stop(now + decays[index]);
      osc.start(now);
      osc.stop(now + decays[index]);
    });
  };

  // Schedule Bell Chimes in hardware thread (lookahead)
  const scheduleBellChime = useCallback((ctx: AudioContext, timeSec: number) => {
    if (!soundEnabled) return;

    const frequencies = [293.66, 440.0, 659.25, 880.0, 1200.0];
    const gains = [0.15, 0.1, 0.08, 0.04, 0.02];
    const decays = [1.2, 0.8, 0.6, 0.4, 0.2];
    const oscillators: OscillatorNode[] = [];

    frequencies.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = index === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq * chimePitch, timeSec);
      
      // Vibrato wobble
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 6;
      lfoGain.gain.value = 1.5 * chimePitch;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gainNode.gain.setValueAtTime(0, timeSec);
      gainNode.gain.linearRampToValueAtTime(gains[index] * chimeVolume, timeSec + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, timeSec + decays[index]);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      lfo.start(timeSec);
      lfo.stop(timeSec + decays[index]);
      osc.start(timeSec);
      osc.stop(timeSec + decays[index]);

      oscillators.push(osc);
    });

    scheduledOscsRef.current.push({ oscillators, timeSec });
  }, [soundEnabled, chimeVolume, chimePitch]);

  // Synth hum drone
  const startDroneHum = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    osc1.type = droneWave;
    osc1.frequency.value = droneFrequency;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = droneFrequency * 1.5; // perfect fifth

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = droneFrequency * 2.0;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(droneVolume, now + 2.0);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start();
    osc2.start();

    droneNodeRef.current = { osc1, osc2, gainNode };
  };

  const stopDroneHum = () => {
    const drone = droneNodeRef.current;
    if (drone && audioCtxRef.current) {
      const now = audioCtxRef.current.currentTime;
      drone.gainNode.gain.setValueAtTime(drone.gainNode.gain.value, now);
      drone.gainNode.gain.linearRampToValueAtTime(0, now + 1.2);
      setTimeout(() => {
        try {
          drone.osc1.stop();
          drone.osc2.stop();
        } catch(e){}
        droneNodeRef.current = null;
      }, 1300);
    }
  };

  // Synchronized real-time adjustments to running hum drone parameters
  useEffect(() => {
    const drone = droneNodeRef.current;
    if (drone && audioCtxRef.current) {
      const now = audioCtxRef.current.currentTime;
      drone.osc1.frequency.setValueAtTime(droneFrequency, now);
      drone.osc2.frequency.setValueAtTime(droneFrequency * 1.5, now);
      drone.gainNode.gain.linearRampToValueAtTime(droneVolume, now + 0.3);
    }
  }, [droneFrequency, droneVolume]);

  useEffect(() => {
    const drone = droneNodeRef.current;
    if (drone && audioCtxRef.current) {
      drone.osc1.type = droneWave;
    }
  }, [droneWave]);

  useEffect(() => {
    if (isActive && !isPaused && droneEnabled) {
      startDroneHum();
    } else {
      stopDroneHum();
    }
    return () => stopDroneHum();
  }, [isActive, isPaused, droneEnabled]);

  // Clean future queued oscs on Pause/Stop
  const cancelScheduledChimes = () => {
    if (!audioCtxRef.current) return;
    const nowCtxTime = audioCtxRef.current.currentTime;
    
    scheduledOscsRef.current.forEach((item) => {
      if (item.timeSec > nowCtxTime) {
        item.oscillators.forEach((osc) => {
          try {
            osc.stop();
          } catch(e){}
        });
      }
    });
    scheduledOscsRef.current = [];
  };

  // Save history item
  const saveRecord = useCallback((finalCount: number, partial: boolean) => {
    if (finalCount <= 0) return;
    const record: SessionRecord = {
      id: Date.now().toString(),
      name: mantra === 'custom' ? customMantra || 'Custom' : mantra,
      count: finalCount,
      intervalSec,
      date: new Date().toISOString(),
      partial
    };
    
    setHistory(prev => {
      const updated = [record, ...prev].slice(0, 100);
      localStorage.setItem('chanting-history', JSON.stringify(updated));
      return updated;
    });
  }, [mantra, customMantra, intervalSec]);

  // Combined Loop: Visual frames and lookahead sound scheduler
  const loop = useCallback(() => {
    if (!isActive || isPaused) return;

    const sr = sessionRef.current;
    const now = Date.now();
    const elapsed = sr.accumulatedTime + (now - sr.startTimestamp);
    const tickDurationMs = intervalSec * 1000;
    
    // Lookahead sound scheduling (1.2 second queue buffer)
    if (soundEnabled && audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      const lookaheadMs = 1200;
      
      while (sr.startTimestamp + (sr.scheduledTickIndex + 1) * tickDurationMs < now + lookaheadMs) {
        sr.scheduledTickIndex++;
        const targetMs = sr.startTimestamp + sr.scheduledTickIndex * tickDurationMs;
        const timeOffsetSec = (targetMs - now) / 1000;
        
        if (timeOffsetSec >= 0) {
          scheduleBellChime(ctx, ctx.currentTime + timeOffsetSec);
        }
      }
    }

    // Graphical Updates (Count & time elapsed)
    let currentCount = Math.floor(elapsed / tickDurationMs);
    
    const totalSecs = Math.floor(elapsed / 1000);
    setTimeRemaining(`${Math.floor(totalSecs / 60).toString().padStart(2, '0')}:${(totalSecs % 60).toString().padStart(2, '0')}`);

    if (currentCount > sr.lastTickCount) {
      sr.lastTickCount = currentCount;
      setCount(currentCount);
      
      // Bump visual animations
      setBump(false);
      setPulse(false);
      requestAnimationFrame(() => {
        setBump(true);
        setPulse(true);
      });
    }

    sr.reqId = requestAnimationFrame(loop);
  }, [isActive, isPaused, intervalSec, soundEnabled, scheduleBellChime]);

  useEffect(() => {
    if (isActive && !isPaused) {
      sessionRef.current.reqId = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(sessionRef.current.reqId);
  }, [isActive, isPaused, loop]);

  // Sync window unload
  useEffect(() => {
    const handleUnload = () => {
      if (isActive) {
        saveRecord(sessionRef.current.lastTickCount, true);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [isActive, saveRecord]);

  // Session triggers
  const startSession = () => {
    // Initialize Web Audio Context on gesture
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Trigger mobile silent audio background play trick
    try {
      if (!silentAudioRef.current) {
        const aud = new Audio();
        aud.src = SILENT_WAV_BASE64;
        aud.loop = true;
        silentAudioRef.current = aud;
      }
      silentAudioRef.current.play().catch((e) => {
        console.warn("Silent audio keep-alive blocked or requires permission: ", e);
      });
    } catch(e) {}
    
    sessionRef.current = {
      startTimestamp: Date.now(),
      accumulatedTime: 0,
      lastTickCount: 0,
      reqId: 0,
      scheduledTickIndex: 0
    };
    setCount(0);
    setTimeRemaining('00:00');
    setIsActive(true);
    setIsPaused(false);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const togglePause = () => {
    if (isPaused) {
      sessionRef.current.startTimestamp = Date.now();
      
      // Resume background silent playback
      if (silentAudioRef.current) {
        silentAudioRef.current.play().catch(() => {});
      }
      
      setIsPaused(false);
    } else {
      sessionRef.current.accumulatedTime += (Date.now() - sessionRef.current.startTimestamp);
      cancelScheduledChimes();
      
      // Pause silent audio to save battery
      if (silentAudioRef.current) {
        silentAudioRef.current.pause();
      }
      
      setIsPaused(true);
    }
  };

  const stopSession = (manual: boolean) => {
    cancelAnimationFrame(sessionRef.current.reqId);
    cancelScheduledChimes();
    
    if (silentAudioRef.current) {
      silentAudioRef.current.pause();
    }
    
    if (!isPaused && manual) {
      sessionRef.current.accumulatedTime += (Date.now() - sessionRef.current.startTimestamp);
    }
    
    const finalCount = sessionRef.current.lastTickCount;
    saveRecord(finalCount, manual);
    setIsActive(false);
  };

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear all session history?")) {
      localStorage.removeItem('chanting-history');
      setHistory([]);
    }
  };

  const updateInterval = (val: number) => {
    const newVal = Math.max(0.1, Math.min(10, Number(val.toFixed(1))));
    setIntervalSec(newVal);
  };

  // Breathing Trainer State Machine Loop
  useEffect(() => {
    if (!breathActive) return;
    
    const preset = BREATH_PRESETS[selectedBreathPreset];
    
    const id = setInterval(() => {
      setBreathTimer((prev) => {
        if (prev <= 1) {
          // Determine next state
          let nextPhase: typeof breathPhase = 'inhale';
          let duration = 4;
          
          if (breathPhase === 'inhale') {
            if (preset.hold > 0) {
              nextPhase = 'hold';
              duration = preset.hold;
            } else {
              nextPhase = 'exhale';
              duration = preset.exhale;
            }
          } else if (breathPhase === 'hold') {
            nextPhase = 'exhale';
            duration = preset.exhale;
          } else if (breathPhase === 'exhale') {
            if (preset.holdExhale > 0) {
              nextPhase = 'holdExhale';
              duration = preset.holdExhale;
            } else {
              nextPhase = 'inhale';
              duration = preset.inhale;
            }
          } else if (breathPhase === 'holdExhale') {
            nextPhase = 'inhale';
            duration = preset.inhale;
          }
          
          setBreathPhase(nextPhase);
          return duration;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(id);
  }, [breathActive, breathPhase, selectedBreathPreset]);

  const toggleBreathTrainer = () => {
    if (breathActive) {
      setBreathActive(false);
    } else {
      const preset = BREATH_PRESETS[selectedBreathPreset];
      setBreathPhase('inhale');
      setBreathTimer(preset.inhale);
      setBreathActive(true);
    }
  };

  const cycleQuote = () => {
    let nextQuote = quote;
    while (nextQuote === quote) {
      nextQuote = ZEN_QUOTES[Math.floor(Math.random() * ZEN_QUOTES.length)];
    }
    setQuote(nextQuote);
  };

  const getPhaseDuration = (phase: typeof breathPhase, preset: BreathPreset) => {
    if (phase === 'inhale') return preset.inhale;
    if (phase === 'hold') return preset.hold;
    if (phase === 'exhale') return preset.exhale;
    if (phase === 'holdExhale') return preset.holdExhale;
    return 4;
  };

  // Compute Breathing circle scaling values
  let scale = 1.0;
  let transitionSec = 1;
  const currentPreset = BREATH_PRESETS[selectedBreathPreset];
  
  if (breathActive) {
    if (breathPhase === 'inhale') {
      scale = 1.7;
      transitionSec = currentPreset.inhale;
    } else if (breathPhase === 'hold') {
      scale = 1.7;
      transitionSec = currentPreset.hold;
    } else if (breathPhase === 'exhale') {
      scale = 1.0;
      transitionSec = currentPreset.exhale;
    } else if (breathPhase === 'holdExhale') {
      scale = 1.0;
      transitionSec = currentPreset.holdExhale;
    }
  }

  const breathColorMap = {
    inhale: '#10b981', // emerald
    hold: '#3b82f6', // blue
    exhale: '#f97316', // amber
    holdExhale: '#a855f7' // purple
  };
  const currentBreathColor = breathActive ? breathColorMap[breathPhase] : 'var(--accent)';

  return (
    <>
      <CosmicDust theme={theme} />
      <div className="background-canvas"></div>
      <div className="ambient-nebulae">
        <div className="nebula-blob blob-1"></div>
        <div className="nebula-blob blob-2"></div>
      </div>
      <div className="stars-overlay"></div>
      
      {/* Navigation menu */}
      <nav className="top-nav">
        <div className="logo-container">
          <div className="logo">
            ChantAura <span className="logo-badge">PWA</span>
          </div>
        </div>
        
        <div className="theme-pill-drawer">
          <div className={`theme-pill cosmic ${theme === 'cosmic' ? 'active' : ''}`} onClick={() => setTheme('cosmic')} title="Cosmic Purple"></div>
          <div className={`theme-pill dawn ${theme === 'dawn' ? 'active' : ''}`} onClick={() => setTheme('dawn')} title="Crimson Dawn"></div>
          <div className={`theme-pill forest ${theme === 'forest' ? 'active' : ''}`} onClick={() => setTheme('forest')} title="Zen Forest"></div>
          <div className={`theme-pill sunset ${theme === 'sunset' ? 'active' : ''}`} onClick={() => setTheme('sunset')} title="Golden Sunset"></div>
        </div>
      </nav>

      {/* Main Grid dashboard */}
      <div className="dashboard-layout">
        
        {/* Left column: active focus state or selector */}
        <section className="glass-panel">
          {!isActive ? (
            <div className="view">
              <h2 className="panel-title">Meditative Focus Space</h2>
              
              <div className="mantras-section">
                <div className="section-label">
                  <span>✨</span> Select Intention / Mantra
                </div>
                <div className="mantra-cards-grid">
                  {PRESET_MANTRAS.map((m) => (
                    <div 
                      key={m.id} 
                      className={`mantra-card ${mantra === m.id ? 'active' : ''}`}
                      onClick={() => setMantra(m.id)}
                    >
                      <span className="mantra-icon">{m.icon}</span>
                      <span className="mantra-name">{m.name}</span>
                    </div>
                  ))}
                  <div 
                    className={`mantra-card ${mantra === 'custom' ? 'active' : ''}`}
                    onClick={() => setMantra('custom')}
                  >
                    <span className="mantra-icon">✏️</span>
                    <span className="mantra-name">Custom</span>
                  </div>
                </div>

                {mantra === 'custom' && (
                  <div className="custom-input-box">
                    <input 
                      type="text" 
                      className="glass-input" 
                      value={customMantra} 
                      onChange={(e) => setCustomMantra(e.target.value)} 
                      placeholder="Type custom mantra/name..." 
                    />
                  </div>
                )}
              </div>

              <div className="settings-grid">
                <div className="settings-box">
                  <div className="slider-label-row">
                    <span>Interval Rhythm</span>
                    <strong>{intervalSec.toFixed(1)}s</strong>
                  </div>
                  <div className="stepper-layout">
                    <button className="stepper-btn" onClick={() => updateInterval(intervalSec - 0.1)}>−</button>
                    <span className="stepper-val">{intervalSec.toFixed(1)}s</span>
                    <button className="stepper-btn" onClick={() => updateInterval(intervalSec + 0.1)}>+</button>
                  </div>
                  <small className="hint">Determine the interval duration between each chant count.</small>
                </div>
              </div>

              {/* Synthesizer Customizer Collapsible */}
              <div style={{ marginBottom: '1.5rem' }}>
                <button 
                  className="sound-test-btn" 
                  style={{ width: '100%', padding: '0.9rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between' }}
                  onClick={() => setShowAudioSettings(!showAudioSettings)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🎛️ Audio Soundscape Settings
                  </span>
                  <span>{showAudioSettings ? '▲' : '▼'}</span>
                </button>

                {showAudioSettings && (
                  <div className="advanced-synth-panel">
                    <div className="synth-section-title">Singing Bowl Chime Settings</div>
                    <div className="synth-controls-layout" style={{ marginBottom: '1.5rem' }}>
                      <div className="synth-slider-group">
                        <label className="synth-label">Chime Volume <span>{Math.round(chimeVolume * 100)}%</span></label>
                        <input 
                          type="range" 
                          min="0" 
                          max="1.0" 
                          step="0.05" 
                          value={chimeVolume} 
                          onChange={(e) => setChimeVolume(Number(e.target.value))} 
                        />
                      </div>
                      <div className="synth-slider-group">
                        <label className="synth-label">Chime Pitch <span>{chimePitch.toFixed(2)}x</span></label>
                        <input 
                          type="range" 
                          min="0.5" 
                          max="2.0" 
                          step="0.05" 
                          value={chimePitch} 
                          onChange={(e) => setChimePitch(Number(e.target.value))} 
                        />
                      </div>
                    </div>

                    <div className="synth-section-title">Meditative Drone Hum Settings</div>
                    <div className="synth-controls-layout" style={{ marginBottom: '1.5rem' }}>
                      <div className="synth-slider-group">
                        <label className="synth-label">Drone Volume <span>{Math.round(droneVolume * 1000)}/100</span></label>
                        <input 
                          type="range" 
                          min="0" 
                          max="0.1" 
                          step="0.005" 
                          value={droneVolume} 
                          onChange={(e) => setDroneVolume(Number(e.target.value))} 
                        />
                      </div>
                      <div className="synth-slider-group">
                        <label className="synth-label">Drone Frequency <span>{Math.round(droneFrequency)} Hz</span></label>
                        <input 
                          type="range" 
                          min="40" 
                          max="120" 
                          step="1" 
                          value={droneFrequency} 
                          onChange={(e) => setDroneFrequency(Number(e.target.value))} 
                        />
                      </div>
                      <div className="synth-slider-group">
                        <label className="synth-label">Drone Waveshape</label>
                        <select 
                          className="synth-select" 
                          value={droneWave} 
                          onChange={(e: any) => setDroneWave(e.target.value)}
                        >
                          <option value="sawtooth">Sawtooth (Resonant)</option>
                          <option value="triangle">Triangle (Flutey)</option>
                          <option value="sine">Sine (Pure Sub)</option>
                          <option value="square">Square (Hollow)</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                      <button className="sound-test-btn" style={{ flexGrow: 1 }} onClick={playTestChime}>
                        🔔 Test Singing Bowl Chime
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button className="begin-journey-btn" onClick={startSession}>
                Begin Inner Journey
              </button>
            </div>
          ) : (
            <div className="view session-layout">
              <div className="nav-row">
                <button className="icon-btn stop-btn" title="End Session" onClick={() => stopSession(true)}>
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                </button>
                <div className="session-name-display">{activeName}</div>
                <button className="icon-btn" title="Toggle Sound" onClick={() => setSoundEnabled(!soundEnabled)}>
                  {soundEnabled ? (
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                  )}
                </button>
              </div>

              <div className="meditation-center">
                {/* Rotating sacred geometry background */}
                <SacredMandala active={!isPaused} />

                <div className="circle-outer-ring">
                  {/* Glowing progress ring */}
                  <svg className="progress-svg">
                    <circle className="progress-circle-bg" r={150} cx={160} cy={160} />
                    <circle 
                      className="progress-circle-fill" 
                      r={150} 
                      cx={160} 
                      cy={160} 
                      strokeDasharray={`${2 * Math.PI * 150}`}
                      style={{ strokeDashoffset: 0, opacity: 0.2 }}
                    />
                  </svg>

                  <div className="counter-value-container">
                    <div className={`session-big-counter ${bump ? 'bump' : ''}`}>{count.toLocaleString()}</div>
                    <div className="session-unit-label">chants</div>
                  </div>
                </div>
              </div>

              <div className="controls-container">
                <div className="session-info-panel">
                  <div className="session-timer-text">{timeRemaining}</div>
                  <div className="session-timer-subtitle">elapsed time</div>
                </div>

                <div className="controls-row">
                  <button className="play-pause-fab" onClick={togglePause}>
                    {!isPaused ? (
                      <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2.5" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2.5" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>
                    )}
                  </button>
                </div>

                <div className="audio-drawer">
                  <button className={`audio-btn ${soundEnabled ? 'active' : ''}`} onClick={() => setSoundEnabled(!soundEnabled)}>
                    <span>🔔 singing bowl</span>
                  </button>
                  <button className={`audio-btn ${droneEnabled ? 'active' : ''}`} onClick={() => setDroneEnabled(!droneEnabled)}>
                    <span>🧘 background hum</span>
                  </button>
                </div>

                {/* Inline sound scape slider adjusts during live session */}
                <div className="advanced-synth-panel" style={{ width: '100%', maxWidth: '380px', padding: '1rem', marginTop: '0.5rem' }}>
                  <div className="synth-slider-group" style={{ marginBottom: droneEnabled ? '0.75rem' : '0' }}>
                    <label className="synth-label" style={{ fontSize: '0.75rem' }}>Singing Bowl Volume <span>{Math.round(chimeVolume * 100)}%</span></label>
                    <input 
                      type="range" 
                      min="0" 
                      max="1.0" 
                      step="0.05" 
                      style={{ height: '4px' }}
                      value={chimeVolume} 
                      onChange={(e) => setChimeVolume(Number(e.target.value))} 
                    />
                  </div>
                  {droneEnabled && (
                    <div className="synth-slider-group">
                      <label className="synth-label" style={{ fontSize: '0.75rem' }}>Background Hum Volume <span>{Math.round(droneVolume * 1000)}/100</span></label>
                      <input 
                        type="range" 
                        min="0" 
                        max="0.08" 
                        step="0.005" 
                        style={{ height: '4px' }}
                        value={droneVolume} 
                        onChange={(e) => setDroneVolume(Number(e.target.value))} 
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className={`visual-pulse ${pulse ? 'fire' : ''}`}></div>
            </div>
          )}
        </section>
 
        {/* Right column: metrics dashboard, stats log, past history */}
        <section className="glass-panel">
          <h2 className="panel-title">My Meditation Records</h2>
          
          <div className="stats-row">
            <div className="stat-item-box">
              <span>All Chants</span>
              <strong>{totalChantsAllTime.toLocaleString()}</strong>
            </div>
            <div className="stat-item-box">
              <span>Sessions</span>
              <strong>{sessionCountAllTime}</strong>
            </div>
            <div className="stat-item-box">
              <span>Streak</span>
              <strong>{sessionCountAllTime > 0 ? '🔥 ' + Math.min(sessionCountAllTime, 3) : '0'}</strong>
            </div>
          </div>

          <div className="history-header-row">
            <h2>Recent Journeys</h2>
            {history.length > 0 && (
              <button className="text-action-btn" onClick={clearHistory}>Clear History</button>
            )}
          </div>

          <div className="history-cards-scroll">
            {history.length === 0 ? (
              <div className="history-row-card" style={{justifyContent: 'center'}}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No history logged yet. Complete a session!</span>
              </div>
            ) : (
              history.map((s) => (
                <div key={s.id} className="history-row-card">
                  <div className="hist-left">
                    <span className="hist-title">{s.name} {s.partial && '(partial)'}</span>
                    <span className="hist-meta">
                      {new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                    </span>
                  </div>
                  <span className="hist-right">{s.count.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Breathing Trainer Section */}
        {!isActive && (
          <section className="glass-panel breath-trainer-section">
            <h2 className="panel-title">Interactive Breath Guide & Pranayama</h2>
            
            <div className="breath-presets-row">
              {BREATH_PRESETS.map((bp, index) => (
                <button 
                  key={bp.name} 
                  className={`breath-preset-btn ${selectedBreathPreset === index ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedBreathPreset(index);
                    setBreathActive(false);
                    setBreathTimer(bp.inhale);
                    setBreathPhase('inhale');
                  }}
                >
                  {bp.name}
                </button>
              ))}
            </div>

            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 auto 1.5rem', maxWidth: '600px', lineHeight: '1.6' }}>
              {BREATH_PRESETS[selectedBreathPreset].description}
            </div>

            <div className="breath-center">
              <div className="breath-circle-container">
                {/* SVG Progress Ring for Breathing */}
                <svg className="progress-svg" style={{ width: 250, height: 250, transform: 'rotate(-90deg)' }}>
                  <circle className="progress-circle-bg" r={115} cx={125} cy={125} strokeWidth={2} />
                  {breathActive && (
                    <circle 
                      className="progress-circle-fill" 
                      r={115} 
                      cx={125} 
                      cy={125} 
                      strokeWidth={4}
                      stroke={currentBreathColor}
                      strokeDasharray={2 * Math.PI * 115}
                      strokeDashoffset={2 * Math.PI * 115 * (1 - (breathTimer / getPhaseDuration(breathPhase, BREATH_PRESETS[selectedBreathPreset])))}
                      style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease', filter: `drop-shadow(0 0 8px ${currentBreathColor}99)` }}
                    />
                  )}
                </svg>

                <div 
                  className="breath-circle" 
                  style={{
                    transform: `scale(${scale})`,
                    transition: breathActive ? `transform ${transitionSec}s linear` : 'transform 0.5s ease',
                    '--breath-color': currentBreathColor
                  } as React.CSSProperties}
                >
                  <span className="breath-label">
                    {breathActive ? `${breathPhase === 'holdExhale' ? 'hold' : breathPhase}` : 'Ready'}
                  </span>
                </div>
              </div>

              <div className="breath-timer-display">
                {breathActive ? breathTimer : '—'}
              </div>

              <button 
                className="begin-journey-btn" 
                style={{ maxWidth: '260px', background: breathActive ? 'rgba(255,255,255,0.04)' : undefined, border: breathActive ? '1px solid rgba(255,255,255,0.08)' : undefined }} 
                onClick={toggleBreathTrainer}
              >
                {breathActive ? 'Pause Breath Work' : 'Start Breath Work'}
              </button>
            </div>
          </section>
        )}

        {/* FAQs */}
        {!isActive && (
          <section className="glass-panel faq-section">
            <h2 className="panel-title">Frequently Asked Questions</h2>
            <div className="faq-list">
              {FAQ_ITEMS.map((faq, index) => (
                <div 
                  key={index} 
                  className={`faq-item ${openFaq === index ? 'open' : ''}`}
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                >
                  <div className="faq-question-row">
                    <span className="faq-question">{faq.question}</span>
                    <span className="faq-icon">▼</span>
                  </div>
                  <div className="faq-answer">{faq.answer}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* MEDITATIVE INFO SECTION */}
      <section className="info-section">
        <div className="info-grid">
          <div className="info-card">
            <h3>The Art of Mantra Chanting</h3>
            <p>
              Mantra chanting is an ancient practice that utilizes sound frequencies to calm the nervous system, lower stress levels, and focus the wandering mind. Repeating sacred vibrations helps redirect focus away from mental clutter and grounds your consciousness.
            </p>
            <p>
              By setting a rhythmic tick interval with ChantAura, you establish a steady breathing pattern. Exhaling or reciting a mantra in synchrony with the gentle chime coordinates sound and pranayama breath-work effortlessly.
            </p>
          </div>

          <div className="info-card">
            <h3>How ChantAura Handles Background Counting</h3>
            <p>
              Standard javascript timers (`setInterval`) are paused or throttled by modern mobile operating systems and browsers when a tab is inactive or the phone screen locks. 
            </p>
            <p>
              ChantAura solves this using relative delta-timestamps. When you return or refocus:
            </p>
            <ul>
              <li>The engine measures absolute time differences: `now - startTimestamp`</li>
              <li>It instantly catches up to the exact mathematical count</li>
              <li>Saves progress locally so no chants are ever lost</li>
              <li>Uses Web Audio synthesis to keep chimes firing smoothly</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer Quote Card */}
      <footer className="quote-footer">
        <div className="quote-card">
          <div className="quote-icon">“</div>
          <div className="quote-display">{quote}</div>
          <div className="quote-btn-container">
            <button className="quote-refresh-btn" onClick={cycleQuote}>Next Reflection</button>
          </div>
        </div>
        <p style={{ fontSize: '0.85rem', marginTop: '2rem', opacity: 0.6 }}>
          © {new Date().getFullYear()} ChantAura. All rights reserved. Designed for mindful living.
        </p>
      </footer>
    </>
  );
};

export default App;
