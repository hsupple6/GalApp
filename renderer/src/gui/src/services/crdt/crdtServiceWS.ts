import { flatten, unflatten } from 'flat';
import { v4 as uuidv4 } from 'uuid';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { WEBSOCKET_URL } from '../../api/config';
import { logger } from '../../utils/logger';

export interface CRDTUpdate<T> {
  type: string;
  data: T;
  timestamp: number;
}

// Special known CRDT keys and their preferred debounce times
const CRDT_KEY_CONFIGS: Record<string, number> = {
  'default': 500,  // Default debounce time (ms)
  'cursor': 0,     // No debounce for cursor data
  'presence': 0,   // No debounce for presence data
  'window': 0,     // No debounce for window movements
  'space': 300,    // Space updates
  'window-position': 0, // Window position - add specific key for window positions
  'position': 0    // Any position data - zero debounce time
};

// Private instance variable
let _instance: CRDTServiceWS | null = null;

export class CRDTServiceWS {
  private docs = new Map<string, Y.Doc>();
  private providers = new Map<string, WebsocketProvider>();
  private connections: Map<string, (update: any) => void> = new Map();
  private observers: Map<string, { observer: any; cleanup: () => void }> = new Map();
  private states = new Map<string, Y.Map<any>>();
  private localOriginId = uuidv4();

  // Make constructor public but encourage getInstance usage
  constructor() {
    // logger.log('[CRDT-WS] Creating new CRDTServiceWS instance');
  }

  public ensureInitialized(key: string): Y.Doc {
    // logger.log('[CRDT-WS] Doc Ensuring initialized:', key);
    let doc = this.docs.get(key);
    if (!doc) {
      // logger.log('[CRDT-WS] Doc does not exist, creating new doc:', key);
      doc = new Y.Doc();
      this.docs.set(key, doc);

      const roomId = key;
      const provider = new WebsocketProvider(WEBSOCKET_URL, roomId, doc);
      this.providers.set(key, provider);
    } else {
      // logger.log('[CRDT-WS] Doc already exists:', key);
    }
    return doc;
  }

  // Function to get the appropriate debounce time based on key
  private getDebounceTime(key: string): number {
    // Check if the key contains any of our special types
    for (const keyType of Object.keys(CRDT_KEY_CONFIGS)) {
      if (keyType !== 'default' && key.includes(keyType)) {
        return CRDT_KEY_CONFIGS[keyType];
      }
    }
    // Fall back to default
    return CRDT_KEY_CONFIGS.default;
  }

  private debouncedObserver(key: string, ymap: Y.Map<any>, onUpdate: (update: any) => void) {
    // Create a debounced version of the observer that waits a short period before firing
    let timeoutId: any = null;
    let lastUpdate: any = null;
    
    // Determine the debounce time based on the key type
    const debounceTime = this.getDebounceTime(key);
    
    // Log for debugging
    // logger.log(`[CRDT-WS] Setting up observer for ${key} with debounce time ${debounceTime}ms`);
    
    return (event: Y.YMapEvent<any>, transaction: Y.Transaction) => {
      // Skip updates from self
      if (transaction.origin === this.localOriginId) {
        // logger.log('[CRDT-WS] Ignoring local transaction');
        return;
      }
      
      // Store the latest update
      const data = this.ymapToObject(ymap);
      if (!data) return;
      
      lastUpdate = {
        type: 'update',
        data: data,
        timestamp: Date.now(),
      };
      
      // For zero-debounce items, send immediately
      if (debounceTime === 0) {
        // logger.log(`[CRDT-WS] Immediate update for ${key}`);
        onUpdate(lastUpdate);
        return;
      }
      
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Set a new timeout with the appropriate debounce time
      timeoutId = setTimeout(() => {
        // logger.log('[CRDT-WS] onUpdate (debounced)');
        onUpdate(lastUpdate);
        timeoutId = null;
      }, debounceTime);
    };
  }

  connect<T>(key: string, onUpdate: (update: CRDTUpdate<T>) => void): () => void {
    // logger.log('[CRDT-WS] Connecting to:', key);
    const doc = this.ensureInitialized(key);

    const ymap = doc.getMap<T>(key);
    this.states.set(key, ymap);

    const debouncedObserver = this.debouncedObserver(key, ymap, onUpdate);
    
    ymap.observe(debouncedObserver);
    // logger.log('[CRDT-WS] Observer added for:', key);

    this.connections.set(key, onUpdate);
    this.observers.set(key, {
      observer: debouncedObserver,
      cleanup: () => {
        ymap.unobserve(debouncedObserver);
        // logger.log('[CRDT-WS] Observer removed for:', key);
        this.connections.delete(key);
        this.observers.delete(key);
      },
    });

    return () => {
      // logger.log('[CRDT-WS] Disconnecting from:', key);
      const observer = this.observers.get(key);
      if (observer) {
        observer.cleanup();
      }
    };
  }

