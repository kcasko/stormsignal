// Shareable state lives in the hash: #whatif?loc=kalamazoo&src=live&act=driving&dur=1&at=29414000&name=...
// Nothing personal is included; custom places carry only rounded coordinates and a label.
export interface ShareState {
  page?: string;
  loc?: string;
  name?: string;
  src?: string;
  act?: string;
  dur?: number;
  /** custom start, in minutes since the Unix epoch */
  at?: number;
}

export function readHash(hash = location.hash): ShareState {
  const [page, query = ""] = hash.replace(/^#/, "").split("?");
  const p = new URLSearchParams(query);
  const num = (k: string) => {
    const v = Number(p.get(k));
    return p.has(k) && Number.isFinite(v) ? v : undefined;
  };
  return {
    page: page || undefined,
    loc: p.get("loc")?.slice(0, 40) || undefined,
    name: p.get("name")?.slice(0, 80) || undefined,
    src: p.get("src")?.slice(0, 20) || undefined,
    act: p.get("act")?.slice(0, 20) || undefined,
    dur: num("dur"),
    at: num("at"),
  };
}

export function shareUrl(s: ShareState) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(s)) if (k !== "page" && v !== undefined && v !== null && v !== "") p.set(k, String(v));
  return `${location.origin}${location.pathname}#${s.page ?? "overview"}?${p.toString()}`;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
