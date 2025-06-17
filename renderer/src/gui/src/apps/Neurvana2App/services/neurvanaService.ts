import { API_BASE_URL } from '../../../api/config';
import { BaseEntityType } from '../../../types';
import fetchService from '../../../services/fetchService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../utils/logger';

// Get auth token from localStorage
const getAuthToken = () => localStorage.getItem('authToken');

// Helper for API requests
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const authToken = getAuthToken();
  const method = options.method || 'GET';
  
  // Only include Content-Type for requests that have a body and are not FormData
  const hasBody = options.body && method !== 'GET' && method !== 'HEAD';
  const isFormData = options.body instanceof FormData;
  
  const headers: HeadersInit = {
    // Only add Content-Type for JSON bodies, not FormData
    ...(hasBody && !isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...options.headers,
  };

  try {
    return await fetchService(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // Include credentials for CORS
    });
  } catch (error) {
    logger.error(`API error for ${endpoint}:`, error);
    throw error;
  }
};

// Project API functions
export const getProjects = async (): Promise<BaseEntityType[]> => {
  try {
    const data = await apiRequest('/projects');
    return Array.isArray(data) ? data : [];
  } catch (error) {
    logger.error('Error fetching projects:', error);
    return [];
  }
};

export const getProject = async (projectId: string): Promise<BaseEntityType> => {
  try {
    return await apiRequest(`/projects/${projectId}`);
  } catch (error) {
    logger.error(`Error fetching project ${projectId}:`, error);
    throw error;
  }
};

