import { redirect } from "next/navigation";

/**
 * Map 2 used to live here as a standalone page driven by data/map2_qa.json.
 * It is now a first-class map in the `maps` table, rendered by the shared
 * explorer at "/", which keeps one source of truth for geometry and for the
 * Plot Area Statement metadata. This redirect preserves the public URL.
 */
export default function ExtractionRedirect() {
  redirect("/?map=map-2");
}
