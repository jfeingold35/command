/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Plugin } from 'fancy-test/lib/types';
import * as oclifTest from '@oclif/test';
import { command, Config, expect, FancyTypes } from '@oclif/test';
import { Config as OclifConfig } from '@oclif/core';
import { AuthFields, SfProject } from '@salesforce/core';
import { TestContext, testSetup } from '@salesforce/core/lib/testSetup';
import {
  AnyJson,
  asJsonMap,
  definiteValuesOf,
  Dictionary,
  ensure,
  ensureString,
  JsonMap,
  Optional,
} from '@salesforce/ts-types';

import { loadConfig } from '@oclif/test/lib/load-config';
import { SinonStub } from 'sinon';

loadConfig.root = ensure(module.parent).filename;

const $$ = testSetup();

function find(orgs: Dictionary<JsonMap>, predicate: (val: JsonMap) => boolean): Optional<JsonMap> {
  return definiteValuesOf(orgs).filter(predicate)[0];
}

const withOrg = (org: Partial<AuthFields> = {}, setAsDefault = true): Plugin<Dictionary> => {
  return {
    // TODO: properly type the dictionary
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    run(ctx: Dictionary<any>): void {
      if (!ctx.orgs) {
        ctx.orgs = {};
      }

      if (!org.username) {
        org.username = 'test@org.com';
      }

      // Override org if it exists on context
      ctx.orgs[org.username] = Object.assign(
        {
          orgId: '0x012123',
          instanceUrl: 'http://na30.salesforce.com',
          loginUrl: 'https://login.salesforce.com',
          created: '1519163543003',
          isDevHub: false,
        },
        org
      );

      ctx.orgs[org.username].default = setAsDefault;

      // eslint-disable-next-line @typescript-eslint/require-await
      const readOrg = async function (this: { path: string }): Promise<JsonMap> {
        const path = this.path;
        return asJsonMap(
          find(ctx.orgs, (val) => {
            return path.includes(ensureString(val.username));
          }),
          {}
        );
      };
      // eslint-disable-next-line @typescript-eslint/require-await
      const writeOrg = async function (this: { path: string }): Promise<JsonMap> {
        const path = this.path;
        const foundOrg = asJsonMap(
          find(ctx.orgs, (val) => {
            return path.includes(ensureString(val.username));
          }),
          {}
        );
        return (ensure($$.configStubs.AuthInfoConfig).contents = foundOrg);
      };

      $$.configStubs.AuthInfoConfig = {
        retrieveContents: readOrg,
        updateContents: writeOrg,
      };
      const defaultOrg = find(ctx.orgs, (o) => !!o.default && !o.isDevHub);
      const defaultDevHubOrg = find(ctx.orgs, (o) => !!o.default && !!o.isDevHub);
      $$.configStubs.Config = {
        contents: {
          defaultusername: defaultOrg && defaultOrg.username,
          defaultdevhubusername: defaultDevHubOrg && defaultDevHubOrg.username,
        },
      };
    },
  };
};

const withConnectionRequest = (
  fakeFunction: (request: AnyJson, options?: AnyJson) => Promise<AnyJson>
): Plugin<Dictionary> => {
  return {
    run(): void {
      $$.fakeConnectionRequest = fakeFunction;
    },
  };
};

const withProject = (SfProjectJson?: JsonMap): Plugin<unknown> => {
  return {
    run(): void {
      // Restore first if already stubbed by $$.inProject()
      /* eslint-disable-next-line @typescript-eslint/unbound-method */
      const projPathStub = SfProject.resolveProjectPath as SinonStub;
      if (projPathStub.restore) {
        projPathStub.restore();
      }
      $$.SANDBOX.stub(SfProject, 'resolveProjectPath').callsFake((path: string | undefined) => {
        return $$.localPathRetriever(path || $$.id);
      });
      const DEFAULT_PROJECT_JSON = {
        sfdcLoginUrl: 'https://login.salesforce.com',
      };
      $$.configStubs.SfProjectJson = {
        contents: Object.assign({}, DEFAULT_PROJECT_JSON, SfProjectJson),
      };
    },
  };
};

const test: typeof oclifTest.test = oclifTest.test
  .register('withOrg', withOrg)
  .register('withConnectionRequest', withConnectionRequest)
  .register('withProject', withProject);

export default test;

export { expect, FancyTypes, Config, command, loadConfig, OclifConfig, test, $$, TestContext };
