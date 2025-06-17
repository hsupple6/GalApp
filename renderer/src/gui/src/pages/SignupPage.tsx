import React from 'react';
import Redirect from '../components/Redirect/Redirect';

const SignupPage = () => {
  return (
    <Redirect
      loginWithRedirectOpts={{
        appState: {
          returnTo: '/signup',
        },
        authorizationParams: {
          screen_hint: 'signup',
        },
      }}
      description="Please wait while we redirect you to the signup page."
    />
  );
};

export default SignupPage;
