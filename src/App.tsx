/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type } from '@google/genai';
import { Mic, MicOff, Loader2, Volume2, Phone, MessageSquare, LogIn, LogOut, Settings, X, Users, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AudioRecorder, AudioPlayer } from './lib/audioUtils';
import { AnimeCharacter } from './components/AnimeCharacter';
import { ContactsModal } from './components/ContactsModal';
import { ChatHistoryModal } from './components/ChatHistoryModal';
import { auth, db, signInWithGoogle, logOut } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, getDoc, addDoc, serverTimestamp, increment, collection, query, onSnapshot } from 'firebase/firestore';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [actionText, setActionText] = useState<string | null>(null);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [language, setLanguage] = useState(() => localStorage.getItem('ai_language') || 'Hinglish');
  const [customInstructions, setCustomInstructions] = useState(() => localStorage.getItem('ai_instructions') || "You are an anime character and the user's best friend. Speak casually. Use words like 'yaar', 'bhai', 'dost'.");
  
  // Firebase Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [contactsList, setContactsList] = useState<{name: string, phoneNumber: string}[]>([]);
  const [memoriesList, setMemoriesList] = useState<string[]>([]);

  const sessionRef = useRef<any>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Contacts & Memories
  useEffect(() => {
    if (!user) {
      setContactsList([]);
      setMemoriesList([]);
      return;
    }
    
    // Contacts
    const qContacts = query(collection(db, `users/${user.uid}/contacts`));
    const unsubContacts = onSnapshot(qContacts, (snapshot) => {
      const contactsData: {name: string, phoneNumber: string}[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        contactsData.push({ name: data.name, phoneNumber: data.phoneNumber });
      });
      setContactsList(contactsData);
    });

    // Memories
    const qMemories = query(collection(db, `users/${user.uid}/memories`));
    const unsubMemories = onSnapshot(qMemories, (snapshot) => {
      const memoriesData: string[] = [];
      snapshot.forEach((doc) => {
        memoriesData.push(doc.data().fact);
      });
      setMemoriesList(memoriesData);
    });

    return () => {
      unsubContacts();
      unsubMemories();
    };
  }, [user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  // Save settings to local storage
  useEffect(() => {
    localStorage.setItem('ai_language', language);
    localStorage.setItem('ai_instructions', customInstructions);
  }, [language, customInstructions]);

  const handleFirestoreError = (err: unknown, operation: string) => {
    console.error(`Firestore Error during ${operation}:`, err);
    // In a real app, you might want to show a toast or alert here
  };

  const updateUserProfile = async (currentUser: User) => {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        await setDoc(userRef, {
          uid: currentUser.uid,
          displayName: currentUser.displayName || 'User',
          email: currentUser.email || '',
          photoURL: currentUser.photoURL || '',
          lastConnectedAt: serverTimestamp(),
          totalConnections: increment(1)
        }, { merge: true });
      } else {
        await setDoc(userRef, {
          uid: currentUser.uid,
          displayName: currentUser.displayName || 'User',
          email: currentUser.email || '',
          photoURL: currentUser.photoURL || '',
          lastConnectedAt: serverTimestamp(),
          totalConnections: 1
        });
      }
    } catch (err) {
      handleFirestoreError(err, 'updateUserProfile');
    }
  };

  const connect = async () => {
    if (!user) {
      setError("Please sign in first to chat with your Anime Friend.");
      return;
    }

    setIsConnecting(true);
    setError(null);
    setActionText(null);
    
    // Update user stats in Firestore
    await updateUserProfile(user);

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
          systemInstruction: `You are a smart AI assistant. The user's name is ${user.displayName?.split(' ')[0] || 'friend'}. 
Language to use: ${language}.
Custom Instructions from user: ${customInstructions}
User's Saved Contacts: ${contactsList.length > 0 ? contactsList.map(c => `${c.name}: ${c.phoneNumber}`).join(', ') : 'No contacts saved.'}
User's Saved Memories & Training: ${memoriesList.length > 0 ? memoriesList.join(' | ') : 'No memories saved yet.'}

IMPORTANT: 
1. Respond INSTANTLY and quickly. Keep responses UNDER 10 words to minimize delay. 
2. You have perfect memory of this conversation. 
3. If the user asks you to call or message someone, check their Saved Contacts list first. If the name is there, use the provided tools to call/message that number. If not, ask for their number.
4. TONE MATCHING: Pay close attention to how the user speaks (their tone, slang, energy level, and vocabulary) and mirror it. If they are excited, be excited. If they use slang, use similar slang.
5. TRAINING & MEMORY: If the user tells you to remember something, or tells you how to behave, call the 'saveMemory' tool immediately to save it.
6. CHAT HISTORY: Call the 'logConversation' tool frequently to save the ongoing chat history so the user can view it later. Pass what the user said and what you replied.`,
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
              },
              {
                name: "saveMemory",
                description: "Save a fact, preference, or training instruction about the user so you remember it in future sessions.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    fact: { type: Type.STRING, description: "The fact or instruction to remember" }
                  },
                  required: ["fact"]
                }
              },
              {
                name: "logConversation",
                description: "Save a part of the conversation to the chat history.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    userMessage: { type: Type.STRING, description: "What the user just said" },
                    aiResponse: { type: Type.STRING, description: "What you replied" }
                  },
                  required: ["userMessage", "aiResponse"]
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
                  } else if (call.name === 'saveMemory') {
                    setActionText(`Saving memory...`);
                    addDoc(collection(db, `users/${user.uid}/memories`), {
                      uid: user.uid,
                      fact: args.fact,
                      createdAt: serverTimestamp()
                    }).then(() => {
                      sessionPromise.then(session => {
                        session.sendToolResponse({
                          functionResponses: [{
                            name: call.name,
                            id: call.id,
                            response: { result: "Memory saved successfully." }
                          }]
                        });
                      });
                    });
                  } else if (call.name === 'logConversation') {
                    // Save user message
                    addDoc(collection(db, `users/${user.uid}/chatHistory`), {
                      uid: user.uid,
                      role: 'user',
                      text: args.userMessage,
                      createdAt: serverTimestamp()
                    }).then(() => {
                      // Save AI response
                      addDoc(collection(db, `users/${user.uid}/chatHistory`), {
                        uid: user.uid,
                        role: 'ai',
                        text: args.aiResponse,
                        createdAt: serverTimestamp()
                      });
                    }).then(() => {
                      sessionPromise.then(session => {
                        session.sendToolResponse({
                          functionResponses: [{
                            name: call.name,
                            id: call.id,
                            response: { result: "Conversation logged successfully." }
                          }]
                        });
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

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#0a0502] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0502] text-white flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Atmospheric background */}
      <div className="absolute inset-0 z-0 opacity-60 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header / Auth */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20">
        <div className="flex gap-2">
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-colors text-white/70 hover:text-white"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          {user && (
            <>
              <button 
                onClick={() => setShowContacts(true)}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-colors text-white/70 hover:text-white"
                title="My Contacts"
              >
                <Users className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setShowHistory(true)}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-colors text-white/70 hover:text-white"
                title="Chat History"
              >
                <History className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {user ? (
          <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-full border border-white/10">
            <div className="flex items-center gap-2">
              {user.photoURL && (
                <img src={user.photoURL} alt="Profile" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
              )}
              <span className="text-sm text-white/80">{user.displayName?.split(' ')[0]}</span>
            </div>
            <button onClick={logOut} className="text-white/50 hover:text-white transition-colors" title="Sign Out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button 
            onClick={signInWithGoogle}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full border border-white/10 transition-colors text-sm"
          >
            <LogIn className="w-4 h-4" /> Sign In
          </button>
        )}
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#151619] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
            >
              <button 
                onClick={() => setShowSettings(false)}
                className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h2 className="text-xl font-medium mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-orange-500" /> AI Settings
              </h2>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Language (Bhasha)
                  </label>
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors appearance-none"
                  >
                    <option value="Hinglish">Hinglish (Hindi + English)</option>
                    <option value="Hindi">Hindi (Pure)</option>
                    <option value="Bhojpuri">Bhojpuri</option>
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Custom Instructions (Train your AI)
                  </label>
                  <textarea 
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="E.g., Act like a professional coding expert..."
                    rows={4}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors resize-none text-sm"
                  />
                  <p className="text-xs text-white/40 mt-2">
                    Tell the AI how to behave. It will remember this and previous questions in the chat.
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setShowSettings(false)}
                className="w-full mt-6 bg-orange-600 hover:bg-orange-500 text-white font-medium py-3 rounded-xl transition-colors"
              >
                Save & Close
              </button>
            </motion.div>
          </motion.div>
        )}

        {showContacts && user && (
          <ContactsModal user={user} onClose={() => setShowContacts(false)} />
        )}

        {showHistory && user && (
          <ChatHistoryModal user={user} onClose={() => setShowHistory(false)} />
        )}
      </AnimatePresence>

      <div className="z-10 flex flex-col items-center max-w-md w-full mt-12">
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

          {!user ? (
            <button
              onClick={signInWithGoogle}
              className="relative overflow-hidden group px-8 py-4 rounded-full font-medium tracking-wide transition-all duration-300 bg-orange-600 text-white hover:bg-orange-500 shadow-[0_0_20px_rgba(234,88,12,0.4)]"
            >
              <span className="relative z-10 flex items-center gap-2">
                <LogIn className="w-4 h-4" /> Sign in with Google to Chat
              </span>
            </button>
          ) : (
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
          )}
          
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
