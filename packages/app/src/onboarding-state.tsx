import { createContext, use, useState, type ReactNode } from 'react';

type OnboardingState = {
  completed: boolean;
  complete: () => void;
};

const OnboardingContext = createContext<OnboardingState | null>(null);

// In memory until local storage (#6) persists it.
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [completed, setCompleted] = useState(false);

  return (
    <OnboardingContext value={{ completed, complete: () => setCompleted(true) }}>
      {children}
    </OnboardingContext>
  );
}

export function useOnboarding(): OnboardingState {
  const state = use(OnboardingContext);
  if (!state) {
    throw new Error('useOnboarding must be used inside OnboardingProvider');
  }
  return state;
}
