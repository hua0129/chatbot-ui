import { useTranslation } from 'react-i18next';
import React, { useState, useEffect, useCallback } from 'react'; // Added useEffect, useCallback
import { Button } from '@/components/ui/button';
import { PlusCircle, MessageCircle, X, Trash2, Loader2 } from 'lucide-react'; // Added Loader2
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppContext } from '../../context/AppContext'; // Import AppContext
import { getUserId } from '../../lib/sessionManager';    // Import getUserId
import { getUserSessions } from '../../lib/api';         // Import getUserSessions
import { SessionInfo } from '../../interfaces/interfaces'; // Import SessionInfo
import { toast } from 'sonner';                           // For error notifications

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  // onDeleteChat is removed for now as session deletion is out of scope
  // If we want to keep it, it needs to be re-evaluated against session IDs
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { t } = useTranslation();
  const {
    selectedApp,
    recentSessions,
    setRecentSessions,
    loadSessionContext,
    currentSessionId,
    // incrementSessionVersion, // No longer directly needed by this component's handleCreateNewChat
    startNewSession,      // Get the new context function
  } = useAppContext();

  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(false);
  const [isCreatingNewChat, setIsCreatingNewChat] = useState<boolean>(false); // For UI feedback

  // Fetch sessions when selectedApp changes
  useEffect(() => {
    if (selectedApp) {
      const userId = getUserId(); // Assuming getUserId() is synchronous
      if (!userId) {
        console.error("[Sidebar] User ID not found. Cannot fetch sessions.");
        toast.error(t('sidebar.toast.userIdNotFound'));
        setRecentSessions([]); // Clear sessions if no user ID
        return;
      }

      setIsLoadingSessions(true);
      console.log(`[Sidebar] Fetching sessions for app: ${selectedApp}, user: ${userId}`);
      getUserSessions(selectedApp, userId)
        .then(sessions => {
          console.log(`[Sidebar] Fetched ${sessions.length} sessions.`);
          setRecentSessions(sessions);
        })
        .catch(error => {
          console.error("[Sidebar] Error fetching sessions:", error);
          toast.error(t('sidebar.toast.failedToFetchRecentChats', { message: error.message || t('common.unknownError') }));
          setRecentSessions([]); // Clear sessions on error
        })
        .finally(() => {
          setIsLoadingSessions(false);
        });
    } else {
      setRecentSessions([]); // Clear sessions if no app selected
    }
  }, [selectedApp, setRecentSessions]); // Dependency array is correct

  const handleCreateNewChat = async () => { // Make async
    if (!selectedApp) {
      toast.error(t('sidebar.toast.selectAppForNewChat'));
      return;
    }
    if (isCreatingNewChat) return;

    setIsCreatingNewChat(true);
    // toast.info from startNewSession will cover this.
    // toast.info(`Starting new chat for ${selectedApp}...`); // Optional

    await startNewSession(selectedApp); // Call the context function

    // Success/error toasts are handled by startNewSession in AppContext.
    setIsCreatingNewChat(false);
    onClose(); // Close sidebar after initiating new chat
  };

  const handleSelectChat = (sessionId: string) => {
    if (!selectedApp) {
        toast.error(t('sidebar.toast.noAppSelected'));
        return;
    }
    console.log(`[Sidebar] Selecting chat (session): ${sessionId} for app: ${selectedApp}`);
    loadSessionContext(sessionId, selectedApp); // Call context function to load the session
    onClose(); // Close sidebar after selection
  };

  // No session deletion (handleDeleteChat) for now as it's out of scope.

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 w-72 bg-background border-r transform transition-transform duration-200 ease-in-out z-50 flex flex-col", // Increased width to w-72
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-lg font-semibold">{t('sidebar.header.recentChats')}</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4">
        <Button
          onClick={handleCreateNewChat}
          className="w-full mb-4 flex items-center gap-2"
          variant="outline"
          disabled={!selectedApp || isLoadingSessions || isCreatingNewChat}
        >
          {isCreatingNewChat ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
          {isCreatingNewChat ? "Starting..." : t('sidebar.button.newChat', "New Chat")}
        </Button>
      </div>

      {/* ... (ScrollArea and rendering logic for recentSessions remains the same) ... */}
      <ScrollArea className="flex-1 px-4">
        {isLoadingSessions && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">{t('sidebar.status.loadingChats')}</span>
          </div>
        )}
        {!isLoadingSessions && recentSessions.length === 0 && selectedApp && (
          <p className="text-sm text-muted-foreground text-center py-4">{t('sidebar.status.noRecentChats', { appName: selectedApp })}</p>
        )}
        {!isLoadingSessions && !selectedApp && (
           <p className="text-sm text-muted-foreground text-center py-4">{t('sidebar.status.selectAppToSeeChats')}</p>
        )}
        {!isLoadingSessions && recentSessions.length > 0 && (
          <div className="space-y-2">
            {recentSessions.filter((session) => session.displayName).map((session) => (
              <div
                key={session.id}
                className="group relative"
              >
                <Button
                  variant={session.id === currentSessionId ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2 pr-8 text-left h-auto py-2" // Allow button to grow, align left
                  onClick={() => handleSelectChat(session.id)}
                  title={session.displayName || t('sidebar.chat.title', { sessionId: session.id })}
                >
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  <span className="truncate flex-grow">{session.displayName || t('sidebar.chat.defaultName', { sessionId: session.id.substring(0,8) })}</span>
                </Button>
                {/* Session deletion button removed for now
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                  // onClick={(e) => handleDeleteChat(e, session.id)} // Re-enable if needed
                >
                  <Trash2 className="h-4 w-4 text-primary" />
                </Button>
                */}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      {/* Maybe a footer for total count or other actions */}
    </div>
  );
}
