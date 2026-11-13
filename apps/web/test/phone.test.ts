import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPhone, formatPhone, phoneDigits, phoneDigitsAt } from "../src/lib/phone.ts";

test("phoneDigits reads the ways people write an Indian mobile number", () => {
  for (const written of [
    "9845012345",
    "98450 12345",
    "98450-12345",
    "+91 98450 12345",
    "+919845012345",
    "919845012345",
    "09845012345",
    "0091 98450 12345",
    " +91-98450-12345 ",
  ]) {
    assert.equal(phoneDigits(written), "9845012345", written);
  }
});

test("phoneDigits never cuts a number that starts with 91 while it is being typed", () => {
  assert.equal(phoneDigits("91"), "91");
  assert.equal(phoneDigits("91234"), "91234");
  assert.equal(phoneDigits("9123456789"), "9123456789");
  // Eleven digits is a slip, not a country code: keep them all so the message can say so.
  assert.equal(phoneDigits("91234567890"), "91234567890");
  // With a plus the 91 is the country code however much has been typed.
  assert.equal(phoneDigits("+91 98"), "98");
});

test("phoneDigits keeps an extra digit rather than dropping it", () => {
  assert.equal(phoneDigits("98450123456"), "98450123456");
  assert.equal(phoneDigits("1234567890123456"), "123456789012");
});

test("formatPhone groups five and five", () => {
  assert.equal(formatPhone(""), "");
  assert.equal(formatPhone("98450"), "98450");
  assert.equal(formatPhone("984501"), "98450 1");
  assert.equal(formatPhone("9845012345"), "98450 12345");
});

test("checkPhone says what is wrong and how to fix it", () => {
  assert.deepEqual(checkPhone("9845012345"), { ok: true, phone: "9845012345" });

  const empty = checkPhone("");
  assert.equal(empty.ok, false);
  assert.equal(!empty.ok && empty.problem, "empty");

  const short = checkPhone("984501234");
  assert.equal(!short.ok && short.problem, "short");
  assert.equal(!short.ok && short.message, "Enter all 10 digits. This number has 9.");

  const long = checkPhone("98450123456");
  assert.equal(!long.ok && long.problem, "long");
  assert.equal(!long.ok && long.message, "That is 11 digits. A mobile number has 10.");

  const start = checkPhone("5845012345");
  assert.equal(!start.ok && start.problem, "start");
});

test("phoneDigitsAt keeps the caret among the same digits after a prefix is removed", () => {
  // Typing "7" after "984" in "98450 12345" (the field reads "9847450 12345", caret after the 7).
  assert.deepEqual(phoneDigitsAt("98474501 2345", 4), { digits: "984745012345", caret: 4 });
  // A pasted "+91 98450 12345" with the caret at the end.
  assert.deepEqual(phoneDigitsAt("+91 98450 12345", 15), { digits: "9845012345", caret: 10 });
  // A caret inside the removed prefix lands at the start.
  assert.deepEqual(phoneDigitsAt("0 98450 12345", 1), { digits: "9845012345", caret: 0 });
  // Spaces do not count.
  assert.deepEqual(phoneDigitsAt("98450 12345", 6), { digits: "9845012345", caret: 5 });
});
