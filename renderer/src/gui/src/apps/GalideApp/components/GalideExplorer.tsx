import React, { useState, useCallback, useEffect, useRef } from 'react';
import './GalideExplorer.scss';
import { useDropzone } from 'react-dropzone';
import { API_BASE_URL } from '../../../api/config';
import fetchService from '../../../services/fetchService';
import { useFileService } from '../../../services/FileService';
import useEntityStore from '../../../stores/entityStore';
import { BaseEntityType } from '../../../types';
import { FILES_ENDPOINTS, PROJECTS_ENDPOINTS } from '../../../endpoints';
import { v4 as uuidv4 } from 'uuid';
import { entityCRDTService } from '../../../services/crdt/entityCRDTService';
import * as galideService from '../services/galideService';
import ContextMenu, { useContextMenu, ContextMenuItem, createSeparator, createMetadata } from '../../../components/ContextMenu';
import { logger } from '../../../utils/logger';

// Define our tree node structure
export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: string; // 'file', 'directory', 'ui', etc. - more flexible 
  entityType: string; // Original entity type from backend
  children?: FileNode[];
  url?: string; // Add URL for iframe source for UI nodes
}

export interface GalideExplorerProps {
  projectId: string | null;
  onEntitySelect: (entityId: string, entityType: string) => void;
  activeEntityId?: string | null; // Add this to receive active entity from parent
}

// Define the explorer methods interface
export interface GalideExplorerMethods {
  handleCreateNewGroup: () => void;
  handleCreateNewFile: () => void;
  handleCreateNewUIView: () => void;
  handleOpenProject: () => void;
}

// Helper function to convert entity data to FileNode structure with better type handling
const convertEntitesToFileTree = (entities: BaseEntityType[]): FileNode[] => {
  // Map of ID to array index for quick lookup
  const entityMap = new Map<string, number>();
  
  // First pass: build the map
  entities.forEach((entity, index) => {
    entityMap.set(entity._id, index);
  });
  
  const buildNode = (entity: BaseEntityType): FileNode => {
    // Get children if this is a directory/group
    const children: FileNode[] = [];
    
    if (entity.skeleton && entity.skeleton.childIds) {
      const childIds = entity.skeleton.childIds || [];
      
      childIds.forEach((childId: string) => {
        const childIndex = entityMap.get(childId);
        if (childIndex !== undefined) {
          const childEntity = entities[childIndex];
          children.push(buildNode(childEntity));
        }
      });
    }
    
    // Determine the node type
    let type = 'file';
    if (entity.entityType === 'Group' || entity.entityType === 'Project') {
      type = 'directory';
    } else if (entity.entityType === 'UIView') {
      type = 'ui';
    }
    
    return {
      id: entity._id,
      name: entity.name || entity.skeleton?.fileName || 'Unnamed',
      path: entity.skeleton?.path || entity.name,
      type,
      entityType: entity.entityType,
      children: children.length > 0 ? children : undefined,
      url: entity.skeleton?.url // Add the URL if it exists
    };
  };
  
  // When fetching with parentId, these are ALREADY the children we want to show
  // We don't need to filter out those with parentId
  return entities.map(buildNode);
};

// Custom file getter for handling folders
const customFileGetter = async (event: any): Promise<File[]> => {
  const items = event.dataTransfer ? Array.from(event.dataTransfer.items) : [];
  const files: File[] = [];
  
  // Process dropped items (which could be files or directories)
  for (const item of items) {
    // Type guard to ensure we only work with DataTransferItem objects
    if (!item || typeof item !== 'object') continue;
    
    // First check if it has the kind property and it's a file
    const dataTransferItem = item as DataTransferItem;
    if (dataTransferItem.kind === 'file') {
      // Check if it supports the webkitGetAsEntry method
      if ('webkitGetAsEntry' in dataTransferItem && typeof dataTransferItem.webkitGetAsEntry === 'function') {
        const entry = dataTransferItem.webkitGetAsEntry();
        
        if (entry) {
          if (entry.isFile) {
            const file = await getFileFromEntry(entry as FileSystemFileEntry);
            files.push(file);
          } else if (entry.isDirectory) {
            const directoryFiles = await getFilesFromDirectory(entry as FileSystemDirectoryEntry);
            files.push(...directoryFiles);
          }
        }
      } else if ('getAsFile' in dataTransferItem && typeof dataTransferItem.getAsFile === 'function') {
        // Fallback for browsers that don't support webkitGetAsEntry
        const file = dataTransferItem.getAsFile();
        if (file) files.push(file);
      }
    }
  }
  
  // If we don't have any files from dataTransfer, use the regular files
  if (files.length === 0 && event.target && event.target.files) {
    const fileList = Array.from(event.target.files) as File[];
    files.push(...fileList);
  }
  
  return files;
};

// Helper to get a File from a FileEntry
const getFileFromEntry = (entry: FileSystemFileEntry): Promise<File> => {
  return new Promise((resolve) => {
    entry.file((file: File) => resolve(file));
  });
};

