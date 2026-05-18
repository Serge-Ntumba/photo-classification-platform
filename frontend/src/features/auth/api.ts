import type { createApiClient } from "@/lib/api-client";
import type { AuthenticatedUser, RawLoginResponse, RawUserSummary } from "@/lib/models";
import { toAuthenticatedUser } from "@/lib/models";

type ApiClient = ReturnType<typeof createApiClient>;

export type RegisterAccountInput = {
  email: string;
  username: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisteredAccount = AuthenticatedUser & {
  createdAt: string | null;
};

export type LoginResult = {
  accessToken: string;
  user: AuthenticatedUser;
};

type RawRegistrationResponse = RawUserSummary & {
  created_at?: unknown;
};

export async function registerAccount(
  apiClient: ApiClient,
  input: RegisterAccountInput,
): Promise<RegisteredAccount> {
  const raw = await apiClient.post<RawRegistrationResponse>("/auth/register/", {
    email: input.email,
    username: input.username,
    password: input.password,
  });
  const user = toAuthenticatedUser(raw);

  return {
    ...user,
    createdAt: typeof raw.created_at === "string" ? raw.created_at : null,
  };
}

export async function login(
  apiClient: ApiClient,
  input: LoginInput,
): Promise<LoginResult> {
  const raw = await apiClient.post<RawLoginResponse>("/auth/login/", {
    email: input.email,
    password: input.password,
  });

  if (!raw.access || !raw.user) {
    throw new Error("Login response was incomplete.");
  }

  return {
    accessToken: raw.access,
    user: toAuthenticatedUser(raw.user),
  };
}

export async function getCurrentUser(apiClient: ApiClient) {
  return toAuthenticatedUser(await apiClient.get<RawUserSummary>("/auth/me/"));
}
