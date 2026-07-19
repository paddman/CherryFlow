import type { UiComponent } from "@cherryflow/ui-schema";

export function StaticSection({ component, ctaTarget }: { component: UiComponent; ctaTarget?: string | undefined }) {
  if (component.type === "navbar") {
    return (
      <nav id={component.id} className="siteNavbar" aria-label="Primary navigation">
        <div className="siteBrand">
          <strong>{component.brand}</strong>
          {component.tagline && <small>{component.tagline}</small>}
        </div>
        <div className="siteNavItems">
          {component.items.map((item) => <a key={item.target} href={item.target}>{item.label}</a>)}
        </div>
      </nav>
    );
  }
  if (component.type === "hero") return <section id={component.id} className={`renderHero align-${component.align ?? "left"}`}>{component.badge && <span className="badge">{component.badge}</span>}<h1>{component.title}</h1>{component.description && <p>{component.description}</p>}</section>;
  if (component.type === "text") return <section id={component.id} className="contentCard">{component.title && <h2>{component.title}</h2>}<p>{component.body}</p></section>;
  if (component.type === "notice") return <section id={component.id} className={`notice tone-${component.tone}`} role={component.tone === "warning" ? "alert" : "status"}>{component.title && <strong>{component.title}</strong>}<p>{component.body}</p></section>;
  if (component.type === "stats") return <section id={component.id} className="statsGrid" aria-label={component.title ?? "Key metrics"}>{component.items.map((item, index) => <article key={`${item.label}-${index}`}><strong>{item.value}</strong><span>{item.label}</span>{item.detail && <small>{item.detail}</small>}</article>)}</section>;
  if (component.type === "feature-grid") return <section id={component.id} className={`featureGrid columns-${component.columns}`} aria-label={component.title ?? "Features"}>{component.items.map((item, index) => <article key={`${item.title}-${index}`}><h3>{item.title}</h3><p>{item.description}</p></article>)}</section>;
  if (component.type === "steps") return <section id={component.id} className="contentCard">{component.title && <h2>{component.title}</h2>}<ol className="stepsList">{component.items.map((item, index) => <li key={`${item.title}-${index}`}><strong>{item.title}</strong>{item.description && <span>{item.description}</span>}</li>)}</ol></section>;
  if (component.type === "faq") return <section id={component.id} className="contentCard faqSection">{component.title && <h2>{component.title}</h2>}{component.items.map((item, index) => <details key={`${item.question}-${index}`}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>;
  if (component.type === "cta") return <section id={component.id} className="ctaSection"><div><h2>{component.title}</h2>{component.body && <p>{component.body}</p>}</div><a href={ctaTarget ? `#${ctaTarget}` : "#top"}>{component.buttonLabel}</a></section>;
  if (component.type === "footer") return <footer id={component.id} className="siteFooter"><div><strong>{component.brand}</strong>{component.description && <p>{component.description}</p>}</div>{component.copyright && <small>{component.copyright}</small>}</footer>;
  if (component.type === "divider") return <hr id={component.id} />;
  return null;
}
