import React from 'react';
import Redirect from '../components/Redirect/Redirect';

const LoginPage = () => {
  return (
    <Redirect
      loginWithRedirectOpts={{
        appState: {
          returnTo: '/login',
        },
        authorizationParams: {
          screen_hint: 'login',
        },
      }}
      description="Please wait while we redirect you to the login page."
    />
  );
};

export default LoginPage;
