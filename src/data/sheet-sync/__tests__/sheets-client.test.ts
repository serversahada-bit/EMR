import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { extractSpreadsheetId, rangeTab } from "../sheets-client";

describe("extractSpreadsheetId", () => {
  /* Kenapa regex dan bukan split("/")[5]: posisi segmen /d/ berpindah
     antar bentuk URL, jadi indeks tetap akan mengambil potongan salah. */
  test("mengambil id dari berbagai bentuk URL", () => {
    const id = "1A2b3C-4d_5E6f7G8h9I";
    assert.equal(
      extractSpreadsheetId(`https://docs.google.com/spreadsheets/d/${id}/edit`),
      id,
    );
    assert.equal(
      extractSpreadsheetId(
        `https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`,
      ),
      id,
    );
    assert.equal(
      extractSpreadsheetId(
        `https://docs.google.com/spreadsheets/u/0/d/${id}/edit`,
      ),
      id,
    );
    assert.equal(extractSpreadsheetId(`https://x/d/${id}`), id);
  });

  test("URL tanpa segmen /d/ ditolak", () => {
    assert.equal(extractSpreadsheetId("https://docs.google.com/spreadsheets"), null);
    assert.equal(extractSpreadsheetId(""), null);
    assert.equal(extractSpreadsheetId("bukan url"), null);
  });
});

describe("rangeTab", () => {
  test("nama tab selalu dikutip", () => {
    assert.equal(rangeTab("Sheet1"), "'Sheet1'!A1:BK");
  });

  /* Tanpa kutip, nama bertanda spasi membuat API menolak range-nya. */
  test("nama bertanda spasi tetap sah", () => {
    assert.equal(rangeTab("Data September"), "'Data September'!A1:BK");
  });

  test("petik tunggal di nama digandakan", () => {
    assert.equal(rangeTab("Data'25"), "'Data''25'!A1:BK");
  });
});
