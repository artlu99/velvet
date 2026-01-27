import type { SqliteBoolean } from "@evolu/common";
import * as v from "valibot";
import type { EoaId } from "./schema";

// Type for EOA query result rows (matches Evolu's actual return type)
// Includes system columns that Evolu automatically adds: createdAt, updatedAt, ownerId, isDeleted
export type EoaRow = Readonly<{
	id: EoaId;
	address: string | null;
	origin: string | null;
	encryptedPrivateKey: string | null;
	keyType: string | null;
	derivationIndex: number | null;
	orderIndex: number | null;
	isSelected: SqliteBoolean;
	isDeleted: SqliteBoolean;
	// System columns added by Evolu
	createdAt: string;
	updatedAt: string | null;
	ownerId: string;
}>;

/**
 * Valibot schema for validating EoaRow data at runtime.
 * Handles Evolu's zero-migrations policy where fields can be null even if branded as NonNullable.
 */
const SqliteBooleanSchema = v.union([
	v.literal(0),
	v.literal(1),
	v.null_(),
]) as v.GenericSchema<SqliteBoolean>;

const EoaIdSchema = v.string() as unknown as v.GenericSchema<EoaId>;

/**
 * Schema for validating a single EoaRow from Evolu queries.
 * Validates all fields including system columns (createdAt, updatedAt, ownerId, isDeleted).
 */
export const EoaRowSchema = v.object({
	id: EoaIdSchema,
	address: v.nullable(v.string()),
	origin: v.nullable(v.string()),
	encryptedPrivateKey: v.nullable(v.string()),
	keyType: v.nullable(v.string()),
	derivationIndex: v.nullable(v.number()),
	orderIndex: v.nullable(v.number()),
	isSelected: SqliteBooleanSchema,
	isDeleted: SqliteBooleanSchema,
	// System columns added by Evolu
	createdAt: v.string(),
	updatedAt: v.nullable(v.string()),
	ownerId: v.string(),
}) as v.GenericSchema<EoaRow>;

/**
 * Schema for validating an array of EoaRow objects.
 */
export const EoaRowArraySchema = v.array(EoaRowSchema);

/**
 * Validates a single EoaRow and returns the validated row or null if invalid.
 * Logs warnings for validation failures to help debug data corruption.
 */
export function validateEoaRow(row: unknown): EoaRow | null {
	const result = v.safeParse(EoaRowSchema, row);
	if (!result.success) {
		console.warn("EoaRow validation failed:", {
			input: row,
			issues: result.issues,
		});
		return null;
	}
	return result.output;
}

/**
 * Validates an array of EoaRow objects and returns the validated rows.
 * Filters out invalid rows and logs warnings for each failure.
 */
export function validateEoaRowArray(rows: unknown): readonly EoaRow[] {
	if (!Array.isArray(rows)) {
		console.warn("EoaRow array validation failed: input is not an array", {
			input: rows,
		});
		return [];
	}

	const validated: EoaRow[] = [];
	for (const row of rows) {
		const validatedRow = validateEoaRow(row);
		if (validatedRow) {
			validated.push(validatedRow);
		}
	}

	if (validated.length !== rows.length) {
		console.warn(
			`EoaRow array validation: filtered out ${rows.length - validated.length} invalid rows`,
			{
				total: rows.length,
				valid: validated.length,
			},
		);
	}

	return validated as readonly EoaRow[];
}
