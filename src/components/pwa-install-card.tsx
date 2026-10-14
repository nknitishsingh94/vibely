'use client';

import * as React from 'react';
import { Download, Monitor, CheckCircle2, Smartphone } from 'lucide-react';
import { usePwaInstall } from '@/components/pwa-register';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

export function PwaInstallCard() {
  const { canInstall, isStandalone, triggerInstall } = usePwaInstall();
  const [isInstalling, setIsInstalling] = React.useState(false);

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      const installed = await triggerInstall();
      if (installed) {
        toast.success('Vibely app installed successfully!');
      } else {
        toast.info('Installation cancelled or prompt closed.');
      }
    } catch {
      toast.error('Could not complete installation');
    } finally {
      setIsInstalling(false);
    }
  };

  if (isStandalone) {
    return (
      <div className="p-4 rounded-3xl bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Running as Desktop App</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Vibely is running in standalone mode with full features.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-card border border-border/80 shadow-xs space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#0C3B2E]/15 text-[#0C3B2E] dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Download / Install Vibely App</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Install directly from Chrome onto your Windows Desktop or Phone.
            </p>
          </div>
        </div>
      </div>

      <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Monitor className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            PC / Mac Desktop
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Android / iPhone
          </span>
        </div>

        {canInstall ? (
          <Button
            size="sm"
            onClick={handleInstallClick}
            isLoading={isInstalling}
            className="rounded-xl font-semibold bg-[#0C3B2E] hover:bg-[#092B22] text-white shrink-0"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Install App Now
          </Button>
        ) : (
          <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
            In Chrome: Click the <strong className="font-semibold">Install</strong> icon in the address bar (top right)
          </div>
        )}
      </div>
    </div>
  );
}
