export const CANONICAL_NUMBER_VERSION = 'scientific-e13.v1';

export interface CanonicalJsonOptions {
  omitKeys?: Iterable<string>;
}

const encoder = new TextEncoder();

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function canonicalNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new TypeError(`Cannot canonicalize non-finite number: ${value}`);
  }

  if (Object.is(value, -0) || value === 0) {
    return '0';
  }

  return value.toExponential(12);
}

export function canonicalJson(value: unknown, options: CanonicalJsonOptions = {}): string {
  const omitKeys = options.omitKeys ? new Set(options.omitKeys) : new Set<string>();
  return canonicalize(value, omitKeys);
}

function canonicalize(value: unknown, omitKeys: ReadonlySet<string>): string {
  if (value === undefined) {
    throw new TypeError('Cannot canonicalize undefined values');
  }

  if (value === null) {
    return 'null';
  }

  switch (typeof value) {
    case 'number':
      return canonicalNumber(value);
    case 'string':
    case 'boolean':
      return JSON.stringify(value);
    case 'object':
      break;
    default:
      throw new TypeError(`Unsupported canonical JSON value type: ${typeof value}`);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item, omitKeys)).join(',')}]`;
  }

  if (!isPlainObject(value)) {
    throw new TypeError(
      `Unsupported canonical JSON object type: ${Object.prototype.toString.call(value)}`
    );
  }

  const entries = Object.keys(value)
    .sort()
    .filter((key) => !omitKeys.has(key))
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], omitKeys)}`);

  return `{${entries.join(',')}}`;
}

export function utf8(text: string): Uint8Array {
  return encoder.encode(text);
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digestInput =
    bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes : bytes.slice();
  const digest = await crypto.subtle.digest('SHA-256', digestInput);

  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

export function sha256Text(text: string): Promise<string> {
  return sha256Bytes(utf8(text));
}
