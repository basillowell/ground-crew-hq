export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported' as const;
  if (Notification.permission === 'granted') return 'granted' as const;
  if (Notification.permission === 'denied') return 'denied' as const;
  return Notification.requestPermission();
}

export function sendNotification(title: string, body: string, route?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  if (Notification.permission !== 'granted') return null;

  try {
    const notification = new Notification(title, {
      body,
      tag: route ? `ground-crew:${route}` : undefined,
    });

    if (route) {
      notification.onclick = () => {
        window.focus();
        window.location.assign(route);
      };
    }

    return notification;
  } catch {
    return null;
  }
}
