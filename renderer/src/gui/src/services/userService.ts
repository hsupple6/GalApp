import { API_BASE_URL } from '../api/config';
import fetchService from './fetchService';
import { logger } from '../utils/logger';

export interface UserProfile {
  _id: string;
  entityType: 'User';
  auth0Id: string;
  created_at: string;
  updated_at: string;
  skeleton: {
    name?: string;
    auth0?: {
      email: string;
      email_verified: boolean;
      picture?: string;
      name?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
}

export interface UserProfileUpdate {
  name?: string;
  [key: string]: any;
}

export class UserService {
  private baseUrl = `${API_BASE_URL}/user`;

  private getAuthHeaders() {
    const authToken = localStorage.getItem('authToken');
    return {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };
  }

  async getUserProfile(): Promise<UserProfile> {
    try {
      const response = await fetchService(`${this.baseUrl}/profile`, {
        credentials: 'include',
      });
      return response;
    } catch (error) {
      logger.error('[UserService] Error fetching profile:', error);
      throw error;
    }
  }

  async updateUserProfile(updates: UserProfileUpdate): Promise<UserProfile> {
    try {
      const response = await fetchService(`${this.baseUrl}/profile`, {
        method: 'PUT',
        body: JSON.stringify(updates),
        credentials: 'include',
      });
      return response;
    } catch (error) {
      logger.error('[UserService] Error updating profile:', error);
      throw error;
    }
  }

  async updatePhoneNumber(phoneNumber: string): Promise<void> {
    try {
      await fetchService(`${this.baseUrl}/update-phone`, {
        method: 'POST',
        body: JSON.stringify({ phoneNumber }),
        credentials: 'include',
      });
    } catch (error) {
      logger.error('[UserService] Error updating phone number:', error);
      throw error;
    }
  }

  async getUsage(): Promise<{
    query_count: number;
    last_reset: string;
    limit: number;
    remaining_queries: number;
    auth0_id: string;
    deploymentType: string;
  }> {
    try {
      const response = await fetchService(`${this.baseUrl}/usage`, {
        credentials: 'include',
      });
      return response;
    } catch (error) {
      logger.error('[UserService] Error fetching usage:', error);
      throw error;
    }
  }

  async getUsersBulk(auth0Ids: string[]): Promise<UserProfile[]> {
    try {
      const response = await fetchService(`${this.baseUrl}/bulk`, {
        method: 'POST',
        body: JSON.stringify({ auth0Ids }),
        credentials: 'include',
      });
      return response;
    } catch (error) {
      logger.error('[UserService] Error fetching users bulk:', error);
      throw error;
    }
  }
}

export const userService = new UserService(); 