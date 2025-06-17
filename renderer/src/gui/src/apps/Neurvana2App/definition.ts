import type { AppDefinition } from '../../types/apps';

export const NEURVANA_EVENTS = {
  IMPORT_DATA: 'NEURVANA_IMPORT_DATA',
  ANALYZE_DATASET: 'NEURVANA_ANALYZE_DATASET',
  APPLY_PREPROCESSING: 'NEURVANA_APPLY_PREPROCESSING',
  VISUALIZE_DATA: 'NEURVANA_VISUALIZE_DATA',
  EXPORT_RESULTS: 'NEURVANA_EXPORT_RESULTS',
  ORGANIZE_BIDS: 'NEURVANA_ORGANIZE_BIDS',
} as const;

export const NeurvanaAppDefinition: AppDefinition = {
  appId: 'neurvana',
  name: 'Neurvana',
  version: '1.0.0',
  description: 'Neuroimaging data management and analysis tool',
  icon: 'brain',
  events: {},
  entityTypes: ['NeurvanaProject', 'NeurvanaDataset', 'NeurvanaAnalysis'],
  component: 'NeurvanaApp',
  requiresProps: false,
  requiresEntity: true,
  supportedFileTypes: ['nii', 'nii.gz', 'dcm', 'mgh', 'mgz', 'edf', 'bdf', 'set', 'fif'],
  actions: {
    importData: {
      name: 'Import Data',
      description: 'Import neuroimaging data from various formats',
    },
    organizeBIDS: {
      name: 'Organize to BIDS',
      description: 'Organize data according to BIDS standard',
    },
    preprocess: {
      name: 'Preprocess',
      description: 'Apply preprocessing steps to neuroimaging data',
    },
    analyze: {
      name: 'Analyze',
      description: 'Run analysis on preprocessed data',
    },
    visualize: {
      name: 'Visualize',
      description: 'Create visualizations of neuroimaging data',
    },
    exportResults: {
      name: 'Export Results',
      description: 'Export analysis results and reports',
    }
  }
}; 