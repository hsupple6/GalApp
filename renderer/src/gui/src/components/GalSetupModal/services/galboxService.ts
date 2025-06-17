import { GalBoxEntity, GalBoxError, UIGalBox } from '../types/galbox';
import fetchService from '../../../services/fetchService';
import { API_BASE_URL } from '../../../api/config';

export class GalBoxService {
  private baseUrl = `${API_BASE_URL}/galbox`;

  private getAuthHeaders() {
    const authToken = localStorage.getItem('authToken');
    return {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };
  }

  async fetchGalBox(serialNumber: string): Promise<UIGalBox> {
    try {
      const galbox: GalBoxEntity = await fetchService(`${this.baseUrl}/${serialNumber}`, {
        credentials: 'include',
      });
      return this.toUIGalBox(galbox);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createGalBox(data: {
    serialNumber: string;
    name: string;
    ipAddress: string;
    username: string;
    ollamaVersion?: string;
  }): Promise<UIGalBox> {
    try {
      const galbox: GalBoxEntity = await fetchService(this.baseUrl, {
        method: 'POST',
        credentials: 'include',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          serial_number: data.serialNumber,
          name: data.name,
          ip_address: data.ipAddress,
          username: data.username,
          ollama_version: data.ollamaVersion,
          status: 'setup'
        }),
      });
      return this.toUIGalBox(galbox);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateGalBoxStatus(serialNumber: string, status: 'setup' | 'ready' | 'error'): Promise<UIGalBox> {
    try {
      const galbox: GalBoxEntity = await fetchService(`${this.baseUrl}/${serialNumber}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ status }),
      });
      return this.toUIGalBox(galbox);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateOllamaVersion(serialNumber: string, ollamaVersion: string): Promise<UIGalBox> {
    try {
      const galbox: GalBoxEntity = await fetchService(`${this.baseUrl}/${serialNumber}/ollama`, {
        method: 'PUT',
        credentials: 'include',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ ollama_version: ollamaVersion }),
      });
      return this.toUIGalBox(galbox);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async pingGalBox(serialNumber: string): Promise<boolean> {
    try {
      const response = await fetchService(`${this.baseUrl}/${serialNumber}/ping`, {
        method: 'GET',
        credentials: 'include',
        headers: this.getAuthHeaders(),
      });
      return response.online === true;
    } catch (error) {
      console.error('[GalBoxService] Error pinging GalBox:', error);
      return false;
    }
  }

  private toUIGalBox(galbox: GalBoxEntity): UIGalBox {
    return {
      id: galbox._id,
      serialNumber: galbox.serial_number,
      name: galbox.name,
      ipAddress: galbox.ip_address,
      username: galbox.username,
      ollamaVersion: galbox.ollama_version,
      created: new Date(galbox.created_at),
      updated: new Date(galbox.updated_at),
      status: galbox.status,
    };
  }

  private handleError(error: any): GalBoxError {
    if (error instanceof Response) {
      switch (error.status) {
        case 404:
          return new GalBoxError('GalBox not found', 'NOT_FOUND');
        case 403:
          return new GalBoxError('Permission denied', 'PERMISSION_DENIED');
        default:
          return new GalBoxError('Network error', 'NETWORK_ERROR');
      }
    }
    return new GalBoxError('Unknown error', 'NETWORK_ERROR', error);
  }
}

export const galboxService = new GalBoxService(); 