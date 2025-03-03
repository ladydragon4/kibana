/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import moment from 'moment';
import { ByteSizeValue } from '@kbn/config-schema';
import { PluginInitializerContext, RequestHandlerContext } from '@kbn/core/server';
import { coreMock, httpServerMock } from '@kbn/core/server/mocks';
import { usageCollectionPluginMock } from '@kbn/usage-collection-plugin/server/mocks';
import { licensingMock } from '@kbn/licensing-plugin/server/mocks';
import { featuresPluginMock } from '@kbn/features-plugin/server/mocks';
import { encryptedSavedObjectsMock } from '@kbn/encrypted-saved-objects-plugin/server/mocks';
import { taskManagerMock } from '@kbn/task-manager-plugin/server/mocks';
import { eventLogMock } from '@kbn/event-log-plugin/server/mocks';
import { ActionType, ActionsApiRequestHandlerContext, ExecutorType } from './types';
import { ActionsConfig } from './config';
import {
  ActionsPlugin,
  ActionsPluginsSetup,
  ActionsPluginsStart,
  PluginSetupContract,
} from './plugin';
import { AlertHistoryEsIndexConnectorId } from '../common';

const executor: ExecutorType<{}, {}, {}, void> = async (options) => {
  return { status: 'ok', actionId: options.actionId };
};

