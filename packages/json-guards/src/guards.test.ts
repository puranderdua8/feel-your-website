import { describe, expect, it } from "vitest";

import {
  arrayOf,
  field,
  isBoolean,
  isNumber,
  isObject,
  isString,
  objectOf,
  parse,
} from "./guards.js";

describe("scalar guards", () => {
  it("isString", () => {
    expect(isString("")).toBe(true);
    expect(isString("x")).toBe(true);
    expect(isString(1)).toBe(false);
    expect(isString(null)).toBe(false);
    expect(isString(undefined)).toBe(false);
    expect(isString(["x"])).toBe(false);
  });

  it("isNumber accepts only finite numbers", () => {
    expect(isNumber(0)).toBe(true);
    expect(isNumber(-3.5)).toBe(true);
    expect(isNumber(NaN)).toBe(false);
    expect(isNumber(Infinity)).toBe(false);
    expect(isNumber(-Infinity)).toBe(false);
    expect(isNumber("1")).toBe(false);
    expect(isNumber(null)).toBe(false);
  });

  it("isBoolean", () => {
    expect(isBoolean(true)).toBe(true);
    expect(isBoolean(false)).toBe(true);
    expect(isBoolean(0)).toBe(false);
    expect(isBoolean("true")).toBe(false);
  });

  it("isObject rejects null and arrays", () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ a: 1 })).toBe(true);
    expect(isObject(null)).toBe(false);
    expect(isObject([])).toBe(false);
    expect(isObject("x")).toBe(false);
    expect(isObject(1)).toBe(false);
  });
});

describe("arrayOf", () => {
  it("passes an empty array and a homogeneous array", () => {
    expect(arrayOf(isString)([])).toBe(true);
    expect(arrayOf(isString)(["a", "b"])).toBe(true);
  });

  it("fails a non-array or a mixed array", () => {
    expect(arrayOf(isString)("a")).toBe(false);
    expect(arrayOf(isString)(["a", 1])).toBe(false);
    expect(arrayOf(isNumber)([1, NaN])).toBe(false);
  });

  it("nests", () => {
    const guard = arrayOf(arrayOf(isNumber));
    expect(guard([[1], [2, 3], []])).toBe(true);
    expect(guard([[1], ["2"]])).toBe(false);
  });
});

describe("objectOf", () => {
  it("passes an empty object and a homogeneous record", () => {
    expect(objectOf(isNumber)({})).toBe(true);
    expect(objectOf(isNumber)({ a: 1, b: 2 })).toBe(true);
  });

  it("fails a non-object, an array, or a mixed record", () => {
    expect(objectOf(isNumber)([])).toBe(false);
    expect(objectOf(isNumber)(null)).toBe(false);
    expect(objectOf(isNumber)({ a: 1, b: "2" })).toBe(false);
  });
});

describe("field", () => {
  it("returns the narrowed value when present and valid", () => {
    expect(field({ title: "hi" }, "title", isString)).toBe("hi");
    expect(field({ n: 0 }, "n", isNumber)).toBe(0);
  });

  it("returns null for a non-object, a missing key, or a wrong type", () => {
    expect(field(null, "title", isString)).toBeNull();
    expect(field("nope", "title", isString)).toBeNull();
    expect(field([], "0", isString)).toBeNull();
    expect(field({}, "title", isString)).toBeNull();
    expect(field({ title: 1 }, "title", isString)).toBeNull();
  });

  it("composes for a struct guard", () => {
    type Release = { title: string; url: string };
    const isRelease = (v: unknown): v is Release =>
      field(v, "title", isString) !== null && field(v, "url", isString) !== null;

    expect(isRelease({ title: "a", url: "https://x" })).toBe(true);
    expect(isRelease({ title: "a" })).toBe(false);
    expect(arrayOf(isRelease)([{ title: "a", url: "u" }])).toBe(true);
  });
});

describe("parse", () => {
  it("returns the value on a match and null otherwise", () => {
    expect(parse("x", isString)).toBe("x");
    expect(parse(1, isString)).toBeNull();
    expect(parse(["a"], arrayOf(isString))).toEqual(["a"]);
    expect(parse(["a", 1], arrayOf(isString))).toBeNull();
  });
});
