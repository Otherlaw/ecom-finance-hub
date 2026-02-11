import { ReactNode } from "react";
import { TopNav } from "@/components/TopNav";
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner";

interface MainLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function MainLayout({
  children,
  title,
  subtitle,
  actions,
}: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav />

      {/* Onboarding Banner */}
      <OnboardingBanner />

      {/* Page Header */}
      <div className="px-6 py-6 bg-card border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
