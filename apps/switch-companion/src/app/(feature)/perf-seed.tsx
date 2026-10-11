import { useEffect } from 'react';
import { router } from 'expo-router';

import { taskStore } from '@/feature/task-store';

export default function PerformanceSeedRoute() {
  useEffect(() => {
    if (__DEV__) taskStore.seedDevelopmentData(true, Date.now());
    router.replace('/(feature)/loose-ends');
  }, []);
  return null;
}
