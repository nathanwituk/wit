'use client';

import { useState, useRef } from 'react';

interface Memory {
  category: string;
  key: string;
  value: string;
}

type State = 'idle' | 'recording' | 'processing' | 'done' | 'error';

const CATEGORY_COLORS: Record<string, string> = {
  health: '#4ade80',
  goals: '#facc15',
  projects: '#60a5fa',
  preferences: '#c084fc',
  schedule: '#fb923c',
  people: '#f472b6',
  daily_log: '#94a3b8',
};

export default function VoicePage() {
  const [state, setState] = useState<State>('idle');
  const [transcript, setTranscript] = useState('');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');

  function startRecording() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMsg('Speech recognition not supported on this browser. Try Chrome or Safari.');
      setState('error');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    transcriptRef.current = '';
    setTranscript('');
    setMemories([]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      let full = '';
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript + ' ';
      }
      transcriptRef.current = full.trim();
      setTranscript(full.trim());
    };

    recognition.onerror = () => {
      setState('error');
      setErrorMsg('Microphone error. Check permissions and try again.');
    };

    recognitionRef.current = recognition;
    recognition.start();
    setState('recording');
  }

  async function saveAndEnd() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    const text = transcriptRef.current;
    if (!text.trim()) {
      setState('idle');
      return;
    }

    setState('processing');

    try {
      const res = await fetch('/api/memories/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text, source: 'voice' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extraction failed');
      setMemories(data.memories || []);
      setState('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      setState('error');
    }
  }

  function reset() {
    setState('idle');
    setTranscript('');
    setMemories([]);
    setErrorMsg('');
    transcriptRef.current = '';
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#0a0a0a] px-5 py-6 overflow-y-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-white text-xl font-semibold tracking-tight">Memory Capture</h1>
        <p className="text-[#444] text-sm mt-1">Talk freely. Wit extracts and saves everything.</p>
      </div>

      {/* Idle state */}
      {state === 'idle' && (
        <div className="flex flex-col items-center justify-center flex-1 gap-6">
          <button
            onClick={startRecording}
            className="w-24 h-24 rounded-full bg-white flex items-center justify-center hover:bg-[#e0e0e0] transition-colors active:scale-95"
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>
          <p className="text-[#555] text-sm text-center">Tap to start recording.<br/>Talk about anything — your day, goals, what you&apos;re working on.</p>
        </div>
      )}

      {/* Recording state */}
      {state === 'recording' && (
        <div className="flex flex-col gap-6 flex-1">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-sm font-medium">Recording...</span>
          </div>

          <div className="flex-1 bg-[#111] rounded-2xl border border-[#1e1e1e] p-4 min-h-[160px]">
            <p className="text-[#888] text-sm leading-relaxed">
              {transcript || <span className="text-[#444]">Listening — start talking...</span>}
            </p>
          </div>

          <button
            onClick={saveAndEnd}
            className="w-full bg-white text-[#0a0a0a] rounded-2xl py-4 font-semibold text-sm hover:bg-[#e0e0e0] transition-colors active:scale-[0.98]"
          >
            Save & End
          </button>
        </div>
      )}

      {/* Processing state */}
      {state === 'processing' && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <div className="flex gap-1.5 items-center">
            <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-[#555] text-sm">Extracting memories...</p>
        </div>
      )}

      {/* Done state */}
      {state === 'done' && (
        <div className="flex flex-col gap-5 flex-1">
          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-medium">{memories.length} {memories.length === 1 ? 'memory' : 'memories'} saved</p>
            <button onClick={reset} className="text-[#555] text-sm hover:text-white transition-colors">New capture</button>
          </div>

          <div className="flex flex-col gap-3">
            {memories.map((m, i) => (
              <div key={i} className="bg-[#111] rounded-xl border border-[#1e1e1e] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{
                      color: CATEGORY_COLORS[m.category] || '#888',
                      backgroundColor: `${CATEGORY_COLORS[m.category] || '#888'}18`,
                    }}
                  >
                    {m.category.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-white text-sm font-medium mb-1">{m.key}</p>
                <p className="text-[#666] text-sm leading-relaxed">{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {state === 'error' && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <p className="text-red-400 text-sm text-center">{errorMsg}</p>
          <button onClick={reset} className="text-white text-sm underline">Try again</button>
        </div>
      )}
    </div>
  );
}
