export interface SystemModuleDependencyLike {
  moduleCode: string;
  dependsOnCode: string;
  versionRange?: string | null;
  required?: number | boolean;
}

interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const COMPARATOR_PATTERN = /^(\^|~|>=|<=|>|<|=)?((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/;

export function isValidSystemModuleVersion(version: string) {
  return SEMVER_PATTERN.test(String(version || '').trim());
}

export function isValidSystemModuleVersionRange(versionRange?: string | null) {
  const range = String(versionRange || '').trim();
  if (!range || range === '*') return true;
  const alternatives = range.split('||').map((part) => part.trim());
  return alternatives.every(
    (alternative) =>
      Boolean(alternative) &&
      alternative.split(/\s+/).every((comparator) => COMPARATOR_PATTERN.test(comparator)),
  );
}

export function satisfiesSystemModuleVersionRange(
  version: string,
  versionRange?: string | null,
) {
  const candidate = parseSemVer(version);
  const range = String(versionRange || '').trim();
  if (!candidate || !isValidSystemModuleVersionRange(range)) return false;
  if (!range || range === '*') return true;

  return range.split('||').some((alternative) =>
    alternative
      .trim()
      .split(/\s+/)
      .every((comparator) => matchesComparator(candidate, comparator)),
  );
}

export function findSystemModuleDependencyCycle(
  dependencies: SystemModuleDependencyLike[],
): string[] | null {
  const graph = new Map<string, string[]>();
  for (const dependency of dependencies) {
    if (dependency.required === false || Number(dependency.required) === 0) continue;
    const targets = graph.get(dependency.moduleCode) || [];
    targets.push(dependency.dependsOnCode);
    graph.set(dependency.moduleCode, targets);
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const path: string[] = [];
  const visit = (moduleCode: string): string[] | null => {
    const cycleStart = path.indexOf(moduleCode);
    if (visiting.has(moduleCode)) return [...path.slice(cycleStart), moduleCode];
    if (visited.has(moduleCode)) return null;

    visiting.add(moduleCode);
    path.push(moduleCode);
    for (const dependencyCode of graph.get(moduleCode) || []) {
      const cycle = visit(dependencyCode);
      if (cycle) return cycle;
    }
    path.pop();
    visiting.delete(moduleCode);
    visited.add(moduleCode);
    return null;
  };

  for (const moduleCode of graph.keys()) {
    const cycle = visit(moduleCode);
    if (cycle) return cycle;
  }
  return null;
}

function parseSemVer(version: string): SemVer | null {
  const match = SEMVER_PATTERN.exec(String(version || '').trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function matchesComparator(candidate: SemVer, comparator: string) {
  const match = COMPARATOR_PATTERN.exec(comparator);
  if (!match) return false;
  const operator = match[1] || '=';
  const target = parseSemVer(match[2]);
  if (!target) return false;
  const compared = compareSemVer(candidate, target);

  if (operator === '=') return compared === 0;
  if (operator === '>') return compared > 0;
  if (operator === '>=') return compared >= 0;
  if (operator === '<') return compared < 0;
  if (operator === '<=') return compared <= 0;
  if (operator === '~') {
    return compared >= 0 && compareSemVer(candidate, { ...target, minor: target.minor + 1, patch: 0 }) < 0;
  }

  const upper =
    target.major > 0
      ? { major: target.major + 1, minor: 0, patch: 0 }
      : target.minor > 0
        ? { major: 0, minor: target.minor + 1, patch: 0 }
        : { major: 0, minor: 0, patch: target.patch + 1 };
  return compared >= 0 && compareSemVer(candidate, upper) < 0;
}

function compareSemVer(left: SemVer, right: SemVer) {
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}
