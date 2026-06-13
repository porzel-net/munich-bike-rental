import type { StaticImageData } from "next/image";

import type { Locale, LocalizedText } from "./home-content";

export type BlogBlock =
  | {
      type: "paragraph";
      text: LocalizedText;
    }
  | {
      type: "heading";
      text: LocalizedText;
    }
  | {
      type: "quote";
      text: LocalizedText;
    }
  | {
      type: "list";
      items: Array<LocalizedText>;
    }
  | {
      type: "route-list";
      items: Array<{
        title: LocalizedText;
        href: string;
        meta: LocalizedText;
        summary: LocalizedText;
      }>;
    };

export type BlogPost = {
  slug: string;
  title: LocalizedText;
  excerpt: LocalizedText;
  category: LocalizedText;
  publishedAt: string;
  readingTime: LocalizedText;
  heroImage: string | StaticImageData;
  heroAlt: LocalizedText;
  previewImage: string | StaticImageData;
  previewAlt: LocalizedText;
  blocks: BlogBlock[];
};

export const blogSlugRedirects: Record<string, string> = {
  "lorem-ipsum-dolor-sit-amet": "rennradtouren-rund-um-muenchen",
};

export function getCanonicalBlogSlug(slug: string) {
  return blogSlugRedirects[slug] ?? slug;
}

