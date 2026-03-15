import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import { motion } from 'motion/react';
import { X, History, MessageSquare, Bot } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  createdAt: any;
}

interface ChatHistoryModalProps {
  user: User;
  onClose: () => void;
}

export function ChatHistoryModal({ user, onClose }: ChatHistoryModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, `users/${user.uid}/chatHistory`),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [user.uid]);

  return (
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
        className="bg-[#151619] border border-white/10 rounded-2xl p-6 w-full max-w-2xl shadow-2xl relative max-h-[85vh] flex flex-col"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-xl font-medium mb-6 flex items-center gap-2">
          <History className="w-5 h-5 text-orange-500" /> Chat History
        </h2>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4 flex flex-col-reverse">
          {messages.length === 0 ? (
            <p className="text-center text-white/40 text-sm py-4">No chat history yet. Start talking to your AI friend!</p>
          ) : (
            messages.map(msg => (
              <div 
                key={msg.id} 
                className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-orange-600' : 'bg-indigo-600'}`}>
                  {msg.role === 'user' ? <MessageSquare className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                </div>
                <div className={`p-3 rounded-2xl ${msg.role === 'user' ? 'bg-orange-600/20 border border-orange-500/20 text-orange-50' : 'bg-white/5 border border-white/10 text-white/90'}`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                  {msg.createdAt && (
                    <p className="text-[10px] text-white/40 mt-1 text-right">
                      {msg.createdAt.toDate ? msg.createdAt.toDate().toLocaleString() : 'Just now'}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
