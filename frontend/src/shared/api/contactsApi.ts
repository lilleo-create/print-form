import { Contact } from '../types';
import { loadFromStorage, saveToStorage } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';

const getContacts = () => loadFromStorage<Contact[]>(STORAGE_KEYS.contacts, []);

export const contactsApi = {
  listByUser: async (userId: string) => {
    const contacts = getContacts();
    return contacts.filter((contact) => contact.userId === userId);
  },
  create: async (payload: Omit<Contact, 'id' | 'createdAt'>) => {
    const contacts = getContacts();
    const newContact: Contact = {
      ...payload,
      id: `contact-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    saveToStorage(STORAGE_KEYS.contacts, [newContact, ...contacts]);
    return newContact;
  }
};
