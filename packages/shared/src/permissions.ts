/**
 * BigInt-based permission bitfield.
 *
 * A single user-facing permission model where each capability occupies one bit
 * inside a `bigint`. The structure follows the classic `BitField` pattern: a
 * generic base class operating on flag-name -> bit maps, with boolean checks
 * (`has`, `any`) and mutation helpers (`add`, `remove`) performed in O(1).
 *
 * @remarks
 * Bitfields are serialized as decimal strings (e.g. `"7"`) for API/Database
 * transport because `bigint` cannot be JSON-serialized and a plain `number`
 * loses precision beyond `2^53`. Construct with a string to restore it.
 */

/** Every permission flag this platform knows about. */
export const PermissionFlags = {
  /** May read (list) registered OIDC clients. */
  OidcClientRead: 1n << 0n,
  /** May register (issue) new OIDC clients. */
  OidcClientCreate: 1n << 1n,
  /** May delete (revoke) registered OIDC clients. */
  OidcClientDelete: 1n << 2n,
} as const;

/** A permission flag name, e.g. `"OidcClientRead"`. */
export type PermissionString = keyof typeof PermissionFlags;

/** A permission resolvable to its bit representation. */
export type PermissionResolvable =
  | bigint
  | PermissionString
  | string
  | { bits: bigint }
  | readonly PermissionResolvable[]
  | BitField<PermissionString, bigint>;

/** Anything that can be resolved to a bitfield value. */
export type BitFieldResolvable<Flags extends string, Type extends bigint> =
  | Type
  | Flags
  | string
  | { bits: bigint }
  | readonly BitFieldResolvable<Flags, Type>[]
  | BitField<Flags, Type>;

/**
 * Generic bitfield over a static `Flags` map. Heavily inspired by the widely
 * used `BitField` class design.
 */
export class BitField<Flags extends string, Type extends bigint> {
  /** The flag map used to resolve flag name strings. Overridden by subclasses. */
  public static readonly Flags: Record<string, bigint> = {};

  /** The raw bit value held by this instance. */
  public bits: Type;

  /**
   * Creates a bitfield populated with `bits`.
   *
   * @param bits - Initial bits, resolved via {@link BitField.resolve}.
   */
  public constructor(bits?: BitFieldResolvable<Flags, Type>) {
    this.bits = BitField.resolve(
      bits ?? 0n,
      (this.constructor as typeof BitField).Flags,
    ) as Type;
  }

  /**
   * Resolves a {@link BitFieldResolvable} into its bit representation.
   * Accepts bigints, decimal strings, flag names and nested arrays.
   *
   * @param bit - The value to resolve; defaults to `0n`.
   * @param flags - The flag map consulted for flag names.
   */
  public static resolve<Type extends bigint>(
    bit?: BitFieldResolvable<string, Type> | null,
    flags: Record<string, bigint> = {},
  ): bigint {
    if (typeof bit === "bigint") {
      return bit;
    }
    if (bit instanceof BitField) {
      return toBigInt(bit.bits);
    }
    if (Array.isArray(bit)) {
      return bit.reduce<bigint>(
        (prev, entry) =>
          prev | BitField.resolve.call(null, entry as BitFieldResolvable<string, Type>, flags),
        0n,
      );
    }
    if (typeof bit === "string") {
      const flag = flags[bit];
      if (typeof flag !== "undefined") {
        return flag;
      }
      if (/^\d+$/.test(bit)) {
        return BigInt(bit);
      }
    }
    if (
      typeof bit === "object" &&
      bit !== null &&
      !(bit instanceof BitField) &&
      "bits" in bit
    ) {
      const { bits } = bit as { bits: bigint };
      if (typeof bits === "bigint") {
        return bits;
      }
    }
    throw new TypeError(`Invalid bitfield value: ${String(bit)}`);
  }

  /** Returns `true` when this instance contains every supplied bit. */
  public has(first: BitFieldResolvable<Flags, Type>): boolean {
    const resolved = BitField.resolve(
      first,
      (this.constructor as typeof BitField).Flags,
    );
    return (toBigInt(this.bits) & toBigInt(resolved)) === toBigInt(resolved);
  }

