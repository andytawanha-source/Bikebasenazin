import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Stripe from 'stripe';
import { PRODUCT, SITE_NAME, priceFor, formatDKK } from './product.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const app = express();

const stripeKey = process.env.STRIPE_SECRET_KEY;
export const stripe = stripeKey ? new Stripe(stripeKey) : null;

app.set('trust proxy', true);

/** Absolut base-URL for den aktuelle request — virker både lokalt og på Vercel. */
const baseUrl = (req) => {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto']?.split(',')[0] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
};

/* ------------------------------------------------------------------ */
/*  Stripe webhook must read the raw body — mount before express.json  */
/* ------------------------------------------------------------------ */
app.post('/api/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return res.status(503).send('webhook not configured');
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    // Hook dit ordresystem på her (mail, ERP, lagertræk, Slack …)
    console.log(`✓ Ordre betalt: ${s.id} — ${s.customer_details?.email} — ${s.amount_total / 100} ${s.currency?.toUpperCase()}`);
  }
  res.json({ received: true });
});

app.use(express.json());
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ------------------------------------------------------------------ */
/*  Agent-readable product feed  (the "Claude commerce" layer)         */
/* ------------------------------------------------------------------ */
const feed = (base) => ({
  '@context': 'https://schema.org',
  '@type': 'Product',
  '@id': `${base}/#product`,
  sku: PRODUCT.sku,
  name: `${PRODUCT.name} — ${PRODUCT.subtitle}`,
  brand: { '@type': 'Brand', name: PRODUCT.brand },
  image: [PRODUCT.image],
  description: PRODUCT.shortDescription,
  additionalProperty: PRODUCT.specs.map(([n, v]) => ({ '@type': 'PropertyValue', name: n, value: v })),
  offers: PRODUCT.variants.map((v) => ({
    '@type': 'Offer',
    '@id': `${base}/#offer-${v.id}`,
    name: v.name,
    sku: `${PRODUCT.sku}-${v.id.toUpperCase()}`,
    price: ((PRODUCT.price + v.priceDelta) / 100).toFixed(2),
    priceCurrency: PRODUCT.currency,
    availability: v.inStock ? 'https://schema.org/InStock' : 'https://schema.org/BackOrder',
    url: `${base}/?variant=${v.id}`,
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: PRODUCT.currency },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'DK' },
    },
    hasMerchantReturnPolicy: {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'DK',
      merchantReturnDays: PRODUCT.returns.days,
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    },
  })),
});

app.get(['/api/product', '/api/product.json'], (req, res) => res.json(feed(baseUrl(req))));

app.get('/.well-known/agent.json', (req, res) => {
  const base = baseUrl(req);
  res.json({
    name: SITE_NAME,
    description: `Enkeltproduktbutik for ${PRODUCT.name} (${PRODUCT.brand}).`,
    version: '1.0.0',
    contact: `${base}/`,
    commerce: {
      currency: PRODUCT.currency,
      payment_processor: 'stripe',
      catalog: `${base}/api/product.json`,
      checkout: {
        method: 'POST',
        url: `${base}/api/checkout`,
        content_type: 'application/json',
        body_schema: {
          type: 'object',
          properties: {
            variant: { type: 'string', enum: PRODUCT.variants.map((v) => v.id) },
            quantity: { type: 'integer', minimum: 1, maximum: 10, default: 1 },
            email: { type: 'string', format: 'email', description: 'Valgfri — forudfylder Stripe Checkout' },
          },
          required: ['variant'],
        },
        returns: {
          type: 'object',
          properties: { url: { type: 'string', description: 'Stripe Checkout URL — send brugeren hertil for at betale' } },
        },
        note: 'Endpointet opretter en Stripe Checkout Session. Der trækkes ingen penge før brugeren gennemfører betalingen selv.',
      },
    },
    policies: {
      shipping: PRODUCT.shipping.description,
      returns: PRODUCT.returns.description,
      warranty_months: PRODUCT.warrantyMonths,
    },
  });
});

/* ------------------------------------------------------------------ */
/*  Checkout                                                           */
/* ------------------------------------------------------------------ */
app.post('/api/checkout', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe er ikke konfigureret. Sæt STRIPE_SECRET_KEY.' });

  const base = baseUrl(req);
  const { variant: variantId, quantity = 1, email } = req.body ?? {};
  const variant = PRODUCT.variants.find((v) => v.id === variantId) ?? PRODUCT.variants[0];
  const qty = Math.max(1, Math.min(10, Number(quantity) || 1));

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'da',
      customer_email: email || undefined,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      shipping_address_collection: { allowed_countries: ['DK', 'SE', 'NO', 'DE'] },
      phone_number_collection: { enabled: true },
      line_items: [
        {
          quantity: qty,
          price_data: {
            currency: PRODUCT.currency.toLowerCase(),
            unit_amount: PRODUCT.price + variant.priceDelta,
            product_data: {
              name: `${PRODUCT.name} — ${variant.name}`,
              description: `${PRODUCT.brand} · design ${PRODUCT.designer}, ${PRODUCT.year} · Ø48 cm`,
              images: [PRODUCT.image],
              metadata: { sku: `${PRODUCT.sku}-${variant.id.toUpperCase()}` },
            },
          },
        },
      ],
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            display_name: 'Fri fragt i Danmark',
            fixed_amount: { amount: 0, currency: PRODUCT.currency.toLowerCase() },
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 2 },
              maximum: { unit: 'business_day', value: PRODUCT.shipping.leadTimeDays },
            },
          },
        },
      ],
      metadata: { product: PRODUCT.id, variant: variant.id },
      success_url: `${base}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?checkout=cancelled`,
    });
    res.json({ id: session.id, url: session.url, amount_total: priceFor(variant.id, qty), currency: PRODUCT.currency });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/session/:id', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe er ikke konfigureret.' });
  try {
    const s = await stripe.checkout.sessions.retrieve(req.params.id);
    res.json({
      status: s.status,
      payment_status: s.payment_status,
      email: s.customer_details?.email ?? null,
      amount_total: s.amount_total,
      amount_formatted: formatDKK(s.amount_total ?? 0),
      variant: s.metadata?.variant ?? null,
    });
  } catch {
    res.status(404).json({ error: 'Ukendt session' });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true, stripe: Boolean(stripe) }));

/* Statiske filer — bruges lokalt. På Vercel serveres public/ af CDN'et. */
app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'allow', extensions: ['html'] }));

export default app;
