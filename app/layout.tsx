import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Ground Crew HQ',
  description: 'Workforce operations for grounds maintenance teams',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
}

/**
 * Runs synchronously before the app paints, preventing two visible flashes:
 *  1. `className="dark"` below is static, so a user whose stored preference is
 *     light saw dark paint first, then snap to light once useTheme's effect ran.
 *  2. Theme colours are only known after the org/user data loads, so the first
 *     paint used globals.css defaults and then jumped to the real scheme.
 *
 * Both are fixed by replaying the last known values from localStorage. Keys must
 * match useTheme.ts ('gchq-theme') and colorThemes.ts (THEME_VARS_STORAGE_KEY);
 * this is a raw string and cannot import them. Wrapped in try/catch so blocked
 * storage degrades to the old behaviour rather than breaking boot.
 */
const themeBootScript = `(function(){try{
var d=document.documentElement;
var m=localStorage.getItem('gchq-theme')||'dark';
var dark=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
d.classList.toggle('light',!dark);
var v=localStorage.getItem('gchq-theme-vars');
if(v){var p=JSON.parse(v);if(p&&p.vars&&p.mode===(dark?'dark':'light')){d.style.cssText=p.vars;}}
}catch(e){}})();`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // suppressHydrationWarning: themeBootScript intentionally mutates this
    // element's class and style before React hydrates.
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
