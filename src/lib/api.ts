import { v4 as uuidv4 } from 'uuid';
import { Message, SessionInfo } from '../../interfaces/interfaces';

const API_BASE_URL = '/api/ddocstore';
const ADK_AGENT_API_BASE_URL = import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8000';

interface ErrorResponse {
    status: number;
    body: any;
}

async function handleResponse(response: Response): Promise<any> {
    if (!response.ok) {
        let errorBody;
        try {
            errorBody = await response.json();
        } catch (e) {
            errorBody = await response.text();
        }
        const error: ErrorResponse = {
            status: response.status,
            body: errorBody,
        };
        throw error;
    }
    return response.json();
}

export async function uploadDocument(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/upload/`, {
        method: 'POST',
        body: formData,
        headers: {
            'Accept': 'application/json',
        },
    });
    return handleResponse(response);
}

export async function getUserSessions(appName: string, userId: string): Promise<SessionInfo[]> {
  const url = `${ADK_AGENT_API_BASE_URL}/apps/${appName}/users/${userId}/sessions`;
  console.log(`[API] Fetching user sessions from: ${url}`);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.json();
      } catch (e) {
        errorBody = await response.text();
      }
      console.error(`[API] Error fetching user sessions: ${response.status}`, errorBody);
      // Assuming ErrorResponse is defined in this file, or define a similar local error structure
      const error: ErrorResponse = {
        status: response.status,
        body: errorBody,
      };
      throw error;
    }

    const data = await response.json(); // Expecting an array of session objects

    if (Array.isArray(data)) {
      // Transform the raw session data into SessionInfo objects
      const sessions: SessionInfo[] = data.map((sessionData: any) => {
        // Create a display name. For example, using the session ID and/or a timestamp.
        // This can be refined later.
        //let displayName = `Session ${sessionData.id.substring(0, 8)}`;
        let displayName = '';
        if (sessionData.events && sessionData.events.length > 0) {
          // Fallback: Try to find the first user message text for a title
          const firstUserEvent = sessionData.events.find((event: any) =>
            event.author === 'user' &&
            event.content &&
            event.content.parts &&
            event.content.parts.some((part:any) => part.text)
          );
          if (firstUserEvent) {
            const firstTextPart = firstUserEvent.content.parts.find((part: any) => part.text);
            if (firstTextPart) {
              displayName = firstTextPart.text.substring(0, 30) + (firstTextPart.text.length > 30 ? '...' : '');
            }
          }
        }
        // else if (sessionData.lastUpdateTime) {
        //   try {
        //     displayName = `${new Date(sessionData.lastUpdateTime * 1000).toLocaleString()} (ID: ...${sessionData.id.slice(-4)})`;
        //   } catch (e) { /* ignore date parsing error, stick to default */ }
        // }

        return {
          id: sessionData.id,
          appName: sessionData.appName,
          userId: sessionData.userId,
          lastUpdateTime: sessionData.lastUpdateTime, // Ensure this field name matches the API
          displayName: displayName,
          // Other fields from SessionInfo like 'state' or 'events' are not directly mapped here
          // as they are not needed for the list view.
        };
      });
      // Sort sessions by lastUpdateTime in descending order (most recent first)
      sessions.sort((a, b) => (b.lastUpdateTime || 0) - (a.lastUpdateTime || 0));
      return sessions;
    } else {
      console.warn('[API] getUserSessions: Response data is not an array as expected. Data:', data);
      return []; // Return empty array if structure is not recognized
    }
  } catch (error) {
    console.error(`[API] Exception while fetching user sessions for app ${appName}, user ${userId}:`, error);
    throw error; // Re-throw or handle as appropriate
  }
}

export async function getSessionMessages(appName: string, userId: string, sessionId: string): Promise<Message[]> {
  const url = `${ADK_AGENT_API_BASE_URL}/apps/${appName}/users/${userId}/sessions/${sessionId}`; // Changed API_BASE_URL to ADK_AGENT_API_BASE_URL
  console.log(`[API] Fetching session messages from: ${url}`);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    // Use a modified handleResponse or inline response handling
    // if the expected successful response is not JSON but an array of messages directly
    // For now, assuming it returns a JSON object that has a 'messages' field or is the array itself.
    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.json();
      } catch (e) {
        errorBody = await response.text();
      }
      console.error(`[API] Error fetching session messages: ${response.status}`, errorBody);
      const error: ErrorResponse = { // Assuming ErrorResponse is defined in this file
        status: response.status,
        body: errorBody,
      };
      throw error;
    }
    const data = await response.json(); // This is the full object like {"id": "s_1253", "events": [...]}

    if (data && data.events && Array.isArray(data.events)) {
      const messages: Message[] = [];
      data.events.forEach((event: any) => {
        let messageText = "";
        let role: 'user' | 'assistant' | 'system' = 'assistant'; // Default role
        let currentArtifactFilenames: string[] = [];

        if (event.author === 'user') {
          role = 'user';
        } else if (event.author && event.author.startsWith('db_')) { // Example: "db_ds_multiagent"
          role = 'assistant';
        }
        // Add other author to role mappings if necessary

        if (event.content && event.content.parts && Array.isArray(event.content.parts)) {
          event.content.parts.forEach((part: any) => {
            if (part.text) {
              messageText += part.text;
            }
            // Could also look for inlineData here if historical messages might contain them directly,
            // but the request focuses on artifactDelta/stateDelta like streaming.
          });
        }

        // Check for artifacts, similar to streaming logic in chat.tsx
        if (event.actions) {
          if (event.actions.artifactDelta) {
            Object.keys(event.actions.artifactDelta).forEach(filename => {
              if (filename.match(/\.(png|jpg|jpeg|gif)$/i)) {
                if (!currentArtifactFilenames.includes(filename)) {
                  currentArtifactFilenames.push(filename.replace(/^["'](.*)["']$/, '$1'));
                }
              }
            });
          }
          if (event.actions.stateDelta && event.actions.stateDelta.image_plot_filename) {
            const filename = event.actions.stateDelta.image_plot_filename;
            if (filename.match(/\.(png|jpg|jpeg|gif)$/i)) {
              if (!currentArtifactFilenames.includes(filename)) {
                currentArtifactFilenames.push(filename.replace(/^["'](.*)["']$/, '$1'));
              }
            }
          }
        }

        // Only create a message if there's text content OR identified artifacts for assistant messages.
        // User messages typically won't have artifacts generated by the user in this way.
        if (messageText.trim() !== "" || (role === 'assistant' && currentArtifactFilenames.length > 0)) {
          messages.push({
            id: event.id || uuidv4(),
            role: role,
            content: messageText.trim(),
            invocationId: event.invocationId, // If available and needed
            artifactFilenames: currentArtifactFilenames.length > 0 ? currentArtifactFilenames : undefined,
            // imageUrls will be populated by chat.tsx after fetching these artifacts
          });
        }
      });
      console.log(`[API] getSessionMessages: Parsed ${messages.length} messages from ${data.events.length} events.`);
      return messages;
    }
    console.warn('[API] getSessionMessages: Response data or data.events is not as expected. Data:', data);
    return [];
  } catch (error) {
    console.error(`[API] Exception while fetching session messages for session ${sessionId}:`, error);
    throw error;
  }
}

export async function reEmbedDocument(doc_uuid: string, new_embedder_version_override?: string): Promise<any> {
    let url = `${API_BASE_URL}/documents/${doc_uuid}/re-embed`;
    if (new_embedder_version_override) {
        url += `?new_embedder_version_override=${new_embedder_version_override}`;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
        },
    });
    return handleResponse(response);
}

export async function deleteDocument(doc_uuid: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/documents/${doc_uuid}`, {
        method: 'DELETE',
        headers: {
            'Accept': 'application/json',
        },
    });
    return handleResponse(response);
}

export async function getWorkflowStatus(workflow_id: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/workflows/${workflow_id}/status`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
        },
    });
    return handleResponse(response);
}
