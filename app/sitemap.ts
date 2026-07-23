import type { MetadataRoute } from "next";

import { blogPosts } from "../lib/blog-content";
import { siteConfig } from "../lib/site";
import { getLocalizedLocationPath, rentalLocationConfigs } from "../lib/rental-locations";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    ...rentalLocationConfigs.flatMap((location) => {
      const deUrl = `${siteConfig.url}${getLocalizedLocationPath(location, "de")}`;
      const enUrl = `${siteConfig.url}${getLocalizedLocationPath(location, "en")}`;
      const alternates = { languages: { de: deUrl, en: enUrl } };

      return [
        {
          url: deUrl,
          lastModified,
          changeFrequency: "weekly" as const,
          priority: 1,
          alternates,
        },
        {
          url: enUrl,
          lastModified,
          changeFrequency: "weekly" as const,
          priority: 1,
          alternates,
        },
      ];
    }),
    {
      url: `${siteConfig.url}/impressum`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteConfig.url}/wartung`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${siteConfig.url}/datenschutzerklaerung`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteConfig.url}/blog`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...blogPosts.map((post) => ({
      url: `${siteConfig.url}/blog/${post.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
