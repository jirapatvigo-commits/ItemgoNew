import React from "react";

export default function AuthLayout({ icon: Icon, title, subtitle = null, footer = null, children = null, compact = false }) {
  return (
    <div className={`min-h-screen flex justify-center bg-background px-4 ${compact ? "items-start py-6 sm:py-8" : "items-center"}`}>
      <div className={`w-full ${compact ? "max-w-xl" : "max-w-md"}`}>
        <div className={`text-center ${compact ? "mb-5" : "mb-10"}`}>
          <div className={`inline-flex items-center justify-center rounded-2xl bg-primary ${compact ? "w-12 h-12 mb-3" : "w-14 h-14 mb-4"}`}>
            <Icon className={`${compact ? "w-6 h-6" : "w-7 h-7"} text-primary-foreground`} aria-hidden="true" />
          </div>
          <h1 className={`${compact ? "text-2xl" : "text-3xl"} font-bold tracking-tight text-foreground`}>{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className={`bg-card rounded-2xl shadow-sm border border-border ${compact ? "p-5 sm:p-6" : "p-8"}`}>
          {children}
        </div>
        {footer && (
          <p className={`text-center text-sm text-muted-foreground ${compact ? "mt-4" : "mt-6"}`}>{footer}</p>
        )}
      </div>
    </div>
  );
}
