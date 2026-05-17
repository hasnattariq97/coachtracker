import React, { createContext, useContext } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  return <div>{children}</div>;
};

export const useAuth = () => {
  return {};
};
