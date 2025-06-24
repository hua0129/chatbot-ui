import { memo, useState, useEffect } from "react"; // Added useState, useEffect
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// --- Artifact Rendering Constants and Mock Data ---
const ARTIFACT_PREFIX = "render-as-artifact:";
const MOCK_URL = "https://example.com/my-article";
const MOCK_HTML_CONTENT = `
  <body style="font-family: sans-serif; padding: 16px; background-color: #f0f0f0;">
    <h1>Mock Article Title</h1>
    <p>This is the mock content of the article fetched from <code>${MOCK_URL}</code>.</p>
    <p>It demonstrates how a fetched HTML page might be rendered in an iframe.</p>
    <button onclick="alert('Scripts are running!')">Test Interaction (if sandbox allows)</button>
  </body>
`;

// --- ArtifactRenderer Component ---
const ArtifactRenderer = ({ url }: { url: string }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedContent, setFetchedContent] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setFetchedContent(null);

    // Simulate fetching delay
    const timer = setTimeout(() => {
      if (url === MOCK_URL) {
        setFetchedContent(MOCK_HTML_CONTENT);
      } else {
        setError(`Cannot render artifact for this URL. Only '${MOCK_URL}' is supported for mock fetching.`);
      }
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [url]);

  if (loading) {
    return (
      <div className="p-4 border rounded-lg bg-muted/50 dark:bg-muted/30 text-sm text-muted-foreground animate-pulse">
        Loading artifact: {url}...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-red-500/50 rounded-lg bg-red-500/10 text-sm text-red-700 dark:text-red-400">
        Error: {error}
      </div>
    );
  }

  if (fetchedContent) {
    return (
      <div className="my-2 p-2 border rounded-lg bg-muted/20 dark:bg-muted/10">
        <p className="text-xs text-muted-foreground mb-1">Rendering artifact: {url}</p>
        <iframe
          srcDoc={fetchedContent}
          sandbox="allow-scripts allow-same-origin" // Be cautious with sandbox permissions
          className="w-full h-64 border rounded-md bg-white"
          title={`Artifact: ${url}`}
        />
      </div>
    );
  }

  return null; // Should not happen if logic is correct
};

import React from "react"; // Import React for Fragment

// ... (ArtifactRenderer and constants remain the same) ...

const NonMemoizedMarkdown = ({ children }: { children: string }) => {
  const components = {
    p: ({ node, children, ...props }: any) => {
      const processedChildren: React.ReactNode[] = [];

      const childrenArray = React.Children.toArray(children);

      childrenArray.forEach((child, childIndex) => {
        if (typeof child === 'string') {
          const textContent = child;
          let lastIndex = 0;
          let match;
          // Ensure ARTIFACT_PREFIX is properly escaped for regex if it contains special characters
          const escapedPrefix = ARTIFACT_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escapedPrefix + "([^\\s]+)", 'g');

          while ((match = regex.exec(textContent)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
              processedChildren.push(textContent.substring(lastIndex, match.index));
            }
            // Add the ArtifactRenderer
            const url = match[1];
            // Use a more robust key, including childIndex to ensure uniqueness across different original children
            processedChildren.push(<ArtifactRenderer key={`artifact-${childIndex}-${match.index}-${url}`} url={url} />);
            lastIndex = regex.lastIndex;
          }
          // Add any remaining text after the last match
          if (lastIndex < textContent.length) {
            processedChildren.push(textContent.substring(lastIndex));
          }
        } else {
          // If it's already a React element (e.g., <strong>, <a>), push it as is.
          processedChildren.push(child);
        }
      });

      // If processedChildren is empty, it means the original paragraph was empty or contained only unsupported elements.
      // In this case, falling back to original children is safer.
      // However, our loop processes all children, so processedChildren should represent the full content.
      if (processedChildren.length > 0) {
         // Using React.Fragment for keys when mapping an array of mixed elements/strings
        return <p {...props}>{processedChildren.map((pChild, i) => <React.Fragment key={i}>{pChild}</React.Fragment>)}</p>;
      }
      
      // Fallback for empty or fully non-string children paragraphs (though the loop should handle it)
      return <p {...props}>{children}</p>;
    },
    // Keep other custom components or add new ones
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || "");
      return !inline && match ? (
        <pre
          {...props}
          className={`${className} text-sm w-[80dvw] md:max-w-[500px] overflow-x-scroll bg-zinc-100 p-3 rounded-lg mt-2 dark:bg-zinc-800`}
        >
          <code className={match[1]}>{children}</code>
        </pre>
      ) : (
        <code
          className={`${className} text-sm bg-zinc-100 dark:bg-zinc-800 py-0.5 px-1 rounded-md`}
          {...props}
        >
          {children}
        </code>
      );
    },
    ol: ({ node, children, ...props }: any) => {
      return (
        <ol className="list-decimal list-outside ml-4" {...props}>
          {children}
        </ol>
      );
    },
    li: ({ node, children, ...props }: any) => {
      return (
        <li className="py-1" {...props}>
          {children}
        </li>
      );
    },
    ul: ({ node, children, ...props }: any) => {
      return (
        <ul className="list-decimal list-outside ml-4" {...props}>
          {children}
        </ul>
      );
    },
    strong: ({ node, children, ...props }: any) => {
      return (
        <span className="font-semibold" {...props}>
          {children}
        </span>
      );
    },
    a: ({ node, children, ...props }: any) => {
      return (
        <a
          className="text-blue-500 hover:underline"
          target="_blank"
          rel="noreferrer"
          {...props}
        >
          {children}
        </a>
      );
    },
    h1: ({ node, children, ...props }: any) => {
      return (
        <h1 className="text-3xl font-semibold mt-6 mb-2" {...props}>
          {children}
        </h1>
      );
    },
    h2: ({ node, children, ...props }: any) => {
      return (
        <h2 className="text-2xl font-semibold mt-6 mb-2" {...props}>
          {children}
        </h2>
      );
    },
    h3: ({ node, children, ...props }: any) => {
      return (
        <h3 className="text-xl font-semibold mt-6 mb-2" {...props}>
          {children}
        </h3>
      );
    },
    h4: ({ node, children, ...props }: any) => {
      return (
        <h4 className="text-lg font-semibold mt-6 mb-2" {...props}>
          {children}
        </h4>
      );
    },
    h5: ({ node, children, ...props }: any) => {
      return (
        <h5 className="text-base font-semibold mt-6 mb-2" {...props}>
          {children}
        </h5>
      );
    },
    h6: ({ node, children, ...props }: any) => {
      return (
        <h6 className="text-sm font-semibold mt-6 mb-2" {...props}>
          {children}
        </h6>
      );
    },
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
