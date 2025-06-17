import { create } from 'zustand';
import personalModelService from '../utils/personalModelService';
import { 
  UIPersonalModel, 
  UITrainingData, 
  ModelCreationParams, 
  TrainingDataCreationParams,
  GenerateTrainingDataParams
} from '../types';

interface PersonalModelState {
  // Models
  models: UIPersonalModel[];
  activeModel: UIPersonalModel | null;
  isLoadingModels: boolean;
  modelError: string | null;
  
  // Training Data
  trainingData: UITrainingData[];
  activeTrainingData: UITrainingData | null;
  isLoadingTrainingData: boolean;
  trainingDataError: string | null;
  
  // Training Status
  isTraining: boolean;
  trainingProgress: number;
  trainingError: string | null;
}

interface PersonalModelActions {
  // Model actions
  fetchModels: () => Promise<UIPersonalModel[]>;
  fetchModel: (id: string) => Promise<UIPersonalModel>;
  createModel: (params: ModelCreationParams) => Promise<UIPersonalModel>;
  updateModel: (id: string, params: Partial<ModelCreationParams>) => Promise<UIPersonalModel>;
  deleteModel: (id: string) => Promise<boolean>;
  setActiveModel: (model: UIPersonalModel | null) => void;
  clearModelError: () => void;
  
  // Training data actions
  fetchTrainingData: () => Promise<UITrainingData[]>;
  fetchTrainingDataItem: (id: string) => Promise<UITrainingData>;
  createTrainingData: (params: TrainingDataCreationParams) => Promise<UITrainingData>;
  updateTrainingData: (id: string, params: Partial<TrainingDataCreationParams>) => Promise<UITrainingData>;
  deleteTrainingData: (id: string) => Promise<boolean>;
  setActiveTrainingData: (data: UITrainingData | null) => void;
  clearTrainingDataError: () => void;
  
  // Training process actions
  startTraining: (modelId: string) => Promise<UIPersonalModel>;
  updateTrainingProgress: (progress: number) => void;
  generateTrainingData: (params: GenerateTrainingDataParams) => Promise<UITrainingData>;
  clearTrainingError: () => void;
  
  // Reset
  reset: () => void;
}

type PersonalModelStore = PersonalModelState & PersonalModelActions;

