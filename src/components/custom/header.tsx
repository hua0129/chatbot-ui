import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { LanguageSwitcher } from './language-switcher'; // Add this line
import { useAppContext } from '../../context/AppContext';
import { toast } from 'sonner';
import { Menu } from 'lucide-react';

export function Header() {
  const { t } = useTranslation();
  const {
    appList,
    selectedApp,
    selectApp,
    isLoadingApps,
    appListError,
    // incrementSessionVersion, // No longer directly needed by this component's handleNewSession
    toggleSidebar,
    startNewSession, // Get the new context function
  } = useAppContext();

  const [isRenewingSession, setIsRenewingSession] = useState<boolean>(false); // Keep for UI feedback

  const handleNewSession = async () => {
    if (!selectedApp) {
      toast.error(t('header.toast.selectAppForNewSession'));
      return;
    }
    if (isRenewingSession) return;

    setIsRenewingSession(true);
    // toast.info from startNewSession will cover this. Or keep a more generic one here.
    // toast.info(`Starting new session for app: ${selectedApp}...`); // Optional: can be removed if startNewSession's toast is sufficient

    // Call the context function which now handles renewSessionId, setCurrentSessionId, and incrementSessionVersion
    await startNewSession(selectedApp);

    // The specific success/error toasts are now handled within startNewSession in AppContext
    // So, no need for try/catch here to duplicate that toast logic, unless for additional specific UI updates here.

    setIsRenewingSession(false); // Reset loading state

  };

  useEffect(() => {
    if (appListError) {
      toast.error(t('header.toast.errorLoadingApps', { error: appListError }));
    }
  }, [appListError, t]);

  // Determine if the New Session button should be disabled
  const newSessionButtonDisabled = !selectedApp || isLoadingApps || !!appListError || isRenewingSession;
  // Determine if the app selector should be disabled
  const appSelectorDisabled = isLoadingApps || !!appListError || isRenewingSession;


  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-4xl items-center">
        {/* Sidebar Toggle Button - Placed at the beginning */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar} // Use context's toggleSidebar
          className="mr-2" // md:hidden has been removed
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">{t('header.button.toggleSidebar')}</span>
        </Button>

        {/* Existing content: App Selector, New Session Button, Theme Toggle */}
        <div className="mr-auto flex items-center space-x-4">
          {/* ... (App selector logic as before) ... */}
           {isLoadingApps && <p className="text-sm text-muted-foreground">{t('header.status.loadingApps')}</p>}
          {!isLoadingApps && appListError && <p className="text-sm text-red-500">{t('header.status.appListUnavailable')}</p>}
          {!isLoadingApps && !appListError && appList.length > 0 && (
            <div className="flex items-center space-x-2">
              <label htmlFor="app-selector" className="text-sm font-medium">{t('header.appSelector.label')}</label>
              <select
                id="app-selector"
                value={selectedApp || ''}
                onChange={(e) => selectApp(e.target.value)}
                disabled={appSelectorDisabled} // Use combined disabled state for selector
                className="block w-40 pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-background text-foreground border"
              >
                {appList.map(app => (
                  <option key={app} value={app}>
                    {app}
                  </option>
                ))}
              </select>
            </div>
          )}
           {!isLoadingApps && !appListError && appList.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('header.status.noAppsAvailable')}</p>
           )}
        </div>

        <div className="flex items-center justify-end space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewSession}
            className="ml-2"
            disabled={newSessionButtonDisabled}
          >
            {isRenewingSession ? "Starting..." : t('new_session_button', 'New Session') }
          </Button>
          <LanguageSwitcher /> {/* Add this line */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}