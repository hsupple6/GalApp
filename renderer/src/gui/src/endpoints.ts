import { API_BASE_URL } from './api/config';

export const FILES_ENDPOINTS = {
  list: (parentEntityId?: string) =>
    parentEntityId ? `${API_BASE_URL}/files/list?parentId=${parentEntityId}` : `${API_BASE_URL}/files/list`,
  add: (parentEntityId: string = '-') => `${API_BASE_URL}/files/add`,
  read: (entityId: string, parentEntityId: string = '-') => {
    const authToken = localStorage.getItem('authToken') || '';
    return `${API_BASE_URL}/files/read/${entityId}?token=${authToken}`;
  },
  update: (entityId: string, parentEntityId: string = '-') =>
    `${API_BASE_URL}/files/${parentEntityId}/update/${entityId}`,
  delete: (entityId: string, parentEntityId: string = '-') =>
    `${API_BASE_URL}/files/${parentEntityId}/delete/${entityId}`,
};

export const PROJECTS_ENDPOINTS = {
  list: () => `${API_BASE_URL}/projects`,
  create: () => `${API_BASE_URL}/projects/create`,
  get: (projectId: string) => `${API_BASE_URL}/projects/${projectId}`,
  update: (projectId: string) => `${API_BASE_URL}/projects/${projectId}`,
  delete: (projectId: string) => `${API_BASE_URL}/projects/${projectId}`,
  entities: (parentId?: string) => 
    parentId ? `${API_BASE_URL}/projects/entities?parentId=${parentId}` : `${API_BASE_URL}/projects/entities`,
  addFile: (parentId?: string) => 
    parentId ? `${API_BASE_URL}/projects/files?parentId=${parentId}` : `${API_BASE_URL}/projects/files`,
  createGroup: (parentId?: string) => 
    parentId ? `${API_BASE_URL}/projects/groups?parentId=${parentId}` : `${API_BASE_URL}/projects/groups`,
};

export const AI_CHAT_ENDPOINTS = {
  sendMessage: () => `${API_BASE_URL}/ai-chat/send-message`,
};

export const CLAUDE_ENDPOINTS = {
  chat: () => `${API_BASE_URL}/claude/chat`,
  chatStream: () => `${API_BASE_URL}/claude/chat/stream`,
  toolOutput: () => `${API_BASE_URL}/claude/tool-output`,
  models: () => `${API_BASE_URL}/claude/models`,
};

export const PDF_ENDPOINTS = {
  enrich: () => `${API_BASE_URL}/enrich_pdf`,
};
