import { storedValue } from '@factory/core/storage';
import { createContext, use, useState, type ReactNode } from 'react';
import { z } from 'zod';

type OnboardingState = {
  completed: boolean;
  complete: () => void;
};

const OnboardingContext = createContext<OnboardingState | null>(null);

const storedCompleted = storedValue({ key: 'onboarding.completed', schema: z.boolean(), fallback: false });

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [completed, setCompleted] = useState(() => storedCompleted.get());

  function complete() {
    storedCompleted.set(true);
    setCompleted(true);
  }

  return <OnboardingContext value={{ completed, complete }}>{children}</OnboardingContext>;
}

export function useOnboarding(): OnboardingState {
  const state = use(OnboardingContext);
  if (!state) {
    throw new Error('useOnboarding must be used inside OnboardingProvider');
  }
  return state;
}
