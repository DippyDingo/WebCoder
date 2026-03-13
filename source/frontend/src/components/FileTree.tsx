import { useState, useEffect, memo, type MouseEvent, type ReactNode } from 'react';
import {
    ChevronRight,
    ChevronDown,
    FileCode,
    FilePlus2,
    FileText,
    Folder,
    FolderPlus,
    Pencil,
    RefreshCw,
    Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import { FILE_ERROR_CONTENT, FILE_LOADING_CONTENT } from '@/lib/editor-state';

interface FileNode {
    name: string;
    path: string;
    is_dir: boolean;
    selected: boolean;
}

interface CreateDraft {
    type: 'file' | 'folder';
    parentPath: string;
    name: string;
}

interface MoveDraft {
    oldPath: string;
    newPath: string;
    isDir: boolean;
}

interface FileTreeItemProps {
    node: FileNode;
    level: number;
    deletingPath: string | null;
    onRequestCreate: (type: 'file' | 'folder', parentPath: string) => void;
    onRequestMove: (node: FileNode) => void;
    onDelete: (node: FileNode) => void;
}

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const joinPath = (parentPath: string, name: string) => (parentPath ? `${parentPath}/${name}` : name);

const readApiPayload = async (response: Response) => {
    const raw = await response.text();
    try {
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {
            message: raw.startsWith('<')
                ? 'Сервер вернул страницу вместо API-ответа. Обычно это означает, что нужно перезапустить backend.'
                : raw || 'Не удалось прочитать ответ сервера',
        };
    }
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
    if (isDir) return <Folder size={14} className={cn('shrink-0 fill-current text-blue-500/80', isOpen && 'text-blue-400')} />;
    if (name.endsWith('.md')) return <FileText size={14} className="shrink-0 text-yellow-500" />;
    if (name.endsWith('.json')) return <span className="w-[14px] shrink-0 text-center text-[10px] font-bold text-orange-400">{'{}'}</span>;
    if (name.endsWith('.ts') || name.endsWith('.tsx')) return <span className="w-[14px] shrink-0 text-center text-[10px] font-bold text-blue-400">TS</span>;
    if (name.endsWith('.go')) return <span className="w-[14px] shrink-0 text-center text-[10px] font-bold text-cyan-400">GO</span>;
    return <FileCode size={14} className="shrink-0 text-muted-foreground" />;
});

const TreeActionButton = ({
    title,
    onClick,
    children,
    danger = false,
    disabled = false,
}: {
    title: string;
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
    children: ReactNode;
    danger?: boolean;
    disabled?: boolean;
}) => (
    <button
        type="button"
        disabled={disabled}
        className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:border-border/60 hover:bg-background/80 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40',
            danger && 'hover:border-red-500/25 hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-300'
        )}
        onClick={onClick}
        title={title}
    >
        {children}
    </button>
);

