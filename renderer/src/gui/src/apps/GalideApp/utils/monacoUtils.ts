// Monaco type shims
// This is a simplified type definition for monaco-editor
declare namespace monaco {
  export namespace editor {
    interface IStandaloneCodeEditor {
      dispose(): void;
      getModel(): any;
      getValue(): string;
      setValue(value: string): void;
      setModel(model: any): void;
      onDidChangeModelContent(listener: () => void): { dispose: () => void };
    }

    interface IStandaloneEditorConstructionOptions {
      value?: string;
      language?: string;
      theme?: string;
      automaticLayout?: boolean;
      minimap?: { enabled: boolean };
      scrollBeyondLastLine?: boolean;
      fontFamily?: string;
      fontSize?: number;
      lineNumbers?: string;
      renderLineHighlight?: string;
      suggestSelection?: string;
      tabSize?: number;
      readOnly?: boolean;
      cursorBlinking?: string;
      cursorSmoothCaretAnimation?: string;
      folding?: boolean;
      autoIndent?: string;
      formatOnPaste?: boolean;
      formatOnType?: boolean;
      wordWrap?: string;
    }

    function create(element: HTMLElement, options: IStandaloneEditorConstructionOptions): IStandaloneCodeEditor;
    function createModel(value: string, language: string, uri: any): any;
    function defineTheme(name: string, options: any): void;
  }

  export namespace Uri {
    function parse(uri: string): any;
  }
}

// Export a function to initialize Monaco editor
const initMonaco = (): typeof monaco => {
  // Load monaco through require at runtime
  // @ts-ignore
  const monacoLib = window.monaco || require('monaco-editor');
  return monacoLib;
};

/**
 * Initialize Monaco editor with custom configurations
 */
export function initializeMonaco() {
  const monaco = initMonaco();
  
  // Register custom themes
  monaco.editor.defineTheme('neurvana-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#1e1e1e',
      'editor.foreground': '#d4d4d4',
      'editorCursor.foreground': '#d4d4d4',
      'editorLineNumber.foreground': '#858585',
      'editorLineNumber.activeForeground': '#c6c6c6',
      'editor.selectionBackground': '#264f78',
      'editor.inactiveSelectionBackground': '#3a3d41',
      'editorIndentGuide.background': '#404040',
      'editorIndentGuide.activeBackground': '#707070',
    }
  });

  monaco.editor.defineTheme('neurvana-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#000000',
      'editorCursor.foreground': '#000000',
      'editorLineNumber.foreground': '#999999',
      'editorLineNumber.activeForeground': '#333333',
      'editor.selectionBackground': '#add6ff',
      'editor.inactiveSelectionBackground': '#e5ebf1',
      'editorIndentGuide.background': '#d3d3d3',
      'editorIndentGuide.activeBackground': '#939393',
    }
  });

  // Return monaco instance
  return monaco;
}

/**
 * Get default editor options
 */
export function getDefaultEditorOptions(isDarkTheme: boolean = true): monaco.editor.IStandaloneEditorConstructionOptions {
  return {
    automaticLayout: true,
    minimap: { enabled: true },
    scrollBeyondLastLine: false,
    theme: isDarkTheme ? 'neurvana-dark' : 'neurvana-light',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontSize: 14,
    lineNumbers: 'on',
    renderLineHighlight: 'all',
    suggestSelection: 'first',
    tabSize: 2,
    readOnly: false,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    folding: true,
    autoIndent: 'advanced',
    formatOnPaste: true,
    formatOnType: false,
    wordWrap: 'off',
  };
}

/**
 * Create a Monaco editor instance
 */
export function createMonacoEditor(
  container: HTMLElement,
  content: string,
  language: string,
  options: monaco.editor.IStandaloneEditorConstructionOptions = {}
): monaco.editor.IStandaloneCodeEditor {
  const monaco = initMonaco();
  
  const editorOptions = {
    ...getDefaultEditorOptions(),
    ...options,
  };
  
  const editor = monaco.editor.create(container, {
    ...editorOptions,
    value: content,
    language,
  });
  
  return editor;
}

/**
 * Dispose a Monaco editor instance
 */
export function disposeMonacoEditor(editor: monaco.editor.IStandaloneCodeEditor | null): void {
  if (editor) {
    editor.dispose();
  }
} 