import { describe, expect, it } from "vitest";
import { pageNumbers, paginate } from "./pagination";

describe("paginate", () => {
  it("découpe le total en pages et borne la page demandée", () => {
    expect(paginate(130, "2", 60)).toEqual({ page: 2, pageCount: 3, total: 130, start: 60, end: 120 });
    expect(paginate(130, "3", 60)).toMatchObject({ start: 120, end: 130 });
    expect(paginate(130, "99", 60).page).toBe(3);
    expect(paginate(130, "0", 60).page).toBe(1);
    expect(paginate(130, "-4", 60).page).toBe(1);
  });

  it("revient à la première page pour une valeur absente ou invalide", () => {
    expect(paginate(130, undefined, 60).page).toBe(1);
    expect(paginate(130, "abc", 60).page).toBe(1);
    expect(paginate(130, "2.7", 60).page).toBe(2);
  });

  it("garde une page (vide) quand il n'y a rien", () => {
    expect(paginate(0, "5", 60)).toEqual({ page: 1, pageCount: 1, total: 0, start: 0, end: 0 });
  });
});

describe("pageNumbers", () => {
  it("montre tout quand il y a peu de pages", () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it("remplace les trous par une ellipse, sauf s'il ne manque qu'une page", () => {
    expect(pageNumbers(1, 10)).toEqual([1, 2, null, 10]);
    expect(pageNumbers(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageNumbers(3, 10)).toEqual([1, 2, 3, 4, null, 10]);
    expect(pageNumbers(10, 10)).toEqual([1, null, 9, 10]);
  });
});
