import debounce from 'lodash/debounce';
import { WebrtcProvider } from 'y-webrtc';
import * as Y from 'yjs';
import { WEBSOCKET_URL } from '../../api/config';
import { logger } from '../../utils/logger';

export interface CRDTUpdate<T> {
    type: string;
    data: T;
    timestamp: number;
}

export class CRDTService {
    private static instance: CRDTService;
    private docs = new Map<string, Y.Doc>();
    private providers = new Map<string, WebrtcProvider>();
    private connections: Map<string, (update: any) => void> = new Map();
    private observers: Map<string, { observer: any, cleanup: () => void }> = new Map();
    private states: Map<string, Y.Map<any>> = new Map();
    private cleanupSource?: string;

    private constructor() {
        // Private constructor for singleton
    }

    public static getInstance(): CRDTService {
        if (!CRDTService.instance) {
            CRDTService.instance = new CRDTService();
        }
        return CRDTService.instance;
    }

    public ensureInitialized(key: string): Y.Doc {
        let doc = this.docs.get(key);
        if (!doc) {
            doc = new Y.Doc();
            this.docs.set(key, doc);
            
            // Create WebRTC provider with local signaling server
            const roomId = key.startsWith('note-') ? `note:${key}` : `space:${key}`;
            const provider = new WebrtcProvider(roomId, doc, {
                signaling: [WEBSOCKET_URL]
            });
            this.providers.set(key, provider);
        }
        return doc;
    }

    connectDoc(key: string, doc: Y.Doc): Promise<void> {
        logger.log('[CRDT] Connecting doc:', key);
        this.ensureInitialized(key);
        return Promise.resolve();
    }

    connect<T>(key: string, onUpdate: (update: CRDTUpdate<T>) => void): () => void {
        logger.log('[CRDT] Connecting to:', key);
        const doc = this.ensureInitialized(key);
        
        const ymap = doc.getMap(key);
        this.states.set(key, ymap);

        // Debounce to prevent network spam, but keep it short
        const debouncedObserver = debounce(() => {
            const data = ymap.get('current') as T;
            if (data) {
                onUpdate({
                    type: 'update',
                    data: data,
                    timestamp: Date.now()
                });
            }
        }, 50);

        ymap.observe(debouncedObserver);
        this.connections.set(key, onUpdate);
        this.observers.set(key, {
            observer: debouncedObserver,
            cleanup: () => {
                ymap.unobserve(debouncedObserver);
                this.connections.delete(key);
                this.observers.delete(key);
            }
        });

        // Send initial state if exists
        const initialState = ymap.get('current') as T;
        if (initialState) {
            onUpdate({
                type: 'update',
                data: initialState,
                timestamp: Date.now()
            });
        }

        return () => {
            logger.log('[CRDT] Disconnecting from:', key);
            const observer = this.observers.get(key);
            if (observer) {
                observer.cleanup();
            }
        };
    }

    update<T>(key: string, data: T, options: { 
        preserveOtherConnections?: boolean,
        preserveNoteConnections?: boolean 
    } = {}) {
        logger.log('[CRDT] Updating:', { key, data });
        
        // Ensure doc exists before updating
        const doc = this.ensureInitialized(key);
        const ymap = doc.getMap(key);
        this.states.set(key, ymap);
        
        ymap.set('current', data);

        // Don't disconnect if we're preserving connections
        if (!options.preserveOtherConnections) {
            // Only clean up non-note connections unless explicitly cleaning up notes
            for (const [connKey, observer] of this.observers.entries()) {
                if (connKey === key || (!options.preserveNoteConnections && !connKey.startsWith('note-'))) {
                    observer.cleanup();
                }
            }
        }
    }

    getState<T>(key: string): T | undefined {
        const ymap = this.states.get(key);
        return ymap?.get('current') as T | undefined;
    }

    async getContent(key: string): Promise<string | null> {
        // Implement actual content fetching
        return null;
    }

    disconnect(key: string) {
        const provider = this.providers.get(key);
        if (provider) {
            provider.disconnect();
            this.providers.delete(key);
        }
        this.docs.delete(key);
    }

    cleanup() {
        for (const [key] of this.providers) {
            this.disconnect(key);
        }
    }

    private async getDoc(key: string): Promise<Y.Doc | null> {
        const doc = this.docs.get(key);
        if (!doc) {
            return null;
        }
        return doc;
    }

    async get<T>(key: string): Promise<T | null> {
        // logger.log('[CRDT] Getting:', { key });
        const doc = await this.getDoc(key);
        if (!doc) return null;
        
        const ymap = doc.getMap(key);
        return ymap.get('current') as T || null;
    }

    getProvider(key: string): WebrtcProvider | undefined {
        return this.providers.get(key);
    }

    getActiveDocs(): Map<string, Y.Doc> {
        return this.docs;
    }

    getActiveProviders(): Map<string, WebrtcProvider> {
        return this.providers;
    }
}

// Create a single instance to be used across the app
export const crdtService = CRDTService.getInstance(); 