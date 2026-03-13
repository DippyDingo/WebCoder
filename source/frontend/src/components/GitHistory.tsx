import { useState, useEffect, memo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, RefreshCw, Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStore } from '@/store';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { FILE_LOADING_CONTENT } from '@/lib/editor-state';

interface Commit {
    hash: string;
    message: string;
    author: string;
    date: string;
}

const PAGE_SIZE = 20;

const GitHistorySkeleton = () => (
    <div className="space-y-3 px-3 py-3">
        {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border/40 bg-background/30 p-3">
                <Skeleton className="h-4 w-3/4 rounded-sm" />
                <div className="mt-3 flex items-center justify-between">
                    <Skeleton className="h-3 w-24 rounded-sm" />
                    <Skeleton className="h-7 w-20 rounded-full" />
                </div>
            </div>
        ))}
    </div>
);

const CommitItem = memo(({ commit, onOpen, onEdit, onRevert, isCurrent }: { commit: Commit; onOpen: (c: Commit) => void; onEdit: (c: Commit) => void; onRevert: (c: Commit) => void; isCurrent: boolean }) => {
    const { t } = useTranslation();
    return (
        <div
            role="button"
            tabIndex={0}
            className="group mx-3 my-2 block w-[calc(100%-1.5rem)] rounded-2xl border border-border/50 bg-background/30 p-4 text-left transition-colors hover:border-border/80 hover:bg-accent/25"
            onClick={() => onOpen(commit)}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpen(commit);
                }
            }}
            title={t('history.open_tooltip')}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <span className="block whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground/90">
                        {commit.message}
                    </span>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-mono text-muted-foreground/80">
                        <span>{commit.date}</span>
                        <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5">{commit.author}</span>
                        <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5">{commit.hash}</span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px]">
                            <Eye className="h-3 w-3" />
                            {t('history.open_label')}
                        </span>
                    </div>
                </div>

                {isCurrent ? (
                    <div className="flex shrink-0 items-center gap-2">
                        <span
                            className="emerald-pill inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium"
                            title={t('history.current_tooltip')}
                        >
                            {t('history.current')}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="edit-pill h-8 rounded-full border px-3 text-xs"
                            onClick={(event) => {
                                event.stopPropagation();
                                onEdit(commit);
                            }}
                            title={t('history.edit_tooltip')}
                        >
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            {t('history.edit_btn')}
                        </Button>
                    </div>
                ) : (
                    <Button
                        variant="outline"
                        size="sm"
                        className="soft-danger h-8 shrink-0 rounded-full border px-3 text-xs"
                        onClick={(event) => {
                            event.stopPropagation();
                            onRevert(commit);
                        }}
                        title={t('history.revert_tooltip')}
                    >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        {t('history.revert_btn')}
                    </Button>
                )}
            </div>
        </div>
    );
});

