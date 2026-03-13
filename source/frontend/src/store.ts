import { create } from 'zustand'

interface Settings {
    project_name: string;
    context_focus: string[];
}

interface Stats {
    files_count: number;
    total_size: number;
}

export interface Message {
    id: number;
    role: 'user' | 'system';
    content: string;
    filePath?: string;
    modifiedFiles?: string[];
}

interface AppState {
    currentFile: string | null;
    currentContent: string;
    settings: Settings;
    // Разделенные ключи обновления
    fileTreeKey: number;
    gitHistoryKey: number;
    
    stats: Stats;
    messages: Message[];
    setCurrentFile: (path: string | null, content: string) => void;
    setSettings: (s: Settings) => void;
    toggleFocus: (path: string, add: boolean) => void;
    
    // Обновленная сигнатура триггера
    triggerRefresh: (scope?: 'files' | 'git' | 'all') => void;
    loadStats: () => void;
    setMessages: (fn: (prev: Message[]) => Message[]) => void;
    clearMessages: () => void;
}

const isParentSelected = (path: string, focus: string[]) => {
    return focus.some(p => !p.startsWith('!') && path.startsWith(p + '/'));
};

export const useStore = create<AppState>((set, get) => ({
    currentFile: null,
    currentContent: "",
    settings: { project_name: "Loading...", context_focus: [] },
    
    fileTreeKey: 0,
    gitHistoryKey: 0,
    
    stats: { files_count: 0, total_size: 0 },
    messages: [],

    setCurrentFile: (path, content) => set({ currentFile: path, currentContent: content }),
    
    setSettings: (s) => set({ settings: s }),
    
    toggleFocus: (path, add) => {
        const s = get().settings;
        let newFocus = [...s.context_focus];
      
        const targetsPathOrChildren = (p: string) => {
            const cleanP = p.startsWith('!') ? p.slice(1) : p;
            if (cleanP === path) return true;
            if (cleanP.startsWith(path + '/')) return true;
            return false;
        };

        newFocus = newFocus.filter(p => !targetsPathOrChildren(p));
        if (add) {
            if (!isParentSelected(path, newFocus)) {
                newFocus.push(path);
            }
        } else {
            if (isParentSelected(path, newFocus)) {
                newFocus.push(`!${path}`);
                newFocus.push(`!${path}/**`);
            }
        }

        const newSettings = { ...s, context_focus: newFocus };
        set({ settings: newSettings });
        
        fetch('/api/settings', {
            method: 'POST',
            body: JSON.stringify(newSettings)
        }).then(() => {
            get().triggerRefresh('files');
        }).catch(err => {
            console.error("Failed to save settings:", err);
        });
    },

    // Умное обновление в зависимости от скоупа
    triggerRefresh: (scope = 'all') => {
        set((state) => {
            const updates: Partial<AppState> = {};
            if (scope === 'files' || scope === 'all') {
                updates.fileTreeKey = state.fileTreeKey + 1;
                // Статистика относится к файлам
                setTimeout(() => get().loadStats(), 0);
            }
            if (scope === 'git' || scope === 'all') {
                updates.gitHistoryKey = state.gitHistoryKey + 1;
            }
            return updates;
        });
    },

    loadStats: () => {
        fetch('/api/fs/stats')
            .then(res => res.json())
            .then(data => set({ stats: data }))
            .catch(console.error);
    },

    setMessages: (fn) => set((state) => ({ messages: fn(state.messages) })),
    clearMessages: () => set({ messages: [] }),
}))