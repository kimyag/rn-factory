import { useAppSettings, useText } from '@factory/app';
import { Button, createStyles, Mark, Screen, Text, useTheme } from '@factory/ui';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePayments, useRestore } from './payments-state.tsx';
import type { Plan } from './payments.ts';
import { text } from './text/index.ts';

// The app passes its own title and one line about what premium adds.
export function PaywallScreen({ title, body }: { title: string; body: string }) {
  const { available, status, plans: loadPlans, purchase } = usePayments();
  const t = useText(text);
  const router = useRouter();
  const { spacing } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [plans, setPlans] = useState<Plan[] | 'loading' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!available) {
      return;
    }
    let current = true;
    loadPlans().then(
      (list) => {
        if (current) {
          setPlans(list);
        }
      },
      () => {
        if (current) {
          setPlans('failed');
        }
      },
    );
    return () => {
      current = false;
    };
  }, [available, loadPlans, attempt]);

  function close() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  function retry() {
    setPlans('loading');
    setAttempt(attempt + 1);
  }

  function content() {
    if (status === 'active') {
      return <Text>{t('paywall.active')}</Text>;
    }
    if (!available || (Array.isArray(plans) && plans.length === 0)) {
      return <Text>{t('paywall.unavailable')}</Text>;
    }
    if (plans === 'failed') {
      return (
        <>
          <Text>{t('paywall.loadFailed')}</Text>
          <Button variant="secondary" title={t('paywall.retry')} onPress={retry} />
        </>
      );
    }
    if (plans === 'loading' || status === 'loading') {
      return (
        <View style={styles.loading}>
          <Mark state="loading" />
        </View>
      );
    }
    return <Plans plans={plans} purchase={purchase} onPurchased={close} />;
  }

  return (
    <Screen scroll style={{ paddingTop: insets.top + spacing.edge }}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" onPress={close} hitSlop={spacing.gapWide}>
          <Text>{t('paywall.close')}</Text>
        </Pressable>
      </View>
      <Text variant="title">{title}</Text>
      <Text>{body}</Text>
      {content()}
    </Screen>
  );
}

type PlansProps = {
  plans: Plan[];
  purchase: ReturnType<typeof usePayments>['purchase'];
  onPurchased: () => void;
};

function Plans({ plans, purchase, onPurchased }: PlansProps) {
  const settings = useAppSettings();
  const restoring = useRestore();
  const t = useText(text);
  const styles = useStyles();
  // No plan is selected until the user picks one.
  const [selected, setSelected] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [failed, setFailed] = useState(false);
  const subscriptions = plans.some((plan) => plan.period !== 'lifetime');
  const lifetime = plans.some((plan) => plan.period === 'lifetime');

  async function buy() {
    const plan = plans.find((item) => item.id === selected);
    if (!plan) {
      return;
    }
    setBuying(true);
    setFailed(false);
    const result = await purchase(plan);
    setBuying(false);
    if (result === 'purchased') {
      onPurchased();
    } else if (result === 'failed') {
      setFailed(true);
    }
  }

  return (
    <>
      <View accessibilityRole="radiogroup">
        {plans.map((plan) => {
          const checked = plan.id === selected;
          return (
            <Pressable
              key={plan.id}
              accessibilityRole="radio"
              accessibilityState={{ checked, selected: checked, disabled: buying }}
              disabled={buying}
              onPress={() => setSelected(plan.id)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text>{t(`paywall.price.${plan.period}`, { price: plan.price })}</Text>
              <Mark state={checked ? 'active' : 'empty'} />
            </Pressable>
          );
        })}
      </View>
      {subscriptions && (
        <Text variant="caption">
          {t(Platform.OS === 'ios' ? 'paywall.cancel.ios' : 'paywall.cancel.android')}
        </Text>
      )}
      {lifetime && <Text variant="caption">{t('paywall.lifetime')}</Text>}
      <Button
        title={t('paywall.continue')}
        onPress={() => void buy()}
        disabled={selected === null || buying}
      />
      {failed && <Text>{t('paywall.purchaseFailed')}</Text>}
      <Button
        variant="secondary"
        title={restoring.label}
        onPress={restoring.restore}
        disabled={restoring.busy || buying}
      />
      {restoring.message !== null && <Text>{restoring.message}</Text>}
      <Pressable
        accessibilityRole="link"
        onPress={() => void WebBrowser.openBrowserAsync(settings.privacyUrl)}
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}
      >
        <Text variant="caption">{t('paywall.privacy')}</Text>
      </Pressable>
    </>
  );
}

const useStyles = createStyles((theme) => ({
  top: { alignItems: 'flex-end' },
  loading: { alignItems: 'center', paddingVertical: theme.spacing.edge },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.gapWide,
    paddingVertical: theme.spacing.gapWide,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.line,
  },
  pressed: { opacity: theme.motion.pressedOpacity },
  link: { alignSelf: 'center', paddingVertical: theme.spacing.gap },
}));
