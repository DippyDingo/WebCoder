import { useEffect, useState } from 'react';
import { FileTree } from './components/FileTree';
import { CodeEditor } from './components/Editor';
import { Dashboard } from './components/Dashboard';
import { GitHistory } from './components/GitHistory';
import { ChatInterface } from './components/ChatInterface';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Toaster, toast } from 'sonner';
import { useStore } from './store';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Settings, Moon, Sun, FileText, Command, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function App() {
    const { setSettings, setCurrentFile, currentFile, fileTreeKey, clearMessages } = useStore();
    const [mode, setMode] = useState<'loading' | 'dashboard' | 'workspace'>('loading');
    const [projectName, setProjectName] = useState("");
    const [isDark, setIsDark] = useState(true);
    const { t } = useTranslation();

    const loadState = async () => {
        try {
            const r = await fetch(`/api/state?t=${Date.now()}`);
            const data = await r.json();
            setMode(data.mode);
            setProjectName(data.project_name);
            
            if (data.mode === 'workspace') {
                const s = await fetch(`/api/settings?t=${Date.now()}`).then(res => res.json());
                setSettings(s);
            }
        } catch (e) {
            console.error(e);
            setMode('dashboard');
        }
    };

    useEffect(() => {
        loadState();
    }, [fileTreeKey]);

    useEffect(() => {
        const savedTheme = localStorage.getItem("theme");
        const root = document.documentElement;
        if (savedTheme === "light") {
            root.classList.remove("dark");
            setIsDark(false);
        } else {
            root.classList.add("dark");
            setIsDark(true);
        }
    }, []);

    const closeProject = async () => {
        try {
            const response = await fetch('/api/project/close', { method: 'POST' });
            if (!response.ok) {
                throw new Error("Failed to close project");
            }
            setCurrentFile(null, "");
            clearMessages();
            setProjectName("");
            setMode('dashboard');
        } catch (e) {
            console.error(e);
            toast.error(t('common.error'));
        }
    };

    const toggleTheme = () => {
        const root = document.documentElement;
        if (isDark) {
            root.classList.remove('dark');
            localStorage.setItem("theme", "light");
            setIsDark(false);
        } else {
            root.classList.add('dark');
            localStorage.setItem("theme", "dark");
            setIsDark(true);
        }
    };

    const openSettings = () => {
        if (currentFile === ".aicoder/settings.json") return;
        setCurrentFile(".aicoder/settings.json", "");
    };

    const openPromptTemplate = () => {
        if (currentFile === ".aicoder/prompt.md") return;
        setCurrentFile(".aicoder/prompt.md", "");
    };

    const openSourceFile = async () => {
        if (currentFile === ".aicoder/source.txt") return;
        setCurrentFile(".aicoder/source.txt", "");
    };

    const downloadSourceFile = async () => {
        try {
            const res = await fetch(`/api/file?path=.aicoder/source.txt&t=${Date.now()}`);
            if (!res.ok) throw new Error("Failed");
            const data = await res.json();
            
            const blob = new Blob([data.content], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'source.txt';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (e) {
            toast.error(t('common.error'));
        }
    };

    return (
        <>
            {/* 1. LOADING STATE */}
            {mode === 'loading' && <div className="h-screen w-screen bg-background" />}

            {/* 2. DASHBOARD STATE */}
            {mode === 'dashboard' && <Dashboard onOpen={loadState} />}

            {/* 3. WORKSPACE STATE */}
            {mode === 'workspace' && (
                <div className="workspace-shell h-full w-full bg-background text-foreground overflow-hidden flex flex-col font-sans fixed inset-0">
                    {/* COMPACT HEADER */}
                    <header className="compact-header app-header border-b border-border/60">
                        <div className="flex min-w-0 items-center gap-3">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={closeProject} 
                                className="h-9 shrink-0 gap-2 rounded-full px-3 text-xs text-muted-foreground hover:bg-secondary/80 hover:text-foreground" 
                                title={t('app.back_dashboard')}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                <span>{t('dashboard.title')}</span>
                            </Button>
                            
                            <div className="min-w-0 flex items-center">
                                <div className="flex items-center gap-2">
                                    <Command className="h-4 w-4 shrink-0 text-emerald-500" />
                                    <span className="truncate text-sm font-medium tracking-tight text-foreground">{projectName}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                            <Button 
                                variant="secondary" 
                                size="sm" 
                                onClick={openSourceFile}
                                className="h-9 gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs font-mono text-emerald-100 hover:bg-emerald-500/20 hover:text-white"
                                title={t('app.source_txt')}
                            >
                                <FileText className="h-3.5 w-3.5" />
                                source.txt
                            </Button>

                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={downloadSourceFile}
                                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                                title={t('common.download')}
                            >
                                <Download className="h-4 w-4" />
                            </Button>

                            <div className="w-px h-4 bg-border/50 mx-1" />

                            <Button variant="ghost" size="sm" onClick={openPromptTemplate} className="h-9 gap-2 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground" title={t('app.prompt_template')}>
                                <FileText className="h-4 w-4" />
                                <span className="hidden xl:inline">{t('app.prompt_short')}</span>
                            </Button>

                            <Button variant="ghost" size="sm" onClick={openSettings} className="h-9 gap-2 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground" title={t('app.settings')}>
                                <Settings className="h-4 w-4" />
                                <span className="hidden xl:inline">{t('app.settings_short')}</span>
                            </Button>

                            <div className="w-px h-4 bg-border/50 mx-1" />

                            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9 text-muted-foreground hover:text-foreground" title={t('app.theme')}>
                                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                            </Button>
                        </div>
                    </header>

                    <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
                        {/* SIDEBAR: FILES */}
                        <ResizablePanel defaultSize={19} minSize={15} maxSize={30} className="workspace-sidebar flex flex-col border-r border-border/40">
                            <FileTree key={projectName} /> 
                        </ResizablePanel>
                        
                        <ResizableHandle className="w-[1px] bg-border/40 hover:bg-primary/50 transition-colors" />

                        {/* MAIN: EDITOR / CHAT */}
                        <ResizablePanel defaultSize={58} className="workspace-main bg-background">
                            {currentFile ? (
                                <CodeEditor />
                            ) : (
                                <ChatInterface />
                            )}
                        </ResizablePanel>

                        <ResizableHandle className="w-[1px] bg-border/40 hover:bg-primary/50 transition-colors" />

                        {/* SIDEBAR: GIT */}
                        <ResizablePanel defaultSize={23} minSize={20} maxSize={38} className="workspace-sidebar flex flex-col border-l border-border/40">
                             <GitHistory />
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </div>
            )}

            {/* GLOBAL TOASTER: Доступен во всех режимах */}
            <Toaster theme={isDark ? 'dark' : 'light'} className="font-sans" />
        </>
    );
}

export default App;
