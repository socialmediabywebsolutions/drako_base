const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_tu_clave_aqui');

const plansToCreate = [
  // Influencer
  { name: 'Socialcors Influencer Starter', amount: 9900, metadata: { slug: 'influencer-starter', kind: 'influencer' } },
  { name: 'Socialcors Influencer Básico', amount: 17900, metadata: { slug: 'influencer-basico', kind: 'influencer' } },
  { name: 'Socialcors Influencer Pro', amount: 29900, metadata: { slug: 'influencer-pro', kind: 'influencer' } },
  // Empresa
  { name: 'Socialcors Empresa Starter', amount: 16900, metadata: { slug: 'empresa-starter', kind: 'empresa' } },
  { name: 'Socialcors Empresa Básico', amount: 29900, metadata: { slug: 'empresa-basico', kind: 'empresa' } },
  { name: 'Socialcors Empresa Pro', amount: 44900, metadata: { slug: 'empresa-pro', kind: 'empresa' } },
];

async function main() {
  console.log('🚀 Creando productos y precios en Stripe...\n');
  for (const p of plansToCreate) {
    const product = await stripe.products.create({ name: p.name, metadata: p.metadata });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: p.amount,
      currency: 'eur',
      recurring: { interval: 'month' },
    });
    console.log(`✅ ${p.name} (${p.metadata.slug}):`);
    console.log(`   Product ID: ${product.id}`);
    console.log(`   Price ID:   ${price.id}\n`);
  }
}

main().catch(console.error);
