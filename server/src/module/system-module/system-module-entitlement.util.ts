import {
  BASELINE_TENANT_SYSTEM_MODULE_CODES,
  SAAS_TO_SYSTEM_MODULE_BRIDGE,
} from './constants';

export interface SystemModuleSaasBridgeLike {
  saasModuleCode: string;
  systemModuleCode: string;
  enabled: number | boolean;
}

export function isBaselineTenantSystemModule(moduleCode: string) {
  return (BASELINE_TENANT_SYSTEM_MODULE_CODES as readonly string[]).includes(moduleCode);
}

export function resolveSystemModuleCodesFromSaasModules(
  saasModuleCodes: string[],
  bridgeRows: SystemModuleSaasBridgeLike[],
) {
  const rowsBySaasModule = new Map<string, SystemModuleSaasBridgeLike[]>();
  for (const row of bridgeRows) {
    const rows = rowsBySaasModule.get(row.saasModuleCode) || [];
    rows.push(row);
    rowsBySaasModule.set(row.saasModuleCode, rows);
  }

  const systemModuleCodes = new Set<string>();
  for (const saasModuleCode of [...new Set(saasModuleCodes.filter(Boolean))]) {
    const overrideRows = rowsBySaasModule.get(saasModuleCode);
    const mappedCodes = overrideRows?.length
      ? overrideRows
          .filter((row) => Number(row.enabled) === 1)
          .map((row) => row.systemModuleCode)
      : SAAS_TO_SYSTEM_MODULE_BRIDGE[saasModuleCode] || [];
    for (const systemModuleCode of mappedCodes) {
      if (systemModuleCode) systemModuleCodes.add(systemModuleCode);
    }
  }
  return systemModuleCodes;
}
