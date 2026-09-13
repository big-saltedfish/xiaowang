import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '小望 · 你的云端研究伙伴',
  description:
    '云端研究、独立复盘、长期记忆和实时通话。你离开后，研究还会继续。',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
