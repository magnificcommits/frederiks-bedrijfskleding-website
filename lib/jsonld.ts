import { site } from '@/content/site';
import { plaatsen } from '@/content/plaatsen';

const dayMap: Record<string, string> = {
  Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday',
};

/** LocalBusiness / ClothingStore schema — basis voor lokale SEO en AI-antwoorden. */
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
    ...(site.rating.count > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: site.rating.value, reviewCount: site.rating.count, bestRating: 5 } }
      : {}),
    sameAs: [site.social.linkedin, site.social.facebook].filter(Boolean),
    areaServed: ['Achterhoek', ...plaatsen.map((p) => p.name)],
  };
}

/** FAQPage schema — wint klassieke SEO én AI-overzichten (Q&A wordt geciteerd). */
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
export function serviceJsonLd(opts: { name: string; description: string; url: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    serviceType: 'Bedrijfskleding',
    areaServed: 'Achterhoek',
    provider: { '@id': `${site.url}/#bedrijf` },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name, item: it.url,
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
    author: { '@type': 'Person', name: site.owner },
    publisher: { '@type': 'Organization', name: site.name, '@id': `${site.url}/#bedrijf` },
    mainEntityOfPage: `${site.url}/kennisbank/${a.slug}`,
  };
}