const usePersonalModelStore = create<PersonalModelStore>((set, get) => ({
  // Initial state
  models: [],
  activeModel: null,
  isLoadingModels: false,
  modelError: null,
  
  trainingData: [],
  activeTrainingData: null,
  isLoadingTrainingData: false,
  trainingDataError: null,
  
  isTraining: false,
  trainingProgress: 0,
  trainingError: null,
  
  // Model actions
  fetchModels: async () => {
    set({ isLoadingModels: true, modelError: null });
    try {
      const models = await personalModelService.fetchModels();
      set({ models, isLoadingModels: false });
      return models;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error fetching models';
      set({ modelError: errorMessage, isLoadingModels: false });
      throw error;
    }
  },
  
  fetchModel: async (id: string) => {
    set({ isLoadingModels: true, modelError: null });
    try {
      const model = await personalModelService.fetchModel(id);
      set({ activeModel: model, isLoadingModels: false });
      return model;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error fetching model';
      set({ modelError: errorMessage, isLoadingModels: false });
      throw error;
    }
  },
  
  createModel: async (params: ModelCreationParams) => {
    set({ isLoadingModels: true, modelError: null });
    try {
      const model = await personalModelService.createModel(params);
      set(state => ({ 
        models: [...state.models, model], 
        activeModel: model, 
        isLoadingModels: false 
      }));
      return model;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error creating model';
      set({ modelError: errorMessage, isLoadingModels: false });
      throw error;
    }
  },
  
  updateModel: async (id: string, params: Partial<ModelCreationParams>) => {
    set({ isLoadingModels: true, modelError: null });
    try {
      const model = await personalModelService.updateModel(id, params);
      set(state => ({
        models: state.models.map(m => m.id === id ? model : m),
        activeModel: state.activeModel?.id === id ? model : state.activeModel,
        isLoadingModels: false
      }));
      return model;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error updating model';
      set({ modelError: errorMessage, isLoadingModels: false });
      throw error;
    }
  },
  
  deleteModel: async (id: string) => {
    set({ isLoadingModels: true, modelError: null });
    try {
      await personalModelService.deleteModel(id);
      set(state => ({
        models: state.models.filter(m => m.id !== id),
        activeModel: state.activeModel?.id === id ? null : state.activeModel,
        isLoadingModels: false
      }));
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error deleting model';
      set({ modelError: errorMessage, isLoadingModels: false });
      throw error;
    }
  },
  
  setActiveModel: (model: UIPersonalModel | null) => {
    set({ activeModel: model });
  },
  
  clearModelError: () => {
    set({ modelError: null });
  },
  
  // Training data actions
  fetchTrainingData: async () => {
    set({ isLoadingTrainingData: true, trainingDataError: null });
    try {
      const trainingData = await personalModelService.fetchTrainingData();
      set({ trainingData, isLoadingTrainingData: false });
      return trainingData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error fetching training data';
      set({ trainingDataError: errorMessage, isLoadingTrainingData: false });
      throw error;
    }
  },
  
  fetchTrainingDataItem: async (id: string) => {
    set({ isLoadingTrainingData: true, trainingDataError: null });
    try {
      const data = await personalModelService.fetchTrainingDataItem(id);
      set({ activeTrainingData: data, isLoadingTrainingData: false });
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error fetching training data';
      set({ trainingDataError: errorMessage, isLoadingTrainingData: false });
      throw error;
    }
  },
  
  createTrainingData: async (params: TrainingDataCreationParams) => {
    set({ isLoadingTrainingData: true, trainingDataError: null });
    try {
      const data = await personalModelService.createTrainingData(params);
      set(state => ({
        trainingData: [...state.trainingData, data],
        activeTrainingData: data,
        isLoadingTrainingData: false
      }));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error creating training data';
      set({ trainingDataError: errorMessage, isLoadingTrainingData: false });
      throw error;
    }
  },
  
  updateTrainingData: async (id: string, params: Partial<TrainingDataCreationParams>) => {
    set({ isLoadingTrainingData: true, trainingDataError: null });
    try {
      const data = await personalModelService.updateTrainingData(id, params);
      set(state => ({
        trainingData: state.trainingData.map(td => td.id === id ? data : td),
        activeTrainingData: state.activeTrainingData?.id === id ? data : state.activeTrainingData,
        isLoadingTrainingData: false
      }));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error updating training data';
      set({ trainingDataError: errorMessage, isLoadingTrainingData: false });
      throw error;
    }
  },
  
  deleteTrainingData: async (id: string) => {
    set({ isLoadingTrainingData: true, trainingDataError: null });
    try {
      await personalModelService.deleteTrainingData(id);
      set(state => ({
        trainingData: state.trainingData.filter(td => td.id !== id),
        activeTrainingData: state.activeTrainingData?.id === id ? null : state.activeTrainingData,
        isLoadingTrainingData: false
      }));
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error deleting training data';
      set({ trainingDataError: errorMessage, isLoadingTrainingData: false });
      throw error;
    }
  },
  
  setActiveTrainingData: (data: UITrainingData | null) => {
    set({ activeTrainingData: data });
  },
  
  clearTrainingDataError: () => {
    set({ trainingDataError: null });
  },
  
  // Training process actions
  startTraining: async (modelId: string) => {
    set({ isTraining: true, trainingProgress: 0, trainingError: null });
    try {
      const model = await personalModelService.trainModel(modelId);
      set(state => ({
        models: state.models.map(m => m.id === modelId ? model : m),
        activeModel: state.activeModel?.id === modelId ? model : state.activeModel,
        isTraining: model.status === 'training'
      }));
      return model;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error starting training';
      set({ trainingError: errorMessage, isTraining: false });
      throw error;
    }
  },
  
  updateTrainingProgress: (progress: number) => {
    set({ trainingProgress: progress });
  },
  
  generateTrainingData: async (params: GenerateTrainingDataParams) => {
    set({ isLoadingTrainingData: true, trainingDataError: null });
    try {
      const data = await personalModelService.generateTrainingData(params);
      set(state => ({
        trainingData: [...state.trainingData, data],
        activeTrainingData: data,
        isLoadingTrainingData: false
      }));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error generating training data';
      set({ trainingDataError: errorMessage, isLoadingTrainingData: false });
      throw error;
    }
  },
  
  clearTrainingError: () => {
    set({ trainingError: null });
  },
  
  // Reset
  reset: () => {
    set({
      models: [],
      activeModel: null,
      isLoadingModels: false,
      modelError: null,
      
      trainingData: [],
      activeTrainingData: null,
      isLoadingTrainingData: false,
      trainingDataError: null,
      
      isTraining: false,
      trainingProgress: 0,
      trainingError: null
    });
  }
}));

export default usePersonalModelStore; 