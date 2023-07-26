import { error, type RequestEvent } from "@sveltejs/kit";
import { z } from "zod";
import { createApiObject } from "./fetch.js";

export async function apiValidate<T extends z.ZodType>(data: object, schema: T, f?: typeof fetch) {
    const json = await parseRequestData(data);
    const parse = schema.safeParse(json) as z.SafeParseReturnType<T["_input"], T["_output"]>;

    if (!parse.success) {
        throw error(400, "Invalid data: " + parse.error.message);
    }

    return { data: parse.data, api: createApiObject(f ?? fetch) };
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
