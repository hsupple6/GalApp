import React from 'react';
import './AnalysisPanel.scss';
import { TableDataItem } from './DataTable';

interface AnalysisPanelProps {
  tableData: TableDataItem[];
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ tableData }) => {
  // Filter only active data for analysis
  const activeData = tableData.filter(item => item.active === 1);

  return (
    <div className="analysis-panel">
      <div className="analysis-header">
        <h2>Analysis Tools</h2>
        <div className="analysis-summary">
          {activeData.length > 0 ? (
            <p>{activeData.length} files selected for analysis</p>
          ) : (
            <p className="no-data-message">No active data selected for analysis. Mark items as active in the Data tab.</p>
          )}
        </div>
      </div>

      <div className="analysis-tools">
        <div className="analysis-tool-group">
          <h3>Preprocessing</h3>
          <div className="analysis-tool-buttons">
            <button className="tool-button" disabled={activeData.length === 0}>
              Motion Correction
            </button>
            <button className="tool-button" disabled={activeData.length === 0}>
              Spatial Normalization
            </button>
            <button className="tool-button" disabled={activeData.length === 0}>
              Smooth Data
            </button>
          </div>
        </div>

        <div className="analysis-tool-group">
          <h3>Connectivity Analysis</h3>
          <div className="analysis-tool-buttons">
            <button className="tool-button" disabled={activeData.length === 0}>
              ROI Analysis
            </button>
            <button className="tool-button" disabled={activeData.length === 0}>
              Seed-based Correlation
            </button>
            <button className="tool-button" disabled={activeData.length === 0}>
              Network Analysis
            </button>
          </div>
        </div>

        <div className="analysis-tool-group">
          <h3>Statistical Analysis</h3>
          <div className="analysis-tool-buttons">
            <button className="tool-button" disabled={activeData.length === 0}>
              Group Comparison
            </button>
            <button className="tool-button" disabled={activeData.length === 0}>
              Longitudinal Analysis
            </button>
            <button className="tool-button" disabled={activeData.length === 0}>
              Multi-modal Integration
            </button>
          </div>
        </div>
      </div>

      <div className="analysis-placeholder">
        <div className="placeholder-message">
          <p>Select an analysis tool to begin</p>
          <p className="placeholder-note">Analysis functionality will be implemented in future versions</p>
        </div>
      </div>
    </div>
  );
};

export default AnalysisPanel; 