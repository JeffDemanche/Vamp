import type { ComponentProps, ComponentType, ReactNode, SVGProps } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/primitives/input";

/**
 * Centered card layout shared by the login and register views: the Vamp
 * wordmark (linking home), a titled card for the form, and an optional footer
 * for the cross-link between the two auth flows.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center">
          <span className="text-3xl font-bold tracking-tight">Vamp</span>
        </Link>
        <div className="mt-6 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
          <div className="mt-6">{children}</div>
        </div>
        {footer && (
          <p className="mt-4 text-center text-sm text-muted-foreground">{footer}</p>
        )}
      </div>
    </div>
  );
}

/** A labeled text input with a leading lucide icon. */
export function LabeledInput({
  id,
  label,
  icon: Icon,
  ...props
}: {
  id: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
} & ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input id={id} className="pl-9" {...props} />
      </div>
    </div>
  );
}
