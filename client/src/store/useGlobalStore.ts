/**
 * A *tiny* zustand store that only keeps a `searchTerm`.
 * You can add more fields later if you need them.
 *
 *   npm i zustand            # if you don’t have it yet
 */

import { create } from "zustand";

interface GlobalState {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
}

export const useGlobalStore = create<GlobalState>((set) => ({
  searchTerm: "",
  setSearchTerm: (searchTerm) => set({ searchTerm }),
}));
