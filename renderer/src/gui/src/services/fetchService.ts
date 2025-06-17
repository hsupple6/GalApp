import { logger } from '../utils/logger';

// Add a connection pool manager to limit concurrent requests
const FetchConnectionPool = {
  maxConcurrentRequests: 6, // Limit concurrent requests
  activeRequests: 0,
  pendingQueue: [] as (() => void)[],
  
  // Request a connection slot
  acquireConnection(): Promise<() => void> {
    return new Promise((resolve) => {
      // If we have capacity, grant immediately
      if (this.activeRequests < this.maxConcurrentRequests) {
        this.activeRequests++;
        // Return a release function
        resolve(() => {
          this.activeRequests--;
          this.processQueue();
        });
      } else {
        // Otherwise queue the request
        this.pendingQueue.push(() => {
          this.activeRequests++;
          // Return a release function
          resolve(() => {
            this.activeRequests--;
            this.processQueue();
          });
        });
      }
    });
  },
  
  // Process the pending queue when connections are released
  processQueue() {
    if (this.pendingQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const next = this.pendingQueue.shift();
      if (next) next();
    }
  }
};

export default async function fetchService(url: string, init?: RequestInit): Promise<any> {
  const authToken = localStorage.getItem('authToken');
  
  // Acquire a connection from the pool
  let releaseConnection: (() => void) | null = null;
  
  try {
    // Wait for an available connection slot
    releaseConnection = await FetchConnectionPool.acquireConnection();
    
    logger.log(`Making ${init?.method || 'GET'} request to: ${url}`);
    
    // Log detailed request information for debugging
    logger.log('[fetchService] Request details:', {
      method: init?.method || 'GET',
      url,
      headers: init?.headers,
      hasAuthToken: !!authToken,
      mode: init?.mode || 'cors',
      credentials: init?.credentials || 'include'
    });
    
    // Add a timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for AI responses
    
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          // Only add Content-Type for non-FormData requests that have a body
          ...(init?.body && !(init.body instanceof FormData) 
            ? { 'Content-Type': 'application/json' } 
            : {}),
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...init?.headers,
        },
        // Always include credentials to enable cookies/auth
        credentials: 'include',
        // Explicitly set cors mode
        mode: 'cors',
        signal: controller.signal,
        // Prevent browser from keeping connections alive too long
        cache: 'no-store',
        keepalive: false
      });
      
      // Clear the timeout
      clearTimeout(timeoutId);

      // Log detailed response information for debugging
      logger.log('[fetchService] Response details:', {
        url,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('Content-Type'),
        headers: Array.from(response.headers.entries()).reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
      });

      if (!response.ok) {
        // Create a custom error with the response attached
        const error: any = new Error(`Request failed with status: ${response.status}`);
        error.status = response.status;
        error.statusText = response.statusText;
        error.response = response.clone(); // Clone so we can still read it later

        // First try to get error as JSON
        try {
          const contentType = response.headers.get('Content-Type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            error.data = errorData;
            
            if (errorData.error) {
              error.message = `${error.message}. ${errorData.error}`;
              if (errorData.details) {
                error.message += `: ${errorData.details}`;
              }
            }
          } else {
            // If not JSON, use text
            const errorText = await response.text();
            if (errorText) {
              error.data = errorText;
              error.message = `${error.message}. ${errorText}`;
            }
          }
          
          // Handle authentication errors specifically
          if (response.status === 401) {
            logger.error('Authentication error:', error.message);
            // Consider redirecting to login or refreshing token here if needed
          }
          
        } catch (e) {
          // If parsing fails, keep the original error
          logger.warn('Error parsing response body:', e);
        }
        
        throw error;
      }

      const contentType = response.headers.get('Content-Type');

      if (contentType?.includes('application/json')) {
        try {
          const jsonResponse = await response.json();
          logger.log(`JSON response from ${url}:`, jsonResponse);
          return jsonResponse;
        } catch (error: unknown) {
          const jsonError = error instanceof Error ? error : new Error(String(error));
          logger.error(`Error parsing JSON from ${url}:`, jsonError);
          throw new Error(`Failed to parse JSON response: ${jsonError.message}`);
        }
      }

      // Handle binary files and files that should be returned as byte arrays
      if (contentType?.includes('application/octet-stream') || 
          contentType?.toLowerCase()?.includes('pdf') ||
          contentType?.toLowerCase()?.includes('image/') ||
          contentType?.toLowerCase()?.includes('application/x-python') ||
          contentType?.toLowerCase()?.includes('text/x-python')) {
        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      }

      // For URLs ending with specific file extensions that should be treated as text
      // Check if the URL ends with a known code file extension
      const codeFileExtensions = ['.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.json', '.md', '.txt', '.csv'];
      const isCodeFile = codeFileExtensions.some(ext => url.toLowerCase().endsWith(ext));

      if (isCodeFile) {
        // For code files, we still want to return the raw ArrayBuffer to ensure consistent handling
        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      }

      // For other content types, return as text
      const textResponse = await response.text();
      logger.log(`Text response from ${url}:`, textResponse);
      return textResponse;
    } catch (error: unknown) {
      // Clear the timeout if there was an error
      clearTimeout(timeoutId);
      
      // Check for AbortError (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error(`Request timeout for ${url} (exceeded 60 seconds)`);
        throw new Error(`Request timeout: The server took too long to respond`);
      }
      
      logger.error(`Fetch error for ${url}:`, error);
      throw error;
    }
  } finally {
    // Always release the connection back to the pool
    if (releaseConnection) {
      releaseConnection();
    }
  }
}
