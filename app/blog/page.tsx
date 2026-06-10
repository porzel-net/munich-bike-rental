import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { BlogPreviewCard } from "../../components/blog-content";
import { HomeTopbar } from "../../components/home-interactive";
import { blogPosts } from "../../lib/blog-content";
import { resolveLocale, translations } from "../../lib/home-content";
import { siteConfig } from "../../lib/site";

type PageProps = {
  searchParams?: Promise<{
    lang?: string | string[];
  }>;
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: "Blog",
  description: "Blog mit Touren, Routentipps und Bike-Infos rund um Rennradfahren in München.",
  alternates: {
    canonical: "/blog",
  },
  keywords: [
    "Rennrad Blog München",
    "Routentipps München",
    "Rennradtouren München",
    "Gravelbike München",
  ],
  openGraph: {
    type: "website",
    title: "Blog | Munich Rental",
    description: "Touren, Bike-Infos und Routentipps rund um Rennradfahren in München.",
    url: `${siteConfig.url}/blog`,
    siteName: siteConfig.name,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Blog von Munich Rental",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog | Munich Rental",
    description: "Touren, Bike-Infos und Routentipps rund um Rennradfahren in München.",
    images: ["/opengraph-image"],
  },
};

export default async function BlogIndexPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const lang = resolveLocale(params?.lang);
  const t = translations[lang];

  return (
    <main className="site-shell blog-shell">
      <HomeTopbar
        lang={lang}
        topbar={{
          nav: t.nav,
          languageToggle: t.languageToggle,
          menuButton: t.menuButton,
        }}
      />

      <section className="section blog-archive">
        <div className="container blog-archive__inner">
          <div className="blog-page-nav">
            <Link className="blog-page-nav__link" href={`/?lang=${lang}`}>
              {lang === "de" ? "Zur Startseite" : "Back to homepage"}
            </Link>
            <span className="blog-page-nav__separator" aria-hidden="true">
              /
            </span>
            <span className="blog-page-nav__current">Blog</span>
          </div>

          <div className="section-heading">
            <span className="section-heading__eyebrow">{lang === "de" ? "Blog" : "Blog"}</span>
            <h1 className="section-heading__title">
              {lang === "de" ? "Beiträge und Gedanken" : "Posts and ideas"}
            </h1>
          </div>

          <p className="section-copy">
            {lang === "de"
              ? "Hier findest du kurze Beiträge mit Bild, Textvorschau und einer eigenen Detailseite."
              : "Here you will find short posts with an image, text preview and a dedicated detail page."}
          </p>

          <div className="blog-archive__list">
            {blogPosts.map((post) => (
              <BlogPreviewCard
                key={post.slug}
                post={post}
                lang={lang}
                href={`/blog/${post.slug}?lang=${lang}`}
                ctaLabel={lang === "de" ? "Beitrag lesen" : "Read post"}
              />
            ))}
          </div>

          <Link className="blog-section__link" href={`/?lang=${lang}#blog`}>
            <span>{lang === "de" ? "Zur Startseite zurück" : "Back to homepage"}</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
