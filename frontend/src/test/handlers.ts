import { http, HttpResponse } from "msw";

export const apiOrigin = "http://localhost:5173";
export const apiBaseUrl = `${apiOrigin}/api`;

export const mockCurrentUser = {
  id: "user-1",
  email: "user@example.com",
  username: "user1",
  is_staff: false,
};

export const mockSubmission = {
  id: "submission-1",
  name: "Profile",
  age: 32,
  place_of_living: "Berlin",
  gender: "User-submitted",
  country_of_origin: "Germany",
  description: "",
  photo: {
    content_type: "image/jpeg",
    size_bytes: 1024,
  },
  status: "pending_classification",
  classification: null,
  created_at: "2026-05-18T10:00:00Z",
  updated_at: "2026-05-18T10:00:00Z",
};

export const handlers = [
  http.post(`${apiBaseUrl}/auth/register/`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;

    return HttpResponse.json(
      {
        id: "user-1",
        email: body.email,
        username: body.username,
        is_staff: false,
        created_at: "2026-05-18T10:00:00Z",
      },
      { status: 201 },
    );
  }),
  http.post(`${apiBaseUrl}/auth/login/`, () =>
    HttpResponse.json({
      access: "access-token",
      refresh: "refresh-token",
      user: mockCurrentUser,
    }),
  ),
  http.get(`${apiBaseUrl}/auth/me/`, () => HttpResponse.json(mockCurrentUser)),
  http.get(`${apiBaseUrl}/submissions/`, () =>
    HttpResponse.json({
      count: 1,
      next: null,
      previous: null,
      results: [mockSubmission],
    }),
  ),
  http.get(`${apiBaseUrl}/submissions/:id/`, () => HttpResponse.json(mockSubmission)),
];
