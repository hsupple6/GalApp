import './WindowWrapper.scss';

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import PDFApp from './apps/PDFApp';
import { FileType } from './types';

interface WindowWrapperProps {
  children: React.ReactNode;
  title: string;
  onClose?: () => void; // Make onClose optional
  isTab?: boolean; // Whether this is part of a tabbed interface
  tabs?: string[]; // Optional array of tabs
  defaultTab?: string; // Optional default selected tab
  headerButtons?: React.ReactNode; // Optional buttons to display in the header
  onCreateNewGroup?: () => void; // Handler for creating a new group
  onOpenProject?: () => void; // Handler for opening a project
  showProjectActions?: boolean; // Whether to show project actions in header
}

interface Tab {
  id: string;
  component: JSX.Element;
  entity: FileType | null;
}

const isStandalone = window.location.pathname.startsWith('/app');

const WindowWrapper = ({ 
  children, 
  onClose, 
  title, 
  isTab = false, 
  headerButtons,
  onCreateNewGroup,
  onOpenProject,
  showProjectActions = false
}: WindowWrapperProps) => {
  const navigate = useNavigate();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]); // Track open tabs
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [showTitleDropdown, setShowTitleDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTitleDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('authToken'); // Remove token from local storage
    setAuthToken(null); // Clear auth token from state

    navigate('/');
    // window.location.reload(); // Reload the page (you can also redirect to a login page)
  };

  const handleAddTab = () => {
    const newTab: Tab = {
      id: `Tab-${tabs.length + 1}`, // Generate a unique ID
      component: (
        <PDFApp
          entity={null}
          onClose={() => {}}
          title={`Tab ${tabs.length + 1}`}
          isTab
          onSelectPdf={handleUpdateTabEntity}
          tabId={`Tab-${tabs.length + 1}`}
          key={`Tab-${tabs.length + 1}`}
        />
      ),
      entity: null, // initial entity is null
    };

    setTabs((prevTabs) => [...prevTabs, newTab]);
    setActiveTab(newTab.id); // Set the newly added tab as the active one
  };

  const handleCloseTab = (tabId: string) => {
    setTabs((prevTabs) => prevTabs.filter((t) => t.id !== tabId));

    if (activeTab === tabId && tabs.length > 1) {
      setActiveTab(tabs[0].id); // Set the first tab as active if the active tab was closed
    } else if (tabs.length === 1) {
      setActiveTab(null); // If no tabs are left, set activeTab to null
    }
  };

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
  };

  // Callback function to update the entity for a specific tab
  const handleUpdateTabEntity = (tabId: string, updatedEntity: any) => {
    if (!updatedEntity) {
      return;
    }
    setTabs((prevTabs) =>
      prevTabs.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              entity: updatedEntity,
              component: (
                <PDFApp
                  entity={updatedEntity}
                  onClose={() => {}}
                  title={updatedEntity.fileName}
                  isTab
                  onSelectPdf={handleUpdateTabEntity}
                  tabId={tabId}
                  key={`Tab-${tabs.length + 1}`}
                />
              ),
            }
          : tab,
      ),
    );
  };

  // const handleNewFileUpload = async (file: File) => {
  //
  //     // Upload the file to create an entity
  //     const formData = new FormData();
  //     formData.append('file', file);
  //
  //     try {
  //         const response = await fetch('http://localhost:5001/upload-entity', {
  //             method: 'POST',
  //             body: formData,
  //         });
  //
  //         const entity = await response.json();
  //
  //         console.debug('Raw response:', entity);  // Log it to see if there's an issue
  //
  //         if (!response.ok) {
  //             throw new Error(`Error: ${response.status}`);
  //         }
  //
  //         if (entity.entityType === 'File') {
  //             const newTab: Tab = {
  //                 id: entity.fileId,
  //                 component: (
  //                     <PDFApp entity={entity} onClose={() => {}} title={entity.fileName} isTab onSelectPdf={handleUpdateTabEntity} />
  //                 ),
  //                 entity: entity,
  //             };
  //             setTabs(prevTabs => [...prevTabs, newTab]);
  //             setActiveTab(newTab.id); // Set the newly uploaded entity as the active tab
  //         }
  //
  //         console.debug('Uploaded Entity:', entity);
  //
  //     } catch (error) {
  //         console.error('Error during file upload:', error);
  //     }
  // };

  // If rendered as a Tab, only return the tab content
  if (isTab) {
    const activeTabComponent = tabs.find((tab) => tab.id === activeTab)?.component;
    return <>{activeTabComponent ? activeTabComponent : children}</>;
  }

  // Full window content for standalone mode
  return (
    <div className={isStandalone ? 'standalone appWrapper' : 'gui appWrapper'}>
      {/* <DropZone parentId={null} callback={handleNewFileUpload} /> */}
      {isStandalone && (
        <div className="appHeader">
          {showProjectActions ? (
            <div className="titleContainer" ref={dropdownRef}>
              <span 
                className="appTitle" 
                onClick={() => setShowTitleDropdown(!showTitleDropdown)}
              >
                {title} ▾
              </span>
              {showTitleDropdown && (
                <div className="titleDropdown">
                  {onOpenProject && (
                    <div 
                      className="dropdownItem" 
                      onClick={() => {
                        if (onOpenProject) onOpenProject();
                        setShowTitleDropdown(false);
                      }}
                    >
                      <span className="dropdownIcon">📂</span> Open Project
                    </div>
                  )}
                  {onCreateNewGroup && (
                    <div 
                      className="dropdownItem" 
                      onClick={() => {
                        if (onCreateNewGroup) onCreateNewGroup();
                        setShowTitleDropdown(false);
                      }}
                    >
                      <span className="dropdownIcon">+</span> New Folder
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <span>{title}</span>
          )}
          <div className="appControls">
            {!isTab && (
              <>
                <div className="tabContainer">
                  {tabs.map((tab) => (
                    <div className="tab" key={tab.id}>
                      <span
                        className={`tab ${tab.id === activeTab ? 'active' : ''}`}
                        onClick={() => handleSelectTab(tab.id)}
                      >
                        {tab.id}
                        <button className="tabButton" onClick={() => handleCloseTab(tab.id)}>
                          ×
                        </button>
                      </span>
                    </div>
                  ))}
                  <button className="headerButton" onClick={handleAddTab}>
                    +
                  </button>
                </div>
              </>
            )}
            {isStandalone && (
              <div className="standaloneAppControls">
                <div className="username">username</div>
                <button onClick={handleLogout} className="logoutButton">
                  Log Out
                </button>
              </div>
            )}
            {headerButtons && (
              <div className="headerButtonsContainer">
                {headerButtons}
              </div>
            )}
            {!isStandalone && (
              <button 
                className="headerButton closeButton" 
                onClick={() => onClose && onClose()}
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}
      <div className="appContent">{tabs.find((tab) => tab.id === activeTab)?.component || children}</div>
    </div>
  );
};

export default WindowWrapper;
