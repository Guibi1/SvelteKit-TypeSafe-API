import { RequestEvent } from "@sveltejs/kit";
import { ZodEffects, z, type ZodObject, type ZodType, type ZodTypeAny } from "zod";
import { createApiObject } from "./fetch.js";

export async function apiValidate<T extends EndpointSchema>(
    data: Data,
    schema: T,
    f?: typeof fetch
) {
    const json = await parseData(data);
    const parse = z.object(schema).safeParse(json);

    if (!parse.success) {
        if (
            parse.error.issues.some((i) => i.path.length === 1 && i.path.at(0) === "searchParams")
        ) {
            console.error(
                "The following error might be caused because you you forgot to pass the event url to `apiValidate`."
            );
        }

        throw `Invalid data: ${parse.error.issues
            .map((i) => `at '${i.path.join(".")}': '${i.message}'`)
            .join(", ")}.`;
    }

    const requestFetch = f ?? ("fetch" in data ? data.fetch : fetch);
    return { data: parse.data, api: createApiObject(requestFetch) };
}

async function parseData(data: RequestEvent | Request | object) {
    let request: Request | undefined;
    let url: URL | undefined;

    if ("request" in data && data.request instanceof Request) {
        request = data.request;
    } else if (data instanceof Request) {
        request = data;
    }

    if ("url" in data && data.url instanceof URL) {
        url = data.url;
    } else if (data instanceof URL) {
        url = data;
    }

    if (!request && !url) {
        return data;
    } else {
        const searchParams = url ? Object.fromEntries(url.searchParams.entries()) : {};
        const body = request ? await handleRequest(request) : {};

        return { ...body, searchParams };
    }
}

async function handleRequest(request: Request) {
    const contentType = request.headers.get("Content-Type");
    if (contentType && contentType.includes("application/json")) {
        const json = await request
            .text()
            .then((text) => JSON.parse(text) as unknown)
            .catch(() => undefined);

        if (typeof json === "object") {
            return json;
        }
    }
}

type Data = RequestEvent | Request | URL | { request?: Request; url?: URL } | object;

type SearchParams = ZodObject<Record<string, ZodType<any, any, string>>>;

type NoUndefined<T> = {
    [K in keyof T]: Exclude<T[K], undefined>;
};

export type EndpointSchema = NoUndefined<{
    searchParams?: SearchParams | ZodEffects<SearchParams>;
    [k: string]: ZodTypeAny | undefined;
}>;
