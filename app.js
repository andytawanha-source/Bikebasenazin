import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Stripe from 'stripe';
import { PRODUCT, SITE_NAME, SIZES, FINISHES, variants, findVariant, formatDKK } from './product.js';

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
  '@type': 'ProductGroup',
  '@id': `${base}/#product`,
  name: `${PRODUCT.family} — ${PRODUCT.subtitle}`,
  brand: { '@type': 'Brand', name: PRODUCT.brand },
  description: PRODUCT.shortDescription,
  productGroupID: PRODUCT.id,
  variesBy: ['https://schema.org/size', 'https://schema.org/color'],
  additionalProperty: PRODUCT.specs.map(([n, v]) => ({ '@type': 'PropertyValue', name: n, value: v })),
  hasVariant: variants().map((v) => {
    const size = SIZES.find((s) => s.id === v.size);
    const finish = FINISHES.find((f) => f.id === v.finish);
    return {
      '@type': 'Product',
      '@id': `${base}/#${v.id}`,
      name: v.name,
      sku: v.sku,
      color: finish.name,
      size: size.diameter,
      image: [v.image],
      width: { '@type': 'QuantitativeValue', value: parseFloat(size.diameter), unitCode: 'CMT' },
      height: { '@type': 'QuantitativeValue', value: parseFloat(size.height.replace(',', '.')), unitCode: 'CMT' },
      offers: {
        '@type': 'Offer',
        price: (v.price / 100).toFixed(2),
        priceCurrency: PRODUCT.currency,
        availability: v.inStock ? 'https://schema.org/InStock' : 'https://schema.org/BackOrder',
        url: `${base}/?size=${v.size}&finish=${v.finish}`,
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
      },
    };
  }),
});

app.get(['/api/product', '/api/product.json'], (req, res) => res.json(feed(baseUrl(req))));

app.get('/.well-known/agent.json', (req, res) => {
  const base = baseUrl(req);
  res.json({
    name: SITE_NAME,
    description: `Enkeltproduktbutik for ${PRODUCT.family} ${PRODUCT.subtitle} (${PRODUCT.brand}).`,
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
            variant: { type: 'string', enum: variants().map((v) => v.id), description: 'Format: <størrelse>-<farve>, fx 600-messing' },
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
  const { email } = req.body ?? {};

  // Accepterer både {variant, quantity} (én vare) og {items:[{variant, quantity}]} (kurv).
  const raw = Array.isArray(req.body?.items) && req.body.items.length
    ? req.body.items
    : [{ variant: req.body?.variant, quantity: req.body?.quantity ?? 1 }];

  const cart = raw
    .map((i) => ({
      variant: findVariant(i?.variant),
      qty: Math.max(1, Math.min(10, Number(i?.quantity) || 1)),
    }))
    .filter((i) => i.variant);

  if (!cart.length) return res.status(400).json({ error: 'Ingen gyldig variant. Se /api/product.json for gyldige id\'er.' });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'da',
      customer_email: email || undefined,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      shipping_address_collection: { allowed_countries: ['DK', 'SE', 'NO', 'DE'] },
      phone_number_collection: { enabled: true },
      line_items: cart.map(({ variant, qty }) => {
        const size = SIZES.find((s) => s.id === variant.size);
        return {
          quantity: qty,
          price_data: {
            currency: PRODUCT.currency.toLowerCase(),
            unit_amount: variant.price,
            product_data: {
              name: variant.name,
              description: `${PRODUCT.brand} · design ${PRODUCT.designer}, ${PRODUCT.year} · Ø ${size.diameter} × H ${size.height}`,
              images: [variant.image],
              metadata: { sku: variant.sku },
            },
          },
        };
      }),
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
      metadata: {
        product: PRODUCT.id,
        cart: cart.map(({ variant, qty }) => `${variant.id}x${qty}`).join(', '),
      },
      success_url: `${base}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?checkout=cancelled`,
    });
    const amount = cart.reduce((sum, { variant, qty }) => sum + variant.price * qty, 0);
    res.json({ id: session.id, url: session.url, amount_total: amount, currency: PRODUCT.currency });
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
      cart: s.metadata?.cart ?? null,
    });
  } catch {
    res.status(404).json({ error: 'Ukendt session' });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true, stripe: Boolean(stripe) }));

/* Statiske filer — bruges lokalt. På Vercel serveres public/ af CDN'et. */
app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'allow', extensions: ['html'] }));

export default app;
