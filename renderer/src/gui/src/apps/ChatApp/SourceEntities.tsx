import './SourceEntities.scss';

import { format } from 'date-fns';
import React from 'react';

// Simple entity interface with minimal required properties
interface SimpleEntity {
  id: string;
  name: string;
  type: string;
  entityType: string;
  [key: string]: any; // Allow any additional properties
}

interface SourceEntitiesProps {
  sourceEntities: SimpleEntity[];
}

const formatDate = (isoDate: string | null): string => {
  if (!isoDate) return 'unknown';
  try {
    return format(new Date(isoDate), 'MMM d, yyyy');
  } catch (e) {
    return 'invalid date';
  }
};

const formatDateSafe = (date: string | undefined | null): string => {
  if (!date) return '';
  return formatDate(date);
};

const SourceEntities = ({ sourceEntities }: SourceEntitiesProps) => {
  return (
    <div className="sourceEntities">
      {sourceEntities.map(entity => {
        // Get a reasonable display key
        const key = entity.id || entity._id || Math.random().toString(36).substring(2);
        
        if (entity.entityType === 'Email') {
          return (
            <div key={key} className="sourceEntity sourceEmail">
              <div>
                <strong>📧 {entity.subject || entity.name || 'No subject'}</strong>
              </div>
              <span>
                From: {entity.from || 'Unknown'} • 
                To: {entity.to || 'Unknown'} • 
                <span className="date">{formatDateSafe(entity.date || entity.created_at)}</span>
              </span>
              {entity.cleaned_plain_text && (
                <div className="emailContent">
                  {entity.cleaned_plain_text.trim().substring(0, 100)}
                  {entity.cleaned_plain_text.length > 100 ? '...' : ''}
                </div>
              )}
            </div>
          );
        } 
        
        if (entity.entityType === 'AppleNote') {
          return (
            <div key={key} className="sourceEntity sourceAppleNote">
              <div>
                <strong>📝 {entity.title || entity.name || 'Untitled Note'}</strong>
              </div>
              <span>
                {entity.folder || 'Unknown Folder'} • 
                <span className="date">{formatDateSafe(entity.created_at || entity.modified_at)}</span>
              </span>
              {entity.plaintext && (
                <div className="noteContent">
                  {entity.plaintext.trim().replace(/\s+/g, ' ').substring(0, 100)}
                  {entity.plaintext.length > 100 ? '...' : ''}
                </div>
              )}
            </div>
          );
        }
        
        // Generic entity fallback for any other type
        return (
          <div key={key} className="sourceEntity">
            <div>
              <strong>{entity.name || `Source: ${entity.entityType}`}</strong>
            </div>
            <span>Used as reference</span>
          </div>
        );
      })}
    </div>
  );
};

export default SourceEntities;
