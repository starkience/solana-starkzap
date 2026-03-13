import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('starknet_wallets');
  if (exists) return;

  await knex.schema.createTable('starknet_wallets', (table) => {
    table.increments('id').primary();
    table.string('user_id').notNullable().unique();
    table.string('privy_wallet_id').notNullable().unique();
    table.string('wallet_address').notNullable();
    table.string('public_key').notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('starknet_wallets');
}
