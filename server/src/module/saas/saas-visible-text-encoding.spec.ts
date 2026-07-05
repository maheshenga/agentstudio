import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { extname, join, relative } from 'path';
import * as iconv from 'iconv-lite';

interface SourceFile {
  relativePath: string;
  source: string;
}

interface VisibleTextEncodingFinding {
  relativePath: string;
  line: number;
  column: number;
  fragment: string;
  excerpt: string;
}

interface SourceTarget {
  relativePath: string;
  extensions: string[];
  include?: (relativePath: string) => boolean;
  exclude?: (relativePath: string) => boolean;
}

const REPO_ROOT = join(__dirname, '../../../..');
const SAAS_VISIBLE_TEXT_TARGETS: SourceTarget[] = [
  {
    relativePath: 'server/src/module/saas',
    extensions: ['.ts'],
    exclude: (relativePath) => relativePath.endsWith('.spec.ts'),
  },
  {
    relativePath: 'server/src/migrations',
    extensions: ['.ts'],
  },
  {
    relativePath: 'web/src/api/saas.ts',
    extensions: ['.ts'],
  },
  {
    relativePath: 'web/src/views/saas',
    extensions: ['.vue', '.ts'],
  },
];
const MOJIBAKE_FIXTURE = '璧勬簮棰濆害涓嶈冻';
const READABLE_CHINESE_FIXTURE = '资源额度不足';
const KNOWN_MOJIBAKE_FRAGMENTS = [
  MOJIBAKE_FIXTURE,
  'AI 璋冪敤娆℃暟棰濆害涓嶈冻',
  'Token 棰濆害涓嶈冻',
  '缂哄皯绉熸埛涓婁笅鏂',
  '鐧诲綍璐﹀彿',
  '鎵撳寘瀹屾垚',
];

const MOJIBAKE_SIGNAL_PATTERNS = [
  /璧勬簮|棰濆害|涓嶈冻|缂哄皯|绉熸埛|涓婁笅鏂|璋冪敤|娆℃暟|鐧诲綍|璐﹀彿/g,
  /鐮佸凡|瀛樺湪|璇锋崲|鍚庨噸璇|鎵撳寘|瀹屾垚|繍琛/g,
];

function collectActiveSaasSourceFiles(): SourceFile[] {
  return SAAS_VISIBLE_TEXT_TARGETS.flatMap((target) => collectSourceFiles(join(REPO_ROOT, target.relativePath), target)).sort(
    (left, right) => left.relativePath.localeCompare(right.relativePath),
  );
}

function collectSourceFiles(fullPath: string, target: SourceTarget): SourceFile[] {
  if (!existsSync(fullPath)) {
    return [];
  }

  const stats = statSync(fullPath);
  if (stats.isDirectory()) {
    return readdirSync(fullPath, { withFileTypes: true }).flatMap((entry) => collectSourceFiles(join(fullPath, entry.name), target));
  }

  if (!stats.isFile()) {
    return [];
  }

  const relativePath = relative(REPO_ROOT, fullPath).replace(/\\/g, '/');
  if (!shouldScanSourceFile(relativePath, target)) {
    return [];
  }

  return [
    {
      relativePath,
      source: readFileSync(fullPath, 'utf8'),
    },
  ];
}

function shouldScanSourceFile(relativePath: string, target: SourceTarget): boolean {
  if (!target.extensions.includes(extname(relativePath))) {
    return false;
  }

  if (target.exclude?.(relativePath)) {
    return false;
  }

  return target.include ? target.include(relativePath) : true;
}

function findVisibleTextEncodingFindings(sourceFiles: SourceFile[]): VisibleTextEncodingFinding[] {
  return sourceFiles.flatMap((sourceFile) => findMojibakeFindingsInSource(sourceFile));
}

function findMojibakeFindingsInSource(sourceFile: SourceFile): VisibleTextEncodingFinding[] {
  const findings: VisibleTextEncodingFinding[] = [];
  const lines = sourceFile.source.split(/\r?\n/);

  lines.forEach((line, lineIndex) => {
    const occupiedRanges: Array<[number, number]> = [];

    for (const fragment of KNOWN_MOJIBAKE_FRAGMENTS) {
      for (const startIndex of findAllIndexes(line, fragment)) {
        occupiedRanges.push([startIndex, startIndex + fragment.length]);
        findings.push(createFinding(sourceFile, line, lineIndex, startIndex, fragment));
      }
    }

    for (const pattern of MOJIBAKE_SIGNAL_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line))) {
        const startIndex = match.index;
        const endIndex = startIndex + match[0].length;
        if (!occupiedRanges.some(([start, end]) => startIndex < end && endIndex > start)) {
          findings.push(createFinding(sourceFile, line, lineIndex, startIndex, match[0]));
        }
      }
    }

    for (const candidate of findRepairableMojibakeCandidates(line)) {
      const endIndex = candidate.startIndex + candidate.fragment.length;
      if (!occupiedRanges.some(([start, end]) => candidate.startIndex < end && endIndex > start)) {
        occupiedRanges.push([candidate.startIndex, endIndex]);
        findings.push(createFinding(sourceFile, line, lineIndex, candidate.startIndex, candidate.fragment));
      }
    }
  });

  return findings;
}

