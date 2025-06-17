/**
 * DEPRECATED: This file contains mock data that has been replaced with real backend API calls.
 * It is kept for reference purposes but should not be used in production.
 */

import { FileNode } from '../components/GalideExplorer';
import { FileInfo, UIViewInfo } from '../store/galideAppStore';

// Define UIViewNode interface locally since it's not exported from NeurvanaExplorer
interface UIViewNode {
  id: string;
  name: string;
  type: string;
  icon: string;
}

/**
 * Fetches the file tree for a project
 * In a real implementation, this would connect to the backend API
 */
export async function fetchProjectFiles(projectId: string): Promise<FileNode[]> {
  // This is a mock implementation for demonstration purposes
  // In a real app, this would make an API call to the backend
  
  // Simulating API latency
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Return dummy data that matches what's in the NeurvanaExplorer component
  return [
    {
      id: 'source_data',
      name: 'source data',
      path: '/source_data',
      type: 'directory',
      entityType: 'Group',
      children: [
        {
          id: 'master_database',
          name: 'master_database.csv',
          path: '/source_data/master_database.csv',
          type: 'file',
          entityType: 'File'
        },
        {
          id: '2nd_database',
          name: '2nd_database.csv',
          path: '/source_data/2nd_database.csv',
          type: 'file',
          entityType: 'File'
        },
        {
          id: 'ingestion_rules',
          name: 'ingestion rules',
          path: '/source_data/ingestion_rules',
          type: 'file',
          entityType: 'File'
        },
        {
          id: 'merge_databases',
          name: 'merge_databases.py',
          path: '/source_data/merge_databases.py',
          type: 'file',
          entityType: 'File'
        },
        {
          id: 'database_1',
          name: 'database_1',
          path: '/source_data/database_1',
          type: 'file',
          entityType: 'File'
        }
      ]
    },
    {
      id: 'folder',
      name: 'folder',
      path: '/folder',
      type: 'directory',
      entityType: 'Group',
      children: []
    },
    {
      id: 'analyses',
      name: 'analyses',
      path: '/analyses',
      type: 'directory',
      entityType: 'Group',
      children: [
        {
          id: 'cleaned_data',
          name: 'cleaned_data',
          path: '/analyses/cleaned_data',
          type: 'file',
          entityType: 'File'
        },
        {
          id: 'file1',
          name: 'file',
          path: '/analyses/file',
          type: 'file',
          entityType: 'File'
        }
      ]
    }
  ];
}

/**
 * Fetches UI views for a project
 * In a real implementation, this would connect to the backend API
 */
export async function fetchProjectUIViews(projectId: string): Promise<UIViewNode[]> {
  // This is a mock implementation for demonstration purposes
  // In a real app, this would make an API call to the backend
  
  // Simulating API latency
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Return dummy UI views
  return [
    {
      id: 'file-mapping-ui',
      name: 'File Ingestion Mapping UI',
      type: 'file-ingestion-mapping',
      icon: 'table'
    }
  ];
}

/**
 * Fetches a single file's content
 */
