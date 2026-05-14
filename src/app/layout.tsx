import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "알고팡",
  description: "알고케어 영양제와 디스펜서를 모티브로 한 모바일 3매치 게임",
  applicationName: "알고팡",
  openGraph: {
    title: "알고팡",
    description: "영양제를 맞추고, 부스트팩을 터뜨리고, 도감을 채우세요.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
