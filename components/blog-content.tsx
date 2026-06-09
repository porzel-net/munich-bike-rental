import Image from "next/image";
import Link from "next/link";

import type { Locale } from "../lib/home-content";
import { formatBlogDate, type BlogBlock, type BlogPost } from "../lib/blog-content";

function renderBlogBlock(block: BlogBlock, lang: Locale) {
  switch (block.type) {
    case "paragraph":
      return <p className="blog-article__paragraph">{block.text[lang]}</p>;
    case "heading":
      return <h2 className="blog-article__heading">{block.text[lang]}</h2>;
    case "quote":
      return (
        <blockquote className="blog-article__quote">
          <p>{block.text[lang]}</p>
        </blockquote>
      );
    case "list":
      return (
        <ul className="blog-article__list">
          {block.items.map((item) => (
            <li key={item.de}>{item[lang]}</li>
          ))}
        </ul>
      );
    case "route-list":
      return (
        <div className="blog-article__routes">
          {block.items.map((item, index) => (
            <a
              key={`${item.href}-${index}`}
              className="blog-route-card"
              href={item.href}
              target="_blank"
              rel="noreferrer"
            >
              <span className="blog-route-card__index">{String(index + 1).padStart(2, "0")}</span>

              <div className="blog-route-card__body">
                <span className="blog-route-card__meta">{item.meta[lang]}</span>
                <span className="blog-route-card__title">{item.title[lang]}</span>
                <p className="blog-route-card__summary">{item.summary[lang]}</p>
              </div>

              <span className="blog-route-card__source">{lang === "de" ? "Route öffnen" : "Open route"}</span>
            </a>
          ))}
        </div>
      );
    default:
      return null;
  }
}

export function BlogPreviewCard({
  post,
  lang,
  href,
  ctaLabel,
}: {
  post: BlogPost;
  lang: Locale;
  href: string;
  ctaLabel: string;
}) {
  return (
    <Link className="blog-preview-card" href={href}>
      <div className="blog-preview-card__media">
        <Image
          src={post.previewImage}
          alt={post.previewAlt[lang]}
          fill
          sizes="(max-width: 900px) calc(100vw - 32px), 420px"
          className="blog-preview-card__image"
        />
      </div>

      <div className="blog-preview-card__content">
        <span className="blog-preview-card__eyebrow">
          {post.category[lang]} · {formatBlogDate(post.publishedAt, lang)}
        </span>
        <h3 className="blog-preview-card__title">{post.title[lang]}</h3>
        <p className="blog-preview-card__excerpt">{post.excerpt[lang]}</p>

        <div className="blog-preview-card__meta">
          <span>{post.readingTime[lang]}</span>
          <span className="blog-preview-card__cta">{ctaLabel}</span>
        </div>
      </div>
    </Link>
  );
}

export function BlogArticle({
  post,
  lang,
}: {
  post: BlogPost;
  lang: Locale;
}) {
  return (
    <article className="blog-article">
      <div className="blog-article__hero-media">
        <Image
          src={post.heroImage}
          alt={post.heroAlt[lang]}
          fill
          priority
          sizes="(max-width: 900px) calc(100vw - 32px), 1200px"
          className="blog-article__hero-image"
        />
      </div>

      <div className="blog-article__hero-copy">
        <span className="blog-article__eyebrow">
          {post.category[lang]} · {formatBlogDate(post.publishedAt, lang)}
        </span>
        <h1 className="blog-article__title">{post.title[lang]}</h1>
        <p className="blog-article__intro">{post.excerpt[lang]}</p>

        <div className="blog-article__meta">
          <span>{post.readingTime[lang]}</span>
          <span>·</span>
          <span>{formatBlogDate(post.publishedAt, lang)}</span>
        </div>
      </div>

      <div className="blog-article__content">
        {post.blocks.map((block, index) => (
          <div key={`${block.type}-${index}`} className="blog-article__block">
            {renderBlogBlock(block, lang)}
          </div>
        ))}
      </div>
    </article>
  );
}
