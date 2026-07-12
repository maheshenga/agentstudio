import { Injectable } from '@nestjs/common';

const MAX_LOG_LINES = 200;
const MAX_LOG_BYTES = 64 * 1024;
const REDACTED = '[REDACTED]';

@Injectable()
export class AppServiceLogRedactor {
  redact(value: string, registeredSecrets: string[] = []) {
    let output = String(value || '');
    for (const secret of [...new Set(registeredSecrets)].sort((a, b) => b.length - a.length)) {
      if (!secret) continue;
      output = output.split(secret).join(REDACTED);
    }

    output = output
      .replace(/\b(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, `$1${REDACTED}@`)
      .replace(/^\s*set-cookie\s*:[^\r\n]*$/gim, `Set-Cookie: ${REDACTED}`)
      .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
      .replace(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, REDACTED)
      .replace(
        /((?:"|')(?:password|passwd|pwd|token|access_token|refresh_token|secret|cookie|authorization|api_key|apikey)(?:"|')\s*:\s*)(?:"[^"\r\n]*"|'[^'\r\n]*')/gi,
        `$1"${REDACTED}"`,
      )
      .replace(
        /\b(password|passwd|pwd|token|access_token|refresh_token|secret|cookie|authorization|api_key|apikey)\s*[:=]\s*[^\s,;}]+/gi,
        (_match, key: string) => `${key}=${REDACTED}`,
      );

    return this.limit(output);
  }

  redactStreams(
    streams: { stdout?: string; stderr?: string },
    registeredSecrets: string[] = [],
  ) {
    return {
      stdout: this.redact(streams.stdout || '', registeredSecrets),
      stderr: this.redact(streams.stderr || '', registeredSecrets),
    };
  }

  private limit(value: string) {
    const lines = value.split(/\r?\n/).slice(-MAX_LOG_LINES);
    let limited = lines.join('\n');
    while (Buffer.byteLength(limited, 'utf8') > MAX_LOG_BYTES && limited.length > 0) {
      limited = limited.slice(Math.max(1, Math.floor(limited.length / 16)));
    }
    return limited;
  }
}
