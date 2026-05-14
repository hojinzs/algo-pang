import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const ogImage = {
  url: "/og/algopang-og.png",
  width: 1200,
  height: 630,
  alt: "알고팡 공유 이미지",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "알고팡",
  description: "알고케어 영양제와 디스펜서를 모티브로 한 모바일 3매치 게임",
  applicationName: "알고팡",
  openGraph: {
    title: "알고팡",
    description: "영양제를 맞추고, 부스트팩을 터뜨리고, 도감을 채우세요.",
    url: "/",
    siteName: "알고팡",
    locale: "ko_KR",
    type: "website",
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "알고팡",
    description: "영양제를 맞추고, 부스트팩을 터뜨리고, 도감을 채우세요.",
    images: [ogImage],
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
