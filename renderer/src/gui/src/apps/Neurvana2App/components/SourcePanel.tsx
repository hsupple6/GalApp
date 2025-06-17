import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import NeurvanaFS from '../../../types/fileSystemAccess';
import { 
  getDirectoryPicker,
  asNeurvanaDirectoryHandle,
  asNeurvanaFileHandle,
  asAppropriateNeurvanaHandle
} from '../utils/fileSystemUtils';
import './SourcePanel.scss';
import { TableDataItem } from './DataTable';
import neuroimagingService from '../services/neuroimagingService';
import FolderMappingDialog, { FolderMapping } from './FolderMappingDialog';
import metadataService from '../services/metadataService';

// Define types for file system items
interface FileSystemItem {
  name: string;
  kind: 'file' | 'directory';
  handle?: NeurvanaFS.FileSystemHandle;
  path: string;
  children?: FileSystemItem[];
  size: number;
  lastModified: Date;
  type?: string;
  icon?: string;
}

interface SourcePanelProps {
  tableData: TableDataItem[];
  setTableData: React.Dispatch<React.SetStateAction<TableDataItem[]>>;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
}

const SourcePanel: React.FC<SourcePanelProps> = ({ tableData, setTableData, setActiveTab }) => {
  // File System Access API state
  const [rootDirectory, setRootDirectory] = useState<FileSystemItem | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [directoryContents, setDirectoryContents] = useState<FileSystemItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [detectedPipelines, setDetectedPipelines] = useState<string[]>([]);
  const [showMappingDialog, setShowMappingDialog] = useState<boolean>(false);
  const [folderMappings, setFolderMappings] = useState<FolderMapping[]>([]);
  const [hasDerivatives, setHasDerivatives] = useState<boolean>(false);
  const [folderStructure, setFolderStructure] = useState<{
    name: string;
    path: string;
    type: 'folder' | 'file';
    children?: { name: string; path: string; type: 'folder' | 'file' }[];
  }[]>([]);

  // Check if File System Access API is supported
  const isFileSystemAccessSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  // Handle dropzone for files
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => {
      
      // Filter for neuroimaging file types
      const neuroimagingExtensions = ['nii', 'nii.gz', 'dcm', 'mgh', 'mgz', 'edf', 'bdf', 'set', 'fif'];
      
      const neuroimagingFiles = acceptedFiles.filter(file => {
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        return neuroimagingExtensions.includes(extension);
      });
      
      if (neuroimagingFiles.length > 0) {
        // Add to data table
        const newRows = neuroimagingFiles.map((file, index) => {
          // Extract name from filename (without extension)
          const baseName = file.name.split('.')[0];
          // Check if it follows a pattern like R001, R002, etc.
          const subjectMatch = baseName.match(/^R(\d+)/i);
          
          // Use webkitRelativePath as a fallback for file.path
          const filePath = file.webkitRelativePath || file.name;
          
          return {
            name: baseName,
            sub_id: subjectMatch ? parseInt(subjectMatch[1]) : tableData.length + index + 1,
            session: 1, // Default session
            type: 'Func', // Default type
            scan: file.name,
            file_source: filePath,
            pre: 1, // Assume pre by default
            post: 0,
            active: 1 // Set as active
          };
        });
        
        setTableData(prev => [...prev, ...newRows]);
      }
    },
    noClick: true,
    noKeyboard: true,
    accept: {
      'image/nii': ['.nii', '.nii.gz'],
      'application/dicom': ['.dcm'],
      'application/octet-stream': ['.mgh', '.mgz', '.edf', '.bdf', '.set', '.fif']
    }
  });

  // Try to restore the directory handle on component mount
  useEffect(() => {
    // Remove the auto-restore attempt since it requires user gesture
    setIsLoading(false);
  }, [isFileSystemAccessSupported]);

  // Helper function to load subdirectory contents
  const loadSubdirectoryContents = async (
    dirHandle: NeurvanaFS.FileSystemDirectoryHandle,
    path: string
  ): Promise<FileSystemItem[]> => {
    const items: FileSystemItem[] = [];
    
    try {
      for await (const entry of dirHandle.values()) {
        const subPath = `${path === '/' ? '' : path}/${entry.name}`;
        const typedEntry = asAppropriateNeurvanaHandle(entry as any);
        const item = await convertHandleToFileSystemItem(typedEntry, subPath);
        
        if (entry.kind === 'file') {
          try {
            const fileHandle = typedEntry as NeurvanaFS.FileSystemFileHandle;
            const file = await fileHandle.getFile();
            item.size = file.size;
            item.lastModified = new Date(file.lastModified);
          } catch (error) {
            console.warn(`Could not get details for file: ${entry.name}`, error);
          }
        }
        
        items.push(item);
      }
      
      // Sort items: directories first, then files
      items.sort((a, b) => {
        if (a.kind === 'directory' && b.kind === 'file') return -1;
        if (a.kind === 'file' && b.kind === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });
      
      return items;
    } catch (error) {
      return [];
    }
  };

  // Helper function to render directory contents recursively
  const renderDirectoryContents = (items: FileSystemItem[], level: number) => {
    return items.map((item) => (
      <React.Fragment key={item.path}>
        <div 
          className={`directory-item ${item.kind}`}
          style={{ paddingLeft: `${level * 20}px` }}
        >
          {item.kind === 'directory' ? (
            <>
              <span 
                className="expand-icon"
                onClick={async (e) => {
                  e.stopPropagation(); // Prevent directory selection when clicking expand
                  if (!expandedFolders[item.path] && item.handle) {
                    // Load subdirectory contents if not already loaded
                    const dirHandle = item.handle as NeurvanaFS.FileSystemDirectoryHandle;
                    const subItems = await loadSubdirectoryContents(dirHandle, item.path);
                    
                    // Update the item's children
                    item.children = subItems;
                    
                    // Force a re-render by creating a new directoryContents array
                    setDirectoryContents([...directoryContents]);
                  }
                  toggleFolderExpansion(item.path);
                }}
              >
                {expandedFolders[item.path] ? '▼' : '►'}
              </span>
              <span 
                className="item-label directory-label"
                onClick={async () => {
                  if (item.handle) {
                    setCurrentPath(item.path);
                    await loadDirectoryContents(
                      item.handle as NeurvanaFS.FileSystemDirectoryHandle,
                      item.path
                    );
                  }
                }}
              >
                {item.name}
              </span>
            </>
          ) : (
            <span 
              className="item-label file-label"
              onClick={async () => {
                if (item.handle && item.kind === 'file') {
                  try {
                    const fileHandle = item.handle as NeurvanaFS.FileSystemFileHandle;
                    const file = await fileHandle.getFile();
                    
                    if (item.type === 'neuroimaging') {
                      const newRow = {
                        name: file.name.split('.')[0],
                        sub_id: tableData.length + 1,
                        session: 1,
                        type: 'Func',
                        scan: file.name,
                        file_source: item.path,
                        pre: 1,
                        post: 0,
                        active: 1
                      };
                      
                      setTableData(prev => [...prev, newRow]);
                    }
                  } catch (error) {
                    console.error('Failed to read file:', error);
                  }
                }
              }}
            >
              {item.name}
              {item.type === 'neuroimaging' && <span className="file-badge">MRI</span>}
            </span>
          )}
        </div>
        
        {/* Render children recursively if expanded */}
        {item.kind === 'directory' && 
         expandedFolders[item.path] && 
         item.children && 
         item.children.length > 0 && 
         renderDirectoryContents(item.children, level + 1)}
      </React.Fragment>
    ));
  };

  // Connect to directory by showing directory picker
  const handleConnectDirectory = async () => {
    if (!isFileSystemAccessSupported) {
      setError('File System Access API is not supported in your browser. Please use Chrome, Edge, or another browser that supports it.');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Show directory picker using our helper function
      const showDirectoryPicker = getDirectoryPicker();
      let dirHandle;
      try {
        dirHandle = await showDirectoryPicker({ 
          id: 'neurvana-directory',
          startIn: 'desktop' 
        });
      } catch (error: any) {
        // Handle user cancellation gracefully
        if (error.name === 'AbortError') {
          setIsLoading(false);
          return; // Just return silently if user cancelled
        }
        throw error; // Re-throw other errors
      }
      
      // Make sure we have a valid directory handle
      if (!dirHandle || dirHandle.kind !== 'directory') {
        setError('Invalid directory selected.');
        setIsLoading(false);
        return;
      }
      
      // Store the handle for future sessions
      try {
        localStorage.setItem('neurvanaDirectoryHandle', JSON.stringify({
          name: dirHandle.name,
          kind: dirHandle.kind
        }));
      } catch (err) {
        console.warn('Could not save directory handle to localStorage:', err);
      }
      
      // Convert directory handle to FileSystemItem
      const rootItem = await convertHandleToFileSystemItem(dirHandle, '/');
      
      // Verify that the root directory handle is valid
      if (!rootItem) {
        setError('Failed to process directory. Please try again.');
        setIsLoading(false);
        return;
      }
      
      // Update state with the root directory first
      setRootDirectory(rootItem);
      setCurrentPath('/');
      
      // Ensure the directory tree is expanded for the root
      setExpandedFolders(prev => ({
        ...prev,
        '/': true
      }));
      
      // Use a delay to ensure state is updated before proceeding
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Now load directory contents
      await loadDirectoryContents(dirHandle, '/');
      
      // Only proceed with detection if root directory is properly set
      if (rootItem && rootItem.handle) {
        try {
          await detectDerivativesInDirectory();
          processDirectory();
        } catch (err) {
          console.error('Error during derivative detection:', err);
        }
      }
      
    } catch (error) {
      console.error('Failed to connect to directory:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect to directory');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to convert directory handle to FileSystemItem
  const convertHandleToFileSystemItem = async (
    handle: NeurvanaFS.FileSystemDirectoryHandle | NeurvanaFS.FileSystemFileHandle,
    path: string
  ): Promise<FileSystemItem> => {
    const isDirectory = handle.kind === 'directory';
    
    return {
      name: handle.name,
      kind: handle.kind,
      handle: handle,
      path: path,
      children: isDirectory ? [] : undefined,
      size: 0, // Will be set later for files
      lastModified: new Date(),
      type: isDirectory ? 'directory' : getFileType(handle.name)
    };
  };

  // Get file type based on extension
  const getFileType = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'];
    const textExtensions = ['txt', 'md', 'html', 'css', 'js', 'ts', 'json'];
    const neuroimagingExtensions = ['nii', 'nii.gz', 'dcm', 'mgh', 'mgz', 'edf', 'bdf', 'set', 'fif'];
    
    if (imageExtensions.includes(extension)) return 'image';
    if (textExtensions.includes(extension)) return 'text';
    if (neuroimagingExtensions.includes(extension)) return 'neuroimaging';
    
    return 'unknown';
  };

  // Load directory contents
  const loadDirectoryContents = async (
    dirHandle: NeurvanaFS.FileSystemDirectoryHandle,
    path: string
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const items: FileSystemItem[] = [];
      
      // Get all the entries in the directory
      for await (const entry of dirHandle.values()) {
        const itemPath = `${path === '/' ? '' : path}/${entry.name}`;
        
        // Use our utility to convert to the proper namespaced type
        const typedEntry = asAppropriateNeurvanaHandle(entry as any);
        
        // Convert entry to FileSystemItem
        const item = await convertHandleToFileSystemItem(typedEntry, itemPath);
        
        // For files, get more details
        if (entry.kind === 'file') {
          try {
            const fileHandle = typedEntry as NeurvanaFS.FileSystemFileHandle;
            const file = await fileHandle.getFile();
            item.size = file.size;
            item.lastModified = new Date(file.lastModified);
          } catch (error) {
            console.warn(`Could not get details for file: ${entry.name}`, error);
          }
        }
        
        items.push(item);
      }
      
      // Sort items: directories first, then files, both alphabetically
      items.sort((a, b) => {
        if (a.kind === 'directory' && b.kind === 'file') return -1;
        if (a.kind === 'file' && b.kind === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });
      
      setDirectoryContents(items);
    } catch (error) {
      console.error('Failed to load directory contents:', error);
      setError(error instanceof Error ? error.message : 'Failed to load directory contents');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle navigating to a directory
  const handleNavigateToDirectory = async (item: FileSystemItem) => {
    if (item.kind !== 'directory' || !item.handle) return;
    
    // Update current path
    setCurrentPath(item.path);
    
    // Load contents of the directory
    await loadDirectoryContents(item.handle as NeurvanaFS.FileSystemDirectoryHandle, item.path);
  };

  // Toggle folder expansion
  const toggleFolderExpansion = (path: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  // Function to organize file names to BIDS format
  const organizeNamingToBIDS = () => {
    // BIDS format: sub-<label>_ses-<label>_task-<label>_run-<index>_<modality_label>.nii.gz
    const updatedData = tableData.map(row => {
      // Transform the name to BIDS format
      const subjectId = `sub-${String(row.sub_id).padStart(3, '0')}`;
      const sessionId = `ses-${String(row.session).padStart(2, '0')}`;
      const modality = row.type.toLowerCase();
      
      // Create BIDS filename
      const bidsFileName = `${subjectId}_${sessionId}_${modality}.nii.gz`;
      
      // Create BIDS file path
      const bidsFilePath = `${subjectId}/${sessionId}/${modality}/${bidsFileName}`;
      
      // Return updated row
      return {
        ...row,
        name: subjectId, // Update name field to subject ID
        file_source: bidsFilePath, // Update file source to BIDS path
        status: 'Organized' // Add status to indicate it's been organized
      };
    });
    
    setTableData(updatedData);
    // Set processing status for UI feedback
    setProcessingStatus('BIDS organization complete');
  };
  
  // Function to detect transform steps using the neuroimaging service
  const detectTransformSteps = () => {
    // Using the neuroimaging service to detect processing steps
    const updatedData = tableData.map(row => {
      const filePath = row.file_source;
      
      // Use the neuroimaging service to detect transforms on this file
      const { pre, post, steps, status } = neuroimagingService.detectTransformSteps(filePath);
      
      // Return updated row with detected pre/post processing flags
      return {
        ...row,
        pre,
        post,
        status: status,
        processing_steps: steps.join(', ')
      };
    });
    
    setTableData(updatedData);
    // Set processing status for UI feedback
    setProcessingStatus('Transform steps detected');
  };
  
  // Convert directory structure to format for folder mapping
  const prepareFolderStructure = async (): Promise<{
    name: string;
    path: string;
    type: 'folder' | 'file';
    children?: { name: string; path: string; type: 'folder' | 'file' }[];
  }[]> => {
    if (!rootDirectory) return [];
    
    // Recursive function to load directory contents
    const loadDirectoryRecursively = async (
      dirHandle: NeurvanaFS.FileSystemDirectoryHandle,
      path: string
    ): Promise<{
      name: string;
      path: string;
      type: 'folder' | 'file';
      children: {
        name: string;
        path: string;
        type: 'folder' | 'file';
        children?: any[];
      }[];
    }> => {
      const children: {
        name: string;
        path: string;
        type: 'folder' | 'file';
        children?: any[];
      }[] = [];
      
      // Enumerate all entries in this directory
      for await (const entry of dirHandle.values()) {
        const entryPath = `${path === '/' ? '' : path}/${entry.name}`;
        
        if (entry.kind === 'directory') {
          // Recursively load subdirectory
          const subDirHandle = asNeurvanaDirectoryHandle(entry as FileSystemDirectoryHandle);
          const subDirItem = await loadDirectoryRecursively(subDirHandle, entryPath);
          children.push(subDirItem);
        } else {
          // Add file
          children.push({
            name: entry.name,
            path: entryPath,
            type: 'file'
          });
        }
      }
      
      // Sort children: directories first, then files
      children.sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });
      
      return {
        name: dirHandle.name,
        path: path,
        type: 'folder',
        children: children
      };
    };
    
    // If we have a handle, use it to load the complete structure
    if (rootDirectory.handle && rootDirectory.handle.kind === 'directory') {
      try {
        const completeStructure = await loadDirectoryRecursively(
          rootDirectory.handle as NeurvanaFS.FileSystemDirectoryHandle,
          rootDirectory.path
        );
        return [completeStructure];
      } catch (error) {
        console.error('Failed to load complete directory structure:', error);
        // Fall back to the simple conversion below
      }
    }
    
    // Fallback to just converting the existing structure
    const convertItem = (item: FileSystemItem): {
      name: string;
      path: string;
      type: 'folder' | 'file';
      children?: any[];
    } => {
      const result: {
        name: string;
        path: string;
        type: 'folder' | 'file';
        children?: any[];
      } = {
        name: item.name,
        path: item.path,
        type: item.kind === 'directory' ? 'folder' : 'file'
      };
      
      if (item.children && item.children.length > 0) {
        result.children = item.children.map(convertItem);
      }
      
      return result;
    };
    
    return [convertItem(rootDirectory)];
  };

  // Handle opening the folder mapping dialog
  const handleShowMappingDialog = async () => {
    setIsLoading(true);
    try {
      const folderStructureData = await prepareFolderStructure();
      setFolderStructure(folderStructureData);
      setShowMappingDialog(true);
    } catch (error) {
      console.error('Failed to prepare folder structure:', error);
      setError('Failed to load folder structure. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle applying folder mappings
  const handleApplyMapping = async (mappings: FolderMapping[]) => {
    setFolderMappings(mappings);
    
    // After applying mappings in the FolderMappingDialog (which updates the metadata),
    // we need to update the table data, but we want to replace existing data, not append
    const tableRows = metadataService.convertToTableData();
    setTableData(tableRows);  // Replace existing data, not append
    
    // Update status message
    setProcessingStatus(`Applied ${mappings.length} folder mappings. Metadata updated.`);
  };

  // Generate virtual entries for missing source scans based on derivatives
  const generateVirtualEntries = async (mappings: FolderMapping[]) => {
    if (!rootDirectory) return;
    
    // Extract folder structure for neuroimaging service
    const folderStructure = await prepareFolderStructure();
    
    // Get subject info from neuroimaging service
    const { subjects, derivatives } = neuroimagingService.generateSubjectInfo(folderStructure);
    
    if (derivatives.length === 0) {
      setProcessingStatus('No derivative data detected.');
      return;
    }
    
    setHasDerivatives(true);
    
    // Create table entries for each subject, with derivatives info
    const newRows: TableDataItem[] = [];
    
    // Add mapped folders first
    mappings.forEach(mapping => {
      if (mapping.mappingType === 'subject' || mapping.mappingType === 'pipeline_output') {
        // Find any derivatives for this subject
        const subjectDerivs = derivatives.filter(d => 
          d.subjectId === mapping.subjectId || 
          d.path.includes(mapping.folderPath)
        );
        
        // Determine if it has FreeSurfer data
        const hasFreeSurfer = subjectDerivs.some(d => d.type === 'FREESURFER');
        
        // Create a row for this subject
        newRows.push({
          name: mapping.subjectId,
          sub_id: parseInt(mapping.subjectId) || 0,
          session: parseInt(mapping.sessionId) || 1,
          type: hasFreeSurfer ? 'T1' : 'Unknown', // Assume T1 for FreeSurfer
          scan: hasFreeSurfer ? 'brain.mgz' : '',
          file_source: mapping.folderPath,
          pre: hasFreeSurfer ? 1 : 0,
          post: hasFreeSurfer ? 1 : 0,
          active: 1,
          status: hasFreeSurfer ? 'Analyzed' : 'Unknown',
          processing_steps: hasFreeSurfer ? 'FreeSurfer Reconstruction' : ''
        });
      }
    });
    
    // Add any remaining subjects not in mappings
    subjects.forEach(subject => {
      // Skip if already added through mapping
      if (mappings.some(m => m.subjectId === subject.id)) {
        return;
      }
      
      // Find derivatives for this subject
      const subjectDerivs = derivatives.filter(d => d.subjectId === subject.id);
      const hasFreeSurfer = subjectDerivs.some(d => d.type === 'FREESURFER');
      
      // Create a row for this subject
      newRows.push({
        name: subject.name,
        sub_id: parseInt(subject.id) || 0,
        session: 1,
        type: hasFreeSurfer ? 'T1' : 'Unknown',
        scan: hasFreeSurfer ? 'brain.mgz' : '',
        file_source: subject.path,
        pre: hasFreeSurfer ? 1 : 0,
        post: hasFreeSurfer ? 1 : 0,
        active: 1,
        status: hasFreeSurfer ? 'Analyzed' : 'Unknown',
        processing_steps: hasFreeSurfer ? 'FreeSurfer Reconstruction' : ''
      });
    });
    
    // Update the table with the new data
    if (newRows.length > 0) {
      setTableData(newRows);
      setProcessingStatus(`Generated ${newRows.length} entries from derivative data.`);
      
      // Also update detected pipelines for display
      const pipelineTypes = Array.from(new Set(derivatives.map(d => d.type)));
      setDetectedPipelines(pipelineTypes);
    }
  };

  // Detect if directory has derivatives during initial scan
  const detectDerivativesInDirectory = async (): Promise<boolean> => {
    
    if (!rootDirectory?.handle) {
      console.warn('No root directory handle available for derivative detection');
      return false;
    }
    
    try {
      // Prepare folder structure for analysis
      const folderStructure = await prepareFolderStructure();
      
      if (folderStructure.length === 0) {
        console.warn('Empty folder structure for derivative analysis');
        return false;
      }
      
      // Analyze with neuroimaging service
      const { derivatives } = neuroimagingService.generateSubjectInfo(folderStructure);
      
      if (derivatives.length > 0) {
        const pipelineTypes = Array.from(new Set(derivatives.map(d => d.type)));
        
        // Update state
        setHasDerivatives(true);
        setDetectedPipelines(pipelineTypes);
        
        // Show notification to user about derivatives
        setProcessingStatus(`Detected ${derivatives.length} derivative outputs (${pipelineTypes.join(', ')}). Use "Map Folders" to organize the data.`);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error detecting derivatives:', error);
      return false;
    }
  };

  // Update processDirectory function to scan directory and update metadata
  const processDirectory = async () => {
    
    if (!rootDirectory) {
      setError('No directory selected. Please connect to a directory first.');
      return;
    }
    
    // Verify that the handle is valid
    if (!rootDirectory.handle || rootDirectory.handle.kind !== 'directory') {
      console.error('Invalid directory handle in processDirectory');
      setError('Invalid directory handle. Please reconnect to the directory.');
      return;
    }
    
    setIsLoading(true);
    setProcessingStatus('Scanning directory for neuroimaging files...');
    
    try {
      // Collect all files from directory (both neuroimaging and relevant directories)
      const collectFilesAndDirs = async (
        dirHandle: NeurvanaFS.FileSystemDirectoryHandle, 
        path: string
      ): Promise<{isDirectory: boolean, file?: File, path: string, name: string, type?: string}[]> => {
        const items: {isDirectory: boolean, file?: File, path: string, name: string, type?: string}[] = [];
        
        for await (const entry of dirHandle.values()) {
          const entryPath = `${path === '/' ? '' : path}/${entry.name}`;
          
          if (entry.kind === 'directory') {
            // Add directory item
            items.push({
              isDirectory: true,
              path: entryPath,
              name: entry.name
            });
            
            // Recurse into subdirectory
            const subDirHandle = asNeurvanaDirectoryHandle(entry as FileSystemDirectoryHandle);
            const subItems = await collectFilesAndDirs(subDirHandle, entryPath);
            items.push(...subItems);
          } else if (entry.kind === 'file') {
            const fileHandle = asNeurvanaFileHandle(entry as FileSystemFileHandle);
            const file = await fileHandle.getFile();
            
            // Determine file type
            const extension = file.name.split('.').pop()?.toLowerCase() || '';
            const neuroimagingExtensions = ['nii', 'nii.gz', 'dcm', 'mgh', 'mgz', 'edf', 'bdf', 'set', 'fif'];
            const type = neuroimagingExtensions.includes(extension) ? 'neuroimaging' : 'other';
            
            items.push({
              isDirectory: false,
              file,
              path: entryPath,
              name: file.name,
              type
            });
          }
        }
        
        return items;
      };
      
      // Start collecting files and directories from root
      const allItems = await collectFilesAndDirs(
        rootDirectory.handle as NeurvanaFS.FileSystemDirectoryHandle, 
        '/'
      );
      
      // Use neuroimaging service to analyze files
      const neuroimagingFiles = allItems.filter(item => !item.isDirectory && item.type === 'neuroimaging');
      
      // Convert to FileDetails for neuroimaging service
      const fileDetails = neuroimagingFiles.map(item => ({
        path: item.path,
        name: item.name,
        type: item.file?.type,
        extension: item.name.split('.').pop()?.toLowerCase(),
        isDirectory: false
      }));
      
      // Use neuroimaging service to detect pipelines
      const summary = neuroimagingService.createSummary(fileDetails);
      
      // Sync filesystem items with metadata store
      metadataService.syncFromFileSystem(allItems);
      
      // Convert metadata to table data format
      const tableRows = metadataService.convertToTableData();
      
      // Update table with metadata
      setTableData(tableRows);
      
      // Update detected pipelines for UI
      const detectedPipelines = Array.from(new Set(
        metadataService.getScans()
          .flatMap(scan => scan.derivations)
          .map(d => d.pipelineType)
      ));
      setDetectedPipelines(detectedPipelines);
      
      // Set status message
      if (neuroimagingFiles.length > 0) {
        const pipelineInfo = detectedPipelines.length > 0
          ? ` Detected pipelines: ${detectedPipelines.join(', ')}.`
          : '';
        
        setProcessingStatus(`Processed ${neuroimagingFiles.length} files.${pipelineInfo} Metadata updated.`);
      } else {
        setProcessingStatus('No neuroimaging files found in the directory. Metadata updated from directory structure.');
      }
    } catch (error) {
      console.error('Error processing directory:', error);
      setError(`Failed to process directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setProcessingStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Render file explorer with directory structure
  const renderFileExplorer = () => {
    return (
      <div className="file-explorer">
        <div className="file-explorer-header">
          <span>FILE EXPLORER</span>
          {isFileSystemAccessSupported && (
            <button
              className="connect-button"
              onClick={handleConnectDirectory}
              title="Connect to local directory"
            >
              {rootDirectory ? 'Change' : 'Connect'}
            </button>
          )}
        </div>
        <div className="directory-tree" {...getRootProps()}>
          <input {...getInputProps()} />
          {!isFileSystemAccessSupported ? (
            <div className="api-not-supported">
              File System Access API is not supported in your browser. Please use Chrome, Edge, or another compatible browser.
            </div>
          ) : !rootDirectory ? (
            <div className="no-directory-selected">
              <p>No directory selected.</p>
              <button 
                className="select-directory-button"
                onClick={handleConnectDirectory}
              >
                Select Directory
              </button>
            </div>
          ) : isLoading ? (
            <div className="loading">Loading...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : (
            <>
              <div className="directory-item root-directory">
                <span 
                  className="expand-icon"
                  onClick={() => toggleFolderExpansion('/')}
                >
                  {expandedFolders['/'] ? '▼' : '►'}
                </span>
                <span 
                  className="item-label"
                  onClick={() => {
                    setCurrentPath('/');
                    if (rootDirectory?.handle) {
                      loadDirectoryContents(rootDirectory.handle as NeurvanaFS.FileSystemDirectoryHandle, '/');
                    }
                  }}
                >
                  {rootDirectory.name}
                </span>
              </div>
              
              {expandedFolders['/'] && renderDirectoryContents(directoryContents, 1)}
            </>
          )}
        </div>
      </div>
    );
  };

  // Render checks section with programmatic checks
  const renderChecksSection = () => {
    return (
      <div className="checks-section">
        <div className="checks-header">CHECKS</div>
        <div className="check-item">
          <button 
            className="check-button"
            onClick={processDirectory}
            disabled={!rootDirectory}
          >
            scan directory for neuroimaging
          </button>
        </div>
        
        <div className="check-item">
          <button 
            className="check-button folder-mapping-button"
            onClick={handleShowMappingDialog}
            disabled={!rootDirectory}
          >
            map folders to subjects
          </button>
        </div>
        
        <div className="check-item">
          <button 
            className="check-button"
            onClick={organizeNamingToBIDS}
            disabled={!rootDirectory || tableData.length === 0}
          >
            organize naming to BIDS
          </button>
        </div>
        <div className="check-item">
          <button 
            className="check-button"
            onClick={detectTransformSteps}
            disabled={!rootDirectory || tableData.length === 0}
          >
            detect transform steps
          </button>
        </div>
        
        {processingStatus && (
          <div className="processing-status">
            {processingStatus}
          </div>
        )}
      </div>
    );
  };

  // Render results section showing processing status
  const renderResultsSection = () => {
    return (
      <div className="results-section">
        <div className="results-header">RESULTS</div>
        <div className="results-summary">
          <div className="result-item">
            <span className="result-label">Files:</span>
            <span className="result-value">{tableData.length}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Subjects:</span>
            <span className="result-value">
              {new Set(tableData.map(row => row.sub_id)).size}
            </span>
          </div>
          <div className="result-item">
            <span className="result-label">Sessions:</span>
            <span className="result-value">
              {new Set(tableData.map(row => `${row.sub_id}_${row.session}`)).size}
            </span>
          </div>
          <div className="result-item">
            <span className="result-label">Status:</span>
            <span className="result-value">
              {tableData.some(row => row.status === 'Organized') ? 'BIDS-Compliant' : (
                 tableData.some(row => row.status === 'Analyzed') ? 'Analyzed' : 'Raw'
              )}
            </span>
          </div>
          
          {detectedPipelines.length > 0 && (
            <div className="result-item">
              <span className="result-label">Pipelines:</span>
              <span className="result-value pipeline-badges">
                {detectedPipelines.map(pipeline => (
                  <span key={pipeline} className={`pipeline-badge ${pipeline.toLowerCase()}`}>
                    {pipeline}
                  </span>
                ))}
              </span>
            </div>
          )}
        </div>
        <div className="result-actions">
          <button 
            className="result-button"
            onClick={() => setActiveTab('data')}
          >
            View Table
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="source-panel">
      <div className="source-header">Source</div>
      {renderFileExplorer()}
      {renderChecksSection()}
      {renderResultsSection()}
      
      {showMappingDialog && (
        <FolderMappingDialog
          folderStructure={folderStructure}
          onClose={() => setShowMappingDialog(false)}
          onApplyMapping={handleApplyMapping}
          detectedPipelines={detectedPipelines}
        />
      )}
    </div>
  );
};

export default SourcePanel; 