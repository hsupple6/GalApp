/**
 * NeuroimagingService
 * 
 * Provides utilities for detecting and categorizing neuroimaging data,
 * identifying processing pipelines, and analyzing file structures.
 */

// Define raw scan types and their common file extensions
export const RAW_SCAN_TYPES = {
  T1: ['.nii', '.nii.gz', '.dcm', 'T1.mgz', 'T1w'],
  T2: ['.nii', '.nii.gz', '.dcm', 'T2.mgz', 'T2w'],
  FLAIR: ['.nii', '.nii.gz', '.dcm', 'FLAIR'],
  BOLD: ['.nii', '.nii.gz', '.dcm', 'bold', 'func'],
  DIFFUSION: ['.nii', '.nii.gz', '.dcm', '.bvec', '.bval', 'dwi', 'dti'],
  MRS: ['.rda', '.dat', '.raw', '.SDAT', '.SPAR']
};

// Define markers for different processing pipelines
export const PIPELINE_MARKERS = {
  FREESURFER: {
    files: ['brain.mgz', 'aseg.mgz', 'aparc+aseg.mgz', 'T1.mgz', 'lh.white', 'rh.pial', 'aseg.stats'],
    directories: ['surf', 'mri', 'label', 'stats', 'scripts']
  },
  FSL: {
    files: ['filtered_func_data.nii.gz', 'design.mat', 'thresh_zstat', '.feat', 'mask.nii.gz', 'bet_'],
    prefixes: ['w', 's', 'r', 'y_']
  },
  SPM: {
    prefixes: ['w', 's', 'r', 'c', 'u', 'y_'],
    files: ['spm.mat', 'SPM.mat', '.hdr']
  },
  ANTS: {
    files: ['Warped.nii.gz', 'Affine.mat', 'Warp.nii.gz', 'InverseWarp.nii.gz'],
    prefixes: ['ants_', 'ants2_']
  },
  CONN: {
    files: ['conn_project.mat', 'ROI_Subject'],
    directories: ['results/preprocessing', 'results/firstlevel', 'results/secondlevel']
  },
  QDEC: {
    files: ['.mgh', 'effect.mgh', 'sig.mgh', 'qdecr_results'],
    directories: ['qdec', 'stats', 'qdecr']
  },
  SIMNIBS: {
    files: ['E_x.nii.gz', 'head.msh', 'normE.nii.gz', '.geo', '.msh']
  },
  MRS_PROCESSING: {
    files: ['.coord', '.lcmodel', '.gannet', '.ps', '.table', '.coord']
  }
};

// Define preprocessing steps and their markers
export const PREPROCESSING_MARKERS = {
  MOTION_CORRECTION: ['mcf', '_mc', 'mc_', 'realign', '_realign', 'realigned', 'motion'],
  SPATIAL_NORMALIZATION: ['mni', 'norm', 'warped', 'std', 'template', 'normalized'],
  SMOOTHING: ['smooth', 'fwhm', 'kernel', 'blur', 'gaus'],
  SKULL_STRIPPING: ['brain_', '_brain', 'skull', 'strip', 'bet_', '_bet', 'skullstrip'],
  SEGMENTATION: ['seg', 'segment', 'tissue', 'gm_', 'wm_', 'csf_', 'gray', 'white'],
  FIELD_MAP_CORRECTION: ['fmap', 'fieldmap', 'unwarp', 'topup', 'distort'],
  SLICE_TIMING: ['slice', 'timing', 'st_', '_st']
};

// Define postprocessing steps and their markers
export const POSTPROCESSING_MARKERS = {
  FILTERING: ['filt', 'filter', 'bandpass', 'highpass', 'lowpass', 'freq'],
  GLM_ANALYSIS: ['glm', 'stats', 'contrast', 'tstat', 'zstat', 'beta', 'cope'],
  ICA: ['ica', 'independent', 'component', 'melodic', 'decomp'],
  CONNECTIVITY: ['conn', 'connect', 'corr', 'network', 'graph', 'fc_', '_fc']
};

