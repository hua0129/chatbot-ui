import { motion } from 'framer-motion';
import ReactMarkdown from "react-markdown"; // Use ReactMarkdown directly for component customization
import { Message } from "../../interfaces/interfaces";
import { cn } from "@/lib/utils";
import { SparklesIcon, FileTextIcon } from './icons'; // Assuming these are for ThinkingMessage or other parts
import { User, Bot } from 'lucide-react';
import { MessageActions } from '@/components/custom/actions';
// Removed Avatar imports as per previous steps

export interface PreviewMessageProps {
  message: Message;
}

export function PreviewMessage({ message }: PreviewMessageProps) {
  // Add detailed console log for the received message prop
  console.log(
    `[PreviewMessage PROPS] Rendering message ID: ${message.id}, Role: ${message.role}`,
    JSON.stringify(
      {
        contentLength: message.content?.length,
        invocationId: message.invocationId,
        processedFunctionCalls: message.processedFunctionCalls,
        imageUrls: message.imageUrls?.map(url => typeof url === 'string' ? (url.substring(0, 70) + (url.length > 70 ? "..." : "")) : "Non-string URL"),
        imageUrlsCount: message.imageUrls?.length || 0,
        // attachmentsCount: message.attachments?.length || 0 // If attachments are relevant to debug later
      },
      null,
      2 // Indent for readability
    )
  );

  const isAssistant = message.role === "assistant";

  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      data-role={message.role}
    >
      <div
        className={cn(
          'flex items-start gap-3 px-4 py-3 rounded-lg',
          isAssistant ? "bg-muted/50 dark:bg-muted/30 text-foreground" : "bg-primary/10 dark:bg-primary/5 text-primary-foreground dark:text-primary-foreground"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background text-foreground">
          {isAssistant ? <Bot size={18} /> : <User size={18} />}
        </div>

        <div className="flex flex-col gap-1.5 min-w-0 w-full">
          <div className="font-semibold text-sm">
            {message.role.charAt(0).toUpperCase() + message.role.slice(1)}
          </div>

          {/* Diagnostic Box for Processed Function Calls and Image Info */}
          {isAssistant && message.processedFunctionCalls && message.processedFunctionCalls.length > 0 && (
            <div className="mt-1 mb-2 p-2 border border-blue-300 dark:border-blue-700 rounded-md bg-blue-50 dark:bg-blue-900/30 text-xs text-blue-700 dark:text-blue-300">
              <div className="font-medium mb-1">Processed Function Call(s):</div>
              <ul className="list-disc list-inside pl-1">
                {message.processedFunctionCalls.map((funcName, idx) => (
                  <li key={`${message.id}-func-${idx}`}>{funcName}</li>
                ))}
              </ul>
              <div className="mt-1 pt-1 border-t border-blue-200 dark:border-blue-800">
                <span className="font-medium">Image URLs found: </span>
                {message.imageUrls && message.imageUrls.length > 0 ? (
                  <span className="text-green-600 dark:text-green-400">Yes ({message.imageUrls.length})</span>
                ) : (
                  <span className="text-red-600 dark:text-red-400">No</span>
                )}
                {message.imageUrls && message.imageUrls.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {message.imageUrls.map((url, idx) => (
                      <div key={`${message.id}-diag-imgurl-${idx}`} className="truncate text-gray-500 dark:text-gray-400 text-[10px]">
                        {idx + 1}: {url.substring(0, 60) + (url.length > 60 ? "..." : "")}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Render text content */}
          {message.content && (
            <div className="prose dark:prose-invert prose-sm max-w-none break-words">
              <ReactMarkdown
                components={{
                  a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline"/>
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Display Attachments - Kept original logic if any, assuming it's compatible */}
          {message.attachments && message.attachments.length > 0 && (
             <div className={cn(
               "mt-2 pt-2 border-t",
               message.role === 'user' ? "border-zinc-600 dark:border-muted-foreground/30" : "border-border"
             )}>
               <h4 className={cn( "text-xs font-medium mb-1", message.role === 'user' ? "text-zinc-400 dark:text-muted-foreground" : "text-muted-foreground" )}>
                 Attachments:
               </h4>
               <ul className="space-y-1">
                 {message.attachments.map((attachment, index) => (
                   <li key={`${message.id}-attachment-${index}`} className={cn( "flex items-center gap-2 text-xs p-1.5 rounded", message.role === 'user' ? "bg-zinc-600 dark:bg-muted/60" : "bg-muted/50 dark:bg-muted/30" )}>
                     <FileTextIcon size={14} className={cn( message.role === 'user' ? "text-zinc-300 dark:text-muted-foreground" : "text-muted-foreground" )} />
                     <span className="truncate" title={attachment.name}> {attachment.name} </span>
                     <span className={cn( "ml-auto text-xs", message.role === 'user' ? "text-zinc-400 dark:text-muted-foreground/80" : "text-muted-foreground/80" )}>
                       ({(attachment.size / 1024).toFixed(1)} KB)
                     </span>
                   </li>
                 ))}
               </ul>
             </div>
          )}

          {/* Render images if imageUrls exist */}
          {message.imageUrls && message.imageUrls.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {message.imageUrls.map((url, index) => (
                <img
                  key={`${message.id}-img-${index}`}
                  src={url}
                  alt={`artifact image ${index + 1}`}
                  className="max-w-xs max-h-64 rounded-md border object-contain"
                />
              ))}
            </div>
          )}

          {isAssistant && (
            <MessageActions message={message} />
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const ThinkingMessage = ({ thinkingText }: { thinkingText?: string }) => {
  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 0.2 } }}
    >
      <div
        className={cn(
          'flex gap-4 px-3 w-fit max-w-2xl py-2 rounded-xl bg-muted/50 dark:bg-muted/30 text-foreground'
        )}
      >
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
          <SparklesIcon size={14} />
        </div>
        <div className="flex items-center">
            <span className="text-sm text-muted-foreground">{thinkingText || "Thinking..."}</span>
        </div>
      </div>
    </motion.div>
  );
};
