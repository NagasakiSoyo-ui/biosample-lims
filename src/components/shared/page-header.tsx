import Link from "next/link";

type Crumb = { label: string; href?: string };

export function PageHeader({
  breadcrumb,
  title,
  description,
  actions,
}: {
  breadcrumb: Crumb[];
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <nav
        aria-label="面包屑"
        className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
      >
        {breadcrumb.map((b, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span>/</span>}
            {b.href ? (
              <Link href={b.href} className="hover:text-foreground">
                {b.label}
              </Link>
            ) : (
              <span>{b.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
