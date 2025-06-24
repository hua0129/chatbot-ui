import { v4 as uuidv4 } from 'uuid';

const USER_ID_KEY = 'userId';
const SESSION_ID_KEY = 'sessionId';
const API_BASE_URL = import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8000';

// Modified to return a boolean indicating success
async function createBackendSession(userId: string, sessionId: string, appName: string): Promise<boolean> {
  if (!appName) {
    console.error("appName is required for createBackendSession but was not provided.");
    return false;
  }
  const url = `${API_BASE_URL}/apps/${appName}/users/${userId}/sessions/${sessionId}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Failed to create backend session ${sessionId} for user ${userId} with app ${appName}. Status: ${response.status}`, errorBody);
      return false;
    } else {
      console.log(`Backend session ${sessionId} for app ${appName} created successfully for user ${userId}.`);
      return true;
    }
  } catch (error) {
    console.error(`Error calling create backend session API for session ${sessionId}, app ${appName}:`, error);
    return false;
  }
}

export const getUserId = (): string => {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = uuidv4();
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
};

// Modified to be async and await createBackendSession
export async function getSessionId(appName: string): Promise<string> {
  if (!appName) {
    console.warn("getSessionId called without appName. Session operations requiring appName (like creation) may fail if new session is needed.");
    // If appName is not available, we can't create a session, but if one exists in localStorage, we can return it.
    // However, this scenario should ideally be prevented by the UI.
  }
  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  const userId = getUserId();

  if (!sessionId) {
    if (!appName) {
      console.error("Cannot initialize new session ID because appName is missing.");
      return `error_no_app_name_for_new_session_${uuidv4()}`;
    }
    sessionId = uuidv4();
    // Do NOT set sessionId in localStorage yet. Only after successful backend creation.
    // localStorage.setItem(SESSION_ID_KEY, sessionId);
    const success = await createBackendSession(userId, sessionId, appName);
    if (!success) {
      console.error(`getSessionId: Backend session creation failed for app ${appName}, new potential sessionId ${sessionId}.`);
      return `error_backend_session_failed_${sessionId}`; // Indicate backend failure
    }
    // Set sessionId in localStorage only after successful backend creation
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
};

// Modified to be async and await createBackendSession
export async function renewSessionId(appName: string): Promise<string> {
  if (!appName) {
    console.error("Cannot renew session ID because appName is missing.");
    return `error_no_app_name_for_renew_session_${uuidv4()}`;
  }
  const newSessionId = uuidv4();
  const userId = getUserId();
  // Do NOT set newSessionId in localStorage yet. Only after successful backend creation.
  // localStorage.setItem(SESSION_ID_KEY, newSessionId);
  const success = await createBackendSession(userId, newSessionId, appName);
  if (!success) {
    console.error(`renewSessionId: Backend session creation failed for app ${appName}, new potential sessionId ${newSessionId}.`);
    // Potentially, should not update localStorage if backend call fails,
    // or UI should handle this error string and not use it as a valid session ID.
    return `error_backend_session_failed_${newSessionId}`; // Indicate backend failure
  }
  // Set newSessionId in localStorage only after successful backend creation
  localStorage.setItem(SESSION_ID_KEY, newSessionId);
  return newSessionId;
};

export async function setSessionIdForApp(appName: string, sessionId: string): Promise<void> {
  // Here, we need to consider if setting a session ID implies it's valid on the backend.
  // The `getSessionId` and `renewSessionId` functions create backend sessions.
  // `loadSessionContext` implies we are loading an *existing* session.
  // So, we don't need to call `createBackendSession` here.
  // We just update localStorage to make this the active session for subsequent operations
  // within the context of the given appName (though SESSION_ID_KEY is global).
  // The appName isn't directly used to key localStorage here if we stick to one SESSION_ID_KEY,
  // but it's good for context and future-proofing if localStorage becomes app-keyed.

  console.log(`[sessionManager] Setting session ID for app ${appName} to ${sessionId} in localStorage (key: ${SESSION_ID_KEY}).`);
  localStorage.setItem(SESSION_ID_KEY, sessionId);
  // No backend call needed here as we are loading an existing session.
}
