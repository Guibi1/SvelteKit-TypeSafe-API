import { ZodFirstPartyTypeKind, type ZodArray, type ZodBoolean, type ZodTypeAny } from "zod";

export function isZodArray(zod: ZodTypeAny): zod is ZodArray<any> {
    const unwraped = unwrapZodEffects(zod);
    return unwraped._def.typeName === ZodFirstPartyTypeKind.ZodArray;
}

export function isZodBoolean(zod: ZodTypeAny): zod is ZodBoolean {
    const unwraped = unwrapZodEffects(zod);
    return unwraped._def.typeName === ZodFirstPartyTypeKind.ZodBoolean;
}

function unwrapZodEffects(zod: ZodTypeAny): ZodTypeAny {
    if ("unwrap" in zod && typeof zod.unwrap === "function") {
        return unwrapZodEffects(zod.unwrap());
    } else if ("removedDefault" in zod && typeof zod.removedDefault === "function") {
        return unwrapZodEffects(zod.removedDefault());
    } else if ("sourceType" in zod && typeof zod.sourceType === "function") {
        return unwrapZodEffects(zod.sourceType());
    } else {
        return zod;
    }
}
