import { create } from "zustand";
import { Employee, EquipmentUnit, Task, Group } from "./types";

interface AppStore {
  // Reference data (loaded once, shared across pages)
  employees: Employee[];
  equipmentUnits: EquipmentUnit[];
  tasks: Task[];
  groups: Group[];
  refDataLoaded: boolean;

  setEmployees: (e: Employee[]) => void;
  setEquipmentUnits: (u: EquipmentUnit[]) => void;
  setTasks: (t: Task[]) => void;
  setGroups: (g: Group[]) => void;
  setRefDataLoaded: (v: boolean) => void;
  invalidateRefData: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  employees: [],
  equipmentUnits: [],
  tasks: [],
  groups: [],
  refDataLoaded: false,

  setEmployees:     (e) => set({ employees: e }),
  setEquipmentUnits:(u) => set({ equipmentUnits: u }),
  setTasks:         (t) => set({ tasks: t }),
  setGroups:        (g) => set({ groups: g }),
  setRefDataLoaded: (v) => set({ refDataLoaded: v }),
  invalidateRefData: () => set({ refDataLoaded: false }),
}));
