import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import { motion } from 'motion/react';
import { X, Plus, Trash2, Phone } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
}

interface ContactsModalProps {
  user: User;
  onClose: () => void;
}

export function ContactsModal({ user, onClose }: ContactsModalProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const q = query(collection(db, `users/${user.uid}/contacts`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contactsData: Contact[] = [];
      snapshot.forEach((doc) => {
        contactsData.push({ id: doc.id, ...doc.data() } as Contact);
      });
      setContacts(contactsData);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    setIsAdding(true);
    try {
      await addDoc(collection(db, `users/${user.uid}/contacts`), {
        uid: user.uid,
        name: newName.trim(),
        phoneNumber: newPhone.trim(),
        createdAt: serverTimestamp()
      });
      setNewName('');
      setNewPhone('');
    } catch (error) {
      console.error("Error adding contact:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      await deleteDoc(doc(db, `users/${user.uid}/contacts`, contactId));
    } catch (error) {
      console.error("Error deleting contact:", error);
    }
  };

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
        className="bg-[#151619] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative max-h-[80vh] flex flex-col"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-xl font-medium mb-6 flex items-center gap-2">
          <Phone className="w-5 h-5 text-orange-500" /> My Contacts
        </h2>

        <form onSubmit={handleAddContact} className="mb-6 flex gap-2">
          <input 
            type="text" 
            placeholder="Name (e.g. Mummy)" 
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm"
            required
          />
          <input 
            type="tel" 
            placeholder="Phone Number" 
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm"
            required
          />
          <button 
            type="submit"
            disabled={isAdding}
            className="bg-orange-600 hover:bg-orange-500 text-white p-2 rounded-xl transition-colors disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>

        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
          {contacts.length === 0 ? (
            <p className="text-center text-white/40 text-sm py-4">No contacts saved yet. Add some above!</p>
          ) : (
            contacts.map(contact => (
              <div key={contact.id} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                <div>
                  <div className="font-medium text-sm">{contact.name}</div>
                  <div className="text-xs text-white/50">{contact.phoneNumber}</div>
                </div>
                <button 
                  onClick={() => handleDeleteContact(contact.id)}
                  className="text-red-400/50 hover:text-red-400 transition-colors p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
