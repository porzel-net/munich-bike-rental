import type { MetadataRoute } from "next";

import { blogPosts } from "../lib/blog-content";
import { siteConfig } from "../lib/site";
import { rentalLocationConfigs } from "../lib/rental-locations";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    ...rentalLocationConfigs.map((location) => ({
      url: `${siteConfig.url}${location.path}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 1,
    })),
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
