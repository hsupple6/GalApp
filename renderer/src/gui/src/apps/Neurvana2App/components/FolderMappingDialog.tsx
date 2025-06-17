import React, { useState, useEffect } from 'react';
import './FolderMappingDialog.scss';
import neuroimagingService from '../services/neuroimagingService';
import metadataService from '../services/metadataService';

interface FolderMappingDialogProps {
  folderStructure: {
    name: string;
    path: string;
    type: 'folder' | 'file';
    children?: { name: string; path: string; type: 'folder' | 'file' }[];
  }[];
  onClose: () => void;
  onApplyMapping: (mapping: FolderMapping[]) => void;
  detectedPipelines: string[];
}

export interface FolderMapping {
  folderPath: string;
  folderName: string;
  subjectId: string;
  sessionId: string;
  mappingType: 'subject' | 'session' | 'pipeline_output';
  outputType?: string; // e.g., "FreeSurfer", "FSL", etc.
}

const FolderMappingDialog: React.FC<FolderMappingDialogProps> = ({
  folderStructure,
  onClose,
  onApplyMapping,
  detectedPipelines
}) => {
  const [mappings, setMappings] = useState<FolderMapping[]>([]);
  const [autoMapDone, setAutoMapDone] = useState(false);

  // Attempt auto-mapping on component mount with recursive directory exploration
  useEffect(() => {
    if (!autoMapDone && folderStructure.length > 0) {
      const initialMappings: FolderMapping[] = [];
      
      // Recursive function to process folders and their children
      const processFolderRecursively = (
        item: {
          name: string;
          path: string;
          type: 'folder' | 'file';
          children?: { name: string; path: string; type: 'folder' | 'file' }[];
        }
      ) => {
        // Only process folder items
        if (item.type === 'folder') {
          // Try to extract subject ID from folder name
          let subjectId = '';
          let mappingType: 'subject' | 'session' | 'pipeline_output' = 'subject';
          let outputType = '';
          
          // Check for subject ID pattern (sub-XXX, sXXX, subjectXXX, etc.)
          const subMatch = item.name.match(/^(sub[-_]?(\d+)|[sS](\d+)|[bB](\d+)|[rR](\d+)|subject[-_]?(\d+))/);
          
          // Use more advanced detection for FreeSurfer folders
          const isFreeSurferFolder = neuroimagingService.isFolderFreeSurferOutput(
            item.path, 
            item.name, 
            item.children
          );
          
          if (subMatch) {
            // Extract the numeric part of the subject ID
            const numericId = subMatch[2] || subMatch[3] || subMatch[4] || subMatch[5] || subMatch[6];
            subjectId = numericId ? numericId : item.name;
            
            // If this is also a FreeSurfer folder, mark it as pipeline output
            if (isFreeSurferFolder && detectedPipelines.includes('FREESURFER')) {
              mappingType = 'pipeline_output';
              outputType = 'FREESURFER';
            }
            
            // Default session is 1
            const sessionId = '1';
            
            initialMappings.push({
              folderPath: item.path,
              folderName: item.name,
              subjectId,
              sessionId,
              mappingType,
              outputType: outputType || undefined
            });
          } 
          // Check if this is a pipeline output folder
          else if (isFreeSurferFolder || detectedPipelines.length > 0) {
            // Check for FreeSurfer-specific pattern in the folder name
            mappingType = 'pipeline_output';
            outputType = 'FREESURFER';
            
            // Try to extract subject ID from folder name using neuroimaging service
            const parsedId = neuroimagingService.parseSubjectIdFromName(item.name);
            subjectId = parsedId || item.name;
            const sessionId = '1';
            
            initialMappings.push({
              folderPath: item.path,
              folderName: item.name,
              subjectId,
              sessionId,
              mappingType,
              outputType
            });
          }
          else {
            // Default mapping
            initialMappings.push({
              folderPath: item.path,
              folderName: item.name,
              subjectId: item.name,
              sessionId: '1',
              mappingType: 'subject'
            });
          }
          
          // Process all children recursively
          if (item.children && item.children.length > 0) {
            item.children.forEach(child => {
              if (child.type === 'folder') {
                processFolderRecursively(child);
              }
            });
          }
        }
      };
      
      // Process all top-level folders and their children
      folderStructure.forEach(item => processFolderRecursively(item));
      
      setMappings(initialMappings);
      setAutoMapDone(true);
    }
  }, [folderStructure, autoMapDone, detectedPipelines]);

  const handleMappingChange = (
    index: number, 
    field: keyof FolderMapping, 
    value: string
  ) => {
    const updatedMappings = [...mappings];
    
    if (field === 'mappingType' && value === 'pipeline_output') {
      updatedMappings[index] = {
        ...updatedMappings[index],
        [field]: value as any,
        outputType: detectedPipelines.length > 0 ? detectedPipelines[0] : 'Unknown'
      };
    } else {
      updatedMappings[index] = {
        ...updatedMappings[index],
        [field]: value
      };
    }
    
    setMappings(updatedMappings);
  };

  const handleApplyMapping = () => {
    // Apply mappings to metadata store
    mappings.forEach(mapping => {
      // Create or update subject
      let subject = metadataService.getSubject(mapping.subjectId);
      
      if (!subject) {
        // Create new subject
        const newSubject = metadataService.addSubject({
          id: mapping.subjectId,
          name: `Subject ${mapping.subjectId}`
        });
        
        if (!newSubject) {
          console.error(`Failed to create subject ${mapping.subjectId}`);
          return; // Skip this mapping
        }
        
        subject = newSubject;
      }
      
      // Process based on mapping type
      if (mapping.mappingType === 'subject') {
        // Check if subject has any scans
        if (subject.scans.length === 0) {
          // Add a virtual placeholder scan
          metadataService.addScan(subject.id, {
            id: `${subject.id}_virtual_${Date.now()}`,
            session: parseInt(mapping.sessionId) || 1,
            modality: 'T1', // Default modality
            filePath: `${mapping.folderPath}/virtual.nii.gz`, // Virtual path
            status: 'raw'
          });
        }
      } 
      else if (mapping.mappingType === 'pipeline_output') {
        // Look for an existing scan with the right session
        const sessionNum = parseInt(mapping.sessionId) || 1;
        const existingScan = subject.scans.find(scan => scan.session === sessionNum);
        
        if (existingScan) {
          // Check if this derivation already exists
          const hasDerivation = existingScan.derivations.some(
            d => d.pipelineType === (mapping.outputType || 'Unknown') && 
                 d.outputPath === mapping.folderPath
          );
          
          if (!hasDerivation) {
            // Add new derivation to existing scan
            metadataService.addDerivation(existingScan.id, {
              id: `${mapping.outputType || 'unknown'}_${Date.now()}`,
              pipelineType: mapping.outputType || 'Unknown',
              outputPath: mapping.folderPath,
              status: 'complete'
            });
            
            // Update scan status
            metadataService.updateScan(existingScan.id, { status: 'analyzed' });
          }
        } else {
          // Create new scan with derivation
          const scanId = `${subject.id}_${sessionNum}_${Date.now()}`;
          const newScan = metadataService.addScan(subject.id, {
            id: scanId,
            session: sessionNum,
            modality: 'T1', // Default for most pipelines
            filePath: `${mapping.folderPath}/virtual.nii.gz`,
            status: 'processed'
          });
          
          if (newScan) {
            // Add derivation to the new scan
            metadataService.addDerivation(scanId, {
              id: `${mapping.outputType || 'unknown'}_${Date.now()}`,
              pipelineType: mapping.outputType || 'Unknown',
              outputPath: mapping.folderPath,
              status: 'complete'
            });
          }
        }
      }
    });
    
    // Call the onApplyMapping callback
    onApplyMapping(mappings);
    onClose();
  };

  return (
    <div className="folder-mapping-dialog-overlay">
      <div className="folder-mapping-dialog">
        <div className="folder-mapping-dialog-header">
          <h2>Folder Mapping</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="folder-mapping-description">
          <p>Map folders to subjects and sessions to correctly organize neuroimaging data, including derivative outputs.</p>
          {detectedPipelines.length > 0 && (
            <div className="detected-pipelines">
              <p><strong>Detected pipelines:</strong> {detectedPipelines.join(', ')}</p>
            </div>
          )}
        </div>
        
        <div className="folder-mapping-content">
          <table className="mapping-table">
            <thead>
              <tr>
                <th>Folder</th>
                <th>Type</th>
                <th>Subject ID</th>
                <th>Session</th>
                {mappings.some(m => m.mappingType === 'pipeline_output') && <th>Pipeline</th>}
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping, index) => (
                <tr key={index}>
                  <td title={mapping.folderPath}>{mapping.folderName}</td>
                  <td>
                    <select 
                      value={mapping.mappingType}
                      onChange={(e) => handleMappingChange(index, 'mappingType', e.target.value)}
                    >
                      <option value="subject">Subject Folder</option>
                      <option value="session">Session Folder</option>
                      <option value="pipeline_output">Pipeline Output</option>
                    </select>
                  </td>
                  <td>
                    <input 
                      type="text" 
                      value={mapping.subjectId}
                      onChange={(e) => handleMappingChange(index, 'subjectId', e.target.value)}
                      placeholder="Subject ID"
                    />
                  </td>
                  <td>
                    <input 
                      type="text" 
                      value={mapping.sessionId}
                      onChange={(e) => handleMappingChange(index, 'sessionId', e.target.value)}
                      placeholder="Session (e.g., 1)"
                    />
                  </td>
                  {mappings.some(m => m.mappingType === 'pipeline_output') && (
                    <td>
                      {mapping.mappingType === 'pipeline_output' ? (
                        <select
                          value={mapping.outputType || ''}
                          onChange={(e) => handleMappingChange(index, 'outputType', e.target.value)}
                        >
                          {detectedPipelines.map(pipeline => (
                            <option key={pipeline} value={pipeline}>{pipeline}</option>
                          ))}
                          <option value="Other">Other</option>
                        </select>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="folder-mapping-actions">
          <button className="cancel-button" onClick={onClose}>Cancel</button>
          <button className="apply-button" onClick={handleApplyMapping}>Apply Mapping</button>
        </div>
      </div>
    </div>
  );
};

export default FolderMappingDialog; 