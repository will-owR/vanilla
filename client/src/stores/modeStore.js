import { writable } from "svelte/store";

const createModeStore = () => {
  const { subscribe, set, update } = writable({
    current: "demo",
    timestamp: Date.now(),
    params: {
      promptType: "demo",
      outputType: "book",
      validation: "enhanced",
    },
  });

  return {
    subscribe,
    setMode: (mode, params) =>
      update((state) => ({
        ...state,
        previousMode: state.current,
        current: mode,
        timestamp: Date.now(),
        params,
      })),
    revertToDefault: () =>
      update((state) => ({
        current: "demo",
        timestamp: Date.now(),
        params: {
          promptType: "demo",
          outputType: "book",
          validation: "standard",
        },
      })),
  };
};

export const modeStore = createModeStore();
