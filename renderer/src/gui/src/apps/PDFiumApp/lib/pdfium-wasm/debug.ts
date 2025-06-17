let DEBUG = false;

interface LogCounts {
  log: number;
  warn: number;
  error: number;
}

const MAX_LOGS = 10;
const counts: LogCounts = {
  log: 0,
  warn: 0,
  error: 0,
};

export const debug = {
  log: (...args: any[]) => {
    if (DEBUG && counts.log < MAX_LOGS) {
      console.debug(...args);
      counts.log++;
      if (counts.log === MAX_LOGS) {
        console.debug('Max logs reached, suppressing further logs');
      }
    }
  },
  warn: (...args: any[]) => {
    if (DEBUG && counts.warn < MAX_LOGS) {
      console.warn(...args);
      counts.warn++;
      if (counts.warn === MAX_LOGS) {
        console.warn('Max warnings reached, suppressing further warnings');
      }
    }
  },
  error: (...args: any[]) => {
    if (counts.error < MAX_LOGS) {
      console.error(...args);
      counts.error++;
      if (counts.error === MAX_LOGS) {
        console.error('Max errors reached, suppressing further errors');
      }
    }
  },
  enable: () => (DEBUG = true),
  disable: () => (DEBUG = false),
  reset: () => {
    counts.log = 0;
    counts.warn = 0;
    counts.error = 0;
  },
};
