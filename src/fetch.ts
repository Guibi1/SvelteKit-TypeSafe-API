type EndpointUrls = keyof AllowedUrls;

type AllowedMethods<Info extends EndpointUrls> = keyof AllowedUrls[Info];

type AllowedBody<
    Info extends EndpointUrls,
    Method extends keyof AllowedUrls[Info]
> = AllowedUrls[Info][Method];

export function createApiFetch(f: typeof fetch) {
    return function <Info extends EndpointUrls, Method extends AllowedMethods<Info>>(
        input: Info,
        init: Omit<RequestInit, "body"> & {
            method: Method;
        },
        body: AllowedBody<Info, Method>
    ): Promise<Response> {
        return f(input, {
            ...init,
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                ...init.headers,
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    };
}

export const apiFetch = createApiFetch(fetch);
