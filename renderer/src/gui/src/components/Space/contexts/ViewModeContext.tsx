import React, { createContext, useContext, ReactNode } from 'react';
import useSpaceStore from '../../../stores/spaceStore';

// Define the view mode types
export type ViewMode = 'spatial' | 'focused';

// Context interface
interface ViewModeContextType {
  viewMode: ViewMode;
  toggleViewMode: () => void;
}

// Create the context with a default value
const ViewModeContext = createContext<ViewModeContextType>({
  viewMode: 'spatial',
  toggleViewMode: () => {},
});

// Provider component
interface ViewModeProviderProps {
  children: ReactNode;
}

export const ViewModeProvider: React.FC<ViewModeProviderProps> = ({ children }) => {
  // Get the current view mode and setter from space store
  const viewMode = useSpaceStore(state => state.activeSpace?.settings?.viewMode || 'spatial');
  const setViewMode = useSpaceStore(state => state.setViewMode);

  // Toggle function to switch between view modes
  const toggleViewMode = () => {
    const newMode = viewMode === 'spatial' ? 'focused' : 'spatial';
    setViewMode(newMode);
  };

  // Context value
  const contextValue: ViewModeContextType = {
    viewMode: viewMode as ViewMode,
    toggleViewMode
  };

  return (
    <ViewModeContext.Provider value={contextValue}>
      {children}
    </ViewModeContext.Provider>
  );
};

// Custom hook to use the view mode context
export const useViewMode = () => useContext(ViewModeContext);

export default ViewModeContext; 