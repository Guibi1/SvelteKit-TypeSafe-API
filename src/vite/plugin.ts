import { readFile, writeFile } from "fs/promises";
import * as glob from "glob";
import path from "path";
import ts from "typescript";
import type { Plugin } from "vite";
import { z } from "zod";

const methods = ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"];
type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE" | "OPTIONS";
type EndpointData = Partial<Record<Method, string>>;
type AllowedUrls = { [key: string]: string };

export function apiFetch(): Plugin {
    let projectPath = "";
    let serverEndpointPathRegex = RegExp("");
    const allowedUrls: AllowedUrls = {};

    async function parseFile(apiUrl: string, code: string) {
        const endpoints: Method[] = [];
        const schemas: EndpointData = {};
        const promises: Promise<void>[] = [];

        const ast = ts.createSourceFile(apiUrl, code, ts.ScriptTarget.ESNext);
        ast.forEachChild((node) => {
            if (!ts.canHaveModifiers(node)) return;

            const isExported =
                node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword) ?? false;

            if (ts.isVariableStatement(node)) {
                node.declarationList.declarations.forEach((declaration) => {
                    if (!ts.isIdentifier(declaration.name)) {
                        console.error("no name");
                        return;
                    }

                    // Handle exported endpoint (ex. export const POST = ...)
                    else if (
                        isExported &&
                        methods.includes(declaration.name.escapedText as string)
                    ) {
                        endpoints.push(declaration.name.escapedText as Method);
                    }

                    // Handle schema declaration (ex. const _postSchema = ...)
                    else if (
                        declaration.initializer &&
                        ts.isCallExpression(declaration.initializer) &&
                        ts.isPropertyAccessExpression(declaration.initializer.expression) &&
                        ts.isIdentifier(declaration.initializer.expression.expression) &&
                        declaration.initializer.expression.expression.escapedText === "z" &&
                        declaration.initializer.arguments.length > 0 &&
                        ts.isObjectLiteralExpression(declaration.initializer.arguments[0])
                    ) {
                        const nameMatch = /^_(.*)Schema$/.exec(
                            declaration.name.escapedText as string
                        );
                        if (!nameMatch) return;

                        const method = nameMatch[1].toUpperCase();
                        if (!methods.includes(method) || method === "GET") return;

                        const UNSAFECODE = `import('zod').then(({z}) => {
                                return ${code.slice(declaration.pos, declaration.end)};
                            })`;

                        promises.push(
                            (0, eval)(UNSAFECODE).then(
                                (schema: z.ZodTypeAny) =>
                                    (schemas[method as Method] = anyZodToType(schema))
                            )
                        );
                    }
                });
            } else if (ts.isFunctionDeclaration(node)) {
                if (!node.name || !ts.isIdentifier(node.name)) {
                    console.error("no name");
                    return;
                }

                if (isExported && methods.includes(node.name.escapedText as string)) {
                    endpoints.push(node.name.escapedText as Method);
                }
            }
        });

        await Promise.allSettled(promises);

        allowedUrls[apiUrl.replaceAll("\\", "/")] = endpoints
            .map((method) => `        ${method}: ${schemas[method] ?? "null"}`)
            .join(";\n");
    }

    async function save() {
        const content = `${typeFileMessage}\ntype AllowedUrls = {\n${Object.entries(allowedUrls)
            .map(([url, endpoints]) => {
                return `    "${url}": {\n${endpoints};\n    }`;
            })
            .join(";\n")};\n};\n`;

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

        if (typeString.length === 0) {
            return "Record<string, never>";
        }

        return `{ ${typeString.join("; ")} }`;
    } else if (zod instanceof z.ZodNull) {
        return "null";
    }

    return "undefined";
}

const typeFileMessage = `/**
 * This file is generated by sveltekit-api-fetch.
 * Do not edit it, as it will be overwritten.
 * Learn more here: https://github.com/Guibi1/sveltekit-api-fetch
 */\n`;
