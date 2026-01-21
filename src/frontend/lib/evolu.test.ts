import { describe, expect, test } from "bun:test";
import { formatTypeError } from "./evolu";

describe("formatTypeError", () => {
	test("should format MinLengthError correctly", () => {
		const error = {
			type: "MinLength" as const,
			min: 5,
			value: "",
			reason: "expected" as const,
		};
		const result = formatTypeError(error);
		expect(result).toBe("Text must be at least 5 characters long");
	});

	test("should format MaxLengthError correctly", () => {
		const error = {
			type: "MaxLength" as const,
			max: 100,
			value: "",
			reason: "expected" as const,
		};
		const result = formatTypeError(error);
		expect(result).toBe("Text is too long (maximum 100 characters)");
	});
});