/**
 * Analyzes a set of files and paths to detect neuroimaging data and processing steps
 */
export interface FileDetails {
  path: string;
  name: string;
  type?: string;
  extension?: string;
  isDirectory?: boolean;
}

export interface DetectionResult {
  fileType: string;
  pre: number;
  post: number;
  pipelines: string[];
  processing_steps: string[];
}

export interface DerivativeOutput {
  type: string;
  path: string;
  subjectId?: string;
  sessionId?: string;
  hasSourceScan: boolean;
  sourceScanPath?: string;
}

/**
 * Detects the source type of a neuroimaging file
 */
export function detectSourceType(file: FileDetails): string {
  const fileName = file.name.toLowerCase();
  const filePath = file.path.toLowerCase();
  
  // Check for known raw scan types
  for (const [scanType, markers] of Object.entries(RAW_SCAN_TYPES)) {
    for (const marker of markers) {
      if (fileName.includes(marker.toLowerCase()) || filePath.includes(marker.toLowerCase())) {
        return scanType;
      }
    }
  }
  
  // Default to 'unknown' if no match found
  return 'unknown';
}

/**
 * Detects preprocessing steps applied to a neuroimaging file
 */
export function detectProcessingSteps(files: FileDetails[]): DetectionResult {
  let pre = 0;
  let post = 0;
  const pipelines: Set<string> = new Set();
  const steps: Set<string> = new Set();
  let fileType = 'unknown';
  
  // Check paths and filenames for processing indicators
  files.forEach(file => {
    const fileName = file.name.toLowerCase();
    const filePath = file.path.toLowerCase();
    const combinedText = `${fileName} ${filePath}`;
    
    // Detect file type if unknown
    if (fileType === 'unknown') {
      fileType = detectSourceType(file);
    }
    
    // Check for pipeline markers
    for (const [pipeline, markers] of Object.entries(PIPELINE_MARKERS)) {
      const { files: pipelineFiles = [], directories = [], prefixes = [] } = markers as any;
      
      // Check for matching files
      for (const pFile of pipelineFiles) {
        if (combinedText.includes(pFile.toLowerCase())) {
          pipelines.add(pipeline);
          break;
        }
      }
      
      // Check for matching directories
      for (const dir of directories) {
        if (filePath.includes(dir.toLowerCase())) {
          pipelines.add(pipeline);
          break;
        }
      }
      
      // Check for matching prefixes
      for (const prefix of prefixes) {
        if (fileName.startsWith(prefix.toLowerCase())) {
          pipelines.add(pipeline);
          break;
        }
      }
    }
    
    // Check for preprocessing steps
    for (const [step, markers] of Object.entries(PREPROCESSING_MARKERS)) {
      for (const marker of markers) {
        if (combinedText.includes(marker.toLowerCase())) {
          steps.add(step.replace(/_/g, ' '));
          pre = 1;
          break;
        }
      }
    }
    
    // Check for postprocessing steps
    for (const [step, markers] of Object.entries(POSTPROCESSING_MARKERS)) {
      for (const marker of markers) {
        if (combinedText.includes(marker.toLowerCase())) {
          steps.add(step.replace(/_/g, ' '));
          post = 1;
          break;
        }
      }
    }
  });
  
  return {
    fileType,
    pre,
    post,
    pipelines: Array.from(pipelines),
    processing_steps: Array.from(steps)
  };
}

/**
 * Analyzes a directory structure to detect FreeSurfer output
 */
export function detectFreeSurferOutput(files: FileDetails[]): boolean {
  // Count how many FreeSurfer marker directories we find
  const fsDirs = new Set<string>();
  
  // FreeSurfer has a specific directory structure
  for (const file of files) {
    const path = file.path.toLowerCase();
    
    // Check for standard FreeSurfer directories
    for (const dir of PIPELINE_MARKERS.FREESURFER.directories) {
      if (path.includes(`/${dir}/`) || path.endsWith(`/${dir}`)) {
        fsDirs.add(dir);
      }
    }
    
    // Also check for key FreeSurfer files
    for (const fsFile of PIPELINE_MARKERS.FREESURFER.files) {
      if (file.name.toLowerCase() === fsFile.toLowerCase() || 
          file.path.toLowerCase().endsWith(`/${fsFile.toLowerCase()}`)) {
        return true;
      }
    }
  }
  
  // If we found at least 2 of the standard FreeSurfer directories, it's likely FreeSurfer data
  return fsDirs.size >= 2;
}

