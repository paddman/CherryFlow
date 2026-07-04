import type { UiComponent } from "@cherryflow/ui-schema";

export function StaticSection({ component }: { component: UiComponent }) {
  if (component.type === "navbar") {
    return (
      <nav className="siteNavbar">
        <div className="siteBrand">
          <strong>{component.brand}</strong>
          {component.tagline && <small>{component.tagline}</small>}
        </div>
        <div className="siteNavItems">
          {component.items.map((item) => <span key={item.target}>{item.label}</span>)}
        </div>
      </nav>
    );
  }
  if (component.type === "hero") return <section className={`renderHero align-${component.align ?? "left"}`}>{component.badge && <span className="badge">{component.badge}</span>}<h1>{component.title}</h1>{component.description && <p>{component.description}</p>}</section>;
  if (component.type === "text") return <section className="contentCard">{component.title && <h2>{component.title}</h2>}<p>{component.body}</p></section>;
  if (component.type === "notice") return <section className={`notice tone-${component.tone}`}>{component.title && <strong>{component.title}</strong>}<p>{component.body}</p></section>;
  if (component.type === "feature-grid") return <section className={`featureGrid columns-${component.columns}`}>{component.items.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.description}</p></article>)}</section>;
  if (component.type === "steps") return <section className="contentCard">{component.title && <h2>{component.title}</h2>}<ol className="stepsList">{component.items.map((item) => <li key={item.title}><strong>{item.title}</strong>{item.description && <span>{item.description}</span>}</li>)}</ol></section>;
  if (component.type === "footer") return <footer className="siteFooter"><div><strong>{component.brand}</strong>{component.description && <p>{component.description}</p>}</div>{component.copyright && <small>{component.copyright}</small>}</footer>;
  if (component.type === "divider") return <hr />;
  return null;
}
