import { create } from 'zustand'

type UiState = {
  commandOpen: boolean
  navOpen: boolean
  setCommandOpen: (open: boolean) => void
  setNavOpen: (open: boolean) => void
  toggleCommand: () => void
}

export const useUiStore = create<UiState>((set) => ({
  commandOpen: false,
  navOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setNavOpen: (navOpen) => set({ navOpen }),
  toggleCommand: () => set((state) => ({ commandOpen: !state.commandOpen })),
}))
