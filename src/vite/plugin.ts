import { writeFile } from "fs/promises";
import path from "path";
import ts from "typescript";
import type { Plugin } from "vite";

const methods = ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"];
type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE" | "OPTIONS";
type EndpointData = Partial<Record<Method, string>>;
type ProjectAPI = Record<Method, Record<string, string>>;

export function apiFetch(): Plugin {
    let projectPath = "";
    let serverEndpointPathRegex = RegExp("");
    const projectAPI: ProjectAPI = {
        GET: {},
        POST: {},
        PATCH: {},
        PUT: {},
        DELETE: {},
        OPTIONS: {},
    };

    let config: ts.ParsedCommandLine;
    let host: ts.CompilerHost;
    let program: ts.Program;

    let hotUpdateFiles: string[] = [];
    let hotUpdateTimeout: NodeJS.Timeout;

    function parseProject(files?: string[]) {
        program = ts.createProgram({
            rootNames: config.fileNames,
            options: config.options,
            oldProgram: program,
            host: host,
        });

        const sourceFiles = program.getSourceFiles();
        const typeChecker = program.getTypeChecker();
        const routesPath = path.join(projectPath, "src/routes");

        if (files) {
            for (const file of files) {
                const sourceFile = program.getSourceFile(file);
                if (!sourceFile) continue;

                parseFile(sourceFile, typeChecker);
            }
        } else {
            for (const sourceFile of sourceFiles) {
                if (serverEndpointPathRegex.test(sourceFile.fileName)) {
                    parseFile(sourceFile, typeChecker);
                }
            }
        }

        save();
    }

    function parseFile(file: ts.SourceFile, typeChecker: ts.TypeChecker) {
        const endpointsFound: Method[] = [];
        const allBodies: EndpointData = {};
        let allSearchParams: EndpointData = {};

        ts.forEachChild(file, (node) => {
            if (!ts.canHaveModifiers(node)) return;

            const isExported = node.modifiers?.some(
                (mod) => mod.kind === ts.SyntaxKind.ExportKeyword
            );

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
                        endpointsFound.push(declaration.name.escapedText as Method);
                    }

                    // Handle schema declaration (ex. const _postSchema = ...)
                    else if (isZodObjectVariableDeclaration(declaration)) {
                        const nameMatch = /^_(.*)Schema$/.exec(
                            declaration.name.escapedText as string
                        );
                        if (!nameMatch) return;

                        const method = nameMatch[1].toUpperCase();
                        if (!methods.includes(method) || method === "GET") return;

                        const { body, searchParams } = parseZodSchema(typeChecker, declaration);
                        allBodies[method as Method] = body;
                        allSearchParams[method as Method] = searchParams;
                    }
                });
            } else if (ts.isFunctionDeclaration(node)) {
                if (!node.name || !ts.isIdentifier(node.name)) {
                    console.error("no name");
                    return;
                }

                if (isExported && methods.includes(node.name.escapedText as string)) {
                    endpointsFound.push(node.name.escapedText as Method);
                }
            }
        });

        if (endpointsFound.length === 0) return;

        const typesFile = program.getSourceFile(
            path.join(
                projectPath,
                ".svelte-kit/types",
                path.relative(projectPath, path.dirname(file.fileName)),
                "$types.d.ts"
            )
        );
        if (!typesFile) return;

        let url = "";
        let routeParams: string | undefined;
        ts.forEachChild(typesFile, (node) => {
            if (ts.isTypeAliasDeclaration(node)) {
                if (node.name.text === "RouteId") {
                    url = typeChecker.typeToString(typeChecker.getTypeAtLocation(node));
                } else if (node.name.text === "RouteParams") {
                    routeParams = node.type.getText();
                    if (routeParams === "{  }") routeParams = undefined;
                }
            }
        });

        for (const method of endpointsFound) {
            projectAPI[method][url] = generateUrlType({
                body: allBodies[method],
                routeParams: routeParams,
                searchParams: allSearchParams[method],
            });
        }
    }

    async function save() {
        const projectMethods = methods.filter((m) => Object.keys(projectAPI[m as Method]).length);

        const filePath = path.join(projectPath, "src/api.d.ts");
        const fileContent = `${typeFileMessage}\ntype ProjectAPI = ${
            projectMethods.length === 0
                ? "object"
                : `{\n${projectMethods
                      .map(
                          (method) =>
                              `    ${method}: {\n${Object.entries(projectAPI[method as Method])
                                  .map(([url, type]) => `        ${url}: ${type}`)
                                  .join(";\n")};\n    }`
                      )
                      .join(";\n")};\n}`
        };\n`;

        await writeFile(filePath, fileContent);
    }

    return {
        name: "sveltekit-api-fetch",

        configureServer(s) {
            clearTimeout(hotUpdateTimeout);
            hotUpdateFiles = [];

            projectPath = s.config.root;
            serverEndpointPathRegex = RegExp(
                `^(?:${projectPath}/)?src/routes(/.*)?/\\+server\\.(ts|js)$`
            );

            const configPath = ts.findConfigFile(projectPath, ts.sys.fileExists, "tsconfig.json");
            if (!configPath) {
                throw new Error("Could not find a valid 'tsconfig.json'.");
            }

            config = ts.parseJsonConfigFileContent(
                ts.readConfigFile(configPath, ts.sys.readFile).config,
                ts.sys,
                projectPath,
                {
                    noEmit: true,
                    checkJs: false,
                    skipLibCheck: true,
                    incremental: true,
                    tsBuildInfoFile: path.join(projectPath, "tsbuildinfo"),
                },
                configPath
            );
            host = ts.createCompilerHost(config.options);

            parseProject();
        },

        handleHotUpdate(ctx) {
            if (serverEndpointPathRegex.test(ctx.file)) {
                hotUpdateFiles.push(ctx.file);

                clearTimeout(hotUpdateTimeout);
                hotUpdateTimeout = setTimeout(() => {
                    parseProject(hotUpdateFiles);
                    hotUpdateFiles = [];
                }, 300);
            }
        },
    };
}

