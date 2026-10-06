export async function consentRequest<T>(active: () => boolean, send: () => Promise<T>, dropped: T): Promise<T> {
  return active() ? send() : dropped;
}
