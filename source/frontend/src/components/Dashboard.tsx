import { useEffect, useState } from 'react';
import { ArrowRight, Plus, Terminal, AlertTriangle, Settings2, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardProps {
    onOpen: () => void;
}

interface SystemStatus {
    git_installed: boolean;
    git_configured: boolean;
    permissions: boolean;
}

export const Dashboard = ({ onOpen }: DashboardProps) => {
    const { t } = useTranslation();
    const [projects, setProjects] = useState<string[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newProjectName, setNewProjectName] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [systemStatus, setSystemStatus] = useState<SystemStatus>({
        git_installed: true,
        git_configured: true,
        permissions: true
    });

    const checkSystem = () => {
        fetch('/api/system/check')
            .then(r => r.json())
            .then(data => setSystemStatus(data))
            .catch(console.error);
    };

    const loadProjects = () => {
        setIsLoading(true);
        fetch('/api/projects')
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data)) setProjects(data);
                else setProjects([]);
            })
            .catch(() => setProjects([]))
            .finally(() => setIsLoading(false));
    };

    useEffect(() => {
        checkSystem();
        loadProjects();
    }, []);

    const openProject = async (name: string) => {
        await fetch('/api/project/open', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
        onOpen();
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = newProjectName.trim();
        if (!name) return;

        if (!/^[a-z0-9-]+$/.test(name)) {
            toast.error(t('dashboard.invalid_name'));
            return;
        }

        try {
            const res = await fetch('/api/project/create', {
                method: 'POST',
                body: JSON.stringify({ name })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || t('dashboard.toast_fail'));
            }

            toast.success(t('dashboard.toast_init'));
            setNewProjectName("");
            setIsCreating(false);
            loadProjects();
        } catch (error: any) {
            toast.error(error.message || t('dashboard.toast_fail'));
        }
    };

    const systemIssues = [
        !systemStatus.permissions
            ? { icon: Lock, tone: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", text: t('dashboard.system_check_perm_fail') }
            : null,
        !systemStatus.git_installed
            ? { icon: AlertTriangle, tone: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", text: t('dashboard.system_check_git_fail') }
            : null,
        systemStatus.git_installed && !systemStatus.git_configured
            ? { icon: Settings2, tone: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", text: t('dashboard.system_check_config_fail') }
            : null
    ].filter(Boolean) as Array<{ icon: typeof Lock; tone: string; bg: string; border: string; text: string }>;

    return (
        <div className="subtle-grid min-h-screen bg-background px-8 pb-8 pt-16 font-sans text-foreground">
            <div className="mx-auto w-full max-w-7xl">
                <header className="mb-10 border-b border-border/40 pb-6 text-left">
                    <div className="emerald-pill inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em]">
                        {t('dashboard.badge')}
                    </div>
                    <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">{t('dashboard.title')}</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {t('dashboard.subtitle')} {t('dashboard.subtitle_extended')}
                    </p>
                </header>

                <div className="panel-surface mb-8 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">{t('dashboard.system_check_title')}</h2>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {t('dashboard.system_check_desc')}
                            </p>
                        </div>
                        {systemIssues.length === 0 && (
                            <div className="emerald-pill rounded-full border px-3 py-1 text-xs font-medium">
                                {t('common.status_ok')}
                            </div>
                        )}
                    </div>

                    {systemIssues.length > 0 && (
                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {systemIssues.map((issue) => {
                                const Icon = issue.icon;
                                return (
                                    <div key={issue.text} className={`rounded-xl border ${issue.border} ${issue.bg} p-4`}>
                                        <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full ${issue.bg} ${issue.tone}`}>
                                            <Icon size={18} />
                                        </div>
                                        <p className="text-sm leading-6 text-foreground/90">{issue.text}</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {!isCreating ? (
                        <button
                            onClick={() => setIsCreating(true)}
                            disabled={!systemStatus.permissions}
                            className="group relative flex min-h-[172px] w-full flex-col items-start justify-between overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/14 via-emerald-500/6 to-transparent p-6 text-left shadow-[0_20px_70px_rgba(16,185,129,0.08)] transition-all duration-300 hover:border-emerald-400/50 hover:from-emerald-500/18 hover:to-amber-400/6 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-emerald-500/8 to-transparent" />
                            <div className="flex flex-col items-start gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 transition-colors duration-300 group-hover:bg-emerald-500/20 group-hover:text-emerald-800 dark:text-emerald-300 dark:group-hover:text-emerald-100">
                                    <Plus className="h-4 w-4" />
                                </div>
                                <div>
                                    <span className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                                        {t('dashboard.new_project')}
                                    </span>
                                    <p className="mt-2 max-w-[22rem] text-xs leading-5 text-muted-foreground">
                                        {t('dashboard.new_project_desc')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-200">
                                <span>{t('dashboard.create_first')}</span>
                                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                            </div>
                        </button>
                    ) : (
                        <Card className="panel-surface min-h-[172px] w-full border-primary/50 p-6">
                            <div className="flex h-full flex-col justify-between">
                                <div className="w-full">
                                    <span className="mb-3 block text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">{t('dashboard.init_project')}</span>
                                    <input
                                        autoFocus
                                        className="w-full rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary/40"
                                        placeholder={t('dashboard.placeholder')}
                                        value={newProjectName}
                                        onChange={e => setNewProjectName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleCreate(e)}
                                    />
                                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                                        {t('dashboard.name_hint')}
                                    </p>
                                </div>
                                <div className="mt-4 flex justify-end gap-2">
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setIsCreating(false)} className="h-8 px-3 text-xs">{t('common.cancel')}</Button>
                                    <Button size="sm" onClick={handleCreate} className="h-8 px-4 text-xs">{t('common.create')}</Button>
                                </div>
                            </div>
                        </Card>
                    )}

                    {isLoading && (
                        <>
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="panel-surface min-h-[172px] w-full p-6">
                                    <div className="flex flex-col gap-4">
                                        <Skeleton className="h-11 w-11 rounded-xl" />
                                        <div className="space-y-2">
                                            <Skeleton className="h-4 w-1/2" />
                                            <Skeleton className="h-3 w-2/3" />
                                            <Skeleton className="h-3 w-1/3" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}

                    {!isLoading && projects.map(name => (
                        <Card
                            key={name}
                            className="panel-surface group relative flex min-h-[172px] w-full cursor-pointer flex-col justify-between overflow-hidden p-6 transition-all duration-300 hover:border-primary/50 hover:bg-muted/10"
                            onClick={() => openProject(name)}
                        >
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                            <div className="flex flex-col items-start gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                                    <Terminal size={18} />
                                </div>
                                <div>
                                    <h3 className="w-full truncate text-base font-semibold tracking-tight text-foreground" title={name}>
                                        {name}
                                    </h3>
                                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                        {t('dashboard.reopen_desc')}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-5 flex items-center justify-between border-t border-border/30 pt-4">
                                <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/80">
                                    {t('dashboard.local_workspace')}
                                </span>
                                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                                    <span>{t('dashboard.open_cta')}</span>
                                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>

                {!isLoading && projects.length === 0 && !isCreating && (
                    <div className="panel-surface mt-6 p-6">
                        <h2 className="text-lg font-semibold text-foreground">{t('dashboard.empty_title')}</h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                            {t('dashboard.empty_desc')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
