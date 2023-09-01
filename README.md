# SvelteKit TypeSafe API Fetch 🔗🌐

Making SvelteKit **fetch** and **validation** of server endpoints easier than ever!

## Feature list

-   Type safe `fetch`-like functions to create a better coding experience.
-   Usage of the powerful `zod` library to parse the incomming data.
-   Plug and play and opt-in structure.

## Installation

Install the package with your favorite NodeJs package manager.

```sh
npm i sveltekit-typesafe-api zod
```

## Get started

Follow these 3 simple steps to harnest the power of `zod` and `TypeScript` in your API endpoints:

1. Simply add the vite plugin :

    ```ts
    // vite.config.ts
    import { sveltekit } from "@sveltejs/kit/vite";
    import { defineConfig } from "vite";
    import { typesafeApi } from "sveltekit-typesafe-api/vite";

    export default defineConfig({
        plugins: [sveltekit(), typesafeApi()],
    });
    ```

2. Create a `zod` object to validate the endpoint's request body, and pass it to the `validate` function.

    ```ts
    // src/routes/api/+server.ts
    import { json } from "@sveltejs/kit";
    import { z } from "zod";
    import { validate } from "sveltekit-typesafe-api/server";
    import type { RequestHandler } from "./$types";

    export const POST = (async ({ request }) => {
        const { data } = await validate(request, {
            email: z.string().email(),
            password: z.string().min(8),
        });

        return json({
            success: true,
            jwt: db.createJWT({ email: data.email, password: data.password }),
        });
    }) satisfies RequestHandler;
    ```

3. All done, you can finally enjoy the new type safe `api` !

    ```svelte
    <script>
        import { api } from "sveltekit-typesafe-api";

        let res: Promise<Response> | undefined;

        const onClick = () => res = api.POST("/api", { body: { email: "laurent@guibi.ca", password: "******" } });
    </sricpt>
    ```

## Contributing

This package is still in beta. Do not hesitate to contact me if you have feedback of any kind! :)

Ideas, bug reports, PRs and the likes are welcome as a [Github issue](https://github.com/Guibi1/sveltekit-typesafe-api/issues) or as a [discussion](https://github.com/Guibi1/sveltekit-typesafe-api/discussions)!
