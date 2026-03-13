import { useEffect, useCallback, useRef, useState } from 'react';
import { useStore } from '@/store';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { X, Save, FileCode, Copy, Check, AlertTriangle, Loader2, FileText } from 'lucide-react';
import Editor from 'react-simple-code-editor';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useTranslation } from 'react-i18next';
import { useSyntaxHighlight } from '@/hooks/useSyntaxHighlight';

const isHistoryPreview = (path: string) => path.startsWith(".aicoder/history/") && path.endsWith(".diff");

const getFileHint = (path: string, t: (key: string) => string) => {
    if (isHistoryPreview(path)) {
        return {
            icon: FileText,
            title: t('editor.history_title'),
            description: t('editor.history_desc')
        };
    }

    if (path === ".aicoder/source.txt") {
        return {
            icon: FileText,
            title: t('editor.generated_title'),
            description: t('editor.generated_desc')
        };
    }

    if (path === ".aicoder/prompt.md") {
        return {
            icon: FileText,
            title: t('editor.template_title'),
            description: t('editor.template_desc')
        };
    }

    if (path === ".aicoder/settings.json") {
        return {
            icon: FileCode,
            title: t('editor.settings_title'),
            description: t('editor.settings_desc')
        };
    }

    return null;
};

export const CodeEditor = () => {
    const { t } = useTranslation();
    const { currentFile, currentContent, setCurrentFile, fileTreeKey, triggerRefresh } = useStore();
    const { highlight } = useSyntaxHighlight();

    const isSavingRef = useRef(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (currentFile && !isSavingRef.current) {
            fetch(`/api/file?path=${currentFile}&t=${Date.now()}`)
                .then(async (r) => {
                    const data = await r.json();
                    if (!r.ok) {
                        throw new Error(data.message || t('common.failed'));
                    }
                    setCurrentFile(currentFile, data.content ?? "");
                })
                .catch((error) => {
                    console.error(error);
                    setCurrentFile(currentFile, "Error loading file");
                });
        }
    }, [fileTreeKey, currentFile, setCurrentFile]);

    const handleClose = () => setCurrentFile(null, "");

    const handleSave = useCallback(() => {
        if (!currentFile || isHistoryPreview(currentFile)) return;
        isSavingRef.current = true;
        fetch('/api/file', {
            method: 'POST',
            body: JSON.stringify({ path: currentFile, content: currentContent })
        })
            .then(() => {
                toast.success(t('common.saved'));
                isSavingRef.current = false;
                triggerRefresh('files');
            })
            .catch(() => {
                isSavingRef.current = false;
                toast.error(t('common.error'));
            });
    }, [currentFile, currentContent, triggerRefresh, t]);

    const handleCopyPath = () => {
        if (!currentFile) return;
        navigator.clipboard.writeText(currentFile);
        setCopied(true);
        toast.success(t('common.copied'));
        setTimeout(() => setCopied(false), 2000);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose();
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSave]);

    if (!currentFile) return null;

    const isLoading = currentContent === "Loading...";
    const isError = currentContent === "Error loading file";
    const isReadOnly = isHistoryPreview(currentFile);
    const hint = getFileHint(currentFile, t);

    return (
        <div className="flex h-full flex-col bg-background transition-colors duration-300">
            <div className="compact-header justify-between border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="min-w-0 flex flex-1 items-start gap-2">
                    <FileCode size={14} className="mt-1 shrink-0 text-emerald-500" />
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="truncate select-none text-sm font-medium text-foreground" title={currentFile}>
                                {currentFile}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleCopyPath}
                                className="h-5 w-5 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                                title={t('common.copy_path')}
                            >
                                {copied ? <Check size={10} /> : <Copy size={10} />}
                            </Button>
                        </div>
                        <p className="mt-1 text-[11px] leading-5 text-muted-foreground/80">
                            {currentContent.length} {t('editor.bytes')}
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    {isReadOnly && (
                        <span className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {t('editor.readonly')}
                        </span>
                    )}
                    <Button size="sm" variant="ghost" onClick={handleSave} className="h-8 gap-1.5 px-3 text-xs text-muted-foreground hover:text-emerald-400" disabled={isLoading || isError || isReadOnly}>
                        <Save size={12} /> {t('common.save')}
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleClose}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                        <X size={14} />
                    </Button>
                </div>
            </div>

            {hint && (
                <div className="border-b border-border/40 px-4 py-3">
                    <div className="mx-auto flex max-w-5xl items-start gap-3 rounded-xl border border-amber-400/15 bg-amber-400/8 px-4 py-3">
                        <hint.icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{hint.title}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint.description}</p>
                        </div>
                    </div>
                </div>
            )}

            {isLoading && (
                <div className="flex flex-1 items-center justify-center px-6">
                    <div className="panel-surface w-full max-w-xl p-8 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-300" />
                        <p className="mt-4 text-lg font-semibold text-foreground">{t('editor.loading_title')}</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('editor.loading_desc')}</p>
                    </div>
                </div>
            )}

            {isError && (
                <div className="flex flex-1 items-center justify-center px-6">
                    <div className="panel-surface w-full max-w-xl p-8 text-center">
                        <AlertTriangle className="mx-auto h-8 w-8 text-red-300" />
                        <p className="mt-4 text-lg font-semibold text-foreground">{t('editor.error_title')}</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {t('editor.error_desc')}
                        </p>
                    </div>
                </div>
            )}

            {!isLoading && !isError && (
                <ScrollArea className="h-full flex-1 bg-background">
                    <div className="relative min-h-full min-w-full font-mono text-sm">
                        <Editor
                            value={currentContent}
                            onValueChange={(code) => {
                                if (!isReadOnly) {
                                    setCurrentFile(currentFile, code);
                                }
                            }}
                            highlight={(code) => highlight(code, currentFile)}
                            padding={24}
                            className="min-h-full font-mono text-[13px] leading-relaxed tracking-normal"
                            textareaClassName="focus:outline-none"
                            disabled={isReadOnly}
                            style={{
                                fontFamily: '"Geist Mono", "Fira Code", monospace',
                                backgroundColor: 'transparent',
                                color: 'inherit',
                            }}
                        />
                    </div>
                    <ScrollBar orientation="vertical" />
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            )}
        </div>
    );
};
