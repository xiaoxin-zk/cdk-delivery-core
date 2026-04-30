export class ApiClientError extends Error {
  constructor(
    message: string,
    public code = "REQUEST_FAILED",
    public status = 0
  ) {
    super(message);
  }
}

type ApiResponse<T> = {
  ok?: boolean;
  data?: T;
  message?: string;
  code?: string;
  error?: {
    message?: string;
    code?: string;
  };
};

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {})
    }
  });

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.ok) {
    throw new ApiClientError(
      payload?.message ?? payload?.error?.message ?? "请求失败，请稍后重试",
      payload?.code ?? payload?.error?.code ?? `HTTP_${response.status || "ERROR"}`,
      response.status
    );
  }
  return payload.data as T;
}
