import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

import { BlogArticle } from "../../../components/blog-content";
import { blogPosts, getBlogImageSrc, getBlogPostBySlug } from "../../../lib/blog-content";
import { resolveLocale } from "../../../lib/home-content";
import { getBlogPostStructuredDataJson } from "../../../lib/structured-data";
import { siteConfig } from "../../../lib/site";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    lang?: string | string[];
  }>;
};

export async function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const lang = resolveLocale(resolvedSearchParams?.lang);
  const post = getBlogPostBySlug(resolvedParams.slug);

  if (!post) {
    return {
      title: "Blog",
    };
  }

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      absolute: `${post.title[lang]} | ${siteConfig.name}`,
    },
    description: post.excerpt[lang],
    keywords: [
      post.title[lang],
      "Rennradtouren München",
      "Rennrad München",
      "Touren rund um München",
      "Fünfseenland",
      "Starnberger See",
    ],
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      type: "article",
      title: post.title[lang],
      description: post.excerpt[lang],
      url: `${siteConfig.url}/blog/${post.slug}`,
          images: [
            {
              url: `${siteConfig.url}${getBlogImageSrc(post.heroImage)}`,
              width: 1200,
              height: 630,
              alt: post.heroAlt[lang],
        },
      ],
    },
  };
}

export default async function BlogPostPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const lang = resolveLocale(resolvedSearchParams?.lang);
  const nextLang = lang === "de" ? "en" : "de";
  const post = getBlogPostBySlug(resolvedParams.slug);

  if (!post) {
    notFound();
  }

  return (
    <main className="site-shell blog-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: getBlogPostStructuredDataJson(post, lang) }}
      />

      <header className="blog-topbar">
        <div className="container blog-topbar__inner">
          <Link className="brand" href="/">
            <span className="brand__text">Munich Rental</span>
          </Link>

          <div className="blog-topbar__actions">
            <Link className="blog-topbar__home" href={`/?lang=${lang}`}>
              {lang === "de" ? "Zur Startseite" : "Back to homepage"}
            </Link>
            <Link className="blog-topbar__link" href={`/blog?lang=${lang}`}>
              {lang === "de" ? "Zur Übersicht" : "Back to overview"}
            </Link>
            <Link className="lang-switch" href={`/blog/${post.slug}?lang=${nextLang}`}>
              {nextLang.toUpperCase()}
            </Link>
          </div>
        </div>
      </header>

      <section className="section blog-post">
        <div className="container blog-post__inner">
          <div className="blog-page-nav">
            <Link className="blog-page-nav__link" href={`/?lang=${lang}`}>
              {lang === "de" ? "Zur Startseite" : "Back to homepage"}
            </Link>
            <span className="blog-page-nav__separator" aria-hidden="true">
              /
            </span>
            <Link className="blog-page-nav__link" href={`/blog?lang=${lang}`}>
              {lang === "de" ? "Zur Übersicht" : "Back to overview"}
            </Link>
            <span className="blog-page-nav__separator" aria-hidden="true">
              /
            </span>
            <span className="blog-page-nav__current">{post.title[lang]}</span>
          </div>

          <Link className="blog-post__back" href={`/blog?lang=${lang}`}>
            <span>{lang === "de" ? "Zur Übersicht" : "Back to overview"}</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>

          <BlogArticle post={post} lang={lang} />
        </div>
      </section>
    </main>
  );
}
