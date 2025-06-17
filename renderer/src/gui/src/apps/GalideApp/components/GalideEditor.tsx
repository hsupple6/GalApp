import React, { useCallback, useEffect, useRef, useState } from 'react';
import './GalideEditor.scss';
import { useGalideAppStore } from '../store/galideAppStore';
import { getFileLanguage, isBinaryFile, shouldOpenInEditor } from '../utils/fileUtils';
import { createMonacoEditor, disposeMonacoEditor, initializeMonaco } from '../utils/monacoUtils';
import { useFileService } from '../../../services/FileService';

// Import monaco type definitions
declare namespace monaco {
  namespace editor {
    interface IStandaloneCodeEditor {
      dispose(): void;
      getModel(): any;
      getValue(): string;
      setValue(value: string): void;
      setModel(model: any): void;
      onDidChangeModelContent(listener: () => void): { dispose: () => void };
    }
  }
}

export interface GalideEditorProps {
  fileId: string | null;
  projectId: string | null;
}

const GalideEditor: React.FC<GalideEditorProps> = ({ fileId, projectId }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoInstanceRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isBinary, setIsBinary] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  
  const { openFiles } = useGalideAppStore('', ''); // These will be filled properly when the component is used
  const fileService = useFileService();
  
  // Initialize Monaco
  useEffect(() => {
    // Initialize Monaco with our custom settings
    const monaco = initializeMonaco();
    // Store the monaco instance in the window for global access
    // @ts-ignore
    window.monaco = monaco;
  }, []);
  
  // Get the current file from the store
  const currentFile = openFiles.find((file: any) => file.id === fileId);

  // Load file content when file changes
  useEffect(() => {
    const loadFileContent = async () => {
      if (!fileId) {
        setContent('');
        setFileName('');
        setIsBinary(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch the file metadata to get the name
        const fileEntities = await fileService.getList();
        const fileEntity = fileEntities.find(entity => entity._id === fileId);
        
        if (!fileEntity) {
          throw new Error('File not found');
        }
        
        const name = fileEntity.name || 'Untitled';
        setFileName(name);
        
        // Check if it's a binary file
        const binary = isBinaryFile(name);
        setIsBinary(binary);
        
        if (!binary) {
          // Load file content as text
          const fileData = await fileService.readFile(fileId);
          
          // Handle the case where fileData is already a string
          if (typeof fileData === 'string') {
            setContent(fileData);
          } 
          // Handle the case where fileData is a Uint8Array
          else if (fileData instanceof Uint8Array) {
            const textDecoder = new TextDecoder('utf-8');
            const text = textDecoder.decode(fileData);
            setContent(text);
          }
          // Handle unexpected type
          else {
            console.error('Unexpected file data type:', typeof fileData);
            throw new Error('Unexpected file data format');
          }
        }
      } catch (err) {
        console.error('Failed to load file:', err);
        setError('Error loading file');
      } finally {
        setLoading(false);
      }
    };
    
    loadFileContent();
  }, [fileId, fileService]);
  
  // Setup Monaco editor
  useEffect(() => {
    if (editorRef.current && !monacoInstanceRef.current && !isBinary) {
      // Create initial empty editor
      monacoInstanceRef.current = createMonacoEditor(
        editorRef.current,
        '',
        'plaintext'
      );
      
      // Cleanup function
      return () => {
        disposeMonacoEditor(monacoInstanceRef.current);
        monacoInstanceRef.current = null;
      };
    }
  }, [isBinary]);
  
  // Update editor content when the file changes
  useEffect(() => {
    if (monacoInstanceRef.current && fileName && !isBinary) {
      const language = getFileLanguage(fileName);
      
      // Check if we need to create a new model (for different files)
      // @ts-ignore
      const model = window.monaco.editor.createModel(
        content,
        language,
        // @ts-ignore
        window.monaco.Uri.parse(`file:/${fileName}`)
      );
      
      monacoInstanceRef.current.setModel(model);
      
      // Cleanup previous model
      return () => {
        model.dispose();
      };
    }
  }, [content, fileName, isBinary]);
  
  // Handle content changes
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    // Here you would typically handle persisting changes
  }, []);
  
  // Register content change handler
  useEffect(() => {
    if (monacoInstanceRef.current && !isBinary) {
      const disposable = monacoInstanceRef.current.onDidChangeModelContent(() => {
        const newContent = monacoInstanceRef.current?.getValue() || '';
        handleContentChange(newContent);
      });
      
      return () => {
        disposable.dispose();
      };
    }
  }, [handleContentChange, isBinary]);
  
  // Render appropriate view based on file type and state
  const renderContent = () => {
    if (loading) {
      return (
        <div className="neurvana-editor-placeholder">
          <div className="placeholder-content">
            <h3>Loading...</h3>
            <p>Please wait while the file loads</p>
          </div>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="neurvana-editor-placeholder">
          <div className="placeholder-content">
            <h3>Error</h3>
            <p>{error}</p>
          </div>
        </div>
      );
    }
    
    if (!fileId) {
      return (
        <div className="neurvana-editor-placeholder">
          <div className="placeholder-content">
            <h3>No file open</h3>
            <p>Open a file from the explorer to start editing</p>
          </div>
        </div>
      );
    }
    
    if (isBinary) {
      return (
        <div className="neurvana-editor-placeholder">
          <div className="placeholder-content">
            <h3>Binary File</h3>
            <p>This file type cannot be edited in the text editor</p>
            <p className="file-name">{fileName}</p>
          </div>
        </div>
      );
    }
    
    return null; // Use the monaco editor for text files
  };

  return (
    <div className="neurvana-editor">
      {renderContent()}
      <div 
        ref={editorRef} 
        className="monaco-container"
        style={{ display: fileId && !loading && !error && !isBinary ? 'block' : 'none' }}
      />
    </div>
  );
};

export default GalideEditor; 