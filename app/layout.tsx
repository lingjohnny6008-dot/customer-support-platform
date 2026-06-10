import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SCP Authentication",
  description: "Support Chat Platform authentication system"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
