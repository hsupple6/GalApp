import React from 'react';

import type { AppleNoteType,FileType } from '../../../types';
import type { BaseEntityType } from '../../../types/entities';

interface EntityDetailsProps {
  entity: BaseEntityType;
}

const isAppleNoteEntity = (entity: BaseEntityType): entity is BaseEntityType & AppleNoteType => {
  return entity.entityType === 'AppleNote';
};

const EntityDetails: React.FC<EntityDetailsProps> = ({ entity }) => {
  const formatDate = (dateString?: string | Date) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString();
  };

  const MAX_TEXT_LENGTH = 500;
  const MAX_ARRAY_LENGTH = 3;

  const truncateEntity = (entity: any): any => {
    if (!entity) return entity;

    const truncated = { ...entity };

    // Handle enrichments specially
    if (truncated.skeleton?.enrichments) {
      const enrichments = truncated.skeleton.enrichments;

      // Truncate raw text
      if (enrichments.raw_text) {
        enrichments.raw_text = enrichments.raw_text.substring(0, MAX_TEXT_LENGTH) + '... (truncated)';
      }

      // Truncate chunks array and their content
      if (enrichments.chunks && Array.isArray(enrichments.chunks)) {
        enrichments.chunks = enrichments.chunks.slice(0, MAX_ARRAY_LENGTH).map((chunk: any) => ({
          ...chunk,
          text: chunk.text?.substring(0, MAX_TEXT_LENGTH) + '...',
          embedding: chunk.embedding ? '[...embedding array]' : undefined,
        }));
        if (enrichments.chunks.length > MAX_ARRAY_LENGTH) {
          enrichments.chunks.push({ note: `... ${enrichments.chunks.length - MAX_ARRAY_LENGTH} more chunks` });
        }
      }

      // Truncate sections
      if (enrichments.sections) {
        const truncatedSections: any = {};
        Object.entries(enrichments.sections).forEach(([key, value]) => {
          if (typeof value === 'string') {
            truncatedSections[key] = value.substring(0, MAX_TEXT_LENGTH) + '... (truncated)';
          }
        });
        enrichments.sections = truncatedSections;
      }

      // Truncate metadata entities
      if (enrichments.metadata?.entities && Array.isArray(enrichments.metadata.entities)) {
        const originalLength = enrichments.metadata.entities.length;
        if (originalLength > 5) {
          const truncatedEntities = enrichments.metadata.entities.slice(0, 5);
          truncatedEntities.push({
            note: `... ${originalLength - 5} more entities (truncated from ${originalLength} total)`,
          });
          enrichments.metadata.entities = truncatedEntities;
        }
      }
    }

    return truncated;
  };

  return (
    <div className="entityDetails">
      <div className="detailSection">
        <div className="detailHeader">
          <span className="entityIcon">{entity.entityType === 'Group' ? '📁' : '📄'}</span>
          <span className="entityName">{entity.name}</span>
        </div>
      </div>

      <div className="detailSection">
        <div className="detailRow">
          <span className="label">Type</span>
          <span className="value">{entity.entityType}</span>
        </div>
        {entity.created_at && (
          <div className="detailRow">
            <span className="label">Created</span>
            <span className="value">{formatDate(entity.created_at)}</span>
          </div>
        )}
        {entity.updated_at && (
          <div className="detailRow">
            <span className="label">Modified</span>
            <span className="value">{formatDate(entity.updated_at)}</span>
          </div>
        )}
        {entity._id && (
          <div className="detailRow">
            <span className="label">ID</span>
            <span className="value">{entity._id}</span>
          </div>
        )}

        {/* File-specific fields */}
        {entity.entityType === 'File' && (
          <>
            <div className="detailRow">
              <span className="label">Size</span>
              <span className="value">{(entity as FileType).metadata?.size} bytes</span>
            </div>
            <div className="detailRow">
              <span className="label">Type</span>
              <span className="value">{(entity as FileType).metadata?.mimeType}</span>
            </div>
            <div className="detailRow">
              <span className="label">Path</span>
              <span className="value">{(entity as FileType).metadata?.originalPath}</span>
            </div>
          </>
        )}

        {/* AppleNote-specific fields */}
        {entity.entityType === 'AppleNote' && (
          <>
            <div className="detailRow">
              <span className="label">Title</span>
              <span className="value">{isAppleNoteEntity(entity) ? entity.title : ''}</span>
            </div>
            <div className="detailRow">
              <span className="label">Folder</span>
              <span className="value">{isAppleNoteEntity(entity) ? (entity as AppleNoteType).folder || '' : ''}</span>
            </div>
          </>
        )}
      </div>

      {entity.children && (
        <div className="detailSection">
          <div className="detailRow">
            <span className="label">Contents</span>
            <span className="value">{entity.children.length} items</span>
          </div>
        </div>
      )}

      <div className="detailSection jsonBlob">
        <pre>{JSON.stringify(truncateEntity(entity), null, 2)}</pre>
      </div>
    </div>
  );
};

export default EntityDetails; 