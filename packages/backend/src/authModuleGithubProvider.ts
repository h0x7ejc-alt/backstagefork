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
import {
  githubAuthenticator,
  type GithubProfile,
} from '@backstage/plugin-auth-backend-module-github-provider';
import {
  authProvidersExtensionPoint,
  createOAuthProviderFactory,
} from '@backstage/plugin-auth-node';

const normalizeUserId = (value?: string) => {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return normalized?.replace(/^-+|-+$/g, '') || undefined;
};

const getUserIdFromProfile = (fullProfile: GithubProfile) => {
  if (fullProfile.username?.trim()) {
    return fullProfile.username;
  }

  let emailUserId: string | undefined;
  for (const email of fullProfile.emails ?? []) {
    if (email.value?.trim()) {
      emailUserId = email.value.split('@')[0];
      break;
    }
  }

  const nameParts = [
    fullProfile.name?.givenName,
    fullProfile.name?.middleName,
    fullProfile.name?.familyName,
  ].filter((part): part is string => Boolean(part));

  const profileUrlParts = fullProfile.profileUrl?.split('/').filter(Boolean);
  const profileUrlUserId = profileUrlParts?.[profileUrlParts.length - 1];

  const fallbackCandidates = [
    emailUserId,
    nameParts.join(' '),
    fullProfile.displayName,
    fullProfile.id,
    fullProfile.nodeId,
    profileUrlUserId,
  ];

  for (const candidate of fallbackCandidates) {
    const normalizedCandidate = normalizeUserId(candidate);
    if (normalizedCandidate) {
      return normalizedCandidate;
    }
  }

  throw new Error(
    'GitHub user profile does not contain enough information to determine a user identifier',
  );
};

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
              const userId = getUserIdFromProfile(fullProfile);

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
