import { createEndpoint } from "./endpoint";
import type { ApiOptions, DefaultPathParams, Endpoint, PathParamNames } from "./types";

export function defineApi(options: ApiOptions) {
  return {
    endpoint<const Template extends string>(template: Template) {
      return createEndpoint({
        api: options,
        template,
        method: "get",
        methodSet: false
      }) as unknown as Endpoint<Template, PathParamNames<Template>, false, DefaultPathParams<Template>, never, never, never, unknown, never>;
    }
  };
}
