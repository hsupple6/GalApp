/**
 * MetadataService
 * 
 * Provides a structured layer for managing neuroimaging metadata,
 * separating the filesystem structure from the semantic meaning.
 */

// Define core interfaces
export interface Subject {
  id: string;
  name?: string;
  metadata?: Record<string, any>;
  scans: Scan[];
}

export interface Scan {
  id: string;
  subjectId: string;
  session: number;
  modality: string;
  date?: Date;
  filePath: string;
  status: 'raw' | 'processed' | 'analyzed' | 'error';
  metadata?: Record<string, any>;
  derivations: Derivation[];
}

export interface Derivation {
  id: string;
  scanId: string;
  pipelineType: string; // e.g., "FreeSurfer", "FSL", etc.
  outputPath: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  startTime?: Date;
  endTime?: Date;
  metadata?: Record<string, any>;
}

export interface MetadataStore {
  subjects: Subject[];
  lastUpdated: Date;
  version: string;
}

// Initialize empty store
let metadataStore: MetadataStore = {
  subjects: [],
  lastUpdated: new Date(),
  version: '1.0.0'
};

// Load metadata from localStorage if available
const loadMetadata = (): void => {
  try {
    const storedMetadata = localStorage.getItem('neurvanaMetadata');
    if (storedMetadata) {
      metadataStore = JSON.parse(storedMetadata);
      
      // Convert date strings back to Date objects
      metadataStore.lastUpdated = new Date(metadataStore.lastUpdated);
      metadataStore.subjects.forEach(subject => {
        subject.scans.forEach(scan => {
          if (scan.date) scan.date = new Date(scan.date);
          scan.derivations.forEach(deriv => {
            if (deriv.startTime) deriv.startTime = new Date(deriv.startTime);
            if (deriv.endTime) deriv.endTime = new Date(deriv.endTime);
          });
        });
      });
      
      console.log('Loaded metadata from local storage:', metadataStore);
    }
  } catch (error) {
    console.error('Failed to load metadata from localStorage:', error);
  }
};

// Save metadata to localStorage
const saveMetadata = (): void => {
  try {
    metadataStore.lastUpdated = new Date();
    localStorage.setItem('neurvanaMetadata', JSON.stringify(metadataStore));
  } catch (error) {
    console.error('Failed to save metadata to localStorage:', error);
  }
};

// Initialize by loading existing metadata
loadMetadata();

// CRUD operations for subjects
export const getSubjects = (): Subject[] => {
  return [...metadataStore.subjects];
};

export const getSubject = (id: string): Subject | undefined => {
  return metadataStore.subjects.find(s => s.id === id);
};

export const addSubject = (subject: Omit<Subject, 'scans'>): Subject => {
  const newSubject: Subject = {
    ...subject,
    scans: []
  };
  
  metadataStore.subjects.push(newSubject);
  saveMetadata();
  return newSubject;
};

export const updateSubject = (id: string, updates: Partial<Subject>): Subject | null => {
  const index = metadataStore.subjects.findIndex(s => s.id === id);
  if (index === -1) return null;
  
  // Don't allow overwriting scans directly - use scan methods instead
  const { scans, ...validUpdates } = updates;
  
  metadataStore.subjects[index] = {
    ...metadataStore.subjects[index],
    ...validUpdates
  };
  
  saveMetadata();
  return metadataStore.subjects[index];
};

export const removeSubject = (id: string): boolean => {
  const initialLength = metadataStore.subjects.length;
  metadataStore.subjects = metadataStore.subjects.filter(s => s.id !== id);
  
  if (metadataStore.subjects.length !== initialLength) {
    saveMetadata();
    return true;
  }
  return false;
};

// CRUD operations for scans
export const getScans = (subjectId?: string): Scan[] => {
  if (subjectId) {
    const subject = metadataStore.subjects.find(s => s.id === subjectId);
    return subject ? [...subject.scans] : [];
  } else {
    // Return all scans across all subjects
    return metadataStore.subjects.flatMap(s => s.scans);
  }
};

