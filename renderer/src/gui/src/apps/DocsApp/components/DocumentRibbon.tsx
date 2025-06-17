import React from 'react';

interface DocumentRibbonProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const DocumentRibbon: React.FC<DocumentRibbonProps> = ({ activeTab, onTabChange }) => {
  const renderRibbonContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <>
            <div className="ribbon-group">
              <div className="ribbon-controls">
                <button className="ribbon-button">
                  <i className="fas fa-paste"></i>
                  <span>Paste</span>
                </button>
                <div className="small-button-group">
                  <button className="ribbon-button small">
                    <i className="fas fa-cut"></i>
                  </button>
                  <button className="ribbon-button small">
                    <i className="fas fa-copy"></i>
                  </button>
                </div>
              </div>
              <div className="ribbon-group-title">Clipboard</div>
            </div>
            <div className="ribbon-group">
              <div className="ribbon-controls">
                <div className="font-selector">
                  <select>
                    <option>Calibri</option>
                    <option>Arial</option>
                    <option>Times New Roman</option>
                  </select>
                  <select>
                    <option>11</option>
                    <option>12</option>
                    <option>14</option>
                  </select>
                </div>
                <div className="formatting-buttons">
                  <button className="ribbon-button small">
                    <i className="fas fa-bold"></i>
                  </button>
                  <button className="ribbon-button small">
                    <i className="fas fa-italic"></i>
                  </button>
                  <button className="ribbon-button small">
                    <i className="fas fa-underline"></i>
                  </button>
                </div>
              </div>
              <div className="ribbon-group-title">Font</div>
            </div>
            <div className="ribbon-group">
              <div className="ribbon-controls">
                <div className="paragraph-buttons">
                  <button className="ribbon-button small">
                    <i className="fas fa-list-ul"></i>
                  </button>
                  <button className="ribbon-button small">
                    <i className="fas fa-list-ol"></i>
                  </button>
                  <button className="ribbon-button small">
                    <i className="fas fa-indent"></i>
                  </button>
                  <button className="ribbon-button small">
                    <i className="fas fa-outdent"></i>
                  </button>
                </div>
                <div className="alignment-buttons">
                  <button className="ribbon-button small">
                    <i className="fas fa-align-left"></i>
                  </button>
                  <button className="ribbon-button small">
                    <i className="fas fa-align-center"></i>
                  </button>
                  <button className="ribbon-button small">
                    <i className="fas fa-align-right"></i>
                  </button>
                </div>
              </div>
              <div className="ribbon-group-title">Paragraph</div>
            </div>
            <div className="ribbon-group">
              <div className="ribbon-controls">
                <button className="ribbon-button">
                  <i className="fas fa-paint-brush"></i>
                  <span>Styles</span>
                </button>
              </div>
              <div className="ribbon-group-title">Styles</div>
            </div>
            <div className="ribbon-group">
              <div className="ribbon-controls">
                <button className="ribbon-button">
                  <i className="fas fa-search"></i>
                  <span>Find</span>
                </button>
                <button className="ribbon-button">
                  <i className="fas fa-exchange-alt"></i>
                  <span>Replace</span>
                </button>
              </div>
              <div className="ribbon-group-title">Editing</div>
            </div>
          </>
        );
      case 'insert':
        return (
          <>
            <div className="ribbon-group">
              <div className="ribbon-controls">
                <button className="ribbon-button">
                  <i className="fas fa-table"></i>
                  <span>Table</span>
                </button>
              </div>
              <div className="ribbon-group-title">Tables</div>
            </div>
            <div className="ribbon-group">
              <div className="ribbon-controls">
                <button className="ribbon-button">
                  <i className="fas fa-image"></i>
                  <span>Pictures</span>
                </button>
                <button className="ribbon-button">
                  <i className="fas fa-shapes"></i>
                  <span>Shapes</span>
                </button>
              </div>
              <div className="ribbon-group-title">Illustrations</div>
            </div>
            <div className="ribbon-group">
              <div className="ribbon-controls">
                <button className="ribbon-button">
                  <i className="fas fa-heading"></i>
                  <span>Header</span>
                </button>
                <button className="ribbon-button">
                  <i className="fas fa-shoe-prints"></i>
                  <span>Footer</span>
                </button>
                <button className="ribbon-button">
                  <i className="fas fa-hashtag"></i>
                  <span>Page #</span>
                </button>
              </div>
              <div className="ribbon-group-title">Header & Footer</div>
            </div>
          </>
        );
      case 'layout':
        return (
          <>
            <div className="ribbon-group">
              <div className="ribbon-controls">
                <button className="ribbon-button">
                  <i className="fas fa-expand"></i>
                  <span>Margins</span>
                </button>
                <button className="ribbon-button">
                  <i className="fas fa-sync-alt"></i>
                  <span>Orientation</span>
                </button>
                <button className="ribbon-button">
                  <i className="fas fa-arrows-alt"></i>
                  <span>Size</span>
                </button>
              </div>
              <div className="ribbon-group-title">Page Setup</div>
            </div>
            <div className="ribbon-group">
              <div className="ribbon-controls">
                <button className="ribbon-button">
                  <i className="fas fa-grip-lines"></i>
                  <span>Breaks</span>
                </button>
                <button className="ribbon-button">
                  <i className="fas fa-list-ol"></i>
                  <span>Line Numbers</span>
                </button>
              </div>
              <div className="ribbon-group-title">Page Setup</div>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="document-ribbon">
      <div className="ribbon-tabs">
        <div 
          className={`ribbon-tab ${activeTab === 'file' ? 'active' : ''}`}
          onClick={() => onTabChange('file')}
        >
          File
        </div>
        <div 
          className={`ribbon-tab ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => onTabChange('home')}
        >
          Home
        </div>
        <div 
          className={`ribbon-tab ${activeTab === 'insert' ? 'active' : ''}`}
          onClick={() => onTabChange('insert')}
        >
          Insert
        </div>
        <div 
          className={`ribbon-tab ${activeTab === 'layout' ? 'active' : ''}`}
          onClick={() => onTabChange('layout')}
        >
          Layout
        </div>
        <div 
          className={`ribbon-tab ${activeTab === 'references' ? 'active' : ''}`}
          onClick={() => onTabChange('references')}
        >
          References
        </div>
        <div 
          className={`ribbon-tab ${activeTab === 'review' ? 'active' : ''}`}
          onClick={() => onTabChange('review')}
        >
          Review
        </div>
        <div 
          className={`ribbon-tab ${activeTab === 'view' ? 'active' : ''}`}
          onClick={() => onTabChange('view')}
        >
          View
        </div>
      </div>
      <div className="ribbon-content">
        {renderRibbonContent()}
      </div>
    </div>
  );
};

export default DocumentRibbon; 