# SvelteKit API Fetch 🔗🌐

Making SvelteKit **fetch** and **validation** of server endpoints easier than ever!

# Feature list

-   Type safe `apiFetch` function to create a better coding experience.
-   Usage of the powerful `zod` library to parse the incomming data.
-   Zero `KB` shipped to the client.

# Installation

Install the package with your favorite NodeJs package manager.

```sh
pnpm i -D sveltekit-api-fetch zod
```

# Get started

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

2. Create a `zod` object to validate the endpoint's request body, and pass it to the `apiValidate` function. The important bit here is to name the `zod` object according to the endpoint's method. (`_postSchema`, `_deleteSchema`, `_putSchema`, etc)

    ```ts
    // src/routes/api/+server.ts
    import { json } from "@sveltejs/kit";
    import { z } from "zod";
    import { apiValidate } from "sveltekit-api-fetch";

    const _postSchema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
    });

    export const POST = async ({ request }) => {
        const { parse } = await apiValidate(request, _postSchema);

        if (!parse.success) {
            return json({ success: false });
        }

        return json({ success: true, jwt: "xxx" });
    };
    ```

3. All done, you can finnaly enjoy the new type safe `apiFetch` !

    ```ts
    import { apiFetch } from "sveltekit-api-fetch";

    apiFetch("/api", { method: "POST" }, { email: "laurent@guibi.ca", password: "******" });
    ```

# Contributing

This package is still in beta. Do not hesitate to contact me if you have feedback of any kind! :)

Ideas, bug reports, PRs and the likes are welcome as a [Github issue](https://github.com/Guibi1/sveltekit-api-fetch/issues) or as a [discussion](https://github.com/Guibi1/sveltekit-api-fetch/discussions)!
