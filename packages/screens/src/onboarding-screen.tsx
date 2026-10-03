import { useAppSettings, useOnboarding, useTelemetry, useText } from '@factory/app';
import { needsAnalyticsChoice } from '@factory/core/telemetry';
import {
  Button,
  createStyles,
  Mark,
  Screen,
  Text,
  useAchievementDuration,
  useTheme,
} from '@factory/ui';
import { Image, type ImageSource } from 'expo-image';
import { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { text } from './text/index.ts';

export type OnboardingPage = {
  title: string;
  body: string;
  image?: ImageSource | number;
};

export type OnboardingPages =
  | [OnboardingPage]
  | [OnboardingPage, OnboardingPage]
  | [OnboardingPage, OnboardingPage, OnboardingPage]
  | [OnboardingPage, OnboardingPage, OnboardingPage, OnboardingPage];

type Exit = 'pages' | 'skip';

export function OnboardingScreen({ pages }: { pages: OnboardingPages }) {
  const { complete } = useOnboarding();
  const settings = useAppSettings();
  const { choice, setChoice, track } = useTelemetry();
  const t = useText(text);
  const { spacing } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const achievementDuration = useAchievementDuration();
  const list = useRef<FlatList<OnboardingPage>>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [index, setIndex] = useState(0);
  // How the user reached the analytics question; null while the pages show.
  const [asking, setAsking] = useState<Exit | null>(null);
  const [leaving, setLeaving] = useState<Exit | null>(null);
  const last = index === pages.length - 1;
  const pageStyle = [styles.page, { width: pageWidth }];

  // Finishing the pages is the achievement moment; skipping them has no motion.
  function leave(exit: Exit) {
    setLeaving(exit);
    if (exit === 'skip') {
      complete();
      return;
    }
    void track('onboarding_completed');
    setTimeout(complete, achievementDuration);
  }

  function end(exit: Exit) {
    if (needsAnalyticsChoice(settings.modules.analytics, choice)) {
      setAsking(exit);
      return;
    }
    leave(exit);
  }

  function choose(value: boolean) {
    if (asking === null) {
      return;
    }
    setChoice(value);
    leave(asking);
  }

  function next() {
    if (last) {
      end('pages');
      return;
    }
    list.current?.scrollToIndex({ index: index + 1 });
    setIndex(index + 1);
  }

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (pageWidth > 0) {
      setIndex(Math.round(event.nativeEvent.contentOffset.x / pageWidth));
    }
  }

  return (
    <Screen style={{ paddingTop: insets.top + spacing.edge }}>
      <View style={styles.top}>
        {asking === null && (
          <Pressable
            accessibilityRole="button"
            onPress={() => end('skip')}
            disabled={leaving !== null}
            hitSlop={spacing.gapWide}
          >
            <Text>{t('onboarding.skip')}</Text>
          </Pressable>
        )}
      </View>
      {asking === null ? (
        <FlatList
          ref={list}
          style={styles.pager}
          data={pages}
          horizontal
          pagingEnabled
          scrollEnabled={leaving === null}
          showsHorizontalScrollIndicator={false}
          onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}
          onMomentumScrollEnd={onScrollEnd}
          getItemLayout={(_, item) => ({ length: pageWidth, offset: pageWidth * item, index: item })}
          keyExtractor={(page) => page.title}
          renderItem={({ item }) => <Page page={item} style={pageStyle} />}
        />
      ) : (
        <View style={styles.question}>
          <Text variant="title">{t('analytics.title')}</Text>
          <Text>{t('analytics.explanation')}</Text>
        </View>
      )}
      <View
        style={styles.marks}
        accessible
        accessibilityLabel={t('onboarding.progress', { current: index + 1, total: pages.length })}
      >
        {pages.map((page, item) => (
          <Mark
            key={page.title}
            state={leaving === 'pages' ? 'complete' : item === index ? 'active' : 'empty'}
          />
        ))}
      </View>
      {asking === null ? (
        <Button
          title={last ? t('onboarding.done') : t('onboarding.next')}
          onPress={next}
          disabled={leaving !== null}
        />
      ) : (
        <View style={styles.choices}>
          <Button
            variant="secondary"
            title={t('analytics.share')}
            onPress={() => choose(true)}
            disabled={leaving !== null}
          />
          <Button
            variant="secondary"
            title={t('analytics.dontShare')}
            onPress={() => choose(false)}
            disabled={leaving !== null}
          />
        </View>
      )}
    </Screen>
  );
}

function Page({ page, style }: { page: OnboardingPage; style: StyleProp<ViewStyle> }) {
  const styles = useStyles();

  return (
    <View style={style}>
      {page.image !== undefined && (
        <Image source={page.image} style={styles.image} contentFit="contain" />
      )}
      <Text variant="title">{page.title}</Text>
      <Text>{page.body}</Text>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  top: { alignItems: 'flex-end' },
  pager: { flex: 1 },
  page: { justifyContent: 'center', gap: theme.spacing.gapWide },
  question: { flex: 1, justifyContent: 'center', gap: theme.spacing.gapWide },
  image: { width: '100%', aspectRatio: 4 / 3 },
  marks: { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.gap },
  choices: { gap: theme.spacing.gapWide },
}));
