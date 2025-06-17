import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useNeurvanaAppStore, FileInfo } from '../store/neurvanaAppStore';
import { useSpaceStore } from '../../../stores/spaceStore';
import './NeurvanaApp.scss';
import NeurvanaExplorer, { NeurvanaExplorerMethods } from './NeurvanaExplorer';
import WindowWrapper from '../../../WindowWrapper';
import { useFileService } from '../../../services/FileService';
import { useDropzone } from 'react-dropzone';
import SourcePanel from './SourcePanel';
import DataTable, { TableDataItem } from './DataTable';
import AnalysisPanel from './AnalysisPanel';

export interface NeurvanaAppProps {
  projectId?: string;
  entityId?: string; // Generic entity ID instead of specific fileId/uiViewId
  entityType?: string; // Add type information
  onClose?: () => void;
  windowId: string;
  spaceId: string;
  title?: string;
}

// Create a separate content component to avoid duplication
const NeurvanaAppContent: React.FC<Omit<NeurvanaAppProps, 'onClose' | 'title'>> = ({ 
  projectId, 
  entityId,
  entityType,
  windowId, 
  spaceId 
}) => {
  const { 
    initialize, 
    activeFileId,
    activeUIViewId, 
    setFileId,
    setUIViewId,
    openFile
  } = useNeurvanaAppStore(windowId, spaceId);
  
  const { updateWindow } = useSpaceStore();
  const fileService = useFileService();
  
  const [isUIView, setIsUIView] = useState(false);
  const [activeTab, setActiveTab] = useState('data'); // 'data' or 'analysis'
  const [localProjectId, setLocalProjectId] = useState<string | null>(() => {
    // First prioritize prop
    if (projectId) return projectId;
    
    // Then check URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlProjectId = urlParams.get('projectId');
      
      if (urlProjectId) return urlProjectId;
      
      // Finally check localStorage
      const savedProjectId = localStorage.getItem('lastOpenProjectId');
      if (savedProjectId) return savedProjectId;
    }
    
    return null;
  });

  // State for table data
  const [tableData, setTableData] = useState<TableDataItem[]>([]);

  // For dropzone functionality
  const { isDragActive } = useDropzone({
    onDrop: () => {},
    noClick: true,
    noKeyboard: true
  });

  useEffect(() => {
    initialize(localProjectId);
    
    // Handle initial entity selection based on entityType
    if (entityId && entityType) {
      if (entityType.toLowerCase() === 'file') {
        setFileId(entityId);
        setIsUIView(false);
      } else if (entityType.toLowerCase() === 'uiview' || entityType.toLowerCase() === 'ui') {
        setUIViewId(entityId);
        setIsUIView(true);
      }
    }
  }, [initialize, localProjectId, entityId, entityType, setFileId, setUIViewId]);

  useEffect(() => {
    if (projectId !== undefined && projectId !== localProjectId) {
      setLocalProjectId(projectId || null);
    }
  }, [projectId]);

  // Sync state back to window entity
  useEffect(() => {
    if (windowId) {
      updateWindow(windowId, {
        applicationState: {
          neurvana: {
            projectId: localProjectId || undefined,
            activeFileId,
            activeUIViewId,
            isUIView,
            activeTab
          }
        }
      });
    }
  }, [windowId, localProjectId, activeFileId, activeUIViewId, isUIView, activeTab, updateWindow]);

  // Handle entity selection from the explorer
  const handleEntitySelect = useCallback(async (id: string, type: string) => {
    console.log(`[NeurvanaApp] Entity selected: ${id} of type ${type}`);
    
    if (type.toLowerCase() === 'file') {
      try {
        // Fetch the file details using the fileService from the outer scope
        const fileEntities = await fileService.getList();
        const fileEntity = fileEntities.find(entity => entity._id === id);
        
        if (fileEntity) {
          // Create a FileInfo object with safe property access
          const fileInfo: FileInfo = {
            id: fileEntity._id,
            name: fileEntity.name || 'Untitled',
            path: fileEntity.skeleton?.path || '', // Using optional chaining for skeleton.path
            type: 'file',
            content: '' // Content will be loaded by the editor
          };
          
          // Open the file (adds to openFiles array)
          openFile(fileInfo);
          
          // Set as active file
          setFileId(id);
          setIsUIView(false);
        } else {
          console.error(`File with ID ${id} not found`);
        }
      } catch (error) {
        console.error('Error opening file:', error);
      }
    } else {
      // Handle other entity types (for future expansion)
      console.log(`Selected entity of type ${type}: ${id}`);
    }
  }, [setFileId, openFile, fileService]);

  return (
    <div className="neurvana-app">
      <div className="neurvana-tabs">
        <button 
          className={`tab-button ${activeTab === 'data' ? 'active' : ''}`}
          onClick={() => setActiveTab('data')}
        >
          Data
        </button>
        <button 
          className={`tab-button ${activeTab === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          Analysis
        </button>
      </div>
      
      <div className="neurvana-app-main">
        <SourcePanel 
          tableData={tableData} 
          setTableData={setTableData}
          setActiveTab={setActiveTab}
        />
        
        <div className="neurvana-app-content">
          {activeTab === 'data' ? (
            <DataTable 
              tableData={tableData} 
              setTableData={setTableData} 
            />
          ) : (
            <AnalysisPanel tableData={tableData} />
          )}
        </div>
      </div>
      
      {isDragActive && (
        <div className="drop-overlay">
          <p>Drop files here to import</p>
        </div>
      )}
    </div>
  );
};

const NeurvanaApp: React.FC<NeurvanaAppProps> = ({ 
  onClose,
  title = 'Neurvana',
  ...props
}) => {
  const [displayTitle, setDisplayTitle] = useState(title);
  const explorerRef = useRef<NeurvanaExplorerMethods | null>(null);

  // Update title when window is focused or project changes
  useEffect(() => {
    setDisplayTitle('Neurvana');
  }, [props.projectId]);
  
  return (
    <WindowWrapper 
      onClose={onClose} 
      title={displayTitle}
      showProjectActions={false}
    >
      <NeurvanaAppContent {...props} />
    </WindowWrapper>
  );
};

export default NeurvanaApp; 