import type { ConfigurationParameters } from '@ory/client';
import { Configuration, FrontendApi } from '@ory/client';

export const kratosPath = '/.kratos';

export const configuration: ConfigurationParameters = {
  basePath: kratosPath,
  baseOptions: {
    withCredentials: true,
  },
};

export const frontendApi = new FrontendApi(new Configuration(configuration));
export * from '@ory/client';