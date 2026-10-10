import { useText, useAppSettings } from '@factory/app';
import { usePayments, usePremium } from '@factory/payments';
import { Button, Text, useTheme } from '@factory/ui';
import { createContext, use, useRef, useState, type ReactNode } from 'react';
import Constants from 'expo-constants';
import { Modal, StyleSheet, View } from 'react-native';

import { AiError, createAiClient, resolveAiServerUrl, type AiErrorCode, type DumpSplit, type Transcription } from './client.ts';
import { text } from './text/index.ts';
import type { TeammateProfile } from './schema.ts';

type AiState = {
  available: boolean;
  profile: (input: string, onPartialJson?: (chunk: string) => void) => Promise<TeammateProfile>;
  answer: (input: string, onPartialText?: (chunk: string) => void) => Promise<string>;
  transcribe: (audio: Blob) => Promise<Transcription>;
  split: (input: string, detectedLanguage?: string) => Promise<DumpSplit>;
  message: (error: unknown) => string;
  openPaywall: () => void;
};

const AiContext = createContext<AiState | null>(null);

export function AiProvider({ children }: { children: ReactNode }) {
  const settings = useAppSettings();
  const payments = usePayments();
  const premium = usePremium();
  const t = useText(text);
  const theme = useTheme();
  const [client] = useState(() => {
    const serverUrl = resolveAiServerUrl(settings.ai.serverUrl, Constants.expoConfig?.hostUri, __DEV__);
    return settings.modules.ai && serverUrl
      ? createAiClient({
        serverUrl,
        openModelBaseUrl: settings.ai.openModelBaseUrl,
        openModel: settings.ai.openModel,
        identify: payments.identify,
        allowInsecureHttp: __DEV__,
        onRequest: __DEV__ ? (path, status) => {
          // eslint-disable-next-line no-console -- Development diagnostics contain only a fixed route and HTTP status.
          console.info(`[AI request] ${path} ${status}`);
        } : undefined,
      })
      : null;
  });
  const resolver = useRef<((accepted: boolean) => void) | null>(null);
  const [visible, setVisible] = useState(false);
  const cardStyle = {
    gap: theme.spacing.gapWide,
    padding: theme.spacing.edge,
  };

  function confirmDisclosure(): Promise<boolean> {
    return new Promise((resolve) => {
      resolver.current = resolve;
      setVisible(true);
    });
  }

  function answerDisclosure(accepted: boolean) {
    setVisible(false);
    resolver.current?.(accepted);
    resolver.current = null;
  }

  async function profile(input: string, onPartialJson?: (chunk: string) => void): Promise<TeammateProfile> {
    if (!client) throw new AiError('unavailable');
    if (!await confirmDisclosure()) throw new AiError('cancelled');
    return client.profile(input, onPartialJson);
  }

  async function answer(input: string, onPartialText?: (chunk: string) => void): Promise<string> {
    if (!client) throw new AiError('unavailable');
    if (!await confirmDisclosure()) throw new AiError('cancelled');
    return client.answer(input, onPartialText);
  }

  async function transcribe(audio: Blob): Promise<Transcription> {
    if (!client) throw new AiError('unavailable');
    if (!await confirmDisclosure()) throw new AiError('cancelled');
    return client.transcribe(audio);
  }

  async function split(input: string, detectedLanguage?: string): Promise<DumpSplit> {
    if (!client) throw new AiError('unavailable');
    if (!await confirmDisclosure()) throw new AiError('cancelled');
    return client.split(input, detectedLanguage);
  }

  function message(error: unknown): string {
    const code = error instanceof AiError ? error.code : 'unavailable';
    const resetAt = error instanceof AiError ? error.resetAt : undefined;
    const premiumUser = error instanceof AiError ? error.premium : undefined;
    const time = resetAt
      ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(resetAt))
      : '';
    const messages: Record<AiErrorCode, string> = {
      unavailable: t('error.unavailable'),
      unauthorized: t('error.unauthorized'),
      too_long: t('error.too_long'),
      invalid_request: t('error.invalid_request'),
      daily_limit: t('error.daily_limit', { time }),
      budget_limit: t('error.budget_limit', { time }),
      burst_limit: t('error.burst_limit'),
      provider_error: t('error.provider_error'),
      cancelled: t('error.cancelled'),
    };
    const textForError = messages[code];
    return code === 'daily_limit' && !premiumUser && premium.available && premium.status === 'inactive'
      ? `${textForError} ${t('limit.premium')}`
      : textForError;
  }

  return (
    <AiContext value={{ available: client !== null, profile, answer, transcribe, split, message, openPaywall: premium.openPaywall }}>
      {children}
      <Modal animationType="fade" onRequestClose={() => answerDisclosure(false)} transparent visible={visible}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.paper, justifyContent: 'center', padding: theme.spacing.edge }]}>
          <View style={cardStyle}>
            <Text variant="title">{t('disclosure.title')}</Text>
            <Text>{t('disclosure.body')}</Text>
            <Button title={t('disclosure.send')} onPress={() => answerDisclosure(true)} />
            <Button title={t('disclosure.cancel')} onPress={() => answerDisclosure(false)} variant="secondary" />
          </View>
        </View>
      </Modal>
    </AiContext>
  );
}

export function useAi(): AiState {
  const value = use(AiContext);
  if (!value) throw new Error('useAi must be used inside AiProvider');
  return value;
}
