# Koglen — PH Artichoke 480

Minimal enkeltproduktbutik med Stripe Checkout og et agent-lag ("Claude commerce").

## Kør lokalt

```bash
npm install
cp .env.example .env      # indsæt din Stripe secret key
npm start                 # → http://localhost:3000
```

Uden `STRIPE_SECRET_KEY` kører siden fint, men køb-knappen svarer 503.

## Stripe

1. Hent din **secret key** i Stripe-dashboardet (Developers → API keys). Brug `sk_test_…` mens du tester.
2. Sæt den i `.env`.
3. Testkort: `4242 4242 4242 4242`, hvilken som helst fremtidig udløbsdato og CVC.

Webhook (valgfrit, til ordrehåndtering):

```bash
stripe listen --forward-to localhost:3000/api/webhook
# kopiér whsec_… ind i .env som STRIPE_WEBHOOK_SECRET
```

Ordrelogikken hænger i `server.js` under `checkout.session.completed` — her kobler du mail, ERP eller lagertræk på.

## Deploy

**Vercel** (understøttet ud af boksen):

1. Importér repo'et — Framework Preset: **Other**, Root Directory: `./`. Build command og output directory står tomme.
2. Under *Environment Variables* tilføj `STRIPE_SECRET_KEY` (og evt. `STRIPE_WEBHOOK_SECRET`).
3. Deploy. `public/` serveres statisk af CDN'et, `api/index.js` kører hele Express-appen som én serverless function, og `vercel.json` router `/api/*` og `/.well-known/agent.json` derhen.

`BASE_URL` behøver du ikke sætte — appen udleder sin egen adresse fra request-headerne, så både preview- og produktions-URL'er virker.

**Render / Railway / Fly / VPS:** sæt `STRIPE_SECRET_KEY`, kør `npm start`.

## Filstruktur

| Fil | Rolle |
|---|---|
| `app.js` | Hele Express-appen — ruter, Stripe, agent-endpoints |
| `server.js` | Lokal dev-server (`app.listen`) |
| `api/index.js` | Vercel serverless entrypoint |
| `product.js` | Produktdata: pris, varianter, specs |
| `public/` | Statisk frontend |

## Priser og varianter

Ét sted: `product.js` (server) og `VARIANTS`/`BASE` øverst i `public/index.html` (klient). Beløb er i øre — 55.295 kr. = `5529500`.
Sæt `stock: 0` på en variant for at markere den som restordre.

## Agent-laget

| Endpoint | Formål |
|---|---|
| `GET /api/product.json` | schema.org Product, ét Offer pr. variant med pris, lager og URL |
| `GET /.well-known/agent.json` | Manifest: checkout-kontrakt, body-schema, politikker |
| `GET /llms.txt` | Instruktioner i klartekst til AI-agenter |
| `POST /api/checkout` | `{variant, quantity, email?}` → `{url}` — Stripe Checkout URL |
| `GET /api/session/:id` | Ordrestatus efter betaling |

Princippet: en agent kan læse katalog, regne totalen og **oprette** en betaling — men den kan ikke gennemføre den.
Brugeren godkender selv på Stripes side. Det holder det sikkert og gør det kompatibelt med agentic checkout-flows.

Prøv:

```bash
curl -s localhost:3000/api/product.json | jq .
curl -s -X POST localhost:3000/api/checkout \
  -H 'Content-Type: application/json' \
  -d '{"variant":"brass-brass","quantity":1}' | jq .
```

## Bemærk

Produktdata er hentet fra den offentlige produktside. Lagerstatus pr. variant er pladsholdere — kobl dem til dit eget lager før produktion. Billedet hotlinkes fra leverandørens CDN; siden falder tilbage til en tegnet SVG hvis det blokeres.
