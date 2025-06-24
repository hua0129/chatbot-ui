import React from 'react'; // Removed useState
import { Link, useLocation, useNavigate } from 'react-router-dom';
// Icons like MessageSquare, BookOpen, PlusCircle, Hash are removed as they were for the static aside.
// Sidebar.tsx will manage its own icons.
import { cn } from '@/lib/utils';
// Button might still be used if MainLayout has other buttons, or can be removed if not.

// Import the actual Sidebar component
import { Sidebar } from '../custom/sidebar';
import { useAppContext } from '../../context/AppContext'; // Import useAppContext

// MainLayoutProps remains the same
interface MainLayoutProps {
  children: React.ReactNode;
}

// navItems for Knowledge Base might need to be handled separately or passed to Sidebar
// For now, let's assume Sidebar is focused on chats.
// The BookOpen icon would need to be re-imported if used.
const knowledgeBaseNav = { name: 'Knowledge Base', href: '/knowledge-base' /* icon: BookOpen */ };


const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSidebarOpen, closeSidebar } = useAppContext(); // Get from context

  // The old handleNewChat in MainLayout is deprecated as Sidebar's "New Chat" is now used.
  // const handleNewChat = () => {
  //   navigate('/');
  // };

  return (
    <div className="flex h-screen bg-background">
      {/* Render the actual Sidebar component */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={closeSidebar} // Use context's closeSidebar
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-0 bg-background">
        {/* 
          A Header component will be added/modified in the next step.
          It will live here, likely above {children}, and will receive `toggleSidebar`.
          Example:
          <Header onToggleSidebar={toggleSidebar} />
        */}
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
