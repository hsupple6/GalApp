// AppRouter.tsx
import React from 'react';
import { Route, Routes } from 'react-router-dom';

import BookkeeperApp from './apps/BookkeeperApp/BookkeeperApp';
import ChatApp from './apps/ChatApp/ChatApp';
import DocsApp from './apps/DocsApp/components/DocsApp';
import NotesApp from './apps/NotesApp/components/NotesApp';
import Home from './components/Home/Home';
import ProtectedRoute from './components/ProtectedRoute';
import LoginApp from './LoginApp'; // Standalone Chat Login
import NotFound from './NotFound';
import System2 from './System2';
import GalideApp from './apps/GalideApp/components/GalideApp';
import NeurvanaApp from './apps/Neurvana2App/components/NeurvanaApp';

const AppRouter = () => {
  return (
    <Routes>
      {/* Standalone app routes - legacy routing structure */}
      <Route
        path="/app/chat"
        element={
          <ProtectedRoute>
            <ChatApp onClose={() => {}} title="Chat" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/galide"
        element={
          <ProtectedRoute>
            <GalideApp 
              windowId="standalone-galide" 
              spaceId="default" 
              onClose={() => {}} 
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/neurvana"
        element={
          <ProtectedRoute>
            <NeurvanaApp 
              windowId="standalone-neurvana" 
              spaceId="default" 
              onClose={() => {}} 
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/docs"
        element={
          <ProtectedRoute>
            <DocsApp 
              windowId="standalone-docs" 
              spaceId="default" 
              onClose={() => {}} 
              title="Documents"
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/bookkeeper"
        element={
          <ProtectedRoute>
            <BookkeeperApp onClose={() => {}} title="Bookkeeper" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/notes"
        element={
          <ProtectedRoute>
            <NotesApp windowId="standalone-notes" spaceId="default" onClose={() => {}} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/system2"
        element={
          <ProtectedRoute>
            <System2 />
          </ProtectedRoute>
        }
      />
      <Route path="/app/login" element={<LoginApp />} />
      
      {/* Catch-all for standalone apps */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRouter;
