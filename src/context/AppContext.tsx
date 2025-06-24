import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getUserId, getSessionId, setSessionIdForApp, renewSessionId } from '../lib/sessionManager'; // Ensure renewSessionId is imported
import { SessionInfo } from '../interfaces/interfaces';
import { toast } from 'sonner';

interface AppContextType {
  appList: string[];
  selectedApp: string | null;
  appListError: string | null;
  isLoadingApps: boolean;
  selectApp: (appName: string) => void;
  fetchApps: () => Promise<void>;
  sessionVersion: number;
  incrementSessionVersion: () => void;
  recentSessions: SessionInfo[];
  currentSessionId: string | null;
  setRecentSessions: (sessions: SessionInfo[]) => void;
  loadSessionContext: (sessionId: string, appName?: string) => void;
  isSidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  startNewSession: (appName: string) => Promise<void>; // New function
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [appList, setAppList] = useState<string[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [appListError, setAppListError] = useState<string | null>(null);
  const [isLoadingApps, setIsLoadingApps] = useState<boolean>(true);
  const [sessionVersion, setSessionVersion] = useState<number>(0);
  const [recentSessions, setRecentSessionsState] = useState<SessionInfo[]>([]);
  const [currentSessionId, setCurrentSessionIdState] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false); // Default to false
  const API_BASE_URL = import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8000';

  const incrementSessionVersion = useCallback(() => {
    setSessionVersion(prevVersion => prevVersion + 1);
    console.log('[AppContext] Session version incremented.');
  }, []);

  const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);

  // Renamed from fetchApps for clarity, as this is the initial setup logic.
  // fetchApps in context type can point to this.
  const initAppsAndDefaultSession = useCallback(async () => {
    setIsLoadingApps(true);
    setAppListError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/list-apps`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch app list: ${response.status} ${errorText || response.statusText}`);
            }
            const data: string[] = await response.json();
            if (data && data.length > 0) {
                setAppList(data);
                const initialSelectedApp = data[0];
                setSelectedApp(initialSelectedApp);
                // Note: selectedApp change triggers another useEffect which clears currentSessionId and recentSessions.
                // Chat.tsx's useEffect will then handle getting/creating the session for initialSelectedApp.
                // No need to explicitly call getSessionId or setCurrentSessionIdState here for the initial app.
            } else {
                setAppList([]);
                setSelectedApp(null);
            }
        } catch (error) {
            if (error instanceof Error) {
                setAppListError(error.message);
            } else {
                setAppListError('An unknown error occurred while fetching the app list.');
            }
            setAppList([]);
            setSelectedApp(null);
        } finally {
            setIsLoadingApps(false);
        }
  }, []);

  useEffect(() => {
    initAppsAndDefaultSession();
  }, [initAppsAndDefaultSession]);

  const selectApp = useCallback((appName: string) => {
    if (appList.includes(appName)) {
      setSelectedApp(appName);
    } else {
      console.warn(`Attempted to select app "${appName}" not found in appList.`);
    }
  }, [appList]);

  const setRecentSessions = useCallback((sessions: SessionInfo[]) => {
    setRecentSessionsState(sessions);
  }, []);

  const loadSessionContext = useCallback(async (sessionId: string, appNameFromClick?: string) => {
    // const targetAppName = appName || selectedApp; // REMOVE THIS LINE
    // if (!targetAppName) {
    //   console.error("[AppContext] loadSessionContext: No appName provided or selected.");
    //   toast.error("Cannot load session: No application specified.");
    //   return;
    // }

    const targetAppName = appNameFromClick || selectedApp; // This is the correct intended declaration
    if (!targetAppName) {
      console.error("[AppContext] loadSessionContext: No appName provided or selected.");
      toast.error("Cannot load session: No application specified.");
      return;
    }

    console.log(`[AppContext] loadSessionContext: Setting current session to ${sessionId} for app ${targetAppName}`);

    // Persist this choice so getSessionId() (used as a fallback or by other parts) is aligned
    await setSessionIdForApp(targetAppName, sessionId);

    // Update context state. This will be a primary trigger for chat.tsx's useEffect.
    setCurrentSessionIdState(sessionId);

    // If the app itself needs to be changed, do that. This will also trigger chat.tsx's useEffect.
    if (selectedApp !== targetAppName) {
      setSelectedApp(targetAppName);
    }
    // No explicit incrementSessionVersion() needed here if chat.tsx reacts to currentSessionId from context.
    toast.info(`Loading session ${sessionId.substring(0,8)}... for app ${targetAppName}.`);
  }, [selectedApp, setSelectedApp]); // Ensure setSelectedApp is a stable callback or included if from useState

  useEffect(() => {
    // When selectedApp changes, clear the specific currentSessionId from context.
    // This allows chat.tsx's useEffect to fall back to getSessionId(newSelectedApp)
    // for the default session loading behavior of that app.
    // Also clear recent sessions as they are app-specific.
    setCurrentSessionIdState(null);
    setRecentSessionsState([]);
    console.log(`[AppContext] Selected app changed to ${selectedApp}. Cleared currentSessionId and recentSessions from context.`);
  }, [selectedApp]);

  const startNewSession = useCallback(async (appName: string) => {
    if (!appName) {
      toast.error("Cannot start new session: No application specified.");
      console.error("[AppContext] startNewSession called without appName.");
      return;
    }
    toast.info(`Starting new session for ${appName}...`);
    try {
      const newSessionId = await renewSessionId(appName); // Creates new ID and updates localStorage

      if (newSessionId.startsWith("error_")) {
        toast.error(`Failed to start new session for ${appName}: ${newSessionId.substring(6)}`);
        // Do not change currentSessionIdState if renewal failed, keep user in current valid session.
      } else {
        // Successfully created a new session ID and it's in localStorage.
        // Now, update AppContext's currentSessionId to this new one.
        // This change will trigger chat.tsx's useEffect.
        setCurrentSessionIdState(newSessionId);

        // Increment sessionVersion to ensure all dependent effects run,
        // e.g., Sidebar might refresh its list, other components might react.
        incrementSessionVersion();
        toast.success(`New session ${newSessionId.substring(0,8)} started for ${appName}.`);
      }
    } catch (error) {
      console.error(`[AppContext] Error in startNewSession for app ${appName}:`, error);
      toast.error(`An unexpected error occurred while starting a new session for ${appName}.`);
    }
  }, [incrementSessionVersion]);

  return (
    <AppContext.Provider value={{
      appList,
      selectedApp,
      appListError,
      isLoadingApps,
      selectApp,
      fetchApps: initAppsAndDefaultSession,
      sessionVersion,
      incrementSessionVersion,
      recentSessions,
      currentSessionId,
      setRecentSessions,
      loadSessionContext,
      isSidebarOpen,
      openSidebar,
      closeSidebar,
      toggleSidebar,
      startNewSession // Add new function to provider value
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