export const createProject = async (name: string): Promise<BaseEntityType> => {
  try {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('entityType', 'Project');
    
    return await apiRequest('/projects/create', {
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    logger.error('Error creating project:', error);
    throw error;
  }
};

export const updateProject = async (projectId: string, data: Partial<BaseEntityType>): Promise<BaseEntityType> => {
  try {
    return await apiRequest(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  } catch (error) {
    logger.error(`Error updating project ${projectId}:`, error);
    throw error;
  }
};

export const deleteProject = async (projectId: string): Promise<void> => {
  try {
    return await apiRequest(`/projects/${projectId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    logger.error(`Error deleting project ${projectId}:`, error);
    throw error;
  }
};

// Project Entities API functions
export const getProjectEntities = async (projectId: string): Promise<BaseEntityType[]> => {
  try {
    logger.log(`[NeurvanaService] Getting entities for project ${projectId}`);
    
    // First try to get the project with children included
    try {
      const project = await apiRequest(`/projects/${projectId}`);
      logger.log('[NeurvanaService] Project data:', project);
      
      // If the project has children, return them
      if (project && project.children && Array.isArray(project.children) && project.children.length > 0) {
        logger.log('[NeurvanaService] Using children from project response:', project.children);
        return project.children;
      }
    } catch (error) {
      logger.error('[NeurvanaService] Error getting project with children:', error);
      // Continue to fallback approach
    }
    
    // Fallback: Get entities directly from the entities endpoint
    logger.log(`[NeurvanaService] Fetching entities with parentId=${projectId}`);
    const data = await apiRequest(`/projects/entities?parentId=${projectId}`);
    logger.log('[NeurvanaService] Entities endpoint response:', data);
    
    return Array.isArray(data) ? data : [];
  } catch (error) {
    logger.error(`Error fetching entities for project ${projectId}:`, error);
    return [];
  }
};

// File upload functions
export const addFileToProject = async (file: File, projectId: string): Promise<BaseEntityType> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', 'File');
    
    return await apiRequest(`/projects/files?parentId=${projectId}`, {
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    logger.error(`Error adding file to project ${projectId}:`, error);
    throw error;
  }
};

// Group/folder creation functions
export const createGroup = async (
  folderName: string, 
  projectId: string, 
  childEntities: string[] = []
): Promise<BaseEntityType> => {
  try {
    const formData = new FormData();
    formData.append('folderName', folderName);
    formData.append('childEntities', JSON.stringify(childEntities));
    formData.append('entityType', 'Group');
    
    return await apiRequest(`/projects/groups?parentId=${projectId}`, {
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    logger.error(`Error creating group in project ${projectId}:`, error);
    throw error;
  }
};

// Utility functions to help with URL and localStorage
export const getProjectIdFromUrlOrStorage = (): string | null => {
  // First check URL if we're in a browser environment
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const urlProjectId = urlParams.get('projectId');
    
    if (urlProjectId) {
      return urlProjectId;
    }
    
    // If not in URL, try localStorage
    const savedProjectId = localStorage.getItem('lastOpenProjectId');
    if (savedProjectId) {
      return savedProjectId;
    }
  }
  
  return null;
};

export const saveProjectIdToUrlAndStorage = (projectId: string | null): void => {
  if (projectId && typeof window !== 'undefined') {
    // Update URL without page reload
    const url = new URL(window.location.href);
    url.searchParams.set('projectId', projectId);
    window.history.pushState({}, '', url.toString());
    
    // Also save to localStorage as a backup
    localStorage.setItem('lastOpenProjectId', projectId);
  }
};

// UIView API functions
/**
 * Create a new UIView entity
 * @param name Name of the UIView
 * @param url URL to load in the iframe (optional if htmlContent is provided)
 * @param parentId Optional parent ID (project or group)
 * @param config Optional configuration options
 * @param htmlContent Optional HTML content to store directly in the entity
 */
export const createUIView = async (
  name: string,
  url?: string,
  parentId?: string,
  config: Record<string, any> = {},
  htmlContent?: string
): Promise<BaseEntityType> => {
  try {
    const formData = new FormData();
    formData.append('name', name);
    if (url) formData.append('url', url);
    if (htmlContent) formData.append('htmlContent', htmlContent);
    formData.append('config', JSON.stringify(config));

    const endpoint = `/projects/uiviews${parentId ? `?parentId=${parentId}` : ''}`;
    return await apiRequest(endpoint, {
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    logger.error('Failed to create UIView:', error);
    throw error;
  }
};

/**
 * Update an existing UIView entity
 * @param uiViewId ID of the UIView to update
 * @param updates Fields to update (name, url, htmlContent, config)
 */
export const updateUIView = async (
  uiViewId: string,
  updates: { name?: string; url?: string; htmlContent?: string; config?: Record<string, any> }
): Promise<BaseEntityType> => {
  try {
    const formData = new FormData();
    if (updates.name) formData.append('name', updates.name);
    if (updates.url) formData.append('url', updates.url);
    if (updates.htmlContent) formData.append('htmlContent', updates.htmlContent);
    if (updates.config) formData.append('config', JSON.stringify(updates.config));

    const endpoint = `/projects/uiviews/${uiViewId}`;
    return await apiRequest(endpoint, {
      method: 'PUT',
      body: formData,
    });
  } catch (error) {
    logger.error('Failed to update UIView:', error);
    throw error;
  }
};

/**
 * Get a specific UIView by ID
 * @param uiViewId ID of the UIView to retrieve
 */
export const getUIView = async (uiViewId: string): Promise<BaseEntityType> => {
  try {
    // Use the general entities endpoint which we know works
    logger.log('[NeurvanaService] Fetching UIView from entities endpoint');
    return await apiRequest(`/entities/${uiViewId}`);
  } catch (error) {
    logger.error(`Error fetching UIView ${uiViewId}:`, error);
    throw error;
  }
};

/**
 * Delete an entity by ID
 * @param entityId ID of the entity to delete
 */
export const deleteEntity = async (entityId: string): Promise<void> => {
  try {
    logger.log(`[NeurvanaService] Deleting entity ${entityId}`);
    await apiRequest(`/entities/${entityId}`, {
      method: 'DELETE',
    });
    logger.log(`[NeurvanaService] Entity ${entityId} deleted successfully`);
  } catch (error) {
    logger.error(`Error deleting entity ${entityId}:`, error);
    throw error;
  }
};

// Simple in-memory storage for demo purposes
const memoryStorage: Record<string, any> = {};

// Define neuroimaging file types
export const neuroimagingFileTypes = [
  'nii', 'nii.gz', 'dcm', 'mgh', 'mgz', 'edf', 'bdf', 'set', 'fif'
];

// Create a session
export const createSession = async (
  name: string,
  description?: string
): Promise<any> => {
  const sessionId = uuidv4();
  
  const session = {
    _id: sessionId,
    name,
    description,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    files: []
  };
  
  memoryStorage[sessionId] = session;
  return session;
};

// Add file to session
export const addFileToSession = async (
  file: File,
  sessionId: string
): Promise<any> => {
  const session = memoryStorage[sessionId];
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  
  const fileId = uuidv4();
  const fileEntity = {
    _id: fileId,
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: new Date(file.lastModified).toISOString(),
    sessionId
  };
  
  session.files.push(fileEntity);
  memoryStorage[fileId] = fileEntity;
  
  return fileEntity;
};

// Get session details
export const getSession = async (sessionId: string): Promise<any> => {
  const session = memoryStorage[sessionId];
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  
  return session;
};

// Get session files
export const getSessionFiles = async (sessionId: string): Promise<any[]> => {
  const session = memoryStorage[sessionId];
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  
  return session.files || [];
};

// Check if a file is a neuroimaging file
export const isNeuroimagingFile = (fileName: string): boolean => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  return neuroimagingFileTypes.includes(extension);
};

// Parse BIDS format file name
export const parseBIDSFileName = (fileName: string): Record<string, string> => {
  const result: Record<string, string> = {};
  
  if (!fileName) return result;
  
  // Remove extension
  const nameWithoutExtension = fileName.replace(/\.(nii|nii\.gz|dcm|mgh|mgz|edf|bdf|set|fif)$/, '');
  
  // Split by underscores
  const parts = nameWithoutExtension.split('_');
  
  // Parse each part
  parts.forEach(part => {
    const [key, value] = part.split('-');
    if (key && value) {
      result[key] = value;
    }
  });
  
  return result;
};

// Convert to BIDS format file name
export const convertToBIDSFormat = (
  subject: string | number,
  session: string | number,
  task?: string,
  run?: string | number,
  modality: string = 'func'
): string => {
  // Format subject ID
  const subStr = `sub-${String(subject).padStart(3, '0')}`;
  
  // Format session ID
  const sesStr = `ses-${String(session).padStart(2, '0')}`;
  
  // Format task if provided
  const taskStr = task ? `_task-${task}` : '';
  
  // Format run if provided
  const runStr = run ? `_run-${String(run).padStart(2, '0')}` : '';
  
  // Build the filename
  return `${subStr}_${sesStr}${taskStr}${runStr}_${modality}.nii.gz`;
};

// Detect preprocessing steps from filename
export const detectPreprocessingSteps = (fileName: string): string[] => {
  const steps: string[] = [];
  const lowerFileName = fileName.toLowerCase();
  
  // Common preprocessing prefixes and indicators
  const preprocessingIndicators = [
    { pattern: /^w/, name: 'warped' },
    { pattern: /^r/, name: 'realigned' },
    { pattern: /^sw/, name: 'smoothed warped' },
    { pattern: /^sr/, name: 'smoothed realigned' },
    { pattern: /norm/, name: 'normalized' },
    { pattern: /reg/, name: 'registered' },
    { pattern: /smooth/, name: 'smoothed' },
    { pattern: /filt/, name: 'filtered' },
    { pattern: /corr/, name: 'motion corrected' },
    { pattern: /slice/, name: 'slice timed' }
  ];
  
  // Check for each indicator
  preprocessingIndicators.forEach(indicator => {
    if (indicator.pattern.test(lowerFileName)) {
      steps.push(indicator.name);
    }
  });
  
  return steps;
};

export default {
  createSession,
  addFileToSession,
  getSession,
  getSessionFiles,
  getUIView,
  isNeuroimagingFile,
  parseBIDSFileName,
  convertToBIDSFormat,
  detectPreprocessingSteps
}; 