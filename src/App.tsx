/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type } from '@google/genai';
import { Mic, MicOff, Loader2, Volume2, Phone, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';
import { AudioRecorder, AudioPlayer } from './lib/audioUtils';
import { AnimeCharacter } from './components/AnimeCharacter';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [actionText, setActionText] = useState<string | null>(null);

  const sessionRef = useRef<any>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const connect = async () => {
    setIsConnecting(true);
    setError(null);
    setActionText(null);
    try {
      // Initialize the Gemini API client right before connecting
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      
      recorderRef.current = new AudioRecorder();
      playerRef.current = new AudioPlayer();

      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are an anime character and the user's best friend. Speak casually in a mix of Hindi and English (Hinglish). Use words like 'yaar', 'bhai', 'dost'. IMPORTANT: Respond INSTANTLY. Keep responses UNDER 10 words. If the user asks you to call or message someone, ask for their number and use the provided tools to do it.",
          tools: [{
            functionDeclarations: [
              {
                name: "makeCall",
                description: "Initiate a phone call to a given phone number.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    phoneNumber: { type: Type.STRING, description: "The phone number to call" }
                  },
                  required: ["phoneNumber"]
                }
              },
              {
                name: "sendSMS",
                description: "Open the SMS app to send a message to a given phone number.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    phoneNumber: { type: Type.STRING, description: "The phone number to message" },
                    message: { type: Type.STRING, description: "The text message content" }
                  },
                  required: ["phoneNumber", "message"]
                }
              }
            ]
          }]
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            
            // Start capturing audio from microphone
            recorderRef.current?.start((base64) => {
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  media: { data: base64, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            }).catch(err => {
              setError("Microphone access denied or unavailable.");
              disconnect();
            });
          },
          onmessage: (message: LiveServerMessage) => {
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                // Handle incoming audio
                if (part.inlineData && part.inlineData.data) {
                  setIsSpeaking(true);
                  playerRef.current?.play(part.inlineData.data);
                  
                  if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
                  speakingTimeoutRef.current = setTimeout(() => setIsSpeaking(false), 300); 
                }
                
                // Handle Tool Calls (Mobile Tasks)
                if (part.functionCall) {
                  const call = part.functionCall;
                  const args = call.args as any;
                  
                  if (call.name === 'makeCall') {
                    setActionText(`Calling ${args.phoneNumber}...`);
                    window.open(`tel:${args.phoneNumber}`, '_self');
                    
                    sessionPromise.then(session => {
                      session.sendToolResponse({
                        functionResponses: [{
                          name: call.name,
                          id: call.id,
                          response: { result: "Call initiated on user's device." }
                        }]
                      });
                    });
                  } else if (call.name === 'sendSMS') {
                    setActionText(`Messaging ${args.phoneNumber}...`);
                    window.open(`sms:${args.phoneNumber}?body=${encodeURIComponent(args.message)}`, '_self');
                    
                    sessionPromise.then(session => {
                      session.sendToolResponse({
                        functionResponses: [{
                          name: call.name,
                          id: call.id,
                          response: { result: "SMS app opened on user's device." }
                        }]
                      });
                    });
                  }
                  
                  setTimeout(() => setActionText(null), 5000);
                }
              }
            }
            
            // Handle interruption (e.g., user starts speaking while AI is speaking)
            if (message.serverContent?.interrupted) {
              playerRef.current?.stop();
              setIsSpeaking(false);
            }
          },
          onclose: () => {
            disconnect();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError("Connection lost or error occurred.");
            disconnect();
          }
        }
      });
      
      sessionRef.current = sessionPromise;
    } catch (err: any) {
      console.error("Setup Error:", err);
      setError(err.message || "Failed to start conversation.");
      setIsConnecting(false);
      disconnect();
    }
  };

  const disconnect = () => {
    recorderRef.current?.stop();
    playerRef.current?.close();
    
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => {
        try { session.close(); } catch (e) {}
      });
      sessionRef.current = null;
    }
    
    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    setActionText(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0502] text-white flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Atmospheric background */}
      <div className="absolute inset-0 z-0 opacity-60 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="z-10 flex flex-col items-center max-w-md w-full">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-light tracking-tight mb-3">Anime Friend</h1>
          <p className="text-white/50 text-sm">Your fast, helpful companion</p>
        </motion.div>

        {/* Action Toast */}
        {actionText && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-full text-green-300 text-sm flex items-center gap-2"
          >
            {actionText.includes('Calling') ? <Phone className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
            {actionText}
          </motion.div>
        )}

        {/* Anime Character */}
        <AnimeCharacter isSpeaking={isSpeaking} isConnected={isConnected} isConnecting={isConnecting} />

        {/* Controls */}
        <div className="flex flex-col items-center gap-4 w-full">
          {error && (
            <div className="text-red-400 text-sm mb-4 bg-red-400/10 px-4 py-2 rounded-lg border border-red-400/20 text-center w-full">
              {error}
            </div>
          )}

          <button
            onClick={isConnected ? disconnect : connect}
            disabled={isConnecting}
            className={`
              relative overflow-hidden group px-8 py-4 rounded-full font-medium tracking-wide transition-all duration-300
              ${isConnected 
                ? 'bg-white/10 text-white hover:bg-white/20 border border-white/10' 
                : 'bg-orange-600 text-white hover:bg-orange-500 shadow-[0_0_20px_rgba(234,88,12,0.4)]'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <span className="relative z-10 flex items-center gap-2">
              {isConnecting ? (
                <>Connecting...</>
              ) : isConnected ? (
                <>
                  <MicOff className="w-4 h-4" /> End Conversation
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" /> Chat with Friend
                </>
              )}
            </span>
          </button>
          
          <p className="text-xs text-white/40 mt-4 text-center max-w-xs">
            {isConnected 
              ? "Listening... Ask me to call or message someone!" 
              : "Install this app on your phone to use calling & messaging features."}
          </p>
        </div>
      </div>
    </div>
  );
}
