import type { Metadata } from 'next';
import { IBM_Plex_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  variable: '--font-sans',
  subsets: ['latin'],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
});

const appUrl = process.env.APP_BASE_URL?.replace(/\/+$/, '') || 'https://studytether.online';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'StudyTether | AI Study Coach with Persistent Memory',
    template: '%s | StudyTether',
  },
  description:
    'StudyTether is a persistent-memory AI study coach that personalizes quizzes, study plans, and revision schedules to improve exam performance.',
  applicationName: 'StudyTether',
  keywords: [
    'StudyTether',
    'AI study coach',
    'study planner',
    'exam preparation',
    'revision assistant',
    'student productivity',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'StudyTether',
    title: 'StudyTether | AI Study Coach with Persistent Memory',
    description:
      'Personalized study plans, smart quizzes, and memory-backed coaching designed for serious exam prep.',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StudyTether | AI Study Coach with Persistent Memory',
    description:
      'Personalized study plans, smart quizzes, and memory-backed coaching designed for serious exam prep.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  category: 'education',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
