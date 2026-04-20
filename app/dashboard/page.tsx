'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  "What should I focus on today?",
  "How's my week looking?",
  "Remind me about my internship Tuesday",
  "What should I eat before my run tonight?",
  "Help me plan tomorrow",
];

export default function Dashboard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const content = data.text || data.error || 'No response — try again.';
      setMessages(prev => [...prev, { role: 'assistant', content }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong — try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  function startVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      sendMessage(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const isFirstMessage = messages.length === 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
            <span className="text-[#0a0a0a] font-bold text-xs">W</span>
          </div>
          <span className="text-white font-semibold tracking-tight">Wit</span>
        </div>
        <span className="text-[#333] text-xs">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">

        {isFirstMessage && (
          <div className="flex flex-col gap-6 mt-8">
            <div className="text-center">
              <p className="text-[#555] text-sm mb-1">Good {getTimeOfDay()}, Nathan.</p>
              <p className="text-white text-xl font-medium tracking-tight">What&apos;s on your mind?</p>
            </div>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left bg-[#141414] text-[#888] text-sm rounded-xl px-4 py-3 hover:bg-[#1a1a1a] hover:text-white transition-colors border border-[#1e1e1e]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-white text-[#0a0a0a] rounded-br-sm'
                  : 'bg-[#141414] text-[#e0e0e0] rounded-bl-sm border border-[#1e1e1e]'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-[#444] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-[#444] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-[#444] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 pb-6 pt-2 border-t border-[#1a1a1a]">
        <div className="flex items-end gap-2 bg-[#141414] rounded-2xl border border-[#1e1e1e] px-4 py-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask Wit anything..."
            rows={1}
            className="flex-1 bg-transparent text-white text-sm placeholder:text-[#444] outline-none resize-none leading-relaxed"
            style={{ maxHeight: '120px' }}
          />
          <div className="flex items-center gap-2 pb-0.5">
            {/* Voice button */}
            <button
              onClick={startVoice}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                listening ? 'bg-red-500' : 'bg-[#2a2a2a] hover:bg-[#333]'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>
            {/* Send button */}
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-full bg-white flex items-center justify-center disabled:opacity-20 hover:bg-[#e0e0e0] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/>
                <polyline points="5 12 12 5 19 12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
