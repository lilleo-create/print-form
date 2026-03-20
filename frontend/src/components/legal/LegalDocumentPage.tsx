import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './LegalDocumentPage.module.css';

export type LegalDocumentSection = {
  id: string;
  title: string;
  content: ReactNode;
};

type LegalDocumentPageProps = {
  title: string;
  subtitle?: string;
  publishedAt?: string;
  effectiveAt?: string;
  sections: LegalDocumentSection[];
};

const LEGAL_LINKS = [
  { to: '/privacy-policy', label: 'Политика обработки персональных данных' },
  { to: '/service-rules', label: 'Правила использования сервиса' },
  { to: '/offer', label: 'Оферта' }
];

export const LegalDocumentPage = ({
  title,
  subtitle,
  publishedAt,
  effectiveAt,
  sections
}: LegalDocumentPageProps) => {
  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.hero}>
          <div className={styles.heroContent}>
            <span className={styles.eyebrow}>Юридический документ</span>
            <h1>{title}</h1>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>

          <div className={styles.meta}>
            {publishedAt ? <div>Дата публикации: {publishedAt}</div> : null}
            {effectiveAt ? (
              <div>Дата вступления в силу: {effectiveAt}</div>
            ) : null}
          </div>
        </div>

        <div className={styles.layout}>
          <aside className={styles.sidebar} aria-label="Оглавление документа">
            <div className={styles.sidebarCard}>
              <h2>Оглавление</h2>
              <nav className={styles.toc}>
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className={styles.tocLink}
                  >
                    {section.title}
                  </a>
                ))}
              </nav>

              <div className={styles.relatedLinks}>
                <h3>Другие документы</h3>
                <div className={styles.relatedList}>
                  {LEGAL_LINKS.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={styles.relatedLink}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <article className={styles.article}>
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className={styles.section}
              >
                <h2>{section.title}</h2>
                <div className={styles.sectionContent}>{section.content}</div>
              </section>
            ))}
          </article>
        </div>
      </div>
    </section>
  );
};
