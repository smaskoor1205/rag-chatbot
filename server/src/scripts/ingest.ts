import path from "node:path";
import fs from "node:fs";
import { migrate } from "../config/database.js";
import { env } from "../config/env.js";
import { AuthService } from "../services/authService.js";
import { IngestionService } from "../services/ingestionService.js";
import { UserRepository } from "../repositories/userRepository.js";

await migrate();
await new AuthService().bootstrapAdmin();

const fileArg = process.argv.includes("-f") ? process.argv[process.argv.indexOf("-f") + 1] : process.argv[2];
if (!fileArg) {
  throw new Error("Provide a file with: npm run ingest -w server -- -f ./docs/example.txt");
}

const admin = new UserRepository().findByEmail(env.ADMIN_EMAIL);
if (!admin) throw new Error("Admin user was not initialized");

let filePath = path.resolve(process.cwd(), fileArg);
if (!fs.existsSync(filePath) && !path.isAbsolute(fileArg)) filePath = path.resolve(process.cwd(), "..", fileArg);
const ext = path.extname(filePath).toLowerCase();
const mime = ext === ".pdf" ? "application/pdf" : ext === ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : ext.includes("htm") ? "text/html" : "text/plain";
const document = await new IngestionService().ingest({ ownerId: admin.id, name: path.basename(filePath), mimeType: mime, path: filePath });
console.log(JSON.stringify({ document }, null, 2));