// Helper to get Files from a DirectoryEntry
const getFilesFromDirectory = async (entry: FileSystemDirectoryEntry): Promise<File[]> => {
  const dirReader = entry.createReader();
  const entries = await new Promise<FileSystemEntry[]>((resolve) => {
    dirReader.readEntries((entries) => resolve(entries));
  });
  
  const files: File[] = [];
  
  for (const childEntry of entries) {
    if (childEntry.isFile) {
      const file = await getFileFromEntry(childEntry as FileSystemFileEntry);
      
      // Add directory info to the file for organizing uploads later
      Object.defineProperty(file, '__directoryInfo', {
        value: { path: entry.fullPath },
        enumerable: false 
      });
      
      files.push(file);
    } else if (childEntry.isDirectory) {
      const subFiles = await getFilesFromDirectory(childEntry as FileSystemDirectoryEntry);
      files.push(...subFiles);
    }
  }
  
  return files;
};

// Add a debugging function to log tree structure
const logTreeStructure = (nodes: FileNode[], level = 0) => {
  nodes.forEach(node => {
    logger.log(
      `${'  '.repeat(level)}${node.name} (${node.type}, id: ${node.id.substring(0, 8)}...)`
    );
    if (node.children && node.children.length > 0) {
      logTreeStructure(node.children, level + 1);
    }
  });
};

// Helper function to find entity node and its parent path in the tree
const findEntityAndParents = (
  nodes: FileNode[], 
  entityId: string, 
  parentPath: string[] = []
): { node: FileNode | null, path: string[] } => {
  for (const node of nodes) {
    // Check if this is the node we're looking for
    if (node.id === entityId) {
      return { node, path: parentPath };
    }
    
    // If node has children, recursively search them
    if (node.children && node.children.length > 0) {
      const result = findEntityAndParents(
        node.children,
        entityId,
        [...parentPath, node.id]
      );
      
      if (result.node) {
        return result;
      }
    }
  }
  
  return { node: null, path: [] };
};

