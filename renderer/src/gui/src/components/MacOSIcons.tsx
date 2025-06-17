import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
  color?: string;
}

// Base SVG icon component with styling
const IconBase: React.FC<IconProps & { children?: React.ReactNode }> = ({ 
  className = '', 
  size = 14,
  color = 'currentColor',
  children 
}) => {
  // Create a style object with !important to override any external CSS
  const styleObj = {
    width: `${size}px !important`,
    height: `${size}px !important`,
    display: 'inline-flex !important',
    alignItems: 'center !important',
    justifyContent: 'center !important',
    color: `${color} !important`,
    minWidth: `${size}px !important`,
    minHeight: `${size}px !important`,
    flexShrink: '0 !important',
    lineHeight: '1 !important',
    verticalAlign: 'middle !important'
  };

  return (
    <div className={`mac-icon ${className}`} style={styleObj}>
      {children}
    </div>
  );
};

// Simple SVG icon component that uses a path directly
const SimpleIcon: React.FC<IconProps & { svgPath: string }> = ({ 
  className = '', 
  size = 14,
  color = 'currentColor',
  svgPath
}) => {
  // SVG style with !important
  const svgStyle = {
    width: '100% !important',
    height: '100% !important',
    display: 'block !important'
  };

  return (
    <IconBase className={className} size={size} color={color}>
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        style={svgStyle}
      >
        <path d={svgPath} fill="currentColor" />
      </svg>
    </IconBase>
  );
};

// Fallback icons with hardcoded paths
const IconPaths = {
  folder: "M20 6H12L10 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6Z",
  document: "M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20Z",
  house: "M10 20V14H14V20H19V12H22L12 3L2 12H5V20H10Z",
  desktop: "M21 2H3C1.9 2 1 2.9 1 4V16C1 17.1 1.9 18 3 18H10V20H8V22H16V20H14V18H21C22.1 18 23 17.1 23 16V4C23 2.9 22.1 2 21 2ZM21 16H3V4H21V16Z",
  downloads: "M19 9H15V3H9V9H5L12 16L19 9ZM5 18V20H19V18H5Z",
  arrowLeft: "M20 11H7.83L13.42 5.41L12 4L4 12L12 20L13.41 18.59L7.83 13H20V11Z",
  arrowRight: "M12 4L10.59 5.41L16.17 11H4V13H16.17L10.59 18.59L12 20L20 12L12 4Z",
  arrowUp: "M4 12L5.41 13.41L11 7.83V20H13V7.83L18.59 13.41L20 12L12 4L4 12Z",
  listBullet: "M3 13H5V11H3V13ZM3 17H5V15H3V17ZM3 9H5V7H3V9ZM7 13H21V11H7V13ZM7 17H21V15H7V17ZM7 7V9H21V7H7Z",
  gridView: "M3 3V11H11V3H3ZM9 9H5V5H9V9ZM3 13V21H11V13H3ZM9 19H5V15H9V19ZM13 3V11H21V3H13ZM19 9H15V5H19V9ZM13 13V21H21V13H13ZM19 19H15V15H19V19Z",
  columnView: "M3 3H7V21H3V3ZM10 3H14V21H10V3ZM17 3H21V21H17V3Z",
  plus: "M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z",
  trash: "M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM19 4H15.5L14.5 3H9.5L8.5 4H5V6H19V4Z",
  image: "M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19ZM8.5 13.5L11 16.51L14.5 12L19 18H5L8.5 13.5Z",
  film: "M17 10.5V7C17 6.45 16.55 6 16 6H4C3.45 6 3 6.45 3 7V17C3 17.55 3.45 18 4 18H16C16.55 18 17 17.55 17 17V13.5L21 17.5V6.5L17 10.5Z",
  musicNote: "M12 3V13.55C11.41 13.21 10.73 13 10 13C7.79 13 6 14.79 6 17C6 19.21 7.79 21 10 21C12.21 21 14 19.21 14 17V7H18V3H12Z",
  code: "M9.4 16.6L4.8 12L9.4 7.4L8 6L2 12L8 18L9.4 16.6ZM14.6 16.6L19.2 12L14.6 7.4L16 6L22 12L16 18L14.6 16.6Z",
  archive: "M20 6H4V8H20V6ZM18 10H6V12H18V10ZM20 2H4C2.9 2 2 2.9 2 4V20C2 21.1 2.9 22 4 22H20C21.1 22 22 21.1 22 20V4C22 2.9 21.1 2 20 2ZM20 20H4V4H20V20Z",
  pdf: "M20 2H8C6.9 2 6 2.9 6 4V16C6 17.1 6.9 18 8 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H8V4H20V16ZM4 6H2V20C2 21.1 2.9 22 4 22H18V20H4V6ZM16 12V9C16 8.45 15.55 8 15 8H13V14H14V12H15C15.55 12 16 11.55 16 11V12ZM14 9H15V11H14V9ZM18 11H19V14H20V11H21V10H18V11ZM10 10H11C11.55 10 12 10.45 12 11V13C12 13.55 11.55 14 11 14H9V8H10V10ZM10 11V13H11V11H10Z",
  spreadsheet: "M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19ZM7 10H9V17H7V10ZM11 7H13V17H11V7ZM15 13H17V17H15V13Z",
  app: "M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19ZM12 17C14.21 17 16 15.21 16 13C16 10.79 14.21 9 12 9C9.79 9 8 10.79 8 13C8 15.21 9.79 17 12 17Z",
  textDocument: "M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM16 18H8V16H16V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z",
  presentation: "M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19ZM7 10H9V17H7V10ZM11 7H13V17H11V7ZM15 13H17V17H15V13Z"
};

