import type { RequestEvent } from "@sveltejs/kit";
import type { z } from "zod";
import { createApiFetch } from "./fetch.js";

export async function apiValidate(data: object, schema: z.AnyZodObject, f?: typeof fetch) {
    const json = await parseRequestData(data);
    const parse = schema.safeParse(json);

    return { parse, apiFetch: createApiFetch(f ?? fetch) };
}

async function parseRequestData(data: RequestEvent | Request | object) {
    if (data instanceof Request) {
        return data.json();
    } else if ("request" in data && data.request instanceof Request) {
        return data.request.json();
    } else {
        return data;
    }
}
