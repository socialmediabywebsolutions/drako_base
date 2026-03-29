import { getAuthsCookieConfig } from "@/lib/auths/cookies";
import { loginAuthsUser, registerAuthsUser } from "@/lib/auths/services";
import type { AuthsContext } from "@/lib/auths/types";

type AuthsFactory = {
  context: Exclude<AuthsContext, "bases">;
  register: typeof registerAuthsUser;
  login: typeof loginAuthsUser;
  getCookieConfig: typeof getAuthsCookieConfig;
};

function createAuthsFactory(context: Exclude<AuthsContext, "bases">): AuthsFactory {
  return {
    context,
    register: (params) => registerAuthsUser({ ...params, context }),
    login: (params) => loginAuthsUser({ ...params, context }),
    getCookieConfig: () => getAuthsCookieConfig(context),
  };
}

export const drakosAuthsFactory = createAuthsFactory("drakos");
export const mentoriasAuthsFactory = createAuthsFactory("mentorias");
export const socialflowAuthsFactory = createAuthsFactory("socialflow");
