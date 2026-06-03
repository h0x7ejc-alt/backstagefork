/*
 * Copyright 2024 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createBackendModule } from '@backstage/backend-plugin-api';
import {
  DEFAULT_NAMESPACE,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { githubAuthenticator } from '@backstage/plugin-auth-backend-module-github-provider';
import {
  authProvidersExtensionPoint,
  createOAuthProviderFactory,
} from '@backstage/plugin-auth-node';

function deriveUserId(fullProfile: {
  username?: string;
  email?: string;
  emails?: Array<{ value: string; type?: string }>;
  displayName?: string;
  id?: string;
}): string {
  if (fullProfile.username) {
    return fullProfile.username;
  }

  const email =
    fullProfile.email || fullProfile.emails?.[0]?.value?.replace(/@.*$/, '');
  if (email) {
    return email.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  if (fullProfile.displayName) {
    return fullProfile.displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  if (fullProfile.id) {
    return fullProfile.id;
  }

  throw new Error(
    'GitHub user profile does not contain any identifiable field',
  );
}

export default createBackendModule({
  pluginId: 'auth',
  moduleId: 'githubProvider',
  register(reg) {
    reg.registerInit({
      deps: { providers: authProvidersExtensionPoint },
      async init({ providers }) {
        providers.registerProvider({
          providerId: 'github',
          factory: createOAuthProviderFactory({
            authenticator: githubAuthenticator,
            async signInResolver({ result: { fullProfile } }, ctx) {
              const userId = deriveUserId(fullProfile);

              const userEntityRef = stringifyEntityRef({
                kind: 'User',
                name: userId,
                namespace: DEFAULT_NAMESPACE,
              });

              return ctx.issueToken({
                claims: {
                  sub: userEntityRef,
                  ent: [userEntityRef],
                },
              });
            },
          }),
        });
      },
    });
  },
});