/**
 * Creates a summary of the detected neuroimaging data
 */
export function createSummary(files: FileDetails[]): {
  sourceFiles: number;
  derivedFiles: number;
  pipelines: string[];
  preprocessing: string[];
  postprocessing: string[];
} {
  const result = detectProcessingSteps(files);
  const isFreeSurfer = detectFreeSurferOutput(files);
  
  // Add FreeSurfer to pipelines if detected but not already included
  if (isFreeSurfer && !result.pipelines.includes('FREESURFER')) {
    result.pipelines.push('FREESURFER');
  }
  
  // Count source and derived files
  let sourceFiles = 0;
  let derivedFiles = 0;
  
  files.forEach(file => {
    // Check if file is likely a derived file
    const isDerived = result.pipelines.some(pipeline => {
      const markers = PIPELINE_MARKERS[pipeline as keyof typeof PIPELINE_MARKERS];
      if (!markers) return false;
      
      const { files: pipelineFiles = [], prefixes = [] } = markers as any;
      
      // Check if filename matches any known derivative file
      for (const pFile of pipelineFiles) {
        if (file.name.toLowerCase() === pFile.toLowerCase() || 
            file.path.toLowerCase().endsWith(`/${pFile.toLowerCase()}`)) {
          return true;
        }
      }
      
      // Check if filename starts with any known derivative prefix
      for (const prefix of prefixes || []) {
        if (file.name.toLowerCase().startsWith(prefix.toLowerCase())) {
          return true;
        }
      }
      
      return false;
    });
    
    // Count as source or derived
    if (isDerived) {
      derivedFiles++;
    } else {
      // Check if it's a raw neuroimaging file
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (fileExtension && 
          ['nii', 'gz', 'dcm', 'mgz', 'mgh', 'bvec', 'bval'].includes(fileExtension)) {
        sourceFiles++;
      }
    }
  });
  
  return {
    sourceFiles,
    derivedFiles,
    pipelines: result.pipelines,
    preprocessing: result.processing_steps.filter(() => result.pre === 1),
    postprocessing: result.processing_steps.filter(() => result.post === 1)
  };
}

/**
 * Enhanced detection of transformation steps for individual files
 */
export function detectTransformSteps(filePath: string): {
  pre: number;
  post: number;
  steps: string[];
  status: string;
} {
  const path = filePath.toLowerCase();
  const parts = path.split('/');
  const fileName = parts[parts.length - 1];
  
  let pre = 0;
  let post = 0;
  const steps: string[] = [];
  
  // Check for preprocessing steps
  for (const [step, markers] of Object.entries(PREPROCESSING_MARKERS)) {
    for (const marker of markers) {
      if (path.includes(marker.toLowerCase())) {
        if (!steps.includes(step.replace(/_/g, ' '))) {
          steps.push(step.replace(/_/g, ' '));
          pre = 1;
        }
        break;
      }
    }
  }
  
  // Check for postprocessing steps
  for (const [step, markers] of Object.entries(POSTPROCESSING_MARKERS)) {
    for (const marker of markers) {
      if (path.includes(marker.toLowerCase())) {
        if (!steps.includes(step.replace(/_/g, ' '))) {
          steps.push(step.replace(/_/g, ' '));
          post = 1;
        }
        break;
      }
    }
  }
  
  // Check for pipeline-specific prefixes and transformations
  for (const [pipeline, markers] of Object.entries(PIPELINE_MARKERS)) {
    const { prefixes = [] } = markers as any;
    
    // Check for file prefixes that indicate processing
    for (const prefix of prefixes) {
      if (fileName.startsWith(prefix.toLowerCase())) {
        // Add pipeline-specific step 
        const pipelineStep = `${pipeline} ${prefix.replace(/[_]/g, '')}`;
        if (!steps.includes(pipelineStep)) {
          steps.push(pipelineStep);
          pre = 1; // Most prefixed files are preprocessed
        }
        break;
      }
    }
    
    // Check for FreeSurfer specific transformations (special case)
    if (pipeline === 'FREESURFER') {
      if (path.includes('/mri/') && 
          (fileName.includes('nu.mgz') || fileName.includes('norm.mgz'))) {
        steps.push('FreeSurfer bias correction');
        pre = 1;
      }
      if (path.includes('/surf/') && 
          (fileName.startsWith('lh.') || fileName.startsWith('rh.'))) {
        steps.push('FreeSurfer surface reconstruction');
        pre = 1;
        post = 1; // Surface reconstruction is both pre and post
      }
    }
  }
  
  // Determine status based on processing steps
  let status = 'Raw';
  if (steps.length > 0) {
    status = 'Processed';
    
    // Check for FreeSurfer outputs specifically
    if (path.includes('/surf/') || 
        path.includes('/label/') || 
        path.includes('/stats/') ||
        ['aseg.mgz', 'brain.mgz', 'aparc+aseg.mgz'].some(f => fileName.includes(f))) {
      status = 'Analyzed';
    }
  }
  
  return { pre, post, steps, status };
}

