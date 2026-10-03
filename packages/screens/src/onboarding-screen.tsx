import { useOnboarding, useText } from '@factory/app';
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

export function OnboardingScreen({ pages }: { pages: OnboardingPages }) {
  const { complete } = useOnboarding();
  const t = useText(text);
  const { spacing } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const achievementDuration = useAchievementDuration();
  const list = useRef<FlatList<OnboardingPage>>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const last = index === pages.length - 1;
  const pageStyle = [styles.page, { width: pageWidth }];

  function finish() {
    setFinishing(true);
    setTimeout(complete, achievementDuration);
  }

  function next() {
    if (last) {
      finish();
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
        <Pressable
          accessibilityRole="button"
          onPress={complete}
          disabled={finishing}
          hitSlop={spacing.gapWide}
        >
          <Text>{t('onboarding.skip')}</Text>
        </Pressable>
      </View>
      <FlatList
        ref={list}
        style={styles.pager}
        data={pages}
        horizontal
        pagingEnabled
        scrollEnabled={!finishing}
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, item) => ({ length: pageWidth, offset: pageWidth * item, index: item })}
        keyExtractor={(page) => page.title}
        renderItem={({ item }) => <Page page={item} style={pageStyle} />}
      />
      <View
        style={styles.marks}
        accessible
        accessibilityLabel={t('onboarding.progress', { current: index + 1, total: pages.length })}
      >
        {pages.map((page, item) => (
          <Mark
            key={page.title}
            state={finishing ? 'complete' : item === index ? 'active' : 'empty'}
          />
        ))}
      </View>
      <Button
        title={last ? t('onboarding.done') : t('onboarding.next')}
        onPress={next}
        disabled={finishing}
      />
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
  image: { width: '100%', aspectRatio: 4 / 3 },
  marks: { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.gap },
}));
