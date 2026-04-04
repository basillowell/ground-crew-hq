import { createContext, ReactNode, useContext } from 'react';

type OperationsContextValue = {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  department: string;
  setDepartment: (department: string) => void;
};

const OperationsContext = createContext<OperationsContextValue | undefined>(undefined);

export function OperationsProvider({ value, children }: { value: OperationsContextValue; children: ReactNode }) {
  return <OperationsContext.Provider value={value}>{children}</OperationsContext.Provider>;
}

export function useOperations() {
  const context = useContext(OperationsContext);
  if (!context) {
    throw new Error('useOperations must be used within an OperationsProvider');
  }
  return context;
}
