# Neurvana2App

Neurvana2App is a neuroimaging management and analysis application designed to help users organize, process, and analyze neuroimaging data.

## Features

- **File System Access Integration**: Connect to local directories to browse and manage neuroimaging files
- **BIDS Organization**: Standardize file naming according to Brain Imaging Data Structure (BIDS) format
- **Transform Step Detection**: Automatically identify preprocessing steps applied to neuroimaging data
- **Interactive Data Table**: View and manage neuroimaging files with filtering and sorting
- **Analysis Tools**: Apply various analysis methods to neuroimaging data (future implementation)

## Component Structure

The application is built with a modular component architecture:

- **NeurvanaApp.tsx**: Main application container component
- **SourcePanel.tsx**: Left sidebar with file explorer, checks, and results
- **DataTable.tsx**: Table view of neuroimaging data
- **AnalysisPanel.tsx**: Tools for analyzing neuroimaging data

## Usage

Neurvana2App can be accessed via the URL path: `/app/neurvana`

### Workflow

1. Connect to a local directory containing neuroimaging files
2. Scan the directory to identify neuroimaging files (NII, DICOM, etc.)
3. Organize files to BIDS naming convention
4. Detect transform/preprocessing steps
5. View and analyze the data

## File System Access API

This application uses the File System Access API to interact with local files. This API is supported in modern Chromium-based browsers (Chrome, Edge).

## Data Integration

The application integrates with GalOS file system and can potentially connect to external services for neuroimaging analysis. 