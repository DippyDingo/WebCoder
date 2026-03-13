import { create } from 'zustand';

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
    fileTreeKey: number;
    gitHistoryKey: number;
    stats: Stats;
    messages: Message[];
    setCurrentFile: (path: string | null, content: string) => void;
    setSettings: (s: Settings) => void;
    toggleFocus: (path: string, add: boolean) => void;
    pruneFocusPath: (path: string) => Promise<void>;
    triggerRefresh: (scope?: 'files' | 'git' | 'all') => void;
    loadStats: () => void;
    setMessages: (fn: (prev: Message[]) => Message[]) => void;
    clearMessages: () => void;
}

const isParentSelected = (path: string, focus: string[]) => {
    return focus.some((value) => !value.startsWith('!') && path.startsWith(value + '/'));
};

export const useStore = create<AppState>((set, get) => ({
    currentFile: null,
    currentContent: '',
    settings: { project_name: '', context_focus: [] },
    fileTreeKey: 0,
    gitHistoryKey: 0,
    stats: { files_count: 0, total_size: 0 },
    messages: [],

    setCurrentFile: (path, content) => set({ currentFile: path, currentContent: content }),
    setSettings: (settings) => set({ settings }),

    toggleFocus: (path, add) => {
        const settings = get().settings;
        let newFocus = [...settings.context_focus];

        const targetsPathOrChildren = (value: string) => {
            const cleanValue = value.startsWith('!') ? value.slice(1) : value;
            return cleanValue === path || cleanValue.startsWith(path + '/');
        };

        newFocus = newFocus.filter((value) => !targetsPathOrChildren(value));

        if (add) {
            if (!isParentSelected(path, newFocus)) {
                newFocus.push(path);
            }
        } else if (isParentSelected(path, newFocus)) {
            newFocus.push(`!${path}`);
            newFocus.push(`!${path}/**`);
        }

        const newSettings = { ...settings, context_focus: newFocus };
        set({ settings: newSettings });

        fetch('/api/settings', {
            method: 'POST',
            body: JSON.stringify(newSettings),
        })
            .then(() => {
                get().triggerRefresh('files');
            })
            .catch((error) => {
                console.error('Failed to save settings:', error);
            });
    },

    pruneFocusPath: async (path) => {
        const settings = get().settings;
        const matchesPathOrChildren = (value: string) => {
            const cleanValue = value.startsWith('!') ? value.slice(1) : value;
            return cleanValue === path || cleanValue.startsWith(path + '/');
        };

        const newSettings = {
            ...settings,
            context_focus: settings.context_focus.filter((value) => !matchesPathOrChildren(value)),
        };

        set({ settings: newSettings });

        try {
            await fetch('/api/settings', {
                method: 'POST',
                body: JSON.stringify(newSettings),
            });
            get().triggerRefresh('files');
        } catch (error) {
            console.error('Failed to prune focus path:', error);
        }
    },

    triggerRefresh: (scope = 'all') => {
        set((state) => {
            const updates: Partial<AppState> = {};
            if (scope === 'files' || scope === 'all') {
                updates.fileTreeKey = state.fileTreeKey + 1;
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
            .then((res) => res.json())
            .then((data) => set({ stats: data }))
            .catch(console.error);
    },

    setMessages: (fn) => set((state) => ({ messages: fn(state.messages) })),
    clearMessages: () => set({ messages: [] }),
}));
