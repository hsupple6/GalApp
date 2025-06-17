import { AnyExtension } from '@tiptap/core';
import Blockquote from '@tiptap/extension-blockquote';
import Bold from '@tiptap/extension-bold';
import BulletList from '@tiptap/extension-bullet-list';
import CodeBlock from '@tiptap/extension-code-block';
import Document from '@tiptap/extension-document';
import DropCursor from '@tiptap/extension-dropcursor';
import Heading from '@tiptap/extension-heading';
import Italic from '@tiptap/extension-italic';
import ListItem from '@tiptap/extension-list-item';
import OrderedList from '@tiptap/extension-ordered-list';
import Paragraph from '@tiptap/extension-paragraph';
import Placeholder from '@tiptap/extension-placeholder';
import Strike from '@tiptap/extension-strike';
import Text from '@tiptap/extension-text';

export const createBaseExtensions = (): AnyExtension[] => [
  Document.configure({
    content: 'block+',
  }),
  Text,
  Paragraph.configure({
    HTMLAttributes: { class: 'notes-block-text' },
  }),
  Heading.configure({
    levels: [1, 2, 3, 4, 5, 6],
    HTMLAttributes: { class: 'notes-block-heading' },
  }),
  BulletList.configure({
    HTMLAttributes: { class: 'notes-block-list' },
  }),
  OrderedList.configure({
    HTMLAttributes: { class: 'notes-block-list' },
  }),
  ListItem,
  Blockquote.configure({
    HTMLAttributes: { class: 'notes-block-quote' },
  }),
  CodeBlock.configure({
    HTMLAttributes: { class: 'notes-block-code' },
  }),
  Bold.configure(),
  Italic.configure(),
  Strike.configure(),
  DropCursor.configure(),
  Placeholder.configure({
    placeholder: 'Start typing here...',
  }),
]; 