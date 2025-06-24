import { useTranslation } from 'react-i18next';
import { ChatInput } from "@/components/custom/chatinput";
import { PreviewMessage, ThinkingMessage } from "../../components/custom/message";
import { useScrollToBottom } from '@/components/custom/use-scroll-to-bottom';
import { useState, useEffect, useRef } from "react";
import { Message } from "../../interfaces/interfaces";
import { Overview } from "@/components/custom/overview";
import { Header } from "@/components/custom/header";
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { getUserId, getSessionId, setSessionIdForApp } from "../../lib/sessionManager"; // Import setSessionIdForApp
import { getSessionMessages } from '../../lib/api';
import { useAppContext } from '../../context/AppContext';
import { convertUrlSafeBase64ToStandard } from '../../lib/utils';

export function Chat() {
  const { t } = useTranslation();
  const [messagesContainerRef, messagesEndRef] = useScrollToBottom<HTMLDivElement>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSessionLoading, setIsSessionLoading] = useState<boolean>(false);
  const API_BASE_URL = import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8000';

  const {
    selectedApp,
    appListError,
    isLoadingApps,
    sessionVersion, // Keep sessionVersion for "New Session" button functionality from Header
    currentSessionId: contextSessionId // Get the specific session ID from context
  } = useAppContext();
  const streamAbortControllerRef = useRef<AbortController | null>(null);
  const backendStreamInvocationIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (streamAbortControllerRef.current) {
        streamAbortControllerRef.current.abort("Component unmounting");
        streamAbortControllerRef.current = null;
        console.log("[Lifecycle] Aborted stream due to component unmount.");
      }
    };
  }, []);

  useEffect(() => {
    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort("Selected app changed");
      streamAbortControllerRef.current = null;
      console.log("[Lifecycle] Aborted previous stream due to selectedApp change.");
    }
    backendStreamInvocationIdRef.current = null;
    setIsLoading(false);

    const setupSessionForApp = async () => {
      if (selectedApp) {
        setIsSessionLoading(true);
        setMessages([]);

        const userId = getUserId();
        let sessionIdToLoad: string | null = null;

        if (contextSessionId) {
            console.log(`[Chat] Prioritizing session ID from AppContext: ${contextSessionId} for app ${selectedApp}`);
            sessionIdToLoad = contextSessionId;
        } else {
            console.log(`[Chat] No specific session ID in AppContext, calling getSessionId for app: ${selectedApp}`);
            sessionIdToLoad = await getSessionId(selectedApp);
        }

        if (!sessionIdToLoad || sessionIdToLoad.startsWith("error_")) {
          toast.error(t('chat.toast.failedSessionId', { appName: selectedApp, error: sessionIdToLoad || t('common.unknownError') }));
          setMessages([]);
          setIsSessionLoading(false);
          return;
        }

        // Ensure localStorage is aligned if contextSessionId was used and differs.
        // This is important because other parts of the app might still rely on sessionManager.getSessionId()
        // which reads from localStorage. loadSessionContext in AppContext already calls setSessionIdForApp.
        // This check ensures that if contextSessionId is set directly (e.g. via URL param in future, or dev tools),
        // localStorage is also updated.
        if (contextSessionId && localStorage.getItem('sessionId') !== contextSessionId) {
             console.warn(`[Chat] Aligning localStorage session ID (${localStorage.getItem('sessionId')}) with context's session ID (${contextSessionId}) for app ${selectedApp}.`);
             await setSessionIdForApp(selectedApp, contextSessionId);
        }

        // The toast logic for new session instance vs. loading history could be refined here.
        // sessionVersion change indicates a "New Chat" action.
        // contextSessionId change indicates loading a specific chat from sidebar.
        // No contextSessionId and no sessionVersion change (just app switch) means loading default for app.
        if (sessionVersion > 0 && !contextSessionId) { // This condition might need refinement based on how sessionVersion is used elsewhere
            toast.info(t('chat.toast.newChatInstance', { appName: selectedApp, sessionId: sessionIdToLoad.substring(0,8) }));
        } else {
            toast.success(t('chat.toast.chatReady', { appName: selectedApp, sessionId: sessionIdToLoad.substring(0,8) }));
        }

        try {
          const initialMessages = await getSessionMessages(selectedApp, userId, sessionIdToLoad);

          if (initialMessages && initialMessages.length > 0) {
            // Set messages initially without images, or with placeholders if desired.
            // For simplicity, we'll set them and then update them if images are found.
            setMessages(initialMessages);
            toast.info(`Loaded ${initialMessages.length} messages from session history. Checking for images...`);

            // Asynchronously fetch images for these historical messages
            initialMessages.forEach(async (message) => {
              if (message.artifactFilenames && message.artifactFilenames.length > 0) {
                const fetchedImageUrls: string[] = [];
                // Use a non-abortable signal for these historical fetches, or manage a new AbortController if needed.
                // For simplicity, not using an abort signal here, assuming these are less critical to abort than live streaming.

                for (const filename of message.artifactFilenames) {
                  const artifactFilename = filename.replace(/^["'](.*)["']$/, '$1');
                  // sessionIdToLoad is the session ID for the entire history being loaded
                  const artifactUrl = `${API_BASE_URL}/apps/${selectedApp}/users/${userId}/sessions/${sessionIdToLoad}/artifacts/${encodeURIComponent(artifactFilename)}`;
                  console.log(`[Chat] Fetching historical image artifact: ${artifactUrl} for message ${message.id}`);

                  try {
                    const imageResponse = await fetch(artifactUrl); // No AbortController signal for now
                    if (imageResponse.ok) {
                      const artifactJson = await imageResponse.json();
                      if (artifactJson.inlineData &&
                          typeof artifactJson.inlineData.data === 'string' &&
                          typeof artifactJson.inlineData.mimeType === 'string') {

                        const rawBase64ImageData = artifactJson.inlineData.data;
                        const standardBase64Data = convertUrlSafeBase64ToStandard(rawBase64ImageData); // Assuming this util is available
                        const mimeType = artifactJson.inlineData.mimeType;
                        const dataUri = `data:${mimeType};base64,${standardBase64Data}`;
                        fetchedImageUrls.push(dataUri);
                      } else {
                        console.error(`[Chat] Historical artifact JSON for ${artifactFilename} missing required fields.`, artifactJson);
                      }
                    } else {
                      console.error(`[Chat] Failed to fetch historical image artifact ${artifactFilename}: ${imageResponse.status} ${imageResponse.statusText}`);
                    }
                  } catch (fetchError: any) {
                    console.error(`[Chat] Error fetching/parsing historical artifact JSON for ${artifactFilename}:`, fetchError);
                  }
                } // End for loop of artifactFilenames

                if (fetchedImageUrls.length > 0) {
                  setMessages(prevMsgs => prevMsgs.map(m => {
                    if (m.id === message.id) {
                      return {
                        ...m,
                        imageUrls: [...(m.imageUrls || []), ...fetchedImageUrls]
                      };
                    }
                    return m;
                  }));
                }
              } // End if message.artifactFilenames
            }); // End forEach initialMessages

          } else { // No initial messages

            setMessages([]);
            toast.info(t('chat.toast.noHistory', { sessionId: sessionIdToLoad.substring(0,8) }));
          }
        } catch (error: any) {
          console.error("Failed to fetch session messages or their artifacts:", error);
          toast.error(`Failed to load message history: ${error.message || 'Unknown error'}`);
          setMessages([]);
        } finally {
          setIsSessionLoading(false);
        }
      } else {
         setMessages([]);
         if (isSessionLoading) setIsSessionLoading(false);
      }
    };

    setupSessionForApp();
  }, [selectedApp, sessionVersion, contextSessionId]); // Add contextSessionId to dependency array

  async function handleSubmit(text?: string, files?: File[]) {
    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort("New submission started");
    }
    const abortController = new AbortController();
    streamAbortControllerRef.current = abortController;

    const frontendInvocationId = uuidv4();
    backendStreamInvocationIdRef.current = null;
    let assistantMessageId: string | null = null;

    if (isLoading || isSessionLoading || !selectedApp || appListError) {
      if (isSessionLoading && !isLoading) { toast.error(t('chat.toast.sessionInitializing')); }
      else if (!selectedApp && !isLoadingApps && !isLoading) { toast.error(t('chat.toast.noAppSelectedError')); }
      else if (appListError && !isLoading) { toast.error(t('chat.toast.appListError', {error: appListError}));}
      if (streamAbortControllerRef.current === abortController) { streamAbortControllerRef.current = null; }
      return;
    }

    const messageText = text || question;
    if (!messageText && (!files || files.length === 0)) {
        toast.info(t('chat.toast.enterMessage'));
        if (streamAbortControllerRef.current === abortController) { streamAbortControllerRef.current = null; }
        return;
    }
     if (!messageText) {
        toast.info(t('chat.toast.enterMessage')); // Assuming same message for just text missing
        if (streamAbortControllerRef.current === abortController) { streamAbortControllerRef.current = null; }
        return;
    }

    const userMessage: Message = {
      content: messageText,
      role: "user",
      id: `user_${frontendInvocationId}`,
      invocationId: frontendInvocationId,
    };
    setMessages(prev => [...prev, userMessage]);
    setQuestion("");
    setIsLoading(true);

    const userId = getUserId();
    const sessionId = await getSessionId(selectedApp!);

    if (sessionId.startsWith("error_")) {
      const errorDetails = sessionId.substring(6);
      toast.error(t('chat.error.sessionErrorToast', { appName: selectedApp, error: errorDetails }));
      setMessages(prev => [...prev, {id: uuidv4(), role: 'assistant', content: t('chat.error.sessionError', { error: errorDetails })}]);
      setIsLoading(false);
      if (streamAbortControllerRef.current === abortController) { streamAbortControllerRef.current = null; }
      return;
    }

    const requestPayload = {
      appName: selectedApp!,
      userId: userId,
      sessionId: sessionId,
      newMessage: { role: "user", parts: [{ text: messageText }] },
      streaming: true,
      invocationId: frontendInvocationId,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/run_sse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify(requestPayload),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        const errorText = response.body ? await response.text() : t('chat.error.noResponseBody');
        if (!abortController.signal.aborted) {
            toast.error(t('chat.error.backendErrorToast', { appName: selectedApp!, status: response.status, errorText: errorText }));
            setMessages(prev => [...prev, {id: uuidv4(), role: 'assistant', content: t('chat.error.backendError', { status: response.status, errorText: errorText })}]);
        } else {
            console.log("Fetch aborted by client action. Frontend Invocation:", frontendInvocationId);
        }
        return;
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          console.log("Stream finished. FrontendId:", frontendInvocationId, "BackendId:", backendStreamInvocationIdRef.current);
          if (!assistantMessageId && backendStreamInvocationIdRef.current) {
            console.log("Stream ended without any displayable assistant content for backend ID:", backendStreamInvocationIdRef.current);
          }
          break;
        }

        buffer += value;
        let eolIndex;

        while ((eolIndex = buffer.indexOf("\n\n")) >= 0) {
          const messageChunk = buffer.substring(0, eolIndex);
          buffer = buffer.substring(eolIndex + 2);

          if (messageChunk.startsWith("data: ")) {
            const jsonDataStr = messageChunk.substring(5).trim();
            try {
              const eventData = JSON.parse(jsonDataStr);

              if (!backendStreamInvocationIdRef.current && eventData.invocationId) {
                backendStreamInvocationIdRef.current = eventData.invocationId;
                console.log(`Received backend stream invocationId: ${backendStreamInvocationIdRef.current} (linked to frontendId: ${frontendInvocationId})`);
              }

              if (!backendStreamInvocationIdRef.current || eventData.invocationId !== backendStreamInvocationIdRef.current) {
                console.warn("Received event for different/unknown backend stream invocationId. Ignoring.",
                             { expected: backendStreamInvocationIdRef.current, received: eventData.invocationId, frontendInitiator: frontendInvocationId });
                continue;
              }

              let contentToAppend = "";
              let isNewMessageSegment = false;
              const functionCallNamesForThisEvent: string[] = [];
              const discoveredImageArtifactsToFetch: { filename: string, appName: string, userId: string, sessionId: string }[] = [];

              if (eventData.content && eventData.content.parts) {
                eventData.content.parts.forEach((part: any, index: number) => {
                  console.log(`[SSE LOG] Processing part ${index}:`, JSON.stringify(part, (key, value) =>
                    key === 'data' && typeof value === 'string' && value.length > 100 ? value.substring(0,30) + '...[truncated]' : value
                  ));

                  if (part.text) {
                    contentToAppend += part.text;
                  } else if (part.functionCall) {
                    const funcName = part.functionCall.name || "unknown_function";
                    if (contentToAppend.length > 0 && !contentToAppend.endsWith('\n')) {
                        contentToAppend += '\n';
                    }
                    contentToAppend += `[Function call: ${funcName}]\n`;
                    isNewMessageSegment = true;
                    if (!functionCallNamesForThisEvent.includes(funcName)) {
                        functionCallNamesForThisEvent.push(funcName);
                    }
                  } else if (part.functionResponse) {
                      const funcName = part.functionResponse.name || "unknown_function_response";
                      if (!functionCallNamesForThisEvent.includes(funcName)) {
                          functionCallNamesForThisEvent.push(funcName);
                      }
                  } else if (part.inlineData) {
                      console.log("[SSE LOG] Encountered part.inlineData (not used for image rendering in this path):", JSON.stringify(part.inlineData, (key, value) =>
                        key === 'data' && typeof value === 'string' && value.length > 100 ? value.substring(0,30) + '...[truncated]' : value
                      ));
                  } else {
                    console.log("[SSE LOG] Part was not text, functionCall, functionResponse, or inlineData:", JSON.stringify(part));
                  }
                });
              }

              console.log("[SSE LOG] Checking eventData.actions for artifacts (event ID " + eventData.id + "):", JSON.stringify(eventData.actions, null, 2));

              if (eventData.actions && eventData.actions.artifactDelta) {
                console.log("[SSE LOG] Entered artifactDelta check. `eventData.actions.artifactDelta`:", JSON.stringify(eventData.actions.artifactDelta));
                Object.keys(eventData.actions.artifactDelta).forEach(filename => {
                  console.log(`[SSE LOG] artifactDelta: Processing filename: '${filename}'`);
                  if (filename.match(/\.(png|jpg|jpeg|gif)$/i)) {
                    console.log(`[SSE LOG] artifactDelta: Filename '${filename}' matched image pattern.`);
                    if (!discoveredImageArtifactsToFetch.some(art => art.filename === filename)) {
                      console.log(`[SSE LOG] artifactDelta: Adding filename '${filename}' to discoveredImageArtifactsToFetch.`);
                      discoveredImageArtifactsToFetch.push({ filename, appName: selectedApp!, userId, sessionId });
                    } else {
                      console.log(`[SSE LOG] artifactDelta: Filename '${filename}' already in discoveredImageArtifactsToFetch.`);
                    }
                  } else {
                    console.log(`[SSE LOG] artifactDelta: Filename '${filename}' DID NOT match image pattern.`);
                  }
                });
              } else {
                console.log("[SSE LOG] Skipped artifactDelta check (main condition was false).",
                            { hasActions: !!eventData.actions, hasArtifactDelta: !!eventData.actions?.artifactDelta });
              }

              if (eventData.actions && eventData.actions.stateDelta && eventData.actions.stateDelta.image_plot_filename) {
                console.log("[SSE LOG] Entered stateDelta check. `eventData.actions.stateDelta.image_plot_filename`:", eventData.actions.stateDelta.image_plot_filename);
                const filename = eventData.actions.stateDelta.image_plot_filename;
                console.log(`[SSE LOG] stateDelta: Processing filename: '${filename}'`);
                if (filename.match(/\.(png|jpg|jpeg|gif)$/i)) {
                  console.log(`[SSE LOG] stateDelta: Filename '${filename}' matched image pattern.`);
                  if (!discoveredImageArtifactsToFetch.some(art => art.filename === filename)) {
                    console.log(`[SSE LOG] stateDelta: Adding filename '${filename}' to discoveredImageArtifactsToFetch.`);
                    discoveredImageArtifactsToFetch.push({ filename, appName: selectedApp!, userId, sessionId });
                  } else {
                    console.log(`[SSE LOG] stateDelta: Filename '${filename}' already in discoveredImageArtifactsToFetch.`);
                  }
                } else {
                  console.log(`[SSE LOG] stateDelta: Filename '${filename}' DID NOT match image pattern.`);
                }
              } else {
                console.log("[SSE LOG] Skipped stateDelta check (main condition was false).",
                            { hasActions: !!eventData.actions, hasStateDelta: !!eventData.actions?.stateDelta, hasImagePlotFilename: !!eventData.actions?.stateDelta?.image_plot_filename});
              }

              if (discoveredImageArtifactsToFetch.length > 0) {
                  console.log("[SSE LOG] discoveredImageArtifactsToFetch after checks:", JSON.stringify(discoveredImageArtifactsToFetch));
              } else {
                  console.log("[SSE LOG] discoveredImageArtifactsToFetch is EMPTY after checks (no image filenames detected in actions).");
              }

              // Logs before the main setMessages call for text/placeholders
              if (contentToAppend) {
                console.log(`[SSE LOG] For setMessages (Text/Placeholder Update) - Accumulated contentToAppend: '${contentToAppend.substring(0,100)}...'`);
              }
              if (functionCallNamesForThisEvent.length > 0) {
                  console.log("[SSE LOG] For setMessages (Text/Placeholder Update) - functionCallNamesForThisEvent:", functionCallNamesForThisEvent);
              }
              console.log("[SSE LOG] For setMessages (Text/Placeholder Update) - Pre-check state:", {
                currentAssistantMessageId: assistantMessageId,
                isNewMessageSegmentFlag: isNewMessageSegment,
                hasContentToAppend: !!contentToAppend,
                hasFunctionCalls: functionCallNamesForThisEvent.length > 0,
                eventDataPartialFlag: eventData.partial, // Log the partial flag
              });

              if (contentToAppend || functionCallNamesForThisEvent.length > 0 || discoveredImageArtifactsToFetch.length > 0 ) {
                setMessages(prevMessages => {
                  const currentBackendId = backendStreamInvocationIdRef.current;
                  let targetMessageId = assistantMessageId;
                  let messageExists = false;
                  if (targetMessageId) {
                    messageExists = prevMessages.some(m => m.id === targetMessageId);
                  }

                  if (!targetMessageId || !messageExists || isNewMessageSegment) {
                    // Creating new message - content is set directly, partial flag not directly used here for content setting
                    const newMsgId = `assistant_${currentBackendId}_${uuidv4()}`;
                    assistantMessageId = newMsgId;

                    const newMsg: Message = {
                        id: newMsgId,
                        role: 'assistant',
                        content: contentToAppend.trimStart(),
                        invocationId: currentBackendId,
                        imageUrls: [],
                        processedFunctionCalls: [...functionCallNamesForThisEvent]
                    };
                    console.log(`[SSE LOG - setMessages] Creating new message. ID: ${newMsg.id}, Content: '${newMsg.content.substring(0,50)}...', PartialFlag: ${eventData.partial}, NewSegmentFlag: ${isNewMessageSegment}`);
                    return [...prevMessages, newMsg];
                  } else {
                    // Updating existing message - THIS IS WHERE THE CHANGE IS
                    return prevMessages.map(msg => {
                      if (msg.id === targetMessageId) {
                        // Use eventData.partial to decide: replace content if false, else append
                        const newContent = (eventData.partial === false)
                                           ? contentToAppend.trimStart()
                                           : (msg.content + contentToAppend);

                        const existingFunctionCalls = msg.processedFunctionCalls || [];
                        const updatedFunctionCalls = [...existingFunctionCalls];
                        functionCallNamesForThisEvent.forEach(name => { if (!updatedFunctionCalls.includes(name)) updatedFunctionCalls.push(name); });

                        console.log(`[SSE LOG - setMessages] Updating existing message. ID: ${msg.id}. PartialFlag: ${eventData.partial}. OldContent: '${msg.content.substring(0,50)}...', IncomingContent: '${contentToAppend.substring(0,50)}...', ResultingNewContent: '${newContent.substring(0,50)}...'`);
                        return {
                          ...msg,
                          content: newContent, // Use the newContent decided by partial flag
                          imageUrls: msg.imageUrls || [],
                          processedFunctionCalls: updatedFunctionCalls
                        };
                      }
                      return msg;
                    });
                  }
                });
              } else {
                console.log("[SSE LOG] For setMessages (Text/Placeholder Update) - SKIPPED (no new text, function calls, or artifacts to fetch for this event data).");
              }

              // Asynchronously fetch discovered image artifacts and update messages with Base64 Data URIs
              if (discoveredImageArtifactsToFetch.length > 0 && assistantMessageId) {
                const currentAssistantMsgIdForImageFetch = assistantMessageId;
                console.log(`[SSE LOG] Fetching ${discoveredImageArtifactsToFetch.length} image artifacts for message ${currentAssistantMsgIdForImageFetch}`);

                discoveredImageArtifactsToFetch.forEach(async (artifact) => {
                  const artifactFilename = artifact.filename.replace(/^["'](.*)["']$/, '$1');
                  console.log(`[SSE LOG] Constructing fetch URL for: ${artifactFilename}`);
                  const artifactUrl = `${API_BASE_URL}/apps/${artifact.appName}/users/${artifact.userId}/sessions/${artifact.sessionId}/artifacts/${encodeURIComponent(artifactFilename)}`;
                  console.log(`[SSE LOG] Fetching image artifact: ${artifactUrl}`);

                  try {
                    const imageResponse = await fetch(artifactUrl, { signal: abortController.signal });
                    if (imageResponse.ok) {
                      const artifactJson = await imageResponse.json();
                      console.log(`[SSE LOG] Fetched artifact JSON for ${artifactFilename}:`, JSON.stringify(artifactJson, (key, value) =>
                        key === 'data' && typeof value === 'string' && value.length > 100 ? value.substring(0,50) + '...[truncated]' : value
                      ));

                      if (artifactJson.inlineData &&
                          typeof artifactJson.inlineData.data === 'string' &&
                          typeof artifactJson.inlineData.mimeType === 'string') {

                        const rawBase64ImageData = artifactJson.inlineData.data;
                        console.log(`[SSE LOG] Raw (URL-safe?) Base64 data for ${artifactFilename} (first 50 chars): ${rawBase64ImageData.substring(0,50)}...`);
                        const standardBase64Data = convertUrlSafeBase64ToStandard(rawBase64ImageData);
                        console.log(`[SSE LOG] Standard Base64 data for ${artifactFilename} (first 50 chars): ${standardBase64Data.substring(0,50)}...`);
                        const mimeType = artifactJson.inlineData.mimeType;
                        const dataUri = `data:${mimeType};base64,${standardBase64Data}`;

                        console.log(`[SSE LOG] Constructed data URI with standard Base64 for ${artifactFilename}: ${dataUri.substring(0,100)}...`);

                        setMessages(prevMsgs => prevMsgs.map(msg => {
                          if (msg.id === currentAssistantMsgIdForImageFetch) {
                            return {
                              ...msg,
                              imageUrls: [...(msg.imageUrls || []), dataUri]
                            };
                          }
                          return msg;
                        }));
                      } else {
                        console.error(`[SSE LOG] Artifact JSON for ${artifactFilename} is missing inlineData or required fields (data, mimeType).`, artifactJson);
                        setMessages(prevMsgs => prevMsgs.map(msg => {
                          if (msg.id === currentAssistantMsgIdForImageFetch) {
                            return { ...msg, content: msg.content + `\n[Error processing image data structure for: ${artifactFilename}]` };
                          }
                          return msg;
                        }));
                      }
                    } else {
                      console.error(`[SSE LOG] Failed to fetch image artifact ${artifactFilename}: ${imageResponse.status} ${imageResponse.statusText}`);
                      setMessages(prevMsgs => prevMsgs.map(msg => {
                        if (msg.id === currentAssistantMsgIdForImageFetch) {
                          return { ...msg, content: msg.content + `\n[Error loading image: ${artifactFilename} (${imageResponse.status})]` };
                        }
                        return msg;
                      }));
                    }
                  } catch (fetchError: any) {
                      if (fetchError.name !== 'AbortError') {
                        console.error(`[SSE LOG] Error fetching/parsing artifact JSON for ${artifactFilename}:`, fetchError);
                        setMessages(prevMsgs => prevMsgs.map(msg => {
                            if (msg.id === currentAssistantMsgIdForImageFetch) {
                            return { ...msg, content: msg.content + `\n[Network or parse error for image: ${artifactFilename}]` };
                            }
                            return msg;
                        }));
                      } else {
                          console.log(`[SSE LOG] Image artifact fetch aborted for ${artifactFilename}`);
                      }
                  }
                });
              }
            } catch (e) {
              console.error("Error parsing SSE JSON data:", e, jsonDataStr);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log("SSE Fetch aborted for frontendInvocationId:", frontendInvocationId);
      } else {
        console.error("Error during SSE fetch for frontendInvocationId:", frontendInvocationId, error);
        const errorMessage = error.message || t('common.unknownError');
        toast.error(t('chat.error.streamConnectionErrorToast', { message: errorMessage }));
        setMessages(prev => [...prev, {id: uuidv4(), role: 'assistant', content: t('chat.error.streamConnectionError', { message: errorMessage })}]);
      }
    } finally {
      setIsLoading(false);
      if (streamAbortControllerRef.current === abortController) {
        streamAbortControllerRef.current = null;
      }
    }
  }

  const chatDisabled = isLoadingApps || !!appListError || !selectedApp || isSessionLoading;
  let chatDisabledMessageKey = "";
  let chatDisabledMessageParams: Record<string, string | undefined> = {};

  if (isLoadingApps) { chatDisabledMessageKey = 'chat.status.loadingApplications'; }
  else if (isSessionLoading) { chatDisabledMessageKey = 'chat.status.initializingSession'; chatDisabledMessageParams = { appName: selectedApp || "" }; }
  else if (appListError) { chatDisabledMessageKey = 'chat.status.appListError'; chatDisabledMessageParams = { error: appListError }; }
  else if (!selectedApp) { chatDisabledMessageKey = 'chat.status.noAppSelectedChat';}

  const placeholderText = chatDisabled && chatDisabledMessageKey
    ? t('chat.input.placeholderDisabled', { message: t(chatDisabledMessageKey, chatDisabledMessageParams) })
    : t('chat.input.placeholder');

  const displayedChatDisabledMessage = chatDisabledMessageKey ? t(chatDisabledMessageKey, chatDisabledMessageParams) : "";

  return (
    <div className="flex flex-col min-w-0 h-dvh bg-background">
      <Header/>
      <div className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4" ref={messagesContainerRef}>
        {chatDisabled && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <p className="text-muted-foreground text-center">{displayedChatDisabledMessage}</p>
          </div>
        )}
        {!chatDisabled && messages.length === 0 && <Overview title={t('chat.overview.title')} description={t('chat.overview.description')} />}
        {messages.map((message) => ( <PreviewMessage key={message.id} message={message} /> ))}
        {isLoading && <ThinkingMessage thinkingText={t('chat.thinking')} />}
        <div ref={messagesEndRef} className="shrink-0 min-w-[24px] min-h-[24px]"/>
      </div>
      <div className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
        <ChatInput  
          question={question}
          setQuestion={setQuestion}
          onSubmit={handleSubmit}
          isLoading={isLoading || isSessionLoading}
          placeholder={placeholderText}
        />
      </div>
    </div>
  );
};