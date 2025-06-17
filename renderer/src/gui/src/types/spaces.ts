import { BaseEntityType } from './entities';
import { AnyWindowEntity } from './windows';

interface SpaceSkeleton {
    "@type": "Space";
    name: string;
    windows: Record<string, AnyWindowEntity>;
    settings: {
        isContentsVisible: boolean;
        isChatVisible: boolean;
        bgColor?: string;
        viewMode?: 'spatial' | 'focused';
        spaceChat?: {
            currentThreadIds: Record<string, string>; // mode -> threadId mapping
            isHistoryOpen: boolean;
            mode: string; // current chat mode
            model: string; // current model
            isContextVisible: boolean;
            widths: {
                focused: number;
                spatial: number;
            };
        };
    };
}

export interface SpaceEntity extends Omit<BaseEntityType<SpaceSkeleton>, 'skeleton'> {
    entityType: "Space";
    skeleton: SpaceSkeleton;
    user_id: string;
    acl?: ACLEntry[];
}

// UI Types
export interface UISpace {
    id: string;
    name: string;
    windows: Record<string, AnyWindowEntity>;
    activeWindowId?: string;
    settings: SpaceSettings;
    created?: Date;
    updated?: Date;
    acl?: ACLEntry[];
}

// CRDT Types
export interface SpaceSettings {
    isContentsVisible: boolean;
    isChatVisible: boolean;
    bgColor?: string;
    viewMode?: 'spatial' | 'focused';
    spaceChat?: {
        currentThreadIds: Record<string, string>; // mode -> threadId mapping
        isHistoryOpen: boolean;
        mode: string; // current chat mode
        model: string; // current model
        isContextVisible: boolean;
        widths: {
            focused: number;
            spatial: number;
        };
    };
}

export interface WindowsUpdate {
    type: 'windows';
    data: AnyWindowEntity[];
}

export interface SettingsUpdate {
    type: 'settings';
    data: SpaceSettings;
}

export type SpaceCRDTUpdate = (WindowsUpdate | SettingsUpdate) & {
    timestamp: number;
};

export interface ACLRole {
    OWNER: 'owner';
    EDITOR: 'editor';
    VIEWER: 'viewer';
    COMMENTER: 'commenter';
}

export interface ACLEntry {
    subject: string; // User Auth0 ID
    role: 'owner' | 'editor' | 'viewer' | 'commenter';
    granted_at?: string;
    granted_by?: string;
}

export interface ACLEntryWithUser extends ACLEntry {
    auth0Id: string;
    user: {
        email?: string;
        name?: string;
        picture?: string;
    };
} 