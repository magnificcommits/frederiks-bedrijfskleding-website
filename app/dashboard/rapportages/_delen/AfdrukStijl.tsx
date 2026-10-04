/**
 * Printversie zonder het dashboardmenu: bij afdrukken is alleen het element
 * met id="rapport-afdruk" zichtbaar, op A4 en zonder links in de kleur van het
 * scherm. Staat in de pagina zelf, zodat de globale stylesheet ongemoeid blijft.
 */
export default function AfdrukStijl() {
  return (
    <style>{`
      @media print {
        @page { size: A4; margin: 14mm 12mm; }
        html, body { background: #fff !important; }
        body * { visibility: hidden; }
        #rapport-afdruk, #rapport-afdruk * { visibility: visible; }
        #rapport-afdruk { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
        #rapport-afdruk a { color: inherit !important; text-decoration: none !important; }
        #rapport-afdruk .panel { border-color: #ddd; break-inside: avoid; }
        #rapport-afdruk table { font-size: 10.5px; }
        #rapport-afdruk thead { display: table-header-group; }
        #rapport-afdruk tr { break-inside: avoid; }
      }
    `}</style>
  );
}
