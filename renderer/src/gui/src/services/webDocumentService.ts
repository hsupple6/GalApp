import { BaseEntityType } from '../types';
import fetchService from './fetchService';
import { API_BASE_URL } from '../api/config';

export const webDocumentService = {
  async create(data: { url: string; title: string }): Promise<BaseEntityType> {
    return fetchService(`${API_BASE_URL}/web-documents`, {
      method: 'POST',
      body: JSON.stringify(data),
      credentials: 'include',
    });
  },

  async get(id: string): Promise<BaseEntityType> {
    return fetchService(`${API_BASE_URL}/web-documents/${id}`, {
      credentials: 'include',
    });
  },
};
