// Session creation and route protection must use the same signing secret.
export const authSecret =
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    "intelar-default-session-secret-change-in-production";
