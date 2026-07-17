import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

import { BlogArticle } from "../../../components/blog-content";
import { HomeTopbar } from "../../../components/home-interactive";
import { blogPosts, getBlogImageSrc, getBlogPostBySlug, getCanonicalBlogSlug } from "../../../lib/blog-content";
import { resolveLocale, translations } from "../../../lib/home-content";
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
  const canonicalSlug = getCanonicalBlogSlug(resolvedParams.slug);
  const post = getBlogPostBySlug(canonicalSlug);

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
    twitter: {
      card: "summary_large_image",
      title: post.title[lang],
      description: post.excerpt[lang],
      images: [`${siteConfig.url}${getBlogImageSrc(post.heroImage)}`],
    },
  };
}

export default async function BlogPostPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const lang = resolveLocale(resolvedSearchParams?.lang);
  const t = translations[lang];
  const canonicalSlug = getCanonicalBlogSlug(resolvedParams.slug);
  const post = getBlogPostBySlug(canonicalSlug);

  if (resolvedParams.slug !== canonicalSlug) {
    permanentRedirect(`/blog/${canonicalSlug}?lang=${lang}`);
  }

  if (!post) {
    notFound();
  }

  return (
    <main className="site-shell blog-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: getBlogPostStructuredDataJson(post, lang) }}
      />

      <HomeTopbar
        lang={lang}
        topbar={{
          nav: t.nav,
          languageToggle: t.languageToggle,
          menuButton: t.menuButton,
        }}
      />

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
