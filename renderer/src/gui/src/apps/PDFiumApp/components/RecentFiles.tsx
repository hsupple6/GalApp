import React from 'react';
import { useEffect, useState } from 'react';

interface RecentFile {
  id: string;
  name: string;
}

interface RecentFilesProps {
  onFileSelect: (fileId: string) => void;
  files?: RecentFile[];
}

export const RecentFiles: React.FC<RecentFilesProps> = ({ onFileSelect, files = [] }) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => {
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <div className="no-files">Loading recent files...</div>;
  }

  return (
    <div className="pdf-recent-files">
      <h2>Recent PDFs</h2>
      {files.length === 0 ? (
        <div className="no-files">No recent PDF files</div>
      ) : (
        <div className="files-grid">
          {files.map(file => (
            <div 
              key={file.id} 
              className="file-item"
              onClick={() => onFileSelect(file.id)}
            >
              <div className="file-icon">📄</div>
              <div className="file-name">{file.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 