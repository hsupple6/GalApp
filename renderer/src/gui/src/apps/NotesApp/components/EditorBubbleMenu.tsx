import { BubbleMenu, Editor } from '@tiptap/react';
import React from 'react';

const EditorBubbleMenu: React.FC<{ editor: Editor }> = ({ editor }) => {
  return (
    <BubbleMenu editor={editor} className="toolbar-menu-bubble">
      {/* menu items */}
    </BubbleMenu>
  );
};

export default EditorBubbleMenu; 