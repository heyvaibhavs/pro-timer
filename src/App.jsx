import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Clock, Bell, AlertCircle, RefreshCcw, Coffee, Utensils, History } from 'lucide-react';

// --- UTILITIES ---

const formatTimeOfDay = (timestamp) => {
  if (!timestamp) return '--:--:--';
  // Forces 12-hour format (AM/PM) and Indian Standard Time (IST)
  return new Date(timestamp).toLocaleTimeString('en-IN', { 
    timeZone: 'Asia/Kolkata',
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: true
  });
};

const formatDuration = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
};

const formatDurationSimple = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds} sec`;
};

// --- SINGLE TIMER COMPONENT ---

const SingleTimer = ({ id, label, Icon, audioCtxRef }) => {
  const [isRunning, setIsRunning] = useState(false);
  // Time state
  const [startTime, setStartTime] = useState(null); // When current session started
  const [accumulatedTime, setAccumulatedTime] = useState(0); // Time from previous sessions
  const [displayTime, setDisplayTime] = useState(0); // Total duration to show
  
  // Stats state
  const [sessionStartTime, setSessionStartTime] = useState(null); // Very first start
  const [stopTime, setStopTime] = useState(null);

  // Alarm state
  const [alarmDuration, setAlarmDuration] = useState(15);
  const [alarmTriggeredTime, setAlarmTriggeredTime] = useState(null);
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);

  const timerRef = useRef(null);
  const alarmIntervalRef = useRef(null);

  // Sound Player
  const playAlarmSound = () => {
    try {
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const t = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'square';
      osc2.type = 'square';
      // Different pitch for Timer A vs Timer B? Let's keep them same for "Alarm" urgency
      osc1.frequency.setValueAtTime(800, t);
      osc2.frequency.setValueAtTime(840, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.05); 
      gain.gain.setValueAtTime(0.1, t + 0.5);
      gain.gain.linearRampToValueAtTime(0, t + 0.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.6);
      osc2.stop(t + 0.6);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  const triggerAlarm = (timestamp) => {
    setAlarmTriggeredTime(timestamp);
    setIsAlarmRinging(true);
    playAlarmSound();
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    alarmIntervalRef.current = setInterval(playAlarmSound, 1000);
  };

  const stopAlarm = () => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    setIsAlarmRinging(false);
  };

  // Timer Logic
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const currentSessionDuration = now - startTime;
        const totalDuration = accumulatedTime + currentSessionDuration;
        
        setDisplayTime(totalDuration);

        // Check Alarm
        if (!alarmTriggeredTime) {
          const durationVal = Number(alarmDuration) || 0;
          const alarmMs = durationVal * 60 * 1000;
          if (durationVal > 0 && totalDuration >= alarmMs) {
            triggerAlarm(now);
          }
        }
      }, 50);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, startTime, accumulatedTime, alarmDuration, alarmTriggeredTime]);

  // Handlers
  const handleStart = () => {
    const now = Date.now();
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();

    if (!sessionStartTime) setSessionStartTime(now); // Set first start time only once
    
    setStartTime(now);
    setIsRunning(true);
    setStopTime(null); // Clear stop time when resuming
  };

  const handleStop = () => {
    const now = Date.now();
    const currentSessionDuration = now - startTime;
    setAccumulatedTime(prev => prev + currentSessionDuration);
    setStopTime(now);
    setIsRunning(false);
    stopAlarm();
  };

  const handleReset = () => {
    setIsRunning(false);
    setStartTime(null);
    setAccumulatedTime(0);
    setDisplayTime(0);
    setSessionStartTime(null);
    setStopTime(null);
    setAlarmTriggeredTime(null);
    stopAlarm();
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setAlarmDuration(val === '' ? '' : val);
  };

  const durationVal = Number(alarmDuration) || 0;
  const progress = durationVal > 0 ? Math.min((displayTime / (durationVal * 60 * 1000)) * 100, 100) : 0;
  const hasStarted = sessionStartTime !== null;

  return (
    <div className={`mb-4 flex flex-col rounded-3xl shadow-lg border border-slate-100 overflow-hidden transition-colors duration-500 ${isAlarmRinging ? 'bg-red-50 ring-4 ring-red-200' : 'bg-white'}`}>
      
      {/* Timer Header */}
      <div className={`p-4 flex items-center justify-between ${isAlarmRinging ? 'bg-red-500 text-white' : 'bg-slate-800 text-white'}`}>
        <div className="flex items-center gap-2 font-bold text-lg tracking-wide">
          <Icon size={20} />
          {label}
        </div>
        {isAlarmRinging && <Bell className="animate-bounce" size={20} />}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        
        {/* Alarm Input */}
        <div className="flex items-center gap-3 mb-4 bg-slate-50 p-2 rounded-xl border border-slate-100">
          <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">Alarm (Min):</span>
          <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar">
            {[15, 20, 30].map(m => (
              <button 
                key={m} 
                onClick={() => setAlarmDuration(m)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${Number(alarmDuration) === m ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'}`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="relative w-16 shrink-0">
             <input
              type="number"
              value={alarmDuration}
              onChange={handleInputChange}
              className="w-full bg-white border border-slate-200 rounded-lg py-1 px-1 text-center font-bold text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="0"
            />
          </div>
        </div>

        {/* Display */}
        <div className="text-center mb-6 relative">
          <div className="w-full h-3 bg-slate-100 rounded-full mb-4 overflow-hidden">
             <div className={`h-full transition-all duration-300 ${isAlarmRinging ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}></div>
          </div>
          <div className={`text-5xl font-mono font-bold tabular-nums tracking-tighter ${isAlarmRinging ? 'text-red-500 animate-pulse' : 'text-slate-800'}`}>
            {formatDuration(displayTime)}
          </div>
          
          {alarmTriggeredTime && (
            <div className="mt-2 text-xs font-bold text-red-600 flex items-center justify-center gap-1 animate-pulse">
              <AlertCircle size={12} /> ALARM RANG
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {!isRunning ? (
            <button
              onClick={handleStart}
              className={`py-4 rounded-xl font-bold flex items-center justify-center gap-2 text-white shadow-md active:scale-95 transition-all text-lg ${hasStarted ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
              <Play fill="currentColor" size={20} /> {hasStarted ? 'RESUME' : 'START'}
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all text-lg"
            >
              <Pause fill="currentColor" size={20} /> PAUSE
            </button>
          )}

          <button
            onClick={handleReset}
            disabled={!hasStarted}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-lg"
          >
            <RefreshCcw size={20} /> RESET
          </button>
        </div>

        {/* Stats Grid - Full Session Details */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
          <h4 className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center gap-1 tracking-wider">
            <History size={10} /> Session Details
          </h4>
          
          <div className="grid grid-cols-2 gap-2">
            {/* Start */}
            <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
               <span className="block text-[9px] text-slate-400 font-bold uppercase mb-0.5">Started At</span>
               <span className="font-mono text-sm font-bold text-slate-700">{formatTimeOfDay(sessionStartTime)}</span>
            </div>

            {/* Stop */}
            <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
               <span className="block text-[9px] text-slate-400 font-bold uppercase mb-0.5">Stopped At</span>
               <span className={`font-mono text-sm font-bold ${stopTime ? 'text-slate-700' : 'text-slate-300'}`}>
                 {formatTimeOfDay(stopTime)}
               </span>
            </div>

            {/* Alarm */}
            <div className={`bg-white p-2 rounded-lg border shadow-sm ${alarmTriggeredTime ? 'border-red-200 bg-red-50' : 'border-slate-100'}`}>
               <span className={`block text-[9px] font-bold uppercase mb-0.5 ${alarmTriggeredTime ? 'text-red-400' : 'text-slate-400'}`}>Alarm Rang</span>
               <span className={`font-mono text-sm font-bold ${alarmTriggeredTime ? 'text-red-600' : 'text-slate-300'}`}>
                 {formatTimeOfDay(alarmTriggeredTime)}
               </span>
            </div>

            {/* Total */}
            <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
               <span className="block text-[9px] text-slate-400 font-bold uppercase mb-0.5">Total Time</span>
               <span className="font-mono text-sm font-bold text-blue-600">{formatDurationSimple(displayTime)}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---

export default function StopwatchApp() {
  const audioCtxRef = useRef(null);

  useEffect(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtxRef.current = new AudioContext();
    }
    return () => {
      if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close();
    };
  }, []);

  return (
    // FULL SCREEN WRAPPER - Android App Feel
    <div className="h-screen w-full bg-slate-100 flex flex-col font-sans overflow-hidden">
      
      {/* Sticky Header */}
      <div className="bg-slate-900 text-white p-4 pt- safe-top shrink-0 z-10 shadow-lg flex items-center justify-between">
         <div>
           <h1 className="text-lg font-black tracking-wider flex items-center gap-2">
            <Clock className="text-blue-400" size={20} /> MOMSMADE KITCHEN
           </h1>
           <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">Production Timers</p>
         </div>
         <div className="bg-slate-800 px-2 py-1 rounded text-[10px] font-bold text-slate-300 border border-slate-700">
           v2.0
         </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-4 pb-20 no-scrollbar">
        <SingleTimer 
          id="timer1" 
          label="STATION A" 
          Icon={Utensils} 
          audioCtxRef={audioCtxRef} 
        />
        
        <SingleTimer 
          id="timer2" 
          label="STATION B" 
          Icon={Coffee} 
          audioCtxRef={audioCtxRef} 
        />
        
        <div className="text-center p-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            Screen stays active while timing
          </p>
        </div>
      </div>
      
    </div>
  );
}