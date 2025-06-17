import { type Static, Type } from '@sinclair/typebox';

import { AppActionDefinition } from '../../../types';

const name = 'GET_EXTENSION_APPS';

const schema = Type.Object({
  ACTION_NAME: Type.String(),
  arguments: Type.Object({
    ext: Type.String(),
  }),
  response: Type.Union([Type.Null(), Type.String()]),
});

const GetExtensionAppsAction: AppActionDefinition = {
  name,
  description: [
    'get list of apps that support opening file with specific extension as array of strings',
    '"ext" should be in the format: dot and file extension. for example: .txt',
    'all the name of the apps are just an example and are not known until assistant will ask for them explicitly',
  ].join('\n'),
  schema,
};

export default GetExtensionAppsAction;

export type IGetExtensionAppsAction = Static<typeof schema>;
