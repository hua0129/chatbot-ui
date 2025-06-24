export interface Attachment {
  name: string;
  type: string; // e.g., 'image/png', 'application/pdf'
  size: number; // size in bytes
  content: string; // base64 encoded content
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  invocationId?: string;
  imageUrls?: string[]; // For displaying fetched images (Data URIs)
  processedFunctionCalls?: string[];
  attachments?: Attachment[]; // For file uploads by user
  artifactFilenames?: string[]; // New: For historical messages that might have image artifacts by filename
}

export interface KBFile {
    doc_uuid: string;
    name: string;
    type: string;
    size: number; // in bytes
    lastModified?: string; // Optional: ISO string date
    workflow_id?: string;
    status?: string; // e.g., "UPLOADING", "PROCESSING", "DELETING", "RE_EMBEDDING", "SUCCESS", "ERROR"
    errorMessage?: string;
}

export interface SessionInfo {
  id: string;          // e.g., "s_123"
  appName: string;     // e.g., "data_science"
  userId: string;      // e.g., "u_123"
  // We need a user-friendly way to display these sessions.
  // The raw API response doesn't seem to have a 'name' or 'title' for the session.
  // We could derive one, e.g., from the first user message, or use a timestamp.
  // For now, let's include `lastUpdateTime` if available, which can be formatted.
  // Or, we can generate a name like "Session <short_id>" or "Chat from <date>".
  // Let's add `lastUpdateTime` and potentially a client-generated `displayName`.
  lastUpdateTime?: number; // Timestamp, e.g., 1749706898.074064
  displayName?: string;   // To be generated on the client if not provided by API
  // The 'state' and 'events' fields from the API response are too large and not needed for the list view.
}