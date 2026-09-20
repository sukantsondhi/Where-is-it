export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(body.message || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const isAzureMode = import.meta.env.VITE_DATA_MODE === "azure";