export const getScan = (scanId: string, subjectId?: string): Scan | undefined => {
  if (subjectId) {
    const subject = metadataStore.subjects.find(s => s.id === subjectId);
    return subject?.scans.find(scan => scan.id === scanId);
  } else {
    // Search all subjects if subjectId not provided
    for (const subject of metadataStore.subjects) {
      const scan = subject.scans.find(scan => scan.id === scanId);
      if (scan) return scan;
    }
    return undefined;
  }
};

export const addScan = (subjectId: string, scan: Omit<Scan, 'subjectId' | 'derivations'>): Scan | null => {
  const subject = metadataStore.subjects.find(s => s.id === subjectId);
  if (!subject) return null;
  
  const newScan: Scan = {
    ...scan,
    subjectId,
    derivations: []
  };
  
  subject.scans.push(newScan);
  saveMetadata();
  return newScan;
};

export const updateScan = (scanId: string, updates: Partial<Scan>): Scan | null => {
  for (const subject of metadataStore.subjects) {
    const scanIndex = subject.scans.findIndex(scan => scan.id === scanId);
    if (scanIndex !== -1) {
      // Don't allow overwriting derivations directly
      const { derivations, subjectId, ...validUpdates } = updates;
      
      subject.scans[scanIndex] = {
        ...subject.scans[scanIndex],
        ...validUpdates
      };
      
      saveMetadata();
      return subject.scans[scanIndex];
    }
  }
  return null;
};

export const removeScan = (scanId: string): boolean => {
  let removed = false;
  
  metadataStore.subjects.forEach(subject => {
    const initialLength = subject.scans.length;
    subject.scans = subject.scans.filter(scan => scan.id !== scanId);
    if (subject.scans.length !== initialLength) {
      removed = true;
    }
  });
  
  if (removed) {
    saveMetadata();
  }
  return removed;
};

// CRUD operations for derivations
export const addDerivation = (
  scanId: string, 
  derivation: Omit<Derivation, 'scanId'>
): Derivation | null => {
  for (const subject of metadataStore.subjects) {
    const scan = subject.scans.find(scan => scan.id === scanId);
    if (scan) {
      const newDerivation: Derivation = {
        ...derivation,
        scanId
      };
      
      scan.derivations.push(newDerivation);
      saveMetadata();
      return newDerivation;
    }
  }
  return null;
};

export const updateDerivation = (
  derivationId: string, 
  updates: Partial<Derivation>
): Derivation | null => {
  for (const subject of metadataStore.subjects) {
    for (const scan of subject.scans) {
      const derivIndex = scan.derivations.findIndex(d => d.id === derivationId);
      if (derivIndex !== -1) {
        // Don't allow changing the scanId
        const { scanId, ...validUpdates } = updates;
        
        scan.derivations[derivIndex] = {
          ...scan.derivations[derivIndex],
          ...validUpdates
        };
        
        saveMetadata();
        return scan.derivations[derivIndex];
      }
    }
  }
  return null;
};

export const removeDerivation = (derivationId: string): boolean => {
  let removed = false;
  
  metadataStore.subjects.forEach(subject => {
    subject.scans.forEach(scan => {
      const initialLength = scan.derivations.length;
      scan.derivations = scan.derivations.filter(d => d.id !== derivationId);
      if (scan.derivations.length !== initialLength) {
        removed = true;
      }
    });
  });
  
  if (removed) {
    saveMetadata();
  }
  return removed;
};

// Export a method to clear all metadata
export const clearMetadata = (): void => {
  metadataStore = {
    subjects: [],
    lastUpdated: new Date(),
    version: metadataStore.version
  };
  saveMetadata();
};