  update<T extends object>(
    key: string,
    newData: T,
    options: {
      preserveOtherConnections?: boolean;
      preserveNoteConnections?: boolean;
      updateType?: 'update' | 'remove';
    } = {},
  ) {
    // logger.log('[CRDT-WS] Updating:', { key, dataKeys: Object.keys(newData) });

    const doc = this.ensureInitialized(key);
    const ymap = doc.getMap(key);
    const updateMap = this.objectToYmap<T>(newData);

    doc.transact(() => {
      if (options.updateType === 'remove') {
        this.removeMapEntries(ymap, updateMap);
      } else if (options.updateType === 'update') {
        this.updateMap(ymap, updateMap);
      }
    }, this.localOriginId);

    this.states.set(key, ymap);

    if (!options.preserveOtherConnections) {
      this.cleanupObservers(key, options);
    }
  }

  disconnect(key: string) {
    // logger.log('[CRDT-WS] Disconnecting from:', key);
    const provider = this.providers.get(key);
    if (provider) {
      provider.disconnect();
      // logger.log('[CRDT-WS] Provider disconnected for:', key);
      this.providers.delete(key);
    }
    this.docs.delete(key);
    // logger.log('[CRDT-WS] Doc deleted for:', key);
  }

  cleanup() {
    for (const [key] of this.providers) {
      this.disconnect(key);
    }
  }

  // DEBUG HELPERS

  getProvider(key: string): WebsocketProvider | undefined {
    return this.providers.get(key);
  }

  getActiveDocs(): Map<string, Y.Doc> {
    return this.docs;
  }

  getActiveProviders(): Map<string, WebsocketProvider> {
    return this.providers;
  }

  get(key: string) {
    return this.docs.get(key);
  }

  private updateMap<T>(ymap: Y.Map<any>, updateMap: Map<string, any>) {
    // logger.log('[CRDT-WS] updateMap: Updating');

    for (const [k, v] of updateMap.entries()) {
      try {
        if (ymap.get(k) !== v) {
          ymap.set(k, v);
        }
      } catch (keyError) {
        logger.error('[CRDT-WS] map: Error setting key:', k, 'Error:', keyError);
        // Continue with other keys even if one fails
      }
    }
  }

  private removeMapEntries<T>(ymap: Y.Map<any>, updateMap: Map<string, any>) {
    // logger.log('[CRDT-WS] map: Removing entries');
    for (const [k, v] of updateMap.entries()) {
      // Special handling for null values - explicitly delete the key
      if (v === null || v === undefined) {
        if (ymap.has(k)) {
          // logger.log(`[CRDT-WS] Explicitly deleting key: ${k}`);
          ymap.delete(k);
        }
        continue;
      }
      
      // For other patterns, look for matching keys or patterns
      ymap.forEach((value, mapKey) => {
        if (mapKey === k || mapKey.startsWith(k + '.')) {
          // logger.log(`[CRDT-WS] Deleting matching key/pattern: ${mapKey}`);
          ymap.delete(mapKey);
        }
      });
    }
  }

  private cleanupObservers(key: string, options: { preserveNoteConnections?: boolean }) {
    // logger.log('[CRDT-WS] Cleaning up observers for:', key);
    for (const [connKey, observer] of this.observers.entries()) {
      if (connKey === key || (!options.preserveNoteConnections && !connKey.startsWith('note-'))) {
        // logger.log('[CRDT-WS] Cleaning up observer for:', connKey);
        observer.cleanup();
      }
    }
  }

  //
  // CRDT YMAP HELPERS
  //
  private ymapToObject<T>(ymap: Y.Map<T>) {
    const ymapObject = ymap.toJSON();

    const normalizedObject = this.removeParentEntries(ymapObject);
    const object = unflatten(normalizedObject) as T;
    return object;
  }

  private objectToYmap<T>(object: T) {
    const flatObject = flatten(object);
    return new Map(Object.entries(flatObject as Record<string, any>));
  }

  private removeParentEntries(object: any) {
    const keys = Object.keys(object);
    const parentKeys = keys.filter((key) => {
      return keys.some((k) => k.startsWith(key + '.'));
    });
    parentKeys.forEach((key) => {
      delete object[key];
    });
    return object;
  }
}

// Export a function to get the singleton instance
export function getCRDTServiceInstance(): CRDTServiceWS {
  if (!_instance) {
    _instance = new CRDTServiceWS();
  }
  return _instance;
}

// Add the missing export that's being imported elsewhere
export const crdtServiceWS = getCRDTServiceInstance();
