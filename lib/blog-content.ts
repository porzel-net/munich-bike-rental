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
  "wie-henrik-bike-rental-entstanden-ist": "wie-your-bike-rental-entstanden-ist",
};

export function getCanonicalBlogSlug(slug: string) {
  return blogSlugRedirects[slug] ?? slug;
}

export const blogPosts: BlogPost[] = [
  {
    slug: "wie-your-bike-rental-entstanden-ist",
    title: {
      de: "Vom ersten Rennrad zur eigenen Vermietung: Wie Your Bike Rental entstanden ist",
      en: "From one road bike to our own rental business: How Your Bike Rental began",
    },
    excerpt: {
      de: "Unsere Geschichte, erzählt von Julius und Justus.",
      en: "One phone call, one road bike and far more demand than expected: the story of how a small idea between two students became Your Bike Rental.",
    },
    category: {
      de: "Über uns",
      en: "About us",
    },
    publishedAt: "2026-08-11",
    readingTime: {
      de: "6 Min. Lesezeit",
      en: "6 min read",
    },
    heroImage: "/assets/img/blog/your-bike-rental-story-v3.webp",
    heroAlt: {
      de: "Julius und Justus, die Gründer von Your Bike Rental, bei einem gemeinsamen Abend",
      en: "Julius and Justus, the founders of Your Bike Rental, enjoying an evening together",
    },
    previewImage: "/assets/img/blog/your-bike-rental-story-v3.webp",
    previewAlt: {
      de: "Julius und Justus als Vorschaubild für die Geschichte von Your Bike Rental",
      en: "Julius and Justus as a preview image for the story of Your Bike Rental",
    },
    blocks: [
      {
        type: "paragraph",
        text: {
          de: "Wenn du uns an dem Abend gesagt hättest, dass daraus einmal Your Bike Rental wird, hätten wir dir wahrscheinlich nicht geglaubt. Wir hatten keinen ausgearbeiteten Plan, kein großes Budget und schon gar keine eigene Website. Wir hatten nur eine Idee und ziemlich viel Lust auf Rennräder.",
          en: "Your Bike Rental did not start with a finished business plan. There was no big budget, no warehouse full of bikes and no website of our own. There was an idea, a real passion for road bikes and two students who noticed that something was missing in Munich.",
        },
      },
      {
        type: "quote",
        text: {
          de: "Wir wollten eigentlich nur herausfinden, wo man ein gutes Rennrad mieten kann. Am Ende haben wir uns gefragt: Warum machen wir das nicht einfach selbst?",
          en: "Sometimes a business does not begin with a plan, but with a phone call and one question: Why does this not exist yet?",
        },
      },
      {
        type: "heading",
        text: {
          de: "Der Anruf, mit dem alles losging",
          en: "It all began with a phone call",
        },
      },
      {
        type: "paragraph",
        text: {
          de: "Julius rief mich eines Abends an, weil er für eine Freundin ein Rennrad mieten wollte. Wir haben gemeinsam gesucht und ziemlich schnell gemerkt: Es gibt zwar Angebote, aber kein Rad, bei dem wir beide gesagt hätten: Ja, genau das würden wir guten Gewissens vermieten. Entweder stimmte die Qualität nicht oder der Zustand war nicht so, wie wir es uns vorgestellt hatten. Für ein gutes Rennrad, das man unkompliziert mieten kann, war die Auswahl in München überraschend klein.",
          en: "One evening, Julius called me, Justus. He wanted to rent a road bike for a friend. The search ended quickly: there were a few options, but no road bikes that matched our expectations in terms of quality and condition. At the time, renting a good, high-quality bike in Munich was surprisingly difficult.",
        },
      },
      {
        type: "paragraph",
        text: {
          de: "Am Anfang wollten wir überhaupt keinen Rennradverleih gründen. Wir wollten einfach nur privat ein Rennrad über List and Ride anbieten und schauen, ob sich überhaupt jemand dafür interessiert. Wir fahren beide selbst gerne Rennrad, reden oft darüber und verbringen auch gerne Zeit damit, an den Rädern zu schrauben. Das war eigentlich schon der ganze Plan. Wenn jemand unser Rad mieten würde, sollte es sich natürlich genauso gut anfühlen wie ein Rad, das wir selbst fahren würden.",
          en: "That conversation did not lead to a polished concept at first, but to a very direct thought: then we should start our own road bike rental business. We both enjoy riding, learning about bikes and working on them just as much. It quickly became clear that we did not want to offer just any bikes. They should ride well, be reliable and be maintained to the standard we would expect for ourselves.",
        },
      },
      {
        type: "heading",
        text: {
          de: "Unser Plan war eigentlich ziemlich klein",
          en: "One road bike and a cautious calculation",
        },
      },
      {
        type: "paragraph",
        text: {
          de: "Am Anfang hatten wir genau ein Rennrad. Wir haben es über List and Ride eingestellt und erst einmal abgewartet. Unsere Rechnung war ziemlich vorsichtig: Vielleicht kommen 50 bis 100 Euro im Monat zusammen. Vielleicht ist das Rad in zwei Jahren abbezahlt. Und dann können wir es selbst fahren. Mehr hatten wir zu diesem Zeitpunkt ehrlich gesagt nicht vor.",
          en: "We started by listing a single road bike on List and Ride. That was it at first: one bike, one listing and the hope that someone would occasionally be interested. Our original calculation was deliberately cautious. We thought we might earn around 50 to 100 euros per month and pay off the bike after roughly two years. After that, we could use it ourselves – a manageable risk and, in the best case, a bike that would eventually pay for itself.",
        },
      },
      {
        type: "paragraph",
        text: {
          de: "Dann kamen die ersten Anfragen. Und es waren nicht ein oder zwei, mit denen wir irgendwie gerechnet hatten. Es wurden schnell so viele, dass unser einzelnes Rennrad komplett ausgebucht war. Kurz danach kam über List and Ride unser erster großer Kunde. Das hat uns ehrlich gesagt ziemlich überrascht. Wir hatten mit einem kleinen Nebenverdienst gerechnet, nicht mit einem Auftrag, bei dem wir plötzlich überlegen mussten, wie wir das alles organisiert bekommen.",
          en: "Then the enquiries started coming in – far more than we expected. Our first road bike was booked out very quickly. Soon after, our first major customer also came through List and Ride. That order was completely unexpected. At that point, we had been thinking about a small side income, not about handling a rental of that size.",
        },
      },
      {
        type: "heading",
        text: {
          de: "Plötzlich war ein Rennrad nicht mehr genug",
          en: "From a test run to a real business",
        },
      },
      {
        type: "paragraph",
        text: {
          de: "Ab da war klar, dass wir nicht einfach nur ein Inserat laufen lassen können. Wir brauchten eine eigene Website, bessere Abläufe und einen Ort, an dem man uns und unsere Räder richtig kennenlernen kann. Vor allem wollten wir nicht bei jeder Anfrage wieder improvisieren. Aus unserem kleinen Test wurde langsam ein echtes Unternehmen: Your Bike Rental.",
          en: "By then, it was clear that we had to approach things more professionally. We did not want to depend on a single listing forever. We wanted our own website, reliable processes and a business that we could genuinely stand behind. Step by step, a small test run became Your Bike Rental.",
        },
      },
      {
        type: "paragraph",
        text: {
          de: "Relativ schnell haben wir unser zweites Rennrad gekauft. Mit einem Rad sind wir einfach nicht mehr hinterhergekommen. Danach ging es schnell. Wir haben innerhalb kurzer Zeit weitere Rennräder angeschafft und mussten gleichzeitig lernen, Buchungen, Übergaben, Wartung und Kundenanfragen vernünftig unter einen Hut zu bekommen. Vieles davon machen wir bis heute selbst.",
          en: "On July 11, 2026, we bought our second road bike. By then, we were already completely overbooked with just one bike. After that, everything moved faster than we had planned: we added several more road bikes within a short time and kept improving the processes around bookings, handovers, maintenance and customer communication.",
        },
      },
      {
        type: "heading",
        text: {
          de: "Warum wir das so gerne machen",
          en: "What keeps us going",
        },
      },
      {
        type: "paragraph",
        text: {
          de: "Für uns sind Rennräder nicht einfach nur Mietgegenstände. Wir fahren selbst gerne, probieren neue Strecken aus und können uns ziemlich lange über Komponenten, Übersetzungen oder die richtige Einstellung am Rad unterhalten. Und ja: Wir schrauben auch einfach gerne. Ein Rad zu warten, Fehler zu finden und es wieder sauber auf die Straße zu bringen, gehört für uns genauso dazu wie die Fahrt selbst.",
          en: "For us, Your Bike Rental is about more than renting out bikes. We are genuinely passionate about road cycling and share the joy of riding long distances, discovering new routes and understanding the technology behind the bikes. We enjoy working on the bikes, maintaining them carefully and learning from every bike and every rental.",
        },
      },
      {
        type: "paragraph",
        text: {
          de: "Und natürlich war nicht immer alles entspannt. Gerade am Anfang haben Julius und ich uns auch mal gestritten. Wenn neben dem Studium plötzlich viele Anfragen kommen, ein Rad repariert werden muss und irgendwo noch eine Übergabe wartet, liegen die Nerven manchmal blank. Das gehört wahrscheinlich dazu, wenn man gemeinsam etwas aufbaut. Wichtig war für uns, dass wir uns davon nicht auseinanderbringen lassen. Wir haben gelernt, Dinge früher anzusprechen, Aufgaben klarer aufzuteilen und nach einem Streit wieder an einem Tisch zu sitzen.",
          en: "Of course, not everything went smoothly. Especially in the beginning, we had our share of disagreements. When an idea suddenly turns into a lot of work and university, schedules, customer enquiries and repairs all come together, different opinions are inevitable. What mattered was that we grew through those moments instead of letting them break us. We learned to communicate more clearly, divide responsibilities and look for solutions together.",
        },
      },
      {
        type: "heading",
        text: {
          de: "Wir sind noch lange nicht fertig",
          en: "Still at the beginning – and that is what makes it exciting",
        },
      },
      {
        type: "paragraph",
        text: {
          de: "Heute ist Your Bike Rental deutlich größer, als wir es an diesem Abend am Telefon erwartet hätten. Trotzdem ist der Grundgedanke gleich geblieben: Du sollst ein gutes Rennrad unkompliziert mieten können, ohne dich durch unklare Angebote kämpfen zu müssen. Wir sind weiterhin Studenten, bauen das Ganze neben dem Studium auf und machen vieles selbst. Genau das ist für uns kein Nachteil, sondern ein Teil der Geschichte.",
          en: "Today, Your Bike Rental is much bigger than we could have imagined on that evening phone call. Still, the original idea remains the same: make high-quality road bikes easy to access while staying personal, reliable and close to the cycling community. We are still students, building the business alongside our studies and doing a lot ourselves. That is an important part of Your Bike Rental for us.",
        },
      },
      {
        type: "paragraph",
        text: {
          de: "Wo die Reise genau hingeht, wissen wir selbst noch nicht. Aber wir haben Lust, weiterzumachen. Weitere Räder, neue Ideen und hoffentlich viele Menschen, die mit einem unserer Rennräder eine gute Zeit auf der Straße haben. Wenn du also einmal ein Rennrad in München brauchst, weißt du jetzt, wer hinter Your Bike Rental steckt.",
          en: "We do not know exactly where the journey will take us. But we do know that we want to keep riding it – with good bikes, a lot of enthusiasm and the ambition to make every step a little more professional.",
        },
      },
    ],
  },
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
    heroImage: "/assets/img/blog/munich-blog-cover.webp",
    heroAlt: {
      de: "Editoriales Rennradbild als Auftakt für den Beitrag über Touren rund um München",
      en: "Editorial road bike image introducing the routes around Munich",
    },
    previewImage: "/assets/img/blog/munich-blog-cover.webp",
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
            title: {
              de: "1. Rapha Munich — Short, flat and fast loop north",
              en: "1. Rapha Munich — Short, flat and fast loop north",
            },
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
            title: {
              de: "6. Rapha Munich — Southern loop via Dietramszell",
              en: "6. Rapha Munich — Southern loop via Dietramszell",
            },
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
            title: {
              de: "10. Rapha Munich — Through the Perlacher Forest to Lake Starnberg",
              en: "10. Rapha Munich — Through the Perlacher Forest to Lake Starnberg",
            },
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
    timeZone: "Europe/Berlin",
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
        parts.push(...block.items.flatMap((item) => [item.title[locale], item.meta[locale], item.summary[locale]]));
        break;
      default:
        break;
    }
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}