// Folder icon
export const FolderIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.folder} />
);

// Document icon
export const DocumentIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.document} />
);

// Home icon
export const HomeIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.house} />
);

// Desktop icon
export const DesktopIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.desktop} />
);

// Downloads icon
export const DownloadsIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.downloads} />
);

// Back icon
export const BackIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.arrowLeft} />
);

// Forward icon
export const ForwardIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.arrowRight} />
);

// Up icon
export const UpIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.arrowUp} />
);

// List view icon
export const ListViewIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.listBullet} />
);

// Grid view icon
export const GridViewIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.gridView} />
);

// Column view icon
export const ColumnViewIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.columnView} />
);

// Add icon
export const AddIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.plus} />
);

// Delete/Trash icon
export const TrashIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.trash} />
);

// Image icon
export const ImageIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.image} />
);

// Video icon
export const VideoIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.film} />
);

// Audio icon
export const AudioIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.musicNote} />
);

// Code icon
export const CodeIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.code} />
);

// Archive icon
export const ArchiveIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.archive} />
);

// PDF icon
export const PDFIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.pdf} />
);

// Spreadsheet icon
export const SpreadsheetIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.spreadsheet} />
);

// App icon
export const AppIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.app} />
);

// Text document icon
export const TextDocumentIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.textDocument} />
);

// Presentation icon
export const PresentationIcon: React.FC<IconProps> = (props) => (
  <SimpleIcon {...props} svgPath={IconPaths.presentation} />
);

// Add CSS for the icons
export const IconStyles = () => (
  <style>{`
    /* High specificity selector to override any other styles */
    div.mac-icon, 
    li div.mac-icon, 
    .finder-app div.mac-icon, 
    .file-icon-wrapper div.mac-icon {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      flex-shrink: 0 !important;
      line-height: 1 !important;
      vertical-align: middle !important;
    }
    
    /* High specificity selector for SVG elements */
    div.mac-icon svg, 
    li div.mac-icon svg, 
    .finder-app div.mac-icon svg, 
    .file-icon-wrapper div.mac-icon svg {
      width: 100% !important;
      height: 100% !important;
      display: block !important;
    }
    
    /* Override any sidebar-specific styles */
    .finder-sidebar ul li svg {
      width: inherit !important;
      height: inherit !important;
    }
    
    /* Direct override for the sidebar icons */
    .finder-app .finder-sidebar ul li .mac-icon {
      width: 14px !important;
      height: 14px !important;
      min-width: 14px !important;
      min-height: 14px !important;
    }
    
    /* Direct override for the main content icons */
    .finder-app .finder-main .mac-icon {
      width: 14px !important;
      height: 14px !important;
      min-width: 14px !important;
      min-height: 14px !important;
    }
    
    /* Override for file icons in grid or list view */
    .finder-app .finder-main .file-item .mac-icon {
      width: 14px !important;
      height: 14px !important;
    }
    
    /* Override for toolbar icons */
    .finder-app .toolbar .mac-icon,
    .finder-app .toolbar-button .mac-icon,
    .finder-app header .mac-icon,
    .finder-app .finder-toolbar .mac-icon,
    .finder-app .action-buttons .mac-icon,
    .finder-app button .mac-icon {
      width: 14px !important;
      height: 14px !important;
      min-width: 14px !important;
      min-height: 14px !important;
    }
    
    /* Ensure all SVG icons in the app have the right size */
    .finder-app svg {
      width: 14px !important;
      height: 14px !important;
    }
  `}</style>
); 