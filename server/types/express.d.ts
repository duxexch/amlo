export { };

declare global {
    namespace Express {
        interface Request {
            tenantContext?: {
                tenantId?: string;
            };
        }
    }
}