export const blogPosts: BlogPost[] = [
  {
    slug: "rennradtouren-rund-um-muenchen",
    title: {
      de: "Die schönsten Rennradtouren rund um München, nach Gefühl sortiert",
      en: "The best road bike tours around Munich, sorted by feel",
    },
    excerpt: {
      de: "Eine persönlichere Auswahl mit kurzen Einordnungen, klaren Eckdaten und Touren für den Feierabend, den Wochenendtag und die lange Runde.",
      en: "A more personal selection with short notes, clear numbers and routes for after work, weekend rides and the long day in the saddle.",
    },
    category: {
      de: "Touren",
      en: "Routes",
    },
    publishedAt: "2026-06-09",
    readingTime: {
      de: "9 Min. Lesezeit",
      en: "9 min read",
    },
    heroImage: "/assets/img/blog/munich-blog-cover.jpg",
    heroAlt: {
      de: "Editoriales Rennradbild als Auftakt für den Beitrag über Touren rund um München",
      en: "Editorial road bike image introducing the routes around Munich",
    },
    previewImage: "/assets/img/blog/munich-blog-cover.jpg",
    previewAlt: {
      de: "Vorschaubild zum Beitrag über Rennradtouren rund um München",
      en: "Preview image for the Munich road bike route article",
    },
    blocks: [
      {
        type: "paragraph",
        text: {
          de: "Rund um München ist Rennradfahren vor allem deshalb so attraktiv, weil du mitten aus der Stadt heraus sehr schnell in richtig gute Strecken kommst. Besonders spannend sind die Routen, die direkt in der Altstadt bei Marienplatz starten, also dort, wo die Stadt selbst schon zum Treffpunkt der Radszene wird. Genau diese Mischung aus Innenstadt, Perlacher Forst, Isar, Seen und gut fahrbaren Nebenstraßen macht die Region so stark.",
          en: "Road cycling around Munich is especially attractive because you can leave the city center and reach genuinely good routes very quickly. The most interesting rides are the ones that start right in the old town near Marienplatz, where the city itself already acts as a meeting point for the cycling scene. That mix of city center, Perlacher Forest, the Isar, lakes and rideable side roads is what makes the area so strong.",
        },
      },
      {
        type: "heading",
        text: {
          de: "Warum die Münchner Clubhouse-Runden so beliebt sind",
          en: "Why the Munich clubhouse rides are so popular",
        },
      },
      {
        type: "paragraph",
        text: {
          de: "Die Rapha-Munich-Clubhouse-Routen zeigen das sehr gut: Sie starten alle mitten in der Stadt, sind gut dokumentiert und werden in der Komoot-Community offensichtlich häufig gespeichert. Genau deshalb funktionieren sie so gut als Orientierung für Leute, die eine verlässliche Tour suchen, ohne lange zu filtern. Im Süden kommst du schnell ins Grüne, im Norden bekommst du offene Landstraßen und Richtung Ammersee oder Dietramszell echte Tagesausflüge.",
          en: "The Rapha Munich clubhouse routes show that very well: they all start in the city center, are well documented and are clearly saved often in the Komoot community. That is exactly why they work so well as a reference point for anyone looking for a reliable ride without spending ages filtering options. To the south you get into greenery quickly, to the north you get open country roads and toward Ammersee or Dietramszell you get proper day trips.",
        },
      },
      {
        type: "paragraph",
        text: {
          de: "Die Angaben zu Distanz, Fahrzeit und Höhenmetern stammen direkt aus den verlinkten Touren. Dazu kommt unsere kurze Einordnung: wie schnell du aus der Stadt raus bist, wie ruhig sich die Strecke anfühlt und warum die Runde im Münchner Umfeld so beliebt ist. So kannst du schneller einschätzen, ob eine Route zu deinem Tag passt.",
          en: "Distance, time and elevation come directly from the linked routes. On top of that you get our short take: how quickly you leave the city, how calm the ride feels and why the route is so popular in the Munich area. That makes it easier to judge whether a route fits your day.",
        },
      },
      {
        type: "route-list",
        items: [
          {
            title: { de: "1. Rapha Munich — Short, flat and fast loop north", en: "1. Rapha Munich — Short, flat and fast loop north" },
            href: "https://www.komoot.com/tour/450921039",
            meta: {
              de: "52,0 km · 2:06 h · 130 hm",
              en: "52.0 km · 2:06 h · 130 m",
            },
            summary: {
              de: "Die kürzeste der hier gezeigten Rapha-Runden und deshalb perfekt, wenn du nach der Arbeit noch etwas Schnelles fahren willst. Sie ist flach, direkt und genau der Typ Route, den man öfter speichert, weil er sich im Alltag so leicht unterbringen lässt.",
              en: "The shortest of the Rapha routes shown here and therefore perfect when you want something fast after work. It is flat, direct and exactly the kind of route people save because it is so easy to fit into everyday life.",
            },
          },
          {
            title: { de: "2. Rapha Munich — Ayinger loop", en: "2. Rapha Munich — Ayinger loop" },
            href: "https://www.komoot.com/tour/435412446",
            meta: {
              de: "60,7 km · 2:25 h · 270 hm",
              en: "60.7 km · 2:25 h · 270 m",
            },
            summary: {
              de: "Eine kompakte Runde mit wenig Stress und gutem Flow, die direkt am Rapha Clubhouse beginnt. Für Tage, an denen du keine große Mission brauchst, aber trotzdem eine saubere, gut planbare Strecke willst, ist das eine sehr starke Wahl.",
              en: "A compact route with little stress and a nice flow that starts right at the Rapha Clubhouse. If you do not need a big mission but still want a clean, easy-to-plan route, this is a very strong choice.",
            },
          },
          {
            title: { de: "3. Rapha Munich — Schäftlarn loop", en: "3. Rapha Munich — Schäftlarn loop" },
            href: "https://www.komoot.com/tour/442923101",
            meta: {
              de: "61,3 km · 2:40 h · 500 hm",
              en: "61.3 km · 2:40 h · 500 m",
            },
            summary: {
              de: "Diese Runde ist ein gutes Beispiel dafür, wie schnell man aus der Altstadt in einen wirklich ruhigen Rhythmus kommt. Der Weg über Schäftlarn bringt dir genau die Mischung aus ruhigen Abschnitten, etwas Klettern und planbarer Länge, die viele Münchner gerne wieder fahren.",
              en: "This route is a good example of how quickly you can leave the old town and settle into a genuinely calm rhythm. The way via Schäftlarn gives you exactly the mix of quiet sections, a little climbing and predictable length that many Munich riders like to repeat.",
            },
          },
          {
            title: { de: "4. Rapha Munich — South-west", en: "4. Rapha Munich — South-west" },
            href: "https://www.komoot.com/tour/435399134",
            meta: {
              de: "63,7 km · 2:46 h · 520 hm",
              en: "63.7 km · 2:46 h · 520 m",
            },
            summary: {
              de: "Eine der beliebtesten Rapha-Runden überhaupt und genau die Art Tour, die von der Münchner Altstadt aus sofort Sinn ergibt. Du kommst schnell aus der Stadt, fährst viel auf gutem Asphalt und hast mit dem Isarraum und den südlichen Abschnitten eine sehr runde Mischung aus Stadt, Natur und Tempo.",
              en: "One of the most popular Rapha routes and exactly the kind of ride that makes sense when you start in Munich's old town. You leave the city quickly, ride a lot on good asphalt and get a very balanced mix of city, nature and pace through the Isar area and the southern sections.",
            },
          },
          {
            title: { de: "5. Rapha Munich — Short loop south", en: "5. Rapha Munich — Short loop south" },
            href: "https://www.komoot.com/tour/1345251231",
            meta: {
              de: "68,3 km · 2:57 h · 570 hm",
              en: "68.3 km · 2:57 h · 570 m",
            },
            summary: {
              de: "Eine beliebte, aber immer noch gut fahrbare längere Südrunde. Sie bleibt nah genug an München, fühlt sich aber schon deutlich nach einem echten Tagesziel an.",
              en: "A popular but still very rideable longer southern loop. It stays close enough to Munich while already feeling like a proper day-out destination.",
            },
          },
        ],
      },
      {
        type: "heading",
        text: {
          de: "Die längeren Touren für freie Tage",
          en: "The longer rides for freer days",
        },
      },
      {
        type: "paragraph",
        text: {
          de: "Jetzt wird die Runde deutlich größer. Genau diese Touren zeigen am besten, warum München für Rennradfahrer so spannend ist: Du startest im Zentrum, bist aber sehr schnell draußen, und dann öffnen sich in Richtung Westen oder Süden Strecken, die sich wie richtige Ausflüge anfühlen. Viele dieser Routen sind nicht nur beliebt, sondern auch genau deshalb gespeichert, weil sie ein klares Ziel und einen verlässlichen Charakter haben.",
          en: "Now the rides get a lot bigger. These are the routes that show best why Munich is so exciting for road cyclists: you start in the center, but you get out quickly, and then to the west or south the roads open up into rides that feel like proper outings. Many of these routes are not just popular, but saved for exactly that reason: they have a clear destination and a reliable character.",
        },
      },
      {
        type: "route-list",
        items: [
          {
            title: { de: "6. Rapha Munich — Southern loop via Dietramszell", en: "6. Rapha Munich — Southern loop via Dietramszell" },
            href: "https://www.komoot.com/tour/450472600",
            meta: {
              de: "100 km · 4:25 h · 920 hm",
              en: "100 km · 4:25 h · 920 m",
            },
            summary: {
              de: "Eine echte Trainingstour mit klarer Richtung nach Süden und genug Höhenmetern, damit sie sich nie langweilig anfühlt. Für alle, die von München aus gerne in eine längere, etwas ernstere Runde starten.",
              en: "A real training ride with a clear southern direction and enough climbing that it never feels dull. For anyone who likes to start from Munich and head into something longer and a bit more serious.",
            },
          },
          {
            title: { de: "7. Rapha Munich — North loop 100", en: "7. Rapha Munich — North loop 100" },
            href: "https://www.komoot.com/tour/450898511/",
            meta: {
              de: "103 km · 4:17 h · 460 hm",
              en: "103 km · 4:17 h · 460 m",
            },
            summary: {
              de: "Eine der klareren und am häufigsten gespeicherten Nordrunden aus der Clubhouse-Serie. Sie bietet viel ruhige Straße, wenig unnötige Schleifen und ist genau deshalb für viele so angenehm planbar.",
              en: "One of the cleaner and often-saved northern loops from the clubhouse series. It offers a lot of quiet road, very little unnecessary detour and is exactly why many riders find it so easy to plan.",
            },
          },
          {
            title: { de: "8. Rapha Munich — Ammersee loop", en: "8. Rapha Munich — Ammersee loop" },
            href: "https://www.komoot.com/de-de/tour/1540234553",
            meta: {
              de: "111 km · 4:37 h · 650 hm",
              en: "111 km · 4:37 h · 650 m",
            },
            summary: {
              de: "Eine der beliebtesten westlichen Ausfahrten aus München heraus, mit direkter Verbindung Richtung Ammersee. Der Start in der Altstadt macht die Runde besonders praktisch, weil du zentral losfährst und trotzdem schnell in einer sehr landschaftlichen Strecke bist.",
              en: "One of the most popular western rides out of Munich, with a direct line toward Lake Ammersee. Starting in the old town makes it especially practical because you leave centrally and still get into scenic riding quickly.",
            },
          },
          {
            title: { de: "9. Rapha Munich — North-west", en: "9. Rapha Munich — North-west" },
            href: "https://www.komoot.com/tour/435387960",
            meta: {
              de: "121 km · 5:26 h · 650 hm",
              en: "121 km · 5:26 h · 650 m",
            },
            summary: {
              de: "Eine harte, aber sehr klare Nordwest-Runde mit viel offener Straße und wenig unnötigen Umwegen. Genau die Art Tour, die man für einen langen Trainingstag auswählt, wenn man wirklich Kilometer machen will.",
              en: "A hard but very clean northwest ride with lots of open road and very little unnecessary detour. Exactly the kind of route you pick for a long training day when you really want to bank the kilometers.",
            },
          },
          {
            title: { de: "10. Rapha Munich — Through the Perlacher Forest to Lake Starnberg", en: "10. Rapha Munich — Through the Perlacher Forest to Lake Starnberg" },
            href: "https://www.komoot.com/tour/435403081",
            meta: {
              de: "126 km · 5:21 h · 970 hm",
              en: "126 km · 5:21 h · 970 m",
            },
            summary: {
              de: "Eine der anspruchsvolleren Rapha-Runden, die direkt zeigt, wie schnell du aus München in echte Landschaft kommst. Durch den Perlacher Forst und Richtung Starnberger See wird daraus eine Runde, die sich klar nach großem Ausflug anfühlt.",
              en: "One of the more demanding Rapha routes, and a good example of how quickly you can leave Munich and reach real scenery. Through the Perlacher Forest and toward Lake Starnberg, this becomes a ride that clearly feels like a major outing.",
            },
          },
        ],
      },
      {
        type: "paragraph",
        text: {
          de: "Was die Touren rund um München und die Seen so stark macht, ist die Mischung aus planbarer Strecke und echter Abwechslung. Du hast relativ schnell ein gutes Stück Ruhe, oft gute Asphaltabschnitte und bei den längeren Runden genug Landschaft, um aus einer normalen Ausfahrt einen kleinen Ausflug zu machen. Genau das wollen wir mit dieser Übersicht zeigen: Sie sind sauber beschrieben, gut planbar und abwechslungsreich genug, dass sich die Runde nicht nur wie bloßes Kilometer-Sammeln anfühlt.",
          en: "What makes the routes around Munich and the lakes so strong is the mix of predictable riding and real variety. You can get to quieter sections relatively quickly, you often have good asphalt stretches and on the longer routes enough scenery to turn a normal ride into a small trip. That is exactly what this overview is meant to show: they are clearly described, easy to plan and varied enough that the ride does not feel like mere mileage collecting.",
        },
      },
      {
        type: "paragraph",
        text: {
          de: "Und ganz praktisch: Wenn du an einem Samstag in der Münchner Altstadt losfährst, bist du mit diesen Routen schnell aus dem Verkehr raus und trotzdem nah genug an der Stadt, um den Tag flexibel zu halten. Genau diese Nähe macht die Auswahl so beliebt.",
          en: "And on a practical level: if you start on a Saturday in Munich's old town, these routes get you out of traffic quickly while still staying close enough to the city to keep the day flexible. That proximity is a big part of what makes this selection so popular.",
        },
      },
    ],
  },
];

export function getBlogPostBySlug(slug: string) {
  return blogPosts.find((post) => post.slug === slug) ?? null;
}

export function getBlogImageSrc(image: string | StaticImageData) {
  return typeof image === "string" ? image : image.src;
}

export function formatBlogDate(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

export function getBlogPostPlainText(post: BlogPost, locale: Locale) {
  const parts: string[] = [];

  parts.push(post.title[locale]);
  parts.push(post.excerpt[locale]);

  for (const block of post.blocks) {
    switch (block.type) {
      case "paragraph":
      case "heading":
      case "quote":
        parts.push(block.text[locale]);
        break;
      case "list":
        parts.push(...block.items.map((item) => item[locale]));
        break;
      case "route-list":
        parts.push(
          ...block.items.flatMap((item) => [item.title[locale], item.meta[locale], item.summary[locale]]),
        );
        break;
      default:
        break;
    }
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}