describe('Actions Plugin', () => {
  describe('setup()', () => {
    let context: PluginInitializerContext;
    let plugin: ActionsPlugin;
    let coreSetup: ReturnType<typeof coreMock.createSetup>;
    let pluginsSetup: jest.Mocked<ActionsPluginsSetup>;

    beforeEach(() => {
      context = coreMock.createPluginInitializerContext<ActionsConfig>({
        enabledActionTypes: ['*'],
        allowedHosts: ['*'],
        preconfiguredAlertHistoryEsIndex: false,
        preconfigured: {},
        proxyRejectUnauthorizedCertificates: true,
        rejectUnauthorized: true,
        maxResponseContentLength: new ByteSizeValue(1000000),
        responseTimeout: moment.duration(60000),
      });
      plugin = new ActionsPlugin(context);
      coreSetup = coreMock.createSetup();

      pluginsSetup = {
        taskManager: taskManagerMock.createSetup(),
        encryptedSavedObjects: encryptedSavedObjectsMock.createSetup(),
        licensing: licensingMock.createSetup(),
        eventLog: eventLogMock.createSetup(),
        usageCollection: usageCollectionPluginMock.createSetupContract(),
        features: featuresPluginMock.createSetup(),
      };
      coreSetup.getStartServices.mockResolvedValue([
        coreMock.createStart(),
        {
          ...pluginsSetup,
          encryptedSavedObjects: encryptedSavedObjectsMock.createStart(),
        },
        {},
      ]);
    });

    it('should log warning when Encrypted Saved Objects plugin is missing encryption key', async () => {
      await plugin.setup(coreSetup, pluginsSetup);
      expect(pluginsSetup.encryptedSavedObjects.canEncrypt).toEqual(false);
      expect(context.logger.get().warn).toHaveBeenCalledWith(
        'APIs are disabled because the Encrypted Saved Objects plugin is missing encryption key. Please set xpack.encryptedSavedObjects.encryptionKey in the kibana.yml or use the bin/kibana-encryption-keys command.'
      );
    });

    describe('routeHandlerContext.getActionsClient()', () => {
      it('should not throw error when ESO plugin has encryption key', async () => {
        await plugin.setup(coreSetup, {
          ...pluginsSetup,
          encryptedSavedObjects: {
            ...pluginsSetup.encryptedSavedObjects,
            canEncrypt: true,
          },
        });

        expect(coreSetup.http.registerRouteHandlerContext).toHaveBeenCalledTimes(1);
        const handler = coreSetup.http.registerRouteHandlerContext.mock.calls[0] as [
          string,
          Function
        ];
        expect(handler[0]).toEqual('actions');

        const actionsContextHandler = (await handler[1](
          {
            core: {
              savedObjects: {
                client: {},
              },
              elasticsearch: {
                client: jest.fn(),
              },
            },
          } as unknown as RequestHandlerContext,
          httpServerMock.createKibanaRequest(),
          httpServerMock.createResponseFactory()
        )) as unknown as ActionsApiRequestHandlerContext;
        expect(actionsContextHandler!.getActionsClient()).toBeDefined();
      });

      it('should throw error when ESO plugin is missing encryption key', async () => {
        await plugin.setup(coreSetup, pluginsSetup);

        expect(coreSetup.http.registerRouteHandlerContext).toHaveBeenCalledTimes(1);
        const handler = coreSetup.http.registerRouteHandlerContext.mock.calls[0] as [
          string,
          Function
        ];
        expect(handler[0]).toEqual('actions');

        const actionsContextHandler = (await handler[1](
          {
            core: {
              savedObjects: {
                client: {},
              },
            },
          } as unknown as RequestHandlerContext,
          httpServerMock.createKibanaRequest(),
          httpServerMock.createResponseFactory()
        )) as unknown as ActionsApiRequestHandlerContext;
        expect(() => actionsContextHandler!.getActionsClient()).toThrowErrorMatchingInlineSnapshot(
          `"Unable to create actions client because the Encrypted Saved Objects plugin is missing encryption key. Please set xpack.encryptedSavedObjects.encryptionKey in the kibana.yml or use the bin/kibana-encryption-keys command."`
        );
      });
    });

    describe('registerType()', () => {
      let setup: PluginSetupContract;
      const sampleActionType: ActionType = {
        id: 'test',
        name: 'test',
        minimumLicenseRequired: 'basic',
        supportedFeatureIds: ['alerting'],
        async executor(options) {
          return { status: 'ok', actionId: options.actionId };
        },
      };

      beforeEach(async () => {
        // coreMock.createSetup doesn't support Plugin generics
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setup = await plugin.setup(coreSetup as any, pluginsSetup);
      });

      it('should throw error when license type is invalid', async () => {
        expect(() =>
          setup.registerType({
            ...sampleActionType,
            // we're faking an invalid value, this requires stripping the typing
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            minimumLicenseRequired: 'foo' as any,
          })
        ).toThrowErrorMatchingInlineSnapshot(`"\\"foo\\" is not a valid license type"`);
      });

      it('should throw error when license type is less than gold', async () => {
        expect(() =>
          setup.registerType({
            ...sampleActionType,
            minimumLicenseRequired: 'basic',
          })
        ).toThrowErrorMatchingInlineSnapshot(
          `"Third party action type \\"test\\" can only set minimumLicenseRequired to a gold license or higher"`
        );
      });

      it('should not throw when license type is gold', async () => {
        setup.registerType({
          ...sampleActionType,
          minimumLicenseRequired: 'gold',
        });
      });

      it('should not throw when license type is higher than gold', async () => {
        setup.registerType({
          ...sampleActionType,
          minimumLicenseRequired: 'platinum',
        });
      });
    });

    describe('isPreconfiguredConnector', () => {
      function getConfig(overrides = {}) {
        return {
          enabled: true,
          enabledActionTypes: ['*'],
          allowedHosts: ['*'],
          preconfiguredAlertHistoryEsIndex: false,
          preconfigured: {
            preconfiguredServerLog: {
              actionTypeId: '.server-log',
              name: 'preconfigured-server-log',
              config: {},
              secrets: {},
            },
          },
          proxyRejectUnauthorizedCertificates: true,
          proxyBypassHosts: undefined,
          proxyOnlyHosts: undefined,
          rejectUnauthorized: true,
          maxResponseContentLength: new ByteSizeValue(1000000),
          responseTimeout: moment.duration('60s'),
          ...overrides,
        };
      }

      function setup(config: ActionsConfig) {
        context = coreMock.createPluginInitializerContext<ActionsConfig>(config);
        plugin = new ActionsPlugin(context);
        coreSetup = coreMock.createSetup();
        pluginsSetup = {
          taskManager: taskManagerMock.createSetup(),
          encryptedSavedObjects: encryptedSavedObjectsMock.createSetup(),
          licensing: licensingMock.createSetup(),
          eventLog: eventLogMock.createSetup(),
          usageCollection: usageCollectionPluginMock.createSetupContract(),
          features: featuresPluginMock.createSetup(),
        };
      }

      it('should correctly return whether connector is preconfigured', async () => {
        setup(getConfig());
        // coreMock.createSetup doesn't support Plugin generics
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pluginSetup = await plugin.setup(coreSetup as any, pluginsSetup);

        expect(pluginSetup.isPreconfiguredConnector('preconfiguredServerLog')).toEqual(true);
        expect(pluginSetup.isPreconfiguredConnector('anotherConnectorId')).toEqual(false);
      });
    });
  });

  describe('start()', () => {
    let context: PluginInitializerContext;
    let plugin: ActionsPlugin;
    let coreSetup: ReturnType<typeof coreMock.createSetup>;
    let coreStart: ReturnType<typeof coreMock.createStart>;
    let pluginsSetup: jest.Mocked<ActionsPluginsSetup>;
    let pluginsStart: jest.Mocked<ActionsPluginsStart>;

    beforeEach(() => {
      context = coreMock.createPluginInitializerContext<ActionsConfig>({
        enabledActionTypes: ['*'],
        allowedHosts: ['*'],
        preconfiguredAlertHistoryEsIndex: false,
        preconfigured: {
          preconfiguredServerLog: {
            actionTypeId: '.server-log',
            name: 'preconfigured-server-log',
            config: {},
            secrets: {},
          },
        },
        proxyRejectUnauthorizedCertificates: true,
        rejectUnauthorized: true,
        maxResponseContentLength: new ByteSizeValue(1000000),
        responseTimeout: moment.duration(60000),
      });
      plugin = new ActionsPlugin(context);
      coreSetup = coreMock.createSetup();
      coreStart = coreMock.createStart();
      pluginsSetup = {
        taskManager: taskManagerMock.createSetup(),
        encryptedSavedObjects: encryptedSavedObjectsMock.createSetup(),
        licensing: licensingMock.createSetup(),
        eventLog: eventLogMock.createSetup(),
        usageCollection: usageCollectionPluginMock.createSetupContract(),
        features: featuresPluginMock.createSetup(),
      };
      pluginsStart = {
        licensing: licensingMock.createStart(),
        taskManager: taskManagerMock.createStart(),
        encryptedSavedObjects: encryptedSavedObjectsMock.createStart(),
        eventLog: eventLogMock.createStart(),
      };
    });

    describe('getActionsClientWithRequest()', () => {
      it('should not throw error when ESO plugin has encryption key', async () => {
        await plugin.setup(coreSetup, {
          ...pluginsSetup,
          encryptedSavedObjects: {
            ...pluginsSetup.encryptedSavedObjects,
            canEncrypt: true,
          },
        });
        const pluginStart = await plugin.start(coreStart, pluginsStart);

        await pluginStart.getActionsClientWithRequest(httpServerMock.createKibanaRequest());
      });

      it('should throw error when ESO plugin is missing encryption key', async () => {
        await plugin.setup(coreSetup, pluginsSetup);
        const pluginStart = await plugin.start(coreStart, pluginsStart);

        expect(pluginsSetup.encryptedSavedObjects.canEncrypt).toEqual(false);
        await expect(
          pluginStart.getActionsClientWithRequest(httpServerMock.createKibanaRequest())
        ).rejects.toThrowErrorMatchingInlineSnapshot(
          `"Unable to create actions client because the Encrypted Saved Objects plugin is missing encryption key. Please set xpack.encryptedSavedObjects.encryptionKey in the kibana.yml or use the bin/kibana-encryption-keys command."`
        );
      });
    });

    describe('Preconfigured connectors', () => {
      function getConfig(overrides = {}) {
        return {
          enabled: true,
          enabledActionTypes: ['*'],
          allowedHosts: ['*'],
          preconfiguredAlertHistoryEsIndex: false,
          preconfigured: {
            preconfiguredServerLog: {
              actionTypeId: '.server-log',
              name: 'preconfigured-server-log',
              config: {},
              secrets: {},
            },
          },
          proxyRejectUnauthorizedCertificates: true,
          proxyBypassHosts: undefined,
          proxyOnlyHosts: undefined,
          rejectUnauthorized: true,
          maxResponseContentLength: new ByteSizeValue(1000000),
          responseTimeout: moment.duration('60s'),
          ...overrides,
        };
      }

      function setup(config: ActionsConfig) {
        context = coreMock.createPluginInitializerContext<ActionsConfig>(config);
        plugin = new ActionsPlugin(context);
        coreSetup = coreMock.createSetup();
        coreStart = coreMock.createStart();
        pluginsSetup = {
          taskManager: taskManagerMock.createSetup(),
          encryptedSavedObjects: encryptedSavedObjectsMock.createSetup(),
          licensing: licensingMock.createSetup(),
          eventLog: eventLogMock.createSetup(),
          usageCollection: usageCollectionPluginMock.createSetupContract(),
          features: featuresPluginMock.createSetup(),
        };
        pluginsStart = {
          licensing: licensingMock.createStart(),
          taskManager: taskManagerMock.createStart(),
          encryptedSavedObjects: encryptedSavedObjectsMock.createStart(),
          eventLog: eventLogMock.createStart(),
        };
      }

      it('should handle preconfigured actions', async () => {
        setup(getConfig());
        // coreMock.createSetup doesn't support Plugin generics
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pluginSetup = await plugin.setup(coreSetup as any, pluginsSetup);
        pluginSetup.registerType({
          id: '.server-log',
          name: 'Server log',
          minimumLicenseRequired: 'basic',
          supportedFeatureIds: ['alerting'],
          executor,
        });

        const pluginStart = await plugin.start(coreStart, pluginsStart);

        expect(pluginStart.preconfiguredActions.length).toEqual(1);
        expect(pluginStart.isActionExecutable('preconfiguredServerLog', '.server-log')).toBe(true);
      });

      it('should handle preconfiguredAlertHistoryEsIndex = true', async () => {
        setup(getConfig({ preconfiguredAlertHistoryEsIndex: true }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pluginSetup = await plugin.setup(coreSetup as any, pluginsSetup);
        pluginSetup.registerType({
          id: '.index',
          name: 'ES Index',
          minimumLicenseRequired: 'basic',
          supportedFeatureIds: ['alerting'],
          executor,
        });

        const pluginStart = await plugin.start(coreStart, pluginsStart);

        expect(pluginStart.preconfiguredActions.length).toEqual(2);
        expect(
          pluginStart.isActionExecutable('preconfigured-alert-history-es-index', '.index')
        ).toBe(true);
      });

      it('should not allow preconfigured connector with same ID as AlertHistoryEsIndexConnectorId', async () => {
        setup(
          getConfig({
            preconfigured: {
              [AlertHistoryEsIndexConnectorId]: {
                actionTypeId: '.index',
                name: 'clashing preconfigured index connector',
                config: {},
                secrets: {},
              },
            },
          })
        );
        // coreMock.createSetup doesn't support Plugin generics
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await plugin.setup(coreSetup as any, pluginsSetup);
        const pluginStart = await plugin.start(coreStart, pluginsStart);

        expect(pluginStart.preconfiguredActions.length).toEqual(0);
        expect(context.logger.get().warn).toHaveBeenCalledWith(
          `Preconfigured connectors cannot have the id "${AlertHistoryEsIndexConnectorId}" because this is a reserved id.`
        );
      });
    });

    describe('isActionTypeEnabled()', () => {
      const actionType: ActionType = {
        id: 'my-action-type',
        name: 'My action type',
        minimumLicenseRequired: 'gold',
        supportedFeatureIds: ['alerting'],
        executor: jest.fn(),
      };

      it('passes through the notifyUsage option when set to true', async () => {
        // coreMock.createSetup doesn't support Plugin generics
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pluginSetup = await plugin.setup(coreSetup as any, pluginsSetup);
        pluginSetup.registerType(actionType);
        const pluginStart = plugin.start(coreStart, pluginsStart);

        pluginStart.isActionTypeEnabled('my-action-type', { notifyUsage: true });
        expect(pluginsStart.licensing.featureUsage.notifyUsage).toHaveBeenCalledWith(
          'Connector: My action type'
        );
      });
    });

    describe('isActionExecutable()', () => {
      const actionType: ActionType = {
        id: 'my-action-type',
        name: 'My action type',
        minimumLicenseRequired: 'gold',
        supportedFeatureIds: ['alerting'],
        executor: jest.fn(),
      };

      it('passes through the notifyUsage option when set to true', async () => {
        // coreMock.createSetup doesn't support Plugin generics
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pluginSetup = await plugin.setup(coreSetup as any, pluginsSetup);
        pluginSetup.registerType(actionType);
        const pluginStart = plugin.start(coreStart, pluginsStart);

        pluginStart.isActionExecutable('123', 'my-action-type', { notifyUsage: true });
        expect(pluginsStart.licensing.featureUsage.notifyUsage).toHaveBeenCalledWith(
          'Connector: My action type'
        );
      });
    });

    describe('getActionsHealth()', () => {
      it('should return hasPermanentEncryptionKey false if canEncrypt of encryptedSavedObjects is false', async () => {
        // coreMock.createSetup doesn't support Plugin generics
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pluginSetup = await plugin.setup(coreSetup as any, pluginsSetup);
        expect(pluginSetup.getActionsHealth()).toEqual({ hasPermanentEncryptionKey: false });
      });
      it('should return hasPermanentEncryptionKey true if canEncrypt of encryptedSavedObjects is true', async () => {
        const pluginSetup = await plugin.setup(coreSetup, {
          ...pluginsSetup,
          encryptedSavedObjects: {
            ...pluginsSetup.encryptedSavedObjects,
            canEncrypt: true,
          },
        });
        expect(pluginSetup.getActionsHealth()).toEqual({ hasPermanentEncryptionKey: true });
      });
    });
  });
});
