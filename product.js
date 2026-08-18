// Single source of truth for the product.
// Used by the server, the JSON feed, the agent manifest and the Stripe session.

export const SITE_NAME = 'Koglen';

export const PRODUCT = {
  id: 'ph-artichoke-480',
  sku: '106/480KOGLE/MASTER',
  name: 'PH Artichoke 480',
  subtitle: 'Koglen',
  brand: 'Louis Poulsen',
  designer: 'Poul Henningsen',
  year: 1958,
  currency: 'DKK',
  // Prices in minor units (øre) — the only place they are defined.
  price: 5529500,
  listPrice: 7900000,
  image: 'https://brdrfriis.sirv.com/magento/catalog/product/p/h/ph-artichoke-480-copper-chrome_1.jpg',
  shortDescription:
    '72 laserskårne blade i 12 rækker. Blændfri i enhver synsvinkel. En kompakt udgave af Poul Henningsens ikoniske pendel fra 1958.',
  specs: [
    ['Diameter', '48 cm'],
    ['Højde', '46,5 cm'],
    ['Ledning', '4 m'],
    ['Lyskilde', '1 × E27, maks. 100 W (medfølger ikke)'],
    ['Beskyttelse', 'IP20, klasse I'],
    ['Blade', '72 stk. i 12 rækker'],
  ],
  variants: [
    { id: 'copper-chrome', name: 'Kobber / krom', swatch: '#b06d44', priceDelta: 0, inStock: true },
    { id: 'brass-brass', name: 'Messing / messing', swatch: '#b3924f', priceDelta: 0, inStock: true },
    { id: 'steel-chrome', name: 'Rustfrit stål / krom', swatch: '#a9adb2', priceDelta: 0, inStock: true },
    { id: 'black', name: 'Sort', swatch: '#22201e', priceDelta: 0, inStock: true },
    { id: 'soft-white', name: 'Soft white', swatch: '#eae7e0', priceDelta: 0, inStock: true },
    { id: 'dusty-green', name: 'Dusty green', swatch: '#6d7a68', priceDelta: 0, inStock: false },
    { id: 'dusty-blue', name: 'Dusty blue', swatch: '#6b7d8c', priceDelta: 0, inStock: true },
  ],
  shipping: {
    price: 0,
    description: 'Fri fragt i Danmark. Møbeltransport eller GLS.',
    leadTimeDays: 5,
  },
  returns: { days: 30, description: '30 dages fuld returret. Kunden betaler returfragt.' },
  warrantyMonths: 24,
};

export const priceFor = (variantId = null, qty = 1) => {
  const v = PRODUCT.variants.find((x) => x.id === variantId);
  return (PRODUCT.price + (v?.priceDelta ?? 0)) * Math.max(1, Math.min(10, Number(qty) || 1));
};

export const formatDKK = (minor) =>
  new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }).format(minor / 100);
