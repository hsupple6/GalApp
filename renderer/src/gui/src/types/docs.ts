import { EntityBase, BaseSkeleton } from "./entities";

export interface DocSkeleton extends BaseSkeleton {
  '@type': 'Doc';
  content?: string;
  settings?: {
    isContentsVisible: boolean;
    isChatVisible: boolean;
  };
}

export interface DocEntity extends EntityBase {
  entityType: 'Doc';
  skeleton: DocSkeleton;
}