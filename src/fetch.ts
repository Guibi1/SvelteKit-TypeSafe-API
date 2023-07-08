type AllowedMethod = keyof ProjectAPI;
type AllowedUrl<M extends AllowedMethod> = keyof ProjectAPI[M];
type AllowedBody<M extends AllowedMethod, U extends AllowedUrl<M>> = ProjectAPI[M][U];

type Init = Omit<RequestInit, "body" | "method">;

export function createApiObject(f: typeof fetch) {
    const apiFetch = function <M extends AllowedMethod, U extends AllowedUrl<M>>(
        method: M,
        input: U,
        body: AllowedBody<M, U>,
        init?: Init
    ): Promise<Response> {
        return f(input as string, {
            ...init,
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                ...(init ? init.headers : {}),
                method,
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    };

    function createRequest<M extends AllowedMethod>(method: M) {
        return <MM extends M, U extends AllowedUrl<MM>>(
            url: U,
            json: AllowedBody<MM, U>,
            headers?: Init
        ) => apiFetch(method, url as AllowedUrl<M>, json as AllowedBody<M, AllowedUrl<M>>, headers);
    }

    return {
        GET: (url: AllowedUrl<"GET">, headers?: Init) =>
            apiFetch("GET", url, undefined as never, headers),
        POST: createRequest("POST"),
        PATCH: createRequest("PATCH"),
        PUT: createRequest("PUT"),
        DELETE: createRequest("DELETE"),
        OPTIONS: createRequest("OPTIONS"),
    };
}

export const api = createApiObject(fetch);