function generateUrlType(fields: Record<string, string | undefined>) {
    const entries = Object.entries(fields).filter(([_, type]) => type !== undefined);

    if (entries.length === 0) return "never";

    return `{ ${entries.map(([name, type]) => `${name}: ${type}`).join("; ")} }`;
}

function isZodObjectVariableDeclaration(node: ts.VariableDeclaration) {
    // TODO: Make sure it is z.object
    return (
        node.initializer &&
        ts.isCallExpression(node.initializer) &&
        ts.isPropertyAccessExpression(node.initializer.expression) &&
        ts.isIdentifier(node.initializer.expression.expression) &&
        node.initializer.expression.expression.escapedText === "z" &&
        node.initializer.arguments.length > 0 &&
        ts.isObjectLiteralExpression(node.initializer.arguments[0])
    );
}

function parseZodSchema(
    typeChecker: ts.TypeChecker,
    zodVariableDeclaration: ts.VariableDeclaration
) {
    const zodTypeArguments = typeChecker.getTypeArguments(
        typeChecker.getTypeAtLocation(zodVariableDeclaration) as ts.TypeReference
    );

    let body: string | undefined;
    let searchParams: string | undefined;

    if (zodTypeArguments.length === 5) {
        const zodInputType = zodTypeArguments[4];

        body = `{ ${typeChecker
            .getPropertiesOfType(zodInputType)
            .map((property) => {
                if (property.getName() === "searchParams") return null;
                const type = typeChecker.getTypeOfSymbol(property);
                return `${property.getName()}: ${typeChecker.typeToString(type)}`;
            })
            .filter((t) => t !== null)
            .join("; ")} }`;

        const searchParamsSymbol = zodInputType.getProperty("searchParams");
        if (searchParamsSymbol) {
            const searchParamsType = typeChecker.getTypeOfSymbol(searchParamsSymbol);

            // Check if the type is an object type
            if (searchParamsType.getFlags() & ts.TypeFlags.Object) {
                searchParams = typeChecker.typeToString(searchParamsType);

                if (
                    !typeChecker.getPropertiesOfType(searchParamsType).every((property) => {
                        const propertyType = typeChecker.getTypeOfSymbol(property);
                        return propertyType.flags === ts.TypeFlags.String;
                    })
                ) {
                    console.error(
                        "Some fields of `searchParams` are not having string as their input. This may cause the validation to fail."
                    );
                }
            } else {
                console.error("The field `searchParams` has to be a Zod Object.");
            }
        }
    }

    return { body, searchParams };
}

const typeFileMessage = `/**
 * This file is generated by sveltekit-api-fetch.
 * Do not edit it, as it will be overwritten.
 * Learn more here: https://github.com/Guibi1/sveltekit-api-fetch
 */\n`;
