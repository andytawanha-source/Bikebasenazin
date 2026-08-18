// Eneste kilde til produktdata. Bruges af serveren, JSON-feedet,
// agent-manifestet og Stripe-sessionen.
//
// Priser er i øre. Priser og mål er hentet fra brdr-friis.dk (fra-pris).
// Billeder hotlinkes fra samme Sirv-CDN som webshoppen selv bruger.

export const SITE_NAME = 'Koglen';
const P = 'https://brdrfriis.sirv.com/magento/catalog/product/';

export const SIZES = [
  {
    id: '480',
    name: 'PH Artichoke 480',
    diameter: '48 cm',
    height: '46,5 cm',
    price: 5529500,
    listPrice: 7900000,
    sku: '106/480KOGLE',
    measurement: P + 'p/h/ph-artichoke-eu-480-copper-chrome-measurement.jpg',
  },
  {
    id: '600',
    name: 'PH Artichoke 600',
    diameter: '60 cm',
    height: '58 cm',
    price: 6561500,
    listPrice: 9650000,
    sku: '106/600KOGLE',
    measurement: P + 'p/h/ph-artichoke-eu-600-pendant-dusty-blue-chrome-measurement.jpg',
  },
];

// Farverne som de hedder hos forhandleren.
export const FINISHES = [
  { id: 'kobber',      name: 'Kobber',      swatch: '#b06d44', img: { 480: P + 'p/h/ph-artichoke-480-copper-chrome.jpg',            600: P + 'p/h/ph-artichoke-600-copper-chrome.jpg' } },
  { id: 'messing',     name: 'Messing',     swatch: '#b3924f', img: { 480: P + 'p/h/ph-artichoke-480-brass-chrome.jpg',             600: P + '9/0/90145-5-2-05b-600-ph-artichoke-brass.jpg' } },
  { id: 'staal',       name: 'Stål',        swatch: '#a9adb2', img: { 480: P + 'p/h/ph-artichoke-480-stainless_steel-chrome.jpg',   600: P + '9/0/90145-5-2-03b-600-ph-artichoke-steel.jpg' } },
  { id: 'hvid',        name: 'Hvid',        swatch: '#f2f0ec', img: { 480: P + 'p/h/ph-artichoke-480-white-chrome.jpg',             600: P + 'p/h/ph-artichoke-600-white-chrome.jpg' } },
  { id: 'sort',        name: 'Sort',        swatch: '#22201e', img: { 480: P + 'p/h/ph-artichoke-480-black-chrome.jpg',             600: P + '9/0/90145-5-2-07b-600-ph-artichoke-black-rgb-int-p.jpg' } },
  { id: 'soft-white',  name: 'Soft white',  swatch: '#e6e1d6', img: { 480: P + 'p/h/ph-artichoke-480-pendant-soft-white-brass.jpg', 600: P + 'p/h/ph-artichoke-600-pendant-soft-white-brass.jpg' } },
  { id: 'dusty-blue',  name: 'Dusty blue',  swatch: '#6b7d8c', img: { 480: P + 'p/h/ph-artichoke-480-pendant-dusty-blue-chrome.jpg',  600: P + 'p/h/ph-artichoke-600-pendant-dusty-blue-chrome.jpg' } },
  { id: 'dusty-green', name: 'Dusty green', swatch: '#6d7a68', img: { 480: P + 'p/h/ph-artichoke-480-pendant-dusty-green-chrome.jpg', 600: P + 'p/h/ph-artichoke-600-pendant-dusty-green-chrome.jpg' } },
];

export const LIFESTYLE = [
  P + 'b/u/bunkeren-10burwoodrd-whitebridge-ph-artichoke-09_1.jpg',
  P + 'b/u/bunkeren-10burwoodrd-whitebridge-ph-artichoke-11_1.jpg',
  P + 'b/u/bunkeren-10burwoodrd-whitebridge-ph-artichoke-37_1.jpg',
  P + 's/s/ss23-icons-interior-artichoke-kobber-10000_1.jpg',
];

export const PRODUCT = {
  id: 'ph-artichoke',
  family: 'PH Artichoke',
  subtitle: 'Koglen',
  brand: 'Louis Poulsen',
  designer: 'Poul Henningsen',
  year: 1958,
  currency: 'DKK',
  image: FINISHES[0].img['480'],
  shortDescription:
    '72 laserskårne blade i 12 rækker à seks blade. Konstruktionen dækker lyskilden fra enhver synsvinkel, så pendlen aldrig blænder.',
  specs: [
    ['Lyskilde', '1 × E27, maks. 100 W (medfølger ikke)'],
    ['Blade', '72 stk. i 12 rækker'],
    ['Ledningslængde', '4 m'],
    ['Beskyttelsesgrad', 'IP20, klasse I'],
    ['Materiale, blade', 'Kobber, messing eller rustfrit stål'],
    ['Materiale, stel', 'Laserskåret stål, forkromet eller messingmetalliseret'],
    ['Overskærm', 'Pulverlakeret stål med hvid inderside'],
    ['Designår', '1958'],
  ],
  shipping: { price: 0, description: 'Gratis levering i Danmark. Møbeltransport eller GLS.', leadTimeDays: 5 },
  returns: { days: 30, description: '30 dages fuld returret. Kunden betaler returfragt.' },
  warrantyMonths: 24,
};

/** Alle salgbare kombinationer af størrelse og farve. */
export const variants = () =>
  SIZES.flatMap((s) =>
    FINISHES.map((f) => ({
      id: `${s.id}-${f.id}`,
      size: s.id,
      finish: f.id,
      name: `${s.name} — ${f.name}`,
      sku: `${s.sku}-${f.id.toUpperCase()}`,
      price: s.price,
      listPrice: s.listPrice,
      image: f.img[s.id],
      inStock: true, // TODO: kobl til rigtigt lager
    }))
  );

export const findVariant = (id) => variants().find((v) => v.id === id);

export const formatDKK = (minor) =>
  new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }).format(minor / 100);
