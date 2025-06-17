import fetchService from '../../../services/fetchService';
import { API_BASE_URL } from '../../../api/config';
import { 
  PersonalModelEntity, 
  TrainingDataEntity, 
  UIPersonalModel, 
  UITrainingData,
  ModelCreationParams,
  TrainingDataCreationParams,
  GenerateTrainingDataParams
} from '../types';

class PersonalModelError extends Error {
  constructor(
    message: string,
    public code: 'NOT_FOUND' | 'NETWORK_ERROR' | 'PERMISSION_DENIED' | 'INVALID_INPUT',
    public originalError?: Error
  ) {
    super(message);
    this.name = 'PersonalModelError';
  }
}

class PersonalModelService {
  private baseUrl = `${API_BASE_URL}/personal-models`;
  private trainingDataUrl = `${API_BASE_URL}/training-data`;

  private getAuthHeaders() {
    const authToken = localStorage.getItem('authToken');
    return {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };
  }

  // Models API methods
  async fetchModels(): Promise<UIPersonalModel[]> {
    try {
      // For GET requests, don't include Content-Type header since there's no body
      const authToken = localStorage.getItem('authToken');
      const headers = {
        'Authorization': `Bearer ${authToken}`
      };
      
      const models: PersonalModelEntity[] = await fetchService(this.baseUrl, {
        method: 'GET',
        credentials: 'include',
        headers
      });
      return models.map(this.toUIModel);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async fetchModel(id: string): Promise<UIPersonalModel> {
    try {
      // For GET requests, don't include Content-Type header
      const authToken = localStorage.getItem('authToken');
      const headers = {
        'Authorization': `Bearer ${authToken}`
      };
      
      const model: PersonalModelEntity = await fetchService(`${this.baseUrl}/${id}`, {
        method: 'GET',
        credentials: 'include',
        headers
      });
      return this.toUIModel(model);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createModel(params: ModelCreationParams): Promise<UIPersonalModel> {
    try {
      const model: PersonalModelEntity = await fetchService(this.baseUrl, {
        method: 'POST',
        credentials: 'include',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          name: params.name,
          description: params.description,
          baseModel: params.baseModel,
          trainingMethod: params.trainingMethod,
          writingSample: params.writingSample,
          trainingDataIds: params.trainingDataIds || [],
          galBoxSerialNumber: params.galBoxSerialNumber,
          phoneNumber: params.phoneNumber,
          notifyOnComplete: params.notifyOnComplete,
          tags: params.tags || [],
        }),
      });
      return this.toUIModel(model);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateModel(id: string, params: Partial<ModelCreationParams>): Promise<UIPersonalModel> {
    try {
      const model: PersonalModelEntity = await fetchService(`${this.baseUrl}/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(params),
      });
      return this.toUIModel(model);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteModel(id: string): Promise<boolean> {
    try {
      await fetchService(`${this.baseUrl}/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: this.getAuthHeaders(),
      });
      return true;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async trainModel(id: string): Promise<UIPersonalModel> {
    try {
      // Since this is a POST request with no body, don't include Content-Type
      const authToken = localStorage.getItem('authToken');
      const headers = {
        'Authorization': `Bearer ${authToken}`
      };
      
      const model: PersonalModelEntity = await fetchService(`${this.baseUrl}/${id}/train`, {
        method: 'POST',
        credentials: 'include',
        headers
      });
      return this.toUIModel(model);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Training Data API methods
  async fetchTrainingData(): Promise<UITrainingData[]> {
    try {
      // For GET requests, don't include Content-Type header
      const authToken = localStorage.getItem('authToken');
      const headers = {
        'Authorization': `Bearer ${authToken}`
      };
      
      const trainingData: TrainingDataEntity[] = await fetchService(this.trainingDataUrl, {
        method: 'GET',
        credentials: 'include',
        headers
      });
      return trainingData.map(this.toUITrainingData);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async fetchTrainingDataItem(id: string): Promise<UITrainingData> {
    try {
      // For GET requests, don't include Content-Type header
      const authToken = localStorage.getItem('authToken');
      const headers = {
        'Authorization': `Bearer ${authToken}`
      };
      
      const trainingData: TrainingDataEntity = await fetchService(`${this.trainingDataUrl}/${id}`, {
        method: 'GET',
        credentials: 'include',
        headers
      });
      return this.toUITrainingData(trainingData);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createTrainingData(params: TrainingDataCreationParams): Promise<UITrainingData> {
    try {
      const trainingData: TrainingDataEntity = await fetchService(this.trainingDataUrl, {
        method: 'POST',
        credentials: 'include',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(params),
      });
      return this.toUITrainingData(trainingData);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateTrainingData(id: string, params: Partial<TrainingDataCreationParams>): Promise<UITrainingData> {
    try {
      const trainingData: TrainingDataEntity = await fetchService(`${this.trainingDataUrl}/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(params),
      });
      return this.toUITrainingData(trainingData);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteTrainingData(id: string): Promise<boolean> {
    try {
      await fetchService(`${this.trainingDataUrl}/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: this.getAuthHeaders(),
      });
      return true;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async generateTrainingData(params: GenerateTrainingDataParams): Promise<UITrainingData> {
    try {
      const trainingData: TrainingDataEntity = await fetchService(`${this.trainingDataUrl}/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(params),
      });
      return this.toUITrainingData(trainingData);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Helper methods
  private toUIModel(model: PersonalModelEntity): UIPersonalModel {
    return {
      id: model._id,
      name: model.skeleton.name,
      description: model.skeleton.description,
      baseModel: model.skeleton.baseModel,
      trainingMethod: model.skeleton.trainingMethod,
      status: model.skeleton.status,
      progress: model.skeleton.progress,
      trainingDataIds: model.skeleton.trainingDataIds,
      writingSample: model.skeleton.writingSample,
      formattedSystemPrompt: model.skeleton.formattedSystemPrompt,
      galBoxSerialNumber: model.skeleton.galBoxSerialNumber,
      ollamaModelName: model.skeleton.ollamaModelName,
      phoneNumber: model.skeleton.phoneNumber,
      notifyOnComplete: model.skeleton.notifyOnComplete,
      tags: model.skeleton.tags,
      created: new Date(model.created_at),
      updated: new Date(model.updated_at),
    };
  }

  private toUITrainingData(trainingData: TrainingDataEntity): UITrainingData {
    return {
      id: trainingData._id,
      name: trainingData.skeleton.name,
      description: trainingData.skeleton.description,
      dataFormat: trainingData.skeleton.dataFormat,
      source: trainingData.skeleton.source,
      content: trainingData.skeleton.content,
      instructions: trainingData.skeleton.instructions,
      responses: trainingData.skeleton.responses,
      parentModelId: trainingData.skeleton.parentModelId,
      created: new Date(trainingData.created_at),
      updated: new Date(trainingData.updated_at),
    };
  }

  private handleError(error: any): PersonalModelError {
    console.log('Error in PersonalModelService:', error);
    
    if (error instanceof Error) {
      // If it's an error thrown by fetchService, try to extract more information
      const message = error.message;
      
      if (message.includes('401')) {
        return new PersonalModelError('Authentication failed. Please log in again.', 'PERMISSION_DENIED', error);
      }
      
      if (message.includes('400')) {
        return new PersonalModelError('Bad request. The server rejected the request.', 'INVALID_INPUT', error);
      }
      
      if (message.includes('404')) {
        return new PersonalModelError('Resource not found', 'NOT_FOUND', error);
      }
      
      if (message.includes('403')) {
        return new PersonalModelError('Permission denied', 'PERMISSION_DENIED', error);
      }
      
      return new PersonalModelError(message, 'NETWORK_ERROR', error);
    }
    
    // Old implementation for Response objects
    if (error instanceof Response) {
      switch (error.status) {
        case 400:
          return new PersonalModelError('Bad request. The server rejected the request.', 'INVALID_INPUT');
        case 401:
          return new PersonalModelError('Authentication failed. Please log in again.', 'PERMISSION_DENIED');
        case 404:
          return new PersonalModelError('Personal model not found', 'NOT_FOUND');
        case 403:
          return new PersonalModelError('Permission denied', 'PERMISSION_DENIED');
        default:
          return new PersonalModelError(`Network error: ${error.status}`, 'NETWORK_ERROR');
      }
    }
    
    return new PersonalModelError('Unknown error', 'NETWORK_ERROR', error);
  }
}

const personalModelService = new PersonalModelService();
export default personalModelService; 