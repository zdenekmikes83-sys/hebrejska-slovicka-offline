import { mkdir, writeFile } from "node:fs/promises";

const endpoint = "https://slovicka.musubikan.cz/api/lessons";
const response = await fetch(endpoint, { headers: { accept: "application/json" } });
if (!response.ok) throw new Error(`Slovník se nepodařilo načíst: HTTP ${response.status}`);
const payload = await response.json();
if (!Array.isArray(payload.lessons) || payload.lessons.length === 0) {
  throw new Error("Server nevrátil žádné lekce.");
}
await mkdir("www", { recursive: true });
await writeFile("www/lessons.json", JSON.stringify({ lessons: payload.lessons }, null, 2) + "\n", "utf8");
console.log(`Uloženo ${payload.lessons.length} lekcí.`);
