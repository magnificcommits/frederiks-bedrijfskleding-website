import { site } from '@/content/site';
import { plaatsen, KERNSTRAAL_KM } from '@/content/plaatsen';

const dayMap: Record<string, string> = {
  Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday',
};

/** LocalBusiness / ClothingStore schema, basis voor lokale SEO en AI-antwoorden. */
export function localBusinessJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': ['ClothingStore', 'LocalBusiness'],
    '@id': `${site.url}/#bedrijf`,
    name: site.name,
    description: site.description,
    url: site.url,
    telephone: site.phoneIntl,
    email: site.email,
    foundingDate: String(site.foundedYear),
    priceRange: '€€',
    currenciesAccepted: 'EUR',
    paymentAccepted: 'Pin, Op rekening',
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      postalCode: site.address.postalCode,
      addressLocality: site.address.city,
      addressRegion: site.address.region,
      addressCountry: site.address.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: site.address.geo.lat, longitude: site.address.geo.lng },
    openingHoursSpecification: site.openingHours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: dayMap[h.dayCode],
      opens: h.open,
      closes: h.close,
    })),
    // Geen vaste aggregateRating meer: components/Reviews.tsx voegt hem toe zodra er
    // echte, gepubliceerde beoordelingen uit de database zijn.
    sameAs: [site.social.linkedin, site.social.facebook].filter(Boolean),
    areaServed: werkgebied(),
    hasMap: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${site.name} ${site.address.street} ${site.address.city}`)}`,
    logo: `${site.url}/Frederiks-bedrijfskleding-logo.jpg`,
    image: `${site.url}/Frederiks-bedrijfskleding-hengelo-.jpg`,
    slogan: site.tagline,
    founder: { '@id': `${site.url}/#jessi` },
    knowsAbout: KENNIS,
    brand: site.brands.map((b) => ({ '@type': 'Brand', name: b })),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Diensten',
      itemListElement: [
        'Werkkleding en bedrijfskleding op maat per functie',
        'Veiligheidsschoenen S1 tot S7',
        'Logo bedrukken en borduren in eigen huis',
        'Passen op locatie',
        'Gratis online kledingbeheer voor zakelijke klanten',
      ].map((n) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: n } })),
    },
  };
}

/** Onderwerpen waarop het bedrijf aantoonbaar deskundig is (entiteit voor LLM's). */
const KENNIS = [
  'Bedrijfskleding', 'Werkkleding', 'Veiligheidsschoenen', 'EN ISO 20345', 'EN ISO 20471',
  'EN ISO 11611', 'EN ISO 11612', 'Persoonlijke beschermingsmiddelen', 'Textielbedrukking', 'Borduren',
  'Kledingbeheer', 'Achterhoek',
];

/** Werkgebied: een cirkel van 24 km rond de showroom plus de plaatsen met eigen pagina. */
export function werkgebied() {
  return [
    {
      '@type': 'GeoCircle',
      geoMidpoint: { '@type': 'GeoCoordinates', latitude: site.address.geo.lat, longitude: site.address.geo.lng },
      geoRadius: KERNSTRAAL_KM * 1000,
    },
    { '@type': 'AdministrativeArea', name: 'Achterhoek' },
    ...plaatsen.map((p) => ({ '@type': 'City', name: p.name, url: `${site.url}/regio/${p.slug}` })),
  ];
}

/** Person-entiteit voor de eigenaar: auteur van de kennisbank, gezicht van het bedrijf. */
export function personJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${site.url}/#jessi`,
    name: site.owner,
    jobTitle: 'Eigenaar en kledingadviseur',
    worksFor: { '@id': `${site.url}/#bedrijf` },
    url: `${site.url}/over-ons`,
    sameAs: [site.social.linkedin].filter(Boolean),
    knowsAbout: KENNIS,
    workLocation: { '@type': 'Place', name: 'De Brouwersmolen, Hengelo (Gld)' },
  };
}

/** FAQPage schema, wint klassieke SEO én AI-overzichten (Q&A wordt geciteerd). */
export function faqJsonLd(faqs: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/** Service schema voor een branchepagina. */
export function serviceJsonLd(opts: { name: string; description: string; url: string; plaats?: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    serviceType: 'Bedrijfskleding',
    areaServed: opts.plaats ? { '@type': 'City', name: opts.plaats } : werkgebied().slice(0, 2),
    provider: { '@id': `${site.url}/#bedrijf` },
  };
}

/**
 * Kruimelpad. Relatieve URL's ('/assortiment') worden hier absoluut gemaakt:
 * Google wil volledige URL's in `item`, en een paar pagina's gaven paden mee.
 */
export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  const basis = site.url.replace(/\/$/, '');
  const absoluut = (u: string) => (u.startsWith('/') ? `${basis}${u === '/' ? '' : u}` : u);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name, item: absoluut(it.url),
    })),
  };
}

/** Article schema voor een kennisbankartikel (SEO + E-E-A-T). */
export function articleJsonLd(a: { slug: string; title: string; metaDescription: string; date: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.metaDescription,
    datePublished: a.date,
    dateModified: a.date,
    author: { '@type': 'Person', '@id': `${site.url}/#jessi`, name: site.owner, url: `${site.url}/over-ons` },
    inLanguage: 'nl-NL',
    publisher: { '@type': 'Organization', name: site.name, '@id': `${site.url}/#bedrijf` },
    mainEntityOfPage: `${site.url}/kennisbank/${a.slug}`,
  };
}

/** Review-schema voor klantbeoordelingen (sterren in Google). */
export function reviewsJsonLd(reviews: { author: string; text: string; rating: number }[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': reviews.map((r) => ({
      '@type': 'Review',
      itemReviewed: { '@type': 'LocalBusiness', name: site.name, '@id': `${site.url}/#bedrijf` },
      author: { '@type': 'Organization', name: r.author },
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      reviewBody: r.text,
    })),
  };
}
