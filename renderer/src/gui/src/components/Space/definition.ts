import FileDetailsAction from './actions/FileDetailsAction';
import GetAppsAction from './actions/GetAppsAction';
import GetExtensionAppsAction from './actions/GetExtensionAppsAction';
import GetFilesAction from './actions/GetFilesAction';
import OpenFileAction from './actions/OpenFileAction';

const apps = [GetAppsAction, GetExtensionAppsAction, GetFilesAction, OpenFileAction, FileDetailsAction];

export async function registerActions() {
  await new Promise((resolve) => setTimeout(resolve, 100));

  window.localStorage.setItem(
    'APP:SpaceApp',
    JSON.stringify(apps.reduce((acc, action) => ({ ...acc, [action.name]: action }), {})),
  );
}
