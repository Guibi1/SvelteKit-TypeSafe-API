import { RequestEvent, error } from "@sveltejs/kit";
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
        throw error(400, "Invalid data: " + parse.error.message);
    }

    return { data: parse.data, api: createApiObject(f ?? fetch) };
}

async function parseData(data: RequestEvent | Request | object) {
    let request = null;
    let searchParams = null;

    if ("request" in data && data.request instanceof Request) {
        request = await data.request.json();
    } else if (data instanceof Request) {
        request = await data.json();
    }

    if ("url" in data && data.url instanceof URL) {
        searchParams = Object.fromEntries(data.url.searchParams.entries());
    } else if (data instanceof URL) {
        searchParams = Object.fromEntries(data.searchParams.entries());
    }

    if (request === null && searchParams === null) {
        return data;
    } else {
        return { ...request, searchParams: { ...searchParams } };
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
