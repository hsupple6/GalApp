import type { AppDefinition } from '../../types/apps';

export const PERSONAL_MODEL_EVENTS = {
  CREATE_MODEL: 'PERSONAL_MODEL_CREATE',
  DELETE_MODEL: 'PERSONAL_MODEL_DELETE',
  UPDATE_MODEL: 'PERSONAL_MODEL_UPDATE',
  TRAIN_MODEL: 'PERSONAL_MODEL_TRAIN',
  TEST_MODEL: 'PERSONAL_MODEL_TEST',
} as const;

export const PersonalModelAppDefinition: AppDefinition = {
  appId: 'personalModels',
  name: 'Personal Models',
  version: '1.0.0',
  description: 'Create and manage your personal AI models',
  events: {},
  entityTypes: ['PersonalModel', 'TrainingData'],
  component: 'PersonalModelApp',
  requiresProps: false,
  requiresEntity: false,
  actions: {
    createModel: {
      name: 'Create Model',
      description: 'Create a new personal model',
    },
    deleteModel: {
      name: 'Delete Model',
      description: 'Delete an existing personal model',
    },
    trainModel: {
      name: 'Train Model',
      description: 'Start training a personal model',
    },
    testModel: {
      name: 'Test Model',
      description: 'Test a personal model with prompts',
    },
    generateTrainingData: {
      name: 'Generate Training Data',
      description: 'Generate training data for a model',
    }
  }
}; 