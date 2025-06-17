interface ParsedNode {
  content: string;
  type: string;
  attrs?: Record<string, any>;
  indent?: number;
  children?: ParsedNode[];
}

interface StructuredContent {
  nodes: ParsedNode[];
  totalNodes: number;
}

/**
 * Parses text content and determines appropriate ProseMirror node types
 * for headings, lists, and other structured content
 */
export const parseStructuredContent = (text: string): StructuredContent => {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const nodes: ParsedNode[] = [];
  
  let currentListType: 'bullet' | 'ordered' | null = null;
  let listItems: ParsedNode[] = [];
  
  const flushListItems = () => {
    if (listItems.length > 0 && currentListType) {
      // Create list container with all its items as children
      const listNode: ParsedNode = {
        content: '', // List containers don't have text content
        type: currentListType === 'bullet' ? 'bullet_list' : 'ordered_list',
        children: listItems // Store list items as children
      };
      nodes.push(listNode);
      
      listItems = [];
      currentListType = null;
    }
  };
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    console.log(`[contentParser] Processing line ${index}: "${line}" -> trimmed: "${trimmed}"`);
    
    // Detect headings (# ## ### etc. or numbered headings like "I.", "1.", "A.")
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    const romanNumeralMatch = trimmed.match(/^([IVX]+)\.\s+(.+)$/i);
    const numberedHeadingMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    const letterHeadingMatch = trimmed.match(/^([A-Z])\.\s+(.+)$/);
    
    if (headingMatch) {
      flushListItems();
      const level = headingMatch[1].length;
      console.log(`[contentParser] Found markdown heading level ${level}: "${headingMatch[2]}"`);
      nodes.push({
        content: headingMatch[2],
        type: 'heading',
        attrs: { level }
      });
    } else if (romanNumeralMatch) {
      flushListItems();
      console.log(`[contentParser] Found roman numeral heading: "${romanNumeralMatch[2]}"`);
      // Roman numerals are typically level 1 headings
      nodes.push({
        content: romanNumeralMatch[2],
        type: 'heading',
        attrs: { level: 1 }
      });
    } else if (numberedHeadingMatch && /^\d+\.\s+[A-Z]/.test(trimmed)) {
      // Numbered sections like "1. Introduction" (capital letter suggests heading)
      flushListItems();
      console.log(`[contentParser] Found numbered heading: "${numberedHeadingMatch[2]}"`);
      nodes.push({
        content: numberedHeadingMatch[2],
        type: 'heading',
        attrs: { level: 2 }
      });
    } else if (letterHeadingMatch && /^[A-Z]\.\s+[A-Z]/.test(trimmed)) {
      // Letter sections like "A. Introduction" (capital letter suggests heading)
      flushListItems();
      console.log(`[contentParser] Found letter heading: "${letterHeadingMatch[2]}"`);
      nodes.push({
        content: letterHeadingMatch[2],
        type: 'heading',
        attrs: { level: 3 }
      });
    } else {
      // Detect lists - check original line for indentation, then trimmed line for bullets
      const originalBulletMatch = line.match(/^\s*[-*+•]\s+(.+)$/);
      const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
      
      if (originalBulletMatch) {
        const content = originalBulletMatch[1];
        console.log(`[contentParser] Found bullet item: "${line}" -> content: "${content}"`);
        if (currentListType !== 'bullet') {
          flushListItems();
          currentListType = 'bullet';
          console.log(`[contentParser] Started new bullet list`);
        }
        listItems.push({
          content,
          type: 'list_item'
        });
      } else if (numberedMatch && !(/^[A-Z]/.test(numberedMatch[2]))) {
        // Numbered list item (but not if it looks like a heading)
        console.log(`[contentParser] Found numbered item: "${trimmed}" -> content: "${numberedMatch[2]}"`);
        if (currentListType !== 'ordered') {
          flushListItems();
          currentListType = 'ordered';
          console.log(`[contentParser] Started new ordered list`);
        }
        listItems.push({
          content: numberedMatch[2],
          type: 'list_item'
        });
      } else {
        // Regular paragraph
        console.log(`[contentParser] Regular paragraph: "${trimmed}"`);
        flushListItems();
        nodes.push({
          content: trimmed,
          type: 'paragraph'
        });
      }
    }
  });
  
  // Flush any remaining list items
  flushListItems();
  
  return {
    nodes,
    totalNodes: nodes.length
  };
};

/**
 * Determines if a line looks like a heading based on content patterns
 */
export const isLikelyHeading = (content: string): { isHeading: boolean; level: number } => {
  const trimmed = content.trim();
  
  // Check for markdown-style headings
  const markdownHeading = trimmed.match(/^(#{1,6})\s/);
  if (markdownHeading) {
    return { isHeading: true, level: markdownHeading[1].length };
  }
  
  // Check for numbered sections, roman numerals, etc.
  if (/^([IVX]+|[\d]+|[A-Z])\.\s+[A-Z]/.test(trimmed)) {
    return { isHeading: true, level: 2 };
  }
  
  // Check for title case and short length (likely headings)
  if (trimmed.length < 100 && /^[A-Z][a-z]/.test(trimmed) && !/[.!?]$/.test(trimmed)) {
    return { isHeading: true, level: 3 };
  }
  
  return { isHeading: false, level: 1 };
};

/**
 * Converts simple text to proper heading format
 */
export const formatAsHeading = (content: string, level: number = 2): string => {
  const trimmed = content.trim();
  // Remove any existing markdown heading markers
  const cleaned = trimmed.replace(/^#+\s*/, '');
  return '#'.repeat(level) + ' ' + cleaned;
};

// Simple test function for debugging
export const testParser = (text: string) => {
  console.log('[contentParser] Testing input:', text);
  const result = parseStructuredContent(text);
  console.log('[contentParser] Parsed result:', result);
  return result;
}; 