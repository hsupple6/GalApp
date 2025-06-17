import './App.scss';

import Home from 'components/Home/Home';
import { Navigate, Route, Routes } from 'react-router-dom';
import { debug } from './utils/debug';
import { useUSBDevices } from './hooks/useUSBDevices';
import { ConfigureGalBoxModal } from './components/GalSetupModal/ConfigureGalBoxModal';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import SpaceWrapperPage from './pages/SpaceWrapperPage';
import NewSpacePage from './pages/NewSpacePage';
import SignupPage from './pages/SignupPage';
import LoginPage from 'pages/LoginPage';

// Define types for window.electron
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        send: (channel: string, data: any) => void;
        on: (channel: string, callback: (...args: any[]) => void) => void;
        once: (channel: string, callback: (...args: any[]) => void) => void;
        removeListener: (channel: string, callback: (...args: any[]) => void) => void;
        invoke: (channel: string, data: any) => Promise<any>;
      };
    };
  }
}

export function App() {
  const { showSetupModal, setShowSetupModal, currentDevice, completeDeviceSetup } = useUSBDevices();

  return (
    <div className="app-container">
      <Routes>
        {/* Main application routes - space-based UI */}
        <Route
          path="/new"
          element={
            <ProtectedRoute>
              <NewSpacePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/spaces/:spaceId"
          element={
            <ProtectedRoute>
              <SpaceWrapperPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<LoginPage />} />

        {!window.location.hostname.includes('bedrock.computer') ? (
          <Route path="/signup" element={<SignupPage />} />
        ) : null}

        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showSetupModal && currentDevice && (
        <ConfigureGalBoxModal
          device={currentDevice}
          onClose={() => {
            debug.log('Closing modal');
            setShowSetupModal(false);
          }}
          onComplete={completeDeviceSetup}
        />
      )}
    </div>
  );
}

export default App;
