// Lokal udviklingsserver. På Vercel bruges api/index.js i stedet.
import app, { stripe } from './app.js';
import { SITE_NAME } from './product.js';

const PORT = process.env.PORT || 3000;

if (!stripe) {
  console.warn('\n⚠  STRIPE_SECRET_KEY mangler i .env — siden kører, men checkout returnerer 503.\n');
}

app.listen(PORT, () => console.log(`▲ ${SITE_NAME} kører på http://localhost:${PORT}`));
