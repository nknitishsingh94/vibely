import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Playfair_Display } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/context/auth-context';
import { ChatProvider } from '@/context/chat-context';
import { ChatLockProvider } from '@/context/chat-lock-context';
import { CallProvider } from '@/context/call-context';
import { CallModal } from '@/components/chat/call-modal';
import { IncomingCallModal } from '@/components/chat/incoming-call-modal';
import { ChatLockModal } from '@/components/chat/chat-lock-modal';
import { FloatingHeartsOverlay } from '@/components/ui/floating-hearts';
import { Toaster } from '@/components/ui/toast';
import { PwaRegister } from '@/components/pwa-register';
import { CallNotificationPermissionDialog } from '@/components/chat/call-notification-permission-dialog';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const playfair = Playfair_Display({
  variable: '--font-serif',
  subsets: ['latin'],
  style: ['normal', 'italic'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0C3B2E' },
    { media: '(prefers-color-scheme: dark)', color: '#051812' },
  ],
  colorScheme: 'light dark',
  interactiveWidget: 'resizes-content',
};

export const metadata: Metadata = {
  title: 'Vibely — Where two souls sync. Pure private connection.',
  description: 'An intimate, modern private messaging sanctuary created especially for two. Share daily thoughts, photos, songs, voice notes, and treasured memories with zero noise.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Vibely',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-emerald-500/20">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem={true}
          disableTransitionOnChange
        >
          <AuthProvider>
            <ChatProvider>
              <ChatLockProvider>
                <CallProvider>
                  <PwaRegister />
                  {children}
                  <CallModal />
                  <IncomingCallModal />
                  <ChatLockModal />
                  <CallNotificationPermissionDialog />
                  <FloatingHeartsOverlay />
                  <Toaster />
                </CallProvider>
              </ChatLockProvider>
            </ChatProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
