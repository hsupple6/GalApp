import { type Static, Type } from '@sinclair/typebox';

import { AppActionDefinition } from '../../../types';

const name = 'FILE_DETAILS';

const schema = Type.Object({
  ACTION_NAME: Type.String(),
  arguments: Type.Object({
    filePath: Type.String(),
  }),
  response: Type.Union([Type.Null(), Type.Any()]),
});

const FileDetailsAction: AppActionDefinition = {
  name,
  description: [
    'get file context, summary and details',
    'use simple format when returning response',
    '"filePath" is the full file path, including all parent directories',
  ].join('\n'),
  schema,
};

export default FileDetailsAction;

export type IFileDetailsAction = Static<typeof schema>;
