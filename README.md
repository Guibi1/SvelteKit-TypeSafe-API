# SvelteKit API Fetch 🔗🌐

Making SvelteKit **fetch** and **validation** of server endpoints easier than ever!

## Feature list

-   Type safe `fetch` functions to create a better coding experience.
-   Usage of the powerful `zod` library to parse the incomming data.
-   Plug and play and opt-in structure.

## Installation

Install the package with your favorite NodeJs package manager.

```sh
npm i sveltekit-api-fetch zod
```

## Get started

Follow these 3 simple steps to harnest the power of `zod` and `TypeScript` in your API endpoints:

1. Simply add the vite plugin :

    ```ts
    // vite.config.ts
    import { sveltekit } from "@sveltejs/kit/vite";
    import { defineConfig } from "vite";
    import { apiFetch } from "sveltekit-api-fetch/vite";

    export default defineConfig({
        plugins: [sveltekit(), apiFetch()],
    });
    ```

2. Create a `zod` object to validate the endpoint's request body, and pass it to the `apiValidate` function.

    ```ts
    // src/routes/api/+server.ts
    import { json } from "@sveltejs/kit";
    import { z } from "zod";
    import { apiValidate, type EndpointSchema } from "sveltekit-api-fetch/server";
    import type { RequestHandler } from "./$types";

    const postSchema = {
        email: z.string().email(),
        password: z.string().min(8),
    } } satisfies EndpointSchema;

    export const POST = (async ({ request }) => {
        const { data } = await apiValidate(request, postSchema);

        return json({
            success: true,
            jwt: db.createJWT({ email: data.email, password: data.password }),
        });
    }) satisfies RequestHandler;
    ```

3. All done, you can finally enjoy the new type safe `api` !

    ```svelte
    <script>
        import { api } from "sveltekit-api-fetch";
        import { onMount } from "svelte";

        let res: Promise<Response> | undefined;

        onMount(() => res = api.POST("/api", { body: { email: "laurent@guibi.ca", password: "******" } }));
    </sricpt>
    ```

## Contributing

This package is still in beta. Do not hesitate to contact me if you have feedback of any kind! :)

Ideas, bug reports, PRs and the likes are welcome as a [Github issue](https://github.com/Guibi1/sveltekit-api-fetch/issues) or as a [discussion](https://github.com/Guibi1/sveltekit-api-fetch/discussions)!