  /** Returns `true` when this instance contains any of the supplied bits. */
  public any(first: BitFieldResolvable<Flags, Type>): boolean {
    const resolved = BitField.resolve(
      first,
      (this.constructor as typeof BitField).Flags,
    );
    return (toBigInt(this.bits) & toBigInt(resolved)) !== 0n;
  }

  /**
   * Returns the flag names supplied that are missing from this instance.
   */
  public missing(bits: readonly Flags[] | BitFieldResolvable<Flags, Type>): Flags[] {
    const resolved = new (this.constructor as new (
      value?: BitFieldResolvable<Flags, Type>,
    ) => BitField<Flags, Type>)(bits).remove(this.bits);
    return resolved.toArray();
  }

  /** Adds the supplied bits to this instance. */
  public add(...bits: Array<BitFieldResolvable<Flags, Type>>): this {
    let total = toBigInt(this.bits);
    for (const bit of bits) {
      total |= toBigInt(
        BitField.resolve(bit, (this.constructor as typeof BitField).Flags),
      );
    }
    this.bits = total as Type;
    return this;
  }

  /** Removes the supplied bits from this instance. */
  public remove(...bits: Array<BitFieldResolvable<Flags, Type>>): this {
    let total = toBigInt(this.bits);
    for (const bit of bits) {
      total &= ~toBigInt(
        BitField.resolve(bit, (this.constructor as typeof BitField).Flags),
      );
    }
    this.bits = total as Type;
    return this;
  }

  /** Returns `true` when this instance equals `bit` exactly. */
  public equals(bit: BitFieldResolvable<Flags, Type>): boolean {
    return (
      toBigInt(this.bits) ===
      toBigInt(BitField.resolve(bit, (this.constructor as typeof BitField).Flags))
    );
  }

  /** Freezes this instance, making it immutable. */
  public freeze(): Readonly<this> {
    return Object.freeze(this);
  }

  /** Returns an object mapping each flag name to whether it is set. */
  public serialize(): Record<Flags, boolean> {
    const serialized = {} as Record<Flags, boolean>;
    const flags = (this.constructor as typeof BitField).Flags;
    for (const flag of Object.keys(flags) as Flags[]) {
      serialized[flag] = this.has(flag);
    }
    return serialized;
  }

  /** Returns the names of the flags currently set on this instance. */
  public toArray(): Flags[] {
    return (
      Object.keys((this.constructor as typeof BitField).Flags) as Flags[]
    ).filter((flagKey) => this.has(flagKey));
  }

  /** Returns the bit value as a decimal string (JSON-safe). */
  public toJSON(): string {
    return toBigInt(this.bits).toString();
  }

  /** Returns the raw bit value. */
  public valueOf(): bigint {
    return toBigInt(this.bits);
  }

  /** Yields the names of the set flags. */
  public *[Symbol.iterator](): IterableIterator<Flags> {
    yield* this.toArray();
  }
}

/**
 * Bitfield over the platform's {@link PermissionFlags}.
 */
export class PermissionBitField extends BitField<PermissionString, bigint> {
  /** The platform permission flags. */
  public static override readonly Flags: Record<PermissionString, bigint> =
    PermissionFlags;

  /** Every permission combined. */
  public static readonly All: bigint = (
    Object.values(PermissionFlags) as readonly bigint[]
  ).reduce<bigint>((prev, flag) => prev | flag, 0n);

  public constructor(bits?: BitFieldResolvable<PermissionString, bigint>) {
    super(bits);
  }
}

/** Whether a user with `permissions` holds `required` permissions. */
export function hasPermissions(
  permissions: string | bigint | undefined,
  required: PermissionResolvable,
): boolean {
  return new PermissionBitField(permissions).has(required);
}

function toBigInt(value: bigint): bigint {
  return typeof value === "bigint" ? value : BigInt(value);
}