// Sync filesystem info with metadata
export const syncFromFileSystem = (fileSystemItems: {
  isDirectory: boolean;
  path: string;
  name: string;
  type?: string;
}[]): void => {
  // This function would parse the filesystem items and update the metadata accordingly
  // For now, we'll implement a simplified version
  
  // Extract potential subject IDs and scan info from paths
  // This would be replaced with more sophisticated parsing in a real application
  
  // Group items by potential subject ID
  const groupedBySubject: Record<string, any[]> = {};
  
  fileSystemItems.forEach(item => {
    if (item.isDirectory) {
      // Try to extract subject ID from directory name
      const subjectMatch = item.name.match(/^(sub[-_]?(\d+)|[sS](\d+)|[bB](\d+)|[rR](\d+)|subject[-_]?(\d+))/);
      if (subjectMatch) {
        const subjectId = subjectMatch[2] || subjectMatch[3] || subjectMatch[4] || subjectMatch[5] || subjectMatch[6];
        if (!groupedBySubject[subjectId]) {
          groupedBySubject[subjectId] = [];
        }
        groupedBySubject[subjectId].push(item);
      }
    } else if (!item.isDirectory && item.type === 'neuroimaging') {
      // Check if this file belongs to a subject based on path
      const pathParts = item.path.split('/');
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        const subjectMatch = part.match(/^(sub[-_]?(\d+)|[sS](\d+)|[bB](\d+)|[rR](\d+)|subject[-_]?(\d+))/);
        if (subjectMatch) {
          const subjectId = subjectMatch[2] || subjectMatch[3] || subjectMatch[4] || subjectMatch[5] || subjectMatch[6];
          if (!groupedBySubject[subjectId]) {
            groupedBySubject[subjectId] = [];
          }
          groupedBySubject[subjectId].push(item);
          break;
        }
      }
    }
  });
  
  // First, collect all the paths we have in our new data
  const newFilePaths = new Set<string>();
  const newDirectoryPaths = new Set<string>();
  
  fileSystemItems.forEach(item => {
    if (item.isDirectory) {
      newDirectoryPaths.add(item.path);
    } else {
      newFilePaths.add(item.path);
    }
  });
  
  // Then clean up any scans that no longer exist in the filesystem
  metadataStore.subjects.forEach(subject => {
    // Keep only scans whose files still exist
    subject.scans = subject.scans.filter(scan => {
      // Keep virtual scans that were created for derivatives
      if (scan.filePath.includes('virtual')) {
        // Filter the derivations to keep only those that still exist
        scan.derivations = scan.derivations.filter(deriv => 
          newDirectoryPaths.has(deriv.outputPath)
        );
        
        // If this virtual scan has no remaining derivations, remove it
        return scan.derivations.length > 0;
      }
      
      // For non-virtual scans, check if the file still exists
      return newFilePaths.has(scan.filePath);
    });
  });
  
  // Also remove any empty subjects
  metadataStore.subjects = metadataStore.subjects.filter(subject => 
    subject.scans.length > 0
  );
  
  // Now process grouped items into metadata, avoiding duplicates
  Object.entries(groupedBySubject).forEach(([subjectId, items]) => {
    // Create or update subject
    let subject = getSubject(subjectId);
    if (!subject) {
      subject = addSubject({
        id: subjectId,
        name: `Subject ${subjectId}`
      });
    }
    
    // Process files within this subject
    items.forEach(item => {
      if (!item.isDirectory && item.type === 'neuroimaging') {
        // Check if scan already exists by file path
        const scanExists = subject!.scans.some(scan => scan.filePath === item.path);
        
        if (!scanExists) {
          // Determine modality from filename or path
          let modality = 'unknown';
          if (item.path.toLowerCase().includes('t1')) {
            modality = 'T1';
          } else if (item.path.toLowerCase().includes('t2')) {
            modality = 'T2';
          } else if (item.path.toLowerCase().includes('bold') || item.path.toLowerCase().includes('func')) {
            modality = 'BOLD';
          }
          
          // Add new scan
          addScan(subject!.id, {
            id: `${subject!.id}_${Date.now()}`,
            session: 1, // Default session
            modality,
            filePath: item.path,
            status: 'raw'
          });
        }
      }
    });
  });
  
  // Look for FreeSurfer derivatives
  fileSystemItems.forEach(item => {
    if (item.isDirectory) {
      // Check for FreeSurfer structure (mri, surf, etc. subdirectories)
      const fsSubdirs = fileSystemItems.filter(subItem => 
        subItem.isDirectory && 
        subItem.path.startsWith(item.path) && 
        ['mri', 'surf', 'label', 'stats'].includes(subItem.name)
      );
      
      if (fsSubdirs.length >= 2) {
        // This is likely a FreeSurfer output directory
        // Try to determine which subject it belongs to
        let subjectId = '';
        
        // Try to extract from directory name
        const subjectMatch = item.name.match(/^(sub[-_]?(\d+)|[sS](\d+)|[bB](\d+)|[rR](\d+)|subject[-_]?(\d+))/);
        if (subjectMatch) {
          subjectId = subjectMatch[2] || subjectMatch[3] || subjectMatch[4] || subjectMatch[5] || subjectMatch[6];
        }
        
        if (subjectId) {
          // Find or create subject
          let subject = getSubject(subjectId);
          if (!subject) {
            subject = addSubject({
              id: subjectId,
              name: `Subject ${subjectId}`
            });
          }
          
          // Create a virtual scan if none exists
          let targetScan = subject.scans.find(scan => scan.modality === 'T1');
          if (!targetScan) {
            // Create a new virtual scan
            const newScan = addScan(subject.id, {
              id: `${subject.id}_virtual_${Date.now()}`,
              session: 1,
              modality: 'T1',
              filePath: `${item.path}/mri/orig.mgz`, // Likely location
              status: 'processed'
            });
            
            // Only proceed if scan creation was successful
            if (newScan) {
              // Add FreeSurfer derivation
              addDerivation(newScan.id, {
                id: `freesurfer_${Date.now()}`,
                pipelineType: 'FreeSurfer',
                outputPath: item.path,
                status: 'complete'
              });
              
              // Update scan status
              updateScan(newScan.id, { status: 'analyzed' });
            }
          } else {
            // Scan already exists, check if derivation exists
            const fsDerivExists = targetScan.derivations.some(d => 
              d.pipelineType === 'FreeSurfer' && d.outputPath === item.path
            );
            
            if (!fsDerivExists) {
              addDerivation(targetScan.id, {
                id: `freesurfer_${Date.now()}`,
                pipelineType: 'FreeSurfer',
                outputPath: item.path,
                status: 'complete'
              });
              
              // Update scan status
              updateScan(targetScan.id, { status: 'analyzed' });
            }
          }
        }
      }
    }
  });
  
  saveMetadata();
};

// Helper to convert metadata to DataTable format
export const convertToTableData = () => {
  return getScans().map(scan => {
    const subject = getSubject(scan.subjectId)!;
    
    // Count number of derivations
    const freesurferDeriv = scan.derivations.find(d => d.pipelineType === 'FreeSurfer');
    const fslDeriv = scan.derivations.find(d => d.pipelineType === 'FSL');
    
    return {
      name: subject.name || `Subject ${subject.id}`,
      sub_id: parseInt(subject.id) || 0,
      session: scan.session,
      type: scan.modality,
      scan: scan.filePath.split('/').pop() || '',
      file_source: scan.filePath,
      pre: freesurferDeriv || fslDeriv ? 1 : 0,
      post: freesurferDeriv || fslDeriv ? 1 : 0,
      active: 1,
      status: scan.status,
      processing_steps: scan.derivations.map(d => d.pipelineType).join(', ')
    };
  });
};

// Export a service object
export default {
  getSubjects,
  getSubject,
  addSubject,
  updateSubject,
  removeSubject,
  getScans,
  getScan,
  addScan,
  updateScan,
  removeScan,
  addDerivation,
  updateDerivation,
  removeDerivation,
  clearMetadata,
  syncFromFileSystem,
  convertToTableData
}; 