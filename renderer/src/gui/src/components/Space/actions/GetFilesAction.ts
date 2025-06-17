import { type Static, Type } from '@sinclair/typebox';

import { AppActionDefinition } from '../../../types';

const name = 'GET_FILES';

const schema = Type.Object({
  ACTION_NAME: Type.String(),
  arguments: Type.Object({
    path: Type.String(),
  }),
  response: Type.Union([
    Type.String(),
    Type.Array(
      Type.Object({
        type: Type.Union([Type.Literal('file'), Type.Literal('directory')]),
        name: Type.String(),
      }),
    ),
  ]),
});

const GetFilesAction: AppActionDefinition = {
  name,
  description: [
    'get list of files',
    '"path" argument is a path that navigates to current directory',
    `first file on the top and last file at the bottom, count the files as 'first', 'second', 'third', and so on`,
    'initial "path" is "/"',
    `don't guess directories when asked for a recursive search, use provided list of files and directories available for the user`,
    `if string is returned in "response", it means an error and something went wrong`,
    `don't ask files for the same path twice, use already received information`,
    `if you asked to provide file names, don't try to open them`,
  ].join('\n'),
  schema,
};

export default GetFilesAction;

export type IGetFilesAction = Static<typeof schema>;
