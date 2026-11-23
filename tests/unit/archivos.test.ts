import { describe, expect, it } from "vitest";
import { LIMITE_BYTES, validarArchivo } from "@/core/archivos";

const b = (...x: number[]) => new Uint8Array([...x, ...Array(16).fill(0)]);
const PDF = b(0x25, 0x50, 0x44, 0x46, 0x2d);
const ZIP = b(0x50, 0x4b, 0x03, 0x04);
const OLE = b(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
const PNG = b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const MB = 1024 * 1024;
const todos = ["pdf", "word", "excel", "zip"] as const;

describe("Validación de archivos (tipo y tamaño)", () => {
  it("51 MB → rechazado; 50 MB exactos → aceptado", () => {
    expect(validarArchivo("tesis.pdf", 51 * MB, PDF, ["pdf"])).toEqual({ ok: false, error: "El archivo supera el límite de 50 MB." });
    expect(validarArchivo("datos.zip", 51 * MB, ZIP, ["zip"]).ok).toBe(false);
    expect(validarArchivo("tesis.pdf", LIMITE_BYTES, PDF, ["pdf"]).ok).toBe(true);
  });

  it("acepta PDF, Word (.doc/.docx), Excel (.xls/.xlsx) y ZIP por extensión y magic bytes", () => {
    expect(validarArchivo("a.pdf", 10, PDF, [...todos])).toMatchObject({ ok: true, tipo: "pdf" });
    expect(validarArchivo("a.docx", 10, ZIP, [...todos])).toMatchObject({ ok: true, tipo: "word" });
    expect(validarArchivo("a.DOC", 10, OLE, [...todos])).toMatchObject({ ok: true, tipo: "word" });
    expect(validarArchivo("a.xlsx", 10, ZIP, [...todos])).toMatchObject({ ok: true, tipo: "excel" });
    expect(validarArchivo("a.xls", 10, OLE, [...todos])).toMatchObject({ ok: true, tipo: "excel" });
    expect(validarArchivo("a.zip", 10, ZIP, [...todos])).toMatchObject({ ok: true, tipo: "zip" });
  });

  it("rechaza una extensión permitida con contenido falso (magic bytes)", () => {
    expect(validarArchivo("virus.pdf", 10, b(0x4d, 0x5a), ["pdf"])).toEqual({ ok: false, error: "El contenido del archivo no corresponde a su extensión." });
    expect(validarArchivo("foto.png", 10, PDF, ["imagen"]).ok).toBe(false);
  });

  it("rechaza extensiones no permitidas", () => {
    expect(validarArchivo("script.exe", 10, b(0x4d, 0x5a), [...todos]).ok).toBe(false);
    expect(validarArchivo("foto.png", 10, PNG, ["pdf"]).ok).toBe(false);
    expect(validarArchivo("sin-extension", 10, PDF, ["pdf"]).ok).toBe(false);
  });

  it("rechaza archivos vacíos", () => {
    expect(validarArchivo("a.pdf", 0, PDF, ["pdf"]).ok).toBe(false);
  });
});