const EditCommitModal = ({
    commit,
    loading,
    onCancel,
    onConfirm,
}: {
    commit: Commit;
    loading: boolean;
    onCancel: () => void;
    onConfirm: (message: string) => void;
}) => {
    const { t } = useTranslation();
    const [message, setMessage] = useState(commit.message);

    return createPortal(
        <div className="animate-in fade-in fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl animate-in zoom-in-95">
                <h3 className="mb-2 text-sm font-semibold">{t('history.edit_title')}</h3>
                <p className="mb-4 text-xs leading-5 text-muted-foreground">{t('history.edit_desc')}</p>
                <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    className="min-h-[112px] w-full resize-y rounded-xl border border-border/50 bg-background px-3 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary/50"
                    placeholder={t('history.commit_placeholder')}
                />
                <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={onCancel} className="h-8 text-xs">
                        {t('common.cancel')}
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => onConfirm(message)}
                        className="h-8 text-xs"
                        disabled={loading || !message.trim()}
                    >
                        {loading ? (
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                            t('history.save_btn')
                        )}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const CommitForm = memo(({ onCommit, loading }: { onCommit: (msg: string) => void; loading: boolean }) => {
    const { t } = useTranslation();
    const [message, setMessage] = useState("");

    const handleSubmit = () => {
        if (!message.trim()) return;
        onCommit(message);
        setMessage("");
    };

    return (
        <div className="border-t border-border/40 bg-background/30 p-4">
            <div className="flex gap-2">
                <input
                    className="flex-1 rounded-xl border border-border/50 bg-background px-3 py-2 text-xs text-foreground outline-none transition-colors focus:border-primary/50"
                    placeholder={t('history.commit_placeholder')}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
                <Button
                    size="icon"
                    variant="secondary"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="h-9 w-9 shrink-0 rounded-xl"
                >
                    {loading ? (
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                        <Plus size={14} />
                    )}
                </Button>
            </div>
        </div>
    );
});

const RevertModal = ({ commit, onCancel, onConfirm }: { commit: Commit; onCancel: () => void; onConfirm: () => void }) => {
    const { t } = useTranslation();
    return createPortal(
        <div className="animate-in fade-in fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-2xl animate-in zoom-in-95">
                <h3 className="mb-2 text-sm font-semibold">{t('history.revert_title', { hash: commit.hash })}</h3>
                <p className="mb-4 text-xs leading-5 text-muted-foreground">{t('history.revert_desc')}</p>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={onCancel} className="h-8 text-xs">
                        {t('common.cancel')}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={onConfirm} className="h-8 text-xs">
                        {t('history.revert_btn')}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const GitHistory = () => {
    const { t } = useTranslation();
    const setCurrentFile = useStore(s => s.setCurrentFile);
    const [commits, setCommits] = useState<Commit[]>([]);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [commitToRevert, setCommitToRevert] = useState<Commit | null>(null);
    const [commitToEdit, setCommitToEdit] = useState<Commit | null>(null);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    const observer = useRef<IntersectionObserver | null>(null);
    const gitHistoryKey = useStore(s => s.gitHistoryKey);
    const triggerRefresh = useStore(s => s.triggerRefresh);

    useEffect(() => {
        setCommits([]);
        setOffset(0);
        setHasMore(true);
    }, [gitHistoryKey]);

    const loadCommits = async (currentOffset: number, isReset: boolean) => {
        setIsFetching(true);
        try {
            const res = await fetch(`/api/git/log?limit=${PAGE_SIZE}&offset=${currentOffset}`);
            const data = await res.json();

            if (Array.isArray(data)) {
                if (data.length < PAGE_SIZE) setHasMore(false);
                setCommits(prev => isReset ? data : [...prev, ...data]);
            } else {
                setHasMore(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsFetching(false);
        }
    };

    useEffect(() => {
        if (offset === 0) {
            loadCommits(0, true);
        } else {
            loadCommits(offset, false);
        }
    }, [offset, gitHistoryKey]);

    const lastCommitRef = useCallback((node: HTMLDivElement) => {
        if (isFetching) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setOffset(prev => prev + PAGE_SIZE);
            }
        });

        if (node) observer.current.observe(node);
    }, [isFetching, hasMore]);

    const handleCommit = async (msg: string) => {
        setIsActionLoading(true);
        try {
            const res = await fetch('/api/git/commit', { method: 'POST', body: JSON.stringify({ message: msg.trim() }) });
            if (res.ok) {
                toast.success(t('history.committed'));
                triggerRefresh('git');
            } else {
                toast.error(t('common.failed'));
            }
        } catch {
            toast.error(t('common.error'));
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleRevert = async () => {
        if (!commitToRevert) return;
        try {
            const res = await fetch('/api/git/reset', { method: 'POST', body: JSON.stringify({ hash: commitToRevert.hash }) });
            if (res.ok) {
                toast.success(t('history.reverted'));
                triggerRefresh('all');
            } else {
                toast.error(t('common.failed'));
            }
        } catch {
            toast.error(t('common.error'));
        } finally {
            setCommitToRevert(null);
        }
    };

    const handleAmend = async (message: string) => {
        setIsActionLoading(true);
        try {
            const res = await fetch('/api/git/amend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify({ message: message.trim() })
            });
            if (res.ok) {
                toast.success(t('history.saved'));
                setCommitToEdit(null);
                triggerRefresh('git');
            } else {
                toast.error(t('common.failed'));
            }
        } catch {
            toast.error(t('common.error'));
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleOpenCommit = (commit: Commit) => {
        setCurrentFile(`.aicoder/history/${commit.hash}.diff`, FILE_LOADING_CONTENT);
    };

    return (
        <div className="flex h-full flex-col font-sans">
            <div className="compact-header bg-transparent">
                <div className="panel-header-copy">
                    <span className="panel-title">{t('history.title')}</span>
                    <p>{t('history.subtitle')}</p>
                </div>
                <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => triggerRefresh('git')} title={t('common.refresh')}>
                    <RefreshCw className="h-3.5 w-3.5" />
                </Button>
            </div>

            <div className="border-b border-border/40 px-4 py-3">
                <div className="surface-note">
                    {t('history.safety_note')}
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="py-2">
                    {commits.map((commit, index) => {
                        const isCurrent = index === 0;
                        if (index === commits.length - 1) {
                            return (
                                <div ref={lastCommitRef} key={commit.hash}>
                                    <CommitItem commit={commit} onOpen={handleOpenCommit} onEdit={setCommitToEdit} onRevert={setCommitToRevert} isCurrent={isCurrent} />
                                </div>
                            );
                        }
                        return <CommitItem key={commit.hash} commit={commit} onOpen={handleOpenCommit} onEdit={setCommitToEdit} onRevert={setCommitToRevert} isCurrent={isCurrent} />;
                    })}

                    {isFetching && (
                        <div className="py-2">
                            <GitHistorySkeleton />
                        </div>
                    )}
                </div>
            </ScrollArea>

            <CommitForm onCommit={handleCommit} loading={isActionLoading} />

            {commitToRevert && (
                <RevertModal
                    commit={commitToRevert}
                    onCancel={() => setCommitToRevert(null)}
                    onConfirm={handleRevert}
                />
            )}
            {commitToEdit && (
                <EditCommitModal
                    commit={commitToEdit}
                    loading={isActionLoading}
                    onCancel={() => setCommitToEdit(null)}
                    onConfirm={handleAmend}
                />
            )}
        </div>
    );
};
