import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260612100000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "medmkp_supplier_product" add column if not exists "image_url" text not null default '';`);
    this.addSql(`alter table if exists "medmkp_supplier_product" alter column "image_url" drop default;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "medmkp_supplier_product" drop column if exists "image_url";`);
  }

}
