import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddInvoiceReminderField1733520000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'invoices',
      new TableColumn({
        name: 'lastReminderSentAt',
        type: 'timestamp',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('invoices', 'lastReminderSentAt');
  }
}

