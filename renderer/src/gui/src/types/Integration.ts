export type IntegrationType = 'Gmail' | 'AppleNote' | 'Notion' | 'GoogleCalendar';

export interface IntegrationSkeleton {
    "@type": "Integration";
    integrationEntities: IntegrationType[];
    name: string;
    isConnected: boolean;
    metadata: Record<string, any>;
}

export interface Integration {
    _id?: string;
    entityType: "Integration";
    created_at: string;
    updated_at: string;
    skeleton: IntegrationSkeleton;
} 