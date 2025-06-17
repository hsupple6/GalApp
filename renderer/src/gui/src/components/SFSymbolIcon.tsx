import React from 'react';

// Add some CSS for the SF Symbol icons
const styles = `
.sf-symbol-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.sf-symbol-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
`;

interface SFSymbolIconProps {
  name: string;
  className?: string;
  size?: number;
  color?: string;
}

/**
 * Component for displaying SF Symbol icons
 * @param name - The name of the SF Symbol icon (without .svg extension)
 * @param className - Additional CSS classes
 * @param size - Icon size in pixels
 * @param color - Icon color
 */
const SFSymbolIcon: React.FC<SFSymbolIconProps> = ({ 
  name, 
  className = '', 
  size = 24, 
  color = 'currentColor' 
}) => {
  // Import the SVG icon from the public directory
  const iconPath = `/icons/${name}.svg`;
  
  return (
    <>
      <style>{styles}</style>
      <div 
        className={`sf-symbol-icon ${className}`}
        style={{ 
          width: size, 
          height: size, 
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <img 
          src={iconPath} 
          alt={name} 
          width={size} 
          height={size} 
          style={{ 
            filter: color === 'currentColor' ? 'none' : `invert(1) brightness(0) saturate(100%) ${getColorFilter(color)}`,
          }}
        />
      </div>
    </>
  );
};

/**
 * Helper function to convert a color to a CSS filter
 * This allows us to change the color of the SVG icons
 */
function getColorFilter(color: string): string {
  // For named colors, we need to convert to RGB
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    
    return `sepia(100%) hue-rotate(${getHueRotate(r, g, b)}deg) saturate(${getSaturation(r, g, b)}%) brightness(${getBrightness(r, g, b)}%)`;
  }
  
  // For currentColor, we don't apply a filter
  if (color === 'currentColor') {
    return '';
  }
  
  // For other colors, we use a simple approach
  switch (color) {
    case 'blue':
      return 'sepia(100%) hue-rotate(190deg) saturate(900%)';
    case 'red':
      return 'sepia(100%) hue-rotate(320deg) saturate(900%)';
    case 'green':
      return 'sepia(100%) hue-rotate(90deg) saturate(900%)';
    case 'yellow':
      return 'sepia(100%) hue-rotate(40deg) saturate(900%)';
    case 'purple':
      return 'sepia(100%) hue-rotate(260deg) saturate(900%)';
    case 'orange':
      return 'sepia(100%) hue-rotate(20deg) saturate(900%)';
    case 'white':
      return 'brightness(0) invert(1)';
    case 'black':
      return 'brightness(0)';
    default:
      return '';
  }
}

// Helper functions for color conversion
function getHueRotate(r: number, g: number, b: number): number {
  // Simplified hue calculation
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  
  if (max === min) return 0;
  
  let hue = 0;
  if (max === r) {
    hue = (g - b) / (max - min) * 60;
  } else if (max === g) {
    hue = (2 + (b - r) / (max - min)) * 60;
  } else {
    hue = (4 + (r - g) / (max - min)) * 60;
  }
  
  if (hue < 0) hue += 360;
  return hue;
}

function getSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  
  if (max === 0) return 0;
  
  return ((max - min) / max) * 100;
}

function getBrightness(r: number, g: number, b: number): number {
  return Math.max(r, g, b) * 100;
}

export default SFSymbolIcon; 