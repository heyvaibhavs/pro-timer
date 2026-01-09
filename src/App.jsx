import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Clock, Bell, AlertCircle, History, RefreshCcw } from 'lucide-react';

// Utility to format timestamps to readable time string (12:30:45 PM)
const formatTimeOfDay = (timestamp) => {
  if (!timestamp) return '--:--:--';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// Utility to format duration for the MAIN DISPLAY (MM:SS.ms)
const formatDuration = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
};

// NEW: Utility for CLEAR, SIMPLE summary (e.g., "1m 5s")
const formatDurationSimple = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds} sec`;
};

export default function StopwatchApp() {
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [stopTime, setStopTime] = useState(null);
  const [currentTime, setCurrentTime] = useState(null);
  const [alarmDuration, setAlarmDuration] = useState(15); // Default 15 minutes
  const [alarmTriggeredTime, setAlarmTriggeredTime] = useState(null);
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);

  const timerRef = useRef(null);
  const alarmIntervalRef = useRef(null);
  const audioCtxRef = useRef(null); // Keep one audio context alive

  // Initialize AudioContext once on mount
  useEffect(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtxRef.current = new AudioContext();
    }
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    };
  }, []);

  // Optimized Sound Player
  const playAlarmSound = () => {
    try {
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const t = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'square';
      osc2.type = 'square';

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

  // Main Timer Loop
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        setCurrentTime(now);

        // Check Alarm
        if (startTime && !alarmTriggeredTime) {
          const elapsed = now - startTime;
          // Ensure we handle empty string case safely by defaulting to 0
          const durationVal = Number(alarmDuration) || 0;
          const alarmMs = durationVal * 60 * 1000;
          
          if (durationVal > 0 && elapsed >= alarmMs) {
            triggerAlarm(now);
          }
        }
      }, 50); 
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, startTime, alarmDuration, alarmTriggeredTime]);

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

  const handleStart = () => {
    const now = Date.now();
    
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    stopAlarm();
    setStartTime(now);
    setCurrentTime(now);
    setStopTime(null);
    setAlarmTriggeredTime(null);
    setIsRunning(true);
  };

  const handleStop = () => {
    setStopTime(Date.now());
    setIsRunning(false);
    stopAlarm();
  };

  const handleReset = () => {
    setIsRunning(false);
    setStartTime(null);
    setStopTime(null);
    setCurrentTime(null);
    setAlarmTriggeredTime(null);
    stopAlarm();
  };

  // New handler for input to allow clearing it completely
  const handleInputChange = (e) => {
    const val = e.target.value;
    if (val === '') {
      setAlarmDuration(''); // Allow empty string to clear the box
    } else {
      // Only set if it's a valid number
      setAlarmDuration(val);
    }
  };

  const currentDuration = startTime && currentTime ? currentTime - startTime : 0;
  const finalDuration = startTime && stopTime ? stopTime - startTime : 0;
  const displayDuration = isRunning ? currentDuration : finalDuration;
  
  const durationVal = Number(alarmDuration) || 0;
  const progress = durationVal > 0 ? Math.min((displayDuration / (durationVal * 60 * 1000)) * 100, 100) : 0;

  return (
    <div className={`min-h-screen transition-colors duration-500 flex flex-col items-center justify-center p-4 font-sans ${isAlarmRinging ? 'bg-red-50' : 'bg-slate-50'}`}>
      
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        
        {/* Header */}
        <div className={`p-6 text-center transition-colors duration-300 ${isAlarmRinging ? 'bg-red-500 text-white' : 'bg-slate-800 text-white'}`}>
          <h1 className="text-2xl font-bold tracking-wider flex items-center justify-center gap-2">
            {isAlarmRinging ? <Bell className="animate-bounce" /> : <Clock />}
            PRO TIMER
          </h1>
          <p className="text-slate-300 text-sm mt-1">Simple Stopwatch with Alarm</p>
        </div>

        {/* Alarm Settings */}
        <div className="p-6 border-b border-slate-100">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">
            Set Alarm (Minutes)
          </label>
          <div className="flex gap-2 mb-3">
            {[10, 15, 20].map((mins) => (
              <button
                key={mins}
                onClick={() => !isRunning && setAlarmDuration(mins)}
                disabled={isRunning}
                className={`flex-1 py-3 px-3 rounded-lg text-sm font-bold transition-all ${
                  Number(alarmDuration) === mins 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50'
                }`}
              >
                {mins} Mins
              </button>
            ))}
          </div>
          <div className="relative">
            <input
              type="number"
              value={alarmDuration}
              onChange={handleInputChange}
              disabled={isRunning}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-3 px-3 pl-10 pr-12 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all"
              placeholder="0"
            />
            <Bell className="w-4 h-4 text-slate-400 absolute left-3 top-4" />
            <span className="absolute right-3 top-3.5 text-xs text-slate-400 font-bold bg-slate-100 px-2 py-1 rounded">MIN</span>
          </div>
        </div>

        {/* Main Display */}
        <div className="p-8 text-center relative">
          <div className="w-full h-3 bg-slate-100 rounded-full mb-6 overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${isAlarmRinging ? 'bg-red-500' : 'bg-blue-500'}`} 
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          <div className={`text-5xl sm:text-6xl font-mono font-bold tabular-nums mb-2 ${isAlarmRinging ? 'text-red-500 animate-pulse' : 'text-slate-800'}`}>
            {formatDuration(displayDuration)}
          </div>
          <div className="text-slate-400 font-bold text-sm uppercase tracking-widest">
            {isRunning ? 'RUNNING...' : 'STOPPED'}
          </div>

          {/* Alarm Triggered Notification */}
          {alarmTriggeredTime && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm font-bold animate-in fade-in slide-in-from-bottom-2 border border-red-200">
              <AlertCircle size={16} />
              ALARM STARTED AT {formatTimeOfDay(alarmTriggeredTime)}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 gap-4 px-6 pb-6">
          {!isRunning ? (
            <button
              onClick={handleStart}
              className="col-span-1 bg-green-500 hover:bg-green-600 active:scale-95 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-200 text-xl"
            >
              <Play fill="currentColor" size={24} /> START
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="col-span-1 bg-red-500 hover:bg-red-600 active:scale-95 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-200 text-xl"
            >
              <Square fill="currentColor" size={24} /> STOP
            </button>
          )}

          <button
            onClick={handleReset}
            disabled={isRunning && !startTime}
            className="col-span-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all text-lg"
          >
            <RefreshCcw size={20} /> RESET
          </button>
        </div>

        {/* Data Grid */}
        <div className="bg-slate-50 border-t border-slate-100 p-6">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
            <History size={16} /> Session Details
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Column 1: Start Info */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="block text-xs text-slate-400 font-bold mb-1 uppercase">Started At</span>
              <span className="block text-xl font-bold text-slate-800">
                {formatTimeOfDay(startTime)}
              </span>
            </div>

            {/* Column 2: Stop Info */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="block text-xs text-slate-400 font-bold mb-1 uppercase">Stopped At</span>
              <span className={`block text-xl font-bold ${stopTime ? 'text-slate-800' : 'text-slate-300'}`}>
                {formatTimeOfDay(stopTime)}
              </span>
            </div>
          </div>

          {/* Summary Footer */}
          {(stopTime || alarmTriggeredTime) && (
            <div className="mt-4 grid grid-cols-2 gap-4">
               {/* Alarm Ring Time */}
               <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <span className="block text-xs text-red-500 font-bold uppercase mb-1">Alarm Rang At</span>
                <span className="block text-lg font-black text-red-700 leading-none">
                  {formatTimeOfDay(alarmTriggeredTime)}
                </span>
              </div>

              {/* Total Duration */}
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <span className="block text-xs text-blue-500 font-bold uppercase mb-1">Total Time</span>
                <span className="block text-lg font-black text-blue-700 leading-none">
                  {formatDurationSimple(displayDuration)}
                </span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}