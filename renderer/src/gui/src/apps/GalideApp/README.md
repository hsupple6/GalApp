# Galide App

Galide is an advanced code editor and visualization platform for GalOS that combines powerful code editing capabilities with interactive UI elements.

## Features

- **Monaco Editor Integration**: Professional code editing with syntax highlighting, autocomplete, and more
- **File Explorer**: Browse project files and UI views
- **Tabbed Interface**: Switch between multiple open files and UI views
- **Interactive UI Views**: Create and use custom UI components that can interact with project files

## Architecture

### Components

- **GalideApp**: Main application wrapper component
- **GalideEditor**: Monaco editor integration for code editing
- **GalideExplorer**: File and UI view explorer panel
- **GalideTabBar**: Tab management for open files and UI views
- **GalideUIRenderer**: Renderer for interactive UI components

### Store

- **galideAppStore**: State management for the application using Zustand

### Utils

- **fileUtils**: Utility functions for file handling
- **projectUtils**: Utility functions for project management

## UI Views

Galide supports custom UI views that can visualize and interact with project data:

- **File Ingestion Mapping UI**: Maps file patterns to data fields

## Development

### Adding New UI Views

To add a new UI view:

1. Create a new UI component in `GalideUIRenderer.tsx`
2. Register the component in the `uiComponents` registry
3. Add the UI view type to the store

### Extending Code Capabilities

The Monaco Editor integration can be extended with additional language features, completion providers, and more.

## Getting Started

To use Galide:

1. Open a project
2. Browse files in the Explorer
3. Click on a file to edit it in the Monaco editor
4. Click on a UI view to interact with project data

## Requirements

- Monaco Editor
- React
- Zustand for state management 