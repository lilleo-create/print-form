import { Contact } from '../types';
import { loadFromStorage, saveToStorage } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';

const contactsKey = (userId: string) => `${STORAGE_KEYS.contacts}_${userId}`;

export const contactsApi = {
  listByUser: async (userId: string) => {
    return loadFromStorage<Contact[]>(contactsKey(userId), []);
  },
  create: async (payload: Omit<Contact, 'id' | 'createdAt'>) => {
    const existing = loadFromStorage<Contact[]>(contactsKey(payload.userId), []);
    const newContact: Contact = {
      ...payload,
      id: `contact-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    saveToStorage(contactsKey(payload.userId), [newContact, ...existing]);
    return newContact;
  },
  update: async (payload: Contact) => {
    const existing = loadFromStorage<Contact[]>(contactsKey(payload.userId), []);
    const next = existing.map((contact) => (contact.id === payload.id ? payload : contact));
    saveToStorage(contactsKey(payload.userId), next);
    return payload;
  }
};
