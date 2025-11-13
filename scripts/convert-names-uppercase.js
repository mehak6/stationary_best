const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function convertProductNamesToUppercase() {
  try {
    console.log('🔄 Fetching all products...');

    // Fetch all products
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('*');

    if (fetchError) {
      throw fetchError;
    }

    if (!products || products.length === 0) {
      console.log('ℹ️  No products found in database');
      return;
    }

    console.log(`📦 Found ${products.length} products`);
    console.log('🔄 Converting names to UPPERCASE...\n');

    let converted = 0;
    let skipped = 0;
    let errors = 0;

    for (const product of products) {
      const uppercaseName = product.name.toUpperCase();

      // Skip if already uppercase
      if (product.name === uppercaseName) {
        console.log(`⏭️  Skipped: "${product.name}" (already uppercase)`);
        skipped++;
        continue;
      }

      console.log(`📝 Converting: "${product.name}" → "${uppercaseName}"`);

      // Update the product name
      const { error: updateError } = await supabase
        .from('products')
        .update({ name: uppercaseName })
        .eq('id', product.id);

      if (updateError) {
        console.error(`❌ Error updating ${product.name}:`, updateError.message);
        errors++;
      } else {
        converted++;
      }
    }

    console.log('\n✅ Conversion Complete!');
    console.log('═══════════════════════════════');
    console.log(`✓ Converted: ${converted} products`);
    console.log(`⏭ Skipped: ${skipped} products (already uppercase)`);
    if (errors > 0) {
      console.log(`❌ Errors: ${errors} products`);
    }
    console.log('═══════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error during conversion:', error);
    process.exit(1);
  }
}

// Also convert party purchase item names
async function convertPartyPurchaseNamesToUppercase() {
  try {
    console.log('\n🔄 Fetching all party purchases...');

    // Fetch all party purchases
    const { data: purchases, error: fetchError } = await supabase
      .from('party_purchases')
      .select('*');

    if (fetchError) {
      throw fetchError;
    }

    if (!purchases || purchases.length === 0) {
      console.log('ℹ️  No party purchases found in database');
      return;
    }

    console.log(`📦 Found ${purchases.length} party purchases`);
    console.log('🔄 Converting item names to UPPERCASE...\n');

    let converted = 0;
    let skipped = 0;
    let errors = 0;

    for (const purchase of purchases) {
      const uppercaseName = purchase.item_name.toUpperCase();

      // Skip if already uppercase
      if (purchase.item_name === uppercaseName) {
        console.log(`⏭️  Skipped: "${purchase.item_name}" (already uppercase)`);
        skipped++;
        continue;
      }

      console.log(`📝 Converting: "${purchase.item_name}" → "${uppercaseName}"`);

      // Update the item name
      const { error: updateError } = await supabase
        .from('party_purchases')
        .update({ item_name: uppercaseName })
        .eq('id', purchase.id);

      if (updateError) {
        console.error(`❌ Error updating ${purchase.item_name}:`, updateError.message);
        errors++;
      } else {
        converted++;
      }
    }

    console.log('\n✅ Conversion Complete!');
    console.log('═══════════════════════════════');
    console.log(`✓ Converted: ${converted} party purchases`);
    console.log(`⏭ Skipped: ${skipped} party purchases (already uppercase)`);
    if (errors > 0) {
      console.log(`❌ Errors: ${errors} party purchases`);
    }
    console.log('═══════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error during conversion:', error);
    process.exit(1);
  }
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  UPPERCASE NAME CONVERSION SCRIPT         ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  await convertProductNamesToUppercase();
  await convertPartyPurchaseNamesToUppercase();

  console.log('🎉 All conversions completed successfully!\n');
}

main();
