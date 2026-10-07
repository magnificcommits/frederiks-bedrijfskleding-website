-- Snickers levert bovenkleding aan met een maatcode (3, 4, 5 ...) in plaats van
-- de maat. Hier omgezet naar de echte maat uit de vaste lijst; de code blijft
-- bewaard in maat_leverancier (nodig bij bestellen). Broekmaten (44 en hoger)
-- blijven staan. Veilig om opnieuw te draaien: alleen codes 2 t/m 12 worden geraakt.
update public.product_varianten pv
set maat_leverancier = coalesce(pv.maat_leverancier, pv.maat),
    maat = case pv.maat
      when '2' then 'XXS' when '3' then 'XS' when '4' then 'S' when '5' then 'M'
      when '6' then 'L' when '7' then 'XL' when '8' then '2XL' when '9' then '3XL'
      when '10' then '4XL' when '11' then '5XL' when '12' then '6XL'
    end
from public.producten p
where p.id = pv.product_id
  and p.merk ilike '%snickers%'
  and pv.maat in ('2','3','4','5','6','7','8','9','10','11','12');

-- Accessoires (kniebeschermers, riemen, gereedschapszakken): code 0 = één maat.
update public.product_varianten pv
set maat_leverancier = coalesce(pv.maat_leverancier, pv.maat), maat = 'One size'
from public.producten p
where p.id = pv.product_id and p.merk ilike '%snickers%' and pv.maat in ('0','00','000');
