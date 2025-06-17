import { type Static, Type } from '@sinclair/typebox';

import { AppActionDefinition } from '../../../types';

const name = 'GET_APPS';

const schema = Type.Object({
  ACTION_NAME: Type.String(),
  arguments: Type.Optional(Type.Object({})),
  response: Type.Array(Type.String()),
});

const GetAppsAction: AppActionDefinition = {
  name,
  description: 'get list of apps installed in the system as array of strings',
  schema,
};

export default GetAppsAction;

export type IGetAppsAction = Static<typeof schema>;
