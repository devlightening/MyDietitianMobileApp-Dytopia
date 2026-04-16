import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'messages.json');

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  createdAt: string;
  read: boolean;
}

async function ensureFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, '[]', 'utf-8');
  }
}

export async function getMessages(): Promise<ContactMessage[]> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function addMessage(
  data: Omit<ContactMessage, 'id' | 'createdAt' | 'read'>
): Promise<ContactMessage> {
  const messages = await getMessages();
  const newMsg: ContactMessage = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    read: false,
  };
  messages.unshift(newMsg);
  await fs.writeFile(DATA_FILE, JSON.stringify(messages, null, 2), 'utf-8');
  return newMsg;
}

export async function markAsRead(id: string): Promise<void> {
  const messages = await getMessages();
  const msg = messages.find((m) => m.id === id);
  if (msg) msg.read = true;
  await fs.writeFile(DATA_FILE, JSON.stringify(messages, null, 2), 'utf-8');
}

export async function deleteMessage(id: string): Promise<void> {
  const messages = await getMessages();
  const filtered = messages.filter((m) => m.id !== id);
  await fs.writeFile(DATA_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
}
