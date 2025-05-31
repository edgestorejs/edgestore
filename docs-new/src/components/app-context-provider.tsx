'use client';

import { createContext, useContext, type ReactNode } from 'react';

interface AppContextType {
  githubStars: number | undefined;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppContextProviderProps {
  children: ReactNode;
  githubStars: number;
}

export function AppContextProvider({
  children,
  githubStars,
}: AppContextProviderProps) {
  return (
    <AppContext.Provider value={{ githubStars }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
}
