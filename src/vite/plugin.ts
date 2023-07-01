import { parse } from "acorn";
import { simple } from "acorn-walk";
import { readFile, writeFile } from "fs/promises";
import * as glob from "glob";
import path from "path";
import type { Plugin } from "vite";
import { z } from "zod";

const methods = ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"];
type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE" | "OPTIONS";
type EndpointData = Partial<Record<Method, string>>;
type AllowedUrls = { [key: string]: EndpointData };

export function apiFetch(): Plugin {
    let projectPath = "";
    let serverEndpointPathRegex = RegExp("");
    const allowedUrls: AllowedUrls = {};

    async function parseFile(apiUrl: string, code: string) {
        const endpoints: EndpointData = {};
        const promises: Promise<void>[] = [];

        const ast = parse(code, {
            ecmaVersion: "latest",
            sourceType: "module",
        });

        simple(ast, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ExportNamedDeclaration(node: any) {
                const exportedNode = node.declaration;
                if (exportedNode.type === "VariableDeclaration") {
                    for (const variable of exportedNode.declarations) {
                        if (methods.includes(variable.id.name)) {
                            endpoints[variable.id.name as Method] = "null";
                        }
                    }
                } else if (
                    exportedNode.type === "FunctionDeclaration" &&
                    methods.includes(exportedNode.id.name)
                ) {
                    endpoints[exportedNode.id.name as Method] = "null";
                }
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            VariableDeclarator(node: any) {
                const variable = node.init;

                if (
                    variable &&
                    variable.type === "CallExpression" &&
                    variable.callee.object &&
                    variable.callee.object.name === "z" &&
                    variable.arguments &&
                    variable.arguments.length > 0 &&
                    variable.arguments[0].type === "ObjectExpression"
                ) {
                    const nameMatch = /^_(.*)Schema$/.exec(node.id.name);
                    if (!nameMatch) return;

                    const method = nameMatch[1].toUpperCase();
                    if (!methods.includes(method) || method === "GET") return;

                    const declaration = `import('zod').then(({z}) => {
                                return ${code.slice(variable.start, variable.end)};
                            })`;

                    promises.push(
                        (0, eval)(declaration).then(
                            (schema: z.ZodTypeAny) =>
                                (endpoints[method as Method] = anyZodToType(schema))
                        )
                    );
                }
            },
        });

        await Promise.allSettled(promises);
        allowedUrls[apiUrl.replaceAll("\\", "/")] = endpoints;
    }

    async function save() {
        const content = `type AllowedUrls = {\n${Object.entries(allowedUrls)
            .map(([url, endpoints]) => {
                return `    "${url}": {\n${Object.entries(endpoints)
                    .map(([method, v]) => `        "${method}": ${v}`)
                    .join(", \n")}\n    }`;
            })
            .join(",\n")}\n}`;
        const filePath = path.join(projectPath, "src/api.d.ts");

        await writeFile(filePath, content);
    }

    return {
        name: "sveltekit-api-fetch",

        async configureServer(s) {
            projectPath = s.config.root;
            serverEndpointPathRegex = RegExp(
                `^(?:${projectPath}/)?src/routes(/.*)?/\\+server\\.(ts|js)$`
            );

            const serverFiles = glob.sync("src/routes/**/+server.ts", { cwd: projectPath });
            if (serverFiles.length === 0) return;

            const promises: Promise<void>[] = [];
            for (const filePath of serverFiles) {
                promises.push(
                    parseFile(
                        filePath.substring(10, filePath.length - 11),
                        await readFile(filePath, { encoding: "utf8" })
                    )
                );
            }

            await Promise.allSettled(promises);
            await save();
        },

        async handleHotUpdate(ctx) {
            const match = serverEndpointPathRegex.exec(ctx.file);
            if (!match) return;

            await parseFile(match[1] || "/", await ctx.read());
            await save();
        },
    };
}

function anyZodToType(zod: z.ZodTypeAny): string {
    if (zod instanceof z.ZodOptional) {
        return anyZodToType(zod._def.innerType);
    } else if (zod instanceof z.ZodEffects) {
        return anyZodToType(zod._def.schema);
    } else if (zod instanceof z.ZodString) {
        return "string";
    } else if (zod instanceof z.ZodNumber) {
        return "number";
    } else if (zod instanceof z.ZodBoolean) {
        return "boolean";
    } else if (zod instanceof z.ZodArray) {
        return anyZodToType(zod._def.type) + "[]";
    } else if (zod instanceof z.ZodObject) {
        const typeString = Object.entries(zod.shape).map(([key, value]) => {
            const optionalSuffix = (value as z.ZodAny).isOptional() ? "?" : "";
            const type = anyZodToType(value as z.ZodAny);

            return `${key}${optionalSuffix}: ${type}`;
        });
        return `{ ${typeString.join(", ")} }`;
    } else if (zod instanceof z.ZodNull) {
        return "null";
    }

    return "undefined";
}
