const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

interface Logger {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  info: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  trace: (...args: any[]) => void;
  group: (...args: any[]) => void;
  groupEnd: () => void;
  groupCollapsed: (...args: any[]) => void;
  time: (label?: string) => void;
  timeEnd: (label?: string) => void;
}

// Use direct bindings to preserve call stack location
export const logger: Logger = {
  log: isDev ? console.log.bind(console) : () => {},
  error: isDev ? console.error.bind(console) : () => {},
  warn: isDev ? console.warn.bind(console) : () => {},
  info: isDev ? console.info.bind(console) : () => {},
  debug: isDev ? console.debug.bind(console) : () => {},
  trace: isDev ? console.trace.bind(console) : () => {},
  group: isDev ? console.group.bind(console) : () => {},
  groupEnd: isDev ? console.groupEnd.bind(console) : () => {},
  groupCollapsed: isDev ? console.groupCollapsed.bind(console) : () => {},
  time: isDev ? console.time.bind(console) : () => {},
  timeEnd: isDev ? console.timeEnd.bind(console) : () => {},
};

// Alternative: export individual methods for more granular control
export const devLog = isDev ? console.log.bind(console) : () => {};
export const devError = isDev ? console.error.bind(console) : () => {};
export const devWarn = isDev ? console.warn.bind(console) : () => {}; 