function findRepairableMojibakeCandidates(line: string): Array<{ startIndex: number; fragment: string }> {
  const candidates = collectQuotedTextCandidates(line);
  const cjkRunPattern = /[\u3400-\u9fff\uff00-\uffef]{2,}/g;
  let match: RegExpExecArray | null;

  while ((match = cjkRunPattern.exec(line))) {
    candidates.push({ startIndex: match.index, fragment: match[0] });
  }

  return candidates.filter(({ fragment }) => isRepairableUtf8AsGbkMojibake(fragment));
}

function collectQuotedTextCandidates(line: string): Array<{ startIndex: number; fragment: string }> {
  const candidates: Array<{ startIndex: number; fragment: string }> = [];
  const quotedTextPattern = /(['"`])((?:\\.|(?!\1).)*[\u3400-\u9fff\uff00-\uffef](?:\\.|(?!\1).)*)\1/g;
  let match: RegExpExecArray | null;

  while ((match = quotedTextPattern.exec(line))) {
    candidates.push({ startIndex: match.index + 1, fragment: match[2] });
  }

  return candidates;
}

function isRepairableUtf8AsGbkMojibake(fragment: string): boolean {
  const repaired = iconv.decode(iconv.encode(fragment, 'gbk'), 'utf8');
  return repaired !== fragment && !repaired.includes('�') && /[\u4e00-\u9fff].*[\u4e00-\u9fff]/.test(repaired);
}

function findAllIndexes(line: string, fragment: string): number[] {
  const indexes: number[] = [];
  let startIndex = 0;

  while (startIndex < line.length) {
    const index = line.indexOf(fragment, startIndex);
    if (index === -1) {
      break;
    }
    indexes.push(index);
    startIndex = index + fragment.length;
  }

  return indexes;
}

function createFinding(
  sourceFile: SourceFile,
  line: string,
  lineIndex: number,
  startIndex: number,
  fragment: string,
): VisibleTextEncodingFinding {
  return {
    relativePath: sourceFile.relativePath,
    line: lineIndex + 1,
    column: startIndex + 1,
    fragment,
    excerpt: line.trim(),
  };
}

function formatFindings(findings: VisibleTextEncodingFinding[]): string {
  return findings
    .map((finding) => `${finding.relativePath}:${finding.line}:${finding.column} ${finding.fragment} -> ${finding.excerpt}`)
    .join('\n');
}

describe('SaaS visible text encoding audit', () => {
  it('detects known UTF-8-as-GBK mojibake in visible text fixtures', () => {
    const findings = findVisibleTextEncodingFindings([
      {
        relativePath: 'services/example.service.ts',
        source: `throw new BadRequestException('${MOJIBAKE_FIXTURE}');`,
      },
    ]);

    expect(findings).toContainEqual(
      expect.objectContaining({
        relativePath: 'services/example.service.ts',
        line: 1,
        column: 32,
        fragment: MOJIBAKE_FIXTURE,
      }),
    );
  });

  it('detects repairable UTF-8-as-GBK mojibake even when the exact fragment is not allowlisted', () => {
    const findings = findVisibleTextEncodingFindings([
      {
        relativePath: 'migrations/example.ts',
        source: "const menu = { name: 'SaaS绠＄悊' };",
      },
    ]);

    expect(findings).toContainEqual(
      expect.objectContaining({
        relativePath: 'migrations/example.ts',
        line: 1,
        fragment: 'SaaS绠＄悊',
      }),
    );
  });

  it('does not flag readable Chinese visible text fixtures', () => {
    const findings = findVisibleTextEncodingFindings([
      {
        relativePath: 'services/example.service.ts',
        source: `throw new BadRequestException('${READABLE_CHINESE_FIXTURE}');`,
      },
    ]);

    expect(findings).toEqual([]);
  });

  it('scans active SaaS UI, API, backend, and migration sources', () => {
    const sourcePaths = collectActiveSaasSourceFiles().map(({ relativePath }) => relativePath);

    expect(sourcePaths).toEqual(
      expect.arrayContaining([
        'server/src/module/saas/saas-tenant.controller.ts',
        'server/src/migrations/1760000000001-SeedSaasFoundationData.ts',
        'server/src/migrations/1760000000017-SeedSaasModules.ts',
        'server/src/migrations/1760000000021-SeedSystemModules.ts',
        'web/src/api/saas.ts',
      ]),
    );
    expect(sourcePaths.some((path) => path.startsWith('web/src/views/saas/') && path.endsWith('.vue'))).toBe(true);
    expect(sourcePaths).not.toContain('server/src/module/saas/saas-visible-text-encoding.spec.ts');
  });

  it('keeps active SaaS source visible text free of mojibake', () => {
    const sourceFiles = collectActiveSaasSourceFiles();
    const findings = findVisibleTextEncodingFindings(sourceFiles);

    expect(formatFindings(findings)).toBe('');
    expect(findings).toEqual([]);
    expect(sourceFiles.length).toBeGreaterThan(0);
  });
});
