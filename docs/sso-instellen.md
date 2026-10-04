# Inloggen met Microsoft en Google instellen

Klanten (portaal, `/portaal/login`) en beheerders (KMS, `/dashboard`) kunnen naast de
inlogmail ook inloggen met hun Microsoft- of Google-account. De knoppen staan pas op de
loginpagina als je ze in Vercel aanzet. Dit document beschrijft de stappen.

**Wie mag erin?** Inloggen met Microsoft of Google bewijst alleen wie iemand is. Na het
inloggen controleert de site:

- **Portaal:** het e-mailadres moet bij een portaalgebruiker staan (klant → Portaaltoegang
  in het KMS, of uitgenodigd via Team in het portaal). Zo niet, dan wordt de gebruiker
  direct weer uitgelogd met de melding "Dit account heeft nog geen toegang. Vraag je
  beheerder om je uit te nodigen."
- **KMS:** het e-mailadres moet een actieve beheerder zijn (Beheerders in het KMS).
  Tweestapsverificatie en de sessie van 8 uur gelden ook bij inloggen met Microsoft of Google.

Het e-mailadres van het Microsoft- of Google-account moet dus exact gelijk zijn aan het
adres dat in het portaal of KMS is vastgelegd.

---

## 1. Microsoft (Entra ID, voorheen Azure AD)

1. Ga naar <https://entra.microsoft.com> → **Identity → Applications → App registrations →
   New registration**.
2. Naam: `Frederiks Bedrijfskleding portaal`.
3. **Supported account types:** kies *Accounts in any organizational directory (Any
   Microsoft Entra ID tenant - Multitenant)*. Klanten zitten elk in hun eigen organisatie;
   met deze keuze kunnen ze allemaal inloggen (tenant "common"). Wil je ook persoonlijke
   Outlook/Hotmail-accounts toelaten, kies dan de optie *...and personal Microsoft accounts*.
4. **Redirect URI:** platform *Web*, adres
   `https://ldbyljadqququzoicyid.supabase.co/auth/v1/callback`
5. Klik **Register**. Noteer op de overzichtspagina de **Application (client) ID**.
6. **Certificates & secrets → Client secrets → New client secret.** Kies een looptijd
   (bijvoorbeeld 24 maanden) en kopieer meteen de **Value** (niet de Secret ID). Zet in je
   agenda wanneer het geheim verloopt: daarna werkt inloggen met Microsoft niet meer tot je
   een nieuw geheim invult.
7. **Token configuration → Add optional claim → ID** en vink `email` en `xms_edov` aan.
   `xms_edov` vertelt Supabase dat Microsoft het e-mailadres heeft gecontroleerd. Zonder
   deze claim kan Supabase het adres als onbevestigd zien en wordt de login geweigerd.
   Accepteer de vraag om de Microsoft Graph-rechten (email, profile) toe te voegen.

## 2. Google (Google Cloud)

1. Ga naar <https://console.cloud.google.com>, maak of kies een project
   (bijvoorbeeld `frederiks-portaal`).
2. **APIs & Services → OAuth consent screen** (of *Google Auth Platform → Branding*):
   - User type: **External**.
   - App name `Frederiks Bedrijfskleding`, support-e-mail en het logo.
   - Authorized domains: `supabase.co` en later het eigen domein.
   - Scopes: alleen `email`, `profile` en `openid`.
   - Zet de app op **In production** (anders kunnen alleen testgebruikers inloggen).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized JavaScript origins: `https://frederiks-bedrijfskleding-website.vercel.app`
     (later ook het eigen domein).
   - Authorized redirect URIs: `https://ldbyljadqququzoicyid.supabase.co/auth/v1/callback`
4. Kopieer de **Client ID** en het **Client secret**.

## 3. Supabase

Open het project in <https://supabase.com/dashboard/project/ldbyljadqququzoicyid>.

**Providers** (Authentication → Sign In / Providers):

- **Azure:** zet aan, vul de Client ID (Application ID) en de Secret Value in.
  *Azure Tenant URL:* `https://login.microsoftonline.com/common` (voor meerdere
  organisaties; dit is ook wat Supabase gebruikt als je het leeg laat).
- **Google:** zet aan, vul Client ID en Client secret in.
- Laat bij **Email** de optie *Confirm email* aan. Dan geeft Supabase geen sessie aan een
  account waarvan het e-mailadres niet bevestigd is.
- *Allow new users to sign up* mag aan blijven: een nieuw account zonder toegang wordt
  door de site meteen weer uitgelogd en ziet geen gegevens. Zet je het uit, dan kunnen
  alleen mensen die al eens met de inlogmail zijn ingelogd via Microsoft of Google
  inloggen.

**URL Configuration** (Authentication → URL Configuration):

- **Site URL:** `https://frederiks-bedrijfskleding-website.vercel.app`
  (later het eigen domein, bijvoorbeeld `https://www.frederiksbedrijfskleding.nl`).
- **Redirect URLs**, voeg toe:
  - `https://frederiks-bedrijfskleding-website.vercel.app/**`
  - later: `https://www.frederiksbedrijfskleding.nl/**` (het eigen domein)
  - voor lokaal testen: `http://localhost:3000/**`

  De site stuurt na het inloggen terug naar `/portaal/auth/callback` of
  `/dashboard/auth/callback`. Staat het adres hier niet in, dan stuurt Supabase naar de
  Site URL en lukt het inloggen niet.

## 4. Vercel

Project → **Settings → Environment Variables**, voor Production (en eventueel Preview):

| Variabele | Waarde | Effect |
| --- | --- | --- |
| `NEXT_PUBLIC_SSO_MICROSOFT` | `1` | Toont "Inloggen met Microsoft" |
| `NEXT_PUBLIC_SSO_GOOGLE` | `1` | Toont "Inloggen met Google" |

Zet een variabele pas op `1` als de provider in Supabase aan staat. Leeg of weggelaten
betekent: knop verborgen. Na het wijzigen opnieuw deployen (Deployments → Redeploy),
want deze waarden worden bij de build in de pagina gezet.

## 5. Testen

1. Open `/portaal/login` in een privévenster en klik op een van de knoppen.
2. Log in met een account dat als portaalgebruiker bekend is: je komt in het portaal.
3. Probeer een account dat niet bekend is: je komt terug op de loginpagina met de melding
   dat het account nog geen toegang heeft.
4. Herhaal op `/dashboard` met een beheerdersaccount en met een gewoon account.
5. Test ook in de geïnstalleerde app op de telefoon. Het inloggen gebeurt in hetzelfde
   venster (geen popup), daarna kom je terug in de app.

## Veelvoorkomende problemen

- **"redirect_uri mismatch" bij Microsoft of Google:** de redirect-URI bij de provider is
  niet exact `https://ldbyljadqququzoicyid.supabase.co/auth/v1/callback`.
- **Na inloggen terug op de homepage in plaats van het portaal:** het adres van de site
  staat niet bij Redirect URLs in Supabase.
- **"Dit account heeft nog geen toegang" terwijl de persoon wel bekend is:** het
  e-mailadres van het Microsoft- of Google-account wijkt af van het vastgelegde adres
  (bijvoorbeeld `j.jansen@` tegenover `jan.jansen@`). Pas het adres in het portaal of KMS aan.
- **Microsoft-login geweigerd met een melding over een onbevestigd e-mailadres:** de
  optionele claim `xms_edov` ontbreekt (stap 1.7).
