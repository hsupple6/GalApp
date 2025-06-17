import React from 'react';

// Base icon component
interface IconProps {
  className?: string;
  size?: number;
  color?: string;
}

// Folder icon
export const FolderIcon: React.FC<IconProps> = ({ className, size = 24, color }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M20 6H12L10 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6Z" 
      fill={color || "currentColor"} 
    />
  </svg>
);

// Document icon
export const DocumentIcon: React.FC<IconProps> = ({ className, size = 24, color }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20Z" 
      fill={color || "currentColor"} 
    />
  </svg>
);

// Image icon
export const ImageIcon: React.FC<IconProps> = ({ className, size = 24, color }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19ZM8.5 13.5L11 16.51L14.5 12L19 18H5L8.5 13.5Z" 
      fill={color || "currentColor"} 
    />
  </svg>
);

// Video icon
export const VideoIcon: React.FC<IconProps> = ({ className, size = 24, color }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M18 4L20 8H17L15 4H13L15 8H12L10 4H8L10 8H7L5 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V4H18Z" 
      fill={color || "currentColor"} 
    />
  </svg>
);

// Audio icon
export const AudioIcon: React.FC<IconProps> = ({ className, size = 24, color }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M12 3V13.55C11.41 13.21 10.73 13 10 13C7.79 13 6 14.79 6 17C6 19.21 7.79 21 10 21C12.21 21 14 19.21 14 17V7H18V3H12Z" 
      fill={color || "currentColor"} 
    />
  </svg>
);

// Code icon
export const CodeIcon: React.FC<IconProps> = ({ className, size = 24, color }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M9.4 16.6L4.8 12L9.4 7.4L8 6L2 12L8 18L9.4 16.6ZM14.6 16.6L19.2 12L14.6 7.4L16 6L22 12L16 18L14.6 16.6Z" 
      fill={color || "currentColor"} 
    />
  </svg>
);

// Archive icon
export const ArchiveIcon: React.FC<IconProps> = ({ className, size = 24, color }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M20 6H4V8H20V6ZM18 10H6V12H18V10ZM20 2H4C2.9 2 2 2.9 2 4V20C2 21.1 2.9 22 4 22H20C21.1 22 22 21.1 22 20V4C22 2.9 21.1 2 20 2ZM20 20H4V4H20V20Z" 
      fill={color || "currentColor"} 
    />
  </svg>
);

// PDF icon
export const PDFIcon: React.FC<IconProps> = ({ className, size = 24, color }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M20 2H8C6.9 2 6 2.9 6 4V16C6 17.1 6.9 18 8 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H8V4H20V16ZM4 6H2V20C2 21.1 2.9 22 4 22H18V20H4V6ZM16 12V9C16 8.45 15.55 8 15 8H13V14H14V12H15C15.55 12 16 11.55 16 11V12ZM14 9H15V11H14V9ZM18 11H19V14H20V11H21V10H18V11ZM10 10H11C11.55 10 12 10.45 12 11V13C12 13.55 11.55 14 11 14H9V8H10V10ZM10 11V13H11V11H10Z" 
      fill={color || "currentColor"} 
    />
  </svg>
);

// Add more icons as needed
export const AddIcon: React.FC<IconProps> = ({ className, size = 24, color }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z" 
      fill={color || "currentColor"} 
    />
  </svg>
);

export const DeleteIcon: React.FC<IconProps> = ({ className, size = 24, color }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM19 4H15.5L14.5 3H9.5L8.5 4H5V6H19V4Z" 
      fill={color || "currentColor"} 
    />
  </svg>
);

export const HomeIcon: React.FC<IconProps> = ({ className, size = 24, color }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M10 20V14H14V20H19V12H22L12 3L2 12H5V20H10Z" 
      fill={color || "currentColor"} 
    />
  </svg>
);

export const DesktopIcon: React.FC<IconProps> = ({ className, size = 24, color }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M21 2H3C1.9 2 1 2.9 1 4V16C1 17.1 1.9 18 3 18H10V20H8V22H16V20H14V18H21C22.1 18 23 17.1 23 16V4C23 2.9 22.1 2 21 2ZM21 16H3V4H21V16Z" 
      fill={color || "currentColor"} 
    />
  </svg>
);

export const DocumentsIcon: React.FC<IconProps> = ({ className, size = 24, color }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M8 16H16V18H8V16ZM8 12H16V14H8V12ZM14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20Z" 
      fill={color || "currentColor"} 
    />
  </svg>
);

export const DownloadsIcon: React.FC<IconProps> = ({ className, size = 24, color }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M19 9H15V3H9V9H5L12 16L19 9ZM5 18V20H19V18H5Z" 
      fill={color || "currentColor"} 
    />
  </svg>
);

export const BackIcon: React.FC<IconProps> = ({ className, size = 24, color }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M20 11H7.83L13.42 5.41L12 4L4 12L12 20L13.41 18.59L7.83 13H20V11Z" 
      fill={color || "currentColor"} 
    />
  </svg>
);

export const ForwardIcon: React.FC<IconProps> = ({ className, size = 24, color }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M12 4L10.59 5.41L16.17 11H4V13H16.17L10.59 18.59L12 20L20 12L12 4Z" 
      fill={color || "currentColor"} 
    />
  </svg>
);

export const UpIcon: React.FC<IconProps> = ({ className, size = 24, color }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M7.41 15.41L12 10.83L16.59 15.41L18 14L12 8L6 14L7.41 15.41Z" 
      fill={color || "currentColor"} 
    />
  </svg>
);

export const ViewListIcon: React.FC<IconProps> = ({ className, size = 24, color }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M3 14H7V10H3V14ZM3 19H7V15H3V19ZM3 9H7V5H3V9ZM8 14H21V10H8V14ZM8 19H21V15H8V19ZM8 5V9H21V5H8Z" 
      fill={color || "currentColor"} 
    />
  </svg>
);

export const ViewGridIcon: React.FC<IconProps> = ({ className, size = 24, color }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M3 3V11H11V3H3ZM9 9H5V5H9V9ZM3 13V21H11V13H3ZM9 19H5V15H9V19ZM13 3V11H21V3H13ZM19 9H15V5H19V9ZM13 13V21H21V13H13ZM19 19H15V15H19V19Z" 
      fill={color || "currentColor"} 
    />
  </svg>
);

export const ViewColumnIcon: React.FC<IconProps> = ({ className, size = 24, color }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M4 5V18H21V5H4ZM14 7V16H11V7H14ZM9 7V16H6V7H9ZM19 16H16V7H19V16Z" 
      fill={color || "currentColor"} 
    />
  </svg>
); 