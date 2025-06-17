import { AnyWindowEntity } from '../../../../types/windows';
import { getEntityDisplayName } from '../../utils/windowUtils';
import { 
  BrowserWindowContext, 
  ContentWindowContext, 
  DefaultWindowContext, 
  WindowContext} from '../types';

export const getWindowContext = (window: AnyWindowEntity): WindowContext | null => {
  if (!window) {
    return null;
  }

  if (window.type !== 'window') {
    return null;
  }

  // Get content based on window type
  if (window.entity) {
    if (window.appType === 'pdfium' || window.appType === 'notes') {
      const context: ContentWindowContext = {
        type: window.appType,
        name: window.entity.name,
        content: getEntityDisplayName(window.entity)
      };
      return context;
    } else if (window.appType === 'browser') {
      const context: BrowserWindowContext = {
        type: 'browser',
        url: (window.entity as any)?.skeleton?.url || '',
        title: window.title || 'Untitled Browser'
      };
      return context;
    }
  }

  // Default to just the window title and type
  const context: DefaultWindowContext = {
    type: window.appType || 'unknown',
    title: window.title || 'Untitled'
  };

  return context;
}; 