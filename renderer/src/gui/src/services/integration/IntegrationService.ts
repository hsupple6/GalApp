import { Integration, IntegrationType } from '../../types/Integration';
import fetchService from '../fetchService';
import { API_BASE_URL } from '../../api/config';
import { logger } from '../../utils/logger';

export class IntegrationService {
  private static baseUrl = `${API_BASE_URL}/integrations`;

  private static getAuthHeaders() {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      throw new Error('No auth token found');
    }
    return {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };
  }

  static async getIntegrations(): Promise<Integration[]> {
    try {
      return await fetchService(this.baseUrl, {
        credentials: 'include',
      });
    } catch (error) {
      logger.error('Integration Service Error:', error);
      return []; // Return empty array instead of throwing
    }
  }

  static async createIntegration(data: {
    integrationEntities: IntegrationType[];
    name: string;
    metadata?: Record<string, any>;
  }): Promise<Integration> {
    try {
      return await fetchService(this.baseUrl, {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(data),
      });
    } catch (error) {
      logger.error('Integration Service Error:', error);
      throw error;
    }
  }

  static async updateIntegration(integrationId: string, data: Partial<Integration['skeleton']>): Promise<Integration> {
    const response = await fetch(`${this.baseUrl}/${integrationId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Integration API Error:', errorText);
      throw new Error(`Failed to update integration: ${response.status}`);
    }

    return response.json();
  }

  static async removeIntegration(integrationId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${integrationId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Integration API Error:', errorText);
      throw new Error(`Failed to remove integration: ${response.status}`);
    }
  }
}