const FileTreeItem = memo(({ node, level, deletingPath, onRequestCreate, onRequestMove, onDelete }: FileTreeItemProps) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [children, setChildren] = useState<FileNode[]>([]);

    const setCurrentFile = useStore((s) => s.setCurrentFile);
    const toggleFocus = useStore((s) => s.toggleFocus);
    const currentFile = useStore((s) => s.currentFile);
    const fileTreeKey = useStore((s) => s.fileTreeKey);

    const isActive = currentFile === node.path;
    const isDeleting = deletingPath === node.path;

    const fetchChildren = async () => {
        try {
            const res = await fetch(`/api/fs/list?path=${encodeURIComponent(node.path)}`);
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
        setIsOpen((prev) => !prev);
    };

    const openFile = async () => {
        if (node.is_dir) {
            toggleFolder();
            return;
        }

        setCurrentFile(node.path, FILE_LOADING_CONTENT);
        try {
            const res = await fetch(`/api/file?path=${encodeURIComponent(node.path)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to load file');
            setCurrentFile(node.path, data.content ?? '');
        } catch {
            setCurrentFile(node.path, FILE_ERROR_CONTENT);
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
                    'group mx-2 my-1 flex h-[36px] items-center rounded-xl border border-transparent pr-2 text-[13px] transition-all',
                    isActive
                        ? 'border-emerald-500/20 bg-emerald-500/8 text-foreground shadow-[0_0_0_1px_rgba(16,185,129,0.08)]'
                        : 'text-muted-foreground/85 hover:border-border/60 hover:bg-accent/40 hover:text-foreground'
                )}
                style={{ marginLeft: `${level * 10 + 8}px` }}
            >
                <button
                    type="button"
                    className="ml-1 mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
                    onClick={toggleFolder}
                    title={node.is_dir ? t('explorer.expand_folder', { defaultValue: 'Раскрыть папку' }) : t('explorer.file', { defaultValue: 'Файл' })}
                >
                    {node.is_dir ? isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : <span className="h-3.5 w-3.5" />}
                </button>

                <div
                    className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-background/70"
                    onClick={() => handleCheck(!node.selected)}
                    title={
                        node.selected
                            ? t('explorer.remove_from_context', { defaultValue: 'Убрать из контекста' })
                            : t('explorer.add_to_context', { defaultValue: 'Добавить в контекст' })
                    }
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
                    <span className={cn('truncate', isActive ? 'text-foreground' : 'text-foreground/90')}>{node.name}</span>
                </button>

                {node.selected && (
                    <span className="emerald-pill ml-2 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                        {t('explorer.context_badge', { defaultValue: 'Контекст' })}
                    </span>
                )}

                <div className="ml-2 flex shrink-0 items-center gap-1">
                    <TreeActionButton
                        title={t('explorer.rename_move', { defaultValue: 'Переименовать или переместить' })}
                        onClick={(event) => {
                            event.stopPropagation();
                            onRequestMove(node);
                        }}
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </TreeActionButton>

                    {node.is_dir && (
                        <>
                            <TreeActionButton
                                title={t('explorer.new_file_in', { defaultValue: 'Новый файл в папке' })}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    if (!isOpen) {
                                        setIsOpen(true);
                                    }
                                    onRequestCreate('file', node.path);
                                }}
                            >
                                <FilePlus2 className="h-3.5 w-3.5" />
                            </TreeActionButton>
                            <TreeActionButton
                                title={t('explorer.new_folder_in', { defaultValue: 'Новая папка внутри' })}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    if (!isOpen) {
                                        setIsOpen(true);
                                    }
                                    onRequestCreate('folder', node.path);
                                }}
                            >
                                <FolderPlus className="h-3.5 w-3.5" />
                            </TreeActionButton>
                        </>
                    )}

                    <TreeActionButton
                        title={t('explorer.delete_entry', { defaultValue: 'Удалить' })}
                        onClick={(event) => {
                            event.stopPropagation();
                            onDelete(node);
                        }}
                        danger
                        disabled={isDeleting}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </TreeActionButton>
                </div>
            </div>

            {isOpen && (
                <div>
                    {children.map((child) => (
                        <FileTreeItem
                            key={child.path}
                            node={child}
                            level={level + 1}
                            deletingPath={deletingPath}
                            onRequestCreate={onRequestCreate}
                            onRequestMove={onRequestMove}
                            onDelete={onDelete}
                        />
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
        prev.node.is_dir === next.node.is_dir &&
        prev.deletingPath === next.deletingPath;
});

export const FileTree = () => {
    const [rootFiles, setRootFiles] = useState<FileNode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [createDraft, setCreateDraft] = useState<CreateDraft | null>(null);
    const [moveDraft, setMoveDraft] = useState<MoveDraft | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingPath, setDeletingPath] = useState<string | null>(null);

    const fileTreeKey = useStore((s) => s.fileTreeKey);
    const triggerRefresh = useStore((s) => s.triggerRefresh);
    const stats = useStore((s) => s.stats);
    const loadStats = useStore((s) => s.loadStats);
    const currentFile = useStore((s) => s.currentFile);
    const setCurrentFile = useStore((s) => s.setCurrentFile);
    const pruneFocusPath = useStore((s) => s.pruneFocusPath);
    const movePathReferences = useStore((s) => s.movePathReferences);
    const { t } = useTranslation();

    useEffect(() => {
        if (rootFiles.length === 0) {
            setIsLoading(true);
        }

        fetch('/api/fs/list?path=')
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) setRootFiles(data);
                else setRootFiles([]);
            })
            .catch(() => setRootFiles([]))
            .finally(() => setIsLoading(false));

        loadStats();
    }, [fileTreeKey]);

    const beginCreate = (type: 'file' | 'folder', parentPath = '') => {
        setMoveDraft(null);
        setCreateDraft({ type, parentPath, name: '' });
    };

    const beginMove = (node: FileNode) => {
        setCreateDraft(null);
        setMoveDraft({
            oldPath: node.path,
            newPath: node.path,
            isDir: node.is_dir,
        });
    };

    const submitCreate = async () => {
        if (!createDraft) return;

        const cleanName = createDraft.name.trim();
        if (!cleanName) {
            toast.error(t('explorer.name_required', { defaultValue: 'Укажите имя файла или папки' }));
            return;
        }
        if (cleanName.includes('/') || cleanName.includes('\\')) {
            toast.error(t('explorer.invalid_name', { defaultValue: 'Используйте только имя без символов / и \\' }));
            return;
        }

        const nextPath = joinPath(createDraft.parentPath, cleanName);
        setIsSubmitting(true);
        try {
            const response = await fetch('/api/fs/create', {
                method: 'POST',
                body: JSON.stringify({ path: nextPath, type: createDraft.type }),
            });
            const data = await readApiPayload(response);
            if (!response.ok) {
                throw new Error(data.message || t('common.error', { defaultValue: 'Ошибка' }));
            }

            toast.success(
                createDraft.type === 'folder'
                    ? t('explorer.folder_created', { defaultValue: 'Папка создана' })
                    : t('explorer.file_created', { defaultValue: 'Файл создан' })
            );
            setCreateDraft(null);
            triggerRefresh('files');

            if (createDraft.type === 'file') {
                setCurrentFile(nextPath, '');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : t('common.error', { defaultValue: 'Ошибка' });
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const deleteEntry = async (node: FileNode) => {
        const confirmed = window.confirm(
            node.is_dir
                ? t('explorer.delete_folder_confirm', {
                    defaultValue: `Удалить папку "${node.name}" со всем содержимым?`,
                    name: node.name,
                })
                : t('explorer.delete_file_confirm', {
                    defaultValue: `Удалить файл "${node.name}"?`,
                    name: node.name,
                })
        );

        if (!confirmed) return;

        setDeletingPath(node.path);
        try {
            const response = await fetch('/api/fs/delete', {
                method: 'POST',
                body: JSON.stringify({ path: node.path }),
            });
            const data = await readApiPayload(response);
            if (!response.ok) {
                throw new Error(data.message || t('common.error', { defaultValue: 'Ошибка' }));
            }

            await pruneFocusPath(node.path);

            if (currentFile === node.path || (currentFile && currentFile.startsWith(`${node.path}/`))) {
                setCurrentFile(null, '');
            }

            toast.success(
                node.is_dir
                    ? t('explorer.folder_deleted', { defaultValue: 'Папка удалена' })
                    : t('explorer.file_deleted', { defaultValue: 'Файл удалён' })
            );
            triggerRefresh('files');
        } catch (error) {
            const message = error instanceof Error ? error.message : t('common.error', { defaultValue: 'Ошибка' });
            toast.error(message);
        } finally {
            setDeletingPath(null);
        }
    };

    const submitMove = async () => {
        if (!moveDraft) return;

        const nextPath = moveDraft.newPath.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        if (!nextPath) {
            toast.error(t('explorer.move_name_required', { defaultValue: 'Укажите новый путь' }));
            return;
        }
        if (nextPath === moveDraft.oldPath) {
            toast.error(t('explorer.move_same_path', { defaultValue: 'Укажите другой путь или имя' }));
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch('/api/fs/move', {
                method: 'POST',
                body: JSON.stringify({ old_path: moveDraft.oldPath, new_path: nextPath }),
            });
            const data = await readApiPayload(response);
            if (!response.ok) {
                throw new Error(data.message || t('common.error', { defaultValue: 'Ошибка' }));
            }

            await movePathReferences(moveDraft.oldPath, nextPath);
            setMoveDraft(null);
            toast.success(
                moveDraft.isDir
                    ? t('explorer.folder_moved', { defaultValue: 'Папка перемещена' })
                    : t('explorer.file_moved', { defaultValue: 'Файл перемещён' })
            );
            triggerRefresh('files');
        } catch (error) {
            const message = error instanceof Error ? error.message : t('common.error', { defaultValue: 'Ошибка' });
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex h-full flex-col font-sans">
            <div className="compact-header bg-transparent">
                <div className="panel-header-copy">
                    <span className="panel-title">{t('explorer.title', { defaultValue: 'Проводник' })}</span>
                    <p>{t('explorer.subtitle', { defaultValue: 'Выберите файлы для контекста prompt, затем откройте любой файл для просмотра.' })}</p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => beginCreate('file')}
                        title={t('explorer.new_file', { defaultValue: 'Новый файл' })}
                    >
                        <FilePlus2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => beginCreate('folder')}
                        title={t('explorer.new_folder', { defaultValue: 'Новая папка' })}
                    >
                        <FolderPlus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => triggerRefresh('files')}
                        title={t('common.refresh', { defaultValue: 'Обновить' })}
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            <div className="border-b border-border/40 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/40 px-4 py-3">
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                            {t('explorer.context_title', { defaultValue: 'Выбранный контекст' })}
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                            {t('explorer.context_selected', { count: stats.files_count, defaultValue: `Выбрано файлов: ${stats.files_count}` })}
                        </p>
                    </div>
                    <div className="emerald-pill shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium">
                        {formatBytes(stats.total_size)}
                    </div>
                </div>

                {createDraft && (
                    <div className="panel-surface mt-3 p-3">
                        <div className="flex flex-col gap-3">
                            <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                                    {createDraft.type === 'folder'
                                        ? t('explorer.create_folder_title', { defaultValue: 'Создание папки' })
                                        : t('explorer.create_file_title', { defaultValue: 'Создание файла' })}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                    {createDraft.parentPath
                                        ? t('explorer.create_target', {
                                            defaultValue: `Папка: ${createDraft.parentPath}`,
                                            path: createDraft.parentPath,
                                        })
                                        : t('explorer.create_target_root', { defaultValue: 'Корень проекта' })}
                                </p>
                            </div>

                            <input
                                autoFocus
                                value={createDraft.name}
                                onChange={(event) => setCreateDraft((prev) => prev ? { ...prev, name: event.target.value } : prev)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        void submitCreate();
                                    }
                                    if (event.key === 'Escape') {
                                        setCreateDraft(null);
                                    }
                                }}
                                placeholder={createDraft.type === 'folder'
                                    ? t('explorer.folder_name_placeholder', { defaultValue: 'например, assets' })
                                    : t('explorer.file_name_placeholder', { defaultValue: 'например, notes.txt' })}
                                className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary/40"
                            />

                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-3 text-xs"
                                    onClick={() => setCreateDraft(null)}
                                >
                                    {t('common.cancel', { defaultValue: 'Отмена' })}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    className="h-8 px-4 text-xs"
                                    disabled={isSubmitting}
                                    onClick={() => void submitCreate()}
                                >
                                    {t('common.create', { defaultValue: 'Создать' })}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {moveDraft && (
                    <div className="panel-surface mt-3 p-3">
                        <div className="flex flex-col gap-3">
                            <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                                    {moveDraft.isDir
                                        ? t('explorer.move_folder_title', { defaultValue: 'Перемещение папки' })
                                        : t('explorer.move_file_title', { defaultValue: 'Переименование или перемещение файла' })}
                                </p>
                                <p className="mt-1 break-all text-xs leading-5 text-muted-foreground">
                                    {t('explorer.move_from', {
                                        defaultValue: `Старый путь: ${moveDraft.oldPath}`,
                                        path: moveDraft.oldPath,
                                    })}
                                </p>
                            </div>

                            <input
                                autoFocus
                                value={moveDraft.newPath}
                                onChange={(event) => setMoveDraft((prev) => prev ? { ...prev, newPath: event.target.value } : prev)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        void submitMove();
                                    }
                                    if (event.key === 'Escape') {
                                        setMoveDraft(null);
                                    }
                                }}
                                placeholder={t('explorer.move_placeholder', { defaultValue: 'например, src/new-name.txt' })}
                                className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary/40"
                            />

                            <p className="text-xs leading-5 text-muted-foreground">
                                {t('explorer.move_hint', { defaultValue: 'Можно изменить только имя или указать новый путь с вложенной папкой.' })}
                            </p>

                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-3 text-xs"
                                    onClick={() => setMoveDraft(null)}
                                >
                                    {t('common.cancel', { defaultValue: 'Отмена' })}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    className="h-8 px-4 text-xs"
                                    disabled={isSubmitting}
                                    onClick={() => void submitMove()}
                                >
                                    {t('explorer.rename_move_apply', { defaultValue: 'Применить' })}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <ScrollArea className="flex-1">
                <div className="py-2">
                    {isLoading ? (
                        <FileTreeSkeleton />
                    ) : (
                        rootFiles.map((node) => (
                            <FileTreeItem
                                key={node.path}
                                node={node}
                                level={0}
                                deletingPath={deletingPath}
                                onRequestCreate={beginCreate}
                                onRequestMove={beginMove}
                                onDelete={deleteEntry}
                            />
                        ))
                    )}
                </div>
            </ScrollArea>

            <div className="border-t border-border/40 bg-background/30 px-4 py-3">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{t('explorer.selected', { defaultValue: 'Выбрано' })}: {stats.files_count}</span>
                    <span className="font-mono">{formatBytes(stats.total_size)}</span>
                </div>
            </div>
        </div>
    );
};
