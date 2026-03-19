import "./globals.css"
import { Providers } from "./providers"

export const metadata = {
  title: {
    template: "Ascend | %s",
    default: "Ascend | Sign In",
  },
  description: "YCP Ascend Training Platform",
  icons: {
    icon: "/favicon-global.png",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}