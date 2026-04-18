import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

export interface CustomPackItem {
  id: string;
  name: string;
}

export interface CustomPack {
  id: string;
  name: string;
  items: CustomPackItem[];
  createdAt: number;
}

const MAX_PACKS = 10;
const LIST_KEY = '@customPacks:list';
const packKey = (id: string) => `@customPacks:pack_${id}`;

async function loadList(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(LIST_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function saveList(ids: string[]): Promise<void> {
  await SecureStore.setItemAsync(LIST_KEY, JSON.stringify(ids));
}

async function loadPack(id: string): Promise<CustomPack | null> {
  try {
    const raw = await SecureStore.getItemAsync(packKey(id));
    return raw ? (JSON.parse(raw) as CustomPack) : null;
  } catch {
    return null;
  }
}

async function savePack(pack: CustomPack): Promise<void> {
  await SecureStore.setItemAsync(packKey(pack.id), JSON.stringify(pack));
}

async function deletePack(id: string): Promise<void> {
  await SecureStore.deleteItemAsync(packKey(id));
}

export function useCustomPacks() {
  const [packs, setPacks] = useState<CustomPack[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    const ids = await loadList();
    const results = await Promise.all(ids.map(loadPack));
    const valid = results.filter((p): p is CustomPack => p !== null);
    setPacks(valid);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const createPack = useCallback(async (name: string, items: CustomPackItem[]): Promise<boolean> => {
    const ids = await loadList();
    if (ids.length >= MAX_PACKS) return false;
    const id = `${Date.now()}`;
    const newPack: CustomPack = { id, name: name.trim(), items, createdAt: Date.now() };
    await savePack(newPack);
    const updatedIds = [...ids, id];
    await saveList(updatedIds);
    setPacks(prev => [...prev, newPack]);
    return true;
  }, []);

  const updatePack = useCallback(async (id: string, name: string, items: CustomPackItem[]): Promise<void> => {
    const existing = await loadPack(id);
    if (!existing) return;
    const updated: CustomPack = { ...existing, name: name.trim(), items };
    await savePack(updated);
    setPacks(prev => prev.map(p => (p.id === id ? updated : p)));
  }, []);

  const removePack = useCallback(async (id: string): Promise<void> => {
    await deletePack(id);
    const ids = await loadList();
    await saveList(ids.filter(i => i !== id));
    setPacks(prev => prev.filter(p => p.id !== id));
  }, []);

  return { packs, loading, createPack, updatePack, removePack, maxReached: packs.length >= MAX_PACKS };
}
