import { useState, useEffect, memo } from 'react';
import { ChevronRight, ChevronDown, FileCode, Folder, RefreshCw, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';

interface FileNode {
    name: string;
    path: string;
    is_dir: boolean;
    selected: boolean;
}

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const FileTreeSkeleton = () => (
    <div className="space-y-2 px-3 py-3">
        {[...Array(6)].map((_, i) => (
            <div key={i} className="flex h-[36px] items-center gap-2 rounded-lg px-2">
                <Skeleton className="h-6 w-6 rounded-md" />
                <Skeleton className="h-4 w-4 rounded-sm" />
                <Skeleton className="h-3.5 flex-1 rounded-sm" />
            </div>
        ))}
    </div>
);

const FileIcon = memo(({ name, isDir, isOpen }: { name: string; isDir: boolean; isOpen: boolean }) => {
    if (isDir) return <Folder size={14} className={cn("shrink-0 fill-current text-blue-500/80", isOpen && "text-blue-400")} />;
    if (name.endsWith('.md')) return <FileText size={14} className="shrink-0 text-yellow-500" />;
    if (name.endsWith('.json')) return <span className="w-[14px] shrink-0 text-center text-[10px] font-bold text-orange-400">{'{}'}</span>;
    if (name.endsWith('.ts') || name.endsWith('.tsx')) return <span className="w-[14px] shrink-0 text-center text-[10px] font-bold text-blue-400">TS</span>;
    if (name.endsWith('.go')) return <span className="w-[14px] shrink-0 text-center text-[10px] font-bold text-cyan-400">GO</span>;
    return <FileCode size={14} className="shrink-0 text-muted-foreground" />;
});

const FileTreeItem = memo(({ node, level }: { node: FileNode; level: number }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [children, setChildren] = useState<FileNode[]>([]);

    const setCurrentFile = useStore(s => s.setCurrentFile);
    const toggleFocus = useStore(s => s.toggleFocus);
    const currentFile = useStore(s => s.currentFile);
    const fileTreeKey = useStore(s => s.fileTreeKey);

    const isActive = currentFile === node.path;

    const fetchChildren = async () => {
        try {
            const res = await fetch(`/api/fs/list?path=${node.path}`);
            const data = await res.json();
            setChildren(Array.isArray(data) ? data : []);
        } catch {
            setChildren([]);
        }
    };

    const toggleFolder = async () => {
        if (!node.is_dir) return;
        if (!isOpen && children.length === 0) {
            await fetchChildren();
        }
        setIsOpen(prev => !prev);
    };

    const openFile = async () => {
        if (node.is_dir) {
            toggleFolder();
            return;
        }

        setCurrentFile(node.path, "Loading...");
        try {
            const res = await fetch(`/api/file?path=${node.path}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to load file");
            setCurrentFile(node.path, data.content ?? "");
        } catch {
            setCurrentFile(node.path, "Error loading file");
        }
    };

    useEffect(() => {
        if (isOpen && node.is_dir) {
            fetchChildren();
        }
    }, [fileTreeKey, isOpen, node.path, node.is_dir]);

    const handleCheck = (checked: boolean) => {
        toggleFocus(node.path, checked);
    };

    return (
        <div>
            <div
                className={cn(
                    "group mx-2 my-1 flex h-[36px] items-center rounded-xl border border-transparent pr-2 text-[13px] transition-all",
                    isActive
                        ? "border-emerald-500/20 bg-emerald-500/8 text-foreground shadow-[0_0_0_1px_rgba(16,185,129,0.08)]"
                        : "text-muted-foreground/85 hover:border-border/60 hover:bg-accent/40 hover:text-foreground"
                )}
                style={{ marginLeft: `${level * 10 + 8}px` }}
            >
                <button
                    type="button"
                    className="ml-1 mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
                    onClick={toggleFolder}
                    title={node.is_dir ? t('explorer.expand_folder') : t('explorer.file')}
                >
                    {node.is_dir ? (
                        isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                    ) : (
                        <span className="h-3.5 w-3.5" />
                    )}
                </button>

                <div
                    className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-background/70"
                    onClick={() => handleCheck(!node.selected)}
                    title={node.selected ? t('explorer.remove_from_context') : t('explorer.add_to_context')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleCheck(!node.selected);
                        }
                    }}
                >
                    <Checkbox
                        checked={node.selected}
                        onCheckedChange={handleCheck}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 border-muted-foreground/40 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    />
                </div>

                <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-lg py-1 text-left"
                    onClick={openFile}
                    title={node.path}
                >
                    <FileIcon name={node.name} isDir={node.is_dir} isOpen={isOpen} />
                    <span className={cn("truncate", isActive ? "text-foreground" : "text-foreground/90")}>{node.name}</span>
                </button>

                {node.selected && (
                    <span className="ml-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200">
                        {t('explorer.context_badge')}
                    </span>
                )}
            </div>

            {isOpen && (
                <div>
                    {children.map(child => (
                        <FileTreeItem key={child.path} node={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}, (prev, next) => {
    return prev.node.path === next.node.path &&
        prev.node.selected === next.node.selected &&
        prev.level === next.level &&
        prev.node.name === next.node.name &&
        prev.node.is_dir === next.node.is_dir;
});

export const FileTree = () => {
    const [rootFiles, setRootFiles] = useState<FileNode[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fileTreeKey = useStore(s => s.fileTreeKey);
    const triggerRefresh = useStore(s => s.triggerRefresh);
    const stats = useStore(s => s.stats);
    const loadStats = useStore(s => s.loadStats);
    const { t } = useTranslation();

    useEffect(() => {
        if (rootFiles.length === 0) {
            setIsLoading(true);
        }

        fetch('/api/fs/list?path=')
            .then(res => res.json())
            .then(data => { if (Array.isArray(data)) setRootFiles(data); else setRootFiles([]); })
            .catch(() => setRootFiles([]))
            .finally(() => setIsLoading(false));

        loadStats();
    }, [fileTreeKey]);

    return (
        <div className="flex h-full flex-col font-sans">
            <div className="compact-header bg-transparent">
                <div className="panel-header-copy">
                    <span className="panel-title">{t('explorer.title')}</span>
                    <p>{t('explorer.subtitle')}</p>
                </div>
                <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => triggerRefresh('files')} title={t('common.refresh')}>
                    <RefreshCw className="h-3.5 w-3.5" />
                </Button>
            </div>

            <div className="border-b border-border/40 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/40 px-4 py-3">
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{t('explorer.context_title')}</p>
                        <p className="mt-1 text-sm text-foreground">{t('explorer.context_selected', { count: stats.files_count })}</p>
                    </div>
                    <div className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
                        {formatBytes(stats.total_size)}
                    </div>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="py-2">
                    {isLoading ? (
                        <FileTreeSkeleton />
                    ) : (
                        rootFiles.map(node => <FileTreeItem key={node.path} node={node} level={0} />)
                    )}
                </div>
            </ScrollArea>

            <div className="border-t border-border/40 bg-background/30 px-4 py-3">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{t('explorer.selected')}: {stats.files_count}</span>
                    <span className="font-mono">{formatBytes(stats.total_size)}</span>
                </div>
            </div>
        </div>
    );
};
