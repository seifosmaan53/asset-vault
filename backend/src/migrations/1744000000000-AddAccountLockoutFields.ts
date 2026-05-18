import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAccountLockoutFields1744000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add failedLoginAttempts column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'failedLoginAttempts',
        type: 'int',
        default: 0,
        isNullable: false,
      }),
    );

    // Add lockedUntil column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'lockedUntil',
        type: 'timestamptz',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove lockedUntil column
    await queryRunner.dropColumn('users', 'lockedUntil');

    // Remove failedLoginAttempts column
    await queryRunner.dropColumn('users', 'failedLoginAttempts');
  }
}