const GalideExplorer: React.FC<GalideExplorerProps> = ({ 
  projectId, 
  onEntitySelect,
  activeEntityId: externalActiveEntityId
}) => {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreatingNewFile, setIsCreatingNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [isCreatingNewUIView, setIsCreatingNewUIView] = useState(false);
  const [newUIViewName, setNewUIViewName] = useState('');
  const [localProjectId, setLocalProjectId] = useState<string | null>(projectId);
  const [projectName, setProjectName] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ [key: string]: number }>({});
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [availableProjects, setAvailableProjects] = useState<BaseEntityType[]>([]);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [internalActiveEntityId, setInternalActiveEntityId] = useState<string | null>(null);
  
  // Add context menu state
  const { contextMenuProps, showMenu, hideMenu } = useContextMenu();
  const [selectedEntityForContextMenu, setSelectedEntityForContextMenu] = useState<FileNode | null>(null);
  
  // Use external active entity ID if provided, otherwise use internal state
  const activeEntityId = externalActiveEntityId || internalActiveEntityId;
  
  const newGroupInputRef = useRef<HTMLInputElement>(null);
  const newFileInputRef = useRef<HTMLInputElement>(null);
  const newUIViewInputRef = useRef<HTMLInputElement>(null);
  const fileService = useFileService();
  const entityStore = useEntityStore();
  
  // Load project ID from URL or localStorage on mount
  useEffect(() => {
    // First prioritize props
    if (projectId) {
      setLocalProjectId(projectId);
      galideService.saveProjectIdToUrlAndStorage(projectId);
      return;
    }
    
    // Otherwise check URL/localStorage
    const savedId = galideService.getProjectIdFromUrlOrStorage();
    if (savedId) {
      logger.log('[Explorer] Loading project from URL/localStorage:', savedId);
      setLocalProjectId(savedId);
    }
  }, [projectId]);
  
  // Update URL when project changes
  useEffect(() => {
    if (localProjectId) {
      galideService.saveProjectIdToUrlAndStorage(localProjectId);
    }
  }, [localProjectId]);
  
  // Fetch available projects on component mount
  useEffect(() => {
    const loadProjects = async () => {
      try {
        // Use the galideService instead of fileService
        const projects = await galideService.getProjects();
        setAvailableProjects(projects);
      } catch (error) {
        logger.error('Failed to load projects:', error);
      }
    };
    
    loadProjects();
  }, []);
  
  const fetchFileTree = useCallback(async () => {
    if (localProjectId) {
      try {
        // First, try to get the project entity to get its name
        try {
          const project = await galideService.getProject(localProjectId);
          if (project) {
            setProjectName(project.name);
          }
        } catch (error) {
          logger.error('Failed to fetch project details:', error);
        }
        
        // Get child entities using the service
        logger.log('[Explorer] Fetching file tree for project:', localProjectId);
        const entities = await galideService.getProjectEntities(localProjectId);
        
        logger.log('[Explorer] Raw entities from API:', entities);
        
        // If entities array is empty or undefined, use an empty array
        const fileNodes = convertEntitesToFileTree(entities || []);
        
        // Add our UI entities (now persistent)
        const uiNodes = await addHardcodedUINodes(fileNodes);
        
        logger.log('[Explorer] Converted file tree with UI nodes:', uiNodes);
        
        // Log tree structure for debugging
        logger.log('[Explorer] Project tree structure:');
        logTreeStructure(uiNodes);
        
        setFileTree(uiNodes);
        
        // Expand root nodes by default
        const initialExpanded: Record<string, boolean> = {};
        uiNodes.forEach(node => {
          initialExpanded[node.id] = true;
        });
        setExpandedNodes(initialExpanded);
      } catch (error) {
        logger.error('Failed to fetch file tree:', error);
      }
    } else {
      // Clear the file tree when no project is open
      setFileTree([]);
    }
  }, [localProjectId]);
  
  useEffect(() => {
    fetchFileTree();
  }, [fetchFileTree]);
  
  // Update local project ID when prop changes
  useEffect(() => {
    setLocalProjectId(projectId);
  }, [projectId]);
  
  // Focus input when creating new items
  useEffect(() => {
    if (isCreatingNewGroup && newGroupInputRef.current) {
      newGroupInputRef.current.focus();
    }
    if (isCreatingNewFile && newFileInputRef.current) {
      newFileInputRef.current.focus();
    }
    if (isCreatingNewUIView && newUIViewInputRef.current) {
      newUIViewInputRef.current.focus();
    }
  }, [isCreatingNewGroup, isCreatingNewFile, isCreatingNewUIView]);
  
  // Use effect to auto-expand parents when active entity changes
  useEffect(() => {
    if (activeEntityId && fileTree.length > 0) {
      // Find the node and its parent path
      const { path } = findEntityAndParents(fileTree, activeEntityId);
      
      if (path.length > 0) {
        // Check if we need to update expanded nodes
        let needsUpdate = false;
        const newExpanded = { ...expandedNodes };
        
        path.forEach(nodeId => {
          if (!expandedNodes[nodeId]) {
            newExpanded[nodeId] = true;
            needsUpdate = true;
          }
        });
        
        // Only update state if necessary
        if (needsUpdate) {
          logger.log('[Explorer] Auto-expanding parents for active entity:', activeEntityId);
          setExpandedNodes(newExpanded);
        }
      }
    }
  }, [activeEntityId, fileTree, expandedNodes]);
  
  // Keep track of activeEntityId during tree refreshes
  useEffect(() => {
    // If we have an active entity ID already, keep it when the tree is refreshed
    const preserveActiveId = externalActiveEntityId || internalActiveEntityId;
    
    if (preserveActiveId && fileTree.length > 0) {
      // Verify if the active entity still exists in the tree
      const { node } = findEntityAndParents(fileTree, preserveActiveId);
      
      if (node) {
        // Entity still exists, ensure it's set as active
        setInternalActiveEntityId(preserveActiveId);
      }
    }
  }, [fileTree, externalActiveEntityId, internalActiveEntityId]);
  
  const updateProgress = (fileName: string, percent: number) => {
    setProgress((prev) => ({ ...prev, [fileName]: percent }));
  };

  const handleDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!localProjectId) {
        // If no project is open, create a new one
        try {
          const newProject = await galideService.createProject('New Project');
          setLocalProjectId(newProject._id);
          setProjectName(newProject.name);
          
          // Wait for state to update before continuing
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          logger.error('Failed to create new project for uploads:', error);
          return;
        }
      }
      
      // At this point we should have a projectId
      const projectId = localProjectId;
      if (!projectId) return;
      
      setUploading(true);
      setProgress({});
      setErrors({});

      try {
        logger.log('[Explorer] Processing files:', acceptedFiles);

        // Group files by directory
        const filesByDirectory = new Map<string, File[]>();
        acceptedFiles.forEach((file) => {
          const dirInfo = (file as any).__directoryInfo;
          const key = dirInfo?.path || 'root';
          const existing = filesByDirectory.get(key) || [];
          filesByDirectory.set(key, [...existing, file]);
        });

        const allUploadedEntities: BaseEntityType[] = [];

        // Process each directory
        for (const [dirPath, files] of filesByDirectory.entries()) {
          // Upload files with progress tracking
          const uploadPromises = files.map(async (file) => {
            try {
              updateProgress(file.name, 0);
              // Add current project as parent for the file
              const entity = await galideService.addFileToProject(file, projectId);
              updateProgress(file.name, 100);
              return entity;
            } catch (error) {
              logger.error(`Failed to upload ${file.name}:`, error);
              setErrors((prev) => ({
                ...prev,
                [file.name]: error instanceof Error ? error.message : 'Upload failed',
              }));
              return null;
            }
          });

          const results = await Promise.all(uploadPromises);
          const uploadedEntities = results.filter(Boolean) as BaseEntityType[];
          allUploadedEntities.push(...uploadedEntities);

          // Create group if this was a directory upload
          if (dirPath !== 'root' && uploadedEntities.length > 0) {
            try {
              const folderName = dirPath.split('/').pop() || 'Untitled Folder';
              const childEntityIds = uploadedEntities.map(f => f._id);
              
              // Create a group for this directory and add the uploaded files to it
              const group = await galideService.createGroup(
                folderName, 
                projectId,
                childEntityIds
              );
              
              logger.log('[Explorer] Created directory group:', group);
            } catch (error) {
              logger.error('Failed to create group:', error);
              // Continue even if group creation fails
            }
          }
        }

        // Refresh entity store if any files were uploaded
        if (allUploadedEntities.length > 0) {
          logger.log('[Explorer] Refreshing entities after upload');
          await fetchFileTree();
        }
      } catch (error) {
        logger.error('[Explorer] Upload failed:', error);
      } finally {
        setUploading(false);
      }
    },
    [localProjectId, fetchFileTree]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    multiple: true,
    noClick: true, // Prevent click from opening file dialog as we have our own UI
    noKeyboard: true
  });
  
  const toggleExpandNode = (nodeId: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };
  
  const handleOpenProject = () => {
    setShowProjectSelector(true);
  };
  
  const handleSelectProject = (projectId: string) => {
    setLocalProjectId(projectId);
    const project = availableProjects.find(p => p._id === projectId);
    if (project) {
      setProjectName(project.name);
    }
    setShowProjectSelector(false);
  };
  
  const handleCreateNewProject = async () => {
    try {
      const newProject = await galideService.createProject('New Project');
      setAvailableProjects(prev => [...prev, newProject]);
      setLocalProjectId(newProject._id);
      setProjectName(newProject.name);
      setShowProjectSelector(false);
    } catch (error) {
      logger.error('Failed to create new project:', error);
    }
  };
  
  const handleCreateNewGroup = () => {
    setIsCreatingNewGroup(true);
    setNewGroupName('');
    setIsCreatingNewFile(false);
    setIsCreatingNewUIView(false);
  };
  
  const handleCreateNewFile = () => {
    setIsCreatingNewFile(true);
    setNewFileName('');
    setIsCreatingNewGroup(false);
    setIsCreatingNewUIView(false);
  };
  
  const handleCreateNewUIView = () => {
    setIsCreatingNewUIView(true);
    setNewUIViewName('');
    setIsCreatingNewGroup(false);
    setIsCreatingNewFile(false);
  };
  
  const handleNewGroupNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newGroupName.trim()) {
      try {
        // Check if we have a projectId
        if (!localProjectId) {
          // If no project is open, create a new one
          try {
            const newProject = await galideService.createProject(newGroupName);
            
            logger.log(`Created new project: ${newGroupName} (${newProject._id})`);
            
            // Update available projects
            setAvailableProjects(prev => [...prev, newProject]);
            
            // Set projectName first to avoid rendering with default PROJECT EXPLORER
            setProjectName(newGroupName);
            
            // Update localProjectId after projectName to avoid render conflicts
            setLocalProjectId(newProject._id);
            
            // Note: fetchFileTree will be called due to the useEffect when localProjectId changes
          } catch (error) {
            logger.error('Failed to create new project:', error);
          }
        } else {
          // Add the new group as a child of the current project
          try {
            logger.log('[Explorer] Creating folder:', newGroupName, 'in project:', localProjectId);
            
            // Call the service to create a group
            const group = await galideService.createGroup(newGroupName, localProjectId);
            logger.log('[Explorer] Created group:', group);
            
            // Update the view
            await fetchFileTree();
          } catch (error) {
            logger.error('Failed to create group:', error);
          }
        }
      } catch (error) {
        logger.error('Error creating group:', error);
      }
    }
    
    setIsCreatingNewGroup(false);
  };
  
  const handleNewGroupNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewGroupName(e.target.value);
  };
  
  const handleNewGroupNameBlur = () => {
    handleNewGroupNameSubmit({ preventDefault: () => {} } as React.FormEvent);
  };
  
  const handleNewFileNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewFileName(e.target.value);
  };
  
  const handleNewFileNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newFileName.trim() && localProjectId) {
      try {
        // For now, create an empty text file
        const fileContent = ''; // Empty content
        const file = new File([fileContent], newFileName, { type: 'text/plain' });
        
        logger.log('[Explorer] Creating new file:', newFileName);
        const fileEntity = await galideService.addFileToProject(file, localProjectId);
        
        logger.log('[Explorer] Created file:', fileEntity);
        await fetchFileTree(); // Refresh the tree
      } catch (error) {
        logger.error('Failed to create file:', error);
      }
    }
    
    setIsCreatingNewFile(false);
  };
  
  const handleNewFileNameBlur = () => {
    handleNewFileNameSubmit({ preventDefault: () => {} } as React.FormEvent);
  };
  
  const handleNewUIViewNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewUIViewName(e.target.value);
  };
  
  const handleNewUIViewNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newUIViewName.trim() && localProjectId) {
      try {
        logger.log('[Explorer] Creating UI View:', newUIViewName);
        
        // Basic HTML template for the new UI View
        const basicUIHTML = `
          <html>
            <head>
              <title>${newUIViewName}</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                  padding: 20px;
                  background-color: #f9f9f9;
                  color: #333;
                }
                h1 { color: #0066cc; margin-bottom: 20px; }
              </style>
            </head>
            <body>
              <h1>${newUIViewName}</h1>
              <p>This is a new UI View. Edit the HTML content to customize it.</p>
              
              <script>
                // Simple script to handle messaging with parent window
                window.parent.postMessage({ type: 'UI_READY' }, '*');
              </script>
            </body>
          </html>
        `;
        
        const uiView = await galideService.createUIView(
          newUIViewName,
          undefined, // No URL, using HTML content
          localProjectId,
          {
            allowDirectChildren: true,
            directoryStructure: 'flat'
          },
          basicUIHTML
        );
        
        logger.log('[Explorer] Created UI View:', uiView);
        await fetchFileTree(); // Refresh the tree
      } catch (error) {
        logger.error('Failed to create UI View:', error);
      }
    }
    
    setIsCreatingNewUIView(false);
  };
  
  const handleNewUIViewNameBlur = () => {
    handleNewUIViewNameSubmit({ preventDefault: () => {} } as React.FormEvent);
  };
  
  // Function to add hardcoded UI entities to the file tree
  const addHardcodedUINodes = async (nodes: FileNode[]): Promise<FileNode[]> => {
    // If we already have UI nodes, don't add hardcoded ones
    const hasUINodes = nodes.some(node => node.entityType === 'UIView');
    
    // Return the existing nodes if we already have UI entities
    if (hasUINodes) {
      logger.log('[Explorer] Found existing UI nodes in data, not adding hardcoded ones');
      return nodes;
    }
    
    logger.log('[Explorer] No existing UI nodes found, adding hardcoded ones');
    const updatedNodes = [...nodes];
    
    // Check if we already have UI nodes in the existing nodes
    const hasIngestionWizard = nodes.some(
      node => node.entityType === 'UIView' && node.name === 'Ingestion Wizard'
    );
    const hasEntityTable = nodes.some(
      node => node.entityType === 'UIView' && node.name === 'Entity Table'
    );
    
    // If we don't have the Ingestion Wizard and we have a project ID, create it
    if (!hasIngestionWizard && localProjectId) {
      try {
        logger.log('[Explorer] Creating Ingestion Wizard UI entity');
        
        // Basic HTML content for the Ingestion Wizard
        const ingestionWizardHTML = `
          <html>
            <head>
              <title>Ingestion Wizard</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                  padding: 20px;
                  background-color: #f9f9f9;
                  color: #333;
                }
                h1 { color: #0066cc; margin-bottom: 20px; }
                .drop-area {
                  border: 2px dashed #ccc;
                  border-radius: 6px;
                  padding: 40px 20px;
                  text-align: center;
                  margin: 20px 0;
                  background-color: #f0f5fa;
                  transition: all 0.3s ease;
                }
                .drop-area.highlight {
                  border-color: #4a90e2;
                  background-color: #e3f2fd;
                }
                button {
                  background-color: #4a90e2;
                  color: white;
                  border: none;
                  padding: 10px 20px;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 14px;
                  margin-top: 20px;
                  transition: background-color 0.3s ease;
                }
                button:hover {
                  background-color: #3a7bc8;
                }
                .mapping-section {
                  margin-top: 30px;
                  background-color: white;
                  border: 1px solid #ddd;
                  border-radius: 6px;
                  padding: 15px;
                  margin-bottom: 20px;
                }
              </style>
            </head>
            <body>
              <h1>File Ingestion Wizard</h1>
              <div class="drop-area" id="dropArea">
                <p>Drop folders or files here</p>
                <p>or click to select</p>
                <p><small>Supported formats: .nii, .nii.gz, .dcm</small></p>
              </div>
              
              <div class="mapping-section">
                <h3>Mapping Configuration</h3>
                <p>Configure how files should be organized when ingested.</p>
                <button id="ingestBtn">Ingest Files</button>
              </div>
              
              <script>
                // Simple script to handle messaging
                window.parent.postMessage({ type: 'UI_READY' }, '*');
                
                // Simple drop area highlight
                const dropArea = document.getElementById('dropArea');
                dropArea.addEventListener('dragover', (e) => {
                  e.preventDefault();
                  dropArea.classList.add('highlight');
                });
                
                dropArea.addEventListener('dragleave', () => {
                  dropArea.classList.remove('highlight');
                });
                
                dropArea.addEventListener('drop', (e) => {
                  e.preventDefault();
                  dropArea.classList.remove('highlight');
                  // In a real implementation, we'd process the files here
                });
              </script>
            </body>
          </html>
        `;
        
        const ingestionWizard = await galideService.createUIView(
          'Ingestion Wizard',
          `${window.location.origin}/static/ingestion-wizard.html`,
          localProjectId,
          {
            allowDirectChildren: true,
            directoryStructure: 'hierarchical'
          },
          ingestionWizardHTML  // Pass the HTML content
        );
        
        // Create a corresponding FileNode
        const ingestionNode: FileNode = {
          id: ingestionWizard._id,
          name: ingestionWizard.name,
          path: '/ingestion-wizard',
          type: 'ui',
          entityType: 'UIView',
          url: ingestionWizard.skeleton?.url,
          children: []
        };
        
        updatedNodes.push(ingestionNode);
        logger.log('[Explorer] Created Ingestion Wizard UI entity:', ingestionWizard._id);
      } catch (error) {
        logger.error('Failed to create Ingestion Wizard UI:', error);
      }
    }
    
    // If we don't have the Entity Table and we have a project ID, create it
    if (!hasEntityTable && localProjectId) {
      try {
        logger.log('[Explorer] Creating Entity Table UI entity');
        
        // Basic HTML content for the Entity Table
        const entityTableHTML = `
          <html>
            <head>
              <title>Entity Table</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                  padding: 20px;
                  background-color: #f9f9f9;
                  color: #333;
                }
                h1 { color: #0066cc; margin-bottom: 20px; }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-top: 20px;
                }
                th, td {
                  border: 1px solid #ddd;
                  padding: 8px 12px;
                  text-align: left;
                }
                th {
                  background-color: #f2f2f2;
                  font-weight: 600;
                }
                tr:nth-child(even) {
                  background-color: #f9f9f9;
                }
                tr:hover {
                  background-color: #f0f0f0;
                }
                .filter-bar {
                  margin-bottom: 20px;
                  display: flex;
                  gap: 10px;
                }
                .filter-bar input {
                  padding: 8px;
                  border: 1px solid #ddd;
                  border-radius: 4px;
                  flex: 1;
                }
                .filter-bar button {
                  background-color: #4a90e2;
                  color: white;
                  border: none;
                  padding: 8px 16px;
                  border-radius: 4px;
                  cursor: pointer;
                }
              </style>
            </head>
            <body>
              <h1>Entity Table View</h1>
              
              <div class="filter-bar">
                <input type="text" placeholder="Filter by name...">
                <button>Apply Filter</button>
              </div>
              
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Date Created</th>
                    <th>Tags</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Example Entity 1</td>
                    <td>File</td>
                    <td>2023-08-15</td>
                    <td>tag1, tag2</td>
                  </tr>
                  <tr>
                    <td>Example Entity 2</td>
                    <td>Group</td>
                    <td>2023-08-16</td>
                    <td>tag3</td>
                  </tr>
                </tbody>
              </table>
              
              <script>
                // Simple script to handle messaging
                window.parent.postMessage({ type: 'UI_READY' }, '*');
                
                // In a real implementation, we'd populate the table from data from the parent
              </script>
            </body>
          </html>
        `;
        
        const entityTable = await galideService.createUIView(
          'Entity Table',
          `${window.location.origin}/static/entity-table.html`,
          localProjectId,
          {
            allowDirectChildren: false,
            directoryStructure: 'flat'
          },
          entityTableHTML  // Pass the HTML content
        );
        
        // Create a corresponding FileNode
        const tableNode: FileNode = {
          id: entityTable._id,
          name: entityTable.name,
          path: '/entity-table',
          type: 'ui',
          entityType: 'UIView',
          url: entityTable.skeleton?.url,
          children: []
        };
        
        updatedNodes.push(tableNode);
        logger.log('[Explorer] Created Entity Table UI entity:', entityTable._id);
      } catch (error) {
        logger.error('Failed to create Entity Table UI:', error);
      }
    }
    
    return updatedNodes;
  };
  
  // Handle selection of an entity
  const handleEntitySelect = (nodeId: string, entityType: string, url?: string) => {
    // Set the active entity ID for visual indication
    setInternalActiveEntityId(nodeId);
    
    // If it's a UI node with a URL, we'll need special handling
    if (entityType === 'UIView' && url) {
      logger.log('[Explorer] Opening UI view with URL:', url);
      
      // Just pass the nodeId and entityType to the parent's onEntitySelect
      // Let GalideApp handle the details of creating the UIViewInfo
      onEntitySelect(nodeId, entityType);
    } else {
      // Call the parent's onEntitySelect for all other entities
      onEntitySelect(nodeId, entityType);
    }
  };
  
  // Modify the handleContextMenu function to use createMetadata
  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    setSelectedEntityForContextMenu(node);
    
    // Create menu items based on entity type
    const menuItems: ContextMenuItem[] = [];
    
    // Common actions for all entity types
    menuItems.push({
      id: 'open',
      label: 'Open',
      shortcut: '↵',
      onClick: () => handleEntitySelect(node.id, node.entityType, node.url)
    });
    
    // For files, add edit action
    if (node.type === 'file') {
      menuItems.push({
        id: 'edit',
        label: 'Edit',
        shortcut: 'Ctrl+E',
        onClick: () => handleEntitySelect(node.id, node.entityType, node.url)
      });
    }
    
    // For directories, add expand/collapse action
    if (node.type === 'directory' || (node.type === 'ui' && node.children && node.children.length > 0)) {
      const isExpanded = expandedNodes[node.id];
      menuItems.push({
        id: isExpanded ? 'collapse' : 'expand',
        label: isExpanded ? 'Collapse' : 'Expand',
        shortcut: isExpanded ? '←' : '→',
        onClick: () => toggleExpandNode(node.id)
      });
    }
    
    // Add separator before file operations
    menuItems.push(createSeparator());
    
    // Add file operations if not the project itself
    if (node.id !== localProjectId) {
      // Add rename option (will be implemented later)
      menuItems.push({
        id: 'rename',
        label: 'Rename',
        shortcut: 'F2',
        disabled: true, // Not yet implemented
        onClick: () => {
          // Future rename implementation
          logger.log('Rename not yet implemented');
        }
      });
      
      // Add duplicate option (will be implemented later)
      menuItems.push({
        id: 'duplicate',
        label: 'Duplicate',
        shortcut: 'Ctrl+D',
        disabled: true, // Not yet implemented
        onClick: () => {
          // Future duplicate implementation
          logger.log('Duplicate not yet implemented');
        }
      });
      
      // Add separator before dangerous actions
      menuItems.push(createSeparator());
      
      // Add delete option
      menuItems.push({
        id: 'delete',
        label: 'Delete',
        shortcut: 'Del',
        danger: true,
        onClick: () => handleDeleteEntity(node)
      });
    }
    
    // Information about the entity
    menuItems.push(createSeparator());
    
    // Use createMetadata instead of disabled menu items for entity info
    menuItems.push(createMetadata(`${node.name} (${node.type})`));
    menuItems.push(createMetadata(`ID: ${node.id.substring(0, 8)}...`));
    
    showMenu(e.clientX, e.clientY, menuItems);
  };
  
  // Add a function to handle entity deletion
  const handleDeleteEntity = async (node: FileNode) => {
    if (!window.confirm(`Are you sure you want to delete "${node.name}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      await galideService.deleteEntity(node.id);
      
      // Refresh the file tree
      await fetchFileTree();
      
      // If we just deleted the active entity, clear it
      if (internalActiveEntityId === node.id) {
        setInternalActiveEntityId(null);
      }
    } catch (error) {
      logger.error(`Failed to delete entity ${node.id}:`, error);
      alert(`Failed to delete "${node.name}". Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // Render the unified file tree with virtualization
  const renderProjectTree = (nodes: FileNode[], level = 1, parentId?: string) => {
    // Only render a subset if there are too many nodes
    const MAX_VISIBLE_NODES = 100;
    const isLargeDirectory = nodes.length > MAX_VISIBLE_NODES;
    const nodesToRender = isLargeDirectory 
      ? nodes.slice(0, MAX_VISIBLE_NODES)
      : nodes;
    
    const result = nodesToRender.map(node => (
      <React.Fragment key={node.id}>
        <div 
          className={`explorer-item ${node.type} ${activeEntityId === node.id ? 'active' : ''}`}
          style={{ paddingLeft: `${level * 16}px` }}
          onContextMenu={(e) => handleContextMenu(e, node)}
        >
          {/* UI entities can be expandable just like directories if they have children */}
          {(node.type === 'directory' || (node.type === 'ui' && node.children && node.children.length > 0)) && (
            <button 
              className="expand-toggle"
              onClick={() => toggleExpandNode(node.id)}
            >
              {expandedNodes[node.id] ? '▼' : '►'}
            </button>
          )}
          <div 
            className="item-name"
            onClick={() => handleEntitySelect(node.id, node.entityType, node.url)}
          >
            {node.name}
            {node.type === 'ui' && <span className="type-badge">UI</span>}
          </div>
        </div>
        
        {/* Render children for both directories and UI entities */}
        {(node.type === 'directory' || node.type === 'ui') && 
          expandedNodes[node.id] && 
          node.children && 
          node.children.length > 0 && 
          renderProjectTree(node.children, level + 1, node.id)
        }
      </React.Fragment>
    ));
    
    // Add indicator if we're truncating
    if (isLargeDirectory && parentId) {
      result.push(
        <div 
          key="more-items" 
          className="explorer-item more-indicator"
          style={{ paddingLeft: `${level * 16}px` }}
          onClick={() => {
            // Toggle the parent node to collapse it and then re-expand
            // This is a simple way to "refresh" the view and show all items
            if (parentId) {
              logger.log('[Explorer] Showing all items in large directory:', parentId);
              setExpandedNodes(prev => ({
                ...prev,
                [parentId]: false
              }));
              
              // Use a small timeout to allow the collapse to register visually
              setTimeout(() => {
                setExpandedNodes(prev => ({
                  ...prev,
                  [parentId]: true
                }));
              }, 50);
            }
          }}
        >
          <div className="item-name">
            <i>{nodes.length - MAX_VISIBLE_NODES} more items...</i>
            <span className="more-hint">Click to load all</span>
          </div>
        </div>
      );
    }
    
    return result;
  };
  
  // Render upload progress
  const renderProgress = () => {
    if (!uploading) return null;

    return (
      <div className="upload-progress">
        {Object.entries(progress).map(([fileName, percent]) => (
          <div key={fileName} className="file-progress">
            <div className="file-name">{fileName}</div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${percent}%` }} />
            </div>
            {errors[fileName] && <div className="error">{errors[fileName]}</div>}
          </div>
        ))}
      </div>
    );
  };
  
  // Render project selector
  const renderProjectSelector = () => {
    if (!showProjectSelector) return null;
    
    return (
      <div className="project-selector">
        <div className="project-selector-header">
          <h3>Select Project</h3>
          <button 
            className="close-button"
            onClick={() => setShowProjectSelector(false)}
          >
            ×
          </button>
        </div>
        <div className="project-list">
          {availableProjects.length > 0 ? (
            availableProjects.map(project => (
              <div 
                key={project._id}
                className="project-item"
                onClick={() => handleSelectProject(project._id)}
              >
                {project.name}
              </div>
            ))
          ) : (
            <div className="no-projects">No projects available</div>
          )}
        </div>
        <div className="project-selector-footer">
          <button 
            className="create-project-button"
            onClick={handleCreateNewProject}
          >
            Create New Project
          </button>
        </div>
      </div>
    );
  };
  
  // Return public methods that can be used by parent components
  const explorerMethods: GalideExplorerMethods = {
    handleCreateNewGroup: () => {
      setIsCreatingNewGroup(true);
      setNewGroupName('');
      setIsCreatingNewFile(false);
      setIsCreatingNewUIView(false);
    },
    handleCreateNewFile: () => {
      setIsCreatingNewFile(true);
      setNewFileName('');
      setIsCreatingNewGroup(false);
      setIsCreatingNewUIView(false);
    },
    handleCreateNewUIView: () => {
      setIsCreatingNewUIView(true);
      setNewUIViewName('');
      setIsCreatingNewGroup(false);
      setIsCreatingNewFile(false);
    },
    handleOpenProject: () => {
      setShowProjectSelector(true);
    }
  };
  
  // Make methods available globally for reference
  useEffect(() => {
    if (window) {
      (window as any).galideExplorerMethods = explorerMethods;
    }
  }, []);
  
  return (
    <div 
      className="neurvana-explorer"
      {...getRootProps()}
    >
      <input {...getInputProps()} />
      {isDragActive && (
        <div className="drop-overlay">
          <p>Drop files or folders here to upload</p>
        </div>
      )}
      
      {renderProjectSelector()}
      
      <div className="explorer-header">
        <div className="project-selector-bar">
          <h3 onClick={handleOpenProject} className="project-title">{projectName || 'PROJECT EXPLORER'}</h3>
          <div className="project-actions">
            <button 
              className="project-action create-group"
              onClick={handleCreateNewGroup}
              title="New Folder"
            >
              <span className="icon">📁</span>
              <span className="plus-badge">+</span>
            </button>
            <button 
              className="project-action create-file"
              onClick={handleCreateNewFile}
              title="New File"
            >
              <span className="icon">📄</span>
              <span className="plus-badge">+</span>
            </button>
            <button 
              className="project-action create-uiview"
              onClick={handleCreateNewUIView}
              title="New UI View"
            >
              <span className="icon">🖼️</span>
              <span className="plus-badge">+</span>
            </button>
          </div>
        </div>
        
        {isCreatingNewGroup && (
          <form onSubmit={handleNewGroupNameSubmit} className="new-group-form">
            <input 
              ref={newGroupInputRef}
              type="text"
              value={newGroupName}
              onChange={handleNewGroupNameChange}
              onBlur={handleNewGroupNameBlur}
              placeholder="Enter folder name..."
              className="new-group-input"
            />
          </form>
        )}
        
        {isCreatingNewFile && (
          <form onSubmit={handleNewFileNameSubmit} className="new-file-form">
            <input 
              ref={newFileInputRef}
              type="text"
              value={newFileName}
              onChange={handleNewFileNameChange}
              onBlur={handleNewFileNameBlur}
              placeholder="Enter file name..."
              className="new-file-input"
            />
          </form>
        )}
        
        {isCreatingNewUIView && (
          <form onSubmit={handleNewUIViewNameSubmit} className="new-uiview-form">
            <input 
              ref={newUIViewInputRef}
              type="text"
              value={newUIViewName}
              onChange={handleNewUIViewNameChange}
              onBlur={handleNewUIViewNameBlur}
              placeholder="Enter UI View name..."
              className="new-uiview-input"
            />
          </form>
        )}
      </div>
      
      <div className="explorer-content">
        {fileTree.length > 0 ? (
          renderProjectTree(fileTree)
        ) : (
          <div className="empty-state">
            {localProjectId ? (
              <p>No files in this project. Drop files or folders here to upload.</p>
            ) : (
              <p>No project open. Create or open a project to get started.</p>
            )}
          </div>
        )}
      </div>
      
      {renderProgress()}
      
      {/* Add Context Menu */}
      <ContextMenu {...contextMenuProps} />
    </div>
  );
};

export default GalideExplorer; 