import { getMetadataArgsStorage } from 'typeorm';

import { AppFactoryModuleEntity } from './app-factory-module.entity';
import { AppFactoryTemplateEntity } from './app-factory-template.entity';

describe('app factory entity contracts', () => {
  const columnNames = (target: Function) =>
    getMetadataArgsStorage()
      .columns.filter((column) => column.target === target)
      .map((column) => String(column.options.name || column.propertyName));

  it('versions templates by code and template version', () => {
    expect(columnNames(AppFactoryTemplateEntity)).toEqual(
      expect.arrayContaining([
        'schema_version',
        'template_version',
        'runtime_target',
        'manifest_defaults',
      ]),
    );

    const versionIndex = getMetadataArgsStorage().indices.find(
      (index) => index.target === AppFactoryTemplateEntity && index.name === 'uk_app_factory_template_code_version',
    );
    expect(versionIndex?.columns).toEqual(['code', 'templateVersion']);
    expect(versionIndex?.unique).toBe(true);
  });

  it('persists template provenance on generated modules', () => {
    expect(columnNames(AppFactoryModuleEntity)).toEqual(
      expect.arrayContaining([
        'template_code',
        'template_version',
        'template_schema_version',
        'runtime_target',
        'manifest_defaults',
      ]),
    );
  });
});
