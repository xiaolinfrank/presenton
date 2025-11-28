import type { Metadata } from "next";
import localFont from "next/font/local";
import { Roboto, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import MixpanelInitializer from "./MixpanelInitializer";
import { LayoutProvider } from "./(presentation-generator)/context/LayoutContext";
import { Toaster } from "@/components/ui/sonner";
const inter = localFont({
  src: [
    {
      path: "./fonts/Inter.ttf",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-inter",
});

const instrument_sans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-instrument-sans",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-roboto",
});


export const metadata: Metadata = {
  metadataBase: new URL("https://presenton.ai"),
  title: "AI 演示文稿生成器 - 深圳汇芯生物医疗科技有限公司",
  description:
    "AI 智能演示文稿生成器，支持自定义布局、多模型支持（OpenAI、Gemini、Ollama），可导出 PDF/PPTX 格式。",
  keywords: [
    "AI演示文稿生成器",
    "数据可视化",
    "智能PPT",
    "AI数据演示",
    "演示文稿生成",
    "数据转演示",
    "交互式演示",
    "专业幻灯片",
  ],
  openGraph: {
    title: "AI 演示文稿生成器 - 深圳汇芯生物医疗科技有限公司",
    description:
      "AI 智能演示文稿生成器，支持自定义布局、多模型支持（OpenAI、Gemini、Ollama），可导出 PDF/PPTX 格式。",
    url: "https://presenton.ai",
    siteName: "汇芯AI演示",
    images: [
      {
        url: "https://presenton.ai/presenton-feature-graphics.png",
        width: 1200,
        height: 630,
        alt: "汇芯AI演示",
      },
    ],
    type: "website",
    locale: "zh_CN",
  },
  alternates: {
    canonical: "https://presenton.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI 演示文稿生成器 - 深圳汇芯生物医疗科技有限公司",
    description:
      "AI 智能演示文稿生成器，支持自定义布局、多模型支持（OpenAI、Gemini、Ollama），可导出 PDF/PPTX 格式。",
    images: ["https://presenton.ai/presenton-feature-graphics.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="zh-CN">
      <body
        className={`${inter.variable} ${roboto.variable} ${instrument_sans.variable} antialiased`}
      >
        <Providers>
          <MixpanelInitializer>
            <LayoutProvider>
              {children}
            </LayoutProvider>
          </MixpanelInitializer>
        </Providers>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
