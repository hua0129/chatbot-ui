import './App.css'
import { Chat } from './pages/chat/chat'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider } from './context/AppContext'; // Import AppProvider
import KnowledgeBasePage from './pages/knowledgebase/knowledgebase';
import MainLayout from './components/custom/mainlayout';
// Import sessionManager to ensure it's initialized (though its role will change)
// We might move session initialization logic to be dependent on selectedApp later
import './lib/sessionManager';


function App() {
  return (
    <ThemeProvider>
      <AppProvider> {/* Wrap with AppProvider */}
        <Router>
          <MainLayout>
            <Routes>
              <Route path="/" element={<Chat />} />
              <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
            </Routes>
          </MainLayout>
        </Router>
      </AppProvider>
    </ThemeProvider>
  )
}

export default App;