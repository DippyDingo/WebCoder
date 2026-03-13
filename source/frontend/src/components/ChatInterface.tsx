import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bot, FilePenLine, RotateCcw, FileText, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useStore, Message } from '@/store';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export const ChatInterface = () => {
    const { t } = useTranslation();
    const { triggerRefresh, setCurrentFile, messages, setMessages, stats } = useStore();
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const emptyStateSteps = [
        t('chat.empty_step_context'),
        t('chat.empty_step_task'),
        t('chat.empty_step_source')
    ];

    useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    useEffect(() => {
        if (!input && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }, [input]);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
    };

    const handleSend = async () => {
        if (!input.trim()) return;
        const text = input.trim();
        setInput("");

        const userMsg: Message = { id: Date.now(), role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);

        const isXml = text.startsWith('<response') || text.startsWith('```xml');
        try {
            if (isXml) {
                const res = await fetch('/api/ai/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json; charset=utf-8' },
                    body: JSON.stringify({ xml_content: text })
                });
                const data = await res.json();
                if (res.ok) {
                    const cleanMessage = data.message.replace(/^Success! /, '').trim();

                    setMessages(prev => [...prev, {
                        id: Date.now() + 1,
                        role: 'system',
                        content: cleanMessage,
                        modifiedFiles: data.files
                    }]);
                    toast.success(t('chat.changes_applied'));
                    triggerRefresh();
                } else {
                    throw new Error(data.message);
                }
            } else {
                const res = await fetch('/api/prompt/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json; charset=utf-8' },
                    body: JSON.stringify({ task: text })
                });
                if (res.ok) {
                    setMessages(prev => [...prev, {
                        id: Date.now() + 1,
                        role: 'system',
                        content: t('chat.prompt_generated'),
                        filePath: ".aicoder/source.txt"
                    }]);
                    toast.success(t('chat.prompt_generated'));
                    triggerRefresh();
                } else {
                    throw new Error(t('common.failed'));
                }
            }
        } catch (e: any) {
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'system',
                content: `${t('common.error')}: ${e.message}`
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleRetry = (content: string) => {
        setInput(content);
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
                textareaRef.current.focus();
            }
        }, 0);
    };

    const openSystemFile = (path: string) => {
        setCurrentFile(path, "");
    };

    return (
        <div className="flex h-full flex-col bg-background font-sans">
            <div className="compact-header bg-transparent">
                <div className="panel-header-copy">
                    <span className="panel-title">{t('chat.title')}</span>
                    <p>{t('chat.subtitle')}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <span className={cn("workflow-pill", stats.files_count > 0 && "workflow-pill-active")}>
                        <FileText className="h-3.5 w-3.5" />
                        {t('chat.context_summary', { count: stats.files_count })}
                    </span>
                </div>
            </div>

            <div className="border-b border-border/40 px-4 py-3">
                <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl border border-border/50 bg-background/35 px-4 py-3">
                    <span className={cn("workflow-pill", stats.files_count > 0 && "workflow-pill-active")}>
                        <Sparkles className="h-3.5 w-3.5" />
                        {stats.files_count > 0 ? t('chat.context_selected') : t('chat.no_context_selected')}
                    </span>
                    <span className="workflow-pill">{t('chat.workflow_summary')}</span>
                </div>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="mx-auto max-w-3xl space-y-6">
                    {messages.length === 0 && (
                        <div className="panel-surface mt-10 overflow-hidden">
                            <div className="border-b border-border/40 bg-gradient-to-r from-emerald-500/10 via-transparent to-amber-400/8 px-6 py-5">
                                <div className="flex items-center gap-4">
                                    <div className="rounded-2xl bg-emerald-500/12 p-4 text-emerald-300">
                                        <Bot size={30} className="stroke-[1.5]" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-lg font-semibold text-foreground">{t('chat.empty_title')}</p>
                                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                            {t('chat.empty_desc')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 px-6 py-5 md:grid-cols-3">
                                {emptyStateSteps.map((step, index) => (
                                    <div key={step} className="rounded-xl border border-border/50 bg-background/40 p-4">
                                        <div className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-xs font-semibold text-emerald-200">
                                            {index + 1}
                                        </div>
                                        <p className="text-sm leading-6 text-foreground/90">{step}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-border/40 px-6 py-4 text-sm text-muted-foreground">
                                {stats.files_count > 0
                                    ? t('chat.selected_files_desc', { count: stats.files_count })
                                    : t('chat.no_files_desc')}
                            </div>
                        </div>
                    )}

                    {messages.map((msg) => (
                        <div key={msg.id} className={cn("group flex w-full items-end animate-in fade-in slide-in-from-bottom-2 duration-300", msg.role === 'user' ? "justify-end" : "justify-start")}>
                            {msg.role === 'user' && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="mr-2 h-6 w-6 text-muted-foreground opacity-0 transition-all duration-200 hover:bg-muted hover:text-foreground group-hover:opacity-100"
                                    onClick={() => handleRetry(msg.content)}
                                    title={t('chat.retry')}
                                >
                                    <RotateCcw size={12} />
                                </Button>
                            )}

                            <div
                                className={cn(
                                    "relative max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-sm",
                                    msg.role === 'user'
                                        ? "rounded-br-sm bg-secondary text-secondary-foreground"
                                        : "rounded-bl-sm border border-border/50 bg-muted/40 text-foreground"
                                )}
                            >
                                {msg.modifiedFiles ? (
                                    <div className="flex min-w-[240px] flex-col gap-3">
                                        <div className="flex items-center gap-2 text-sm font-bold text-emerald-500">
                                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                            {t('common.success')}
                                        </div>

                                        <div>
                                            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider opacity-60">{t('chat.commit_summary')}</div>
                                            <div className="whitespace-pre-wrap font-mono text-xs text-foreground/90">
                                                {msg.content}
                                            </div>
                                        </div>

                                        {msg.modifiedFiles.length > 0 && (
                                            <div>
                                                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider opacity-60">{t('chat.modified_files')}</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {msg.modifiedFiles.map((file, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => setCurrentFile(file, "")}
                                                            className="group flex cursor-pointer items-center gap-1.5 rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs font-mono text-muted-foreground transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                                                            title={t('common.open_in_editor')}
                                                        >
                                                            <FilePenLine size={12} className="text-emerald-500 transition-colors group-hover:text-primary" />
                                                            {file}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <div className="whitespace-pre-wrap font-mono">{msg.content}</div>
                                        {msg.filePath && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="mt-3 h-8 w-full justify-start gap-2 border-dashed border-border/60 bg-background/50 text-xs hover:bg-background"
                                                onClick={() => openSystemFile(msg.filePath!)}
                                            >
                                                <FileText size={12} />
                                                <span className="truncate">{t('chat.open_source', { path: msg.filePath })}</span>
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            <div className="bg-background px-4 pb-4 pt-0">
                <div className="mx-auto max-w-3xl">
                    <div className="rounded-2xl border border-input bg-muted/25 shadow-sm transition-all duration-200 focus-within:border-primary focus-within:bg-background focus-within:ring-1 focus-within:ring-primary">
                        <Textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            placeholder={t('chat.placeholder')}
                            className="min-h-[54px] max-h-[200px] w-full resize-none border-0 bg-transparent px-4 py-3 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                            rows={1}
                        />

                        <div className="flex items-center justify-between border-t border-border/10 bg-muted/10 px-3 pb-3 pt-2">
                            <span className="ml-1 select-none font-mono text-[10px] font-medium text-muted-foreground/60">
                                {t('chat.input_hint')}
                            </span>

                            <Button
                                size="sm"
                                className="h-8 gap-2 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
                                onClick={handleSend}
                                disabled={loading || !input.trim()}
                            >
                                {loading && <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                                {t('common.send')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
