// Debug utility for renderer process
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        send: (channel: string, data: any) => void;
        on: (channel: string, callback: (...args: any[]) => void) => void;
        once: (channel: string, callback: (...args: any[]) => void) => void;
        removeListener: (channel: string, callback: (...args: any[]) => void) => void;
        invoke: (channel: string, data: any) => Promise<any>;
      };
    };
  }
}

const DEBUG_ENABLED = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';

export class DebugLogger {
  private context: string = '';
  private static instance: DebugLogger;

  private constructor() {}

  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  setContext(context: string): DebugLogger {
    this.context = context;
    return this;
  }

  componentMounted(componentName: string): void {
    console.log(`[${this.context}] Component mounted: ${componentName}`);
  }

  log(...args: any[]): void {
    console.log(`[${this.context}]`, ...args);
  }

  error(...args: any[]): void {
    console.error(`[${this.context}]`, ...args);
  }

  warn(...args: any[]): void {
    console.warn(`[${this.context}]`, ...args);
  }

  info(...args: any[]): void {
    console.info(`[${this.context}]`, ...args);
  }

  group(label: string): void {
    console.group(`[${this.context}] ${label}`);
  }

  groupEnd(): void {
    console.groupEnd();
  }

  // Component lifecycle logging
  componentUpdated(componentName: string, props?: any, state?: any) {
    this.setContext(componentName).group('Component updated');
    if (props) this.log('Props:', props);
    if (state) this.log('State:', state);
    this.groupEnd();
  }

  componentWillUnmount(componentName: string) {
    this.setContext(componentName).log('Component will unmount');
  }

  // State management logging
  stateChange(componentName: string, action: string, prevState: any, nextState: any) {
    this.setContext(componentName).group(`State change: ${action}`);
    this.log('Previous state:', prevState);
    this.log('Next state:', nextState);
    this.groupEnd();
  }

  // Event logging
  eventTriggered(componentName: string, eventName: string, ...args: any[]) {
    this.setContext(componentName).log(`Event triggered: ${eventName}`, ...args);
  }

  // Error boundary logging
  errorCaught(componentName: string, error: Error, errorInfo: any) {
    this.setContext(componentName).error('Error caught in component:', error, errorInfo);
  }
}

export const debug = DebugLogger.getInstance(); 