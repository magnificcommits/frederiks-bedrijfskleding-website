import { site } from '@/content/site';
import { plaatsen } from '@/content/plaatsen';

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
    areaServed: ['Achterhoek', ...plaatsen.map((p) => p.name)],
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
    author: { '@type': 'Person', name: site.owner },
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
