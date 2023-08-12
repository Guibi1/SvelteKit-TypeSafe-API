import ts from "typescript";

export function generateUrlType(fields: Record<string, string | undefined>) {
    const entries = Object.entries(fields).filter(([_, type]) => type !== undefined);
    if (entries.length === 0) return "never";

    return `{ ${entries.map(([name, type]) => `${name}: ${type}`).join("; ")} }`;
}

export function getSchemaFromFunction(func: ts.SignatureDeclaration) {
    return ts.forEachChild(func, (node) => {
        if (ts.isBlock(node)) {
            return ts.forEachChild(node, (node) => {
                if (ts.isVariableStatement(node)) {
                    return ts.forEachChild(node.declarationList, (declaration) => {
                        if (
                            ts.isVariableDeclaration(declaration) &&
                            declaration.initializer &&
                            ts.isAwaitExpression(declaration.initializer) &&
                            ts.isCallExpression(declaration.initializer.expression)
                        ) {
                            return declaration.initializer.expression.arguments[1];
                        }
                    });
                }
            });
        }
    });
}

export function parseSchema(typeChecker: ts.TypeChecker, zodVariableDeclaration: ts.Node) {
    const zodInputType = typeChecker.getTypeAtLocation(zodVariableDeclaration);

    const body = `{ ${typeChecker
        .getPropertiesOfType(zodInputType)
        .map((property) => {
            if (property.getName() === "searchParams") return null;
            const outputType = getZodTypeToString(
                typeChecker,
                typeChecker.getTypeOfSymbol(property)
            );
            if (!outputType) return null;
            return `${property.getName()}: ${outputType}`;
        })
        .filter((t) => t !== null)
        .join("; ")} }`;

    let searchParams: string | undefined;
    const searchParamsSymbol = zodInputType.getProperty("searchParams");
    if (searchParamsSymbol) {
        const searchParamsType = typeChecker.getTypeOfSymbol(searchParamsSymbol);

        // Check if the type is an object type
        if (searchParamsType.getFlags() & ts.TypeFlags.Object) {
            const outputType = getZodTypeToString(typeChecker, searchParamsType);
            searchParams = outputType;

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

    return { body: body != "{  }" ? body : undefined, searchParams };
}

function getZodTypeToString(typeChecker: ts.TypeChecker, type: ts.Type): string {
    const zodType = type.getBaseTypes()?.[0];
    if (zodType) {
        return typeChecker.typeToString(
            typeChecker.getTypeArguments(zodType as ts.TypeReference)[2]
        );
    }

    const zodArguments = typeChecker.getTypeArguments(type as ts.TypeReference);
    if (zodArguments.length === 5) {
        // Fallback for zodObject
        return typeChecker.typeToString(zodArguments[4]);
    } else if (zodArguments.length === 2) {
        // Fallback for zodArray
        return getZodTypeToString(typeChecker, zodArguments[0]) + "[]";
    }

    return getZodTypeToString(typeChecker, zodArguments[0]);
}