export async function fetchFileContent(fileId: string): Promise<FileInfo | null> {
  // Simulating API latency
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Mock data for specific files
  const fileContents: Record<string, FileInfo> = {
    'merge_databases': {
      id: 'merge_databases',
      name: 'merge_databases.py',
      path: '/source_data/merge_databases.py',
      type: 'python',
      content: `import pandas as pd
import os
import warnings
import logging
from typing import Dict, Optional

# Import PerformanceWarnings
warnings.filterwarnings('ignore', category=pd.errors.PerformanceWarning)

def strip_ansi_codes(text):
    # ANSI escape code regex pattern
    ansi_escape = re.compile(r'\\x1B(?:[@-Z\\\\-_]|\[[0-?]*[ -/]*[@-~])')
    return ansi_escape.sub('', text)

class ColoredFormatter(logging.Formatter):
    """Formatter for adding colors to console output"""
    
    def format(self, record):
        if hasattr(record, 'color'):
            record.msg = colored(record.msg, record.color)
        return super().format(record)

class PlainFormatter(logging.Formatter):
    """Plain formatter for file output that removes all color codes"""
    
    def format(self, record):
        if isinstance(record.msg, str):
            record.msg = strip_ansi_codes(record.msg)
        return super().format(record)

def setup_logging(output_dir: str) -> None:
    """Setup logging to both console and file"""
    
    # Create log directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Create log filename with timestamp
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    log_file = os.path.join(output_dir, f"merge_log_{timestamp}.txt")
    
    # Setup logging
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(ColoredFormatter())
    logger.addHandler(console_handler)
    
    # File handler
    file_handler = logging.FileHandler(log_file)
    file_handler.setFormatter(PlainFormatter('%(asctime)s - %(levelname)s - %(message)s'))
    logger.addHandler(file_handler)
    
    logging.info(f"Logging initialized. Log file: {log_file}")

def merge_databases(csv_files, output_path):
    """Merge multiple database CSV files"""
    dfs = []
    
    for file in csv_files:
        df = pd.read_csv(file)
        logging.info(f"Loaded {file}: {len(df)} rows, {len(df.columns)} columns")
        dfs.append(df)
    
    # Perform merge
    if len(dfs) > 1:
        merged_df = pd.concat(dfs, ignore_index=True)
        logging.info(f"Merged dataframe: {len(merged_df)} rows")
        
        # Remove duplicates
        deduped_df = merged_df.drop_duplicates()
        logging.info(f"After removing duplicates: {len(deduped_df)} rows")
        
        # Save to CSV
        deduped_df.to_csv(output_path, index=False)
        logging.info(f"Saved merged database to {output_path}")
        
        return deduped_df
    elif len(dfs) == 1:
        dfs[0].to_csv(output_path, index=False)
        logging.info(f"Only one input file. Saved to {output_path}")
        return dfs[0]
    else:
        logging.error("No input files provided")
        return None

if __name__ == "__main__":
    # Setup logging
    setup_logging("./logs")
    
    # Define input and output paths
    input_files = [
        "./data/master_database.csv",
        "./data/2nd_database.csv"
    ]
    
    output_file = "./data/merged_database.csv"
    
    # Run merge process
    merge_databases(input_files, output_file)
    
    logging.info("Merge process complete")
`
    },
    'master_database': {
      id: 'master_database',
      name: 'master_database.csv',
      path: '/source_data/master_database.csv',
      type: 'csv',
      content: `id,name,age,city,state,occupation
1,John Smith,34,New York,NY,Engineer
2,Mary Johnson,28,Los Angeles,CA,Doctor
3,James Williams,45,Chicago,IL,Teacher
4,Patricia Brown,52,Houston,TX,Lawyer
5,Robert Jones,39,Phoenix,AZ,Accountant
6,Jennifer Garcia,31,Philadelphia,PA,Nurse
7,Michael Miller,42,San Antonio,TX,Architect
8,Linda Martinez,36,San Diego,CA,Developer
9,William Rodriguez,29,Dallas,TX,Consultant
10,Elizabeth Davis,47,San Jose,CA,Manager`
    }
  };
  
  return fileContents[fileId] || null;
}

/**
 * Fetches a UI view's configuration
 */
export async function fetchUIViewConfig(uiViewId: string): Promise<UIViewInfo | null> {
  // Simulating API latency
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Mock data for specific UI views
  const uiViewConfigs: Record<string, UIViewInfo> = {
    'file-mapping-ui': {
      id: 'file-mapping-ui',
      name: 'File Ingestion Mapping UI',
      type: 'file-ingestion-mapping',
      config: {
        folders: [
          {
            name: 'sub-001',
            files: [
              { name: 'sub-001-ses-01-task-rest_bold.nii.gz' },
              { name: 'sub-001-ses-01-task-rest_events.tsv' }
            ]
          },
          {
            name: 'sub-002',
            files: [
              { name: 'sub-002-ses-01-task-rest_bold.nii.gz' },
              { name: 'sub-002-ses-01-task-rest_events.tsv' }
            ]
          }
        ],
        availableFields: [
          'subject', 
          'session', 
          'task', 
          'run', 
          'modality', 
          'datatype'
        ],
        mappings: [
          {
            id: 'sub',
            pattern: 'sub-{n}',
            examples: 'sub-001, sub-002',
            targetField: 'subject',
            preview: 'sub-001 → 001'
          },
          {
            id: 'ses',
            pattern: 'ses-{n}',
            examples: 'ses-01, ses-02',
            targetField: 'session',
            preview: 'ses-01 → 01'
          },
          {
            id: 'task',
            pattern: 'task-{name}',
            examples: 'task-rest, task-memory',
            targetField: 'task',
            preview: 'task-rest → rest'
          },
          {
            id: 'type',
            pattern: '{datatype}',
            examples: 'bold, events',
            targetField: '',
            preview: 'bold → bold'
          }
        ]
      }
    }
  };
  
  return uiViewConfigs[uiViewId] || null;
} 