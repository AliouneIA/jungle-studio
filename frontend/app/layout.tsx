import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jungle Studio - AI Fusion Core",
  description: "Advanced AI Fusion Engine for unified intelligent analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
