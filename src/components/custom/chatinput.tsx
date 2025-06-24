import { Textarea } from "../ui/textarea";
import { cx } from 'classix';
import { Button } from "../ui/button";
import { ArrowUpIcon, PaperclipIcon, CrossIcon } from "./icons"; // Changed XIcon to CrossIcon
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useState, useRef, ChangeEvent } from 'react'; // Added useRef and ChangeEvent

interface ChatInputProps {
    question: string;
    setQuestion: (question: string) => void;
    onSubmit: (text?: string, files?: File[]) => void; // Added files to onSubmit
    isLoading: boolean;
}

const suggestedActions = [
    {
        title: 'How is the weather',
        label: 'in Vienna?',
        action: 'How is the weather in Vienna today?',
    },
    {
        title: 'Tell me a fun fact',
        label: 'about pandas',
        action: 'Tell me an interesting fact about pandas',
    },
];

export const ChatInput = ({ question, setQuestion, onSubmit, isLoading }: ChatInputProps) => {
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setSelectedFiles(Array.from(event.target.files));
        }
    };

    const handleAttachClick = () => {
        fileInputRef.current?.click();
    };

    const handleRemoveFile = (fileName: string) => {
        setSelectedFiles(selectedFiles.filter(file => file.name !== fileName));
    };

    const handleClearFiles = () => {
        setSelectedFiles([]);
    };

    const handleSubmit = () => {
        if (isLoading) {
            toast.error('Please wait for the model to finish its response!');
        } else {
            setShowSuggestions(false);
            onSubmit(question, selectedFiles);
            // Optionally clear files after submit:
            // setSelectedFiles([]); 
            // setQuestion(''); // Assuming you want to clear the question too
        }
    };

    return (
        <div className="relative w-full flex flex-col gap-2"> {/* Reduced gap from 4 to 2 */}
            {showSuggestions && !selectedFiles.length && ( // Hide suggestions if files are selected
                <div className="hidden md:grid sm:grid-cols-2 gap-2 w-full">
                    {suggestedActions.map((suggestedAction, index) => (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            transition={{ delay: 0.05 * index }}
                            key={index}
                            className={index > 1 ? 'hidden sm:block' : 'block'}
                        >
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    const text = suggestedAction.action;
                                    onSubmit(text, []); // Pass empty array for files
                                    setShowSuggestions(false);
                                }}
                                className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start"
                            >
                                <span className="font-medium">{suggestedAction.title}</span>
                                <span className="text-muted-foreground">
                                    {suggestedAction.label}
                                </span>
                            </Button>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                onChange={handleFileChange}
                tabIndex={-1}
            />

            {/* Selected Files Display */}
            {selectedFiles.length > 0 && (
                <div className="p-2 border rounded-lg bg-muted/50 dark:bg-muted/30 text-sm">
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-muted-foreground">Selected files:</span>
                        <Button variant="ghost" size="sm" onClick={handleClearFiles} className="h-auto p-1 text-xs">
                            Clear all
                        </Button>
                    </div>
                    <ul className="space-y-1 max-h-24 overflow-y-auto">
                        {selectedFiles.map(file => (
                            <li key={file.name} className="flex justify-between items-center text-xs p-1.5 bg-background dark:bg-muted/50 rounded">
                                <span className="truncate max-w-[calc(100%-2rem)]" title={file.name}>{file.name}</span>
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveFile(file.name)} className="h-5 w-5 shrink-0">
                                    <CrossIcon size={12} />
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            
            <div className="relative flex items-end"> {/* Wrapper for Textarea and buttons */}
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleAttachClick} 
                    className="absolute bottom-2 left-2 m-0.5 h-8 w-8 dark:border-zinc-600"
                    title="Attach files"
                >
                    <PaperclipIcon size={16} />
                </Button>

                <Textarea
                    placeholder="Send a message..."
                    className={cx(
                        'min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-xl text-base bg-muted pl-12 pr-12', // Added pl-12 and pr-12 for padding
                    )}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            handleSubmit();
                        }
                    }}
                    rows={3} // Consider making rows dynamic or smaller initial value
                    autoFocus
                />

                <Button
                    className="rounded-full p-1.5 h-fit absolute bottom-2 right-2 m-0.5 border dark:border-zinc-600"
                    onClick={handleSubmit}
                    disabled={isLoading || (question.length === 0 && selectedFiles.length === 0)} // Disable if no text and no files
                >
                    <ArrowUpIcon size={14} />
                </Button>
            </div>
        </div>
    );
}