import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";

type RouteHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  meta?: string;
};

export function RouteHeader({ eyebrow, title, description, meta }: RouteHeaderProps) {
  return (
    <header className="route-header">
      <div>
        <span className="route-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {meta ? <span className="route-meta">{meta}</span> : null}
    </header>
  );
}

type EmptyStateProps = {
  icon: Icon;
  label: string;
  title: string;
  description: string;
  action?: { label: string; href: string };
  note?: string;
};

export function EmptyState({
  icon: Icon,
  label,
  title,
  description,
  action,
  note,
}: EmptyStateProps) {
  return (
    <section className="empty-state" aria-labelledby="empty-state-title">
      <div className="empty-state-icon">
        <Icon aria-hidden="true" size={24} />
      </div>
      <span className="route-eyebrow">{label}</span>
      <h2 id="empty-state-title">{title}</h2>
      <p>{description}</p>
      {action ? (
        <Link className="secondary-button" href={action.href}>
          {action.label}
        </Link>
      ) : null}
      {note ? <small>{note}</small> : null}
    </section>
  );
}

export function FieldRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="field-row">
      <div>
        <span>{label}</span>
        {detail ? <small>{detail}</small> : null}
      </div>
      <strong>{value}</strong>
    </div>
  );
}
