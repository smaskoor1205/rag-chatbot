import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import mammoth from "mammoth";
import pdf from "pdf-parse";
import { AppError } from "../utils/errors.js";

export async function parseDocument(filePath: string, mimeType: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  if (mimeType.includes("pdf") || ext === ".pdf") {
    const data = await pdf(await fs.readFile(filePath));
    return normalize(data.text);
  }
  if (mimeType.includes("word") || ext === ".docx") {
    const data = await mammoth.extractRawText({ path: filePath });
    return normalize(data.value);
  }
  const raw = await fs.readFile(filePath, "utf8");
  if (mimeType.includes("html") || ext === ".html" || ext === ".htm") {
    const $ = cheerio.load(raw);
    $("script,style,noscript").remove();
    return normalize($("body").text() || $.text());
  }
  if (mimeType.includes("text") || ext === ".txt" || ext === ".md") return normalize(raw);
  throw new AppError(400, "Unsupported document type", "UNSUPPORTED_DOCUMENT");
}

function normalize(input: string): string {
  return input.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
