# SPEED (Core Web Vitals)

## Doel
Snelle sites. Snelheid is ranking-signaal én conversie-hefboom. De bottleneck is zelden ruwe snelheid maar te veel client-JS, niet-gereserveerde afbeeldingen en render-blocking fonts.

## De drie Core Web Vitals (drempels, web.dev)
| Metriek | Goed | Matig | Slecht |
|---|---|---|---|
| **LCP** — Largest Contentful Paint | **≤ 2,5 s** | 2,5-4,0 s | > 4,0 s |
| **INP** — Interaction to Next Paint | **≤ 200 ms** | 200-500 ms | > 500 ms |
| **CLS** — Cumulative Layout Shift | **≤ 0,1** | 0,1-0,25 | > 0,25 |

- **INP verving FID** op 12 maart 2024 — meet álle interacties, niet alleen de eerste. Vaakst gefaalde metriek; let hier het meest op.
- Beoordeeld op het **75e percentiel** van echte gebruikers, gesplitst mobiel/desktop.
- LCP-drempel is **2,5 s**. Negeer de rondzwervende mythe dat het naar "2,0 s" is aangescherpt — dat is niet bevestigd.
- TTFB is geen Core Web Vital maar een diagnose: goed ≤ 0,8 s.

## Veld- vs. lab-data
- **Veld (echte gebruikers, = het ranking-signaal):** CrUX, Google Search Console (CWV-rapport), PageSpeed Insights (veld-sectie).
- **Lab (synthetisch, om te debuggen):** Lighthouse, DevTools, WebPageTest. INP/CLS vang je in lab niet volledig.
- Prioriteer veld-data. Een perfecte Lighthouse-100 met slechte CrUX-cijfers ranked niet beter.

## Next.js/Vercel-hefbomen (grootste impact eerst)
1. **Server Components als default.** `"use client"` alleen bij state, effects, event-handlers of browser-API's. Grootste hefboom voor INP.
2. **`next/image`** — responsive maten, moderne formaten, lazy-loading. Expliciete `width`/`height` (of `fill`) tegen CLS; `priority` op de LCP-afbeelding.
3. **`next/font`** — self-host fonts bij build; geen render-blocking font-request, geen swap-shift (nul CLS).
4. **Streaming + Suspense** — stream above-the-fold eerst, stel trage data uit.
5. **ISR / caching** — `revalidate` voor incrementele regeneratie; statisch/ISR vanaf de edge-CDN geeft de beste TTFB. In Next 15 is fetch-caching niet meer standaard aan — cache expliciet.
6. **Bundle-grootte** — `next/dynamic` voor zware client-code, tree-shaking, vermijd grote client-libs.
7. **Edge** — Vercels edge-netwerk + image-CDN snijden de globale TTFB.

Op een andere stack: dezelfde principes (minimaal client-JS, dimensies reserveren, fonts self-hosten, cachen aan de rand).

## Spanning met "craft"
Onderscheidend design mag de vitals niet slopen (zie core/ANTI_AI_DESIGN.md). Subset fonts, lazy-load media, reserveer afbeeldingsdimensies, houd animaties GPU-goedkoop.

## Checklist bij go-live
- [ ] Veld-CWV (Search Console) op 75e percentiel: LCP ≤ 2,5 s · INP ≤ 200 ms · CLS ≤ 0,1
- [ ] LCP-afbeelding heeft `priority` + vaste dimensies
- [ ] Fonts self-hosted (`next/font`), geen externe font-request
- [ ] Geen onnodige `"use client"`; zware client-libs dynamisch geladen
- [ ] Third-party scripts (analytics, chat, embeds) uitgesteld/geminimaliseerd
- [ ] Search Console gekoppeld; CWV-rapport gecontroleerd
