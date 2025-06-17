import { API_BASE_URL } from '../../../api/config';
import { BaseEntityType } from '../../../types';
import fetchService from '../../../services/fetchService';

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
    console.error(`API error for ${endpoint}:`, error);
    throw error;
  }
};

// Project API functions
export const getProjects = async (): Promise<BaseEntityType[]> => {
  try {
    const data = await apiRequest('/projects');
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
};

export const getProject = async (projectId: string): Promise<BaseEntityType> => {
  try {
    return await apiRequest(`/projects/${projectId}`);
  } catch (error) {
    console.error(`Error fetching project ${projectId}:`, error);
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
    console.error('Error creating project:', error);
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
    console.error(`Error updating project ${projectId}:`, error);
    throw error;
  }
};

export const deleteProject = async (projectId: string): Promise<void> => {
  try {
    return await apiRequest(`/projects/${projectId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error(`Error deleting project ${projectId}:`, error);
    throw error;
  }
};

// Project Entities API functions
export const getProjectEntities = async (projectId: string): Promise<BaseEntityType[]> => {
  try {
    
    // First try to get the project with children included
    try {
      const project = await apiRequest(`/projects/${projectId}`);
      
      // If the project has children, return them
      if (project && project.children && Array.isArray(project.children) && project.children.length > 0) {
        return project.children;
      }
    } catch (error) {
      console.error('[NeurvanaService] Error getting project with children:', error);
      // Continue to fallback approach
    }
    
    // Fallback: Get entities directly from the entities endpoint
    const data = await apiRequest(`/projects/entities?parentId=${projectId}`);
    
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error fetching entities for project ${projectId}:`, error);
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
    console.error(`Error adding file to project ${projectId}:`, error);
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
    console.error(`Error creating group in project ${projectId}:`, error);
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
    console.error('Failed to create UIView:', error);
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
    console.error('Failed to update UIView:', error);
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
    console.log('[NeurvanaService] Fetching UIView from entities endpoint');
    return await apiRequest(`/entities/${uiViewId}`);
  } catch (error) {
    console.error(`Error fetching UIView ${uiViewId}:`, error);
    throw error;
  }
};

/**
 * Delete an entity by ID
 * @param entityId ID of the entity to delete
 */
export const deleteEntity = async (entityId: string): Promise<void> => {
  try {
    console.log(`[NeurvanaService] Deleting entity ${entityId}`);
    await apiRequest(`/entities/${entityId}`, {
      method: 'DELETE',
    });
    console.log(`[NeurvanaService] Entity ${entityId} deleted successfully`);
  } catch (error) {
    console.error(`Error deleting entity ${entityId}:`, error);
    throw error;
  }
}; 