/**
 * Parses subject ID from folder name using common patterns
 */
export function parseSubjectIdFromName(name: string): string | null {
  // Check for BIDS-style sub-XXX
  const bidsMatch = name.match(/^sub[-_]?(\d+)/i);
  if (bidsMatch) return bidsMatch[1];
  
  // Check for subject, S, or R followed by numbers
  const subjectMatch = name.match(/^(?:subject[-_]?|[sbrSBR])(\d+)/i);
  if (subjectMatch) return subjectMatch[1];
  
  // Check for common FreeSurfer naming patterns (e.g., B009)
  const fsMatch = name.match(/^([a-zA-Z])(\d+)/);
  if (fsMatch) return fsMatch[2]; // Return just the number part
  
  // If the string is just a number with potential leading zeros
  const numericMatch = name.match(/^0*(\d+)$/);
  if (numericMatch) return numericMatch[1];
  
  // No recognized pattern
  return null;
}

/**
 * Checks if a folder likely contains FreeSurfer output
 */
export function isFolderFreeSurferOutput(folderPath: string, folderName: string, children?: any[]): boolean {
  // Check if folder name follows a FreeSurfer subject name pattern
  const isFreeSurferNaming = Boolean(
    folderName.match(/^sub-\d+$/) || // BIDS style
    folderName.match(/^[sbrSBR]\d+$/) || // e.g., B009, R123
    folderName.match(/^[a-zA-Z]\d{3,}$/) // Letter followed by 3+ digits
  );
  
  // Check if folder contains FreeSurfer subdirectories
  const hasFreeSurferStructure = Boolean(
    children && children.some(child => 
      ['mri', 'surf', 'label', 'stats'].includes(child.name.toLowerCase())
    )
  );
  
  return isFreeSurferNaming || hasFreeSurferStructure;
}

/**
 * Find FreeSurfer outputs in a flattened file list
 */
