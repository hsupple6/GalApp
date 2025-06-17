// src/components/ProtectedRoute.tsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const authToken = localStorage.getItem('authToken');
  const location = useLocation();

  // If no token, store the current URL and redirect to login
  if (!authToken) {
    localStorage.setItem('redirectAfterLogin', location.pathname); // Save the current URL
    return <Navigate to="/login" />;
  }

  // Otherwise, render the protected component
  return children;
};

export default ProtectedRoute;
