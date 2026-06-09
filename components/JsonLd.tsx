/** Rendert een JSON-LD <script> blok voor structured data (SEO/AEO). */
export function JsonLd({ data }: { data: object }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
