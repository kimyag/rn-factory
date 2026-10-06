import { useReducedMotion } from 'react-native-reanimated';

import { useTheme } from './theme-provider.tsx';

// The change to the app color: 400 ms, or only the 150 ms fade with reduced motion.
export function useAchievementDuration(): number {
  const { motion } = useTheme();
  return useReducedMotion() ? motion.fade : motion.achieve;
}
