// Helper function to generate unique message IDs
export const generateMessageId = (() => {
  let counter = 0;
  return () => {
    counter += 1;
    return `msg-${Date.now()}-${counter}-${Math.random().toString(36).substring(2, 7)}`;
  };
})(); 