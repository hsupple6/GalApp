import React, { useState } from 'react';
import './DataTable.scss';
import metadataService from '../services/metadataService';

export interface TableDataItem {
  name: string;
  sub_id: number;
  session: number;
  type: string;
  scan: string;
  file_source: string;
  pre: number;
  post: number;
  active: number;
  status?: string;
  processing_steps?: string;
}

// View mode types for different table representations
type ViewMode = 'scan' | 'subject' | 'derivation';

interface DataTableProps {
  tableData: TableDataItem[];
  setTableData: React.Dispatch<React.SetStateAction<TableDataItem[]>>;
}

const DataTable: React.FC<DataTableProps> = ({ tableData, setTableData }) => {
  // State for current view mode
  const [viewMode, setViewMode] = useState<ViewMode>('scan');
  
  // Function to render table based on view mode
  const renderTable = () => {
    switch(viewMode) {
      case 'scan':
        return renderScanView();
      case 'subject':
        return renderSubjectView();
      case 'derivation':
        return renderDerivationView();
      default:
        return renderScanView();
    }
  };
  
  // Scan view - one row per scan (reconstructed from metadata)
  const renderScanView = () => {
    // Get scans directly from metadata service
    const scans = metadataService.getScans();
    
    // Filter out duplicate or derivative scans
    // We want to show exactly one row per actual scan modality (T1, T2, etc.)
    // or one virtual scan when only derivatives exist
    const uniqueScans: Record<string, any> = {};
    
    // First pass: find actual raw scans by subject/session/modality
    scans.forEach(scan => {
      // Skip virtual scans in first pass
      if (!scan.filePath.includes('virtual')) {
        const key = `${scan.subjectId}_${scan.session}_${scan.modality}`;
        uniqueScans[key] = scan;
      }
    });
    
    // Second pass: add virtual scans only if no actual scan exists for that combination
    scans.forEach(scan => {
      if (scan.filePath.includes('virtual')) {
        const key = `${scan.subjectId}_${scan.session}_${scan.modality}`;
        if (!uniqueScans[key]) {
          uniqueScans[key] = scan;
        }
      }
    });
    
    // Convert back to array
    const filteredScans = Object.values(uniqueScans);
    
    return (
      <table className="data-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Session</th>
            <th>Modality</th>
            <th>Source</th>
            <th>FreeSurfer</th>
            <th>FSL</th>
            <th>Other</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredScans.length === 0 ? (
            <tr>
              <td colSpan={9} className="empty-table-message">
                No neuroimaging data loaded. Connect to a directory and scan for files using the Source panel.
              </td>
            </tr>
          ) : (
            filteredScans.map((scan, index) => {
              const subject = metadataService.getSubject(scan.subjectId);
              const subjectName = subject ? (subject.name || `Subject ${subject.id}`) : 'Unknown';
              
              // Check if this is a virtual scan (has no real source)
              const isVirtual = scan.filePath.includes('virtual') || !scan.filePath;
              
              // Check for each derivation type
              const hasFreeSurfer = scan.derivations.some((d: any) => d.pipelineType === 'FreeSurfer');
              const hasFSL = scan.derivations.some((d: any) => d.pipelineType === 'FSL');
              const otherDerivations = scan.derivations
                .filter((d: any) => d.pipelineType !== 'FreeSurfer' && d.pipelineType !== 'FSL')
                .map((d: any) => d.pipelineType);
              
              // Generate a truly unique key using index as backup in case id isn't unique
              const rowKey = `scan_${scan.id}_${index}`;
              
              return (
                <tr key={rowKey} className={isVirtual ? 'virtual-scan' : ''}>
                  <td>{subjectName} ({scan.subjectId})</td>
                  <td>{scan.session}</td>
                  <td>
                    <span className="modality-badge">
                      {scan.modality}
                    </span>
                  </td>
                  <td>
                    {isVirtual ? (
                      <span className="missing-source">Source Missing</span>
                    ) : (
                      <span title={scan.filePath}>
                        {scan.filePath.split('/').pop() || scan.filePath}
                      </span>
                    )}
                  </td>
                  <td>
                    {hasFreeSurfer ? (
                      <span className="status-badge complete">Available</span>
                    ) : (
                      <span className="status-badge raw">None</span>
                    )}
                  </td>
                  <td>
                    {hasFSL ? (
                      <span className="status-badge complete">Available</span>
                    ) : (
                      <span className="status-badge raw">None</span>
                    )}
                  </td>
                  <td>
                    {otherDerivations.length > 0 ? (
                      <div className="other-derivations">
                        {otherDerivations.map((type: string, i: number) => (
                          <span key={i} className="pipeline-badge">
                            {type}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="status-badge raw">None</span>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge ${scan.status}`}>
                      {scan.status}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="view-details-button"
                      onClick={() => {
                        // You can implement a view details action here
                        console.log('View details for scan:', scan.id);
                      }}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    );
  };
  
  // Subject view - one row per subject
  const renderSubjectView = () => {
    // Get subjects from metadata service
    const subjects = metadataService.getSubjects();
    
    return (
      <table className="data-table">
        <thead>
          <tr>
            <th>Subject ID</th>
            <th>Name</th>
            <th>Scan Types</th>
            <th>FreeSurfer</th>
            <th>FSL</th>
            <th>Other Derivations</th>
            <th>Total Scans</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subjects.length === 0 ? (
            <tr>
              <td colSpan={8} className="empty-table-message">
                No subjects found. Connect to a directory and scan for files using the Source panel.
              </td>
            </tr>
          ) : (
            subjects.map((subject, index) => {
              // Get all unique scan types for this subject
              const scanTypes = Array.from(new Set(subject.scans.map(scan => scan.modality)));
              
              // Check for derivation types
              const hasFreeSurfer = subject.scans.some(scan => 
                scan.derivations.some(d => d.pipelineType === 'FreeSurfer')
              );
              
              const hasFSL = subject.scans.some(scan => 
                scan.derivations.some(d => d.pipelineType === 'FSL')
              );
              
              // Get other derivation types
              const otherDerivations = Array.from(
                new Set(
                  subject.scans.flatMap(scan => 
                    scan.derivations
                      .filter(d => d.pipelineType !== 'FreeSurfer' && d.pipelineType !== 'FSL')
                      .map(d => d.pipelineType)
                  )
                )
              );
              
              // Create a unique key for the row
              const rowKey = `subject_${subject.id}_${index}`;
              
              return (
                <tr key={rowKey}>
                  <td>{subject.id}</td>
                  <td>{subject.name || `Subject ${subject.id}`}</td>
                  <td>{scanTypes.join(', ') || 'None'}</td>
                  <td>
                    {hasFreeSurfer ? (
                      <span className="status-badge analyzed">Complete</span>
                    ) : (
                      <span className="status-badge raw">None</span>
                    )}
                  </td>
                  <td>
                    {hasFSL ? (
                      <span className="status-badge analyzed">Complete</span>
                    ) : (
                      <span className="status-badge raw">None</span>
                    )}
                  </td>
                  <td>{otherDerivations.join(', ') || 'None'}</td>
                  <td>{subject.scans.length}</td>
                  <td>
                    <button 
                      className="view-details-button"
                      onClick={() => {
                        // You can implement a view subject details action here
                        console.log('View details for subject:', subject.id);
                      }}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    );
  };
  
  // Derivation view - one row per derivation
  const renderDerivationView = () => {
    // Get all derivations from metadata service
    const derivations = metadataService.getScans().flatMap(scan => 
      scan.derivations.map(derivation => ({
        ...derivation,
        subjectId: scan.subjectId,
        scanId: scan.id,
        scanModality: scan.modality,
        scanSession: scan.session
      }))
    );
    
    return (
      <table className="data-table">
        <thead>
          <tr>
            <th>Subject ID</th>
            <th>Pipeline</th>
            <th>Source Scan</th>
            <th>Output Path</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {derivations.length === 0 ? (
            <tr>
              <td colSpan={6} className="empty-table-message">
                No derivations found. Map folders to subjects to detect derivative outputs.
              </td>
            </tr>
          ) : (
            derivations.map((derivation, index) => {
              const subject = metadataService.getSubject(derivation.subjectId);
              const subjectName = subject ? (subject.name || `Subject ${subject.id}`) : 'Unknown';
              
              // Create a unique key for each row
              const rowKey = `deriv_${derivation.id}_${derivation.scanId}_${index}`;
              
              return (
                <tr key={rowKey}>
                  <td>{subjectName} ({derivation.subjectId})</td>
                  <td>
                    <span className={`pipeline-badge ${derivation.pipelineType.toLowerCase()}`}>
                      {derivation.pipelineType}
                    </span>
                  </td>
                  <td>{`${derivation.scanModality}, Session ${derivation.scanSession}`}</td>
                  <td title={derivation.outputPath}>
                    {derivation.outputPath.split('/').pop() || derivation.outputPath}
                  </td>
                  <td>
                    <span className={`status-badge ${derivation.status}`}>
                      {derivation.status}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="view-details-button"
                      onClick={() => {
                        // You can implement a view derivation details action here
                        console.log('View details for derivation:', derivation.id);
                      }}
                    >
                      View Files
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    );
  };
  
  return (
    <div className="data-table-container">
      <div className="view-mode-selector">
        <div className="view-mode-label">View Mode:</div>
        <div className="view-mode-buttons">
          <button 
            className={`view-mode-button ${viewMode === 'scan' ? 'active' : ''}`}
            onClick={() => setViewMode('scan')}
          >
            Scans
          </button>
          <button 
            className={`view-mode-button ${viewMode === 'subject' ? 'active' : ''}`}
            onClick={() => setViewMode('subject')}
          >
            Subjects
          </button>
          <button 
            className={`view-mode-button ${viewMode === 'derivation' ? 'active' : ''}`}
            onClick={() => setViewMode('derivation')}
          >
            Derivations
          </button>
        </div>
      </div>
      
      {renderTable()}
    </div>
  );
};

export default DataTable; 