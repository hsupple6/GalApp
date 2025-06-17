export interface WindowEntity {
    id: string;
    type: 'window';
    component?: string;
    title?: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    props?: Record<string, any>;
    appType?: string;  // Identifies the application type (pdfium, docs, browser, etc.)
    entity?: any;
    tabs?: string[];  // IDs of tab windows
    activeTabId?: string;
    isTab?: boolean;  // Whether this window is a tab
    isParentWindow?: boolean;  // Whether this window contains tabs
    applicationState?: {
        notes?: {
            activeNoteId?: string;
            content?: string;
        };
        browser?: {
            currentUrl?: string;
        };
        galide?: {
            projectId?: string;
            activeFileId?: string;
            activeUIViewId?: string;
            isUIView?: boolean;
        };
        neurvana?: {
            projectId?: string;
            activeFileId?: string;
            activeUIViewId?: string;
            isUIView?: boolean;
            activeTab?: string;
        };
        docs?: {
            activeDocId?: string;
            content?: string;
            recentDocs?: {
                docId: string;
                name: string;
            }[];
        };
        pdfium?: {
            entityId?: string;
            pageSummaries?: {[pageNumber: string]: string};
            pageContents?: {[pageNumber: string]: string};
            hasEnrichments?: boolean;
            error?: string;
        };
        // Add other app-specific state as needed
    };
}

export type AnyWindowEntity = WindowEntity; 