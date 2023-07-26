type Fetch = typeof fetch;

type AllowedMethod = keyof ProjectAPI;
type AllowedUrl<M extends AllowedMethod> = keyof ProjectAPI[M];

type Fields = "body" | "params";
type AllowedData<
    M extends AllowedMethod,
    U extends AllowedUrl<M>,
    Field extends string,
> = Field extends keyof ProjectAPI[M][U] ? ProjectAPI[M][U][Field] : never;

type Init<M extends AllowedMethod, U extends AllowedUrl<M>> = Omit<
    RequestInit,
    "body" | "method"
> & { [Field in Fields]?: AllowedData<M, U, Field> };

type PartialInit<M extends AllowedMethod, U extends AllowedUrl<M>> = Omit<Init<M, U>, Fields> &
    Pick<
        { [Field in Fields]: AllowedData<M, U, Field> },
        { [Field in Fields]: AllowedData<M, U, Field> extends never ? never : Field }[Fields]
    >;

const apiFetch = function <M extends AllowedMethod, U extends AllowedUrl<M>>(
    method: M,
    url: U,
    init: Init<M, U>,
    fetch: Fetch
): Promise<Response> {
    const params = init.params ? Object.entries(init.params) : [];
    const body = init.body ? JSON.stringify((init as RequestInit).body) : undefined;

    const input = params.reduce((url, [param, value]) => {
        return url.replace(RegExp(`\/\\[(\\.\\.\\.)?${param}\\](\/|$)`), `\/${value}\/`);
    }, url as string);

    const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(init ? init.headers : {}),
    };

    delete init.params;
    return fetch(input.replace(/\/$/, ""), {
        ...init,
        method,
        headers,
        body,
    });
};

export function createApiObject(fetch: Fetch) {
    function createRequest<M extends AllowedMethod>(method: M) {
        // MM is required to make sure that TypeScript doens't replace the AllowedUrl with never
        return <MM extends M, U extends AllowedUrl<MM>>(url: U, init: PartialInit<MM, U>) =>
            apiFetch(method, url, init, fetch);
    }

    return {
        GET: createRequest("GET"),
        POST: createRequest("POST"),
        PATCH: createRequest("PATCH"),
        PUT: createRequest("PUT"),
        DELETE: createRequest("DELETE"),
        OPTIONS: createRequest("OPTIONS"),
    };
}

export const api = createApiObject(fetch);