export function findFreeSurferOutputs(files: FileDetails[]): DerivativeOutput[] {
  const outputs: DerivativeOutput[] = [];
  const fsDirectories = new Set<string>();
  
  // First, identify potential FreeSurfer directories
  for (const file of files) {
    const path = file.path.toLowerCase();
    const parts = path.split('/');
    
    // Check if this file is in a potential FreeSurfer subject directory
    // by looking for standard FreeSurfer subdirectories
    for (let i = 0; i < parts.length - 1; i++) {
      const potentialSubjectDir = parts.slice(0, i + 1).join('/');
      
      // Check if this directory contains important FreeSurfer subdirectories
      const hasSubdirs = PIPELINE_MARKERS.FREESURFER.directories.some(dir => 
        files.some(f => f.path.startsWith(`${potentialSubjectDir}/${dir}/`))
      );
      
      if (hasSubdirs) {
        fsDirectories.add(potentialSubjectDir);
      }
    }
  }
  
  // Now extract info from each FreeSurfer directory
  fsDirectories.forEach(dirPath => {
    const dirParts = dirPath.split('/');
    const dirName = dirParts[dirParts.length - 1];
    
    // Try to extract subject ID from directory name
    const subjectId = parseSubjectIdFromName(dirName) || dirName;
    
    // Check if this directory has raw source scans
    const hasMriRaw = files.some(f => 
      f.path.startsWith(`${dirPath}/`) && 
      f.path.includes('/mri/orig/') && 
      (f.path.endsWith('.mgz') || f.path.endsWith('.nii') || f.path.endsWith('.nii.gz'))
    );
    
    // Get path to potential source
    const sourcePath = hasMriRaw ? 
      files.find(f => 
        f.path.startsWith(`${dirPath}/`) && 
        f.path.includes('/mri/orig/') && 
        (f.path.endsWith('.mgz') || f.path.endsWith('.nii') || f.path.endsWith('.nii.gz'))
      )?.path : undefined;
    
    outputs.push({
      type: 'FREESURFER',
      path: dirPath,
      subjectId,
      sessionId: '1', // Default session ID
      hasSourceScan: hasMriRaw,
      sourceScanPath: sourcePath
    });
  });
  
  return outputs;
}

/**
 * Convert a folder structure to a flattened list of files with appropriate types
 */
export function convertFolderToFileDetailsList(folderStructure: any[]): FileDetails[] {
  const result: FileDetails[] = [];
  
  const processItem = (item: any, parentPath: string = '') => {
    const fullPath = parentPath ? `${parentPath}/${item.name}` : item.name;
    
    result.push({
      path: fullPath,
      name: item.name,
      isDirectory: item.type === 'folder',
      extension: item.name.includes('.') ? item.name.split('.').pop()?.toLowerCase() : undefined
    });
    
    // Process children recursively
    if (item.children && item.children.length > 0) {
      item.children.forEach((child: any) => processItem(child, fullPath));
    }
  };
  
  folderStructure.forEach(item => processItem(item));
  
  return result;
}

/**
 * Generate missing subject information based on directory structure and derivatives
 * This is useful for cases where we have derivatives but no source scans
 */
export function generateSubjectInfo(folderStructure: any[]): {
  subjects: {id: string, name: string, path: string}[];
  sessions: {subjectId: string, sessionId: string, path: string}[];
  derivatives: DerivativeOutput[];
} {
  // Convert folder structure to flat file list
  const files = convertFolderToFileDetailsList(folderStructure);
  
  // Find FreeSurfer and other derivatives
  const freesurferOutputs = findFreeSurferOutputs(files);
  // TODO: Add similar functions for other pipelines (FSL, SPM, etc.)
  
  const derivatives = [...freesurferOutputs];
  
  // Extract subject information
  const subjects = derivatives.map(derivative => ({
    id: derivative.subjectId || 'unknown',
    name: derivative.subjectId || 'Unknown Subject',
    path: derivative.path
  }));
  
  // Extract session information (default to session 1 if not available)
  const sessions = derivatives.map(derivative => ({
    subjectId: derivative.subjectId || 'unknown',
    sessionId: derivative.sessionId || '1',
    path: derivative.path
  }));
  
  return {
    subjects: subjects.filter((s, i, self) => 
      self.findIndex(t => t.id === s.id) === i
    ),
    sessions: sessions.filter((s, i, self) => 
      self.findIndex(t => t.subjectId === s.subjectId && t.sessionId === s.sessionId) === i
    ),
    derivatives
  };
}

export default {
  detectSourceType,
  detectProcessingSteps,
  detectFreeSurferOutput,
  createSummary,
  detectTransformSteps,
  parseSubjectIdFromName,
  findFreeSurferOutputs,
  convertFolderToFileDetailsList,
  generateSubjectInfo,
  isFolderFreeSurferOutput
}; 