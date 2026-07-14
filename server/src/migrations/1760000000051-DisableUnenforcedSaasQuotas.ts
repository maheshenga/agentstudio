import { MigrationInterface, QueryRunner } from 'typeorm';

export class DisableUnenforcedSaasQuotas1760000000051 implements MigrationInterface {
  name = 'DisableUnenforcedSaasQuotas1760000000051';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE `saas_plan_quota` SET `status` = 0 WHERE `quota_type` IN ('storage_mb', 'rag_documents')",
    );
    await queryRunner.query(
      "UPDATE `saas_tenant_resource` SET `status` = 0 WHERE `resource_type` IN ('storage_mb', 'rag_documents')",
    );
    await queryRunner.query(
      "UPDATE `saas_resource_pack` SET `status` = 0 WHERE `resource_type` IN ('storage_mb', 'rag_documents')",
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Status history cannot be reconstructed safely; rollback must not re-enable products.
  }
}
