export interface WindowManager {
  windowZedIndexes: { [key: string]: number };
  activeWindowId: string | null;
  // Add other window manager properties as needed
}
