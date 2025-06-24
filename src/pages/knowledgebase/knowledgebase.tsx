import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Will use a styled input trigger
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { KBFile } from '@/interfaces/interfaces'; // Using the interface
import { uploadDocument, getWorkflowStatus, deleteDocument, reEmbedDocument } from '@/lib/api'; // Import API functions
import { UploadCloud, FileText, Trash2, Edit3, XCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const KnowledgeBasePage: React.FC = () => {
  const [kbFiles, setKbFiles] = useState<KBFile[]>([]); // Initialize with empty array
  const [selectedFilesForUpload, setSelectedFilesForUpload] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalsRef = useRef<Record<string, NodeJS.Timeout>>({});

  const handleFileSelectTrigger = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFilesForUpload(Array.from(event.target.files));
    }
  };

  const handleClearSelectedFile = (fileName: string) => {
    setSelectedFilesForUpload(prev => prev.filter(file => file.name !== fileName));
  };
  
  const handleClearAllSelectedFiles = () => {
    setSelectedFilesForUpload([]);
  }

  const handleUploadFiles = async () => {
    if (selectedFilesForUpload.length === 0) {
      toast.error('No files selected for upload.');
      return;
    }

    for (const file of selectedFilesForUpload) {
      const tempId = uuidv4();
      const newFileEntry: KBFile = {
        doc_uuid: tempId, // Temporary ID
        name: file.name,
        type: file.type,
        size: file.size,
        status: 'UPLOADING', // Initial status
        lastModified: new Date().toISOString(),
      };
      setKbFiles(prev => [...prev, newFileEntry]);

      try {
        const response = await uploadDocument(file);
        const { doc_uuid, workflow_id } = response;

        setKbFiles(prev => prev.map(kbFile => 
          kbFile.doc_uuid === tempId 
            ? { ...kbFile, doc_uuid, workflow_id, status: 'PROCESSING' } 
            : kbFile
        ));
        toast.success(`Upload started for ${file.name}. Workflow: ${workflow_id}`);
        // TODO: Start polling for workflow_id
      } catch (error: any) {
        toast.error(`Upload failed for ${file.name}: ${error.message || 'Unknown error'}`);
        setKbFiles(prev => prev.map(kbFile => 
          kbFile.doc_uuid === tempId 
            ? { ...kbFile, status: 'UPLOAD_ERROR', errorMessage: error.message || 'Unknown error' } 
            : kbFile
        ));
      }
    }
    setSelectedFilesForUpload([]); // Clear selection
  };

  const handleDeleteFile = async (doc_uuid: string) => {
    const fileToDelete = kbFiles.find(f => f.doc_uuid === doc_uuid);
    if (!fileToDelete) {
      toast.error("File not found for deletion.");
      return;
    }

    try {
      const response = await deleteDocument(doc_uuid);
      const { workflow_id } = response;
      setKbFiles(prev => prev.map(f => 
        f.doc_uuid === doc_uuid ? { ...f, status: 'DELETING', workflow_id, errorMessage: undefined } : f
      ));
      toast.success(`Deletion started for ${fileToDelete.name}. Workflow: ${workflow_id}`);
    } catch (error: any) {
      const errorMessage = error?.body?.detail || error.message || 'Unknown error';
      setKbFiles(prev => prev.map(f => 
        f.doc_uuid === doc_uuid ? { ...f, status: 'DELETE_ERROR', errorMessage } : f
      ));
      toast.error(`Failed to start deletion for ${fileToDelete.name}: ${errorMessage}`);
    }
  };

  const handleReEmbedFile = async (doc_uuid: string) => {
    const fileToReEmbed = kbFiles.find(f => f.doc_uuid === doc_uuid);
    if (!fileToReEmbed) {
      toast.error("File not found for re-embedding.");
      return;
    }

    try {
      const response = await reEmbedDocument(doc_uuid);
      const { workflow_id } = response;
      setKbFiles(prev => prev.map(f =>
        f.doc_uuid === doc_uuid ? { ...f, status: 'RE_EMBEDDING', workflow_id, errorMessage: undefined } : f
      ));
      toast.success(`Re-embedding started for ${fileToReEmbed.name}. Workflow: ${workflow_id}`);
    } catch (error: any) {
      const errorMessage = error?.body?.detail || error.message || 'Unknown error';
      setKbFiles(prev => prev.map(f =>
        f.doc_uuid === doc_uuid ? { ...f, status: 'RE_EMBED_ERROR', errorMessage } : f
      ));
      toast.error(`Failed to start re-embedding for ${fileToReEmbed.name}: ${errorMessage}`);
    }
  };

  useEffect(() => {
    const activePollingStates = ["PROCESSING", "DELETING", "RE_EMBEDDING"];

    kbFiles.forEach(file => {
      if (file.workflow_id && file.status && activePollingStates.includes(file.status)) {
        if (!pollingIntervalsRef.current[file.workflow_id]) {
          console.log(`Starting polling for workflow: ${file.workflow_id} (File: ${file.name})`);
          pollingIntervalsRef.current[file.workflow_id] = setInterval(async () => {
            try {
              const statusResponse = await getWorkflowStatus(file.workflow_id!);
              const currentFileState = kbFiles.find(f => f.workflow_id === file.workflow_id);

              if (!currentFileState) { // File might have been removed, stop polling
                clearInterval(pollingIntervalsRef.current[file.workflow_id!]);
                delete pollingIntervalsRef.current[file.workflow_id!];
                return;
              }
              
              const newStatus = statusResponse.status;
              const newError = statusResponse.error;

              if (newStatus === "SUCCESS") {
                toast.success(`Workflow ${file.workflow_id} for ${file.name} completed: ${newStatus}`);
                clearInterval(pollingIntervalsRef.current[file.workflow_id!]);
                delete pollingIntervalsRef.current[file.workflow_id!];

                if (currentFileState.status === "DELETING") {
                  setKbFiles(prev => prev.filter(f => f.doc_uuid !== file.doc_uuid));
                } else {
                  setKbFiles(prev => prev.map(f =>
                    f.workflow_id === file.workflow_id ? { ...f, status: newStatus, errorMessage: undefined } : f
                  ));
                }
              } else if (newStatus === "ERROR") {
                toast.error(`Workflow ${file.workflow_id} for ${file.name} failed: ${newError}`);
                clearInterval(pollingIntervalsRef.current[file.workflow_id!]);
                delete pollingIntervalsRef.current[file.workflow_id!];
                setKbFiles(prev => prev.map(f =>
                  f.workflow_id === file.workflow_id ? { ...f, status: newStatus, errorMessage: newError } : f
                ));
              } else if (["PENDING", "RUNNING"].includes(newStatus)) {
                // Update status if it changed (e.g. from PROCESSING to RUNNING)
                 if (currentFileState.status !== newStatus) {
                    setKbFiles(prev => prev.map(f =>
                        f.workflow_id === file.workflow_id ? { ...f, status: newStatus, errorMessage: undefined } : f
                    ));
                 }
                // Continue polling
              } else {
                 // Unknown status or non-terminal status we weren't expecting
                console.warn(`Workflow ${file.workflow_id} for ${file.name} has unexpected status: ${newStatus}. Stopping poll.`);
                clearInterval(pollingIntervalsRef.current[file.workflow_id!]);
                delete pollingIntervalsRef.current[file.workflow_id!];
                setKbFiles(prev => prev.map(f =>
                  f.workflow_id === file.workflow_id ? { ...f, status: newStatus, errorMessage: "Unexpected status from polling" } : f
                ));
              }
            } catch (error: any) {
              const errorMessage = error?.body?.detail || error.message || 'Unknown error';
              toast.error(`Error checking status for workflow ${file.workflow_id} (${file.name}): ${errorMessage}`);
              // Decide if to stop polling on error. For now, we stop.
              clearInterval(pollingIntervalsRef.current[file.workflow_id!]);
              delete pollingIntervalsRef.current[file.workflow_id!];
               setKbFiles(prev => prev.map(f =>
                  f.workflow_id === file.workflow_id ? { ...f, status: 'ERROR', errorMessage: `Polling failed: ${errorMessage}` } : f
                ));
            }
          }, 5000); // Poll every 5 seconds
        }
      } else if (file.workflow_id && pollingIntervalsRef.current[file.workflow_id]) {
        // Workflow is no longer active (e.g. SUCCESS, ERROR), but an interval exists. Clear it.
        console.log(`Stopping polling for inactive workflow: ${file.workflow_id} (File: ${file.name}, Status: ${file.status})`);
        clearInterval(pollingIntervalsRef.current[file.workflow_id]);
        delete pollingIntervalsRef.current[file.workflow_id];
      }
    });

    // Cleanup function
    return () => {
      console.log("Cleaning up polling intervals.");
      Object.values(pollingIntervalsRef.current).forEach(clearInterval);
      pollingIntervalsRef.current = {}; // Reset for next effect run if needed
    };
  }, [kbFiles]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Knowledge Base Management</h1>
        <p className="text-muted-foreground mt-1">Manage your knowledge base files and documents.</p>
      </header>

      {/* File Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadCloud className="h-6 w-6" />
            Upload New Files
          </CardTitle>
          <CardDescription>Select files from your device to add to the knowledge base.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <Button variant="outline" onClick={handleFileSelectTrigger}>
            Select Files
          </Button>

          {selectedFilesForUpload.length > 0 && (
            <div className="space-y-2 p-3 bg-muted/50 dark:bg-muted/30 rounded-md">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium text-muted-foreground">Selected files:</h4>
                <Button variant="ghost" size="sm" onClick={handleClearAllSelectedFiles} className="text-xs h-auto p-1">Clear all</Button>
              </div>
              <ul className="space-y-1 text-sm max-h-32 overflow-y-auto">
                {selectedFilesForUpload.map(file => (
                  <li key={file.name} className="flex justify-between items-center p-1.5 bg-background dark:bg-muted/50 rounded text-xs">
                    <span className="truncate max-w-[calc(100%-2rem)]" title={file.name}>{file.name} ({formatFileSize(file.size)})</span>
                    <Button variant="ghost" size="icon" onClick={() => handleClearSelectedFile(file.name)} className="h-5 w-5 shrink-0">
                        <XCircle size={12} />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleUploadFiles} disabled={selectedFilesForUpload.length === 0}>
            Upload Selected Files
          </Button>
        </CardFooter>
      </Card>

      {/* Current Files Section */}
      <Card>
        <CardHeader>
          <CardTitle>Current Knowledge Base Files</CardTitle>
          <CardDescription>Browse and manage existing files in your knowledge base.</CardDescription>
        </CardHeader>
        <CardContent>
          {kbFiles.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No files in the knowledge base yet.</p>
          ) : (
            <div className="space-y-3">
              {kbFiles.map(file => (
                <Card key={file.doc_uuid} className="bg-background dark:bg-muted/40">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-grow min-w-0">
                      <FileText className="h-8 w-8 text-blue-500 shrink-0" />
                      <div className="flex-grow min-w-0">
                        <p className="text-sm font-medium truncate" title={file.name}>
                          {file.name}
                          {file.status && <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                            file.status === 'UPLOADING' ? 'bg-yellow-200 text-yellow-800' : // Optimistic UI
                            file.status === 'PROCESSING' ? 'bg-blue-200 text-blue-800' :    // API Call for upload done, workflow pending
                            file.status === 'DELETING' ? 'bg-orange-200 text-orange-800' :  // API Call for delete done, workflow pending
                            file.status === 'RE_EMBEDDING' ? 'bg-indigo-200 text-indigo-800' : // API Call for re-embed done, workflow pending
                            file.status === 'SUCCESS' ? 'bg-green-200 text-green-800' :      // Workflow finished successfully
                            file.status === 'ERROR' || file.status === 'UPLOAD_ERROR' || file.status === 'DELETE_ERROR' || file.status === 'RE_EMBED_ERROR' ? 'bg-red-200 text-red-800' : // Workflow or API call failed
                            'bg-gray-200 text-gray-800' // Default / Unknown
                          }`}>{file.status}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {file.type} - {formatFileSize(file.size)}
                          {file.lastModified && ` - Modified: ${new Date(file.lastModified).toLocaleDateString()}`}
                          {file.workflow_id && <span className="block text-xs">Workflow ID: {file.workflow_id}</span>}
                          {file.errorMessage && <span className="text-red-500 block">Error: {file.errorMessage}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReEmbedFile(file.doc_uuid)}
                        disabled={['UPLOADING', 'PROCESSING', 'DELETING', 'RE_EMBEDDING'].includes(file.status || '')}
                      >
                        <Edit3 className="h-3.5 w-3.5 mr-1.5" /> Re-embed
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteFile(file.doc_uuid)}
                        disabled={['UPLOADING', 'PROCESSING', 'DELETING', 'RE_EMBEDDING'].includes(file.status || '')}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KnowledgeBasePage;
