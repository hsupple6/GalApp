import { type Static, Type } from '@sinclair/typebox';

import { AppActionDefinition } from '../../../types';

const name = 'OPEN_FILE';

const schema = Type.Object({
  ACTION_NAME: Type.String(),
  arguments: Type.Object({
    appName: Type.String(),
    filePath: Type.String(),
    entityId: Type.String(),
  }),
  response: Type.Never(),
});

const OpenFileAction: AppActionDefinition = {
  name,
  description: 'Open file in appropriate app',
  schema,
};

export default OpenFileAction;

export interface IOpenFileAction {
  arguments: {
    appName: string;
    filePath: string;
    entityId: string;
  };
}
