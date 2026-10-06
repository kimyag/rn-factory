import { useText } from '@factory/app';
import { Text } from '@factory/ui';

import { usePremium } from './payments-state.tsx';
import { premiumSummary } from './payments.ts';
import { text } from './text/index.ts';

// The plan details of an active premium: renewal or end date, and any payment problem.
export function PremiumSummary() {
  const { details } = usePremium();
  const t = useText(text);

  if (details === null) {
    return null;
  }
  return (
    <>
      {premiumSummary(details).map(({ key, date }) => (
        <Text key={key} variant="caption">
          {t(key, { date: date === null ? '' : new Date(date).toLocaleDateString() })}
        </Text>
      ))}
    </>
  );
}
