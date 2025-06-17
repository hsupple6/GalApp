import { useEffect, useRef } from 'react';

import { AppAction, AppActionDefinition } from '../types';

export const FALLBACK_ACTION_REPLY_TIMEOUT = 3000;

export function dispatchCustomEvent<T = any>(eventName: string, detail?: T): void {
  const event = new CustomEvent(eventName, {
    detail,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(event);
}

export async function dispatchCustomEventWithReply<A extends AppAction>(
  eventName: A['ACTION_NAME'],
  detail: A['arguments'],
) {
  const responseEventName = `${eventName}:RESPONSE`;

  const promise = new Promise((resolve) => {
    let timeout: any;

    const responseCallback = (event: any) => {
      clearTimeout(timeout);
      resolve(event.detail);
      document.removeEventListener(responseEventName, responseCallback);
    };

    document.addEventListener(responseEventName, responseCallback);

    timeout = setTimeout(() => {
      resolve(undefined);
      document.removeEventListener(responseEventName, responseCallback);
    }, FALLBACK_ACTION_REPLY_TIMEOUT);
  });

  dispatchCustomEvent(eventName, detail);

  return promise;
}

export const unregisterActions = () => {
  // we need to clea-up all the actions on every page reload
  // apps that are still installed will have to register all over again
  // make sure unregisterActions() is called before any call of registerActions()
  return Object.keys(localStorage)
    .filter((storageKey) => storageKey.startsWith('APP:'))
    .map((storageKey) => localStorage.removeItem(storageKey));
};

export const getAllApps = () => {
  return [
    ...Object.keys(localStorage)
      .filter((storageKey) => storageKey.startsWith('APP:'))
      .map((storageKey) => storageKey.replace('APP:', '')),
    'pdfium',
    'browser',
    'notes',
  ];
};

export const getAppActionKeys = () => {
  return Object.entries(localStorage)
    .filter(([storageKey]) => storageKey.startsWith('APP:'))
    .map(([storageKey, storageStringValue]: [string, string]) => {
      return Object.keys(JSON.parse(storageStringValue) as Record<string, AppActionDefinition>);
    })
    .flat();
};

export const getIntroSystemMessage = () => {
  const appsDivider = '\n\n-----\n-----\n\n';

  return (
    'All supported actions per app:' +
    appsDivider +
    Object.entries(localStorage)
      .filter(([storageKey]) => storageKey.startsWith('APP:'))
      .map(([storageKey, storageStringValue]: [string, string]) => {
        const storageValue = JSON.parse(storageStringValue);

        return (
          `${storageKey} : \n\n---\n\n` +
          Object.entries(storageValue)
            .map(([actionKey, actionValue]: [string, any]) => {
              return [`"${actionKey}" :`, JSON.stringify(actionValue, null, 2)].join('\n').trim();
            })
            .join('\n\n---\n\n')
        );
      })
      .join(appsDivider) +
    appsDivider
  );
};

export const parseAppActionsString = (actionString: string) => {
  let actions: AppAction[];

  try {
    actions = JSON.parse(actionString);
  } catch (err) {
    return null;
  }

  const actionKeys = getAppActionKeys();

  const validActions = actions.filter((action) => actionKeys.includes(action.ACTION_NAME));

  return validActions?.length ? validActions : null;
};

export async function callCustomEventWithReply<A extends AppAction>(appAction: A) {
  return dispatchCustomEventWithReply(appAction.ACTION_NAME, appAction.arguments);
}

export function useCustomEventListener<A extends AppAction>(
  eventName: A['ACTION_NAME'],
  callback: (event: Event, detail: A['arguments']) => void,
) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const eventHandler = (event: any) => {
      if (callbackRef.current) {
        callbackRef.current(event, event.detail);
      }
    };

    document.addEventListener(eventName, eventHandler);

    return () => {
      document.removeEventListener(eventName, eventHandler);
    };
  }, [eventName]);
}

export function useCustomEventListenerWithReply<A extends AppAction>(
  eventName: A['ACTION_NAME'],
  callback: (event: Event, detail: A['arguments']) => A['response'],
) {
  useCustomEventListener(eventName, async (event, detail) => {
    const reply = await callback(event, detail);
    dispatchCustomEvent(`${eventName}:RESPONSE`, reply);
  });
}
