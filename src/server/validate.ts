import { RequestEvent } from "@sveltejs/kit";
import type {
    ZodCatch,
    ZodDefault,
    ZodEffects,
    ZodFirstPartySchemaTypes,
    ZodNullable,
    ZodObject,
    ZodOptional,
    ZodType,
    ZodTypeAny,
} from "zod";
import { z } from "zod";
import { createApiObject } from "../fetch.js";
import { isZodArray, isZodBoolean } from "./helpers.js";

export async function validate<T extends EndpointSchema>(data: Data, schema: T, f?: typeof fetch) {
    const json = await parseData(data, schema);
    const parse = z.object(schema).safeParse(json);

    if (!parse.success) {
        if (
            parse.error.issues.some((i) => i.path.length === 1 && i.path.at(0) === "searchParams")
        ) {
            console.error(
                "The following error might be caused because you you forgot to pass the event url to `validate`."
            );
        }

        throw `Invalid data: ${parse.error.issues
            .map((i) => `at '${i.path.join(".")}': '${i.message}'`)
            .join(", ")}.`;
    }

    const requestFetch = f ?? ("fetch" in data ? data.fetch : fetch);
    return { data: parse.data, api: createApiObject(requestFetch) };
}

async function parseData(data: RequestEvent | Request | object, schema: EndpointSchema) {
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
        const searchParams = searchParamsFromUrl(url, schema?.searchParams?.shape);
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

function searchParamsFromUrl(url: URL | undefined, shape: SearchParams | undefined) {
    if (!url || !shape) return {};

    return Object.fromEntries(
        Array.from(url.searchParams.keys()).map((key) => {
            if (isZodArray(shape[key])) {
                console.log("is aa");
                return [key, url?.searchParams.getAll(key)];
            } else if (isZodBoolean(shape[key])) {
                console.log("is bool");
                return [key, url?.searchParams.has(key)];
            } else {
                console.log("none");
                return [key, url?.searchParams.get(key)];
            }
        })
    );
}

type Data = RequestEvent | Request | URL | { request?: Request; url?: URL } | object;
type SearchParam = string | boolean | number | bigint | undefined | null;

type NoUndefined<T> = {
    [K in keyof T]: Exclude<T[K], undefined>;
};

type SpecialZod<T extends ZodTypeAny> = T extends ZodFirstPartySchemaTypes
    ? T
    : ZodEffects<T> | ZodOptional<T> | ZodNullable<T> | ZodDefault<T> | ZodCatch<T>;

type SearchParams = Record<string, SpecialZod<ZodType<any, any, SearchParam | Array<SearchParam>>>>;

export type EndpointSchema = NoUndefined<{
    searchParams?: ZodObject<SearchParams>;
    [k: string]: ZodTypeAny | undefined;
}>;
